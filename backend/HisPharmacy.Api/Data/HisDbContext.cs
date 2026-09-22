using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Data;

public class HisDbContext : DbContext
{
    public HisDbContext(DbContextOptions<HisDbContext> options) : base(options) { }

    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<SupplierMedicine> SupplierMedicines => Set<SupplierMedicine>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Batch> Batches => Set<Batch>();
    public DbSet<InventoryStock> InventoryStocks => Set<InventoryStock>();
    public DbSet<DepartmentStock> DepartmentStocks => Set<DepartmentStock>();
    public DbSet<MedicineRequisition> MedicineRequisitions => Set<MedicineRequisition>();
    public DbSet<MedicineRequisitionDetail> MedicineRequisitionDetails => Set<MedicineRequisitionDetail>();
    public DbSet<CabinetTransaction> CabinetTransactions => Set<CabinetTransaction>();
    public DbSet<ImportReceipt> ImportReceipts => Set<ImportReceipt>();
    public DbSet<ImportReceiptDetail> ImportReceiptDetails => Set<ImportReceiptDetail>();
    public DbSet<InternalTransfer> InternalTransfers => Set<InternalTransfer>();
    public DbSet<InternalTransferDetail> InternalTransferDetails => Set<InternalTransferDetail>();
    public DbSet<ReturnReceipt> ReturnReceipts => Set<ReturnReceipt>();
    public DbSet<ReturnReceiptDetail> ReturnReceiptDetails => Set<ReturnReceiptDetail>();
    public DbSet<LiquidationReceipt> LiquidationReceipts => Set<LiquidationReceipt>();
    public DbSet<LiquidationReceiptDetail> LiquidationReceiptDetails => Set<LiquidationReceiptDetail>();
    public DbSet<PurchaseProposal> PurchaseProposals => Set<PurchaseProposal>();
    public DbSet<PurchaseProposalDetail> PurchaseProposalDetails => Set<PurchaseProposalDetail>();
    public DbSet<RecallLog> RecallLogs => Set<RecallLog>();
    public DbSet<InventoryAudit> InventoryAudits => Set<InventoryAudit>();
    public DbSet<InventoryAuditDetail> InventoryAuditDetails => Set<InventoryAuditDetail>();
    public DbSet<StockAdjustmentLog> StockAdjustmentLogs => Set<StockAdjustmentLog>();
    public DbSet<InventoryMovement> InventoryMovements => Set<InventoryMovement>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<QuarantineStock> QuarantineStocks => Set<QuarantineStock>();
    public DbSet<ClearanceProposal> ClearanceProposals => Set<ClearanceProposal>();
    public DbSet<OutpatientPrescription> OutpatientPrescriptions => Set<OutpatientPrescription>();
    public DbSet<OutpatientPrescriptionDetail> OutpatientPrescriptionDetails => Set<OutpatientPrescriptionDetail>();
    public DbSet<BreakageReport> BreakageReports => Set<BreakageReport>();
    public DbSet<BreakageReportDetail> BreakageReportDetails => Set<BreakageReportDetail>();
    public DbSet<AccountingPeriod> AccountingPeriods => Set<AccountingPeriod>();
    public DbSet<PatientAdrReport> PatientAdrReports => Set<PatientAdrReport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Composite unique index for DepartmentStock
        modelBuilder.Entity<DepartmentStock>()
            .HasIndex(ds => new { ds.DepartmentID, ds.BatchID }).IsUnique();

        // Khai báo cho EF Core biết các bảng có Triggers để tránh lỗi câu lệnh OUTPUT trên SQL Server
        modelBuilder.Entity<ImportReceiptDetail>()
            .ToTable(tb => tb.HasTrigger("trg_AfterInsertImportDetails"));
        modelBuilder.Entity<ImportReceipt>()
            .ToTable(tb => tb.HasTrigger("trg_AfterUpdateImportReceipts"));

        // Primary keys configuration mapping
        modelBuilder.Entity<Supplier>().HasKey(e => e.SupplierID);
        modelBuilder.Entity<Supplier>().Property(e => e.SupplierID).ValueGeneratedOnAdd();
        modelBuilder.Entity<SupplierMedicine>().HasKey(e => e.SupplierMedicineID);
        modelBuilder.Entity<SupplierMedicine>().Property(e => e.SupplierMedicineID).ValueGeneratedOnAdd();
        modelBuilder.Entity<User>().HasKey(e => e.UserID);
        modelBuilder.Entity<User>().Property(e => e.UserID).ValueGeneratedOnAdd();
        modelBuilder.Entity<Medicine>().HasKey(e => e.MedicineID);
        modelBuilder.Entity<Department>().HasKey(e => e.DepartmentID);
        modelBuilder.Entity<Batch>().HasKey(e => e.BatchID);
        modelBuilder.Entity<InventoryStock>().HasKey(e => e.StockID);
        modelBuilder.Entity<DepartmentStock>().HasKey(e => e.DepartmentStockID);
        modelBuilder.Entity<MedicineRequisition>().HasKey(e => e.RequisitionID);
        modelBuilder.Entity<MedicineRequisitionDetail>().HasKey(e => e.RequisitionDetailID);
        modelBuilder.Entity<CabinetTransaction>().HasKey(e => e.TransactionID);
        modelBuilder.Entity<ImportReceipt>().HasKey(e => e.ImportID);
        modelBuilder.Entity<ImportReceiptDetail>().HasKey(e => e.ImportDetailID);
        modelBuilder.Entity<InternalTransfer>().HasKey(e => e.TransferID);
        modelBuilder.Entity<InternalTransferDetail>().HasKey(e => e.TransferDetailID);
        modelBuilder.Entity<ReturnReceipt>().HasKey(e => e.ReturnID);
        modelBuilder.Entity<ReturnReceiptDetail>().HasKey(e => e.ReturnDetailID);
        modelBuilder.Entity<LiquidationReceipt>().HasKey(e => e.LiquidationID);
        modelBuilder.Entity<LiquidationReceiptDetail>().HasKey(e => e.LiquidationDetailID);
        modelBuilder.Entity<RecallLog>().HasKey(e => e.RecallID);
        modelBuilder.Entity<RecallLog>().Property(e => e.RecallID).ValueGeneratedOnAdd();

        // Explicit foreign key mappings to match database schemas exactly
        modelBuilder.Entity<Batch>()
            .HasOne(b => b.Medicine)
            .WithMany()
            .HasForeignKey(b => b.MedicineID);

        modelBuilder.Entity<InventoryStock>()
            .HasOne(s => s.Batch)
            .WithMany()
            .HasForeignKey(s => s.BatchID);

        modelBuilder.Entity<DepartmentStock>()
            .HasOne(s => s.Batch)
            .WithMany()
            .HasForeignKey(s => s.BatchID);

        modelBuilder.Entity<DepartmentStock>()
            .HasOne(s => s.Department)
            .WithMany()
            .HasForeignKey(s => s.DepartmentID);

        modelBuilder.Entity<CabinetTransaction>()
            .HasOne(s => s.Batch)
            .WithMany()
            .HasForeignKey(s => s.BatchID);

        modelBuilder.Entity<ImportReceiptDetail>()
            .HasOne(d => d.ImportReceipt)
            .WithMany(r => r.Details)
            .HasForeignKey(d => d.ImportID)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MedicineRequisitionDetail>()
            .HasOne<MedicineRequisition>()
            .WithMany(r => r.Details)
            .HasForeignKey(d => d.RequisitionID)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<InternalTransfer>()
            .HasOne(t => t.Requisition)
            .WithMany()
            .HasForeignKey(t => t.RequisitionID)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<InternalTransferDetail>()
            .HasOne<InternalTransfer>()
            .WithMany(r => r.Details)
            .HasForeignKey(d => d.TransferID)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ReturnReceiptDetail>()
            .HasOne<ReturnReceipt>()
            .WithMany(r => r.Details)
            .HasForeignKey(d => d.ReturnID)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<LiquidationReceiptDetail>()
            .HasOne<LiquidationReceipt>()
            .WithMany(r => r.Details)
            .HasForeignKey(d => d.LiquidationID)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<User>()
            .HasOne(u => u.Department)
            .WithMany()
            .HasForeignKey(u => u.DepartmentID);

        modelBuilder.Entity<PurchaseProposal>().HasKey(e => e.ProposalID);
        modelBuilder.Entity<PurchaseProposal>().Property(e => e.ProposalID).ValueGeneratedOnAdd();
        modelBuilder.Entity<PurchaseProposalDetail>().HasKey(e => e.ProposalDetailID);
        modelBuilder.Entity<PurchaseProposalDetail>().Property(e => e.ProposalDetailID).ValueGeneratedOnAdd();

        modelBuilder.Entity<PurchaseProposalDetail>()
            .HasOne<PurchaseProposal>()
            .WithMany(r => r.Details)
            .HasForeignKey(d => d.ProposalID)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PurchaseProposalDetail>()
            .HasOne(d => d.Medicine)
            .WithMany()
            .HasForeignKey(d => d.MedicineID);

        // Inventory Audit Configuration
        modelBuilder.Entity<InventoryAudit>().HasKey(e => e.AuditID);
        modelBuilder.Entity<InventoryAudit>().Property(e => e.AuditID).ValueGeneratedOnAdd();
        modelBuilder.Entity<InventoryAuditDetail>().HasKey(e => e.AuditDetailID);
        modelBuilder.Entity<InventoryAuditDetail>().Property(e => e.AuditDetailID).ValueGeneratedOnAdd();
        modelBuilder.Entity<StockAdjustmentLog>().HasKey(e => e.LogID);
        modelBuilder.Entity<StockAdjustmentLog>().Property(e => e.LogID).ValueGeneratedOnAdd();

        modelBuilder.Entity<InventoryAuditDetail>()
            .HasOne<InventoryAudit>()
            .WithMany(r => r.Details)
            .HasForeignKey(d => d.AuditID)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<InventoryAuditDetail>()
            .HasOne(d => d.Batch)
            .WithMany()
            .HasForeignKey(d => d.BatchID);

        modelBuilder.Entity<StockAdjustmentLog>()
            .HasOne(d => d.Batch)
            .WithMany()
            .HasForeignKey(d => d.BatchID);

        // New entities configuration mapping
        modelBuilder.Entity<InventoryMovement>().HasKey(e => e.MovementID);
        modelBuilder.Entity<InventoryMovement>().Property(e => e.MovementID).ValueGeneratedOnAdd();
        modelBuilder.Entity<InventoryMovement>()
            .HasOne(d => d.Batch)
            .WithMany()
            .HasForeignKey(d => d.BatchID);

        modelBuilder.Entity<AuditLog>().HasKey(e => e.LogID);
        modelBuilder.Entity<AuditLog>().Property(e => e.LogID).ValueGeneratedOnAdd();
        modelBuilder.Entity<AuditLog>()
            .HasOne<Department>()
            .WithMany()
            .HasForeignKey(a => a.DepartmentID)
            .IsRequired(false);

        modelBuilder.Entity<QuarantineStock>().HasKey(e => e.QuarantineID);
        modelBuilder.Entity<QuarantineStock>().Property(e => e.QuarantineID).ValueGeneratedOnAdd();
        modelBuilder.Entity<QuarantineStock>()
            .HasOne(d => d.Batch)
            .WithMany()
            .HasForeignKey(d => d.BatchID);

        modelBuilder.Entity<ClearanceProposal>().HasKey(e => e.ClearanceID);
        modelBuilder.Entity<ClearanceProposal>().Property(e => e.ClearanceID).ValueGeneratedOnAdd();
        modelBuilder.Entity<ClearanceProposal>()
            .HasOne(c => c.Batch)
            .WithMany()
            .HasForeignKey(c => c.BatchID);
        modelBuilder.Entity<ClearanceProposal>()
            .HasOne(c => c.SourceDepartment)
            .WithMany()
            .HasForeignKey(c => c.SourceDepartmentID)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<ClearanceProposal>()
            .HasOne(c => c.TargetDepartment)
            .WithMany()
            .HasForeignKey(c => c.TargetDepartmentID)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<ClearanceProposal>()
            .HasOne(c => c.Supplier)
            .WithMany()
            .HasForeignKey(c => c.SupplierID)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<OutpatientPrescription>().HasKey(e => e.PrescriptionID);
        modelBuilder.Entity<OutpatientPrescription>().Property(e => e.PrescriptionID).ValueGeneratedOnAdd();
        modelBuilder.Entity<OutpatientPrescription>()
            .HasOne(p => p.Department)
            .WithMany()
            .HasForeignKey(p => p.DepartmentID);
        modelBuilder.Entity<OutpatientPrescriptionDetail>().HasKey(e => e.PrescriptionDetailID);
        modelBuilder.Entity<OutpatientPrescriptionDetail>().Property(e => e.PrescriptionDetailID).ValueGeneratedOnAdd();
        modelBuilder.Entity<OutpatientPrescriptionDetail>()
            .HasOne(d => d.Prescription)
            .WithMany(p => p.Details)
            .HasForeignKey(d => d.PrescriptionID)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<OutpatientPrescriptionDetail>()
            .HasOne(d => d.Medicine)
            .WithMany()
            .HasForeignKey(d => d.MedicineID);
        modelBuilder.Entity<OutpatientPrescriptionDetail>()
            .HasOne(d => d.AllocatedBatch)
            .WithMany()
            .HasForeignKey(d => d.AllocatedBatchID)
            .OnDelete(DeleteBehavior.SetNull);

        // Global Query Filter for Soft Delete on Medicine
        modelBuilder.Entity<Medicine>().HasQueryFilter(m => !m.IsDeleted);

        // BreakageReport mappings
        modelBuilder.Entity<BreakageReport>().HasKey(e => e.ReportID);
        modelBuilder.Entity<BreakageReport>().Property(e => e.ReportID).ValueGeneratedOnAdd();
        modelBuilder.Entity<BreakageReport>().Ignore(r => r.ReasonType);
        modelBuilder.Entity<BreakageReport>().Ignore(r => r.DetailedReason);
        modelBuilder.Entity<BreakageReport>().Ignore(r => r.EvidenceImageBase64);

        modelBuilder.Entity<BreakageReportDetail>().HasKey(e => e.DetailID);
        modelBuilder.Entity<BreakageReportDetail>().Property(e => e.DetailID).ValueGeneratedOnAdd();
        modelBuilder.Entity<BreakageReportDetail>().Ignore(d => d.Quantity);
        modelBuilder.Entity<BreakageReportDetail>().Ignore(d => d.EstimatedLossValue);

        modelBuilder.Entity<BreakageReportDetail>()
            .HasOne(d => d.BreakageReport)
            .WithMany(r => r.Details)
            .HasForeignKey(d => d.ReportID)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<BreakageReportDetail>()
            .HasOne(d => d.Batch)
            .WithMany()
            .HasForeignKey(d => d.BatchID);
        modelBuilder.Entity<BreakageReport>()
            .HasOne(b => b.Department)
            .WithMany()
            .HasForeignKey(b => b.DepartmentID);

        // AccountingPeriod mappings
        modelBuilder.Entity<AccountingPeriod>().HasKey(e => e.PeriodID);
        modelBuilder.Entity<AccountingPeriod>().Property(e => e.PeriodID).ValueGeneratedOnAdd();
        modelBuilder.Entity<AccountingPeriod>()
            .HasIndex(p => new { p.PeriodMonth, p.PeriodYear }).IsUnique();
        modelBuilder.Entity<AccountingPeriod>().Ignore(p => p.StartDate);
        modelBuilder.Entity<AccountingPeriod>().Ignore(p => p.EndDate);
        modelBuilder.Entity<AccountingPeriod>().Ignore(p => p.TotalStockQuantity);
        modelBuilder.Entity<AccountingPeriod>().Ignore(p => p.TotalStockValue);

        // PatientAdrReport mappings
        modelBuilder.Entity<PatientAdrReport>().HasKey(e => e.ReportID);
        modelBuilder.Entity<PatientAdrReport>().Property(e => e.ReportID).ValueGeneratedOnAdd();
        modelBuilder.Entity<PatientAdrReport>()
            .HasOne(r => r.Prescription)
            .WithMany()
            .HasForeignKey(r => r.PrescriptionID)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

// C# Entities matching the SQL Server tables
public class Supplier
{
    public int SupplierID { get; set; }
    public string SupplierName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? ContractNumber { get; set; } // Số hợp đồng mua bán cố định
}

public class Medicine
{
    public int MedicineID { get; set; }
    public string MedicineCode { get; set; } = string.Empty;
    public string MedicineName { get; set; } = string.Empty;
    public string? GenericName { get; set; }
    public string? Specification { get; set; }
    public string? Manufacturer { get; set; }
    public string Unit { get; set; } = string.Empty;
    public int MinInventory { get; set; } = 10;
    public string MedicineGroup { get; set; } = "Dược phẩm khác";
    public string PriorityLevel { get; set; } = "Low"; // 'Low', 'Medium', 'High', 'Critical'
    public string DrugClassification { get; set; } = "Regular"; // 'Regular', 'SpecialAntibiotic', 'NarcoticPsychotropic'
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
}

public class Department
{
    public int DepartmentID { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
}

public class Batch
{
    public int BatchID { get; set; }
    public int MedicineID { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public DateTime? ProductionDate { get; set; } // Ngày sản xuất
    public DateTime ExpiryDate { get; set; }
    public decimal ImportPrice { get; set; }
    public int QuantityOriginal { get; set; }
    public string Status { get; set; } = "Bình thường"; // 'Bình thường', 'Cách ly', 'Thu hồi', 'Trả NCC', 'Tiêu hủy'

    // Navigation
    public Medicine? Medicine { get; set; }
}

public class InventoryStock
{
    public int StockID { get; set; }
    public int BatchID { get; set; }
    public int CurrentQuantity { get; set; }
    public int ReservedQuantity { get; set; } = 0;

    // Navigation
    public Batch? Batch { get; set; }
}

public class DepartmentStock
{
    public int DepartmentStockID { get; set; }
    public int DepartmentID { get; set; }
    public int BatchID { get; set; }
    public int CurrentQuantity { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
    public Department? Department { get; set; }
}

public class MedicineRequisition
{
    public int RequisitionID { get; set; }
    public int DepartmentID { get; set; }
    public DateTime RequisitionDate { get; set; } = DateTime.Now;
    public string RequisitionType { get; set; } = "Regular"; // 'Regular' or 'CabinetRefill'
    public string Status { get; set; } = "Pending"; // 'Pending', 'PendingHead', 'Approved', 'Rejected'
    public string? DigitalSignature { get; set; } // Base64 signature of proposer (nurse)
    public string? HeadSignature { get; set; } // Base64 signature of department head (Trưởng khoa)
    public string? ApproverSignature { get; set; } // Base64 signature of approver (pharmacist)
    public string? ReceiverSignature { get; set; } // Base64 signature of receiver (nurse/head_nurse)
    public string? RejectReason { get; set; } // Reason for rejection
    
    public DateTime? HeadApproveDate { get; set; }
    public DateTime? DispenseDate { get; set; }
    public DateTime? ReceiveDate { get; set; }
    public string? DelegatedBy { get; set; }
    public string? DelegatedTo { get; set; }
    public DateTime? DelegationActivatedAt { get; set; }

    public string? DeliveryBy { get; set; }
    public string? DeliveryPhone { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public string? ProposerName { get; set; }
    public string? ApproverName { get; set; }
    public string? ReceiverName { get; set; }
    public string? WitnessName { get; set; }
    public string? WitnessSignature { get; set; }
    public int SlaMinutes { get; set; } = 120;
    public bool IsSlaBreached { get; set; } = false;
    public string? DocumentHash { get; set; } // SHA-256 hash verifying document integrity

    // Navigation
    public Department? Department { get; set; }
    public List<MedicineRequisitionDetail> Details { get; set; } = new();
}

public class MedicineRequisitionDetail
{
    public int RequisitionDetailID { get; set; }
    public int RequisitionID { get; set; }
    public int MedicineID { get; set; }
    public int RequestedQuantity { get; set; }
    public int? DispensedQuantity { get; set; } // Actual quantity dispensed by pharmacist
    public int? ReceivedQuantity { get; set; }

    // Navigation
    public Medicine? Medicine { get; set; }
}

public class CabinetTransaction
{
    public int TransactionID { get; set; }
    public int DepartmentID { get; set; }
    public int BatchID { get; set; }
    public string PatientCode { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public DateTime TransactionDate { get; set; } = DateTime.Now;
    public bool IsRefilled { get; set; } = false;
    public int? RequisitionID { get; set; }
    public string? DispensedBy { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
    public Department? Department { get; set; }
    public MedicineRequisition? Requisition { get; set; } // Linked refill request
}

public class ImportReceipt
{
    public int ImportID { get; set; }
    public string ImportCode { get; set; } = string.Empty; // Số phiếu nhập nội bộ tự sinh (PNK-YYYYMMDD-XXXX)
    public string? ContractNumber { get; set; } // Số hợp đồng thầu/mua bán
    public string? InvoiceNumber { get; set; } // Số hóa đơn GTGT từ nhà cung cấp
    public int SupplierID { get; set; }
    public DateTime ImportDate { get; set; } = DateTime.Now;
    public string CreatedBy { get; set; } = "Thủ kho Dược"; // Người lập phiếu/kiểm nhập
    public string? Notes { get; set; } // Ghi chú phiếu nhập
    public string Status { get; set; } = "Đã kiểm"; // Trạng thái kiểm nhập: Chờ kiểm, Đã kiểm, Từ chối, Thiếu hàng
    public DateTime? InvoiceDate { get; set; } // Ngày hóa đơn tài chính
    public string? DeliveryNoteNumber { get; set; } // Số phiếu xuất kho của nhà cung cấp
    public string? SecondInspector { get; set; } // Dược sĩ cùng kiểm tra
    public string? AnomalyDescription { get; set; } // Mô tả chi tiết bất thường
    public string? DocumentsJson { get; set; } // Chuỗi JSON lưu tệp đính kèm (Hóa đơn, COA, COO, Ảnh...)
    public string? DigitalSignature { get; set; } // Base64 signature image string của người nhận/lập phiếu
    public string? SecondInspectorSignature { get; set; } // Base64 signature image string của người kiểm thứ hai
    public string? DeliveryPersonSignature { get; set; } // Base64 signature image string của người giao hàng
    public string? DeliveryPersonName { get; set; } // Họ tên Người giao hàng (NCC)
    public string? ApproverSignature { get; set; } // Base64 signature image string của người duyệt nhập kho (Ban lãnh đạo)
    public string? ApproverName { get; set; } // Họ tên Dược sĩ trưởng hoặc Ban giám đốc duyệt
    public string? EditHistoryJson { get; set; } // Chuỗi JSON lưu vết lịch sử điều chỉnh phiếu
    public string? DocumentHash { get; set; } // SHA-256 hash verifying document integrity

    // Navigation
    public Supplier? Supplier { get; set; }
    public List<ImportReceiptDetail> Details { get; set; } = new();
}

public class ImportReceiptDetail
{
    public int ImportDetailID { get; set; }
    public int ImportID { get; set; }
    public int BatchID { get; set; }
    public int Quantity { get; set; }
    public decimal? ContractPrice { get; set; }
    public decimal? ActualImportPrice { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
    public ImportReceipt? ImportReceipt { get; set; }
}

public class InternalTransfer
{
    public int TransferID { get; set; }
    public int? FromDepartmentID { get; set; } // NULL means Main Store (Kho chẵn)
    public int ToDepartmentID { get; set; }
    public DateTime TransferDate { get; set; } = DateTime.Now;
    public string? DigitalSignature { get; set; } // Base64 signature of transferring pharmacist
    public int? RequisitionID { get; set; } // Linked requisition ID if created from a request

    // Navigation
    public Department? FromDepartment { get; set; }
    public Department? ToDepartment { get; set; }
    public MedicineRequisition? Requisition { get; set; } // Navigation property
    public List<InternalTransferDetail> Details { get; set; } = new();
}

public class InternalTransferDetail
{
    public int TransferDetailID { get; set; }
    public int TransferID { get; set; }
    public int BatchID { get; set; }
    public int Quantity { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
}

public class ReturnReceipt
{
    public int ReturnID { get; set; }
    public int DepartmentID { get; set; }
    public DateTime ReturnDate { get; set; } = DateTime.Now;
    public string Status { get; set; } = "Pending"; // 'Pending', 'PendingLeader', 'Approved', 'Rejected'
    public string? ReturnReason { get; set; } // Lý do hoàn trả thuốc thừa từ khoa lâm sàng
    public string? DigitalSignature { get; set; } // Base64 signature image string của người trả hàng
    public string? ProposerName { get; set; } // Tên Điều dưỡng/Người trả hàng
    public string? ApproverSignature { get; set; } // Base64 signature image string của người duyệt nhận
    public string? ApproverName { get; set; } // Tên Dược sĩ/Thủ kho nhận thực tế
    public string? DirectorSignature { get; set; } // Base64 signature image string của Lãnh đạo duyệt nhận
    public string? RejectReason { get; set; } // Lý do từ chối phiếu hoàn trả

    // Navigation
    public Department? Department { get; set; }
    public List<ReturnReceiptDetail> Details { get; set; } = new();
}

public class ReturnReceiptDetail
{
    public int ReturnDetailID { get; set; }
    public int ReturnID { get; set; }
    public int BatchID { get; set; }
    public int Quantity { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
}

public class LiquidationReceipt
{
    public int LiquidationID { get; set; }
    public DateTime LiquidationDate { get; set; } = DateTime.Now;
    public string? Reason { get; set; }
    public string? DigitalSignature { get; set; } // Base64 signature image string của người lập/duyệt thanh lý
    public string Status { get; set; } = "Chờ duyệt"; // 'Chờ duyệt', 'Đã duyệt', 'Từ chối'
    public string CreatedBy { get; set; } = "Thủ kho Dược";
    public string? ProposerSignature { get; set; }
    public string? ApproverSignature { get; set; }
    public string Type { get; set; } = "Tiêu hủy"; // 'Thanh lý', 'Tiêu hủy'
    public string? CheckerName { get; set; }
    public string? CheckerSignature { get; set; }

    // Navigation
    public List<LiquidationReceiptDetail> Details { get; set; } = new();
}

public class LiquidationReceiptDetail
{
    public int LiquidationDetailID { get; set; }
    public int LiquidationID { get; set; }
    public int BatchID { get; set; }
    public int Quantity { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
}

public class User
{
    public int UserID { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty; // 'pharmacist', 'nurse', 'director'
    public int? DepartmentID { get; set; }

    // Navigation
    public Department? Department { get; set; }
}

public class PurchaseProposal
{
    public int ProposalID { get; set; }
    public int? SupplierID { get; set; }
    public DateTime ProposalDate { get; set; } = DateTime.Now;
    public string Status { get; set; } = "Draft"; // 'Draft', 'Approved', 'Ordered'
    public string? Reason { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string? ApprovedBy { get; set; }
    public string? DigitalSignature { get; set; } // Base64 signature image string
    public string? ProposerSignature { get; set; } // Base64 signature image string of proposer (storekeeper)

    // Navigation
    public Supplier? Supplier { get; set; }
    public List<PurchaseProposalDetail> Details { get; set; } = new();
}

public class PurchaseProposalDetail
{
    public int ProposalDetailID { get; set; }
    public int ProposalID { get; set; }
    public int MedicineID { get; set; }
    public int CurrentQuantity { get; set; }
    public int MinInventory { get; set; }
    public int SuggestedQuantity { get; set; }

    // Navigation
    public Medicine? Medicine { get; set; }
}

public class RecallLog
{
    public int RecallID { get; set; }
    public int BatchID { get; set; }
    public DateTime RecallDate { get; set; } = DateTime.Now;
    public string? Reason { get; set; }
    public string ActionType { get; set; } = "Cách ly"; // 'Cách ly', 'Trả NCC', 'Tiêu hủy'
    public string? RecallLevel { get; set; } // 'Internal', 'Manufacturer', 'MOH'
    public string? CreatedBy { get; set; }
    public string? DigitalSignature { get; set; }
    public string Status { get; set; } = "Pending"; // 'Pending', 'Approved', 'Rejected'
    public string? ApprovedBy { get; set; }
    public string? ApproverSignature { get; set; } // Director/Leadership signature image string

    // Navigation
    public Batch? Batch { get; set; }
}

public class InventoryAudit
{
    public int AuditID { get; set; }
    public string AuditCode { get; set; } = string.Empty;
    public string LocationType { get; set; } = "MainStore"; // 'MainStore' or 'Cabinet'
    public int? DepartmentID { get; set; }
    public DateTime AuditDate { get; set; } = DateTime.Now;
    public string CreatedBy { get; set; } = string.Empty;
    public string AuditType { get; set; } = "Định kỳ"; // 'Định kỳ', 'Đột xuất', 'Cuối năm', 'Sau thu hồi'
    public string Status { get; set; } = "Nháp"; // 'Nháp', 'Chờ xác nhận', 'Có chênh lệch', 'Đã xác nhận', 'Đã điều chỉnh', 'Đã hủy'
    public string? Notes { get; set; }
    public string? CreatorSignature { get; set; } // Base64 signature of creator (Thủ kho)
    public string? CheckerSignature { get; set; } // Base64 signature of checker (Dược sĩ trưởng / Trưởng khoa)
    public string? DirectorSignature { get; set; } // Base64 signature of director (Giám đốc)
    public string? CheckerSignedBy { get; set; }
    public DateTime? CheckerSignedAt { get; set; }
    public string? DirectorSignedBy { get; set; }
    public DateTime? DirectorSignedAt { get; set; }
    public bool DiscrepancyThresholdExceeded { get; set; } = false;
    public string? TimelineJson { get; set; } // JSON list of activities
    public string? DocumentHash { get; set; } // SHA-256 hash verifying document integrity

    // Navigation
    public Department? Department { get; set; }
    public List<InventoryAuditDetail> Details { get; set; } = new();
}

public class InventoryAuditDetail
{
    public int AuditDetailID { get; set; }
    public int AuditID { get; set; }
    public int BatchID { get; set; }
    public int SystemQuantity { get; set; }
    public int ActualQuantity { get; set; }
    public int Discrepancy { get; set; }
    public string? Reason { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
}

public class StockAdjustmentLog
{
    public int LogID { get; set; }
    public int? AuditID { get; set; }
    public int BatchID { get; set; }
    public string LocationType { get; set; } = string.Empty; // 'MainStore' or 'Cabinet'
    public int? DepartmentID { get; set; }
    public int OldQuantity { get; set; }
    public int NewQuantity { get; set; }
    public int Discrepancy { get; set; }
    public string AdjustedBy { get; set; } = string.Empty;
    public DateTime AdjustmentDate { get; set; } = DateTime.Now;
    public string? Reason { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
}

public class InventoryMovement
{
    public int MovementID { get; set; }
    public int MedicineID { get; set; }
    public int BatchID { get; set; }
    public string LocationType { get; set; } = string.Empty; // 'MainStore', 'Cabinet'
    public int? DepartmentID { get; set; } // NULL for MainStore
    public int BeforeQuantity { get; set; }
    public int ChangeQuantity { get; set; }
    public int AfterQuantity { get; set; }
    public string SourceType { get; set; } = string.Empty; // 'Import', 'Requisition', 'DirectTransfer', 'Return', 'Liquidation', 'Recall'
    public int SourceID { get; set; }
    public string Action { get; set; } = string.Empty; // 'ADD', 'SUBTRACT', 'ROLLBACK'
    public string ByUser { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    public Batch? Batch { get; set; }
}

public class AuditLog
{
    public int LogID { get; set; }
    public int? DepartmentID { get; set; }
    public string? TableName { get; set; }
    public string Action { get; set; } = string.Empty; // 'INSERT', 'UPDATE', 'DELETE'
    public string? KeyValues { get; set; }
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public string? ChangedColumns { get; set; }
    public string? Username { get; set; }
    public string? UserRole { get; set; }
    public string? IPAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Original columns from AuditLogs table
    public string EntityName { get; set; } = string.Empty;
    public int? EntityID { get; set; }
    public string? BeforeData { get; set; }
    public string? AfterData { get; set; }
    public string? Device { get; set; }
}

public class BreakageReport
{
    public int ReportID { get; set; }
    public string ReportCode { get; set; } = string.Empty; // BBHH-YYYYMMDD-XXXX
    public int DepartmentID { get; set; }
    public DateTime ReportDate { get; set; } = DateTime.Now;
    public string ReportedBy { get; set; } = string.Empty;
    public string Reason { get; set; } = "Rơi vỡ";
    [NotMapped]
    public string? ReasonType { get => Reason; set => Reason = value; }
    [NotMapped]
    public string? DetailedReason { get; set; }
    public string? DamageImage { get; set; }
    [NotMapped]
    public string? EvidenceImageBase64 { get => DamageImage; set => DamageImage = value; }
    public string Status { get; set; } = "Pending"; // 'Pending', 'Approved', 'Rejected'
    public string? DigitalSignature { get; set; }
    public string? ApproverSignature { get; set; }
    public string? ApproverName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public decimal TotalLossAmount { get; set; } = 0;
    public string? Notes { get; set; }
    public string? DocumentHash { get; set; }

    // Navigation
    public Department? Department { get; set; }
    public List<BreakageReportDetail> Details { get; set; } = new();
}

public class BreakageReportDetail
{
    public int DetailID { get; set; }
    public int ReportID { get; set; }
    public int BatchID { get; set; }
    public int MedicineID { get; set; }
    public int DamagedQuantity { get; set; }
    [NotMapped]
    public int Quantity { get => DamagedQuantity; set => DamagedQuantity = value; }
    public decimal UnitPrice { get; set; } = 0;
    public decimal TotalLossAmount { get; set; } = 0;
    [NotMapped]
    public decimal EstimatedLossValue { get => TotalLossAmount; set => TotalLossAmount = value; }
    public string? Notes { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
    public Medicine? Medicine { get; set; }
    public BreakageReport? BreakageReport { get; set; }
}

public class AccountingPeriod
{
    public int PeriodID { get; set; }
    public int PeriodMonth { get; set; } // 1 - 12
    public int PeriodYear { get; set; } // 2026...
    [NotMapped]
    public DateTime? StartDate { get; set; }
    [NotMapped]
    public DateTime? EndDate { get; set; }
    public bool IsLocked { get; set; } = false;
    public DateTime? LockedAt { get; set; }
    public string? LockedBy { get; set; }
    public string? Notes { get; set; }
    public int ClosingStockCount { get; set; } = 0;
    [NotMapped]
    public int TotalStockQuantity { get => ClosingStockCount; set => ClosingStockCount = value; }
    public decimal ClosingStockValue { get; set; } = 0;
    [NotMapped]
    public decimal TotalStockValue { get => ClosingStockValue; set => ClosingStockValue = value; }
    public decimal TotalImportValue { get; set; } = 0;
    public decimal TotalExportValue { get; set; } = 0;
    public decimal TotalLossValue { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}

public class QuarantineStock
{
    public int QuarantineID { get; set; }
    public int BatchID { get; set; }
    public int MedicineID { get; set; }
    public string LocationType { get; set; } = string.Empty; // 'MainStore' or 'Cabinet'
    public int? DepartmentID { get; set; }
    public int Quantity { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = "PendingInspection"; // 'PendingInspection', 'AwaitingVendor', 'AwaitingDestroy', 'Released'
    public string ReportedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime? ResolvedAt { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
}

public class SupplierMedicine
{
    public int SupplierMedicineID { get; set; }
    public int SupplierID { get; set; }
    public int MedicineID { get; set; }
    public string? ContractNumber { get; set; }
    public decimal ContractPrice { get; set; }
    public int? ContractQuantity { get; set; }
    public int ImportedQuantity { get; set; } = 0;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Status { get; set; }
}

public class ClearanceProposal
{
    public int ClearanceID { get; set; }
    public int BatchID { get; set; }
    public string SourceLocationType { get; set; } = "MainStore"; // 'MainStore' or 'Cabinet'
    public int? SourceDepartmentID { get; set; }
    public int CurrentQuantity { get; set; }
    public int EstimatedWasteQuantity { get; set; }
    public decimal EstimatedWasteValue { get; set; }
    public decimal AverageDailyConsumption { get; set; }
    public int DaysToExpiry { get; set; }
    public decimal DaysOfSupply { get; set; }
    public string RiskLevel { get; set; } = "Medium"; // 'Critical', 'High', 'Medium'
    public string RecommendedAction { get; set; } = "InternalTransfer"; // 'InternalTransfer', 'VendorReturn', 'UrgentDispense', 'Monitor'
    public int? TargetDepartmentID { get; set; }
    public int? SupplierID { get; set; }
    public int ProposedQuantity { get; set; }
    public string Status { get; set; } = "Pending"; // 'Pending', 'Transferred', 'VendorReturning', 'Dismissed', 'Completed'
    public int? GeneratedTransferID { get; set; }
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = "Hệ thống AI/Heuristic";
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime? ResolvedAt { get; set; }
    public string? ResolvedBy { get; set; }
    public string? ResolutionNotes { get; set; }
    public string? DigitalSignature { get; set; }

    // Navigation
    public Batch? Batch { get; set; }
    public Department? SourceDepartment { get; set; }
    public Department? TargetDepartment { get; set; }
    public Supplier? Supplier { get; set; }
}

public class OutpatientPrescription
{
    public int PrescriptionID { get; set; }
    public string PrescriptionCode { get; set; } = string.Empty; // DT-YYYYMMDD-XXXX
    public string Barcode { get; set; } = string.Empty;
    public string PatientCode { get; set; } = string.Empty; // BN-XXXXXX
    public string PatientName { get; set; } = string.Empty;
    public int? BirthYear { get; set; }
    public string Gender { get; set; } = "Nam";
    public string? Address { get; set; }
    public string? InsuranceCardNumber { get; set; }
    public int InsuranceRate { get; set; } = 80; // 80, 95, 100, 0
    public string Diagnosis { get; set; } = string.Empty;
    public string DoctorName { get; set; } = "BS.CKII. Nguyễn Hữu Lực";
    public int DepartmentID { get; set; } = 1; // 1: Khoa Khám Bệnh
    public DateTime PrescribedAt { get; set; } = DateTime.Now;
    public string Status { get; set; } = "Pending"; // 'Pending', 'Dispensed', 'Cancelled'
    public DateTime? DispensedAt { get; set; }
    public string? DispensedBy { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal InsuranceCoverageAmount { get; set; }
    public decimal PatientCoPayAmount { get; set; }
    public string? Notes { get; set; }
    public string? DigitalSignature { get; set; }
    public string? DispenserSignature { get; set; }
    public string? DoctorSignature { get; set; }
    public string? PatientSignature { get; set; }

    // Navigation
    public Department? Department { get; set; }
    public List<OutpatientPrescriptionDetail> Details { get; set; } = new();
}

public class OutpatientPrescriptionDetail
{
    public int PrescriptionDetailID { get; set; }
    public int PrescriptionID { get; set; }
    public int MedicineID { get; set; }
    public int RequestedQuantity { get; set; }
    public int DispensedQuantity { get; set; }
    public string DosageInstructions { get; set; } = "Ngày uống 2 lần, mỗi lần 1 viên sau ăn";
    public decimal? MorningDose { get; set; } = 1;
    public decimal? NoonDose { get; set; } = 0;
    public decimal? AfternoonDose { get; set; } = 0;
    public decimal? NightDose { get; set; } = 1;
    public string? UsageTime { get; set; } = "Sau ăn 30 phút";
    public int? AllocatedBatchID { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }

    // Navigation
    public OutpatientPrescription? Prescription { get; set; }
    public Medicine? Medicine { get; set; }
    public Batch? AllocatedBatch { get; set; }
}

public class PatientAdrReport
{
    public int ReportID { get; set; }
    public int? PrescriptionID { get; set; }
    public string PrescriptionCode { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string? PatientPhone { get; set; }
    public string? SuspectedMedicineName { get; set; }
    public string Symptoms { get; set; } = string.Empty;
    public string Severity { get; set; } = "Nhẹ"; // "Nhẹ", "Trung bình", "Nghiêm trọng"
    public string? OnsetDelay { get; set; } // "Dưới 30 phút", "1-2 giờ", "Vài ngày", etc.
    public string? Description { get; set; }
    public DateTime ReportedAt { get; set; } = DateTime.Now;
    public string Status { get; set; } = "New"; // "New", "Contacted", "Resolved"
    public string? PharmacistNotes { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }

    // Navigation
    public OutpatientPrescription? Prescription { get; set; }
}
