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
        // Fetch batches that are expired and still have stock in either main store or department stock
        var mainExpired = await _context.InventoryStocks
            .Include(s => s.Batch)!.ThenInclude(b => b!.Medicine)
            .Where(s => s.Batch!.ExpiryDate <= today && s.CurrentQuantity > 0)
            .Select(s => new
            {
                s.BatchID,
                s.Batch!.BatchNumber,
                MedicineCode = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineCode : "",
                MedicineName = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineName : "",
                s.Batch.ExpiryDate,
                Location = "Kho chẵn chính",
                Quantity = s.CurrentQuantity
            })
            .ToListAsync();

        var deptExpired = await _context.DepartmentStocks
            .Include(s => s.Batch)!.ThenInclude(b => b!.Medicine)
            .Include(s => s.Department)
            .Where(s => s.Batch!.ExpiryDate <= today && s.CurrentQuantity > 0)
            .Select(s => new
            {
                s.BatchID,
                s.Batch!.BatchNumber,
                MedicineCode = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineCode : "",
                MedicineName = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineName : "",
                s.Batch.ExpiryDate,
                Location = s.Department != null ? s.Department.DepartmentName : "Tủ trực khoa",
                Quantity = s.CurrentQuantity
            })
            .ToListAsync();

        var allExpired = mainExpired.Concat(deptExpired).ToList();
        return Ok(allExpired);
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateLiquidation([FromBody] CreateLiquidationRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Trưởng khoa / Giám đốc mới có quyền lập phiếu thanh lý." });

        if (request == null || !request.Items.Any())
            return BadRequest(new { Error = "Thông tin thanh lý không hợp lệ." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var receipt = new LiquidationReceipt
            {
                Reason = request.Reason,
                LiquidationDate = DateTime.Now,
                DigitalSignature = request.DigitalSignature
            };
            _context.LiquidationReceipts.Add(receipt);

            foreach (var item in request.Items)
            {
                // Subtract stock based on where it is located
                if (item.Location == "Kho chẵn chính")
                {
                    var stock = await _context.InventoryStocks
                        .FirstOrDefaultAsync(s => s.BatchID == item.BatchID);
                    if (stock != null)
                    {
                        int subtract = Math.Min(stock.CurrentQuantity, item.Quantity);
                        stock.CurrentQuantity -= subtract;
                    }
                }
                else
                {
                    // Department cabinet stock
                    var dept = await _context.Departments
                        .FirstOrDefaultAsync(d => d.DepartmentName == item.Location);
                    
                    if (dept != null)
                    {
                        var stock = await _context.DepartmentStocks
                            .FirstOrDefaultAsync(s => s.DepartmentID == dept.DepartmentID && s.BatchID == item.BatchID);
                        if (stock != null)
                        {
                            int subtract = Math.Min(stock.CurrentQuantity, item.Quantity);
                            stock.CurrentQuantity -= subtract;
                        }
                    }
                }

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
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(result);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }
}

public class CreateLiquidationRequest
{
    public string Reason { get; set; } = string.Empty;
    public List<LiquidationItemDto> Items { get; set; } = new();
    public string? DigitalSignature { get; set; }
}

public class LiquidationItemDto
{
    public int BatchID { get; set; }
    public string Location { get; set; } = string.Empty;
    public int Quantity { get; set; }
}
