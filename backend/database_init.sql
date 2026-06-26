-- Create Database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'HisPharmacyDB')
BEGIN
    CREATE DATABASE HisPharmacyDB;
END
GO
USE HisPharmacyDB;
GO

-- Drop triggers if they exist
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_AfterInsertImportDetails')
    DROP TRIGGER trg_AfterInsertImportDetails;
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_AfterUpdateImportReceipts')
    DROP TRIGGER trg_AfterUpdateImportReceipts;
GO

-- Drop tables if they exist to start clean
IF OBJECT_ID('PurchaseProposalDetails', 'U') IS NOT NULL DROP TABLE PurchaseProposalDetails;
IF OBJECT_ID('PurchaseProposals', 'U') IS NOT NULL DROP TABLE PurchaseProposals;
IF OBJECT_ID('LiquidationReceiptDetails', 'U') IS NOT NULL DROP TABLE LiquidationReceiptDetails;
IF OBJECT_ID('LiquidationReceipts', 'U') IS NOT NULL DROP TABLE LiquidationReceipts;
IF OBJECT_ID('ReturnReceiptDetails', 'U') IS NOT NULL DROP TABLE ReturnReceiptDetails;
IF OBJECT_ID('ReturnReceipts', 'U') IS NOT NULL DROP TABLE ReturnReceipts;
IF OBJECT_ID('InternalTransferDetails', 'U') IS NOT NULL DROP TABLE InternalTransferDetails;
IF OBJECT_ID('InternalTransfers', 'U') IS NOT NULL DROP TABLE InternalTransfers;
IF OBJECT_ID('ImportReceiptDetails', 'U') IS NOT NULL DROP TABLE ImportReceiptDetails;
IF OBJECT_ID('ImportReceipts', 'U') IS NOT NULL DROP TABLE ImportReceipts;
IF OBJECT_ID('CabinetTransactions', 'U') IS NOT NULL DROP TABLE CabinetTransactions;
IF OBJECT_ID('MedicineRequisitionDetails', 'U') IS NOT NULL DROP TABLE MedicineRequisitionDetails;
IF OBJECT_ID('MedicineRequisitions', 'U') IS NOT NULL DROP TABLE MedicineRequisitions;
IF OBJECT_ID('DepartmentStocks', 'U') IS NOT NULL DROP TABLE DepartmentStocks;
IF OBJECT_ID('InventoryStocks', 'U') IS NOT NULL DROP TABLE InventoryStocks;
IF OBJECT_ID('Batches', 'U') IS NOT NULL DROP TABLE Batches;
IF OBJECT_ID('Users', 'U') IS NOT NULL DROP TABLE Users;
IF OBJECT_ID('Departments', 'U') IS NOT NULL DROP TABLE Departments;
IF OBJECT_ID('Medicines', 'U') IS NOT NULL DROP TABLE Medicines;
IF OBJECT_ID('Suppliers', 'U') IS NOT NULL DROP TABLE Suppliers;
GO

-- 1. Suppliers
CREATE TABLE Suppliers (
    SupplierID INT IDENTITY(1,1) PRIMARY KEY,
    SupplierName NVARCHAR(255) NOT NULL,
    Phone VARCHAR(20),
    Address NVARCHAR(500),
    ContractNumber NVARCHAR(100) -- Số hợp đồng mua bán cố định
);

-- 2. Medicines
CREATE TABLE Medicines (
    MedicineID INT IDENTITY(1,1) PRIMARY KEY,
    MedicineCode VARCHAR(50) UNIQUE NOT NULL,
    MedicineName NVARCHAR(255) NOT NULL,
    GenericName NVARCHAR(255), -- Tên gốc / Hoạt chất
    Specification NVARCHAR(100), -- Quy cách
    Manufacturer NVARCHAR(100),
    Unit NVARCHAR(50) NOT NULL, -- Viên, vỉ, chai...
    MinInventory INT DEFAULT 10,
    MedicineGroup NVARCHAR(100) NOT NULL DEFAULT N'Dược phẩm khác'
);

-- 3. Departments
CREATE TABLE Departments (
    DepartmentID INT IDENTITY(1,1) PRIMARY KEY,
    DepartmentName NVARCHAR(100) NOT NULL
);

-- 3.1 Users
CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username VARCHAR(50) UNIQUE NOT NULL,
    Password VARCHAR(100) NOT NULL,
    FullName NVARCHAR(100) NOT NULL,
    Role VARCHAR(50) NOT NULL, -- 'pharmacist', 'nurse', 'director'
    DepartmentID INT FOREIGN KEY REFERENCES Departments(DepartmentID)
);

-- 4. Batches
CREATE TABLE Batches (
    BatchID INT IDENTITY(1,1) PRIMARY KEY,
    MedicineID INT FOREIGN KEY REFERENCES Medicines(MedicineID),
    BatchNumber VARCHAR(50) NOT NULL, -- Số lô
    ProductionDate DATE, -- Ngày sản xuất
    ExpiryDate DATE NOT NULL, -- Hạn dùng
    ImportPrice DECIMAL(18,2) NOT NULL,
    QuantityOriginal INT NOT NULL
);

-- 5. InventoryStocks (Kho chẵn chính)
CREATE TABLE InventoryStocks (
    StockID INT IDENTITY(1,1) PRIMARY KEY,
    BatchID INT UNIQUE FOREIGN KEY REFERENCES Batches(BatchID),
    CurrentQuantity INT NOT NULL CHECK (CurrentQuantity >= 0)
);

-- 6. DepartmentStocks (Kho lẻ / Tủ trực khoa lâm sàng)
CREATE TABLE DepartmentStocks (
    DepartmentStockID INT IDENTITY(1,1) PRIMARY KEY,
    DepartmentID INT FOREIGN KEY REFERENCES Departments(DepartmentID),
    BatchID INT FOREIGN KEY REFERENCES Batches(BatchID),
    CurrentQuantity INT NOT NULL CHECK (CurrentQuantity >= 0),
    CONSTRAINT UC_Dept_Batch UNIQUE (DepartmentID, BatchID)
);

-- 7. MedicineRequisitions & Details (Phiếu dự trù / Lĩnh thuốc)
CREATE TABLE MedicineRequisitions (
    RequisitionID INT IDENTITY(1,1) PRIMARY KEY,
    DepartmentID INT FOREIGN KEY REFERENCES Departments(DepartmentID),
    RequisitionDate DATETIME DEFAULT GETDATE(),
    RequisitionType NVARCHAR(50) NOT NULL, -- 'Regular' hoặc 'CabinetRefill'
    Status NVARCHAR(50) DEFAULT 'Pending', -- Pending, Approved, Rejected 
    DigitalSignature NVARCHAR(MAX) NULL, -- Ảnh chữ ký số (Base64) người lập phiếu đề nghị (Điều dưỡng)
    ApproverSignature NVARCHAR(MAX) NULL, -- Ảnh chữ ký số (Base64) người duyệt cấp phát (Thủ khoa)
    RejectReason NVARCHAR(255) NULL -- Lý do từ chối phiếu cấp phát
);

CREATE TABLE MedicineRequisitionDetails (
    RequisitionDetailID INT IDENTITY(1,1) PRIMARY KEY,
    RequisitionID INT FOREIGN KEY REFERENCES MedicineRequisitions(RequisitionID) ON DELETE CASCADE,
    MedicineID INT FOREIGN KEY REFERENCES Medicines(MedicineID),
    RequestedQuantity INT NOT NULL,
    DispensedQuantity INT NULL -- Số lượng thực cấp
);

-- 8. CabinetTransactions (Nhật ký xuất tủ trực cho bệnh nhân)
CREATE TABLE CabinetTransactions (
    TransactionID INT IDENTITY(1,1) PRIMARY KEY,
    DepartmentID INT FOREIGN KEY REFERENCES Departments(DepartmentID),
    BatchID INT FOREIGN KEY REFERENCES Batches(BatchID),
    PatientCode VARCHAR(50) NOT NULL,
    PatientName NVARCHAR(100) NOT NULL,
    Quantity INT NOT NULL,
    TransactionDate DATETIME DEFAULT GETDATE(),
    IsRefilled BIT DEFAULT 0, -- 0: Chưa bù, 1: Đã đưa vào phiếu bù tủ trực
    RequisitionID INT FOREIGN KEY REFERENCES MedicineRequisitions(RequisitionID)
);

-- 9. ImportReceipts & Details (Phiếu nhập kho chẵn)
CREATE TABLE ImportReceipts (
    ImportID INT IDENTITY(1,1) PRIMARY KEY,
    ImportCode VARCHAR(50) UNIQUE NOT NULL, -- Số phiếu nhập nội bộ tự sinh
    ContractNumber NVARCHAR(100),           -- Số hợp đồng mua bán
    InvoiceNumber VARCHAR(50),               -- Số hóa đơn GTGT từ nhà cung cấp
    SupplierID INT FOREIGN KEY REFERENCES Suppliers(SupplierID),
    ImportDate DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NOT NULL DEFAULT N'Thủ kho Dược', -- Người kiểm nhập
    Notes NVARCHAR(500),                     -- Ghi chú phiếu nhập
    Status NVARCHAR(50) NOT NULL DEFAULT N'Đã kiểm', -- Trạng thái kiểm nhập: Chờ kiểm, Đã kiểm, Từ chối, Thiếu hàng
    InvoiceDate DATE NULL,                   -- Ngày hóa đơn tài chính
    DeliveryNoteNumber NVARCHAR(100) NULL,   -- Số phiếu xuất kho của nhà cung cấp
    SecondInspector NVARCHAR(100) NULL,      -- Dược sĩ cùng kiểm tra
    AnomalyDescription NVARCHAR(MAX) NULL,   -- Mô tả chi tiết bất thường
    DocumentsJson NVARCHAR(MAX) NULL,         -- Chuỗi JSON lưu tệp đính kèm (Hóa đơn, COA, COO, Ảnh...)
    DigitalSignature NVARCHAR(MAX) NULL,     -- Ảnh chữ ký số (Base64) người nhận/lập phiếu
    SecondInspectorSignature NVARCHAR(MAX) NULL, -- Ảnh chữ ký số (Base64) người kiểm thứ hai
    DeliveryPersonSignature NVARCHAR(MAX) NULL,  -- Ảnh chữ ký số (Base64) người giao hàng
    ApproverSignature NVARCHAR(MAX) NULL  -- Ảnh chữ ký số (Base64) người duyệt nhập kho (Ban lãnh đạo)
);

CREATE TABLE ImportReceiptDetails (
    ImportDetailID INT IDENTITY(1,1) PRIMARY KEY,
    ImportID INT FOREIGN KEY REFERENCES ImportReceipts(ImportID) ON DELETE CASCADE,
    BatchID INT FOREIGN KEY REFERENCES Batches(BatchID),
    Quantity INT NOT NULL
);

-- 10. InternalTransfers & Details (Phiếu xuất chuyển kho chẵn -> lẻ)
CREATE TABLE InternalTransfers (
    TransferID INT IDENTITY(1,1) PRIMARY KEY,
    FromDepartmentID INT FOREIGN KEY REFERENCES Departments(DepartmentID), -- NULL nếu từ kho chẵn
    ToDepartmentID INT FOREIGN KEY REFERENCES Departments(DepartmentID),
    TransferDate DATETIME DEFAULT GETDATE(),
    DigitalSignature NVARCHAR(MAX) NULL, -- Ảnh chữ ký số (Base64) thủ kho xuất chuyển trực tiếp
    RequisitionID INT NULL FOREIGN KEY REFERENCES MedicineRequisitions(RequisitionID) ON DELETE SET NULL
);

CREATE TABLE InternalTransferDetails (
    TransferDetailID INT IDENTITY(1,1) PRIMARY KEY,
    TransferID INT FOREIGN KEY REFERENCES InternalTransfers(TransferID) ON DELETE CASCADE,
    BatchID INT FOREIGN KEY REFERENCES Batches(BatchID),
    Quantity INT NOT NULL
);

-- 11. ReturnReceipts & Details (Phiếu hoàn trả thuốc thừa)
CREATE TABLE ReturnReceipts (
    ReturnID INT IDENTITY(1,1) PRIMARY KEY,
    DepartmentID INT FOREIGN KEY REFERENCES Departments(DepartmentID),
    ReturnDate DATETIME DEFAULT GETDATE(),
    Status NVARCHAR(50) DEFAULT 'Pending', -- Pending, Approved
    DigitalSignature NVARCHAR(MAX) NULL, -- Ảnh chữ ký số (Base64) người trả hàng
    ApproverSignature NVARCHAR(MAX) NULL -- Ảnh chữ ký số (Base64) người duyệt nhận
);

CREATE TABLE ReturnReceiptDetails (
    ReturnDetailID INT IDENTITY(1,1) PRIMARY KEY,
    ReturnID INT FOREIGN KEY REFERENCES ReturnReceipts(ReturnID) ON DELETE CASCADE,
    BatchID INT FOREIGN KEY REFERENCES Batches(BatchID),
    Quantity INT NOT NULL
);

-- 12. LiquidationReceipts & Details (Phiếu thanh lý hỏng, vỡ, hết hạn)
CREATE TABLE LiquidationReceipts (
    LiquidationID INT IDENTITY(1,1) PRIMARY KEY,
    LiquidationDate DATETIME DEFAULT GETDATE(),
    Reason NVARCHAR(255),
    DigitalSignature NVARCHAR(MAX) NULL  -- Ảnh chữ ký số (Base64) người lập/duyệt thanh lý
);

CREATE TABLE LiquidationReceiptDetails (
    LiquidationDetailID INT IDENTITY(1,1) PRIMARY KEY,
    LiquidationID INT FOREIGN KEY REFERENCES LiquidationReceipts(LiquidationID) ON DELETE CASCADE,
    BatchID INT FOREIGN KEY REFERENCES Batches(BatchID),
    Quantity INT NOT NULL
);

-- 13. PurchaseProposals & Details (Phiếu đề xuất mua hàng)
CREATE TABLE PurchaseProposals (
    ProposalID INT IDENTITY(1,1) PRIMARY KEY,
    SupplierID INT FOREIGN KEY REFERENCES Suppliers(SupplierID),
    ProposalDate DATETIME DEFAULT GETDATE(),
    Status NVARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Approved', 'Ordered'
    Reason NVARCHAR(255),
    CreatedBy NVARCHAR(100) NOT NULL,
    ApprovedBy NVARCHAR(100),
    DigitalSignature NVARCHAR(MAX),
    ProposerSignature NVARCHAR(MAX) NULL
);

CREATE TABLE PurchaseProposalDetails (
    ProposalDetailID INT IDENTITY(1,1) PRIMARY KEY,
    ProposalID INT FOREIGN KEY REFERENCES PurchaseProposals(ProposalID) ON DELETE CASCADE,
    MedicineID INT FOREIGN KEY REFERENCES Medicines(MedicineID),
    CurrentQuantity INT NOT NULL,
    MinInventory INT NOT NULL,
    SuggestedQuantity INT NOT NULL
);
GO

-- ====================================================================
-- TRIGGERS FOR REAL-TIME STOCK INVENTORY CONTROL (Handles Multi-row inserts/updates)
-- ====================================================================

-- Trigger 1: Xử lý tăng tồn kho khi thêm mới chi tiết phiếu nhập (chỉ khi phiếu có trạng thái 'Đã nhập kho', 'Đã kiểm' hoặc 'Thiếu hàng')
CREATE TRIGGER trg_AfterInsertImportDetails
ON ImportReceiptDetails
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    MERGE InventoryStocks AS target
    USING (
        SELECT d.BatchID, SUM(d.Quantity) AS Qty 
        FROM inserted d
        INNER JOIN ImportReceipts r ON d.ImportID = r.ImportID
        WHERE r.Status IN (N'Đã nhập kho', N'Đã kiểm', N'Thiếu hàng', N'Approved', N'Shortage')
        GROUP BY d.BatchID
    ) AS source
    ON target.BatchID = source.BatchID
    WHEN MATCHED THEN
        UPDATE SET target.CurrentQuantity = target.CurrentQuantity + source.Qty
    WHEN NOT MATCHED THEN
        INSERT (BatchID, CurrentQuantity) VALUES (source.BatchID, source.Qty);
END;
GO

-- Trigger 2: Xử lý tăng tồn kho khi phê duyệt phiếu nhập từ trạng thái khác sang 'Đã nhập kho', 'Đã kiểm' hoặc 'Thiếu hàng'
CREATE TRIGGER trg_AfterUpdateImportReceipts
ON ImportReceipts
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (
        SELECT 1 
        FROM inserted i
        INNER JOIN deleted d ON i.ImportID = d.ImportID
        WHERE i.Status IN (N'Đã nhập kho', N'Đã kiểm', N'Thiếu hàng', N'Approved', N'Shortage')
          AND d.Status NOT IN (N'Đã nhập kho', N'Đã kiểm', N'Thiếu hàng', N'Approved', N'Shortage')
    )
    BEGIN
        MERGE InventoryStocks AS target
        USING (
            SELECT det.BatchID, SUM(det.Quantity) AS Qty
            FROM ImportReceiptDetails det
            INNER JOIN inserted i ON det.ImportID = i.ImportID
            INNER JOIN deleted d ON i.ImportID = d.ImportID
            WHERE i.Status IN (N'Đã nhập kho', N'Đã kiểm', N'Thiếu hàng', N'Approved', N'Shortage')
              AND d.Status NOT IN (N'Đã nhập kho', N'Đã kiểm', N'Thiếu hàng', N'Approved', N'Shortage')
            GROUP BY det.BatchID
        ) AS source
        ON target.BatchID = source.BatchID
        WHEN MATCHED THEN
            UPDATE SET target.CurrentQuantity = target.CurrentQuantity + source.Qty
        WHEN NOT MATCHED THEN
            INSERT (BatchID, CurrentQuantity) VALUES (source.BatchID, source.Qty);
    END
END;
GO

INSERT INTO Suppliers (SupplierName, Phone, Address, ContractNumber) VALUES 
(N'Công ty Dược phẩm Trung Ương 1', '02438254348', N'Hà Nội', 'HĐ-001/TW1/2026'),
(N'Dược Hậu Giang (DHG PHARMA)', '02923891433', N'Cần Thơ', 'HĐ-025/DHG/2026'),
(N'Công ty Cổ phần Dược phẩm OPC', '02839601050', N'TP. Hồ Chí Minh', 'HĐ-012/OPC/2026'),
(N'Công ty TNHH Dược phẩm An Khang', '028 3822 1456', N'125 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh', 'HD2026-ANK001'),
(N'Công ty Cổ phần Thiết bị Y tế Minh Tâm', '0274 389 7766', N'45 Đại lộ Bình Dương, TP. Thủ Dầu Một, Bình Dương', 'HD2026-MT002'),
(N'Công ty TNHH Vật tư Y tế Hòa Phát', '028 3975 2244', N'78 Lê Văn Sỹ, Quận Phú Nhuận, TP. Hồ Chí Minh', 'HD2026-HP003');

INSERT INTO Departments (DepartmentName) VALUES 
(N'Khoa Khám Bệnh'), 
(N'Khoa Cấp Cứu'), 
(N'Khoa Nội Tổng Hợp'), 
(N'Khoa Xét Nghiệm'), 
(N'Khoa Đông Y');

INSERT INTO Users (Username, Password, FullName, Role, DepartmentID) VALUES 
('thukho', '123', N'Dược sĩ Nguyễn Văn Khoa', 'pharmacist', NULL),
('dieuduong', '123', N'Điều dưỡng Trần Thị Hồng', 'nurse', 2), -- Khoa Cấp Cứu
('giamdoc', '123', N'PGS.TS. Lê Minh Dược', 'director', NULL);

-- Khôi phục danh mục thuốc và vật tư y tế chuẩn hóa theo mã tự sinh mới
INSERT INTO Medicines (MedicineCode, MedicineName, GenericName, Specification, Manufacturer, Unit, MinInventory, MedicineGroup) VALUES 
('THUOC-0001', N'Paracetamol 500mg', 'Paracetamol', N'Hộp 10 vỉ x 10 viên', N'DHG Pharma', N'Viên', 100, N'Giảm đau & Hạ sốt'),
('THUOC-0002', N'Amoxicillin 500mg', 'Amoxicillin', N'Hộp 10 vỉ x 10 viên', N'Mekophar', N'Viên', 50, N'Kháng sinh'),
('THUOC-0003', N'Augmentin 1g', 'Amoxicillin + Clavulanate', N'Hộp 12 gói', N'GSK', N'Gói', 20, N'Kháng sinh'),
('THUOC-0004', N'Vitamin C 500mg', 'Acid Ascorbic', N'Hộp 100 viên', N'OPC', N'Viên', 100, N'Vitamin & Bổ trợ'),
('THUOC-0005', N'Cefuroxim 500mg', 'Cefuroxim', N'Hộp 2 vỉ x 5 viên', N'DHG Pharma', N'Viên', 40, N'Kháng sinh'),
('VATTU-0001', N'Bông hút nước y tế', NULL, N'Cuộn 100g', N'Bảo Thạch', N'Cuộn', 30, N'Dược phẩm khác'),
('VATTU-0002', N'Băng cuộn y tế', NULL, N'Gói 1 cuộn 2m', N'Bảo Thạch', N'Cuộn', 50, N'Dược phẩm khác'),
('VATTU-0003', N'Bơm tiêm vô trùng 5ml', NULL, N'Hộp 100 cái', N'MPV', N'Cái', 100, N'Dược phẩm khác');
GO

-- 14. Seed Batches
-- Batch 1: Amoxicillin 500mg (MedicineID = 2)
-- Batch 2: Paracetamol 500mg (MedicineID = 1)
-- Batch 3: Vitamin C 500mg (MedicineID = 4)
-- Batch 4: Augmentin 1g (MedicineID = 3)
-- Batch 5: Bơm tiêm vô trùng 5ml (MedicineID = 8)
-- Batch 6: Băng cuộn y tế (MedicineID = 7)
INSERT INTO Batches (MedicineID, BatchNumber, ProductionDate, ExpiryDate, ImportPrice, QuantityOriginal) VALUES 
(2, 'AMX-2601', '2026-01-15', '2027-01-15', 1800.00, 1000),
(1, 'PCT-2603', '2026-03-10', '2027-09-10', 500.00, 5000),
(4, 'VTC-2602', '2026-02-20', '2026-12-20', 1200.00, 2000),
(3, 'AUG-2601', '2026-01-20', '2027-07-20', 15000.00, 500),
(8, 'BTM-2601', '2026-01-01', '2028-01-01', 1200.00, 5000),
(7, 'BCY-2601', '2026-01-01', '2027-06-01', 4500.00, 300);

-- 15. Seed InventoryStocks (Main Store)
INSERT INTO InventoryStocks (BatchID, CurrentQuantity) VALUES 
(1, 800), -- 800 Amoxicillin left in Main Store
(2, 4500), -- 4500 Paracetamol left in Main Store
(3, 1500), -- 1500 Vitamin C left in Main Store
(4, 400),  -- 400 Augmentin left in Main Store
(5, 4500), -- 4500 Bơm tiêm left in Main Store
(6, 250);  -- 250 Băng cuộn left in Main Store

-- 16. Seed DepartmentStocks (Cabinet of Khoa Cấp Cứu - DepartmentID = 2)
INSERT INTO DepartmentStocks (DepartmentID, BatchID, CurrentQuantity) VALUES 
(2, 1, 150), -- 150 Amoxicillin in Cabinet
(2, 2, 300), -- 300 Paracetamol in Cabinet
(2, 3, 200), -- 200 Vitamin C in Cabinet
(2, 5, 100), -- 100 Bơm tiêm in Cabinet
(2, 6, 30);  -- 30 Băng cuộn in Cabinet
GO

-- 17. Seed MedicineRequisitions (Yêu cầu cấp phát / Bù tủ trực)
-- Requisition 1: Pending Cabinet Refill from Khoa Cấp Cứu (Department 2)
INSERT INTO MedicineRequisitions (DepartmentID, RequisitionDate, RequisitionType, Status) VALUES 
(2, DATEADD(minute, -30, GETDATE()), 'CabinetRefill', 'Pending');

INSERT INTO MedicineRequisitionDetails (RequisitionID, MedicineID, RequestedQuantity) VALUES 
(1, 2, 50), -- 50 Amoxicillin
(1, 4, 30); -- 30 Vitamin C

-- Requisition 2: Approved Regular Requisition from Khoa Cấp Cứu (Department 2)
INSERT INTO MedicineRequisitions (DepartmentID, RequisitionDate, RequisitionType, Status) VALUES 
(2, DATEADD(hour, -2, GETDATE()), 'Regular', 'Approved');

INSERT INTO MedicineRequisitionDetails (RequisitionID, MedicineID, RequestedQuantity) VALUES 
(2, 1, 100); -- 100 Paracetamol

-- Requisition 3: Pending Regular Requisition for Medical Supplies (Vật tư y tế) from Khoa Cấp Cứu (Department 2)
INSERT INTO MedicineRequisitions (DepartmentID, RequisitionDate, RequisitionType, Status) VALUES 
(2, DATEADD(minute, -10, GETDATE()), 'Regular', 'Pending');

INSERT INTO MedicineRequisitionDetails (RequisitionID, MedicineID, RequestedQuantity) VALUES 
(3, 8, 200), -- 200 Bơm tiêm vô trùng 5ml
(3, 7, 50);  -- 50 Băng cuộn y tế
GO


