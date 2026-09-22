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
        if (userRole != "nurse" && userRole != "head" && userRole != "head_nurse" && userRole != "dispensary" && userRole != "pharmacist")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ, Điều dưỡng khoa hoặc Trưởng khoa mới có quyền thực hiện xuất tủ trực cấp phát cho bệnh nhân." });
        
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
            if (string.IsNullOrEmpty(userFullName))
                userFullName = (userRole == "dispensary" || userRole == "pharmacist") ? "Dược sĩ cấp phát" : "Điều dưỡng lâm sàng";

            var txs = await _cabinetService.ExportMultipleFromCabinetAsync(
                request.DepartmentID, 
                request.PatientCode, 
                request.PatientName, 
                items,
                userFullName
            );

            // Ghi nhật ký hoạt động tủ trực cho khoa
            _context.AuditLogs.Add(new AuditLog
            {
                DepartmentID = request.DepartmentID,
                Username = userFullName,
                UserRole = userRole,
                Action = "CABINET_EXPORT",
                EntityName = "DepartmentStocks",
                EntityID = request.DepartmentID,
                BeforeData = $"Bệnh nhân: {request.PatientName} ({request.PatientCode})",
                AfterData = $"Xuất {items.Count} loại thuốc tủ trực cho người bệnh",
                IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Device = "Web Browser (Clinical)",
                CreatedAt = DateTime.Now
            });
            await _context.SaveChangesAsync();

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

            // Ghi nhật ký đề xuất bù tủ trực cho khoa
            _context.AuditLogs.Add(new AuditLog
            {
                DepartmentID = departmentId,
                Username = userFullName,
                UserRole = userRole,
                Action = "REFILL_REQUISITION",
                EntityName = "MedicineRequisition",
                EntityID = req.RequisitionID,
                BeforeData = "Yêu cầu bù cơ số tủ trực",
                AfterData = $"Tạo phiếu lĩnh bù {req.Details.Count} mặt hàng gửi Kho Dược",
                IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Device = "Web Browser (Clinical)",
                CreatedAt = DateTime.Now
            });
            await _context.SaveChangesAsync();

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

    /// <summary>
    /// Tra cứu hồ sơ bệnh nhân theo Mã BA/BN để tự động điền Họ tên và danh sách thuốc theo Y lệnh
    /// </summary>
    [HttpGet("lookup-patient")]
    public async Task<IActionResult> LookupPatient([FromQuery] string? query = null, [FromQuery] int departmentId = 0)
    {
        var prescQuery = _context.OutpatientPrescriptions
            .Include(p => p.Details)
                .ThenInclude(d => d.Medicine)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query))
        {
            var q = query.Trim().ToLower();
            prescQuery = prescQuery.Where(p => p.PatientCode.ToLower().Contains(q) || p.PatientName.ToLower().Contains(q));
        }

        var patients = await prescQuery
            .OrderByDescending(p => p.PrescribedAt)
            .Take(15)
            .Select(p => new
            {
                p.PatientCode,
                p.PatientName,
                p.Diagnosis,
                p.DoctorName,
                Medicines = p.Details.Select(d => new
                {
                    d.MedicineID,
                    MedicineName = d.Medicine != null ? d.Medicine.MedicineName : "Thuốc",
                    Unit = d.Medicine != null ? d.Medicine.Unit : "Viên",
                    RequestedQuantity = d.RequestedQuantity > 0 ? d.RequestedQuantity : 1,
                    d.DosageInstructions
                }).ToList()
            })
            .ToListAsync();

        return Ok(patients);
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
