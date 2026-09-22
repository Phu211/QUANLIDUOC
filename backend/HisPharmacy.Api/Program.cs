using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using HisPharmacy.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// Add API Controllers and JSON serializers with global no-cache filter to prevent stale browser caches
builder.Services.AddControllers(options =>
{
    options.Filters.Add(new Microsoft.AspNetCore.Mvc.ResponseCacheAttribute
    {
        NoStore = true,
        Location = Microsoft.AspNetCore.Mvc.ResponseCacheLocation.None
    });
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

// Configure HttpContextAccessor for Audit Interceptor and user tracking
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuditSaveChangesInterceptor>();

// Configure EF Core DbContext to connect to SQL Server Express with Interceptor
builder.Services.AddDbContext<HisDbContext>((serviceProvider, options) =>
{
    options.UseSqlServer("Server=.\\SQLEXPRESS;Database=HisPharmacyDB;Trusted_Connection=True;TrustServerCertificate=True;");
    options.AddInterceptors(serviceProvider.GetRequiredService<AuditSaveChangesInterceptor>());
});

// Add SignalR Support for Real-Time Synchronization
builder.Services.AddSignalR();

// Dependecy Injection registrations
builder.Services.AddHttpClient();
builder.Services.AddSingleton<GeminiAiService>();
builder.Services.AddScoped<StockService>();
builder.Services.AddScoped<CabinetService>();

// Register Expiry Scanning Background Job
builder.Services.AddHostedService<ExpiryScannerJob>();

// CORS Setup Policy for Vite Frontend
builder.Services.AddCors(options => {
    options.AddPolicy("AllowFrontend", policy => {
        policy.WithOrigins("http://localhost:5173") // Vite Standard URL
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR WebSockets over CORS
    });
});

var app = builder.Build();

// Run database schema updates on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HisDbContext>();
    try
    {
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('MedicineRequisitions') AND name = 'ProposerName') ALTER TABLE MedicineRequisitions ADD ProposerName NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('MedicineRequisitions') AND name = 'ApproverName') ALTER TABLE MedicineRequisitions ADD ApproverName NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('MedicineRequisitions') AND name = 'WitnessName') ALTER TABLE MedicineRequisitions ADD WitnessName NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('MedicineRequisitions') AND name = 'WitnessSignature') ALTER TABLE MedicineRequisitions ADD WitnessSignature NVARCHAR(MAX) NULL;");
        
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RecallLogs') AND name = 'Status') ALTER TABLE RecallLogs ADD Status NVARCHAR(50) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RecallLogs') AND name = 'ApprovedBy') ALTER TABLE RecallLogs ADD ApprovedBy NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RecallLogs') AND name = 'ApproverSignature') ALTER TABLE RecallLogs ADD ApproverSignature NVARCHAR(MAX) NULL;");
        db.Database.ExecuteSqlRaw("UPDATE RecallLogs SET Status = 'Approved' WHERE Status IS NULL;");
        
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ReturnReceipts') AND name = 'ApproverName') ALTER TABLE ReturnReceipts ADD ApproverName NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ReturnReceipts') AND name = 'ProposerName') ALTER TABLE ReturnReceipts ADD ProposerName NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ImportReceipts') AND name = 'DeliveryPersonName') ALTER TABLE ImportReceipts ADD DeliveryPersonName NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ImportReceipts') AND name = 'ApproverName') ALTER TABLE ImportReceipts ADD ApproverName NVARCHAR(250) NULL;");
        
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('LiquidationReceipts') AND name = 'CheckerName') ALTER TABLE LiquidationReceipts ADD CheckerName NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('LiquidationReceipts') AND name = 'CheckerSignature') ALTER TABLE LiquidationReceipts ADD CheckerSignature NVARCHAR(MAX) NULL;");
        db.Database.ExecuteSqlRaw("UPDATE LiquidationReceipts SET CheckerName = N'DS. Lê Văn Chương' WHERE CheckerName IS NULL AND (Status = N'Đã duyệt' OR Status = N'Đã thanh lý' OR Status = N'Đã tiêu hủy');");

        // Data patches for historical return receipts
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ProposerName = N'Điều dưỡng trưởng Trần Trung Nam' WHERE DepartmentID = 1 AND (ProposerName IS NULL OR ProposerName = N'ĐDT. Tạ Thị Hồng');");
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ProposerName = N'Điều dưỡng trưởng Trần Vỹ Khang' WHERE DepartmentID = 2 AND (ProposerName IS NULL OR ProposerName = N'ĐDT. Phan Thị Cẩm Tú');");
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ProposerName = N'Điều dưỡng trưởng Trần Thanh Phương' WHERE DepartmentID = 3 AND (ProposerName IS NULL OR ProposerName = N'ĐDT. Nguyễn Thị Mai');");
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ProposerName = N'Điều dưỡng trưởng Nguyễn Trần Gia Khang' WHERE DepartmentID = 4 AND (ProposerName IS NULL OR ProposerName = N'ĐDT. Lê Thị Ngọc');");
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ProposerName = N'Điều dưỡng trưởng Nguyễn Thái Bình Dương' WHERE DepartmentID = 5 AND (ProposerName IS NULL OR ProposerName = N'ĐDT. Phạm Hoàng Yến');");
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ApproverName = N'DS. Hà Lâm Đình Phú' WHERE ApproverSignature IS NOT NULL AND ApproverName IS NULL;");
        db.Database.ExecuteSqlRaw("UPDATE ImportReceipts SET ApproverName = N'Dược sĩ Hà Lâm Đình Phú' WHERE ApproverSignature IS NOT NULL AND ApproverName IS NULL;");
        db.Database.ExecuteSqlRaw("UPDATE MedicineRequisitions SET ApproverName = N'Dược sĩ Hà Lâm Đình Phú' WHERE ApproverSignature IS NOT NULL AND ApproverName IS NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM Users WHERE Username = 'quayduoc') INSERT INTO Users (Username, Password, FullName, Role, DepartmentID) VALUES ('quayduoc', '123', N'Dược sĩ Nguyễn Thị Thảo', 'dispensary', 1);");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM Users WHERE Username = 'ds_khambenh') INSERT INTO Users (Username, Password, FullName, Role, DepartmentID) VALUES ('ds_khambenh', '123', N'Dược sĩ Nguyễn Thị Thảo', 'dispensary', 1);");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM Users WHERE Username = 'ds_capcuu') INSERT INTO Users (Username, Password, FullName, Role, DepartmentID) VALUES ('ds_capcuu', '123', N'Dược sĩ Phạm Hồng Phúc', 'dispensary', 2);");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM Users WHERE Username = 'ds_noitonghop') INSERT INTO Users (Username, Password, FullName, Role, DepartmentID) VALUES ('ds_noitonghop', '123', N'Dược sĩ Trần Hoàng Nam', 'dispensary', 3);");

        // Data encoding patches for OutpatientPrescriptions & CabinetTransactions
        db.Database.ExecuteSqlRaw(@"
            UPDATE Users SET FullName = N'Thủ kho Hà Lâm Đình Phú' WHERE Username IN ('thukho', 'phu');
            UPDATE Users SET FullName = N'Thủ kho Kiều Đức Anh' WHERE Username = 'anh';
            UPDATE OutpatientPrescriptions SET DoctorName = N'BS.CKII. Nguyễn Hữu Lực' WHERE (DepartmentID = 1 OR DepartmentID IS NULL) AND (DoctorName LIKE N'%Nguy%n%' OR DoctorName LIKE N'%á»%' OR DoctorName LIKE N'%Lá»±c%');
            UPDATE OutpatientPrescriptions SET DoctorName = N'BS.CKII. Lê Văn Chương' WHERE DepartmentID = 2 OR DoctorName LIKE N'%Ch%ng%' OR DoctorName LIKE N'%LĂª%';
            UPDATE OutpatientPrescriptions SET DoctorName = N'BS.CKII. Nguyễn Đăng Đức Anh' WHERE DepartmentID = 3 OR DoctorName LIKE N'%Ä%ng%';
            UPDATE OutpatientPrescriptions SET Notes = N'Bệnh nhân sốt cao 38.5 độ 2 ngày, nuốt đau | Đã kiểm tra tương tác thuốc và tư vấn liều dùng đầy đủ' WHERE PrescriptionID = 1;
            UPDATE OutpatientPrescriptions SET DispensedBy = N'DS. Lê Văn Chương' WHERE DispensedBy LIKE N'%LĂª%' OR DispensedBy LIKE N'%ChÆ°Æ¡ng%';
            UPDATE CabinetTransactions SET DispensedBy = N'DS. Lê Văn Chương' WHERE DispensedBy LIKE N'%LĂª%' OR DispensedBy LIKE N'%ChÆ°Æ¡ng%';
        ");

        // Schema update for 6 Graduation Features: Soft delete, classification, document hash, breakage reports, period lock, and audit
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Medicines') AND name = 'DrugClassification')
                ALTER TABLE Medicines ADD DrugClassification NVARCHAR(50) NOT NULL DEFAULT 'Regular';
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Medicines') AND name = 'IsDeleted')
                ALTER TABLE Medicines ADD IsDeleted BIT NOT NULL DEFAULT 0;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Medicines') AND name = 'DeletedAt')
                ALTER TABLE Medicines ADD DeletedAt DATETIME2 NULL;

            -- Document Integrity Hashes
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ImportReceipts') AND name = 'DocumentHash')
                ALTER TABLE ImportReceipts ADD DocumentHash NVARCHAR(64) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('MedicineRequisitions') AND name = 'DocumentHash')
                ALTER TABLE MedicineRequisitions ADD DocumentHash NVARCHAR(64) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('InventoryAudits') AND name = 'DocumentHash')
                ALTER TABLE InventoryAudits ADD DocumentHash NVARCHAR(64) NULL;

            -- AuditLog columns
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'TableName')
                ALTER TABLE AuditLogs ADD TableName NVARCHAR(100) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'KeyValues')
                ALTER TABLE AuditLogs ADD KeyValues NVARCHAR(MAX) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'OldValues')
                ALTER TABLE AuditLogs ADD OldValues NVARCHAR(MAX) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'NewValues')
                ALTER TABLE AuditLogs ADD NewValues NVARCHAR(MAX) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'ChangedColumns')
                ALTER TABLE AuditLogs ADD ChangedColumns NVARCHAR(MAX) NULL;
            IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'EntityName' AND is_nullable = 0)
                ALTER TABLE AuditLogs ALTER COLUMN EntityName NVARCHAR(250) NULL;

            -- Breakage Reports Table
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BreakageReports')
            BEGIN
                CREATE TABLE BreakageReports (
                    ReportID INT IDENTITY(1,1) PRIMARY KEY,
                    ReportCode NVARCHAR(50) NOT NULL,
                    DepartmentID INT NOT NULL,
                    ReportDate DATETIME2 NOT NULL DEFAULT GETDATE(),
                    ReportedBy NVARCHAR(250) NOT NULL,
                    Reason NVARCHAR(500) NOT NULL,
                    DamageImage NVARCHAR(MAX) NULL,
                    DigitalSignature NVARCHAR(MAX) NULL,
                    ApproverSignature NVARCHAR(MAX) NULL,
                    ApproverName NVARCHAR(250) NULL,
                    ApprovedAt DATETIME2 NULL,
                    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
                    TotalLossAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
                    Notes NVARCHAR(MAX) NULL,
                    DocumentHash NVARCHAR(64) NULL
                );
            END

            -- Breakage Report Details Table
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BreakageReportDetails')
            BEGIN
                CREATE TABLE BreakageReportDetails (
                    DetailID INT IDENTITY(1,1) PRIMARY KEY,
                    ReportID INT NOT NULL FOREIGN KEY REFERENCES BreakageReports(ReportID) ON DELETE CASCADE,
                    BatchID INT NOT NULL,
                    MedicineID INT NOT NULL,
                    DamagedQuantity INT NOT NULL,
                    UnitPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
                    TotalLossAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
                    Notes NVARCHAR(500) NULL
                );
            END

            -- Accounting Periods Table
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AccountingPeriods')
            BEGIN
                CREATE TABLE AccountingPeriods (
                    PeriodID INT IDENTITY(1,1) PRIMARY KEY,
                    PeriodMonth INT NOT NULL,
                    PeriodYear INT NOT NULL,
                    IsLocked BIT NOT NULL DEFAULT 0,
                    LockedAt DATETIME2 NULL,
                    LockedBy NVARCHAR(250) NULL,
                    Notes NVARCHAR(MAX) NULL,
                    ClosingStockCount INT NOT NULL DEFAULT 0,
                    ClosingStockValue DECIMAL(18,2) NOT NULL DEFAULT 0,
                    TotalImportValue DECIMAL(18,2) NOT NULL DEFAULT 0,
                    TotalExportValue DECIMAL(18,2) NOT NULL DEFAULT 0,
                    TotalLossValue DECIMAL(18,2) NOT NULL DEFAULT 0,
                    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
                );
                CREATE UNIQUE INDEX IX_AccountingPeriods_MonthYear ON AccountingPeriods(PeriodMonth, PeriodYear);
            END

            -- Patient ADR Reports Table
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PatientAdrReports')
            BEGIN
                CREATE TABLE PatientAdrReports (
                    ReportID INT IDENTITY(1,1) PRIMARY KEY,
                    PrescriptionID INT NULL,
                    PrescriptionCode NVARCHAR(50) NOT NULL,
                    PatientName NVARCHAR(250) NOT NULL,
                    PatientPhone NVARCHAR(50) NULL,
                    SuspectedMedicineName NVARCHAR(250) NULL,
                    Symptoms NVARCHAR(MAX) NOT NULL,
                    Severity NVARCHAR(50) NOT NULL DEFAULT N'Nhẹ',
                    OnsetDelay NVARCHAR(100) NULL,
                    Description NVARCHAR(MAX) NULL,
                    ReportedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
                    Status NVARCHAR(50) NOT NULL DEFAULT 'New',
                    PharmacistNotes NVARCHAR(MAX) NULL,
                    ReviewedBy NVARCHAR(250) NULL,
                    ReviewedAt DATETIME2 NULL
                );
            END
        ");

        // Seed sample drug classifications in separate batch so DrugClassification column is already compiled
        try
        {
            db.Database.ExecuteSqlRaw(@"
                UPDATE Medicines SET DrugClassification = 'NarcoticPsychotropic' 
                WHERE (MedicineName LIKE N'%Morphin%' OR MedicineName LIKE N'%Fentanyl%' OR MedicineName LIKE N'%Diazepam%' OR MedicineName LIKE N'%Tramadol%' OR MedicineName LIKE N'%Codein%')
                  AND (DrugClassification IS NULL OR DrugClassification = 'Regular');

                UPDATE Medicines SET DrugClassification = 'SpecialAntibiotic' 
                WHERE (MedicineName LIKE N'%Vancomycin%' OR MedicineName LIKE N'%Meropenem%' OR MedicineName LIKE N'%Colistin%' OR MedicineName LIKE N'%Ceftriaxon%')
                  AND (DrugClassification IS NULL OR DrugClassification = 'Regular');
            ");
        }
        catch (Exception ex)
        {
            Console.WriteLine("Warning updating DrugClassification seed: " + ex.Message);
        }

        // Upgrade SupplierMedicines table schema if missing columns
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('SupplierMedicines') AND name = 'ContractNumber')
            BEGIN
                ALTER TABLE SupplierMedicines ADD ContractNumber NVARCHAR(100) NULL;
                ALTER TABLE SupplierMedicines ADD ContractQuantity INT NULL;
                ALTER TABLE SupplierMedicines ADD ImportedQuantity INT NOT NULL DEFAULT 0;
                ALTER TABLE SupplierMedicines ADD StartDate DATE NULL;
                ALTER TABLE SupplierMedicines ADD EndDate DATE NULL;
                ALTER TABLE SupplierMedicines ADD IsActive BIT NOT NULL DEFAULT 1;
                ALTER TABLE SupplierMedicines ADD Status NVARCHAR(50) NULL;
            END
        ");

        // Seed default values for existing 297 rows in SupplierMedicines
        db.Database.ExecuteSqlRaw(@"
            UPDATE sm
            SET sm.ContractNumber = s.ContractNumber,
                sm.ContractQuantity = 10000,
                sm.StartDate = '2026-01-01',
                sm.EndDate = '2027-12-31',
                sm.IsActive = 1,
                sm.Status = 'Active'
            FROM SupplierMedicines sm
            INNER JOIN Suppliers s ON sm.SupplierID = s.SupplierID
            WHERE sm.ContractNumber IS NULL;
        ");

        // Upgrade ImportReceiptDetails table to store ContractPrice and ActualImportPrice
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ImportReceiptDetails') AND name = 'ContractPrice')
            BEGIN
                ALTER TABLE ImportReceiptDetails ADD ContractPrice DECIMAL(18,2) NULL;
                ALTER TABLE ImportReceiptDetails ADD ActualImportPrice DECIMAL(18,2) NULL;
            END
        ");

        // Ensure ClearanceProposals table exists
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ClearanceProposals')
            BEGIN
                CREATE TABLE ClearanceProposals (
                    ClearanceID INT IDENTITY(1,1) PRIMARY KEY,
                    BatchID INT NOT NULL,
                    SourceLocationType NVARCHAR(50) NOT NULL DEFAULT 'MainStore',
                    SourceDepartmentID INT NULL,
                    CurrentQuantity INT NOT NULL,
                    EstimatedWasteQuantity INT NOT NULL,
                    EstimatedWasteValue DECIMAL(18,2) NOT NULL DEFAULT 0,
                    AverageDailyConsumption DECIMAL(18,4) NOT NULL DEFAULT 0,
                    DaysToExpiry INT NOT NULL,
                    DaysOfSupply DECIMAL(18,2) NOT NULL DEFAULT 0,
                    RiskLevel NVARCHAR(50) NOT NULL DEFAULT 'Medium',
                    RecommendedAction NVARCHAR(50) NOT NULL DEFAULT 'InternalTransfer',
                    TargetDepartmentID INT NULL,
                    SupplierID INT NULL,
                    ProposedQuantity INT NOT NULL DEFAULT 0,
                    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
                    GeneratedTransferID INT NULL,
                    Notes NVARCHAR(MAX) NULL,
                    CreatedBy NVARCHAR(250) NOT NULL DEFAULT 'Hệ thống AI/Heuristic',
                    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
                    ResolvedAt DATETIME2 NULL,
                    ResolvedBy NVARCHAR(250) NULL,
                    ResolutionNotes NVARCHAR(MAX) NULL,
                    DigitalSignature NVARCHAR(MAX) NULL
                );
            END
        ");

        // Ensure OutpatientPrescriptions and OutpatientPrescriptionDetails tables exist
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OutpatientPrescriptions')
            BEGIN
                CREATE TABLE OutpatientPrescriptions (
                    PrescriptionID INT IDENTITY(1,1) PRIMARY KEY,
                    PrescriptionCode NVARCHAR(100) NOT NULL,
                    Barcode NVARCHAR(100) NOT NULL,
                    PatientCode NVARCHAR(100) NOT NULL,
                    PatientName NVARCHAR(250) NOT NULL,
                    BirthYear INT NULL,
                    Gender NVARCHAR(20) NOT NULL DEFAULT 'Nam',
                    Address NVARCHAR(500) NULL,
                    InsuranceCardNumber NVARCHAR(100) NULL,
                    InsuranceRate INT NOT NULL DEFAULT 80,
                    Diagnosis NVARCHAR(500) NOT NULL,
                    DoctorName NVARCHAR(250) NOT NULL DEFAULT 'BS.CKII. Nguyễn Hữu Lực',
                    DepartmentID INT NOT NULL DEFAULT 1,
                    PrescribedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
                    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
                    DispensedAt DATETIME2 NULL,
                    DispensedBy NVARCHAR(250) NULL,
                    TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
                    InsuranceCoverageAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
                    PatientCoPayAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
                    Notes NVARCHAR(MAX) NULL,
                    DigitalSignature NVARCHAR(MAX) NULL,
                    DispenserSignature NVARCHAR(MAX) NULL,
                    DoctorSignature NVARCHAR(MAX) NULL,
                    PatientSignature NVARCHAR(MAX) NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OutpatientPrescriptions') AND name = 'DispenserSignature')
                ALTER TABLE OutpatientPrescriptions ADD DispenserSignature NVARCHAR(MAX) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OutpatientPrescriptions') AND name = 'DoctorSignature')
                ALTER TABLE OutpatientPrescriptions ADD DoctorSignature NVARCHAR(MAX) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('OutpatientPrescriptions') AND name = 'PatientSignature')
                ALTER TABLE OutpatientPrescriptions ADD PatientSignature NVARCHAR(MAX) NULL;

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OutpatientPrescriptionDetails')
            BEGIN
                CREATE TABLE OutpatientPrescriptionDetails (
                    PrescriptionDetailID INT IDENTITY(1,1) PRIMARY KEY,
                    PrescriptionID INT NOT NULL FOREIGN KEY REFERENCES OutpatientPrescriptions(PrescriptionID) ON DELETE CASCADE,
                    MedicineID INT NOT NULL FOREIGN KEY REFERENCES Medicines(MedicineID),
                    AllocatedBatchID INT NULL FOREIGN KEY REFERENCES Batches(BatchID),
                    RequestedQuantity INT NOT NULL,
                    DispensedQuantity INT NOT NULL DEFAULT 0,
                    DosageInstructions NVARCHAR(500) NOT NULL DEFAULT 'Ngày uống 2 lần, mỗi lần 1 viên sau ăn',
                    MorningDose DECIMAL(4,1) NOT NULL DEFAULT 1,
                    NoonDose DECIMAL(4,1) NOT NULL DEFAULT 0,
                    AfternoonDose DECIMAL(4,1) NOT NULL DEFAULT 0,
                    NightDose DECIMAL(4,1) NOT NULL DEFAULT 1,
                    UsageTime NVARCHAR(100) NOT NULL DEFAULT 'Sau ăn 30 phút',
                    UnitPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
                    Amount DECIMAL(18,2) NOT NULL DEFAULT 0
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PatientAdrReports')
            BEGIN
                CREATE TABLE PatientAdrReports (
                    AdrReportID INT IDENTITY(1,1) PRIMARY KEY,
                    PrescriptionID INT NOT NULL FOREIGN KEY REFERENCES OutpatientPrescriptions(PrescriptionID) ON DELETE CASCADE,
                    PatientName NVARCHAR(250) NOT NULL,
                    ContactPhone NVARCHAR(50) NOT NULL,
                    ReactionSeverity NVARCHAR(50) NOT NULL DEFAULT 'Moderate',
                    Symptoms NVARCHAR(1000) NOT NULL,
                    SuspectedMedicine NVARCHAR(250) NULL,
                    OnsetMinutes NVARCHAR(100) NULL,
                    ReportedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
                    IsReviewed BIT NOT NULL DEFAULT 0,
                    ReviewedBy NVARCHAR(250) NULL,
                    ReviewedAt DATETIME2 NULL,
                    PharmacistNotes NVARCHAR(1000) NULL
                );
            END
        ");

        // Ensure DepartmentStocks has valid stock for DepartmentID = 1 (Khoa Khám Bệnh - Quầy Dược)
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM DepartmentStocks WHERE DepartmentID = 1)
            BEGIN
                INSERT INTO DepartmentStocks (DepartmentID, BatchID, CurrentQuantity)
                SELECT 1, BatchID, 80 FROM Batches WHERE Status != 'Tiêu hủy' AND ExpiryDate >= GETDATE();
            END
            UPDATE DepartmentStocks SET CurrentQuantity = 120 WHERE DepartmentID = 1 AND BatchID = 1 AND CurrentQuantity < 50; -- Paracetamol
            UPDATE DepartmentStocks SET CurrentQuantity = 100 WHERE DepartmentID = 1 AND BatchID = 5 AND CurrentQuantity < 50; -- Hapacol later batch
            UPDATE DepartmentStocks SET CurrentQuantity = 80 WHERE DepartmentID = 1 AND BatchID = 11 AND CurrentQuantity < 30; -- Celecoxib
            UPDATE DepartmentStocks SET CurrentQuantity = 100 WHERE DepartmentID = 1 AND BatchID = 22 AND CurrentQuantity < 50; -- Vitamin B6
        ");

        // Seed initial pending prescriptions if none exist
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM OutpatientPrescriptions WHERE PrescriptionCode = 'DT-20260906-0001')
            BEGIN
                INSERT INTO OutpatientPrescriptions (
                    PrescriptionCode, Barcode, PatientCode, PatientName, BirthYear, Gender, Address,
                    InsuranceCardNumber, InsuranceRate, Diagnosis, DoctorName, DepartmentID, PrescribedAt,
                    Status, TotalAmount, InsuranceCoverageAmount, PatientCoPayAmount, Notes
                ) VALUES (
                    'DT-20260906-0001', '893000100001', 'BN-002847', N'Nguyễn Văn Hùng', 1981, N'Nam', N'128 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM',
                    'DN4791234567890', 80, N'J02.9 - Viêm họng cấp / Sốt nhiễm siêu vi', N'BS.CKII. Nguyễn Hữu Lực', 1, GETDATE(),
                    'Pending', 163000, 130400, 32600, N'Bệnh nhân sốt cao 38.5 độ 2 ngày, nuốt đau'
                );
                DECLARE @p1_id INT = SCOPE_IDENTITY();
                INSERT INTO OutpatientPrescriptionDetails (PrescriptionID, MedicineID, RequestedQuantity, DispensedQuantity, DosageInstructions, MorningDose, NoonDose, AfternoonDose, NightDose, UsageTime, UnitPrice, Amount)
                VALUES 
                (@p1_id, 154, 10, 0, N'Ngày uống 2 lần, mỗi lần 1 viên sau ăn, hạ sốt khi > 38.5°C', 1, 0, 0, 1, N'Sau ăn no', 8500, 85000),
                (@p1_id, 166, 10, 0, N'Ngày uống 1 lần, mỗi lần 1 viên vào buổi sáng', 1, 0, 0, 0, N'Sáng sau ăn', 7800, 78000);
            END

            IF NOT EXISTS (SELECT * FROM OutpatientPrescriptions WHERE PrescriptionCode = 'DT-20260906-0002')
            BEGIN
                INSERT INTO OutpatientPrescriptions (
                    PrescriptionCode, Barcode, PatientCode, PatientName, BirthYear, Gender, Address,
                    InsuranceCardNumber, InsuranceRate, Diagnosis, DoctorName, DepartmentID, PrescribedAt,
                    Status, TotalAmount, InsuranceCoverageAmount, PatientCoPayAmount, Notes
                ) VALUES (
                    'DT-20260906-0002', '893000100002', 'BN-003192', N'Trần Thị Mai Loan', 1954, N'Nữ', N'45 Nguyễn Trãi, Phường 2, Quận 5, TP.HCM',
                    'HT2799876543210', 100, N'M17 - Thoái hóa khớp gối hai bên / Đau nhức khớp mạn tính', N'BS.CKII. Nguyễn Hữu Lực', 1, GETDATE(),
                    'Pending', 63200, 63200, 0, N'Đối tượng BHYT Hưu trí chi trả 100%. Dặn dò uống sau ăn no tránh kích ứng dạ dày'
                );
                DECLARE @p2_id INT = SCOPE_IDENTITY();
                INSERT INTO OutpatientPrescriptionDetails (PrescriptionID, MedicineID, RequestedQuantity, DispensedQuantity, DosageInstructions, MorningDose, NoonDose, AfternoonDose, NightDose, UsageTime, UnitPrice, Amount)
                VALUES 
                (@p2_id, 156, 14, 0, N'Ngày uống 2 lần, mỗi lần 1 viên sau khi ăn no', 1, 0, 0, 1, N'Sau ăn', 2800, 39200),
                (@p2_id, 153, 20, 0, N'Ngày uống 2 lần, mỗi lần 1 viên khi đau nhức', 1, 0, 0, 1, N'Sau ăn', 1200, 24000);
            END

            IF NOT EXISTS (SELECT * FROM OutpatientPrescriptions WHERE PrescriptionCode = 'DT-20260906-0003')
            BEGIN
                INSERT INTO OutpatientPrescriptions (
                    PrescriptionCode, Barcode, PatientCode, PatientName, BirthYear, Gender, Address,
                    InsuranceCardNumber, InsuranceRate, Diagnosis, DoctorName, DepartmentID, PrescribedAt,
                    Status, TotalAmount, InsuranceCoverageAmount, PatientCoPayAmount, Notes
                ) VALUES (
                    'DT-20260906-0003', '893000100003', 'BN-004051', N'Lê Minh Tuấn', 1997, N'Nam', N'72 Hoàng Hoa Thám, Phường 12, Bình Thạnh, TP.HCM',
                    NULL, 0, N'K29.0 - Viêm dạ dày cấp tính / Trào ngược dạ dày thực quản (GERD)', N'BS.CKII. Nguyễn Hữu Lực', 1, GETDATE(),
                    'Pending', 109470, 0, 109470, N'Bệnh nhân khám dịch vụ theo yêu cầu (Không dùng thẻ BHYT). Bệnh nhân tự chi trả 100%'
                );
                DECLARE @p3_id INT = SCOPE_IDENTITY();
                INSERT INTO OutpatientPrescriptionDetails (PrescriptionID, MedicineID, RequestedQuantity, DispensedQuantity, DosageInstructions, MorningDose, NoonDose, AfternoonDose, NightDose, UsageTime, UnitPrice, Amount)
                VALUES 
                (@p3_id, 11, 15, 0, N'Ngày uống 3 lần, mỗi lần 1 viên trước các bữa ăn 15-30 phút', 1, 1, 0, 1, N'Trước ăn 20 phút', 6098, 91470),
                (@p3_id, 153, 15, 0, N'Ngày uống 1-2 lần khi đau quặn bụng, mỗi lần 1 viên', 1, 0, 0, 1, N'Sau ăn', 1200, 18000);
            END

            IF NOT EXISTS (SELECT * FROM OutpatientPrescriptions WHERE PrescriptionCode = 'DT-20260906-0004')
            BEGIN
                INSERT INTO OutpatientPrescriptions (
                    PrescriptionCode, Barcode, PatientCode, PatientName, BirthYear, Gender, Address,
                    InsuranceCardNumber, InsuranceRate, Diagnosis, DoctorName, DepartmentID, PrescribedAt,
                    Status, TotalAmount, InsuranceCoverageAmount, PatientCoPayAmount, Notes
                ) VALUES (
                    'DT-20260906-0004', '893000100004', 'BN-005118', N'Phạm Hồng Phúc', 1963, N'Nam', N'305 Võ Văn Tần, Phường 5, Quận 3, TP.HCM',
                    'GD4795551234567', 80, N'M54.5 - Đau thắt lưng cơ năng cấp / Căng cơ cạnh sống', N'BS.CKII. Nguyễn Hữu Lực', 1, GETDATE(),
                    'Pending', 229000, 183200, 45800, N'Khuyên bệnh nhân nghỉ ngơi, tránh mang vác vật nặng và tái khám sau 7 ngày'
                );
                DECLARE @p4_id INT = SCOPE_IDENTITY();
                INSERT INTO OutpatientPrescriptionDetails (PrescriptionID, MedicineID, RequestedQuantity, DispensedQuantity, DosageInstructions, MorningDose, NoonDose, AfternoonDose, NightDose, UsageTime, UnitPrice, Amount)
                VALUES 
                (@p4_id, 156, 10, 0, N'Ngày uống 2 lần, mỗi lần 1 viên sau ăn', 1, 0, 0, 1, N'Sau ăn', 2800, 28000),
                (@p4_id, 166, 15, 0, N'Ngày uống 1 lần, mỗi lần 1 viên buổi sáng', 1, 0, 0, 0, N'Sáng sau ăn', 7800, 117000),
                (@p4_id, 154, 10, 0, N'Ngày uống 2 lần khi đau nhức, mỗi lần 1 viên', 1, 0, 0, 1, N'Sau ăn no', 8500, 85000);
            END
        ");
    }
    catch (Exception ex)
    {
        Console.WriteLine("Error verifying/adding columns: " + ex.Message);
    }
}

app.UseCors("AllowFrontend");

// In development/production, serve endpoints without requiring HTTPS redirect locally for easier integration
app.UseAuthorization();
app.MapControllers();

// Map real-time pharmacy SignalR Hub
app.MapHub<PharmacyHub>("/pharmacyHub");

if (app.Environment.IsDevelopment())
{
    var frontendPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "..", "frontend"));
    if (Directory.Exists(frontendPath))
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/c npm run dev",
                WorkingDirectory = frontendPath,
                UseShellExecute = true,
                CreateNoWindow = false
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Vite Automatic Startup] Failed: {ex.Message}");
        }
    }
}

app.Run();
