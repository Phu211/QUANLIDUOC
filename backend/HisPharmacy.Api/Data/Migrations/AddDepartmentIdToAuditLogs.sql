IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'AuditLogs' AND COLUMN_NAME = 'DepartmentID')
BEGIN
    ALTER TABLE AuditLogs ADD DepartmentID INT NULL;
END
GO

-- Cập nhật DepartmentID dựa trên người dùng tạo thao tác
UPDATE a
SET a.DepartmentID = u.DepartmentID
FROM AuditLogs a
INNER JOIN Users u ON a.Username = u.Username OR a.Username = u.FullName
WHERE u.DepartmentID IS NOT NULL AND a.DepartmentID IS NULL;

-- Cập nhật DepartmentID cho các phiếu lĩnh thuốc (MedicineRequisition)
UPDATE a
SET a.DepartmentID = r.DepartmentID
FROM AuditLogs a
INNER JOIN MedicineRequisitions r ON a.EntityName IN ('MedicineRequisition', 'MedicineRequisitions') AND a.EntityID = r.RequisitionID
WHERE a.DepartmentID IS NULL;

-- Cập nhật DepartmentID cho các tồn kho tủ trực khoa (DepartmentStocks)
UPDATE a
SET a.DepartmentID = ds.DepartmentID
FROM AuditLogs a
INNER JOIN DepartmentStocks ds ON a.EntityName = 'DepartmentStocks' AND a.EntityID = ds.DepartmentStockID
WHERE a.DepartmentID IS NULL;

-- Cập nhật DepartmentID cho các biên bản hư hao vỡ hỏng (BreakageReports)
UPDATE a
SET a.DepartmentID = br.DepartmentID
FROM AuditLogs a
INNER JOIN BreakageReports br ON a.EntityName IN ('BreakageReports', 'BreakageReport') AND a.EntityID = br.ReportID
WHERE a.DepartmentID IS NULL;

-- Cập nhật DepartmentID cho các phiếu hoàn trả (ReturnReceipts)
UPDATE a
SET a.DepartmentID = ret.DepartmentID
FROM AuditLogs a
INNER JOIN ReturnReceipts ret ON a.EntityName IN ('ReturnReceipts', 'ReturnReceipt') AND a.EntityID = ret.ReturnID
WHERE a.DepartmentID IS NULL;
GO
