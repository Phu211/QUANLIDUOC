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
        var mainBatches = await _context.InventoryStocks
            .Include(s => s.Batch)!.ThenInclude(b => b!.Medicine)
            .Where(s => s.CurrentQuantity > 0)
            .Select(s => new
            {
                s.BatchID,
                s.Batch!.BatchNumber,
                MedicineID = s.Batch.MedicineID,
                MedicineCode = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineCode : "",
                MedicineName = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineName : "",
                s.Batch.ExpiryDate,
                s.Batch.ImportPrice,
                Location = "Kho chẵn chính",
                Quantity = s.CurrentQuantity
            })
            .ToListAsync();

        var deptBatches = await _context.DepartmentStocks
            .Include(s => s.Batch)!.ThenInclude(b => b!.Medicine)
            .Include(s => s.Department)
            .Where(s => s.CurrentQuantity > 0)
            .Select(s => new
            {
                s.BatchID,
                s.Batch!.BatchNumber,
                MedicineID = s.Batch.MedicineID,
                MedicineCode = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineCode : "",
                MedicineName = s.Batch.Medicine != null ? s.Batch.Medicine.MedicineName : "",
                s.Batch.ExpiryDate,
                s.Batch.ImportPrice,
                Location = s.Department != null ? s.Department.DepartmentName : "Tủ trực khoa",
                Quantity = s.CurrentQuantity
            })
            .ToListAsync();

        var allBatches = mainBatches.Concat(deptBatches)
            .OrderBy(b => b.ExpiryDate)
            .ToList();

        return Ok(allBatches);
    }
}
