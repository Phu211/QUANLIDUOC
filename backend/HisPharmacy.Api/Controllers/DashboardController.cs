using HisPharmacy.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly HisDbContext _context;

    public DashboardController(HisDbContext context)
    {
        _context = context;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var today = DateTime.Today;
        var thresholdDate = today.AddDays(90);

        // 1. Total Medicines
        var totalMedicines = await _context.Medicines.CountAsync();

        // 2. Pending Requisitions
        var pendingRequisitions = await _context.MedicineRequisitions.CountAsync(r => r.Status == "Pending");

        // 3. Near Expiry Batches (Expiring in <= 90 days, > 0 days, and has stock in either main store or department cabinet)
        var expiringBatchesCount = await _context.Batches
            .Where(b => b.ExpiryDate > today && b.ExpiryDate <= thresholdDate &&
                        (_context.InventoryStocks.Any(isStock => isStock.BatchID == b.BatchID && isStock.CurrentQuantity > 0) ||
                         _context.DepartmentStocks.Any(dsStock => dsStock.BatchID == b.BatchID && dsStock.CurrentQuantity > 0)))
            .CountAsync();

        // 4. Expired Batches in stock (but not yet liquidated to quantity 0)
        var expiredBatchesCount = await _context.Batches
            .Where(b => b.ExpiryDate <= today &&
                        (_context.InventoryStocks.Any(isStock => isStock.BatchID == b.BatchID && isStock.CurrentQuantity > 0) ||
                         _context.DepartmentStocks.Any(dsStock => dsStock.BatchID == b.BatchID && dsStock.CurrentQuantity > 0)))
            .CountAsync();

        // 5. Low Stock Medicines (Total current quantity in main store + department stores < MinInventory)
        var medicines = await _context.Medicines.ToListAsync();
        int lowStockCount = 0;
        foreach (var med in medicines)
        {
            var mainQty = await _context.InventoryStocks
                .Where(s => s.Batch!.MedicineID == med.MedicineID)
                .SumAsync(s => s.CurrentQuantity);

            var deptQty = await _context.DepartmentStocks
                .Where(s => s.Batch!.MedicineID == med.MedicineID)
                .SumAsync(s => s.CurrentQuantity);

            if ((mainQty + deptQty) < med.MinInventory)
            {
                lowStockCount++;
            }
        }

        // 6. Recent Requisitions
        var recentRequisitions = await _context.MedicineRequisitions
            .Include(r => r.Department)
            .OrderByDescending(r => r.RequisitionDate)
            .Take(5)
            .Select(r => new
            {
                r.RequisitionID,
                DepartmentName = r.Department != null ? r.Department.DepartmentName : "Không xác định",
                r.RequisitionType,
                r.Status,
                r.RequisitionDate
            })
            .ToListAsync();

        // 7. Expiring Batch Details for alerts (Top 10)
        var expiringAlerts = await _context.Batches
            .Include(b => b.Medicine)
            .Where(b => b.ExpiryDate > today && b.ExpiryDate <= thresholdDate)
            .OrderBy(b => b.ExpiryDate)
            .Select(b => new
            {
                b.BatchID,
                b.BatchNumber,
                MedicineCode = b.Medicine != null ? b.Medicine.MedicineCode : "",
                MedicineName = b.Medicine != null ? b.Medicine.MedicineName : "",
                b.ExpiryDate,
                DaysLeft = EF.Functions.DateDiffDay(today, b.ExpiryDate),
                MainStoreQty = _context.InventoryStocks.Where(s => s.BatchID == b.BatchID).Select(s => s.CurrentQuantity).FirstOrDefault(),
                CabinetQty = _context.DepartmentStocks.Where(s => s.BatchID == b.BatchID).Sum(s => s.CurrentQuantity)
            })
            .Where(b => b.MainStoreQty > 0 || b.CabinetQty > 0)
            .Take(10)
            .ToListAsync();

        // 8. Dynamic Chart Datasets
        // 8.1 Department Consumption (Bar Chart) - Load all departments dynamically from DB and sum their transactions
        var departments = await _context.Departments.ToListAsync();
        var consumptionData = new List<object>();
        foreach (var dept in departments)
        {
            var qty = await _context.CabinetTransactions
                .Where(t => t.DepartmentID == dept.DepartmentID)
                .SumAsync(t => t.Quantity);
            consumptionData.Add(new { Name = dept.DepartmentName, Value = qty });
        }

        // 8.2 Import Costs over Months (Line Chart) - Optimized projection to avoid loading huge DocumentsJson
        var dbImportReceipts = await _context.ImportReceipts
            .Select(r => new {
                r.ImportDate,
                Details = r.Details.Select(d => new {
                    d.Quantity,
                    ImportPrice = d.Batch != null ? d.Batch.ImportPrice : 0
                })
            })
            .ToListAsync();

        var importCostData = dbImportReceipts
            .GroupBy(r => new { r.ImportDate.Year, r.ImportDate.Month })
            .Select(g => new {
                Year = g.Key.Year,
                Month = g.Key.Month,
                Cost = g.Sum(r => r.Details.Sum(d => d.Quantity * d.ImportPrice))
            })
            .OrderBy(c => c.Year).ThenBy(c => c.Month)
            .Select(c => new {
                Name = $"Thg {c.Month}",
                Value = (double)c.Cost / 1000000.0 // In millions VND
            })
            .ToList();

        // 8.3 Medicine Group Distribution (Donut Chart) - 100% real database data, no mock fallbacks
        var groupCounts = await _context.Medicines
            .GroupBy(m => m.MedicineGroup)
            .Select(g => new { Group = g.Key, Count = g.Count() })
            .ToListAsync();

        var groupDistribution = new List<object>
        {
            new { Name = "Kháng sinh", Value = groupCounts.FirstOrDefault(g => g.Group == "Kháng sinh")?.Count ?? 0 },
            new { Name = "Giảm đau & Hạ sốt", Value = groupCounts.FirstOrDefault(g => g.Group == "Giảm đau & Hạ sốt")?.Count ?? 0 },
            new { Name = "Vitamin & Bổ trợ", Value = groupCounts.FirstOrDefault(g => g.Group == "Vitamin & Bổ trợ")?.Count ?? 0 },
            new { Name = "Dược phẩm khác", Value = groupCounts.FirstOrDefault(g => g.Group == "Dược phẩm khác")?.Count ?? 0 }
        };

        return Ok(new
        {
            TotalMedicines = totalMedicines,
            PendingRequisitions = pendingRequisitions,
            LowStockCount = lowStockCount,
            ExpiringBatchesCount = expiringBatchesCount,
            ExpiredBatchesCount = expiredBatchesCount,
            RecentRequisitions = recentRequisitions,
            ExpiringAlerts = expiringAlerts,
            DeptConsumption = consumptionData,
            ImportCosts = importCostData,
            GroupDistribution = groupDistribution
        });
    }
}
