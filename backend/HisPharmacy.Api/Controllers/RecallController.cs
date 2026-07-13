using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RecallController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public RecallController(HisDbContext context, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetRecalls()
    {
        var logs = await _context.RecallLogs
            .Include(r => r.Batch)!.ThenInclude(b => b!.Medicine)
            .OrderByDescending(r => r.RecallDate)
            .ToListAsync();
        return Ok(logs);
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateRecall([FromBody] CreateRecallRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = "Thủ kho Dược";

        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Lãnh đạo mới có quyền thu hồi thuốc." });

        if (request == null || request.BatchID <= 0 || string.IsNullOrEmpty(request.ActionType))
            return BadRequest(new { Error = "Thông tin thu hồi không hợp lệ." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var batch = await _context.Batches.FindAsync(request.BatchID);
            if (batch == null)
                return NotFound(new { Error = "Không tìm thấy lô thuốc này." });

            // Luôn đặt trạng thái lô thuốc thành "Cách ly" khẩn cấp để đảm bảo an toàn sử dụng toàn viện lập tức
            batch.Status = "Cách ly";

            // Nếu người tạo là Giám đốc (Director), phê duyệt trực tiếp luôn!
            var isDirector = userRole == "director";
            var status = isDirector ? "Approved" : "Pending";

            var log = new RecallLog
            {
                BatchID = request.BatchID,
                RecallDate = DateTime.Now,
                Reason = request.Reason,
                ActionType = request.ActionType,
                CreatedBy = userFullName,
                DigitalSignature = request.DigitalSignature,
                Status = status,
                ApprovedBy = isDirector ? userFullName : null,
                ApproverSignature = isDirector ? request.DigitalSignature : null
            };

            _context.RecallLogs.Add(log);
            await _context.SaveChangesAsync();

            // Nếu Lãnh đạo duyệt trực tiếp và hình thức là Trả NCC/Tiêu hủy, thực hiện
            if (isDirector)
            {
                if (request.ActionType == "Tiêu hủy")
                {
                    batch.Status = "Cách ly"; // Giữ trạng thái cách ly chờ tiêu hủy
                    
                    var totalInvQty = await _context.InventoryStocks.Where(s => s.BatchID == request.BatchID).SumAsync(s => s.CurrentQuantity);
                    var totalDeptQty = await _context.DepartmentStocks.Where(s => s.BatchID == request.BatchID).SumAsync(s => s.CurrentQuantity);
                    var totalQty = totalInvQty + totalDeptQty;

                    if (totalQty > 0)
                    {
                        var liquidation = new LiquidationReceipt
                        {
                            Reason = $"Tiêu hủy thuốc tự động từ Quyết định thu hồi #RCL-{log.RecallID}. Lý do: {request.Reason}",
                            Type = "Tiêu hủy",
                            LiquidationDate = DateTime.Now,
                            CreatedBy = "Dược sĩ Hà Lâm Đình Phú",
                            Status = "Chờ duyệt",
                            DigitalSignature = request.DigitalSignature
                        };
                        _context.LiquidationReceipts.Add(liquidation);
                        await _context.SaveChangesAsync();

                        _context.LiquidationReceiptDetails.Add(new LiquidationReceiptDetail
                        {
                            LiquidationID = liquidation.LiquidationID,
                            BatchID = request.BatchID,
                            Quantity = totalQty
                        });
                    }
                }
                else if (request.ActionType == "Trả NCC")
                {
                    batch.Status = "Trả NCC";
                    var invStocks = await _context.InventoryStocks.Where(s => s.BatchID == request.BatchID).ToListAsync();
                    foreach (var stock in invStocks) stock.CurrentQuantity = 0;

                    var deptStocks = await _context.DepartmentStocks.Where(s => s.BatchID == request.BatchID).ToListAsync();
                    foreach (var stock in deptStocks) stock.CurrentQuantity = 0;
                }
            }

            await transaction.CommitAsync();

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Recalls");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(log);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveRecall(int id, [FromBody] ApproveRecallRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = "Lãnh đạo bệnh viện";

        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Trưởng khoa / Giám đốc mới có quyền duyệt lệnh thu hồi." });

        if (request == null || string.IsNullOrEmpty(request.DigitalSignature))
            return BadRequest(new { Error = "Vui lòng ký nhận để phê duyệt lệnh thu hồi." });

        var log = await _context.RecallLogs.FindAsync(id);
        if (log == null) return NotFound();

        if (log.Status != "Pending")
            return BadRequest(new { Error = "Lệnh thu hồi này đã được xử lý từ trước." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var batch = await _context.Batches.FindAsync(log.BatchID);
            if (batch == null) return NotFound(new { Error = "Không tìm thấy lô thuốc liên quan." });

            log.Status = "Approved";
            log.ApprovedBy = string.IsNullOrEmpty(request.ApprovedBy) ? userFullName : request.ApprovedBy;
            log.ApproverSignature = request.DigitalSignature;

            // Thực thi hành động thu hồi chính thức
            if (log.ActionType == "Tiêu hủy")
            {
                batch.Status = "Cách ly"; // Giữ trạng thái cách ly chờ tiêu hủy

                var totalInvQty = await _context.InventoryStocks.Where(s => s.BatchID == log.BatchID).SumAsync(s => s.CurrentQuantity);
                var totalDeptQty = await _context.DepartmentStocks.Where(s => s.BatchID == log.BatchID).SumAsync(s => s.CurrentQuantity);
                var totalQty = totalInvQty + totalDeptQty;

                if (totalQty > 0)
                {
                    var liquidation = new LiquidationReceipt
                    {
                        Reason = $"Tiêu hủy thuốc tự động từ Quyết định thu hồi #RCL-{log.RecallID}. Lý do: {log.Reason}",
                        Type = "Tiêu hủy",
                        LiquidationDate = DateTime.Now,
                        CreatedBy = "Dược sĩ Hà Lâm Đình Phú",
                        Status = "Chờ duyệt",
                        DigitalSignature = request.DigitalSignature
                    };
                    _context.LiquidationReceipts.Add(liquidation);
                    await _context.SaveChangesAsync();

                    _context.LiquidationReceiptDetails.Add(new LiquidationReceiptDetail
                    {
                        LiquidationID = liquidation.LiquidationID,
                        BatchID = log.BatchID,
                        Quantity = totalQty
                    });
                }
            }
            else if (log.ActionType == "Trả NCC")
            {
                batch.Status = "Trả NCC";
                var invStocks = await _context.InventoryStocks.Where(s => s.BatchID == log.BatchID).ToListAsync();
                foreach (var stock in invStocks) stock.CurrentQuantity = 0;

                var deptStocks = await _context.DepartmentStocks.Where(s => s.BatchID == log.BatchID).ToListAsync();
                foreach (var stock in deptStocks) stock.CurrentQuantity = 0;
            }
            else
            {
                batch.Status = log.ActionType; // "Cách ly"
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Recalls");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(log);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> RejectRecall(int id)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Trưởng khoa / Giám đốc mới có quyền từ chối lệnh thu hồi." });

        var log = await _context.RecallLogs.FindAsync(id);
        if (log == null) return NotFound();

        if (log.Status != "Pending")
            return BadRequest(new { Error = "Lệnh thu hồi này đã được xử lý từ trước." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var batch = await _context.Batches.FindAsync(log.BatchID);
            if (batch != null)
            {
                batch.Status = "Bình thường"; // Restore normal status
            }

            log.Status = "Rejected";

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Recalls");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(log);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreRecall(int id)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = "Thủ kho Dược";

        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Lãnh đạo mới có quyền khôi phục trạng thái lô thuốc." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var log = await _context.RecallLogs.FindAsync(id);
            if (log == null)
                return NotFound(new { Error = "Không tìm thấy biên bản thu hồi." });

            var batch = await _context.Batches.FindAsync(log.BatchID);
            if (batch == null)
                return NotFound(new { Error = "Không tìm thấy lô thuốc liên quan." });

            batch.Status = "Bình thường";

            // Record a restoration log or just update status
            _context.RecallLogs.Remove(log); // We delete the log to clear isolation.
            
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Recalls");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = "Đã khôi phục trạng thái lô thuốc thành Bình thường." });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("return-dept")]
    public async Task<IActionResult> ReturnRecallFromDepartment([FromBody] ReturnRecallRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "nurse" && userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var deptStock = await _context.DepartmentStocks
                .FirstOrDefaultAsync(s => s.DepartmentID == request.DepartmentID && s.BatchID == request.BatchID);

            if (deptStock == null || deptStock.CurrentQuantity == 0)
                return BadRequest(new { Error = "Không có tồn kho của lô thuốc này tại khoa để hoàn trả." });

            int qtyToReturn = deptStock.CurrentQuantity;
            deptStock.CurrentQuantity = 0;

            // Add back to main store inventory stocks
            var mainStock = await _context.InventoryStocks
                .FirstOrDefaultAsync(s => s.BatchID == request.BatchID);
            if (mainStock != null)
            {
                mainStock.CurrentQuantity += qtyToReturn;
            }
            else
            {
                _context.InventoryStocks.Add(new InventoryStock
                {
                    BatchID = request.BatchID,
                    CurrentQuantity = qtyToReturn
                });
            }

            // Log this action
            var log = new RecallLog
            {
                BatchID = request.BatchID,
                RecallDate = DateTime.Now,
                Reason = $"Hoàn trả khẩn cấp lô thuốc bị thu hồi/cách ly từ Khoa/Phòng (Số lượng: {qtyToReturn}).",
                ActionType = "Cách ly",
                CreatedBy = "Điều dưỡng lâm sàng"
            };
            _context.RecallLogs.Add(log);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            // Broadcast updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Recalls");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = $"Đã hoàn trả {qtyToReturn} thuốc về kho cách ly trung tâm thành công." });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpGet("batch/{batchId}/patients")]
    public async Task<IActionResult> GetPatientsByBatch(int batchId)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userDeptIdStr = Request.Headers["X-User-DepartmentID"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());

        if (string.IsNullOrEmpty(userRole))
        {
            return BadRequest(new { Error = "Quyền truy cập bị từ chối." });
        }

        if (userRole == "admin")
        {
            return Unauthorized(new { Error = "Nhân viên hành chính không có quyền truy cập thông tin truy vết lô thuốc." });
        }

        try
        {
            var query = _context.CabinetTransactions
                .Include(ct => ct.Department)
                .Where(ct => ct.BatchID == batchId && ct.PatientCode != null && ct.PatientCode != "");

            if (userRole == "head" || userRole == "head_nurse" || userRole == "nurse")
            {
                if (int.TryParse(userDeptIdStr, out var deptId))
                {
                    query = query.Where(ct => ct.DepartmentID == deptId);
                }
                else
                {
                    return BadRequest(new { Error = "Thiếu thông tin khoa phòng của người dùng." });
                }

                if (userRole == "nurse")
                {
                    query = query.Where(ct => ct.DispensedBy == userFullName);
                }
            }

            var patients = await query
                .OrderByDescending(ct => ct.TransactionDate)
                .Select(ct => new {
                    PatientCode = ct.PatientCode,
                    PatientName = ct.PatientName,
                    DepartmentName = ct.Department != null ? ct.Department.DepartmentName : "N/A",
                    Quantity = ct.Quantity,
                    TransactionDate = ct.TransactionDate.ToString("dd/MM/yyyy HH:mm"),
                    DispensedBy = ct.DispensedBy ?? "N/A"
                })
                .ToListAsync();

            var batch = await _context.Batches
                .Include(b => b.Medicine)
                .FirstOrDefaultAsync(b => b.BatchID == batchId);

            if (batch == null)
            {
                return NotFound(new { Error = "Không tìm thấy thông tin lô thuốc." });
            }

            int quantityOriginal = batch.QuantityOriginal;

            var invStock = await _context.InventoryStocks
                .FirstOrDefaultAsync(s => s.BatchID == batchId);
            int quantityMainStore = invStock?.CurrentQuantity ?? 0;

            var transfersQty = await _context.InternalTransferDetails
                .Where(d => d.BatchID == batchId)
                .SumAsync(d => d.Quantity);

            return Ok(new {
                BatchNumber = batch.BatchNumber,
                MedicineName = batch.Medicine?.MedicineName ?? "N/A",
                Unit = batch.Medicine?.Unit ?? "N/A",
                QuantityOriginal = quantityOriginal,
                QuantityMainStore = quantityMainStore,
                QuantityDepartment = transfersQty,
                Patients = patients
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpGet("trace/search")]
    public async Task<IActionResult> SearchTrace([FromQuery] string type, [FromQuery] string query)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "pharmacist_admin" && userRole != "director")
        {
            return Unauthorized(new { Error = "Chỉ Dược sĩ hoặc Ban Giám đốc mới có quyền tìm kiếm truy vết toàn viện." });
        }

        if (string.IsNullOrWhiteSpace(query))
        {
            return Ok(new List<object>());
        }

        try
        {
            query = query.Trim().ToLower();

            if (type == "batch")
            {
                var batches = await _context.Batches
                    .Include(b => b.Medicine)
                    .Where(b => b.BatchNumber.ToLower().Contains(query))
                    .Select(b => new {
                        b.BatchID,
                        b.BatchNumber,
                        MedicineName = b.Medicine != null ? b.Medicine.MedicineName : "N/A",
                        Unit = b.Medicine != null ? b.Medicine.Unit : "viên"
                    })
                    .ToListAsync();
                return Ok(batches);
            }
            else if (type == "patient")
            {
                var batchIds = await _context.CabinetTransactions
                    .Where(ct => (ct.PatientCode != null && ct.PatientCode.ToLower().Contains(query)) || 
                                 (ct.PatientName != null && ct.PatientName.ToLower().Contains(query)))
                    .Select(ct => ct.BatchID)
                    .Distinct()
                    .ToListAsync();

                var batches = await _context.Batches
                    .Include(b => b.Medicine)
                    .Where(b => batchIds.Contains(b.BatchID))
                    .Select(b => new {
                        b.BatchID,
                        b.BatchNumber,
                        MedicineName = b.Medicine != null ? b.Medicine.MedicineName : "N/A",
                        Unit = b.Medicine != null ? b.Medicine.Unit : "viên"
                    })
                    .ToListAsync();
                return Ok(batches);
            }
            else if (type == "medicine")
            {
                var batches = await _context.Batches
                    .Include(b => b.Medicine)
                    .Where(b => b.Medicine != null && (b.Medicine.MedicineName.ToLower().Contains(query) || (b.Medicine.GenericName != null && b.Medicine.GenericName.ToLower().Contains(query))))
                    .Select(b => new {
                        b.BatchID,
                        b.BatchNumber,
                        MedicineName = b.Medicine != null ? b.Medicine.MedicineName : "N/A",
                        Unit = b.Medicine != null ? b.Medicine.Unit : "viên"
                    })
                    .ToListAsync();
                return Ok(batches);
            }

            return BadRequest(new { Error = "Loại tìm kiếm không hợp lệ." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }
}

public class CreateRecallRequest
{
    public int BatchID { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string ActionType { get; set; } = "Cách ly"; // 'Cách ly', 'Trả NCC', 'Tiêu hủy'
    public string? DigitalSignature { get; set; }
}

public class ApproveRecallRequest
{
    public string ApprovedBy { get; set; } = string.Empty;
    public string DigitalSignature { get; set; } = string.Empty;
}

public class ReturnRecallRequest
{
    public int DepartmentID { get; set; }
    public int BatchID { get; set; }
}
