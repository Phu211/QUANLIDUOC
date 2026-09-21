using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class PatientPortalController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public PatientPortalController(HisDbContext context, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Tra cứu thông tin đơn thuốc công khai dành cho bệnh nhân qua mã QR hoặc mã đơn thuốc
    /// </summary>
    [HttpGet("prescription/{code}")]
    public async Task<IActionResult> GetPrescriptionForPatient(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return BadRequest(new { message = "Vui lòng cung cấp mã đơn thuốc hợp lệ." });
        }

        var cleanCode = code.Trim().ToUpper();

        int parsedId = 0;
        bool isId = int.TryParse(cleanCode, out parsedId);

        var prescription = await _context.OutpatientPrescriptions
            .Include(p => p.Department)
            .Include(p => p.Details)
                .ThenInclude(d => d.Medicine)
            .Include(p => p.Details)
                .ThenInclude(d => d.AllocatedBatch)
            .FirstOrDefaultAsync(p => 
                p.PrescriptionCode.ToUpper() == cleanCode || 
                p.Barcode == cleanCode ||
                (isId && p.PrescriptionID == parsedId));

        if (prescription == null)
        {
            return NotFound(new { message = "Không tìm thấy đơn thuốc trên hệ thống bệnh viện." });
        }

        // Tạo dữ liệu phong phú, thân thiện với người bệnh
        var medicineCards = prescription.Details.Select(d =>
        {
            var med = d.Medicine;
            var medName = med?.MedicineName ?? "Thuốc điều trị";
            var genericName = med?.GenericName ?? "";
            
            // Nhận diện dạng viên và màu sắc giả lập trực quan
            var pillInfo = InferPillVisualInfo(medName, genericName, med?.Unit ?? "Viên");

            return new
            {
                d.PrescriptionDetailID,
                d.MedicineID,
                MedicineName = medName,
                GenericName = genericName,
                Specification = med?.Specification ?? "",
                Unit = med?.Unit ?? "Viên",
                Quantity = d.DispensedQuantity > 0 ? d.DispensedQuantity : d.RequestedQuantity,
                BatchNumber = d.AllocatedBatch?.BatchNumber ?? "Lô chuẩn GPP",
                ExpiryDate = d.AllocatedBatch?.ExpiryDate.ToString("MM/yyyy") ?? "Còn hạn dài",
                // Hướng dẫn uống chi tiết
                d.DosageInstructions,
                d.MorningDose,
                d.NoonDose,
                d.AfternoonDose,
                d.NightDose,
                UsageTime = string.IsNullOrWhiteSpace(d.UsageTime) ? "Sau bữa ăn 30 phút" : d.UsageTime,
                // Thông tin nhận diện viên thuốc
                PillShape = pillInfo.Shape,
                PillColor = pillInfo.Color,
                PillCategory = pillInfo.Category,
                PillIcon = pillInfo.Icon,
                PillWarning = pillInfo.SpecialWarning
            };
        }).ToList();

        // Che mờ 1 phần tên bệnh nhân nếu là trang công khai để bảo mật thông tin y tế,
        // ví dụ "Nguyễn Văn An" -> "Nguyễn V** An" (vẫn dễ nhận biết cho chính bệnh nhân)
        var maskedPatientName = MaskName(prescription.PatientName);

        var result = new
        {
            prescription.PrescriptionID,
            prescription.PrescriptionCode,
            prescription.Barcode,
            PatientName = maskedPatientName,
            FullPatientName = prescription.PatientName,
            prescription.PatientCode,
            prescription.BirthYear,
            prescription.Gender,
            prescription.Diagnosis,
            prescription.DoctorName,
            DepartmentName = prescription.Department?.DepartmentName ?? "Khoa Khám Bệnh - Quầy Dược Ngoại Trú",
            PrescribedAt = prescription.PrescribedAt.ToString("dd/MM/yyyy HH:mm"),
            DispensedAt = prescription.DispensedAt?.ToString("dd/MM/yyyy HH:mm"),
            prescription.DispensedBy,
            prescription.Status,
            prescription.TotalAmount,
            prescription.PatientCoPayAmount,
            Medicines = medicineCards,
            // Khuyến cáo tương tác & chế độ dinh dưỡng từ Dược sĩ lâm sàng
            ClinicalWarnings = new[]
            {
                new {
                    title = "Tránh uống cùng Trà đậm & Cà phê",
                    detail = "Chất Tanin trong nước chè hoặc Caffein có thể tạo tủa làm mất tác dụng kháng sinh và cản trở hấp thu vi chất.",
                    icon = "tea"
                },
                new {
                    title = "Tránh Sữa & Nước bưởi chùm (Grapefruit)",
                    detail = "Canxi trong sữa gây khó hấp thu một số thuốc; tinh chất bưởi chùm ức chế enzym gan CYP3A4 làm tăng nồng độ thuốc trong máu.",
                    icon = "milk"
                },
                new {
                    title = "Tuyệt đối không uống rượu, bia",
                    detail = "Rượu bia làm tăng nguy cơ tổn thương gan, loét dạ dày hoặc gây phản ứng sốc tụt huyết áp bất thường.",
                    icon = "beer"
                },
                new {
                    title = "Uống nhiều nước lọc (1.5 - 2 lít/ngày)",
                    detail = "Giúp bảo vệ thận, hòa tan thuốc hoàn toàn và đào thải độc tố tốt hơn.",
                    icon = "water"
                },
                new {
                    title = "Bảo quản thuốc đúng cách",
                    detail = "Để thuốc nơi khô ráo, nhiệt độ dưới 30°C, tránh ánh sáng trực tiếp và để xa tầm với của trẻ nhỏ.",
                    icon = "shield"
                }
            },
            EmergencyHotline = new
            {
                HospitalName = "Bệnh Viện Đa Khoa Quốc Tế HIS",
                PharmacyPhone = "(028) 3822 5588",
                EmergencyPhone = "115 / (028) 3822 9999",
                Address = "Số 123 Đường Y Dược, Quận 5, TP. Hồ Chí Minh"
            }
        };

        return Ok(result);
    }

    /// <summary>
    /// Tiếp nhận phản ánh phản ứng bất thường / tác dụng phụ (ADR Form) gửi trực tiếp từ bệnh nhân
    /// </summary>
    [HttpPost("adr-report")]
    public async Task<IActionResult> SubmitAdrReport([FromBody] AdrReportRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PrescriptionCode) || string.IsNullOrWhiteSpace(request.Symptoms))
        {
            return BadRequest(new { message = "Vui lòng nhập mã đơn thuốc và mô tả triệu chứng bất thường." });
        }

        var prescription = await _context.OutpatientPrescriptions
            .FirstOrDefaultAsync(p => p.PrescriptionCode == request.PrescriptionCode || p.Barcode == request.PrescriptionCode);

        var report = new PatientAdrReport
        {
            PrescriptionID = prescription?.PrescriptionID,
            PrescriptionCode = request.PrescriptionCode.Trim().ToUpper(),
            PatientName = string.IsNullOrWhiteSpace(request.PatientName) ? (prescription?.PatientName ?? "Bệnh nhân") : request.PatientName.Trim(),
            PatientPhone = request.PatientPhone?.Trim(),
            SuspectedMedicineName = string.IsNullOrWhiteSpace(request.SuspectedMedicineName) ? "Chưa xác định / Cả đơn" : request.SuspectedMedicineName.Trim(),
            Symptoms = request.Symptoms.Trim(),
            Severity = string.IsNullOrWhiteSpace(request.Severity) ? "Nhẹ" : request.Severity.Trim(),
            OnsetDelay = request.OnsetDelay,
            Description = request.Description,
            ReportedAt = DateTime.Now,
            Status = "New"
        };

        _context.PatientAdrReports.Add(report);
        await _context.SaveChangesAsync();

        // Gửi thông báo SignalR thời gian thực đến toàn bộ nhân viên Quầy Dược & Bác sĩ đang trực
        try
        {
            await _hubContext.Clients.All.SendAsync("ReceiveAdrNotification", new
            {
                reportID = report.ReportID,
                prescriptionCode = report.PrescriptionCode,
                patientName = report.PatientName,
                patientPhone = report.PatientPhone,
                medicine = report.SuspectedMedicineName,
                severity = report.Severity,
                symptoms = report.Symptoms,
                reportedAt = report.ReportedAt.ToString("HH:mm:ss dd/MM/yyyy")
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine("Warning sending SignalR ADR notice: " + ex.Message);
        }

        return Ok(new
        {
            success = true,
            reportID = report.ReportID,
            message = "Báo cáo của bạn đã được chuyển thẳng tới Dược sĩ lâm sàng bệnh viện. Dược sĩ sẽ liên hệ hỗ trợ bạn sớm nhất!"
        });
    }

    /// <summary>
    /// Danh sách báo cáo ADR bệnh nhân gửi về để Dược sĩ theo dõi & xử lý
    /// </summary>
    [HttpGet("adr-reports")]
    public async Task<IActionResult> GetAdrReports([FromQuery] string? status = null, [FromQuery] int limit = 50)
    {
        var query = _context.PatientAdrReports.AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            query = query.Where(r => r.Status == status);
        }

        var list = await query
            .OrderByDescending(r => r.ReportedAt)
            .Take(limit)
            .ToListAsync();

        return Ok(list);
    }

    /// <summary>
    /// Cập nhật kết quả tư vấn / xử lý ADR của Dược sĩ
    /// </summary>
    [HttpPut("adr-reports/{id}/status")]
    public async Task<IActionResult> UpdateAdrStatus(int id, [FromBody] UpdateAdrStatusRequest request)
    {
        var report = await _context.PatientAdrReports.FindAsync(id);
        if (report == null)
        {
            return NotFound(new { message = "Không tìm thấy báo cáo ADR." });
        }

        report.Status = request.Status ?? report.Status;
        report.PharmacistNotes = request.PharmacistNotes ?? report.PharmacistNotes;
        report.ReviewedBy = request.ReviewedBy ?? "Dược sĩ Lâm Sàng";
        report.ReviewedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return Ok(new { success = true, report });
    }

    // --- Helper Methods ---
    private static string MaskName(string fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName)) return "Bệnh nhân";
        var parts = fullName.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length <= 1) return fullName;
        
        for (int i = 1; i < parts.Length - 1; i++)
        {
            parts[i] = parts[i].Substring(0, 1) + "***";
        }
        return string.Join(" ", parts);
    }

    private static (string Shape, string Color, string Category, string Icon, string SpecialWarning) InferPillVisualInfo(string name, string generic, string unit)
    {
        var lower = (name + " " + generic).ToLower();

        if (lower.Contains("amoxicillin") || lower.Contains("augmentin") || lower.Contains("cephalexin"))
        {
            return ("Viên nang con nhộng (Capsule)", "Đỏ - Vàng", "Kháng sinh trị nhiễm trùng", "capsule", "Uống đủ liều 5-7 ngày, không tự ý ngừng thuốc");
        }
        if (lower.Contains("paracetamol") || lower.Contains("panadol") || lower.Contains("efferalgan"))
        {
            return ("Viên nén dài bao phim (Caplet)", "Trắng ngà", "Hạ sốt, giảm đau thông thường", "pill", "Không dùng quá 4g/ngày để tránh độc cho gan");
        }
        if (lower.Contains("omeprazol") || lower.Contains("esomeprazol") || lower.Contains("pantoprazol"))
        {
            return ("Viên nang bao tan trong ruột", "Tím - Hồng", "Giảm tiết acid & bảo vệ dạ dày", "capsule", "Nên uống trước bữa ăn sáng 30 - 60 phút");
        }
        if (lower.Contains("berberin"))
        {
            return ("Viên nén tròn nhỏ", "Vàng nghệ", "Kháng khuẩn đường ruột, trị tiêu chảy", "pill", "Không dùng cho phụ nữ có thai");
        }
        if (lower.Contains("alphachymotrypsin") || lower.Contains("chymo"))
        {
            return ("Viên nén tròn dẹp", "Trắng sữa", "Chống phù nề, chống viêm sau chấn thương", "pill", "Có thể ngậm dưới lưỡi hoặc uống nhiều nước");
        }
        if (lower.Contains("loratadin") || lower.Contains("cetirizin") || lower.Contains("fexofenadin"))
        {
            return ("Viên nén bao phim nhỏ", "Trắng tinh", "Chống dị ứng, giảm ngứa, nghẹt mũi", "pill", "Thuốc có thể gây cảm giác hơi buồn ngủ nhẹ");
        }
        if (unit.ToLower().Contains("gói") || lower.Contains("gói") || lower.Contains("bột") || lower.Contains("cốm"))
        {
            return ("Gói bột pha hỗn dịch uống", "Gói nhôm màu xanh", "Bột hòa tan uống", "sachet", "Hòa tan hoàn toàn trong 50 - 100ml nước ấm trước khi uống");
        }
        if (unit.ToLower().Contains("ống") || unit.ToLower().Contains("chai") || unit.ToLower().Contains("lọ") || lower.Contains("siro"))
        {
            return ("Hỗn dịch / Siro lỏng", "Chai siro hổ phách", "Dung dịch uống", "bottle", "Lắc đều chai trước khi uống, đo đúng vạch định mức");
        }

        return ("Viên nén bao phim tròn", "Trắng tiêu chuẩn", "Thuốc điều trị theo toa", "pill", "Uống đúng theo liều lượng bác sĩ đã chỉ định");
    }
}

public class AdrReportRequest
{
    public string PrescriptionCode { get; set; } = string.Empty;
    public string? PatientName { get; set; }
    public string? PatientPhone { get; set; }
    public string? SuspectedMedicineName { get; set; }
    public string Symptoms { get; set; } = string.Empty;
    public string? Severity { get; set; } = "Nhẹ";
    public string? OnsetDelay { get; set; }
    public string? Description { get; set; }
}

public class UpdateAdrStatusRequest
{
    public string? Status { get; set; }
    public string? PharmacistNotes { get; set; }
    public string? ReviewedBy { get; set; }
}
