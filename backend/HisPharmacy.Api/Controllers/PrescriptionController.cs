using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class PrescriptionController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public PrescriptionController(HisDbContext context, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Lấy danh sách các đơn thuốc ngoại trú đang chờ cấp phát (Pending)
    /// </summary>
    [HttpGet("pending")]
    public async Task<IActionResult> GetPendingPrescriptions([FromQuery] int departmentId = 1)
    {
        var pendingPrescriptions = await _context.OutpatientPrescriptions
            .Include(p => p.Department)
            .Include(p => p.Details)
                .ThenInclude(d => d.Medicine)
            .Include(p => p.Details)
                .ThenInclude(d => d.AllocatedBatch)
            .Where(p => p.Status == "Pending" && (departmentId == 0 || p.DepartmentID == departmentId))
            .OrderByDescending(p => p.PrescribedAt)
            .ToListAsync();

        return Ok(pendingPrescriptions);
    }

    /// <summary>
    /// Tìm kiếm đơn thuốc theo Mã đơn, Barcode quét được, Mã bệnh nhân, Họ tên hoặc Số thẻ BHYT
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> SearchPrescription([FromQuery] string query, [FromQuery] int departmentId = 1)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return await GetPendingPrescriptions(departmentId);
        }

        var cleanQuery = query.Trim().ToLower();

        var matches = await _context.OutpatientPrescriptions
            .Include(p => p.Department)
            .Include(p => p.Details)
                .ThenInclude(d => d.Medicine)
            .Include(p => p.Details)
                .ThenInclude(d => d.AllocatedBatch)
            .Where(p => 
                (departmentId == 0 || p.DepartmentID == departmentId) &&
                (p.PrescriptionCode.ToLower().Contains(cleanQuery) ||
                p.Barcode.ToLower().Contains(cleanQuery) ||
                p.PatientCode.ToLower().Contains(cleanQuery) ||
                p.PatientName.ToLower().Contains(cleanQuery) ||
                (p.InsuranceCardNumber != null && p.InsuranceCardNumber.ToLower().Contains(cleanQuery))))
            .OrderByDescending(p => p.PrescribedAt)
            .Take(25)
            .ToListAsync();

        return Ok(matches);
    }

    /// <summary>
    /// Lấy chi tiết một đơn thuốc kèm thuật toán FEFO tự động ghép lô thuốc từ Kho lẻ (DepartmentStock)
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPrescriptionWithFefo(int id)
    {
        var prescription = await _context.OutpatientPrescriptions
            .Include(p => p.Department)
            .Include(p => p.Details)
                .ThenInclude(d => d.Medicine)
            .Include(p => p.Details)
                .ThenInclude(d => d.AllocatedBatch)
            .FirstOrDefaultAsync(p => p.PrescriptionID == id);

        if (prescription == null)
        {
            return NotFound(new { message = "Không tìm thấy đơn thuốc yêu cầu." });
        }

        // Lấy tất cả tồn kho lẻ tại quầy/khoa này
        var deptStockItems = await _context.DepartmentStocks
            .Include(ds => ds.Batch)
            .Where(ds => ds.DepartmentID == prescription.DepartmentID && 
                         ds.CurrentQuantity > 0 &&
                         ds.Batch != null && 
                         ds.Batch.Status != "Tiêu hủy")
            .ToListAsync();

        var detailsWithFefo = new List<object>();

        foreach (var detail in prescription.Details)
        {
            var medId = detail.MedicineID;

            // Tìm các lô thuốc của Medicine này tại Kho lẻ, sắp xếp theo FEFO (ExpiryDate ASC)
            var availableBatches = deptStockItems
                .Where(ds => ds.Batch!.MedicineID == medId && ds.CurrentQuantity > 0)
                .OrderBy(ds => ds.Batch!.ExpiryDate)
                .Select(ds => new
                {
                    ds.BatchID,
                    ds.Batch!.BatchNumber,
                    ExpiryDate = ds.Batch.ExpiryDate.ToString("yyyy-MM-dd"),
                    DaysToExpiry = (ds.Batch.ExpiryDate.Date - DateTime.Today).Days,
                    ds.CurrentQuantity,
                    ds.Batch.ImportPrice,
                    IsExpired = ds.Batch.ExpiryDate.Date < DateTime.Today
                })
                .ToList();

            // Áp dụng FEFO: Chọn lô hết hạn sớm nhất nhưng chưa hết hạn và còn đủ/nhiều tồn
            var validBatches = availableBatches.Where(b => !b.IsExpired).ToList();
            var fefoCandidate = validBatches.FirstOrDefault(b => b.CurrentQuantity >= detail.RequestedQuantity) 
                                ?? validBatches.FirstOrDefault();

            // Nếu đã từng cấp phát thì dùng AllocatedBatchID, nếu chưa thì dùng FEFO candidate
            int? autoBatchId = detail.AllocatedBatchID ?? fefoCandidate?.BatchID;
            string? autoBatchNumber = detail.AllocatedBatch?.BatchNumber ?? fefoCandidate?.BatchNumber;
            string? autoBatchExpiry = detail.AllocatedBatch?.ExpiryDate.ToString("yyyy-MM-dd") ?? fefoCandidate?.ExpiryDate;
            int totalAvailableStock = availableBatches.Sum(b => b.CurrentQuantity);

            string fefoStatus;
            if (totalAvailableStock == 0)
            {
                fefoStatus = "Hết hàng tại quầy";
            }
            else if (fefoCandidate != null && fefoCandidate.CurrentQuantity >= detail.RequestedQuantity)
            {
                fefoStatus = "Đủ tồn FEFO (Lô sớm nhất)";
            }
            else
            {
                fefoStatus = $"Tồn lô sớm nhất ({fefoCandidate?.CurrentQuantity ?? 0}) < Yêu cầu ({detail.RequestedQuantity})";
            }

            detailsWithFefo.Add(new
            {
                detail.PrescriptionDetailID,
                detail.PrescriptionID,
                detail.MedicineID,
                MedicineName = detail.Medicine?.MedicineName ?? "N/A",
                GenericName = detail.Medicine?.GenericName ?? "N/A",
                Unit = detail.Medicine?.Unit ?? "Viên",
                detail.RequestedQuantity,
                detail.DispensedQuantity,
                detail.DosageInstructions,
                detail.MorningDose,
                detail.NoonDose,
                detail.AfternoonDose,
                detail.NightDose,
                detail.UsageTime,
                detail.UnitPrice,
                detail.Amount,
                // FEFO resolution
                AllocatedBatchID = autoBatchId,
                AllocatedBatchNumber = autoBatchNumber,
                AllocatedBatchExpiry = autoBatchExpiry,
                TotalAvailableInDispensary = totalAvailableStock,
                FefoStatus = fefoStatus,
                AvailableBatches = availableBatches
            });
        }

        return Ok(new
        {
            prescription.PrescriptionID,
            prescription.PrescriptionCode,
            prescription.Barcode,
            prescription.PatientCode,
            prescription.PatientName,
            prescription.BirthYear,
            prescription.Gender,
            prescription.Address,
            prescription.InsuranceCardNumber,
            prescription.InsuranceRate,
            prescription.Diagnosis,
            prescription.DoctorName,
            prescription.DepartmentID,
            DepartmentName = prescription.Department?.DepartmentName ?? "Khoa Khám Bệnh / Quầy Dược",
            PrescribedAt = prescription.PrescribedAt.ToString("yyyy-MM-dd HH:mm"),
            prescription.Status,
            DispensedAt = prescription.DispensedAt?.ToString("yyyy-MM-dd HH:mm"),
            prescription.DispensedBy,
            prescription.TotalAmount,
            prescription.InsuranceCoverageAmount,
            prescription.PatientCoPayAmount,
            prescription.Notes,
            prescription.DigitalSignature,
            prescription.DispenserSignature,
            prescription.DoctorSignature,
            prescription.PatientSignature,
            Details = detailsWithFefo
        });
    }

    /// <summary>
    /// Xuất kho 1-click: Tự động trừ tồn kho lẻ theo lô FEFO, ghi nhận giao dịch và in phiếu thu
    /// </summary>
    [HttpPost("{id}/dispense")]
    public async Task<IActionResult> DispensePrescription(int id, [FromBody] DispenseRequest request)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var prescription = await _context.OutpatientPrescriptions
                .Include(p => p.Details)
                    .ThenInclude(d => d.Medicine)
                .FirstOrDefaultAsync(p => p.PrescriptionID == id);

            if (prescription == null)
            {
                return NotFound(new { message = "Không tìm thấy đơn thuốc." });
            }

            if (prescription.Status == "Dispensed")
            {
                return BadRequest(new { message = "Đơn thuốc này đã được cấp phát hoàn tất trước đó." });
            }

            if (prescription.Status == "Cancelled")
            {
                return BadRequest(new { message = "Đơn thuốc này đã bị hủy bỏ, không thể cấp phát." });
            }

            var dispensedBy = string.IsNullOrWhiteSpace(request.DispensedBy) ? "DS. Quầy Ngoại Trú" : request.DispensedBy.Trim();
            var dispenseTime = DateTime.Now;

            // Xử lý từng thuốc trong đơn
            foreach (var detail in prescription.Details)
            {
                int targetBatchId;

                // Kiểm tra xem Dược sĩ có chỉ định lô thủ công không
                var manualAllocation = request.Allocations?.FirstOrDefault(a => a.PrescriptionDetailID == detail.PrescriptionDetailID);
                if (manualAllocation != null && manualAllocation.BatchID > 0)
                {
                    targetBatchId = manualAllocation.BatchID;
                }
                else
                {
                    // Tự động áp dụng FEFO từ DepartmentStock
                    var bestBatch = await _context.DepartmentStocks
                        .Include(ds => ds.Batch)
                        .Where(ds => ds.DepartmentID == prescription.DepartmentID &&
                                     ds.Batch != null &&
                                     ds.Batch.MedicineID == detail.MedicineID &&
                                     ds.CurrentQuantity >= detail.RequestedQuantity &&
                                     ds.Batch.ExpiryDate >= DateTime.Today &&
                                     ds.Batch.Status != "Tiêu hủy")
                        .OrderBy(ds => ds.Batch!.ExpiryDate)
                        .FirstOrDefaultAsync();

                    if (bestBatch == null)
                    {
                        // Thử tìm bất kỳ lô nào còn tồn (dù ít hơn hoặc sắp hết)
                        bestBatch = await _context.DepartmentStocks
                            .Include(ds => ds.Batch)
                            .Where(ds => ds.DepartmentID == prescription.DepartmentID &&
                                         ds.Batch != null &&
                                         ds.Batch.MedicineID == detail.MedicineID &&
                                         ds.CurrentQuantity > 0 &&
                                         ds.Batch.Status != "Tiêu hủy")
                            .OrderBy(ds => ds.Batch!.ExpiryDate)
                            .FirstOrDefaultAsync();
                    }

                    if (bestBatch == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = $"Không tìm thấy lô thuốc khả dụng tại Quầy Dược cho thuốc: {detail.Medicine?.MedicineName ?? detail.MedicineID.ToString()}" });
                    }

                    targetBatchId = bestBatch.BatchID;
                }

                // Kiểm tra tồn kho lẻ tại Quầy Dược
                var deptStock = await _context.DepartmentStocks
                    .FirstOrDefaultAsync(ds => ds.DepartmentID == prescription.DepartmentID && ds.BatchID == targetBatchId);

                if (deptStock == null || deptStock.CurrentQuantity < detail.RequestedQuantity)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { 
                        message = $"Không đủ tồn kho lẻ cho thuốc {detail.Medicine?.MedicineName}. Tồn hiện có: {deptStock?.CurrentQuantity ?? 0}, Yêu cầu: {detail.RequestedQuantity}" 
                    });
                }

                int beforeQty = deptStock.CurrentQuantity;
                deptStock.CurrentQuantity -= detail.RequestedQuantity;
                int afterQty = deptStock.CurrentQuantity;

                // Cập nhật chi tiết đơn thuốc
                detail.DispensedQuantity = detail.RequestedQuantity;
                detail.AllocatedBatchID = targetBatchId;

                // Ghi nhận CabinetTransaction
                _context.CabinetTransactions.Add(new CabinetTransaction
                {
                    DepartmentID = prescription.DepartmentID,
                    BatchID = targetBatchId,
                    PatientCode = prescription.PatientCode,
                    PatientName = prescription.PatientName,
                    Quantity = detail.RequestedQuantity,
                    TransactionDate = dispenseTime,
                    DispensedBy = dispensedBy,
                    IsRefilled = false
                });

                // Ghi nhận InventoryMovement
                _context.InventoryMovements.Add(new InventoryMovement
                {
                    MedicineID = detail.MedicineID,
                    BatchID = targetBatchId,
                    LocationType = "Cabinet",
                    DepartmentID = prescription.DepartmentID,
                    BeforeQuantity = beforeQty,
                    ChangeQuantity = detail.RequestedQuantity,
                    AfterQuantity = afterQty,
                    SourceType = "OutpatientDispense",
                    SourceID = prescription.PrescriptionID,
                    Action = "SUBTRACT",
                    ByUser = dispensedBy,
                    CreatedAt = dispenseTime
                });
            }

            // Cập nhật thông tin đơn thuốc sang Dispensed
            prescription.Status = "Dispensed";
            prescription.DispensedAt = dispenseTime;
            prescription.DispensedBy = dispensedBy;
            if (!string.IsNullOrWhiteSpace(request.DispenserSignature))
            {
                prescription.DispenserSignature = request.DispenserSignature;
                prescription.DigitalSignature = request.DispenserSignature;
            }
            else
            {
                prescription.DigitalSignature = $"HMAC-SHA256:{Guid.NewGuid():N}";
            }
            if (!string.IsNullOrWhiteSpace(request.PatientSignature))
            {
                prescription.PatientSignature = request.PatientSignature;
            }

            if (!string.IsNullOrWhiteSpace(request.Notes))
            {
                prescription.Notes = string.IsNullOrWhiteSpace(prescription.Notes) 
                    ? request.Notes 
                    : $"{prescription.Notes} | {request.Notes}";
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            // Phát sự kiện SignalR tới toàn bộ client
            try
            {
                await _hubContext.Clients.All.SendAsync("PrescriptionDispensed", new
                {
                    prescriptionId = prescription.PrescriptionID,
                    prescriptionCode = prescription.PrescriptionCode,
                    patientName = prescription.PatientName,
                    dispensedAt = dispenseTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    dispensedBy = dispensedBy
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SignalR Warning] {ex.Message}");
            }

            return Ok(new
            {
                success = true,
                message = $"Đã cấp phát thành công đơn thuốc {prescription.PrescriptionCode} cho bệnh nhân {prescription.PatientName}.",
                prescriptionId = prescription.PrescriptionID,
                prescriptionCode = prescription.PrescriptionCode,
                dispensedAt = dispenseTime.ToString("yyyy-MM-dd HH:mm:ss"),
                dispensedBy = dispensedBy,
                digitalSignature = prescription.DigitalSignature
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return StatusCode(500, new { message = $"Lỗi trong quá trình cấp phát: {ex.Message}" });
        }
    }

    /// <summary>
    /// Lấy lịch sử cấp phát thuốc ngoại trú đã hoàn tất (Dispensed)
    /// </summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetDispensingHistory([FromQuery] int departmentId = 0, [FromQuery] int take = 30)
    {
        var history = await _context.OutpatientPrescriptions
            .Include(p => p.Department)
            .Include(p => p.Details)
                .ThenInclude(d => d.Medicine)
            .Include(p => p.Details)
                .ThenInclude(d => d.AllocatedBatch)
            .Where(p => p.Status == "Dispensed" && (departmentId == 0 || p.DepartmentID == departmentId))
            .OrderByDescending(p => p.DispensedAt)
            .Take(take)
            .ToListAsync();

        return Ok(history);
    }

    /// <summary>
    /// Tạo đơn thuốc ngoại trú mới từ phòng khám lâm sàng
    /// </summary>
    [HttpPost("create")]
    public async Task<IActionResult> CreatePrescription([FromBody] CreatePrescriptionRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.PatientName) || req.Details == null || !req.Details.Any())
        {
            return BadRequest(new { message = "Vui lòng cung cấp đầy đủ họ tên bệnh nhân và danh mục thuốc." });
        }

        var prescriptionCount = await _context.OutpatientPrescriptions.CountAsync();
        var dateStr = DateTime.Now.ToString("yyyyMMdd");
        var prescriptionCode = $"DT-{dateStr}-{(prescriptionCount + 1):D4}";
        var barcode = $"893{dateStr.Substring(2)}{(prescriptionCount + 1):D4}";

        decimal totalAmount = 0;
        var prescriptionDetails = new List<OutpatientPrescriptionDetail>();

        foreach (var item in req.Details)
        {
            var med = await _context.Medicines.FindAsync(item.MedicineID);
            if (med == null) continue;

            // Tìm giá thuốc từ lô có sẵn hoặc mặc định
            var sampleBatch = await _context.Batches
                .Where(b => b.MedicineID == item.MedicineID)
                .OrderByDescending(b => b.BatchID)
                .FirstOrDefaultAsync();

            decimal unitPrice = item.UnitPrice > 0 
                ? item.UnitPrice 
                : (sampleBatch != null ? sampleBatch.ImportPrice * 1.15m : 5000); // 15% retail markup

            decimal amount = unitPrice * item.RequestedQuantity;
            totalAmount += amount;

            prescriptionDetails.Add(new OutpatientPrescriptionDetail
            {
                MedicineID = item.MedicineID,
                RequestedQuantity = item.RequestedQuantity,
                DispensedQuantity = 0,
                DosageInstructions = item.DosageInstructions ?? "Ngày uống 2 lần, mỗi lần 1 viên sau ăn",
                MorningDose = item.MorningDose ?? 1,
                NoonDose = item.NoonDose ?? 0,
                AfternoonDose = item.AfternoonDose ?? 0,
                NightDose = item.NightDose ?? 1,
                UsageTime = item.UsageTime ?? "Sau ăn 30 phút",
                UnitPrice = unitPrice,
                Amount = amount
            });
        }

        int insuranceRate = req.InsuranceRate;
        decimal insuranceCoverage = totalAmount * (insuranceRate / 100m);
        decimal patientCoPay = totalAmount - insuranceCoverage;

        var newPrescription = new OutpatientPrescription
        {
            PrescriptionCode = prescriptionCode,
            Barcode = barcode,
            PatientCode = string.IsNullOrWhiteSpace(req.PatientCode) ? $"BN-{(prescriptionCount + 100):D6}" : req.PatientCode.Trim(),
            PatientName = req.PatientName.Trim(),
            BirthYear = req.BirthYear ?? (DateTime.Now.Year - 35),
            Gender = req.Gender ?? "Nam",
            Address = req.Address ?? "TP. Hồ Chí Minh",
            InsuranceCardNumber = req.InsuranceCardNumber,
            InsuranceRate = insuranceRate,
            Diagnosis = req.Diagnosis ?? "Khám bệnh ngoại trú thông thường",
            DoctorName = req.DoctorName ?? "BS.CKII. Nguyễn Hữu Lực",
            DepartmentID = req.DepartmentID > 0 ? req.DepartmentID : 1,
            PrescribedAt = DateTime.Now,
            Status = "Pending",
            TotalAmount = totalAmount,
            InsuranceCoverageAmount = insuranceCoverage,
            PatientCoPayAmount = patientCoPay,
            Notes = req.Notes,
            DoctorSignature = req.DoctorSignature,
            DigitalSignature = req.DoctorSignature ?? $"HMAC-SHA256:{Guid.NewGuid():N}",
            Details = prescriptionDetails
        };

        _context.OutpatientPrescriptions.Add(newPrescription);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            message = "Tạo đơn thuốc thành công.",
            prescriptionId = newPrescription.PrescriptionID,
            prescriptionCode = newPrescription.PrescriptionCode,
            barcode = newPrescription.Barcode
        });
    }

    /// <summary>
    /// Cập nhật chữ ký số / chữ ký tay của Dược sĩ, Bác sĩ hoặc Bệnh nhân trên đơn thuốc
    /// </summary>
    [HttpPost("{id}/signature")]
    public async Task<IActionResult> UpdateSignature(int id, [FromBody] UpdateSignatureRequest req)
    {
        var prescription = await _context.OutpatientPrescriptions.FindAsync(id);
        if (prescription == null)
        {
            return NotFound(new { message = "Không tìm thấy đơn thuốc." });
        }

        if (!string.IsNullOrWhiteSpace(req.DispenserSignature))
        {
            prescription.DispenserSignature = req.DispenserSignature;
            prescription.DigitalSignature = req.DispenserSignature;
        }

        if (!string.IsNullOrWhiteSpace(req.DoctorSignature))
        {
            prescription.DoctorSignature = req.DoctorSignature;
        }

        if (!string.IsNullOrWhiteSpace(req.PatientSignature))
        {
            prescription.PatientSignature = req.PatientSignature;
        }

        if (!string.IsNullOrWhiteSpace(req.DoctorName))
        {
            prescription.DoctorName = req.DoctorName;
        }

        if (!string.IsNullOrWhiteSpace(req.DispensedBy))
        {
            prescription.DispensedBy = req.DispensedBy;
        }

        await _context.SaveChangesAsync();

        // Broadcast SignalR notification
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "PrescriptionSignatureUpdated");

        return Ok(new
        {
            success = true,
            message = "Cập nhật chữ ký thành công.",
            prescription.DispenserSignature,
            prescription.DoctorSignature,
            prescription.PatientSignature,
            prescription.DoctorName,
            prescription.DispensedBy
        });
    }

    /// <summary>
    /// Lấy danh mục thuốc sẵn có tại Quầy Dược (Kho lẻ) để hỗ trợ kê đơn
    /// </summary>
    [HttpGet("available-medicines")]
    public async Task<IActionResult> GetDispensaryAvailableMedicines([FromQuery] int departmentId = 1)
    {
        var medicines = await _context.DepartmentStocks
            .Include(ds => ds.Batch)
                .ThenInclude(b => b!.Medicine)
            .Where(ds => ds.DepartmentID == departmentId && ds.CurrentQuantity > 0 && ds.Batch != null)
            .GroupBy(ds => ds.Batch!.MedicineID)
            .Select(g => new
            {
                MedicineID = g.Key,
                MedicineName = g.First().Batch!.Medicine!.MedicineName,
                GenericName = g.First().Batch!.Medicine!.GenericName,
                Unit = g.First().Batch!.Medicine!.Unit,
                TotalStock = g.Sum(x => x.CurrentQuantity),
                DefaultPrice = g.First().Batch!.ImportPrice * 1.15m
            })
            .ToListAsync();

        return Ok(medicines);
    }
}

// DTO Models
public class DispenseRequest
{
    public string? DispensedBy { get; set; }
    public string? Notes { get; set; }
    public string? DispenserSignature { get; set; }
    public string? PatientSignature { get; set; }
    public List<DispenseItemAllocation>? Allocations { get; set; }
}

public class UpdateSignatureRequest
{
    public string? DispenserSignature { get; set; }
    public string? DoctorSignature { get; set; }
    public string? PatientSignature { get; set; }
    public string? DoctorName { get; set; }
    public string? DispensedBy { get; set; }
}

public class DispenseItemAllocation
{
    public int PrescriptionDetailID { get; set; }
    public int BatchID { get; set; }
    public int Quantity { get; set; }
}

public class CreatePrescriptionRequest
{
    public string PatientName { get; set; } = string.Empty;
    public string? PatientCode { get; set; }
    public int? BirthYear { get; set; }
    public string? Gender { get; set; }
    public string? Address { get; set; }
    public string? InsuranceCardNumber { get; set; }
    public int InsuranceRate { get; set; } = 80;
    public string? Diagnosis { get; set; }
    public string? DoctorName { get; set; }
    public string? DoctorSignature { get; set; }
    public int DepartmentID { get; set; } = 1;
    public string? Notes { get; set; }
    public List<CreatePrescriptionItemRequest> Details { get; set; } = new();
}

public class CreatePrescriptionItemRequest
{
    public int MedicineID { get; set; }
    public int RequestedQuantity { get; set; }
    public decimal UnitPrice { get; set; }
    public string? DosageInstructions { get; set; }
    public decimal? MorningDose { get; set; } = 1;
    public decimal? NoonDose { get; set; } = 0;
    public decimal? AfternoonDose { get; set; } = 0;
    public decimal? NightDose { get; set; } = 1;
    public string? UsageTime { get; set; } = "Sau ăn 30 phút";
}
