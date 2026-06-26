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
        if (req == null || req.DepartmentID <= 0 || !req.Details.Any())
            return BadRequest(new { Error = "Thông tin phiếu lĩnh không hợp lệ." });

        req.Status = "Pending";
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

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> Approve(int id, [FromBody] RequisitionApprovalPayload? payload)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược mới có quyền duyệt phiếu dự trù." });
        try
        {
            var signature = payload?.ApproverSignature;
            var details = payload?.Details;
            await _stockService.ApproveRequisitionAsync(id, signature, details);

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Requisitions");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = "Phê duyệt phiếu dự trù thành công theo nguyên tắc FEFO." });
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
        if (userRole != "pharmacist")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược mới có quyền từ chối phiếu dự trù." });

        try
        {
            var req = await _context.MedicineRequisitions.FindAsync(id);
            if (req == null) return NotFound();
            if (req.Status != "Pending") return BadRequest("Phiếu đã được xử lý.");

            // Require reason if this is a cabinet refill request
            if (req.RequisitionType == "CabinetRefill" && string.IsNullOrWhiteSpace(payload?.RejectReason))
            {
                return BadRequest(new { Error = "Vui lòng cung cấp lý do từ chối yêu cầu bù tủ trực của khoa." });
            }

            req.Status = "Rejected";
            req.RejectReason = payload?.RejectReason;
            req.ApproverSignature = payload?.ApproverSignature; // Save reject signature

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

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // 1. Check main store stock
            var invStock = await _context.InventoryStocks
                .Include(s => s.Batch)
                .FirstOrDefaultAsync(s => s.BatchID == request.BatchID);

            if (invStock == null || invStock.CurrentQuantity < request.Quantity)
                return BadRequest(new { Error = "Số lượng tồn kho chính không đủ để cấp phát." });

            // 2. Subtract from main store
            invStock.CurrentQuantity -= request.Quantity;

            // 3. Add to department cabinet stock
            var deptStock = await _context.DepartmentStocks
                .FirstOrDefaultAsync(ds => ds.DepartmentID == request.DepartmentID && ds.BatchID == request.BatchID);

            if (deptStock != null)
            {
                deptStock.CurrentQuantity += request.Quantity;
            }
            else
            {
                _context.DepartmentStocks.Add(new DepartmentStock
                {
                    DepartmentID = request.DepartmentID,
                    BatchID = request.BatchID,
                    CurrentQuantity = request.Quantity
                });
            }

            // 4. Record InternalTransfer log
            var transfer = new InternalTransfer
            {
                FromDepartmentID = null,
                ToDepartmentID = request.DepartmentID,
                TransferDate = DateTime.Now,
                DigitalSignature = request.DigitalSignature
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
    public List<RequisitionDetailApprovalDto>? Details { get; set; }
}

public class RequisitionRejectPayload
{
    public string? RejectReason { get; set; }
    public string? ApproverSignature { get; set; }
}

