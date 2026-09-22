-- Cập nhật chức danh chính xác cho Thủ kho Kho Chẵn, phân biệt rạch ròi với Dược sĩ
UPDATE Users 
SET FullName = N'Thủ kho Hà Lâm Đình Phú' 
WHERE Username IN ('thukho', 'phu');

UPDATE Users 
SET FullName = N'Thủ kho Kiều Đức Anh' 
WHERE Username = 'anh';

GO

SELECT UserID, Username, FullName, Role 
FROM Users 
WHERE Username IN ('thukho', 'phu', 'anh', 'ds_khambenh', 'ds_capcuu');
GO
