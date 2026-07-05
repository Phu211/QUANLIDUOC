using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LiquidationController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public LiquidationController(HisDbContext context, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetLiquidations()
    {
        var list = await _context.LiquidationReceipts
            .Include(l => l.Details)!.ThenInclude(d => d.Batch)!.ThenInclude(b => b!.Medicine)
            .OrderByDescending(l => l.LiquidationDate)
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("expired")]
    public async Task<IActionResult> GetExpiredItems()
    {
        var today = DateTime.Today;
        var limitDate = today.AddDays(30);

        var mainExpiredDb = await _context.InventoryStocks
            .Include(s => s.Batch)!.ThenInclude(b => b!.Medicine)
            .Where(s => (s.Batch!.ExpiryDate <= limitDate || s.Batch.Status == "Cách ly" || s.Batch.Status == "Chờ tiêu hủy") && s.CurrentQuantity > 0)
            .ToListAsync();

        var deptExpiredDb = await _context.DepartmentStocks
            .Include(s => s.Batch)!.ThenInclude(b => b!.Medicine)
            .Include(s => s.Department)
            .Where(s => (s.Batch!.ExpiryDate <= limitDate || s.Batch.Status == "Cách ly" || s.Batch.Status == "Chờ tiêu hủy") && s.CurrentQuantity > 0)
            .ToListAsync();

        var returnsList = await _context.ReturnReceipts
            .Include(r => r.Details)
            .ToListAsync();

        var recallsList = await _context.RecallLogs.ToListAsync();

        var returnLookup = new Dictionary<int, string>();
        foreach (var r in returnsList)
        {
            var code = $"PHT-{r.ReturnDate:yyyyMMdd}-{r.ReturnID.ToString().PadLeft(4, '0')}";
            foreach (var detail in r.Details)
            {
                returnLookup[detail.BatchID] = code;
            }
        }

        var recallLookup = new Dictionary<int, string>();
        foreach (var r in recallsList)
        {
            var code = $"QĐTH-{r.RecallDate:yyyyMMdd}-{r.RecallID.ToString().PadLeft(4, '0')}";
            recallLookup[r.BatchID] = code;
        }

        var mainExpired = mainExpiredDb.Select(s => new
        {
            s.BatchID,
            s.Batch!.BatchNumber,
            MedicineCode = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineCode : "",
            MedicineName = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineName : "",
            s.Batch.ExpiryDate,
            Location = "Kho chẵn chính",
            Quantity = s.CurrentQuantity,
            Status = s.Batch.Status,
            SourceCode = returnLookup.ContainsKey(s.BatchID) ? returnLookup[s.BatchID] : 
                         (recallLookup.ContainsKey(s.BatchID) ? recallLookup[s.BatchID] : null)
        }).ToList();

        var deptExpired = deptExpiredDb.Select(s => new
        {
            s.BatchID,
            s.Batch!.BatchNumber,
            MedicineCode = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineCode : "",
            MedicineName = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineName : "",
            s.Batch.ExpiryDate,
            Location = s.Department != null ? s.Department.DepartmentName : "Tủ trực khoa",
            Quantity = s.CurrentQuantity,
            Status = s.Batch.Status,
            SourceCode = returnLookup.ContainsKey(s.BatchID) ? returnLookup[s.BatchID] : 
                         (recallLookup.ContainsKey(s.BatchID) ? recallLookup[s.BatchID] : null)
        }).ToList();

        var quarantinedExpiredDb = await _context.QuarantineStocks
            .Include(q => q.Batch)!.ThenInclude(b => b!.Medicine)
            .Where(q => q.Status == "AwaitingDestroy" && q.Quantity > 0)
            .ToListAsync();

        var quarantinedExpired = quarantinedExpiredDb.Select(q => new
        {
            q.BatchID,
            BatchNumber = q.Batch?.BatchNumber ?? "",
            MedicineCode = q.Batch?.Medicine?.MedicineCode ?? "",
            MedicineName = q.Batch?.Medicine?.MedicineName ?? "",
            ExpiryDate = q.Batch?.ExpiryDate ?? DateTime.Now,
            Location = q.LocationType == "MainStore" ? "Kho chẵn chính (Hư hỏng)" : "Tủ trực khoa (Hư hỏng)",
            Quantity = q.Quantity,
            Status = "Chờ tiêu hủy",
            SourceCode = q.Reason
        }).ToList();

        var allExpired = mainExpired.Concat(deptExpired).Concat(quarantinedExpired).ToList();
        return Ok(allExpired);
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateLiquidation([FromBody] CreateLiquidationRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = "Cán bộ y tế";

        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Lãnh đạo mới có quyền lập yêu cầu." });

        if (request == null || !request.Items.Any())
            return BadRequest(new { Error = "Thông tin yêu cầu không hợp lệ." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var isDirector = userRole == "director";
            var receipt = new LiquidationReceipt
            {
                Reason = request.Reason,
                Type = request.Type,
                LiquidationDate = DateTime.Now,
                CreatedBy = request.CreatedBy ?? userFullName,
                Status = isDirector ? "Đã duyệt" : "Chờ duyệt",
                ProposerSignature = request.DigitalSignature,
                DigitalSignature = request.DigitalSignature,
                ApproverSignature = isDirector ? request.DigitalSignature : null
            };
            _context.LiquidationReceipts.Add(receipt);
            await _context.SaveChangesAsync();

            foreach (var item in request.Items)
            {
                receipt.Details.Add(new LiquidationReceiptDetail
                {
                    BatchID = item.BatchID,
                    Quantity = item.Quantity
                });
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            var result = await _context.LiquidationReceipts
                .Include(l => l.Details)!.ThenInclude(d => d.Batch)!.ThenInclude(b => b!.Medicine)
                .FirstOrDefaultAsync(l => l.LiquidationID == receipt.LiquidationID);

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Liquidations");

            return Ok(result);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveLiquidation(int id, [FromBody] ApproveLiquidationRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Trưởng khoa / Giám đốc mới có quyền duyệt đề xuất." });

        if (request == null || string.IsNullOrEmpty(request.ApproverSignature))
            return BadRequest(new { Error = "Vui lòng ký nhận để phê duyệt đề xuất." });

        var receipt = await _context.LiquidationReceipts.FindAsync(id);
        if (receipt == null)
            return NotFound(new { Error = "Không tìm thấy phiếu yêu cầu." });

        if (receipt.Status != "Chờ duyệt")
            return BadRequest(new { Error = "Phiếu này đã được xử lý từ trước." });

        receipt.Status = "Đã duyệt";
        receipt.ApproverSignature = request.ApproverSignature;
        receipt.DigitalSignature = request.ApproverSignature;

        await _context.SaveChangesAsync();

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Liquidations");

        return Ok(receipt);
    }

    [HttpPost("{id}/execute")]
    public async Task<IActionResult> ExecuteLiquidation(int id)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Lãnh đạo mới có quyền xác nhận tiêu hủy/thanh lý thực tế." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var receipt = await _context.LiquidationReceipts
                .Include(l => l.Details)
                .FirstOrDefaultAsync(l => l.LiquidationID == id);

            if (receipt == null)
                return NotFound(new { Error = "Không tìm thấy biên bản yêu cầu." });

            if (receipt.Status != "Đã duyệt")
                return BadRequest(new { Error = "Yêu cầu phải ở trạng thái Đã duyệt trước khi tiến hành xử lý thực tế." });

            // Transition status based on type
            receipt.Status = receipt.Type == "Thanh lý" ? "Đã thanh lý" : "Đã tiêu hủy";

            // Check if this was an automatically generated destruction from a cabinet return (where stock was already deducted)
            bool skipStockSubtraction = (receipt.Reason ?? "").Contains("tự động từ Phiếu hoàn trả");

            if (!skipStockSubtraction)
            {
                // Subtract stock for all items using robust cascading logic (Quarantine -> MainStore -> Departments)
                foreach (var detail in receipt.Details)
                {
                    int remainingToSubtract = detail.Quantity;

                    // 1. Subtract from QuarantineStocks first (for damaged items returned or recalled)
                    var quarStocks = await _context.QuarantineStocks
                        .Where(s => s.BatchID == detail.BatchID && s.Status == "AwaitingDestroy" && s.Quantity > 0)
                        .ToListAsync();

                    foreach (var qs in quarStocks)
                    {
                        if (remainingToSubtract <= 0) break;
                        int subtracted = Math.Min(qs.Quantity, remainingToSubtract);
                        qs.Quantity -= subtracted;
                        if (qs.Quantity == 0)
                        {
                            qs.Status = "Resolved";
                            qs.ResolvedAt = DateTime.Now;
                        }
                        remainingToSubtract -= subtracted;
                    }

                    // 2. Subtract from main store next
                    if (remainingToSubtract > 0)
                    {
                        var invStock = await _context.InventoryStocks.FirstOrDefaultAsync(s => s.BatchID == detail.BatchID);
                        if (invStock != null)
                        {
                            int subtracted = Math.Min(invStock.CurrentQuantity, remainingToSubtract);
                            invStock.CurrentQuantity -= subtracted;
                            remainingToSubtract -= subtracted;
                        }
                    }

                    // 3. Subtract from clinical departments if there's remaining quantity
                    if (remainingToSubtract > 0)
                    {
                        var deptStocks = await _context.DepartmentStocks
                            .Where(s => s.BatchID == detail.BatchID && s.CurrentQuantity > 0)
                            .ToListAsync();

                        foreach (var deptStock in deptStocks)
                        {
                            if (remainingToSubtract <= 0) break;
                            int subtracted = Math.Min(deptStock.CurrentQuantity, remainingToSubtract);
                            deptStock.CurrentQuantity -= subtracted;
                            remainingToSubtract -= subtracted;
                        }
                    }
                }
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Liquidations");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(receipt);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/reject")]
    public async Task<IActionResult> RejectLiquidation(int id)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Trưởng khoa / Giám đốc mới có quyền từ chối yêu cầu." });

        var receipt = await _context.LiquidationReceipts.FindAsync(id);
        if (receipt == null)
            return NotFound(new { Error = "Không tìm thấy phiếu yêu cầu." });

        if (receipt.Status != "Chờ duyệt")
            return BadRequest(new { Error = "Phiếu này đã được xử lý từ trước." });

        receipt.Status = "Từ chối";
        await _context.SaveChangesAsync();

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Liquidations");

        return Ok(receipt);
    }
}

public class CreateLiquidationRequest
{
    public string Reason { get; set; } = string.Empty;
    public string? CreatedBy { get; set; }
    public string Type { get; set; } = "Tiêu hủy"; // 'Thanh lý', 'Tiêu hủy'
    public List<LiquidationItemDto> Items { get; set; } = new();
    public string? DigitalSignature { get; set; }
}

public class LiquidationItemDto
{
    public int BatchID { get; set; }
    public string Location { get; set; } = string.Empty;
    public int Quantity { get; set; }
}

public class ApproveLiquidationRequest
{
    public string ApproverSignature { get; set; } = string.Empty;
}
