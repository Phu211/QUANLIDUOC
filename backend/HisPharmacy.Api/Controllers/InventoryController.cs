using HisPharmacy.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly HisDbContext _context;

    public InventoryController(HisDbContext context)
    {
        _context = context;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummaryReport()
    {
        var medicines = await _context.Medicines.ToListAsync();
        var report = new List<object>();

        foreach (var med in medicines)
        {
            var mainQty = await _context.InventoryStocks
                .Where(s => s.Batch!.MedicineID == med.MedicineID)
                .SumAsync(s => s.CurrentQuantity);

            var deptQty = await _context.DepartmentStocks
                .Where(s => s.Batch!.MedicineID == med.MedicineID)
                .SumAsync(s => s.CurrentQuantity);

            int totalQty = mainQty + deptQty;
            bool isLowStock = totalQty < med.MinInventory;

            report.Add(new
            {
                med.MedicineID,
                med.MedicineCode,
                med.MedicineName,
                med.GenericName,
                med.Specification,
                med.Manufacturer,
                med.Unit,
                med.MinInventory,
                MainStoreQty = mainQty,
                CabinetQty = deptQty,
                TotalQty = totalQty,
                IsLowStock = isLowStock
            });
        }

        return Ok(report);
    }

    [HttpGet("batches")]
    public async Task<IActionResult> GetBatchDetails()
    {
        var mainBatchesDb = await _context.InventoryStocks
            .Include(s => s.Batch)!.ThenInclude(b => b!.Medicine)
            .Where(s => s.CurrentQuantity > 0)
            .ToListAsync();

        var deptBatchesDb = await _context.DepartmentStocks
            .Include(s => s.Batch)!.ThenInclude(b => b!.Medicine)
            .Include(s => s.Department)
            .Where(s => s.CurrentQuantity > 0)
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

        var mainBatches = mainBatchesDb.Select(s => new
        {
            s.BatchID,
            QuarantineStockID = (int?)null,
            s.Batch!.BatchNumber,
            MedicineID = s.Batch.MedicineID,
            MedicineCode = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineCode : "",
            MedicineName = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineName : "",
            s.Batch.ExpiryDate,
            s.Batch.ImportPrice,
            Location = "Kho chẵn chính",
            Quantity = s.CurrentQuantity,
            Status = s.Batch.Status,
            SourceCode = s.Batch.Status == "Cách ly" || s.Batch.Status == "Chờ tiêu hủy" 
                ? (returnLookup.ContainsKey(s.BatchID) ? returnLookup[s.BatchID] : (recallLookup.ContainsKey(s.BatchID) ? recallLookup[s.BatchID] : null)) 
                : null
        }).ToList();

        var deptBatches = deptBatchesDb.Select(s => new
        {
            s.BatchID,
            QuarantineStockID = (int?)null,
            s.Batch!.BatchNumber,
            MedicineID = s.Batch.MedicineID,
            MedicineCode = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineCode : "",
            MedicineName = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineName : "",
            s.Batch.ExpiryDate,
            s.Batch.ImportPrice,
            Location = s.Department != null ? s.Department.DepartmentName : "Tủ trực khoa",
            Quantity = s.CurrentQuantity,
            Status = s.Batch.Status,
            SourceCode = s.Batch.Status == "Cách ly" || s.Batch.Status == "Chờ tiêu hủy" 
                ? (returnLookup.ContainsKey(s.BatchID) ? returnLookup[s.BatchID] : (recallLookup.ContainsKey(s.BatchID) ? recallLookup[s.BatchID] : null)) 
                : null
        }).ToList();

        var quarantinedBatchesDb = await _context.QuarantineStocks
            .Include(q => q.Batch)!.ThenInclude(b => b!.Medicine)
            .Where(q => q.Quantity > 0)
            .ToListAsync();

        var quarantinedBatches = quarantinedBatchesDb.Select(q => new
        {
            q.BatchID,
            QuarantineStockID = (int?)q.QuarantineID,
            BatchNumber = q.Batch?.BatchNumber ?? "",
            MedicineID = q.Batch?.MedicineID ?? 0,
            MedicineCode = q.Batch?.Medicine?.MedicineCode ?? "",
            MedicineName = q.Batch?.Medicine?.MedicineName ?? "",
            ExpiryDate = q.Batch?.ExpiryDate ?? DateTime.Now,
            ImportPrice = q.Batch?.ImportPrice ?? 0,
            Location = q.LocationType == "MainStore" ? "Kho chẵn chính (Hư hỏng)" : "Tủ trực khoa (Hư hỏng)",
            Quantity = q.Quantity,
            Status = "Chờ tiêu hủy",
            SourceCode = q.Reason
        }).ToList();

        var allBatches = mainBatches.Concat(deptBatches).Concat(quarantinedBatches)
            .OrderBy(b => b.ExpiryDate)
            .ToList();

        return Ok(allBatches);
    }

    [HttpPost("quarantine/{id}/restore")]
    public async Task<IActionResult> RestoreQuarantineStock(int id)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Lãnh đạo mới có quyền phục hồi tồn kho." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var qs = await _context.QuarantineStocks
                .Include(q => q.Batch)
                .FirstOrDefaultAsync(q => q.QuarantineID == id);

            if (qs == null)
                return NotFound(new { Error = "Không tìm thấy bản ghi kho cách ly." });

            if (qs.Status != "AwaitingDestroy" || qs.Quantity <= 0)
                return BadRequest(new { Error = "Bản ghi này đã được xử lý hoặc không có số lượng khả dụng." });

            // Restore stock back to InventoryStocks (Main store)
            var invStock = await _context.InventoryStocks.FirstOrDefaultAsync(s => s.BatchID == qs.BatchID);
            int beforeQty = 0;
            if (invStock == null)
            {
                invStock = new InventoryStock
                {
                    BatchID = qs.BatchID,
                    CurrentQuantity = qs.Quantity,
                    ReservedQuantity = 0
                };
                _context.InventoryStocks.Add(invStock);
            }
            else
            {
                beforeQty = invStock.CurrentQuantity;
                invStock.CurrentQuantity += qs.Quantity;
            }

            // Ghi nhận lịch sử giao dịch (InventoryMovements)
            _context.InventoryMovements.Add(new InventoryMovement
            {
                MedicineID = qs.Batch!.MedicineID,
                BatchID = qs.BatchID,
                LocationType = "MainStore",
                DepartmentID = null,
                BeforeQuantity = beforeQty,
                ChangeQuantity = qs.Quantity,
                AfterQuantity = invStock.CurrentQuantity,
                SourceType = "QuarantineRestore",
                SourceID = qs.QuarantineID,
                Action = "RESTORE_QUARANTINE",
                ByUser = "Thủ kho Dược",
                CreatedAt = DateTime.Now
            });

            // Mark quarantine record as Resolved
            int restoredQty = qs.Quantity;
            qs.Quantity = 0;
            qs.Status = "Resolved";
            qs.ResolvedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new { Message = $"Đã khôi phục thành công {restoredQty} thuốc về Kho chẵn chính." });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }
}
