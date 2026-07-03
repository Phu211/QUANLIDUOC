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
    public async Task<IActionResult> GetSummary([FromQuery] int? departmentId = null, [FromQuery] string timeUnit = "month")
    {
        var today = DateTime.Today;
        var thresholdDate = today.AddDays(90);

        if (departmentId.HasValue)
        {
            var deptId = departmentId.Value;

            // 1. Total Medicines (Distinct medicine IDs present in the department cabinet with stock)
            var totalMedicines = await _context.DepartmentStocks
                .Where(ds => ds.DepartmentID == deptId && ds.CurrentQuantity > 0)
                .Select(ds => ds.Batch!.MedicineID)
                .Distinct()
                .CountAsync();

            // 2. Pending Requisitions from this department
            var pendingRequisitions = await _context.MedicineRequisitions
                .CountAsync(r => r.DepartmentID == deptId && (r.Status == "Pending" || r.Status == "PendingHead"));

            // 3. Near Expiry Batches in department cabinet
            var expiringBatchesCount = await _context.DepartmentStocks
                .Where(ds => ds.DepartmentID == deptId && ds.CurrentQuantity > 0 &&
                             ds.Batch!.ExpiryDate > today && ds.Batch!.ExpiryDate <= thresholdDate)
                .Select(ds => ds.BatchID)
                .Distinct()
                .CountAsync();

            // 4. Expired Batches in department cabinet
            var expiredBatchesCount = await _context.DepartmentStocks
                .Where(ds => ds.DepartmentID == deptId && ds.CurrentQuantity > 0 &&
                             ds.Batch!.ExpiryDate <= today)
                .Select(ds => ds.BatchID)
                .Distinct()
                .CountAsync();

            // 5. Low Stock Medicines in this department (cabinet stock < MinInventory)
            var deptStocks = await _context.DepartmentStocks
                .Include(ds => ds.Batch)
                .ThenInclude(b => b!.Medicine)
                .Where(ds => ds.DepartmentID == deptId)
                .ToListAsync();

            var deptMedGroups = deptStocks
                .GroupBy(ds => ds.Batch!.MedicineID)
                .Select(g => new {
                    Medicine = g.First().Batch!.Medicine,
                    TotalQty = g.Sum(ds => ds.CurrentQuantity)
                });

            int lowStockCount = 0;
            foreach (var item in deptMedGroups)
            {
                if (item.TotalQty < item.Medicine!.MinInventory)
                {
                    lowStockCount++;
                }
            }

            // 6. Recent Requisitions from this department
            var recentRequisitions = await _context.MedicineRequisitions
                .Include(r => r.Department)
                .Where(r => r.DepartmentID == deptId)
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

            // 7. Expiring Alerts for this department (Top 10)
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
                    CabinetQty = _context.DepartmentStocks.Where(s => s.DepartmentID == deptId && s.BatchID == b.BatchID).Sum(s => s.CurrentQuantity)
                })
                .Where(b => b.CabinetQty > 0)
                .Take(10)
                .ToListAsync();

            // 8. Dynamic Chart Datasets
            // 8.1 Top 5 Medicines Consumed in this department (Bar Chart)
            var consumptionData = await _context.CabinetTransactions
                .Include(t => t.Batch)
                .ThenInclude(b => b!.Medicine)
                .Where(t => t.DepartmentID == deptId)
                .GroupBy(t => t.Batch!.Medicine!.MedicineName)
                .Select(g => new { Name = g.Key, Value = g.Sum(t => t.Quantity) })
                .OrderByDescending(x => x.Value)
                .Take(5)
                .ToListAsync();

            // 8.2 Cabinet Consumed Quantities by timeUnit (Line Chart)
            var dbTransactions = await _context.CabinetTransactions
                .Where(t => t.DepartmentID == deptId)
                .Select(t => new { t.TransactionDate, t.Quantity })
                .ToListAsync();

            List<object> importCostData;
            if (timeUnit == "week")
            {
                var cal = System.Globalization.CultureInfo.InvariantCulture.Calendar;
                importCostData = dbTransactions
                    .GroupBy(t => {
                        int week = cal.GetWeekOfYear(t.TransactionDate, System.Globalization.CultureInfo.InvariantCulture.DateTimeFormat.CalendarWeekRule, System.Globalization.CultureInfo.InvariantCulture.DateTimeFormat.FirstDayOfWeek);
                        return new { t.TransactionDate.Year, Week = week };
                    })
                    .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Week)
                    .Select(g => new {
                        Name = $"T.{g.Key.Week}",
                        Value = (double)g.Sum(t => t.Quantity)
                    })
                    .Cast<object>()
                    .ToList();
            }
            else if (timeUnit == "year")
            {
                importCostData = dbTransactions
                    .GroupBy(t => t.TransactionDate.Year)
                    .OrderBy(g => g.Key)
                    .Select(g => new {
                        Name = $"Năm {g.Key}",
                        Value = (double)g.Sum(t => t.Quantity)
                    })
                    .Cast<object>()
                    .ToList();
            }
            else // Default to month
            {
                importCostData = dbTransactions
                    .GroupBy(t => new { t.TransactionDate.Year, t.TransactionDate.Month })
                    .Select(g => new {
                        Year = g.Key.Year,
                        Month = g.Key.Month,
                        Qty = g.Sum(t => t.Quantity)
                    })
                    .OrderBy(c => c.Year).ThenBy(c => c.Month)
                    .Select(c => new {
                        Name = $"Thg {c.Month}",
                        Value = (double)c.Qty
                    })
                    .Cast<object>()
                    .ToList();
            }

            // 8.3 Medicine Group Distribution in this department (Donut Chart)
            var deptGroups = deptStocks
                .Where(ds => ds.CurrentQuantity > 0)
                .Select(ds => ds.Batch!.Medicine)
                .ToList();

            var khangSinh = deptGroups.Count(m => m!.MedicineGroup == "Kháng sinh" && !m.MedicineCode.StartsWith("VATTU"));
            var giamDau = deptGroups.Count(m => m!.MedicineGroup == "Giảm đau & Hạ sốt" && !m.MedicineCode.StartsWith("VATTU"));
            var vitamin = deptGroups.Count(m => m!.MedicineGroup == "Vitamin & Bổ trợ" && !m.MedicineCode.StartsWith("VATTU"));
            var vatTu = deptGroups.Count(m => m!.MedicineCode.StartsWith("VATTU"));
            
            var totalCount = deptGroups.Select(m => m!.MedicineID).Distinct().Count();
            var khac = Math.Max(0, totalCount - (khangSinh + giamDau + vitamin + vatTu));

            var groupDistribution = new List<object>
            {
                new { Name = "Kháng sinh", Value = khangSinh },
                new { Name = "Giảm đau & Hạ sốt", Value = giamDau },
                new { Name = "Vitamin & Bổ trợ", Value = vitamin },
                new { Name = "Vật tư y tế", Value = vatTu },
                new { Name = "Khác", Value = khac }
            };

            var inTransitCount = await _context.MedicineRequisitions
                .CountAsync(r => r.DepartmentID == deptId && r.Status == "InTransit");

            var slaBreachedCount = await _context.MedicineRequisitions
                .CountAsync(r => r.DepartmentID == deptId && r.IsSlaBreached);

            var rejectedOnReceiveCount = await _context.MedicineRequisitions
                .CountAsync(r => r.DepartmentID == deptId && r.Status == "RejectedOnReceive");

            var transitTimes = await _context.MedicineRequisitions
                .Where(r => r.DepartmentID == deptId && r.DeliveredAt != null && r.ReceiveDate != null)
                .Select(r => new { DeliveredAt = r.DeliveredAt!.Value, ReceiveDate = r.ReceiveDate!.Value })
                .ToListAsync();

            double avgTransit = transitTimes.Any() 
                ? transitTimes.Average(r => (r.ReceiveDate - r.DeliveredAt).TotalMinutes) 
                : 0.0;

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
                GroupDistribution = groupDistribution,
                InTransitCount = inTransitCount,
                SlaBreachedCount = slaBreachedCount,
                RejectedOnReceiveCount = rejectedOnReceiveCount,
                AverageTransitMinutes = avgTransit
            });
        }
        else
        {
            // Global Dashboard Logic
            // 1. Total Medicines
            var totalMedicines = await _context.Medicines.CountAsync();

            // 1.1 Total Suppliers
            var totalSuppliers = await _context.Suppliers.CountAsync();

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
            // 8.1 Department Consumption (Bar Chart)
            var departments = await _context.Departments.ToListAsync();
            var consumptionData = new List<object>();
            foreach (var dept in departments)
            {
                var qty = await _context.CabinetTransactions
                    .Where(t => t.DepartmentID == dept.DepartmentID)
                    .SumAsync(t => t.Quantity);
                consumptionData.Add(new { Name = dept.DepartmentName, Value = qty });
            }

            // 8.2 Import Costs over timeUnit (Line Chart)
            var dbImportReceipts = await _context.ImportReceipts
                .Select(r => new {
                    r.ImportDate,
                    Details = r.Details.Select(d => new {
                        d.Quantity,
                        ImportPrice = d.Batch != null ? d.Batch.ImportPrice : 0
                    })
                })
                .ToListAsync();

            List<object> importCostData;
            if (timeUnit == "week")
            {
                var cal = System.Globalization.CultureInfo.InvariantCulture.Calendar;
                importCostData = dbImportReceipts
                    .GroupBy(r => {
                        int week = cal.GetWeekOfYear(r.ImportDate, System.Globalization.CultureInfo.InvariantCulture.DateTimeFormat.CalendarWeekRule, System.Globalization.CultureInfo.InvariantCulture.DateTimeFormat.FirstDayOfWeek);
                        return new { r.ImportDate.Year, Week = week };
                    })
                    .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Week)
                    .Select(g => new {
                        Name = $"T.{g.Key.Week}",
                        Value = (double)g.Sum(r => r.Details.Sum(d => d.Quantity * d.ImportPrice)) / 1000000.0
                    })
                    .Cast<object>()
                    .ToList();
            }
            else if (timeUnit == "year")
            {
                importCostData = dbImportReceipts
                    .GroupBy(r => r.ImportDate.Year)
                    .OrderBy(g => g.Key)
                    .Select(g => new {
                        Name = $"Năm {g.Key}",
                        Value = (double)g.Sum(r => r.Details.Sum(d => d.Quantity * d.ImportPrice)) / 1000000.0
                    })
                    .Cast<object>()
                    .ToList();
            }
            else // Default to month
            {
                importCostData = dbImportReceipts
                    .GroupBy(r => new { r.ImportDate.Year, r.ImportDate.Month })
                    .Select(g => new {
                        Year = g.Key.Year,
                        Month = g.Key.Month,
                        Cost = g.Sum(r => r.Details.Sum(d => d.Quantity * d.ImportPrice))
                    })
                    .OrderBy(c => c.Year).ThenBy(c => c.Month)
                    .Select(c => new {
                        Name = $"Thg {c.Month}",
                        Value = (double)c.Cost / 1000000.0
                    })
                    .Cast<object>()
                    .ToList();
            }

            // 8.3 Medicine Group Distribution (Donut Chart)
            var allMedicines = await _context.Medicines.ToListAsync();

            var khangSinh = allMedicines.Count(m => m.MedicineGroup == "Kháng sinh" && !m.MedicineCode.StartsWith("VATTU"));
            var giamDau = allMedicines.Count(m => m.MedicineGroup == "Giảm đau & Hạ sốt" && !m.MedicineCode.StartsWith("VATTU"));
            var vitamin = allMedicines.Count(m => m.MedicineGroup == "Vitamin & Bổ trợ" && !m.MedicineCode.StartsWith("VATTU"));
            var vatTu = allMedicines.Count(m => m.MedicineCode.StartsWith("VATTU"));
            
            var totalCount = allMedicines.Count;
            var khac = Math.Max(0, totalCount - (khangSinh + giamDau + vitamin + vatTu));

            var groupDistribution = new List<object>
            {
                new { Name = "Kháng sinh", Value = khangSinh },
                new { Name = "Giảm đau & Hạ sốt", Value = giamDau },
                new { Name = "Vitamin & Bổ trợ", Value = vitamin },
                new { Name = "Vật tư y tế", Value = vatTu },
                new { Name = "Khác", Value = khac }
            };

            var inTransitCount = await _context.MedicineRequisitions
                .CountAsync(r => r.Status == "InTransit");

            var slaBreachedCount = await _context.MedicineRequisitions
                .CountAsync(r => r.IsSlaBreached);

            var rejectedOnReceiveCount = await _context.MedicineRequisitions
                .CountAsync(r => r.Status == "RejectedOnReceive");

            var transitTimesGlobal = await _context.MedicineRequisitions
                .Where(r => r.DeliveredAt != null && r.ReceiveDate != null)
                .Select(r => new { DeliveredAt = r.DeliveredAt!.Value, ReceiveDate = r.ReceiveDate!.Value })
                .ToListAsync();

            double avgTransitGlobal = transitTimesGlobal.Any() 
                ? transitTimesGlobal.Average(r => (r.ReceiveDate - r.DeliveredAt).TotalMinutes) 
                : 0.0;

            return Ok(new
            {
                TotalMedicines = totalMedicines,
                TotalSuppliers = totalSuppliers,
                PendingRequisitions = pendingRequisitions,
                LowStockCount = lowStockCount,
                ExpiringBatchesCount = expiringBatchesCount,
                ExpiredBatchesCount = expiredBatchesCount,
                RecentRequisitions = recentRequisitions,
                ExpiringAlerts = expiringAlerts,
                DeptConsumption = consumptionData,
                ImportCosts = importCostData,
                GroupDistribution = groupDistribution,
                InTransitCount = inTransitCount,
                SlaBreachedCount = slaBreachedCount,
                RejectedOnReceiveCount = rejectedOnReceiveCount,
                AverageTransitMinutes = avgTransitGlobal
            });
        }
    }
}
