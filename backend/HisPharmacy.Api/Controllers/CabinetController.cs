using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using HisPharmacy.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CabinetController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly CabinetService _cabinetService;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public CabinetController(HisDbContext context, CabinetService cabinetService, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _cabinetService = cabinetService;
        _hubContext = hubContext;
    }

    [HttpGet("stocks/{departmentId}")]
    public async Task<IActionResult> GetCabinetStocks(int departmentId)
    {
        var stocks = await _context.DepartmentStocks
            .Include(ds => ds.Batch)!.ThenInclude(b => b!.Medicine)
            .Where(ds => ds.DepartmentID == departmentId && ds.CurrentQuantity > 0)
            .OrderBy(ds => ds.Batch!.ExpiryDate)
            .ToListAsync();
        return Ok(stocks);
    }

    [HttpGet("transactions/{departmentId}")]
    public async Task<IActionResult> GetCabinetTransactions(int departmentId)
    {
        var txs = await _context.CabinetTransactions
            .Include(t => t.Batch)!.ThenInclude(b => b!.Medicine)
            .Include(t => t.Requisition)
            .Where(t => t.DepartmentID == departmentId)
            .OrderByDescending(t => t.TransactionDate)
            .ToListAsync();
        return Ok(txs);
    }

    [HttpPost("export")]
    public async Task<IActionResult> ExportFromCabinet([FromBody] CabinetExportRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "nurse" && userRole != "head" && userRole != "head_nurse")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Điều dưỡng khoa hoặc Trưởng khoa mới có quyền thực hiện xuất tủ trực cấp phát cho bệnh nhân." });
        
        if (request == null)
            return BadRequest(new { Error = "Thông tin xuất tủ trực không hợp lệ." });

        var items = new List<CabinetExportItem>();
        if (request.Items != null && request.Items.Any())
        {
            items.AddRange(request.Items);
        }
        else if (request.BatchID.HasValue && request.Quantity.HasValue)
        {
            items.Add(new CabinetExportItem { BatchID = request.BatchID.Value, Quantity = request.Quantity.Value });
        }

        if (!items.Any() || items.Any(i => i.Quantity <= 0))
            return BadRequest(new { Error = "Số lượng xuất phải lớn hơn 0." });

        try
        {
            // Check lock Cabinet
            var isCabinetLocked = await _context.InventoryAudits.AnyAsync(a => a.LocationType == "Cabinet" && a.DepartmentID == request.DepartmentID && (a.Status == "Nháp" || a.Status == "Chờ xác nhận" || a.Status == "Có chênh lệch"));
            if (isCabinetLocked)
                return BadRequest(new { Error = "Tủ trực của khoa đang tiến hành kiểm kê và bị khóa mọi giao dịch xuất tủ." });

            var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
            if (string.IsNullOrEmpty(userFullName)) userFullName = "Điều dưỡng lâm sàng";

            var txs = await _cabinetService.ExportMultipleFromCabinetAsync(
                request.DepartmentID, 
                request.PatientCode, 
                request.PatientName, 
                items,
                userFullName
            );

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(txs);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("refill/{departmentId}")]
    public async Task<IActionResult> RequestRefill(int departmentId, [FromBody] RefillRequestPayload? payload)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = userRole == "head" ? "Trưởng khoa lâm sàng" : "Điều dưỡng trưởng khoa";

        if (userRole != "head_nurse" && userRole != "head")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Điều dưỡng trưởng khoa hoặc Trưởng khoa mới có quyền ký đề nghị bù tủ trực." });
        try
        {
            var signature = payload?.DigitalSignature;
            var selectedMeds = payload?.SelectedMedicineIds;
            var req = await _cabinetService.CreateRefillRequisitionAsync(departmentId, signature, selectedMeds, userRole, userFullName);
            if (req == null)
            {
                return BadRequest(new { Message = "Không có phiếu xuất tủ trực nào phù hợp chưa được bù để tổng hợp." });
            }

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Requisitions");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = "Đã tổng hợp phiếu bù tủ trực thành công.", RequisitionID = req.RequisitionID });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }
}

public class CabinetExportRequest
{
    public int DepartmentID { get; set; }
    public int? BatchID { get; set; }
    public string PatientCode { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public int? Quantity { get; set; }
    public List<CabinetExportItem> Items { get; set; } = new();
}

public class RefillRequestPayload
{
    public string? DigitalSignature { get; set; }
    public List<int>? SelectedMedicineIds { get; set; }
}
