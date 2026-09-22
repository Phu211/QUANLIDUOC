UPDATE a
SET a.DepartmentID = ds.DepartmentID
FROM AuditLogs a
CROSS APPLY (
    SELECT TRY_CAST(JSON_VALUE(a.KeyValues, '$.DepartmentStockID') AS INT) AS StockID
) val
JOIN DepartmentStocks ds ON ds.DepartmentStockID = val.StockID
WHERE a.DepartmentID IS NULL AND val.StockID IS NOT NULL;
GO
