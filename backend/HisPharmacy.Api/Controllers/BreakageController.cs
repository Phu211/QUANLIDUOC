using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using HisPharmacy.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class BreakageController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public BreakageController(HisDbContext context, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetReports([FromQuery] int? departmentId)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userDeptStr = Request.Headers["X-User-DepartmentID"].ToString();

        var query = _context.BreakageReports
            .Include(r => r.Department)
            .Include(r => r.Details)
                .ThenInclude(d => d.Batch)
                    .ThenInclude(b => b!.Medicine)
            .AsQueryable();

        if (userRole != "pharmacist" && userRole != "director")
        {
            if (int.TryParse(userDeptStr, out int userDeptId) && userDeptId > 0)
            {
                query = query.Where(r => r.DepartmentID == userDeptId);
            }
        }
        else if (departmentId.HasValue && departmentId.Value > 0)
        {
            query = query.Where(r => r.DepartmentID == departmentId.Value);
        }

        var list = await query
            .OrderByDescending(r => r.ReportDate)
            .ToListAsync();

        var result = list.Select(r =>
        {
            var canonical = DocumentSecurityHelper.BuildCanonicalString(r);
            var isIntegrityValid = !string.IsNullOrEmpty(r.DocumentHash) &&
                                  DocumentSecurityHelper.VerifyIntegrity(r.DocumentHash, canonical);
            return new
            {
                r.ReportID,
                r.ReportCode,
                r.DepartmentID,
                r.Department,
                r.ReportDate,
                r.ReportedBy,
                r.Reason,
                r.DamageImage,
                r.DigitalSignature,
                r.ApproverSignature,
                r.ApproverName,
                r.ApprovedAt,
                r.Status,
                r.TotalLossAmount,
                r.Notes,
                r.DocumentHash,
                IsIntegrityValid = isIntegrityValid,
                Details = r.Details.Select(d => new
                {
                    d.DetailID,
                    d.ReportID,
                    d.BatchID,
                    d.MedicineID,
                    d.DamagedQuantity,
                    d.UnitPrice,
                    d.TotalLossAmount,
                    d.Notes,
                    d.Batch
                })
            };
        });

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetReport(int id)
    {
        var report = await _context.BreakageReports
            .Include(r => r.Department)
            .Include(r => r.Details)
                .ThenInclude(d => d.Batch)
                    .ThenInclude(b => b!.Medicine)
            .FirstOrDefaultAsync(r => r.ReportID == id);

        if (report == null)
            return NotFound(new { Error = "Không tìm thấy biên bản vỡ hỏng / hư hao." });

        var canonical = DocumentSecurityHelper.BuildCanonicalString(report);
        var isIntegrityValid = !string.IsNullOrEmpty(report.DocumentHash) &&
                              DocumentSecurityHelper.VerifyIntegrity(report.DocumentHash, canonical);

        return Ok(new
        {
            report.ReportID,
            report.ReportCode,
            report.DepartmentID,
            report.Department,
            report.ReportDate,
            report.ReportedBy,
            report.Reason,
            report.DamageImage,
            report.DigitalSignature,
            report.ApproverSignature,
            report.ApproverName,
            report.ApprovedAt,
            report.Status,
            report.TotalLossAmount,
            report.Notes,
            report.DocumentHash,
            IsIntegrityValid = isIntegrityValid,
            report.Details
        });
    }

    public class CreateBreakageItem
    {
        public int BatchID { get; set; }
        public int DamagedQuantity { get; set; }
        public string? Notes { get; set; }
    }

    public class CreateBreakageRequest
    {
        public int DepartmentID { get; set; }
        public string Reason { get; set; } = string.Empty; // 'Rơi vỡ', 'Thuốc kết tủa', 'Quá nhiệt', 'Hỏng do bảo quản', 'Khác'
        public string? DamageImage { get; set; } // Base64 picture or image url
        public string? DigitalSignature { get; set; } // Reporter canvas signature
        public string? Notes { get; set; }
        public List<CreateBreakageItem> Items { get; set; } = new();
    }

    [HttpPost]
    public async Task<IActionResult> CreateReport([FromBody] CreateBreakageRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = "Điều dưỡng viên";

        if (request == null || request.DepartmentID <= 0 || request.Items == null || !request.Items.Any())
            return BadRequest(new { Error = "Dữ liệu biên bản hư hao/đổ vỡ không hợp lệ." });

        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(new { Error = "Lý do hư hao / vỡ hỏng không được để trống." });

        // Ensure current month is not locked
        await AccountingPeriodHelper.EnsurePeriodNotLockedAsync(_context, DateTime.Today);

        // Generate Code: BBHH-YYYYMMDD-XXXX
        var dateStr = DateTime.Today.ToString("yyyyMMdd");
        var prefix = $"BBHH-{dateStr}-";
        var maxCode = await _context.BreakageReports
            .Where(r => r.ReportCode.StartsWith(prefix))
            .OrderByDescending(r => r.ReportCode)
            .Select(r => r.ReportCode)
            .FirstOrDefaultAsync();

        int nextNum = 1;
        if (maxCode != null && maxCode.Length > prefix.Length)
        {
            var suffix = maxCode.Substring(prefix.Length);
            if (int.TryParse(suffix, out int parsedNum)) nextNum = parsedNum + 1;
        }

        var reportCode = $"{prefix}{nextNum.ToString().PadLeft(4, '0')}";

        var report = new BreakageReport
        {
            ReportCode = reportCode,
            DepartmentID = request.DepartmentID,
            ReportDate = DateTime.Now,
            ReportedBy = userFullName,
            Reason = request.Reason,
            DamageImage = request.DamageImage,
            DigitalSignature = request.DigitalSignature,
            Status = "Pending",
            Notes = request.Notes
        };

        decimal totalLoss = 0;

        foreach (var item in request.Items)
        {
            if (item.DamagedQuantity <= 0) continue;

            var batch = await _context.Batches.FindAsync(item.BatchID);
            if (batch == null) continue;

            var unitPrice = batch.ImportPrice;
            var lineTotal = item.DamagedQuantity * unitPrice;
            totalLoss += lineTotal;

            report.Details.Add(new BreakageReportDetail
            {
                BatchID = item.BatchID,
                MedicineID = batch.MedicineID,
                DamagedQuantity = item.DamagedQuantity,
                UnitPrice = unitPrice,
                TotalLossAmount = lineTotal,
                Notes = item.Notes
            });
        }

        report.TotalLossAmount = totalLoss;

        _context.BreakageReports.Add(report);

        _context.AuditLogs.Add(new AuditLog
        {
            DepartmentID = report.DepartmentID,
            Username = userFullName,
            UserRole = userRole,
            Action = "CREATE_BREAKAGE",
            EntityName = "BreakageReports",
            EntityID = report.ReportID,
            BeforeData = null,
            AfterData = $"Lập biên bản vỡ hỏng {report.ReportCode}, Lý do: {report.Reason}, Thiệt hại: {report.TotalLossAmount:N0} đ",
            IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            Device = "Web Browser (Clinical)",
            CreatedAt = DateTime.Now
        });

        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Breakage");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinet");

        return Ok(new
        {
            Message = $"Đã lập thành công biên bản hư hao/đổ vỡ [{report.ReportCode}]. Chờ Điều dưỡng trưởng / Bác sĩ ký duyệt trừ tồn.",
            Report = report
        });
    }

    public class ApproveBreakageRequest
    {
        public string? ApproverSignature { get; set; }
        public string? ApproverName { get; set; }
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveReport(int id, [FromBody] ApproveBreakageRequest payload)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = payload?.ApproverName ?? "Người duyệt";

        if (userRole != "head_nurse" && userRole != "head" && userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Điều dưỡng trưởng, Trưởng khoa, Dược sĩ hoặc Giám đốc mới có quyền duyệt biên bản này." });

        if (payload == null || string.IsNullOrWhiteSpace(payload.ApproverSignature))
            return BadRequest(new { Error = "Chữ ký số của cấp phê duyệt không được để trống." });

        var report = await _context.BreakageReports
            .Include(r => r.Details)
            .FirstOrDefaultAsync(r => r.ReportID == id);

        if (report == null)
            return NotFound(new { Error = "Không tìm thấy biên bản hư hao." });

        if (report.Status == "Approved")
            return BadRequest(new { Error = "Biên bản này đã được phê duyệt trước đó." });

        // Ensure target month is not locked
        await AccountingPeriodHelper.EnsurePeriodNotLockedAsync(_context, report.ReportDate);

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            report.ApproverSignature = payload.ApproverSignature;
            report.ApproverName = userFullName;
            report.ApprovedAt = DateTime.Now;
            report.Status = "Approved";

            // Automatically deduct cabinet stocks and record CabinetTransaction
            foreach (var detail in report.Details)
            {
                var deptStock = await _context.DepartmentStocks
                    .FirstOrDefaultAsync(s => s.DepartmentID == report.DepartmentID && s.BatchID == detail.BatchID);

                if (deptStock != null)
                {
                    deptStock.CurrentQuantity = Math.Max(0, deptStock.CurrentQuantity - detail.DamagedQuantity);
                }

                // Record transaction
                _context.CabinetTransactions.Add(new CabinetTransaction
                {
                    DepartmentID = report.DepartmentID,
                    BatchID = detail.BatchID,
                    PatientCode = $"BBHH-{report.ReportCode}",
                    PatientName = $"Hao hụt/Hư hao: {report.Reason}",
                    Quantity = detail.DamagedQuantity,
                    TransactionDate = DateTime.Now,
                    DispensedBy = userFullName,
                    IsRefilled = true // Counted as handled loss, not routine replenish
                });
            }

            // Compute Canonical Hash for Document Integrity
            var canonical = DocumentSecurityHelper.BuildCanonicalString(report);
            report.DocumentHash = DocumentSecurityHelper.ComputeSha256(canonical);

            _context.AuditLogs.Add(new AuditLog
            {
                DepartmentID = report.DepartmentID,
                Username = userFullName,
                UserRole = userRole,
                Action = "APPROVE_BREAKAGE",
                EntityName = "BreakageReports",
                EntityID = report.ReportID,
                BeforeData = "Trạng thái: Pending",
                AfterData = $"Duyệt biên bản {report.ReportCode}, Trừ tồn tủ trực khoa, Người duyệt: {userFullName}",
                IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Device = "Web Browser (Clinical)",
                CreatedAt = DateTime.Now
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Breakage");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinet");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");

            return Ok(new
            {
                Message = $"Đã duyệt thành công biên bản {report.ReportCode}. Tồn kho tủ trực đã được trừ hao hụt và ký số mã hóa bảo vệ toàn vẹn.",
                Report = report
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }
}
