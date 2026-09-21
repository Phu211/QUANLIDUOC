using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class ClearanceController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public ClearanceController(HisDbContext context, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Phân tích toàn diện các lô thuốc cận date theo thuật toán ADC, DaysOfSupply và Ghép đôi điều chuyển
    /// </summary>
    [HttpGet("analyze")]
    public async Task<IActionResult> AnalyzeShortDatedStocks([FromQuery] int daysThreshold = 180)
    {
        var today = DateTime.Today;
        var thresholdDate = today.AddDays(daysThreshold);
        var observationDays = 90;
        var windowStartDate = today.AddDays(-observationDays);

        // 1. Lấy toàn bộ danh sách các Khoa lâm sàng
        var departments = await _context.Departments.ToListAsync();
        var deptDict = departments.ToDictionary(d => d.DepartmentID, d => d.DepartmentName);

        // 2. Lấy danh sách tồn kho Kho chẵn có Hạn dùng <= thresholdDate
        var mainStocks = await _context.InventoryStocks
            .Include(s => s.Batch)!.ThenInclude(b => b!.Medicine)
            .Where(s => s.CurrentQuantity > 0 && 
                        s.Batch != null && 
                        s.Batch.ExpiryDate <= thresholdDate &&
                        s.Batch.Status != "Tiêu hủy")
            .ToListAsync();

        // 3. Lấy danh sách tồn kho Tủ trực Khoa có Hạn dùng <= thresholdDate
        var deptStocks = await _context.DepartmentStocks
            .Include(s => s.Batch)!.ThenInclude(b => b!.Medicine)
            .Include(s => s.Department)
            .Where(s => s.CurrentQuantity > 0 && 
                        s.Batch != null && 
                        s.Batch.ExpiryDate <= thresholdDate &&
                        s.Batch.Status != "Tiêu hủy")
            .ToListAsync();

        // 4. Lấy dữ liệu tiêu thụ thực tế trong 90 ngày qua
        // - Tại các Khoa: Tổng số lượng trong CabinetTransactions
        var deptCabinetTxs = await _context.CabinetTransactions
            .Where(t => t.TransactionDate >= windowStartDate)
            .GroupBy(t => new { t.DepartmentID, t.Batch!.MedicineID })
            .Select(g => new
            {
                g.Key.DepartmentID,
                g.Key.MedicineID,
                TotalUsed = g.Sum(x => x.Quantity)
            })
            .ToListAsync();

        // - Tại các Khoa: Thêm số lượng được cấp phát qua InternalTransfer trong 90 ngày
        var deptTransferTxs = await _context.InternalTransfers
            .Where(t => t.TransferDate >= windowStartDate)
            .SelectMany(t => t.Details.Select(d => new { DeptID = t.ToDepartmentID, d.Batch!.MedicineID, d.Quantity }))
            .GroupBy(x => new { x.DeptID, x.MedicineID })
            .Select(g => new
            {
                DepartmentID = g.Key.DeptID,
                MedicineID = g.Key.MedicineID,
                TotalUsed = g.Sum(x => x.Quantity)
            })
            .ToListAsync();

        // Kết hợp tiêu thụ theo từng khoa
        var deptAdcMap = new Dictionary<string, decimal>();
        var hospitalAdcMap = new Dictionary<int, decimal>();

        foreach (var tx in deptCabinetTxs)
        {
            string key = $"{tx.DepartmentID}_{tx.MedicineID}";
            deptAdcMap[key] = Math.Round((decimal)tx.TotalUsed / 30.0m, 2);
            
            if (!hospitalAdcMap.ContainsKey(tx.MedicineID)) hospitalAdcMap[tx.MedicineID] = 0;
            hospitalAdcMap[tx.MedicineID] += Math.Round((decimal)tx.TotalUsed / 30.0m, 2);
        }

        foreach (var tx in deptTransferTxs)
        {
            string key = $"{tx.DepartmentID}_{tx.MedicineID}";
            decimal txAdc = Math.Round((decimal)tx.TotalUsed / 60.0m, 2);
            if (!deptAdcMap.ContainsKey(key) || deptAdcMap[key] < txAdc)
            {
                deptAdcMap[key] = txAdc;
            }
            if (!hospitalAdcMap.ContainsKey(tx.MedicineID) || hospitalAdcMap[tx.MedicineID] < txAdc)
            {
                hospitalAdcMap[tx.MedicineID] = txAdc;
            }
        }

        // - Tại Kho chẵn: Xuất qua Requisition / Cấp phát trong 90 ngày
        var mainConsumptions = await _context.InventoryMovements
            .Where(m => m.LocationType == "MainStore" && 
                        m.SourceType == "Requisition" && 
                        m.CreatedAt >= windowStartDate && 
                        m.ChangeQuantity < 0)
            .GroupBy(m => m.MedicineID)
            .Select(g => new
            {
                MedicineID = g.Key,
                TotalUsed = g.Sum(x => Math.Abs(x.ChangeQuantity))
            })
            .ToListAsync();

        var mainAdcMap = mainConsumptions.ToDictionary(
            x => x.MedicineID,
            x => Math.Round((decimal)x.TotalUsed / 30.0m, 2)
        );

        // 5. Lấy thông tin Nhà cung cấp theo Lô (từ phiếu nhập hoặc SupplierMedicines)
        var importDetails = await _context.ImportReceiptDetails
            .Include(d => d.ImportReceipt)!.ThenInclude(r => r!.Supplier)
            .OrderByDescending(d => d.ImportDetailID)
            .ToListAsync();

        var batchSupplierMap = new Dictionary<int, Supplier>();
        var batchContractMap = new Dictionary<int, string>();
        foreach (var id in importDetails)
        {
            if (id.ImportReceipt?.Supplier != null && !batchSupplierMap.ContainsKey(id.BatchID))
            {
                batchSupplierMap[id.BatchID] = id.ImportReceipt.Supplier;
                batchContractMap[id.BatchID] = id.ImportReceipt.ContractNumber ?? id.ImportReceipt.Supplier.ContractNumber ?? "";
            }
        }

        // Lấy danh sách ClearanceProposals đã được lưu
        var existingProposals = await _context.ClearanceProposals
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        // 6. Tính toán phân tích chi tiết cho từng vị trí lưu trữ
        var analyzedItems = new List<object>();

        // Tất cả tồn kho hiện tại của các khoa để tính Năng lực hấp thụ (Absorbing Capacity)
        var allDeptStocks = await _context.DepartmentStocks
            .Include(s => s.Batch)
            .Where(s => s.CurrentQuantity > 0)
            .ToListAsync();

        void ProcessStockItem(
            int batchId, 
            Batch batch, 
            Medicine med, 
            string locationType, 
            int? deptId, 
            string locationName, 
            int currentQty)
        {
            int daysToExpiry = (int)(batch.ExpiryDate.Date - today).TotalDays;
            
            // Tính ADC tại vị trí này
            decimal adc = 0m;
            if (locationType == "MainStore")
            {
                if (mainAdcMap.TryGetValue(med.MedicineID, out var mainAdc)) adc = mainAdc;
                else if (hospitalAdcMap.TryGetValue(med.MedicineID, out var hospAdc)) adc = hospAdc;
            }
            else if (deptId.HasValue)
            {
                string key = $"{deptId.Value}_{med.MedicineID}";
                if (deptAdcMap.TryGetValue(key, out var dAdc)) adc = dAdc;
                else if (hospitalAdcMap.TryGetValue(med.MedicineID, out var hospAdc)) adc = Math.Round(hospAdc / Math.Max(1, departments.Count), 2);
            }

            // Nếu ADC vẫn là 0, thiết lập mức tiêu thụ tối thiểu thực tế (0.1 - 0.5 đơn vị/ngày) để tránh chia 0
            if (adc <= 0)
            {
                adc = 0.25m; // Tối thiểu bình quân dự phòng
            }

            // Days of supply
            decimal daysOfSupply = adc > 0.001m ? Math.Round(currentQty / adc, 1) : 999m;

            // Lượng dôi dư có nguy cơ hủy
            int consumableBeforeExpiry = (int)Math.Floor(adc * Math.Max(0, daysToExpiry));
            int estimatedWaste = Math.Max(0, currentQty - consumableBeforeExpiry);
            
            // Nếu cận hạn < 90 ngày và tồn nhiều, coi như toàn bộ lượng vượt mức là có rủi ro
            if (daysToExpiry <= 90 && estimatedWaste == 0 && currentQty > 10)
            {
                estimatedWaste = currentQty;
            }
            decimal estimatedWasteValue = estimatedWaste * batch.ImportPrice;

            // Phân loại mức độ rủi ro (Risk Level)
            string riskLevel = "Low";
            if (daysToExpiry <= 0) riskLevel = "Expired";
            else if (daysToExpiry <= 30) riskLevel = "Critical"; // < 30 ngày: Nguy cấp
            else if (daysToExpiry <= 90) riskLevel = "High";     // 30-90 ngày: Cảnh báo cao (Ngưỡng đổi date NCC)
            else if (daysToExpiry <= 180) riskLevel = "Medium";  // 90-180 ngày: Cảnh báo trung bình (Cần điều chuyển)

            // Thuật toán Ghép đôi (Matchmaking) tìm khoa nhận tối ưu
            var candidateDepartments = new List<object>();
            int? recommendedTargetDeptId = null;
            string recommendedTargetDeptName = "";
            int recommendedTransferQty = 0;
            decimal highestAbsorbingCapacity = 0m;

            foreach (var dept in departments)
            {
                if (locationType == "Cabinet" && deptId == dept.DepartmentID) continue; // Bỏ qua khoa nguồn

                string cKey = $"{dept.DepartmentID}_{med.MedicineID}";
                decimal candAdc = 0.5m; // Mặc định khoa lâm sàng có khả năng dùng
                if (deptAdcMap.TryGetValue(cKey, out var cAdc) && cAdc > 0) candAdc = cAdc;
                else if (hospitalAdcMap.TryGetValue(med.MedicineID, out var hAdc) && hAdc > 0) candAdc = Math.Max(0.5m, Math.Round(hAdc / departments.Count, 2));

                // Tồn hiện tại của khoa này với loại thuốc này
                int candCurrentStock = allDeptStocks
                    .Where(s => s.DepartmentID == dept.DepartmentID && s.Batch?.MedicineID == med.MedicineID)
                    .Sum(s => s.CurrentQuantity);

                // Nhu cầu của khoa đích từ nay đến ngày hết hạn
                int candDemandUntilExpiry = (int)Math.Floor(candAdc * Math.Max(1, daysToExpiry));
                int absorbingCapacity = Math.Max(0, candDemandUntilExpiry - candCurrentStock);
                if (absorbingCapacity == 0 && candCurrentStock < 20) absorbingCapacity = 20;

                candidateDepartments.Add(new
                {
                    dept.DepartmentID,
                    DepartmentName = dept.DepartmentName,
                    ADC = candAdc,
                    CurrentStock = candCurrentStock,
                    DemandUntilExpiry = candDemandUntilExpiry,
                    AbsorbingCapacity = absorbingCapacity
                });

                // Chọn khoa có khả năng hấp thụ tốt nhất và tốc độ tiêu thụ cao
                if (absorbingCapacity > highestAbsorbingCapacity)
                {
                    highestAbsorbingCapacity = absorbingCapacity;
                    recommendedTargetDeptId = dept.DepartmentID;
                    recommendedTargetDeptName = dept.DepartmentName;
                    recommendedTransferQty = Math.Min(Math.Max(1, estimatedWaste > 0 ? estimatedWaste : currentQty), absorbingCapacity);
                }
            }

            // Quyết định hành động tối ưu (Recommended Action)
            string recommendedAction = "Monitor";
            if (daysToExpiry <= 0)
            {
                recommendedAction = "Liquidation";
            }
            else if (daysToExpiry <= 90)
            {
                // Ngưỡng 90 ngày: Kích hoạt Đổi date Nhà cung cấp trước hạn cam kết
                recommendedAction = "VendorReturn";
            }
            else if (daysToExpiry <= 180 && recommendedTargetDeptId.HasValue)
            {
                // Ngưỡng 90-180 ngày: Ưu tiên Điều chuyển nội bộ sang khoa khác
                recommendedAction = "InternalTransfer";
            }
            else if (estimatedWaste > 0)
            {
                recommendedAction = "UrgentDispense";
            }

            // Thông tin Nhà cung cấp
            batchSupplierMap.TryGetValue(batchId, out var supplier);
            batchContractMap.TryGetValue(batchId, out var contractNumber);

            // Kiểm tra xem đã có đề xuất nào được tạo trước đó chưa
            var prevProposal = existingProposals.FirstOrDefault(p => 
                p.BatchID == batchId && 
                p.SourceLocationType == locationType && 
                p.SourceDepartmentID == deptId &&
                p.Status != "Dismissed");

            analyzedItems.Add(new
            {
                BatchID = batchId,
                BatchNumber = batch.BatchNumber,
                ProductionDate = batch.ProductionDate,
                ExpiryDate = batch.ExpiryDate,
                ImportPrice = batch.ImportPrice,
                MedicineID = med.MedicineID,
                MedicineCode = med.MedicineCode,
                MedicineName = med.MedicineName,
                GenericName = med.GenericName,
                Specification = med.Specification,
                Manufacturer = med.Manufacturer,
                Unit = med.Unit,
                MedicineGroup = med.MedicineGroup,
                
                LocationType = locationType,
                DepartmentID = deptId,
                LocationName = locationName,
                CurrentQuantity = currentQty,
                
                ADC = adc,
                DaysToExpiry = daysToExpiry,
                DaysOfSupply = daysOfSupply,
                ConsumableBeforeExpiry = consumableBeforeExpiry,
                EstimatedWaste = estimatedWaste,
                EstimatedWasteValue = estimatedWasteValue,
                RiskLevel = riskLevel,
                
                RecommendedAction = recommendedAction,
                RecommendedTargetDeptID = recommendedTargetDeptId,
                RecommendedTargetDeptName = recommendedTargetDeptName,
                RecommendedTransferQty = recommendedTransferQty > 0 ? recommendedTransferQty : estimatedWaste,
                
                CandidateDepartments = candidateDepartments,
                
                SupplierID = supplier?.SupplierID,
                SupplierName = supplier?.SupplierName ?? "Chưa xác định",
                SupplierPhone = supplier?.Phone ?? "",
                SupplierAddress = supplier?.Address ?? "",
                ContractNumber = contractNumber ?? supplier?.ContractNumber ?? "",
                
                ProposalID = prevProposal?.ClearanceID,
                ProposalStatus = prevProposal?.Status ?? "New",
                ProposalAction = prevProposal?.RecommendedAction,
                ProposalNotes = prevProposal?.Notes
            });
        }

        // Xử lý kho chẵn
        foreach (var s in mainStocks)
        {
            if (s.Batch?.Medicine != null)
            {
                ProcessStockItem(s.BatchID, s.Batch, s.Batch.Medicine, "MainStore", null, "Kho chẵn chính", s.CurrentQuantity);
            }
        }

        // Xử lý các khoa phòng
        foreach (var s in deptStocks)
        {
            if (s.Batch?.Medicine != null)
            {
                string dName = s.Department?.DepartmentName ?? (deptDict.TryGetValue(s.DepartmentID, out var name) ? name : "Tủ trực khoa");
                ProcessStockItem(s.BatchID, s.Batch, s.Batch.Medicine, "Cabinet", s.DepartmentID, dName, s.CurrentQuantity);
            }
        }

        // Tổng hợp thống kê KPI đầu trang
        int totalRiskBatches = analyzedItems.Count;
        int totalUnitsAtRisk = analyzedItems.Cast<dynamic>().Sum(x => (int)x.EstimatedWaste);
        decimal totalEstimatedLoss = analyzedItems.Cast<dynamic>().Sum(x => (decimal)x.EstimatedWasteValue);
        int transferableCount = analyzedItems.Cast<dynamic>().Count(x => (string)x.RecommendedAction == "InternalTransfer");
        int vendorReturnCount = analyzedItems.Cast<dynamic>().Count(x => (string)x.RecommendedAction == "VendorReturn");
        int criticalCount = analyzedItems.Cast<dynamic>().Count(x => (string)x.RiskLevel == "Critical");

        return Ok(new
        {
            Summary = new
            {
                TotalRiskBatches = totalRiskBatches,
                TotalUnitsAtRisk = totalUnitsAtRisk,
                TotalEstimatedLoss = totalEstimatedLoss,
                TransferableCount = transferableCount,
                VendorReturnCount = vendorReturnCount,
                CriticalCount = criticalCount
            },
            Items = analyzedItems.OrderBy(x => ((dynamic)x).DaysToExpiry).ToList(),
            Departments = departments
        });
    }

    /// <summary>
    /// Thực hiện lệnh Điều chuyển nội bộ tự động để giải phóng thuốc cận date
    /// </summary>
    public class ExecuteTransferRequest
    {
        public int BatchID { get; set; }
        public string SourceLocationType { get; set; } = "MainStore";
        public int? SourceDepartmentID { get; set; }
        public int TargetDepartmentID { get; set; }
        public int Quantity { get; set; }
        public string? Notes { get; set; }
        public string? DigitalSignature { get; set; }
        public string? ApproverName { get; set; }
    }

    [HttpPost("execute-transfer")]
    public async Task<IActionResult> ExecuteClearanceTransfer([FromBody] ExecuteTransferRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược hoặc Lãnh đạo mới có quyền phê duyệt điều chuyển thuốc cận date." });

        if (request.Quantity <= 0)
            return BadRequest(new { Error = "Số lượng điều chuyển phải lớn hơn 0." });

        if (request.SourceLocationType == "Cabinet" && request.SourceDepartmentID == request.TargetDepartmentID)
            return BadRequest(new { Error = "Khoa nguồn và Khoa đích không được trùng nhau." });

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var batch = await _context.Batches.Include(b => b.Medicine).FirstOrDefaultAsync(b => b.BatchID == request.BatchID);
            if (batch == null) return NotFound(new { Error = "Không tìm thấy thông tin lô thuốc." });

            var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
            if (string.IsNullOrEmpty(userFullName)) userFullName = request.ApproverName ?? "Dược sĩ phụ trách";

            // 1. Kiểm tra và trừ tồn kho nguồn
            int sourceBefore = 0;
            int sourceAfter = 0;
            if (request.SourceLocationType == "MainStore")
            {
                var invStock = await _context.InventoryStocks.FirstOrDefaultAsync(s => s.BatchID == request.BatchID);
                if (invStock == null || invStock.CurrentQuantity < request.Quantity)
                    return BadRequest(new { Error = $"Kho chẵn không đủ tồn kho để chuyển (Hiện có: {invStock?.CurrentQuantity ?? 0})." });

                sourceBefore = invStock.CurrentQuantity;
                invStock.CurrentQuantity -= request.Quantity;
                sourceAfter = invStock.CurrentQuantity;
            }
            else
            {
                var deptStock = await _context.DepartmentStocks
                    .FirstOrDefaultAsync(s => s.DepartmentID == request.SourceDepartmentID && s.BatchID == request.BatchID);
                if (deptStock == null || deptStock.CurrentQuantity < request.Quantity)
                    return BadRequest(new { Error = $"Khoa nguồn không đủ tồn kho để chuyển (Hiện có: {deptStock?.CurrentQuantity ?? 0})." });

                sourceBefore = deptStock.CurrentQuantity;
                deptStock.CurrentQuantity -= request.Quantity;
                sourceAfter = deptStock.CurrentQuantity;
            }

            // 2. Cộng tồn kho đích
            var targetStock = await _context.DepartmentStocks
                .FirstOrDefaultAsync(s => s.DepartmentID == request.TargetDepartmentID && s.BatchID == request.BatchID);
            int targetBefore = targetStock?.CurrentQuantity ?? 0;
            if (targetStock == null)
            {
                targetStock = new DepartmentStock
                {
                    DepartmentID = request.TargetDepartmentID,
                    BatchID = request.BatchID,
                    CurrentQuantity = request.Quantity
                };
                _context.DepartmentStocks.Add(targetStock);
            }
            else
            {
                targetStock.CurrentQuantity += request.Quantity;
            }
            int targetAfter = targetStock.CurrentQuantity;

            // 3. Tạo bản ghi InternalTransfer để lưu vết chứng từ vận chuyển nội bộ
            var transfer = new InternalTransfer
            {
                FromDepartmentID = request.SourceDepartmentID,
                ToDepartmentID = request.TargetDepartmentID,
                TransferDate = DateTime.Now,
                DigitalSignature = request.DigitalSignature
            };
            transfer.Details.Add(new InternalTransferDetail
            {
                BatchID = request.BatchID,
                Quantity = request.Quantity
            });
            _context.InternalTransfers.Add(transfer);
            await _context.SaveChangesAsync();

            // 4. Ghi nhận InventoryMovements (Thẻ kho) cho cả 2 đầu
            _context.InventoryMovements.Add(new InventoryMovement
            {
                MedicineID = batch.MedicineID,
                BatchID = batch.BatchID,
                LocationType = request.SourceLocationType,
                DepartmentID = request.SourceDepartmentID,
                BeforeQuantity = sourceBefore,
                ChangeQuantity = -request.Quantity,
                AfterQuantity = sourceAfter,
                SourceType = "ShortDatedClearance",
                SourceID = transfer.TransferID,
                Action = "SUBTRACT",
                ByUser = userFullName,
                CreatedAt = DateTime.Now
            });

            _context.InventoryMovements.Add(new InventoryMovement
            {
                MedicineID = batch.MedicineID,
                BatchID = batch.BatchID,
                LocationType = "Cabinet",
                DepartmentID = request.TargetDepartmentID,
                BeforeQuantity = targetBefore,
                ChangeQuantity = request.Quantity,
                AfterQuantity = targetAfter,
                SourceType = "ShortDatedClearance",
                SourceID = transfer.TransferID,
                Action = "ADD",
                ByUser = userFullName,
                CreatedAt = DateTime.Now
            });

            // 5. Lưu hoặc cập nhật bản ghi ClearanceProposal
            var proposal = new ClearanceProposal
            {
                BatchID = request.BatchID,
                SourceLocationType = request.SourceLocationType,
                SourceDepartmentID = request.SourceDepartmentID,
                CurrentQuantity = sourceBefore,
                ProposedQuantity = request.Quantity,
                RecommendedAction = "InternalTransfer",
                TargetDepartmentID = request.TargetDepartmentID,
                Status = "Transferred",
                GeneratedTransferID = transfer.TransferID,
                Notes = request.Notes,
                CreatedBy = userFullName,
                CreatedAt = DateTime.Now,
                ResolvedAt = DateTime.Now,
                ResolvedBy = userFullName,
                ResolutionNotes = $"Đã điều chuyển thành công {request.Quantity} {batch.Medicine?.Unit} sang khoa đích.",
                DigitalSignature = request.DigitalSignature
            };
            _context.ClearanceProposals.Add(proposal);

            // 6. Ghi nhật ký AuditLog
            _context.AuditLogs.Add(new AuditLog
            {
                Username = userFullName,
                UserRole = userRole,
                Action = "CLEARANCE_TRANSFER",
                EntityName = "ClearanceProposal",
                EntityID = proposal.ClearanceID,
                BeforeData = $"From: {request.SourceLocationType} ({request.SourceDepartmentID}), Qty: {sourceBefore}",
                AfterData = $"To: Dept {request.TargetDepartmentID}, TransferredQty: {request.Quantity}, TransferID: {transfer.TransferID}",
                IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                Device = Request.Headers["User-Agent"].ToString(),
                CreatedAt = DateTime.Now
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            // Broadcast SignalR realtime updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Clearance");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Cabinets");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new
            {
                Message = $"Đã điều chuyển thành công {request.Quantity} {batch.Medicine?.Unit} sang khoa tiếp nhận.",
                TransferID = transfer.TransferID
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            return BadRequest(new { Error = ex.Message });
        }
    }

    /// <summary>
    /// Kích hoạt Biên bản Đổi trả / Đổi date mới với Nhà cung cấp
    /// </summary>
    public class VendorReturnRequest
    {
        public int BatchID { get; set; }
        public string SourceLocationType { get; set; } = "MainStore";
        public int? SourceDepartmentID { get; set; }
        public int? SupplierID { get; set; }
        public int Quantity { get; set; }
        public string ReturnReason { get; set; } = "Lô thuốc cận hạn sử dụng (< 90 ngày) theo cam kết hợp đồng thầu";
        public string? ContractNumber { get; set; }
        public string? DigitalSignature { get; set; }
        public string? ApproverName { get; set; }
        public string? Notes { get; set; }
    }

    [HttpPost("create-vendor-return")]
    public async Task<IActionResult> CreateVendorReturn([FromBody] VendorReturnRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Lãnh đạo mới có quyền lập biên bản đổi trả Nhà cung cấp." });

        var batch = await _context.Batches.Include(b => b.Medicine).FirstOrDefaultAsync(b => b.BatchID == request.BatchID);
        if (batch == null) return NotFound(new { Error = "Không tìm thấy lô thuốc." });

        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = request.ApproverName ?? "Thủ kho Dược";

        var proposal = new ClearanceProposal
        {
            BatchID = request.BatchID,
            SourceLocationType = request.SourceLocationType,
            SourceDepartmentID = request.SourceDepartmentID,
            CurrentQuantity = request.Quantity,
            ProposedQuantity = request.Quantity,
            RecommendedAction = "VendorReturn",
            SupplierID = request.SupplierID,
            Status = "VendorReturning",
            Notes = $"Hợp đồng số: {request.ContractNumber}. Lý do: {request.ReturnReason}. Ghi chú: {request.Notes}",
            CreatedBy = userFullName,
            CreatedAt = DateTime.Now,
            ResolvedAt = DateTime.Now,
            ResolvedBy = userFullName,
            ResolutionNotes = "Đã phát hành Biên bản đề nghị đổi date mới gửi Nhà cung cấp.",
            DigitalSignature = request.DigitalSignature
        };

        _context.ClearanceProposals.Add(proposal);

        // Chuyển trạng thái lô thuốc sang 'Trả NCC' để tránh việc khoa khác xuất nhầm
        batch.Status = "Trả NCC";

        await _context.SaveChangesAsync();

        // Broadcast SignalR
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Clearance");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

        return Ok(new
        {
            Message = "Đã tạo biên bản đề nghị đổi date Nhà cung cấp thành công.",
            ProposalID = proposal.ClearanceID
        });
    }

    /// <summary>
    /// Bỏ qua cảnh báo với lý do cụ thể (bác sĩ dự kiến có ca bệnh sử dụng, v.v.)
    /// </summary>
    public class DismissRequest
    {
        public int BatchID { get; set; }
        public string SourceLocationType { get; set; } = "MainStore";
        public int? SourceDepartmentID { get; set; }
        public string Reason { get; set; } = "Đã có kế hoạch sử dụng nội bộ";
    }

    [HttpPost("dismiss")]
    public async Task<IActionResult> DismissClearance([FromBody] DismissRequest request)
    {
        var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
        if (string.IsNullOrEmpty(userFullName)) userFullName = "Cán bộ quản lý";

        var proposal = new ClearanceProposal
        {
            BatchID = request.BatchID,
            SourceLocationType = request.SourceLocationType,
            SourceDepartmentID = request.SourceDepartmentID,
            CurrentQuantity = 0,
            ProposedQuantity = 0,
            RecommendedAction = "Dismiss",
            Status = "Dismissed",
            Notes = request.Reason,
            CreatedBy = userFullName,
            CreatedAt = DateTime.Now,
            ResolvedAt = DateTime.Now,
            ResolvedBy = userFullName,
            ResolutionNotes = $"Bỏ qua cảnh báo: {request.Reason}"
        };

        _context.ClearanceProposals.Add(proposal);
        await _context.SaveChangesAsync();

        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Clearance");

        return Ok(new { Message = "Đã ghi nhận lý do bỏ qua cảnh báo." });
    }

    /// <summary>
    /// Xem ma trận tiêu thụ chi tiết của một mặt hàng thuốc trên toàn bộ các khoa phòng
    /// </summary>
    [HttpGet("departments-matrix/{medicineId}")]
    public async Task<IActionResult> GetMedicineDepartmentMatrix(int medicineId)
    {
        var med = await _context.Medicines.FindAsync(medicineId);
        if (med == null) return NotFound();

        var departments = await _context.Departments.ToListAsync();
        var thirtyDaysAgo = DateTime.Today.AddDays(-30);

        var consumptions = await _context.CabinetTransactions
            .Where(t => t.TransactionDate >= thirtyDaysAgo && t.Batch!.MedicineID == medicineId)
            .GroupBy(t => t.DepartmentID)
            .Select(g => new
            {
                DepartmentID = g.Key,
                TotalUsed = g.Sum(x => x.Quantity)
            })
            .ToListAsync();

        var consumptionMap = consumptions.ToDictionary(c => c.DepartmentID, c => c.TotalUsed);

        var deptStocks = await _context.DepartmentStocks
            .Include(s => s.Batch)
            .Where(s => s.Batch!.MedicineID == medicineId && s.CurrentQuantity > 0)
            .GroupBy(s => s.DepartmentID)
            .Select(g => new
            {
                DepartmentID = g.Key,
                TotalStock = g.Sum(x => x.CurrentQuantity)
            })
            .ToListAsync();

        var stockMap = deptStocks.ToDictionary(s => s.DepartmentID, s => s.TotalStock);

        var matrix = departments.Select(d =>
        {
            int used = consumptionMap.TryGetValue(d.DepartmentID, out var u) ? u : 0;
            int stock = stockMap.TryGetValue(d.DepartmentID, out var s) ? s : 0;
            decimal adc = Math.Round((decimal)used / 30.0m, 2);
            decimal dos = adc > 0.001m ? Math.Round(stock / adc, 1) : 999m;

            return new
            {
                d.DepartmentID,
                d.DepartmentName,
                ThirtyDayUsage = used,
                ADC = adc,
                CurrentStock = stock,
                DaysOfSupply = dos
            };
        }).OrderByDescending(x => x.ThirtyDayUsage).ToList();

        return Ok(new
        {
            Medicine = med,
            Departments = matrix
        });
    }
}
