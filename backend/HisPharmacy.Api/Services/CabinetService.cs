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
    public async Task<CabinetTransaction> ExportFromCabinetAsync(int departmentID, int batchID, string patientCode, string patientName, int quantity)
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

            if (stock.Batch != null && stock.Batch.Status != "Bình thường")
            {
                throw new InvalidOperationException($"Lô thuốc {stock.Batch.BatchNumber} đang bị đình chỉ hoặc thu hồi (Trạng thái: {stock.Batch.Status}). Không thể cấp phát cho bệnh nhân!");
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
                RequisitionID = null
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

    // Luồng 3: Tổng hợp và Đề nghị bù tủ trực (Gom phiếu xuất tủ trực chưa bù để tạo Requisition)
    public async Task<MedicineRequisition?> CreateRefillRequisitionAsync(
        int departmentID, 
        string? digitalSignature = null, 
        List<int>? selectedMedicineIds = null)
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

            // Group by Medicine ID to calculate total required quantity for each item
            var refillItems = pendingTxs
                .GroupBy(t => t.Batch!.MedicineID)
                .Select(g => new
                {
                    MedicineID = g.Key,
                    TotalQuantity = g.Sum(t => t.Quantity)
                })
                .ToList();

            // Create a new Requisition of type 'CabinetRefill'
            var requisition = new MedicineRequisition
            {
                DepartmentID = departmentID,
                RequisitionDate = DateTime.Now,
                RequisitionType = "CabinetRefill",
                Status = "Pending",
                DigitalSignature = digitalSignature
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
