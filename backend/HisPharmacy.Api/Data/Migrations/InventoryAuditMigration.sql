-- 1. Thêm cột PriorityLevel vào bảng Medicines nếu chưa tồn tại
USE HisPharmacyDB;
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Medicines') AND name = 'PriorityLevel')
BEGIN
    ALTER TABLE Medicines ADD PriorityLevel NVARCHAR(20) NOT NULL DEFAULT 'Low';
END
GO

-- Cập nhật PriorityLevel cho các loại thuốc hiện tại
UPDATE Medicines SET PriorityLevel = 'Medium' WHERE MedicineGroup = N'Kháng sinh';
UPDATE Medicines SET PriorityLevel = 'Low' WHERE MedicineGroup <> N'Kháng sinh';
GO

-- 2. Thêm thuốc gây nghiện và hướng thần vào danh mục để demo kiểm kê
IF NOT EXISTS (SELECT * FROM Medicines WHERE MedicineCode = 'THUOC-0006')
BEGIN
    INSERT INTO Medicines (MedicineCode, MedicineName, GenericName, Specification, Manufacturer, Unit, MinInventory, MedicineGroup, PriorityLevel) VALUES 
    ('THUOC-0006', N'Morphin HCL 10mg/ml', 'Morphine', N'Hộp 10 ống tiêm 1ml', N'Trung ương 1', N'Ống', 20, N'Thuốc gây nghiện', 'Critical');
END

IF NOT EXISTS (SELECT * FROM Medicines WHERE MedicineCode = 'THUOC-0007')
BEGIN
    INSERT INTO Medicines (MedicineCode, MedicineName, GenericName, Specification, Manufacturer, Unit, MinInventory, MedicineGroup, PriorityLevel) VALUES 
    ('THUOC-0007', N'Diazepam 5mg', 'Diazepam', N'Hộp 10 vỉ x 10 viên', N'Vidipha', N'Viên', 100, N'Thuốc hướng thần', 'High');
END
GO

-- Seed batches & stocks cho Morphin và Diazepam nếu chưa có
DECLARE @morphine_id INT;
SELECT @morphine_id = MedicineID FROM Medicines WHERE MedicineCode = 'THUOC-0006';
IF @morphine_id IS NOT NULL AND NOT EXISTS (SELECT * FROM Batches WHERE MedicineID = @morphine_id)
BEGIN
    INSERT INTO Batches (MedicineID, BatchNumber, ProductionDate, ExpiryDate, ImportPrice, QuantityOriginal)
    VALUES (@morphine_id, 'MPH-2605', '2026-05-10', '2027-05-10', 25000.00, 1000);
    
    DECLARE @morphine_batch_id INT = @@IDENTITY;
    INSERT INTO InventoryStocks (BatchID, CurrentQuantity) VALUES (@morphine_batch_id, 150);
END

DECLARE @diazepam_id INT;
SELECT @diazepam_id = MedicineID FROM Medicines WHERE MedicineCode = 'THUOC-0007';
IF @diazepam_id IS NOT NULL AND NOT EXISTS (SELECT * FROM Batches WHERE MedicineID = @diazepam_id)
BEGIN
    INSERT INTO Batches (MedicineID, BatchNumber, ProductionDate, ExpiryDate, ImportPrice, QuantityOriginal)
    VALUES (@diazepam_id, 'DZP-2606', '2026-06-15', '2027-06-15', 300.00, 5000);
    
    DECLARE @diazepam_batch_id INT = @@IDENTITY;
    INSERT INTO InventoryStocks (BatchID, CurrentQuantity) VALUES (@diazepam_batch_id, 1200);
END
GO

-- 3. Tạo bảng InventoryAudits (Phiếu kiểm kê)
IF OBJECT_ID('InventoryAuditDetails', 'U') IS NOT NULL DROP TABLE InventoryAuditDetails;
IF OBJECT_ID('InventoryAudits', 'U') IS NOT NULL DROP TABLE InventoryAudits;
GO

CREATE TABLE InventoryAudits (
    AuditID INT IDENTITY(1,1) PRIMARY KEY,
    AuditCode NVARCHAR(50) NOT NULL UNIQUE,
    LocationType NVARCHAR(50) NOT NULL DEFAULT 'MainStore', -- 'MainStore' or 'Cabinet'
    DepartmentID INT FOREIGN KEY REFERENCES Departments(DepartmentID) NULL,
    AuditDate DATETIME NOT NULL DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100) NOT NULL,
    AuditType NVARCHAR(50) NOT NULL DEFAULT N'Định kỳ',
    Status NVARCHAR(50) NOT NULL DEFAULT N'Nháp', -- 'Nháp', 'Chờ xác nhận', 'Có chênh lệch', 'Đã xác nhận', 'Đã điều chỉnh', 'Đã hủy'
    Notes NVARCHAR(255) NULL,
    CreatorSignature NVARCHAR(MAX) NULL,
    CheckerSignature NVARCHAR(MAX) NULL,
    DirectorSignature NVARCHAR(MAX) NULL,
    CheckerSignedBy NVARCHAR(100) NULL,
    CheckerSignedAt DATETIME NULL,
    DirectorSignedBy NVARCHAR(100) NULL,
    DirectorSignedAt DATETIME NULL,
    DiscrepancyThresholdExceeded BIT NOT NULL DEFAULT 0,
    TimelineJson NVARCHAR(MAX) NULL
);
GO

-- 4. Tạo bảng InventoryAuditDetails (Chi tiết phiếu kiểm kê)
CREATE TABLE InventoryAuditDetails (
    AuditDetailID INT IDENTITY(1,1) PRIMARY KEY,
    AuditID INT FOREIGN KEY REFERENCES InventoryAudits(AuditID) ON DELETE CASCADE,
    BatchID INT FOREIGN KEY REFERENCES Batches(BatchID),
    SystemQuantity INT NOT NULL,
    ActualQuantity INT NOT NULL,
    Discrepancy INT NOT NULL,
    Reason NVARCHAR(255) NULL
);
GO

-- 5. Tạo bảng StockAdjustmentLogs (Nhật ký điều chỉnh tồn kho)
IF OBJECT_ID('StockAdjustmentLogs', 'U') IS NOT NULL DROP TABLE StockAdjustmentLogs;
GO

CREATE TABLE StockAdjustmentLogs (
    LogID INT IDENTITY(1,1) PRIMARY KEY,
    AuditID INT FOREIGN KEY REFERENCES InventoryAudits(AuditID) ON DELETE SET NULL NULL,
    BatchID INT FOREIGN KEY REFERENCES Batches(BatchID),
    LocationType NVARCHAR(50) NOT NULL, -- 'MainStore' or 'Cabinet'
    DepartmentID INT FOREIGN KEY REFERENCES Departments(DepartmentID) NULL,
    OldQuantity INT NOT NULL,
    NewQuantity INT NOT NULL,
    Discrepancy INT NOT NULL,
    AdjustedBy NVARCHAR(100) NOT NULL,
    AdjustmentDate DATETIME NOT NULL DEFAULT GETDATE(),
    Reason NVARCHAR(255) NULL
);
GO
