using HisPharmacy.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Services;

public class CabinetService
{
    private readonly HisDbContext _context;

    public CabinetService(HisDbContext context)
    {
        _context = context;
    }

    // Luồng 3: Xuất thuốc tủ trực cho Bệnh nhân
    public async Task<CabinetTransaction> ExportFromCabinetAsync(int departmentID, int batchID, string patientCode, string patientName, int quantity, string? dispensedBy = null)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Find stock card in the department cabinet
            var stock = await _context.DepartmentStocks
                .Include(ds => ds.Batch)
                .FirstOrDefaultAsync(ds => ds.DepartmentID == departmentID && ds.BatchID == batchID);

            if (stock == null || stock.CurrentQuantity < quantity)
            {
                throw new InvalidOperationException("Số lượng tồn trong tủ trực tại khoa phòng không đủ để xuất phát.");
            }

            if (stock.Batch != null && stock.Batch.Status != "Bình thường" && stock.Batch.Status != "Đang sử dụng")
            {
                throw new InvalidOperationException($"Lô thuốc {stock.Batch.BatchNumber} đang bị đình chỉ hoặc thu hồi (Trạng thái: {stock.Batch.Status}). Không thể cấp phát cho bệnh nhân!");
            }

            if (stock.Batch != null && stock.Batch.ExpiryDate.Date <= DateTime.Today.Date)
            {
                throw new InvalidOperationException($"Lô thuốc {stock.Batch.BatchNumber} đã hết hạn sử dụng (Hạn dùng: {stock.Batch.ExpiryDate:dd/MM/yyyy}). Không thể cấp phát cho bệnh nhân!");
            }

            // Subtract cabinet stock
            stock.CurrentQuantity -= quantity;

            // Log cabinet transaction
            var cabTx = new CabinetTransaction
            {
                DepartmentID = departmentID,
                BatchID = batchID,
                PatientCode = patientCode,
                PatientName = patientName,
                Quantity = quantity,
                TransactionDate = DateTime.Now,
                IsRefilled = false,
                RequisitionID = null,
                DispensedBy = dispensedBy
            };

            _context.CabinetTransactions.Add(cabTx);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return cabTx;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Luồng 2b: Xuất nhiều loại thuốc từ tủ trực cấp phát cho bệnh nhân
    public async Task<List<CabinetTransaction>> ExportMultipleFromCabinetAsync(int departmentID, string patientCode, string patientName, List<CabinetExportItem> items, string? dispensedBy = null)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var transactions = new List<CabinetTransaction>();

            foreach (var item in items)
            {
                // Find stock card in the department cabinet
                var stock = await _context.DepartmentStocks
                    .Include(ds => ds.Batch)
                    .FirstOrDefaultAsync(ds => ds.DepartmentID == departmentID && ds.BatchID == item.BatchID);

                if (stock == null || stock.CurrentQuantity < item.Quantity)
                {
                    throw new InvalidOperationException($"Số lượng tồn trong tủ trực tại khoa phòng không đủ để xuất phát.");
                }

                if (stock.Batch != null && stock.Batch.Status != "Bình thường" && stock.Batch.Status != "Đang sử dụng")
                {
                    throw new InvalidOperationException($"Lô thuốc {stock.Batch.BatchNumber} đang bị đình chỉ hoặc thu hồi (Trạng thái: {stock.Batch.Status}). Không thể cấp phát cho bệnh nhân!");
                }

                if (stock.Batch != null && stock.Batch.ExpiryDate.Date <= DateTime.Today.Date)
                {
                    throw new InvalidOperationException($"Lô thuốc {stock.Batch.BatchNumber} đã hết hạn sử dụng (Hạn dùng: {stock.Batch.ExpiryDate:dd/MM/yyyy}). Không thể cấp phát cho bệnh nhân!");
                }

                // Subtract cabinet stock
                stock.CurrentQuantity -= item.Quantity;

                // Log cabinet transaction
                var cabTx = new CabinetTransaction
                {
                    DepartmentID = departmentID,
                    BatchID = item.BatchID,
                    PatientCode = patientCode,
                    PatientName = patientName,
                    Quantity = item.Quantity,
                    TransactionDate = DateTime.Now,
                    IsRefilled = false,
                    RequisitionID = null,
                    DispensedBy = dispensedBy
                };

                _context.CabinetTransactions.Add(cabTx);
                transactions.Add(cabTx);
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return transactions;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Luồng 3: Tổng hợp và Đề nghị bù tủ trực (Gom phiếu xuất tủ trực chưa bù để tạo Requisition)
    public async Task<MedicineRequisition?> CreateRefillRequisitionAsync(
        int departmentID, 
        string? digitalSignature = null, 
        List<int>? selectedMedicineIds = null,
        string? userRole = null,
        string? proposerName = null)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Find all pending cabinet transactions that are not refilled, OR whose refill requisition was rejected
            var query = _context.CabinetTransactions
                .Include(t => t.Batch)
                .Include(t => t.Requisition)
                .Where(t => t.DepartmentID == departmentID && 
                            (t.RequisitionID == null || t.Requisition!.Status == "Rejected"));

            if (selectedMedicineIds != null && selectedMedicineIds.Any())
            {
                query = query.Where(t => selectedMedicineIds.Contains(t.Batch!.MedicineID));
            }

            var pendingTxs = await query.ToListAsync();

            if (!pendingTxs.Any())
                return null; // Nothing to refill

            // Ensure current accounting period is not locked
            await AccountingPeriodHelper.EnsurePeriodNotLockedAsync(_context, DateTime.Today);

            // Group by Medicine ID to calculate total required quantity for each item
            var refillItems = pendingTxs
                .GroupBy(t => t.Batch!.MedicineID)
                .Select(g => new
                {
                    MedicineID = g.Key,
                    TotalQuantity = g.Sum(t => t.Quantity)
                })
                .ToList();

            // Strict Clinical Check: Prohibit automated cabinet refill for Narcotic / Psychotropic drugs without specific patient code
            foreach (var item in refillItems)
            {
                var med = await _context.Medicines.FindAsync(item.MedicineID);
                if (med != null && med.DrugClassification == "NarcoticPsychotropic")
                {
                    var unassignedTxs = pendingTxs
                        .Where(t => t.Batch!.MedicineID == item.MedicineID && string.IsNullOrWhiteSpace(t.PatientCode))
                        .ToList();

                    if (unassignedTxs.Any())
                    {
                        throw new InvalidOperationException($"Dược phẩm '{med.MedicineName}' thuộc nhóm Hướng thần / Gây nghiện (Kiểm soát đặc biệt). Cấm cấp phát bù tự động vào cơ số tủ trực nếu không có chỉ định đích danh bệnh nhân (Theo Thông tư 20/2017/TT-BYT). Vui lòng lập phiếu dự trù đích danh theo hồ sơ bệnh án.");
                    }
                }
            }

            // Create a new Requisition of type 'CabinetRefill'
            var requisition = new MedicineRequisition
            {
                DepartmentID = departmentID,
                RequisitionDate = DateTime.Now,
                RequisitionType = "CabinetRefill",
                Status = userRole == "head" ? "Pending" : "PendingHead",
                DigitalSignature = digitalSignature,
                HeadSignature = userRole == "head" ? digitalSignature : null,
                HeadApproveDate = userRole == "head" ? DateTime.Now : null,
                ProposerName = proposerName
            };
            _context.MedicineRequisitions.Add(requisition);
            await _context.SaveChangesAsync(); // Generates RequisitionID

            // Create requisition details
            foreach (var item in refillItems)
            {
                requisition.Details.Add(new MedicineRequisitionDetail
                {
                    MedicineID = item.MedicineID,
                    RequestedQuantity = item.TotalQuantity
                });
            }

            // Update transactions: mark as refilled and associate with this requisition
            foreach (var tx in pendingTxs)
            {
                tx.IsRefilled = true;
                tx.RequisitionID = requisition.RequisitionID;
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return requisition;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}

public class CabinetExportItem
{
    public int BatchID { get; set; }
    public int Quantity { get; set; }
}
