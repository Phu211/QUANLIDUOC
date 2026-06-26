USE HisPharmacyDB;
GO

-- Drop triggers if they exist
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_AfterInsertImportDetails')
    DROP TRIGGER trg_AfterInsertImportDetails;
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_AfterUpdateImportReceipts')
    DROP TRIGGER trg_AfterUpdateImportReceipts;
GO

-- 1. Trigger for inserting details
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

-- 2. Trigger for updating receipts
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
