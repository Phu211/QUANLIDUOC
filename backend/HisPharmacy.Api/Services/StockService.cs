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
        List<RequisitionDetailApprovalDto>? customQuantities = null,
        string? deliveryBy = null,
        string? deliveryPhone = null)
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

            // Save approver and delivery details
            req.ApproverSignature = approverSignature;
            req.DeliveryBy = deliveryBy;
            req.DeliveryPhone = deliveryPhone;
            req.DeliveredAt = DateTime.Now;
            req.SlaMinutes = req.RequisitionType == "Urgent" ? 15 : 120;

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
                // Filter out Locked batches (Status must be "Bình thường")
                var availableStocks = await _context.InventoryStocks
                    .Include(s => s.Batch)
                    .Where(s => s.Batch!.MedicineID == detail.MedicineID && 
                                s.CurrentQuantity > 0 && 
                                s.Batch.ExpiryDate > DateTime.Today &&
                                s.Batch.Status == "Bình thường")
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
                        $"Kho chính không đủ tồn kho khả dụng để cấp phát [{medName ?? "ID: " + detail.MedicineID}]. Yêu cầu cấp: {dispensedQty}, Hiện có: {totalAvailable}");
                }

                foreach (var stock in availableStocks)
                {
                    if (remainingToAllocate <= 0) break;

                    int take = Math.Min(stock.CurrentQuantity, remainingToAllocate);
                    
                    // Reserved Stock: Deduct CurrentQuantity and Add to ReservedQuantity
                    int qtyBefore = stock.CurrentQuantity;
                    stock.CurrentQuantity -= take;
                    stock.ReservedQuantity += take;
                    remainingToAllocate -= take;

                    // Log in Transfer details
                    transfer.Details.Add(new InternalTransferDetail
                    {
                        BatchID = stock.BatchID,
                        Quantity = take
                    });

                    // Write to InventoryMovements audit trail
                    _context.InventoryMovements.Add(new InventoryMovement
                    {
                        MedicineID = detail.MedicineID,
                        BatchID = stock.BatchID,
                        LocationType = "MainStore",
                        DepartmentID = null,
                        BeforeQuantity = qtyBefore,
                        ChangeQuantity = -take,
                        AfterQuantity = stock.CurrentQuantity,
                        SourceType = "Requisition",
                        SourceID = requisitionID,
                        Action = "SUBTRACT_RESERVE",
                        ByUser = "Thủ kho Dược",
                        CreatedAt = DateTime.Now
                    });
                }
            }

            req.Status = "InTransit"; // Đang vận chuyển
            req.DispenseDate = DateTime.Now;

            // Log User Action to AuditLogs
            _context.AuditLogs.Add(new AuditLog
            {
                Username = "pharmacist",
                UserRole = "pharmacist",
                Action = "APPROVE_REQUISITION",
                EntityName = "MedicineRequisition",
                EntityID = requisitionID,
                BeforeData = "Status: Pending",
                AfterData = $"Status: InTransit, DeliveryBy: {deliveryBy}",
                IPAddress = "127.0.0.1",
                Device = "System Backend",
                CreatedAt = DateTime.Now
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    // Luồng 4.1: Lãnh đạo duyệt đề xuất trước (chưa cập nhật tồn kho)
    public async Task LeaderApproveReturnAsync(int returnID, string? directorSignature = null)
    {
        var ret = await _context.ReturnReceipts
            .FirstOrDefaultAsync(r => r.ReturnID == returnID);

        if (ret == null)
            throw new KeyNotFoundException("Không tìm thấy phiếu hoàn trả.");

        if (ret.Status != "Pending")
            throw new InvalidOperationException("Phiếu hoàn trả không ở trạng thái chờ Lãnh đạo phê duyệt.");

        ret.Status = "PendingPharmacist"; // Chờ thủ kho Dược kiểm nhận thực tế và ký nhận cuối cùng
        if (!string.IsNullOrEmpty(directorSignature))
        {
            ret.DirectorSignature = directorSignature;
        }
        await _context.SaveChangesAsync();
    }

    // Luồng 4.2: Thủ kho Dược kiểm nhận thực tế thuốc hoàn trả, cập nhật tồn kho và ký nhận cuối cùng
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

            if (ret.Status != "PendingPharmacist")
                throw new InvalidOperationException("Phiếu hoàn trả chưa được Lãnh đạo phê duyệt hoặc đã được xử lý trước đó.");

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

            ret.Status = "Approved"; // Hoàn thành quy trình, Thủ kho ký cuối cùng
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
                if (item.ImportPrice < 0)
                {
                    throw new ArgumentException("Đơn giá nhập không được là số âm.");
                }
                if (item.Quantity <= 0)
                {
                    throw new ArgumentException("Số lượng nhập phải lớn hơn 0.");
                }

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

    // Luồng 1.3: Điều chỉnh phiếu nhập kho khi chưa ký duyệt
    public async Task<ImportReceipt> UpdateImportReceiptAsync(int importID, UpdateImportRequestDto request)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var import = await _context.ImportReceipts
                .Include(i => i.Details)!
                .ThenInclude(d => d.Batch)
                .FirstOrDefaultAsync(i => i.ImportID == importID);

            if (import == null)
                throw new KeyNotFoundException("Không tìm thấy phiếu nhập kho cần điều chỉnh.");

            // Kiểm tra bảo mật: Chỉ cho phép điều chỉnh khi phiếu ở trạng thái Chờ kiểm nhập (Nháp)
            if (import.Status != "Chờ kiểm nhập" && import.Status != "Pending")
                throw new InvalidOperationException("Phiếu đã hoàn tất kiểm nhận và đang chờ duyệt hoặc đã hoàn thành, không được phép điều chỉnh.");

            // --- Ghi nhận lịch sử điều chỉnh ---
            var changes = new List<string>();

            if (import.SupplierID != request.SupplierID)
            {
                var oldSup = await _context.Suppliers.FindAsync(import.SupplierID);
                var newSup = await _context.Suppliers.FindAsync(request.SupplierID);
                changes.Add($"Thay đổi Nhà cung cấp từ '{oldSup?.SupplierName ?? "N/A"}' thành '{newSup?.SupplierName ?? "N/A"}'");
            }

            if (import.InvoiceNumber != request.InvoiceNumber)
                changes.Add($"Thay đổi Số hóa đơn từ '{import.InvoiceNumber ?? "N/A"}' thành '{request.InvoiceNumber ?? "N/A"}'");

            if (import.InvoiceDate != request.InvoiceDate)
                changes.Add($"Thay đổi Ngày hóa đơn từ '{(import.InvoiceDate?.ToString("dd/MM/yyyy") ?? "N/A")}' thành '{(request.InvoiceDate?.ToString("dd/MM/yyyy") ?? "N/A")}'");

            if (import.DeliveryNoteNumber != request.DeliveryNoteNumber)
                changes.Add($"Thay đổi Số phiếu xuất kho từ '{import.DeliveryNoteNumber ?? "N/A"}' thành '{request.DeliveryNoteNumber ?? "N/A"}'");

            if (import.ContractNumber != request.ContractNumber)
                changes.Add($"Thay đổi Số hợp đồng từ '{import.ContractNumber ?? "N/A"}' thành '{request.ContractNumber ?? "N/A"}'");

            if (import.Notes != request.Notes)
                changes.Add("Cập nhật ghi chú của phiếu");

            if (import.DocumentsJson != request.DocumentsJson)
                changes.Add("Cập nhật tài liệu/hình ảnh chứng từ đính kèm");

            // So sánh danh sách thuốc nhập
            var currentDetails = import.Details?.ToList() ?? new List<ImportReceiptDetail>();
            var requestItems = request.Items ?? new List<ImportItemDto>();

            foreach (var detail in currentDetails)
            {
                if (detail.Batch != null)
                {
                    var medicine = await _context.Medicines.FindAsync(detail.Batch.MedicineID);
                    var medName = medicine?.MedicineName ?? "Thuốc";
                    var matchingItem = requestItems.FirstOrDefault(ri => ri.MedicineID == detail.Batch.MedicineID && ri.BatchNumber == detail.Batch.BatchNumber);

                    if (matchingItem == null)
                    {
                        changes.Add($"Xóa mặt hàng '{medName}' (Số lô: {detail.Batch.BatchNumber})");
                    }
                    else
                    {
                        if (detail.Quantity != matchingItem.Quantity)
                            changes.Add($"Thay đổi Số lượng của '{medName}' (Lô: {detail.Batch.BatchNumber}) từ {detail.Quantity} thành {matchingItem.Quantity}");
                        if (detail.Batch.ImportPrice != matchingItem.ImportPrice)
                            changes.Add($"Thay đổi Đơn giá của '{medName}' (Lô: {detail.Batch.BatchNumber}) từ {detail.Batch.ImportPrice:N0}đ thành {matchingItem.ImportPrice:N0}đ");
                        if (detail.Batch.ExpiryDate.Date != matchingItem.ExpiryDate.Date)
                            changes.Add($"Thay đổi Hạn dùng của '{medName}' (Lô: {detail.Batch.BatchNumber}) từ {detail.Batch.ExpiryDate:dd/MM/yyyy} thành {matchingItem.ExpiryDate:dd/MM/yyyy}");
                    }
                }
            }

            foreach (var item in requestItems)
            {
                var alreadyExists = currentDetails.Any(d => d.Batch != null && d.Batch.MedicineID == item.MedicineID && d.Batch.BatchNumber == item.BatchNumber);
                if (!alreadyExists)
                {
                    var medicine = await _context.Medicines.FindAsync(item.MedicineID);
                    var medName = medicine?.MedicineName ?? "Thuốc mới";
                    changes.Add($"Thêm mặt hàng '{medName}' (Lô: {item.BatchNumber}, SL: {item.Quantity}, Giá: {item.ImportPrice:N0}đ)");
                }
            }

            if (changes.Any())
            {
                var historyList = new List<object>();
                if (!string.IsNullOrEmpty(import.EditHistoryJson))
                {
                    try
                    {
                        var existing = System.Text.Json.JsonSerializer.Deserialize<List<object>>(import.EditHistoryJson);
                        if (existing != null) historyList.AddRange(existing);
                    }
                    catch { }
                }

                historyList.Add(new
                {
                    Timestamp = DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss"),
                    ActionBy = request.CreatedBy ?? "Thủ kho Dược",
                    Details = changes
                });

                import.EditHistoryJson = System.Text.Json.JsonSerializer.Serialize(historyList);
            }

            // Cập nhật thông tin phiếu nhập
            import.SupplierID = request.SupplierID;
            import.InvoiceNumber = request.InvoiceNumber;
            import.InvoiceDate = request.InvoiceDate;
            import.DeliveryNoteNumber = request.DeliveryNoteNumber;
            import.Notes = request.Notes;
            import.CreatedBy = string.IsNullOrWhiteSpace(request.CreatedBy) ? import.CreatedBy : request.CreatedBy;
            
            if (!string.IsNullOrEmpty(request.ContractNumber))
                import.ContractNumber = request.ContractNumber;
            
            if (!string.IsNullOrEmpty(request.SecondInspector))
                import.SecondInspector = request.SecondInspector;
            
            if (!string.IsNullOrEmpty(request.AnomalyDescription))
                import.AnomalyDescription = request.AnomalyDescription;
            
            if (!string.IsNullOrEmpty(request.DocumentsJson))
                import.DocumentsJson = request.DocumentsJson;

            if (!string.IsNullOrEmpty(request.DigitalSignature))
                import.DigitalSignature = request.DigitalSignature;

            if (!string.IsNullOrEmpty(request.SecondInspectorSignature))
                import.SecondInspectorSignature = request.SecondInspectorSignature;

            if (!string.IsNullOrEmpty(request.DeliveryPersonSignature))
                import.DeliveryPersonSignature = request.DeliveryPersonSignature;

            if (!string.IsNullOrEmpty(request.Status))
                import.Status = request.Status;

            // Xóa các chi tiết phiếu nhập cũ và lô cũ (vì chưa vào kho chính thức nên xóa an toàn)
            if (import.Details != null && import.Details.Any())
            {
                foreach (var detail in import.Details)
                {
                    if (detail.Batch != null)
                    {
                        // Kiểm tra an toàn phòng trường hợp có tồn kho trong InventoryStocks
                        var invStock = await _context.InventoryStocks.FirstOrDefaultAsync(s => s.BatchID == detail.BatchID);
                        if (invStock != null)
                        {
                            _context.InventoryStocks.Remove(invStock);
                        }
                        _context.Batches.Remove(detail.Batch);
                    }
                    _context.ImportReceiptDetails.Remove(detail);
                }
                import.Details.Clear();
            }

            // Thêm mới các mặt hàng và lô thuốc điều chỉnh
            foreach (var item in request.Items)
            {
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
                await _context.SaveChangesAsync(); // Sinh BatchID

                import.Details.Add(new ImportReceiptDetail
                {
                    BatchID = batch.BatchID,
                    Quantity = item.Quantity
                });
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            // Trả về đối tượng phiếu nhập đầy đủ thông tin sau khi cập nhật
            return await _context.ImportReceipts
                .Include(i => i.Supplier)
                .Include(i => i.Details)!.ThenInclude(d => d.Batch)!.ThenInclude(b => b!.Medicine)
                .FirstOrDefaultAsync(i => i.ImportID == import.ImportID);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}

public class UpdateImportRequestDto
{
    public int SupplierID { get; set; }
    public string? ContractNumber { get; set; }
    public string? InvoiceNumber { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string Status { get; set; } = "Đạt kiểm nhập";
    public DateTime? InvoiceDate { get; set; }
    public string? DeliveryNoteNumber { get; set; }
    public string? SecondInspector { get; set; }
    public string? AnomalyDescription { get; set; }
    public string? DocumentsJson { get; set; }
    public string? DigitalSignature { get; set; }
    public string? SecondInspectorSignature { get; set; }
    public string? DeliveryPersonSignature { get; set; }
    public List<ImportItemDto> Items { get; set; } = new();
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
