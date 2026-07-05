using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using HisPharmacy.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RequisitionController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly StockService _stockService;
    private readonly IHubContext<PharmacyHub> _hubContext;
    public static bool IsHeadApprovalDelegated { get; set; } = false;
    public static DateTime? DelegationActivatedAt { get; set; } = null;

    public RequisitionController(HisDbContext context, StockService stockService, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _stockService = stockService;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllRequisitions()
    {
        var list = await _context.MedicineRequisitions
            .Include(r => r.Department)
            .Include(r => r.Details)!.ThenInclude(d => d.Medicine)
            .OrderByDescending(r => r.RequisitionDate)
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("transfers")]
    public async Task<IActionResult> GetInternalTransfers()
    {
        var list = await _context.InternalTransfers
            .Include(t => t.ToDepartment)
            .Include(t => t.Requisition)
            .Include(t => t.Details)!.ThenInclude(d => d.Batch)!.ThenInclude(b => b!.Medicine)
            .OrderByDescending(t => t.TransferDate)
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("pending")]
    public async Task<IActionResult> GetPendingRequisitions()
    {
        var list = await _context.MedicineRequisitions
            .Include(r => r.Department)
            .Include(r => r.Details)!.ThenInclude(d => d.Medicine)
            .Where(r => r.Status == "Pending")
            .OrderByDescending(r => r.RequisitionDate)
            .ToListAsync();
        return Ok(list);
    }

    [HttpPost("submit")]
    public async Task<IActionResult> SubmitRequisition([FromBody] MedicineRequisition req)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "head_nurse" && userRole != "head" && userRole != "nurse")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Điều dưỡng hoặc Trưởng khoa mới có quyền đề nghị lĩnh thuốc." });

        if (req == null || req.DepartmentID <= 0 || !req.Details.Any())
            return BadRequest(new { Error = "Thông tin phiếu lĩnh không hợp lệ." });

        if (userRole == "head")
        {
            req.Status = "Pending";
            req.HeadSignature = req.DigitalSignature;
        }
        else
        {
            req.Status = "PendingHead";
        }
        req.RequisitionDate = DateTime.Now;

        _context.MedicineRequisitions.Add(req);
        await _context.SaveChangesAsync();

        var result = await _context.MedicineRequisitions
            .Include(r => r.Department)
            .Include(r => r.Details)!.ThenInclude(d => d.Medicine)
            .FirstOrDefaultAsync(r => r.RequisitionID == req.RequisitionID);

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Requisitions");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

        return Ok(result);
    }

    [HttpGet("delegation-status")]
    public IActionResult GetDelegationStatus()
    {
        return Ok(new { IsDelegated = IsHeadApprovalDelegated });
    }

    [HttpPost("toggle-delegation")]
    public IActionResult ToggleDelegation([FromBody] DelegationToggleRequest req)
    {
        IsHeadApprovalDelegated = req.IsDelegated;
        DelegationActivatedAt = req.IsDelegated ? DateTime.Now : null;
        return Ok(new { IsDelegated = IsHeadApprovalDelegated });
    }

    public class DelegationToggleRequest
    {
        public bool IsDelegated { get; set; }
    }

    public class HeadApproveRequest
    {
        public string? DigitalSignature { get; set; }
        public string? SignerName { get; set; }
    }

    [HttpPost("{id}/head-approve")]
    public async Task<IActionResult> HeadApprove(int id, [FromBody] HeadApproveRequest? payload)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "head" && !(userRole == "head_nurse" && IsHeadApprovalDelegated))
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Trưởng khoa mới có quyền ký duyệt phiếu này (hoặc Điều dưỡng trưởng khoa được ủy quyền)." });

        if (payload == null || string.IsNullOrWhiteSpace(payload.DigitalSignature))
            return BadRequest(new { Error = "Chữ ký không hợp lệ." });

        try
        {
            var req = await _context.MedicineRequisitions.FindAsync(id);
            if (req == null) return NotFound();
            if (req.Status == "Rejected") return BadRequest("Không thể ký duyệt phiếu đã bị từ chối.");

            req.HeadSignature = payload.DigitalSignature;
            req.HeadApproveDate = DateTime.Now;
            
            if (userRole == "head_nurse")
            {
                var headUser = await _context.Users
                    .FirstOrDefaultAsync(u => u.DepartmentID == req.DepartmentID && u.Role == "head");
                req.DelegatedBy = headUser?.FullName ?? "Trưởng khoa lâm sàng";
                req.DelegatedTo = payload.SignerName ?? "Điều dưỡng trưởng khoa";
                req.DelegationActivatedAt = DelegationActivatedAt;
            }

            if (req.Status == "PendingHead")
            {
                req.Status = "Pending";
            }

            await _context.SaveChangesAsync();

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Requisitions");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = "Trưởng khoa ký duyệt phiếu thành công!" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/receive")]
    public async Task<IActionResult> Receive(int id, [FromBody] RequisitionReceivePayload? payload)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = "Điều dưỡng nhận";

        if (userRole != "head_nurse" && userRole != "nurse" && userRole != "head")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ nhân viên khoa lâm sàng mới có quyền xác nhận nhận thuốc." });

        if (payload == null || string.IsNullOrWhiteSpace(payload.ReceiverSignature))
            return BadRequest(new { Error = "Chữ ký nhận của điều dưỡng tiếp nhận không được để trống." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var req = await _context.MedicineRequisitions
                .Include(r => r.Details)
                .FirstOrDefaultAsync(r => r.RequisitionID == id);

            if (req == null) return NotFound();
            if (req.Status != "InTransit") return BadRequest("Phiếu chưa ở trạng thái đang vận chuyển (InTransit).");
            if (req.ReceiveDate != null) return BadRequest("Phiếu đã được xác nhận nhận thuốc trước đó.");

            // Load associated InternalTransfer to find dispensed batches & quantities
            var transfer = await _context.InternalTransfers
                .Include(t => t.Details)
                .FirstOrDefaultAsync(t => t.RequisitionID == id);

            if (transfer == null)
                return BadRequest(new { Error = "Không tìm thấy dữ liệu vận chuyển liên kết với phiếu này." });

            string oldStatus = req.Status;

            foreach (var reqDetail in req.Details)
            {
                // Find received payload info for this detail
                var receiveInfo = payload.Details?.FirstOrDefault(d => d.RequisitionDetailID == reqDetail.RequisitionDetailID);
                
                int receivedQty = reqDetail.DispensedQuantity ?? 0;
                if (payload.DeliveryConfirmStatus == "Reject")
                {
                    receivedQty = 0;
                }
                else if (payload.DeliveryConfirmStatus == "PartialAccept" && receiveInfo != null)
                {
                    receivedQty = receiveInfo.ReceivedQuantity;
                }

                string? itemRejectReason = receiveInfo?.RejectReason;
                reqDetail.ReceivedQuantity = receivedQty;

                // Find transfer details for this medicine
                var tDetails = transfer.Details.Where(td => _context.Batches.Any(b => b.BatchID == td.BatchID && b.MedicineID == reqDetail.MedicineID)).ToList();

                int remainingToReceive = receivedQty;

                foreach (var td in tDetails)
                {
                    var invStock = await _context.InventoryStocks.FirstOrDefaultAsync(s => s.BatchID == td.BatchID);
                    int allocatedQty = td.Quantity;

                    // How much is accepted for this batch
                    int acceptedForBatch = Math.Min(allocatedQty, remainingToReceive);
                    int rejectedForBatch = allocatedQty - acceptedForBatch;
                    remainingToReceive -= acceptedForBatch;

                    if (invStock != null)
                    {
                        // 1. Subtract from ReservedQuantity
                        invStock.ReservedQuantity = Math.Max(0, invStock.ReservedQuantity - allocatedQty);

                        // 2. If rejected portion > 0, move it to QuarantineStocks instead of rolling back immediately to available chẵn
                        if (rejectedForBatch > 0)
                        {
                            _context.QuarantineStocks.Add(new QuarantineStock
                            {
                                BatchID = td.BatchID,
                                MedicineID = reqDetail.MedicineID,
                                LocationType = "MainStore",
                                DepartmentID = null,
                                Quantity = rejectedForBatch,
                                Reason = itemRejectReason ?? "Từ chối nhận bàn giao lúc giao thuốc (sai số lượng/lỗi)",
                                Status = "PendingInspection",
                                ReportedBy = userFullName,
                                CreatedAt = DateTime.Now
                            });

                            // Log movement as quarantine
                            _context.InventoryMovements.Add(new InventoryMovement
                            {
                                MedicineID = reqDetail.MedicineID,
                                BatchID = td.BatchID,
                                LocationType = "MainStore",
                                DepartmentID = null,
                                BeforeQuantity = invStock.CurrentQuantity,
                                ChangeQuantity = 0, // CurrentQuantity didn't change (still subtracted), but we moved from Reserve -> Quarantine
                                AfterQuantity = invStock.CurrentQuantity,
                                SourceType = "Requisition",
                                SourceID = id,
                                Action = "MOVE_TO_QUARANTINE",
                                ByUser = userFullName,
                                CreatedAt = DateTime.Now
                            });
                        }

                        // 3. If accepted portion > 0, add to Department Cabinet stock
                        if (acceptedForBatch > 0)
                        {
                            var deptStock = await _context.DepartmentStocks
                                .FirstOrDefaultAsync(ds => ds.DepartmentID == req.DepartmentID && ds.BatchID == td.BatchID);

                            int deptBefore = deptStock?.CurrentQuantity ?? 0;

                            if (deptStock != null)
                            {
                                deptStock.CurrentQuantity += acceptedForBatch;
                            }
                            else
                            {
                                deptStock = new DepartmentStock
                                {
                                    DepartmentID = req.DepartmentID,
                                    BatchID = td.BatchID,
                                    CurrentQuantity = acceptedForBatch
                                };
                                _context.DepartmentStocks.Add(deptStock);
                            }

                            // Log movement for Cabinet (ADD)
                            _context.InventoryMovements.Add(new InventoryMovement
                            {
                                MedicineID = reqDetail.MedicineID,
                                BatchID = td.BatchID,
                                LocationType = "Cabinet",
                                DepartmentID = req.DepartmentID,
                                BeforeQuantity = deptBefore,
                                ChangeQuantity = acceptedForBatch,
                                AfterQuantity = deptBefore + acceptedForBatch,
                                SourceType = "Requisition",
                                SourceID = id,
                                Action = "ADD",
                                ByUser = userFullName,
                                CreatedAt = DateTime.Now
                            });
                        }
                    }
                }
            }

            // Set final Requisition Status
            if (payload.DeliveryConfirmStatus == "Reject")
            {
                req.Status = "RejectedOnReceive";
                req.RejectReason = payload.WitnessName != null ? $"Chứng kiến: {payload.WitnessName}. Lý do: {payload.Details?.FirstOrDefault()?.RejectReason}" : "Từ chối nhận bàn giao toàn bộ";
            }
            else if (payload.DeliveryConfirmStatus == "PartialAccept")
            {
                req.Status = "PartiallyReceived";
                req.RejectReason = $"Nhận một phần. Lý do: {payload.Details?.FirstOrDefault(x => !string.IsNullOrEmpty(x.RejectReason))?.RejectReason}";
            }
            else
            {
                req.Status = "Received";
            }

            req.ReceiverSignature = payload.ReceiverSignature;
            req.ReceiverName = payload.ReceiverName ?? userFullName;
            req.ReceiveDate = DateTime.Now;

            // Check SLA Breach
            if (req.DeliveredAt != null)
            {
                var durationMinutes = (req.ReceiveDate.Value - req.DeliveredAt.Value).TotalMinutes;
                if (durationMinutes > req.SlaMinutes)
                {
                    req.IsSlaBreached = true;
                }
            }

            // Log User Action to AuditLogs
            _context.AuditLogs.Add(new AuditLog
            {
                Username = userFullName,
                UserRole = userRole,
                Action = $"CONFIRM_RECEIPT_{payload.DeliveryConfirmStatus.ToUpper()}",
                EntityName = "MedicineRequisition",
                EntityID = id,
                BeforeData = $"Status: {oldStatus}",
                AfterData = $"Status: {req.Status}, Temp: {payload.Temp}°C, Witness: {payload.WitnessName}",
                IPAddress = "127.0.0.1",
                Device = "Web Browser (Clinical)",
                CreatedAt = DateTime.Now
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Requisitions");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = $"Xác nhận nhận thuốc thành công! Trạng thái: {req.Status}." });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> Approve(int id, [FromBody] RequisitionApprovalPayload? payload)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược mới có quyền duyệt phiếu dự trù." });
        try
        {
            var req = await _context.MedicineRequisitions.FindAsync(id);
            if (req == null) return NotFound();

            // Check lock MainStore
            var isMainStoreLocked = await _context.InventoryAudits.AnyAsync(a => a.LocationType == "MainStore" && (a.Status == "Nháp" || a.Status == "Chờ xác nhận" || a.Status == "Có chênh lệch"));
            if (isMainStoreLocked)
                return BadRequest(new { Error = "Kho chẵn chính đang tiến hành kiểm kê và bị khóa giao dịch xuất kho." });

            // Check lock Cabinet
            var isCabinetLocked = await _context.InventoryAudits.AnyAsync(a => a.LocationType == "Cabinet" && a.DepartmentID == req.DepartmentID && (a.Status == "Nháp" || a.Status == "Chờ xác nhận" || a.Status == "Có chênh lệch"));
            if (isCabinetLocked)
                return BadRequest(new { Error = "Tủ trực của khoa tiếp nhận đang tiến hành kiểm kê và bị khóa giao dịch nhập xuất." });

            var signature = payload?.ApproverSignature;
            var details = payload?.Details;
            await _stockService.ApproveRequisitionAsync(id, signature, payload?.ApproverName, details, payload?.DeliveryBy, payload?.DeliveryPhone);

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Requisitions");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = "Phê duyệt phiếu dự trù thành công theo nguyên tắc FEFO, thuốc đang được vận chuyển." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> Reject(int id, [FromBody] RequisitionRejectPayload? payload)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "head")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược hoặc Trưởng khoa mới có quyền từ chối phiếu lĩnh." });

        try
        {
            var req = await _context.MedicineRequisitions.FindAsync(id);
            if (req == null) return NotFound();
            if (req.Status != "Pending" && req.Status != "PendingHead") return BadRequest("Phiếu đã được xử lý hoặc không hợp lệ.");

            // Require reason if this is a cabinet refill request
            if (req.RequisitionType == "CabinetRefill" && string.IsNullOrWhiteSpace(payload?.RejectReason))
            {
                return BadRequest(new { Error = "Vui lòng cung cấp lý do từ chối yêu cầu bù tủ trực của khoa." });
            }

            req.Status = "Rejected";
            req.RejectReason = payload?.RejectReason;
            if (userRole == "head")
            {
                req.HeadSignature = payload?.ApproverSignature;
            }
            else
            {
                req.ApproverSignature = payload?.ApproverSignature;
            }

            await _context.SaveChangesAsync();

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Requisitions");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");
            if (req.RequisitionType == "CabinetRefill")
            {
                await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
            }

            return Ok(new { Message = "Đã từ chối phiếu lĩnh." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments()
    {
        var list = await _context.Departments.ToListAsync();
        return Ok(list);
    }

    [HttpPost("transfer")]
    public async Task<IActionResult> DirectTransfer([FromBody] DirectTransferRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược mới có quyền thực hiện cấp phát trực tiếp." });

        if (request == null || request.DepartmentID <= 0 || request.Quantity <= 0 || request.BatchID <= 0)
            return BadRequest(new { Error = "Thông tin cấp phát không hợp lệ." });

        // Check lock MainStore
        var isMainStoreLocked = await _context.InventoryAudits.AnyAsync(a => a.LocationType == "MainStore" && (a.Status == "Nháp" || a.Status == "Chờ xác nhận" || a.Status == "Có chênh lệch"));
        if (isMainStoreLocked)
            return BadRequest(new { Error = "Kho chẵn chính đang tiến hành kiểm kê và bị khóa giao dịch xuất kho trực tiếp." });

        // Check lock Cabinet
        var isCabinetLocked = await _context.InventoryAudits.AnyAsync(a => a.LocationType == "Cabinet" && a.DepartmentID == request.DepartmentID && (a.Status == "Nháp" || a.Status == "Chờ xác nhận" || a.Status == "Có chênh lệch"));
        if (isCabinetLocked)
            return BadRequest(new { Error = "Tủ trực của khoa tiếp nhận đang tiến hành kiểm kê và bị khóa giao dịch nhập xuất." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // 1. Check main store stock
            var invStock = await _context.InventoryStocks
                .Include(s => s.Batch)
                .FirstOrDefaultAsync(s => s.BatchID == request.BatchID);

            if (invStock == null || invStock.CurrentQuantity < request.Quantity)
                return BadRequest(new { Error = "Số lượng tồn kho chính không đủ để cấp phát." });

            if (invStock.Batch != null && invStock.Batch.Status != "Bình thường")
                return BadRequest(new { Error = $"Lô thuốc này đang ở trạng thái [{invStock.Batch.Status}], không được phép thực hiện cấp phát." });

            // 2. Subtract from main store and add to ReservedQuantity
            invStock.CurrentQuantity -= request.Quantity;
            invStock.ReservedQuantity += request.Quantity;

            // 3. Create a preceding MedicineRequisition under the hood
            var requisition = new MedicineRequisition
            {
                DepartmentID = request.DepartmentID,
                RequisitionDate = DateTime.Now,
                RequisitionType = "DirectTransfer",
                Status = "InTransit",
                ApproverSignature = request.DigitalSignature,
                DeliveredAt = DateTime.Now,
                DeliveryBy = "Thủ kho Dược",
                DeliveryPhone = "0909123456",
                SlaMinutes = 120,
                IsSlaBreached = false
            };
            _context.MedicineRequisitions.Add(requisition);
            await _context.SaveChangesAsync(); // Generates RequisitionID

            // 4. Create MedicineRequisitionDetail
            var reqDetail = new MedicineRequisitionDetail
            {
                RequisitionID = requisition.RequisitionID,
                MedicineID = invStock.Batch?.MedicineID ?? 0,
                RequestedQuantity = request.Quantity,
                DispensedQuantity = request.Quantity
            };
            _context.MedicineRequisitionDetails.Add(reqDetail);

            // 5. Record InternalTransfer log linked to the Requisition
            var transfer = new InternalTransfer
            {
                FromDepartmentID = null,
                ToDepartmentID = request.DepartmentID,
                TransferDate = DateTime.Now,
                DigitalSignature = request.DigitalSignature,
                RequisitionID = requisition.RequisitionID
            };
            _context.InternalTransfers.Add(transfer);
            await _context.SaveChangesAsync(); // Generates TransferID

            transfer.Details.Add(new InternalTransferDetail
            {
                TransferID = transfer.TransferID,
                BatchID = request.BatchID,
                Quantity = request.Quantity
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            // Broadcast updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = "Cấp phát trực tiếp xuống tủ trực khoa phòng thành công." });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }
}

public class DirectTransferRequest
{
    public int DepartmentID { get; set; }
    public int BatchID { get; set; }
    public int Quantity { get; set; }
    public string? DigitalSignature { get; set; }
}

public class RequisitionApprovalPayload
{
    public string? ApproverSignature { get; set; }
    public string? ApproverName { get; set; }
    public List<RequisitionDetailApprovalDto>? Details { get; set; }
    public string? DeliveryBy { get; set; }
    public string? DeliveryPhone { get; set; }
}

public class RequisitionRejectPayload
{
    public string? RejectReason { get; set; }
    public string? ApproverSignature { get; set; }
}

public class RequisitionReceivePayload
{
    public string? ReceiverSignature { get; set; }
    public string? ReceiverName { get; set; }
    public string? WitnessName { get; set; }
    public string? WitnessSignature { get; set; }
    public double? Temp { get; set; }
    public string? DeliveryConfirmStatus { get; set; } // 'Accept', 'PartialAccept', 'Reject'
    public List<RequisitionDetailReceiveDto>? Details { get; set; }
}

public class RequisitionDetailReceiveDto
{
    public int RequisitionDetailID { get; set; }
    public int ReceivedQuantity { get; set; }
    public string? RejectReason { get; set; }
}

