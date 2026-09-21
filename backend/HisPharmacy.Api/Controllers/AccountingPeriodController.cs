using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AccountingPeriodController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public AccountingPeriodController(HisDbContext context, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetPeriods()
    {
        var periods = await _context.AccountingPeriods
            .OrderByDescending(p => p.PeriodYear)
            .ThenByDescending(p => p.PeriodMonth)
            .ToListAsync();

        return Ok(periods);
    }

    [HttpGet("check-locked")]
    public async Task<IActionResult> CheckLocked([FromQuery] DateTime? date)
    {
        var targetDate = date ?? DateTime.Today;
        var period = await _context.AccountingPeriods
            .FirstOrDefaultAsync(p => p.PeriodMonth == targetDate.Month && p.PeriodYear == targetDate.Year);

        return Ok(new
        {
            TargetDate = targetDate,
            IsLocked = period?.IsLocked ?? false,
            Period = period
        });
    }

    public class LockPeriodRequest
    {
        public int Month { get; set; }
        public int Year { get; set; }
        public string? Notes { get; set; }
    }

    [HttpPost("lock")]
    public async Task<IActionResult> LockPeriod([FromBody] LockPeriodRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = "Ban Giám Đốc";

        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Ban Giám Đốc mới có thẩm quyền khóa sổ kỳ Dược." });

        if (request.Month < 1 || request.Month > 12 || request.Year < 2020 || request.Year > 2100)
            return BadRequest(new { Error = "Kỳ tháng/năm không hợp lệ." });

        var period = await _context.AccountingPeriods
            .FirstOrDefaultAsync(p => p.PeriodMonth == request.Month && p.PeriodYear == request.Year);

        if (period == null)
        {
            period = new AccountingPeriod
            {
                PeriodMonth = request.Month,
                PeriodYear = request.Year
            };
            _context.AccountingPeriods.Add(period);
        }
        else if (period.IsLocked)
        {
            return BadRequest(new { Error = $"Kỳ dược tháng {request.Month}/{request.Year} đã được khóa trước đó bởi {period.LockedBy} vào ngày {period.LockedAt:dd/MM/yyyy HH:mm}." });
        }

        // Snapshot current stock counts & monetary values
        var mainStockSum = await _context.InventoryStocks
            .Include(s => s.Batch)
            .Select(s => new { s.CurrentQuantity, Price = s.Batch != null ? s.Batch.ImportPrice : 0 })
            .ToListAsync();

        var deptStockSum = await _context.DepartmentStocks
            .Include(s => s.Batch)
            .Select(s => new { s.CurrentQuantity, Price = s.Batch != null ? s.Batch.ImportPrice : 0 })
            .ToListAsync();

        var totalQty = mainStockSum.Sum(s => s.CurrentQuantity) + deptStockSum.Sum(s => s.CurrentQuantity);
        var totalVal = mainStockSum.Sum(s => s.CurrentQuantity * s.Price) + deptStockSum.Sum(s => s.CurrentQuantity * s.Price);

        // Calculate Import receipts in this month
        var startDate = new DateTime(request.Year, request.Month, 1);
        var endDate = startDate.AddMonths(1);

        var importTotal = await _context.ImportReceiptDetails
            .Where(d => d.ImportReceipt != null && d.ImportReceipt.ImportDate >= startDate && d.ImportReceipt.ImportDate < endDate)
            .SumAsync(d => (decimal)d.Quantity * (d.ActualImportPrice ?? d.ContractPrice ?? 0));

        // Calculate Breakage loss in this month
        var lossTotal = await _context.BreakageReports
            .Where(b => b.ReportDate >= startDate && b.ReportDate < endDate && b.Status == "Approved")
            .SumAsync(b => b.TotalLossAmount);

        period.IsLocked = true;
        period.LockedAt = DateTime.Now;
        period.LockedBy = userFullName;
        period.Notes = request.Notes;
        period.ClosingStockCount = totalQty;
        period.ClosingStockValue = totalVal;
        period.TotalImportValue = importTotal;
        period.TotalLossValue = lossTotal;

        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "AccountingPeriod");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");

        return Ok(new
        {
            Message = $"Đã khóa sổ thành công kỳ Dược tháng {request.Month}/{request.Year}. Toàn bộ giao dịch trong kỳ đã được chốt và bảo vệ chống sửa đổi.",
            Period = period
        });
    }

    [HttpPost("unlock")]
    public async Task<IActionResult> UnlockPeriod([FromBody] LockPeriodRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = "Ban Giám Đốc";

        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Ban Giám Đốc mới có thẩm quyền mở khóa kỳ Dược đã chốt." });

        var period = await _context.AccountingPeriods
            .FirstOrDefaultAsync(p => p.PeriodMonth == request.Month && p.PeriodYear == request.Year);

        if (period == null || !period.IsLocked)
            return BadRequest(new { Error = $"Kỳ dược tháng {request.Month}/{request.Year} hiện không ở trạng thái khóa." });

        period.IsLocked = false;
        period.Notes = (period.Notes ?? "") + $" | Mở khóa bởi {userFullName} lúc {DateTime.Now:dd/MM/yyyy HH:mm}";

        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "AccountingPeriod");

        return Ok(new
        {
            Message = $"Đã mở khóa kỳ Dược tháng {request.Month}/{request.Year} theo lệnh của Ban Giám Đốc.",
            Period = period
        });
    }
}
