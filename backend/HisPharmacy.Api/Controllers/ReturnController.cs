using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using HisPharmacy.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReturnController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly StockService _stockService;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public ReturnController(HisDbContext context, StockService stockService, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _stockService = stockService;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetReturns()
    {
        var returns = await _context.ReturnReceipts
            .Include(r => r.Department)
            .Include(r => r.Details)!.ThenInclude(d => d.Batch)!.ThenInclude(b => b!.Medicine)
            .OrderByDescending(r => r.ReturnDate)
            .ToListAsync();
        return Ok(returns);
    }

    [HttpPost("submit")]
    public async Task<IActionResult> SubmitReturn([FromBody] ReturnReceipt ret)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "nurse")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Điều dưỡng khoa mới có quyền tạo phiếu hoàn trả thuốc." });

        if (ret == null || ret.DepartmentID <= 0 || ret.Details == null || !ret.Details.Any())
            return BadRequest(new { Error = "Thông tin phiếu hoàn trả không hợp lệ." });

        if (string.IsNullOrWhiteSpace(ret.ReturnReason))
            return BadRequest(new { Error = "Vui lòng nhập hoặc chọn lý do hoàn trả thuốc thừa." });

        // Validate duplicate batches in details
        var batchIds = ret.Details.Select(d => d.BatchID).ToList();
        if (batchIds.Count != batchIds.Distinct().Count())
        {
            return BadRequest(new { Error = "Không được chọn trùng lặp một lô thuốc trên cùng một phiếu đề xuất hoàn trả." });
        }

        // Validate quantities and stock limits
        foreach (var detail in ret.Details)
        {
            if (detail.Quantity <= 0)
            {
                return BadRequest(new { Error = "Số lượng hoàn trả phải là số nguyên dương lớn hơn 0." });
            }

            // Retrieve the cabinet stock for this department and batch
            var deptStock = await _context.DepartmentStocks
                .Include(ds => ds.Batch)
                .ThenInclude(b => b!.Medicine)
                .FirstOrDefaultAsync(ds => ds.DepartmentID == ret.DepartmentID && ds.BatchID == detail.BatchID);

            if (deptStock == null)
            {
                return BadRequest(new { Error = $"Lô thuốc (ID: {detail.BatchID}) không tồn tại hoặc đã hết trong tủ trực của khoa phòng." });
            }

            if (deptStock.CurrentQuantity < detail.Quantity)
            {
                var medName = deptStock.Batch?.Medicine?.MedicineName ?? $"Lô {deptStock.Batch?.BatchNumber}";
                return BadRequest(new { Error = $"Số lượng hoàn trả của thuốc {medName} (Đề nghị: {detail.Quantity}) vượt quá tồn kho thực tế trong tủ trực khoa (Hiện có: {deptStock.CurrentQuantity})." });
            }
        }

        ret.Status = "Pending";
        ret.ReturnDate = DateTime.Now;

        _context.ReturnReceipts.Add(ret);
        await _context.SaveChangesAsync();

        var result = await _context.ReturnReceipts
            .Include(r => r.Department)
            .Include(r => r.Details)!.ThenInclude(d => d.Batch)!.ThenInclude(b => b!.Medicine)
            .FirstOrDefaultAsync(r => r.ReturnID == ret.ReturnID);

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Returns");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

        return Ok(result);
    }

    public class ApproveReturnRequest
    {
        public string? DigitalSignature { get; set; }
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveReturn(int id, [FromBody] ApproveReturnRequest? request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược mới có quyền duyệt nhận phiếu hoàn trả." });

        try
        {
            await _stockService.PharmacistApproveReturnAsync(id, request?.DigitalSignature);

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Returns");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = "Thủ kho tiếp nhận thuốc hoàn trả thành công. Đang chờ Trưởng khoa ký duyệt hành chính." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/leader-approve")]
    public async Task<IActionResult> LeaderApproveReturn(int id, [FromBody] ApproveReturnRequest? request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Trưởng Khoa / Lãnh đạo mới có quyền ký duyệt tối cao phiếu hoàn trả." });

        try
        {
            await _stockService.LeaderApproveReturnAsync(id, request?.DigitalSignature);

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Returns");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = "Lãnh đạo đã phê duyệt hành chính và ký đóng dấu đỏ thành công phiếu hoàn trả." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    public class ReturnRejectPayload
    {
        public string? RejectReason { get; set; }
        public string? DigitalSignature { get; set; }
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> RejectReturn(int id, [FromBody] ReturnRejectPayload? payload)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho hoặc Lãnh đạo mới có quyền từ chối phiếu hoàn trả." });

        var ret = await _context.ReturnReceipts.FindAsync(id);
        if (ret == null) return NotFound();
        if (ret.Status != "Pending" && ret.Status != "PendingLeader") 
            return BadRequest(new { Error = "Phiếu hoàn trả đã được xử lý trước đó và không thể từ chối." });

        if (string.IsNullOrWhiteSpace(payload?.RejectReason))
            return BadRequest(new { Error = "Vui lòng cung cấp lý do từ chối cụ thể." });

        if (string.IsNullOrWhiteSpace(payload?.DigitalSignature))
            return BadRequest(new { Error = "Vui lòng ký xác nhận trước khi thực hiện từ chối." });

        // If it was already accepted by the pharmacist (PendingLeader) but rejected by the director,
        // we revert the stock back to the department cabinet.
        if (ret.Status == "PendingLeader")
        {
            if (userRole != "director")
                return BadRequest(new { Error = "Quyền từ chối bị từ chối. Chỉ Lãnh đạo mới có quyền từ chối ở bước này." });

            // Revert stock changes: subtract from main store and add back to department stock
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Reload details
                await _context.Entry(ret).Collection(r => r.Details).LoadAsync();
                foreach (var detail in ret.Details)
                {
                    // Subtract from main store InventoryStocks
                    var invStock = await _context.InventoryStocks.FirstOrDefaultAsync(s => s.BatchID == detail.BatchID);
                    if (invStock != null)
                    {
                        invStock.CurrentQuantity = Math.Max(0, invStock.CurrentQuantity - detail.Quantity);
                    }

                    // Add back to department stock
                    var deptStock = await _context.DepartmentStocks.FirstOrDefaultAsync(ds => ds.DepartmentID == ret.DepartmentID && ds.BatchID == detail.BatchID);
                    if (deptStock != null)
                    {
                        deptStock.CurrentQuantity += detail.Quantity;
                    }
                    else
                    {
                        _context.DepartmentStocks.Add(new DepartmentStock
                        {
                            DepartmentID = ret.DepartmentID,
                            BatchID = detail.BatchID,
                            CurrentQuantity = detail.Quantity
                        });
                    }
                }

                ret.Status = "Rejected";
                ret.RejectReason = payload.RejectReason;
                ret.DirectorSignature = payload.DigitalSignature; // Save leader reject signature
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { Error = "Lỗi khi hoàn trả lại kho trực: " + ex.Message });
            }
        }
        else
        {
            ret.Status = "Rejected";
            ret.RejectReason = payload.RejectReason;
            ret.ApproverSignature = payload.DigitalSignature; // Save pharmacist reject signature
            await _context.SaveChangesAsync();
        }

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Returns");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

        return Ok(new { Message = "Đã từ chối phiếu hoàn trả thuốc thừa và lưu trữ chữ ký từ chối." });
    }
}
