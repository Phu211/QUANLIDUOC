using HisPharmacy.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Services;

public class StockService
{
    private readonly HisDbContext _context;

    public StockService(HisDbContext context)
    {
        _context = context;
    }

    // Luồng 2: Duyệt phiếu dự trù & Cấp phát thường quy (FEFO)
    public async Task ApproveRequisitionAsync(
        int requisitionID, 
        string? approverSignature, 
        List<RequisitionDetailApprovalDto>? customQuantities = null)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var req = await _context.MedicineRequisitions
                .Include(r => r.Details)
                .FirstOrDefaultAsync(r => r.RequisitionID == requisitionID);

            if (req == null)
                throw new KeyNotFoundException("Không tìm thấy phiếu dự trù.");

            if (req.Status != "Pending")
                throw new InvalidOperationException("Phiếu dự trù đã được phê duyệt hoặc từ chối trước đó.");

            // Save approver signature
            req.ApproverSignature = approverSignature;

            // Create Internal Transfer record
            var transfer = new InternalTransfer
            {
                FromDepartmentID = null, // From Main Store
                ToDepartmentID = req.DepartmentID,
                TransferDate = DateTime.Now,
                DigitalSignature = approverSignature, // Link signature to transfer log
                RequisitionID = requisitionID // Link requisition
            };
            _context.InternalTransfers.Add(transfer);

            foreach (var detail in req.Details)
            {
                // Determine dispensed quantity (default to requested if not customized)
                int dispensedQty = detail.RequestedQuantity;
                if (customQuantities != null)
                {
                    var customItem = customQuantities.FirstOrDefault(c => c.RequisitionDetailID == detail.RequisitionDetailID);
                    if (customItem != null)
                    {
                        dispensedQty = customItem.DispensedQuantity;
                    }
                }

                detail.DispensedQuantity = dispensedQty;

                if (dispensedQty <= 0)
                {
                    // If pharmacist dispensed 0, skip allocation for this item
                    continue;
                }

                int remainingToAllocate = dispensedQty;

                // Find active batches in main store, sort by ExpiryDate ascending (FEFO)
                var availableStocks = await _context.InventoryStocks
                    .Include(s => s.Batch)
                    .Where(s => s.Batch!.MedicineID == detail.MedicineID && 
                                s.CurrentQuantity > 0 && 
                                s.Batch.ExpiryDate > DateTime.Today)
                    .OrderBy(s => s.Batch!.ExpiryDate)
                    .ToListAsync();

                int totalAvailable = availableStocks.Sum(s => s.CurrentQuantity);
                if (totalAvailable < remainingToAllocate)
                {
                    var medName = await _context.Medicines
                        .Where(m => m.MedicineID == detail.MedicineID)
                        .Select(m => m.MedicineName)
                        .FirstOrDefaultAsync();
                    throw new InvalidOperationException(
                        $"Kho chính không đủ tồn kho để cấp phát [{medName ?? "ID: " + detail.MedicineID}]. Yêu cầu cấp: {dispensedQty}, Hiện có: {totalAvailable}");
                }

                foreach (var stock in availableStocks)
                {
                    if (remainingToAllocate <= 0) break;

                    int take = Math.Min(stock.CurrentQuantity, remainingToAllocate);
                    stock.CurrentQuantity -= take;
                    remainingToAllocate -= take;

                    // Log in Transfer details
                    transfer.Details.Add(new InternalTransferDetail
                    {
                        BatchID = stock.BatchID,
                        Quantity = take
                    });

                    // Add/update to Department Cabinet stock
                    var deptStock = await _context.DepartmentStocks
                        .FirstOrDefaultAsync(ds => ds.DepartmentID == req.DepartmentID && ds.BatchID == stock.BatchID);

                    if (deptStock != null)
                    {
                        deptStock.CurrentQuantity += take;
                    }
                    else
                    {
                        _context.DepartmentStocks.Add(new DepartmentStock
                        {
                            DepartmentID = req.DepartmentID,
                            BatchID = stock.BatchID,
                            CurrentQuantity = take
                        });
                    }
                }
            }

            req.Status = "Approved";
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Luồng 4.1: Thủ kho Dược kiểm nhận và thực nhận hoàn trả thuốc thừa (trừ kho lẻ khoa phòng, cộng kho chẵn chính)
    public async Task PharmacistApproveReturnAsync(int returnID, string? approverSignature = null)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var ret = await _context.ReturnReceipts
                .Include(r => r.Details)
                .FirstOrDefaultAsync(r => r.ReturnID == returnID);

            if (ret == null)
                throw new KeyNotFoundException("Không tìm thấy phiếu hoàn trả.");

            if (ret.Status != "Pending")
                throw new InvalidOperationException("Phiếu hoàn trả đã được xử lý hoặc đang chờ duyệt ở bước tiếp theo.");

            foreach (var detail in ret.Details)
            {
                // Verify department actually had that batch, and subtract from department stock
                var deptStock = await _context.DepartmentStocks
                    .FirstOrDefaultAsync(ds => ds.DepartmentID == ret.DepartmentID && ds.BatchID == detail.BatchID);

                if (deptStock == null || deptStock.CurrentQuantity < detail.Quantity)
                {
                    throw new InvalidOperationException(
                        $"Số lượng hoàn trả vượt quá tồn kho thực tế của khoa phòng tại lô [ID: {detail.BatchID}].");
                }

                deptStock.CurrentQuantity -= detail.Quantity;

                // Return back to main store InventoryStocks
                var invStock = await _context.InventoryStocks
                    .FirstOrDefaultAsync(s => s.BatchID == detail.BatchID);

                if (invStock != null)
                {
                    invStock.CurrentQuantity += detail.Quantity;
                }
                else
                {
                    _context.InventoryStocks.Add(new InventoryStock
                    {
                        BatchID = detail.BatchID,
                        CurrentQuantity = detail.Quantity
                    });
                }
            }

            ret.Status = "PendingLeader"; // Chờ Trưởng Khoa / Lãnh đạo ký duyệt tối cao
            if (!string.IsNullOrEmpty(approverSignature))
            {
                ret.ApproverSignature = approverSignature;
            }
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Luồng 4.2: Trưởng Khoa / Lãnh đạo phê duyệt hành chính tối cao và ký đóng dấu đỏ biên bản hoàn trả
    public async Task LeaderApproveReturnAsync(int returnID, string? directorSignature = null)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var ret = await _context.ReturnReceipts
                .FirstOrDefaultAsync(r => r.ReturnID == returnID);

            if (ret == null)
                throw new KeyNotFoundException("Không tìm thấy phiếu hoàn trả.");

            if (ret.Status != "PendingLeader")
                throw new InvalidOperationException("Phiếu hoàn trả chưa được thủ kho tiếp nhận hoặc đã được phê duyệt tối cao trước đó.");

            ret.Status = "Approved"; // Hoàn thành quy trình hoàn trả 3 bước
            if (!string.IsNullOrEmpty(directorSignature))
            {
                ret.DirectorSignature = directorSignature;
            }
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Luồng 1: Nhập kho chẵn và Kiểm nhập
    public async Task<ImportReceipt> CreateImportAsync(
        int supplierID, 
        string? contractNumber, 
        string? invoiceNumber, 
        string createdBy, 
        string? notes, 
        string status, 
        DateTime? invoiceDate,
        string? deliveryNoteNumber,
        string? secondInspector,
        string? anomalyDescription,
        string? documentsJson,
        string? digitalSignature,
        string? secondInspectorSignature,
        string? deliveryPersonSignature,
        List<ImportItemDto> items)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // Tự động sinh Số phiếu nhập nội bộ quy chuẩn: PNK-YYYYMMDD-XXXX
            var todayStr = DateTime.Today.ToString("yyyyMMdd");
            var prefix = $"PNK-{todayStr}-";
            
            // Tìm số phiếu có số thứ tự lớn nhất trong ngày để tăng dần, tránh trùng khóa khi có phiếu bị xóa
            var maxCode = await _context.ImportReceipts
                .Where(r => r.ImportCode.StartsWith(prefix))
                .Select(r => r.ImportCode)
                .OrderByDescending(c => c)
                .FirstOrDefaultAsync();

            int nextNum = 1;
            if (maxCode != null && maxCode.Length > prefix.Length)
            {
                var suffix = maxCode.Substring(prefix.Length);
                if (int.TryParse(suffix, out int parsedNum))
                {
                    nextNum = parsedNum + 1;
                }
            }

            var sequence = nextNum.ToString().PadLeft(4, '0');
            var importCode = $"{prefix}{sequence}";

            var supplierObj = await _context.Suppliers.FindAsync(supplierID);
            var officialContractNumber = supplierObj?.ContractNumber ?? contractNumber;

            var import = new ImportReceipt
            {
                ImportCode = importCode,
                ContractNumber = officialContractNumber, // Lấy số hợp đồng thầu cố định của nhà cung cấp
                InvoiceNumber = invoiceNumber,
                SupplierID = supplierID,
                ImportDate = DateTime.Now,
                CreatedBy = string.IsNullOrWhiteSpace(createdBy) ? "Thủ kho Dược" : createdBy,
                Notes = notes,
                Status = string.IsNullOrWhiteSpace(status) ? "Đã kiểm" : status,
                InvoiceDate = invoiceDate,
                DeliveryNoteNumber = deliveryNoteNumber,
                SecondInspector = secondInspector,
                AnomalyDescription = anomalyDescription,
                DocumentsJson = documentsJson,
                DigitalSignature = digitalSignature,
                SecondInspectorSignature = secondInspectorSignature,
                DeliveryPersonSignature = deliveryPersonSignature
            };
            _context.ImportReceipts.Add(import);

            foreach (var item in items)
            {
                // Create a new batch entry for this medicine shipment
                var batch = new Batch
                {
                    MedicineID = item.MedicineID,
                    BatchNumber = item.BatchNumber,
                    ProductionDate = item.ProductionDate, // Ghi nhận Ngày sản xuất
                    ExpiryDate = item.ExpiryDate,
                    ImportPrice = item.ImportPrice,
                    QuantityOriginal = item.Quantity
                };
                _context.Batches.Add(batch);
                await _context.SaveChangesAsync(); // Generates BatchID

                // Register import receipt detail
                import.Details.Add(new ImportReceiptDetail
                {
                    BatchID = batch.BatchID,
                    Quantity = item.Quantity
                });
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return import;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Phương thức phê duyệt kiểm nhập phiếu nhập kho (chuyển trạng thái sang Đã nhập kho)
    public async Task ApproveImportReceiptAsync(int importID, string? approverSignature = null)
    {
        var import = await _context.ImportReceipts.FindAsync(importID);
        if (import == null)
            throw new KeyNotFoundException("Không tìm thấy phiếu nhập kho cần phê duyệt.");

        if (import.Status == "Đã nhập kho" || import.Status == "Từ chối")
            return; // Đã xử lý xong

        import.Status = "Đã nhập kho";
        if (!string.IsNullOrWhiteSpace(approverSignature))
        {
            import.ApproverSignature = approverSignature;
        }
        await _context.SaveChangesAsync();
    }

    // Luồng 1.2: Hoàn tất kiểm nhận cảm quan thực tế cho phiếu đã Tiếp nhận (Chờ kiểm nhập)
    public async Task<ImportReceipt> CompleteInspectionAsync(
        int importID,
        string? secondInspector,
        string? anomalyDescription,
        string? status,
        string? documentsJson,
        string? digitalSignature,
        string? secondInspectorSignature,
        string? deliveryPersonSignature,
        List<ImportItemDto> items)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var import = await _context.ImportReceipts
                .Include(i => i.Details)
                .FirstOrDefaultAsync(i => i.ImportID == importID);

            if (import == null)
                throw new KeyNotFoundException("Không tìm thấy phiếu nhập kho.");

            if (import.Status != "Chờ kiểm nhập" && import.Status != "Đang kiểm")
                throw new InvalidOperationException("Phiếu nhập kho này đã được kiểm nhận trước đó.");

            import.SecondInspector = secondInspector;
            import.AnomalyDescription = anomalyDescription;
            import.Status = string.IsNullOrWhiteSpace(status) ? "Đạt kiểm nhập" : status;

            if (!string.IsNullOrWhiteSpace(digitalSignature))
            {
                import.DigitalSignature = digitalSignature;
            }
            if (!string.IsNullOrWhiteSpace(secondInspectorSignature))
            {
                import.SecondInspectorSignature = secondInspectorSignature;
            }
            if (!string.IsNullOrWhiteSpace(deliveryPersonSignature))
            {
                import.DeliveryPersonSignature = deliveryPersonSignature;
            }

            if (!string.IsNullOrWhiteSpace(documentsJson))
            {
                import.DocumentsJson = documentsJson;
            }

            foreach (var item in items)
            {
                // Create a new batch entry
                var batch = new Batch
                {
                    MedicineID = item.MedicineID,
                    BatchNumber = item.BatchNumber,
                    ProductionDate = item.ProductionDate,
                    ExpiryDate = item.ExpiryDate,
                    ImportPrice = item.ImportPrice,
                    QuantityOriginal = item.Quantity
                };
                _context.Batches.Add(batch);
                await _context.SaveChangesAsync(); // Generates BatchID

                // Register import receipt detail
                import.Details.Add(new ImportReceiptDetail
                {
                    BatchID = batch.BatchID,
                    Quantity = item.Quantity
                });
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return import;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}

public class ImportItemDto
{
    public int MedicineID { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public DateTime? ProductionDate { get; set; } // Ngày sản xuất
    public DateTime ExpiryDate { get; set; }
    public decimal ImportPrice { get; set; }
    public int Quantity { get; set; }
}

public class RequisitionDetailApprovalDto
{
    public int RequisitionDetailID { get; set; }
    public int DispensedQuantity { get; set; }
}
