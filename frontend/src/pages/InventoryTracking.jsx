import React, { useState, useEffect } from 'react';
import { Search, Info, HelpCircle, AlertTriangle, Layers, Calendar, RefreshCw } from 'lucide-react';
import { exportExcelReport } from '../utils/excelExportHelper';

export default function InventoryTracking({ user }) {
  const [reportType, setReportType] = useState('summary'); // 'summary' or 'batches'
  const [summaryReport, setSummaryReport] = useState([]);
  const [batchReport, setBatchReport] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'returned', 'recalled', 'normal'
  const [loading, setLoading] = useState(true);

  const fetchReports = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/inventory/summary').then(res => res.json()),
      fetch('/api/inventory/batches').then(res => res.json())
    ])
    .then(([sumData, batData]) => {
      setSummaryReport(sumData);
      setBatchReport(batData);
      setLoading(false);
    })
    .catch(err => {
      console.error("Error loading inventory reports: ", err);
      setLoading(false);
    });
  };

  const handleRestoreQuarantine = (quarantineId, medName, qty) => {
    if (!window.confirm(`Xác nhận phục hồi ${qty} hộp thuốc [${medName}] từ kho hỏng/vỡ trở lại kho chẵn chính? (Sửa lỗi thao tác nhầm)`)) return;
    
    fetch(`/api/inventory/quarantine/${quarantineId}/restore`, {
      method: 'POST',
      headers: {
        'X-User-Role': user?.role || ''
      }
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Lỗi phục hồi tồn kho");
      }
      alert(data.message || "Đã khôi phục thành công!");
      fetchReports();
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  useEffect(() => {
    fetchReports();

    const handleUpdate = (e) => {
      if (e.detail === 'Inventory') {
        fetchReports();
      }
    };
    window.addEventListener('pharmacy-update', handleUpdate);
    return () => window.removeEventListener('pharmacy-update', handleUpdate);
  }, []);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredSummary = summaryReport.filter(item => 
    item.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.medicineCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.genericName && item.genericName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredBatches = batchReport.filter(item => {
    const matchesSearch = item.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.medicineCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.status && item.status.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterType === 'returned') {
      return item.sourceCode && item.sourceCode.startsWith('PHT-');
    }
    if (filterType === 'recalled') {
      return (item.sourceCode && item.sourceCode.startsWith('QĐTH-')) || item.status === 'Cách ly';
    }
    if (filterType === 'normal') {
      return !item.sourceCode && item.status !== 'Cách ly' && item.status !== 'Chờ tiêu hủy';
    }
    return true;
  });

  const handleExportInventory = async () => {
    if (reportType === 'summary') {
      if (filteredSummary.length === 0) {
        alert("Không có số liệu tồn kho tổng hợp để xuất.");
        return;
      }
      const headers = [
        "Mã Thuốc",
        "Tên Thuốc",
        "Tên Gốc / Hoạt Chất",
        "Quy Cách",
        "Đơn Vị Tính",
        "Tồn Kho Chẵn",
        "Tồn Tủ Trực",
        "Tổng Tồn Thực Tế",
        "Mức Tối Thiểu",
        "Trạng Thái"
      ];
      const rows = filteredSummary.map(item => [
        item.medicineCode,
        item.medicineName,
        item.genericName || '',
        item.specification || '',
        item.unit,
        Number(item.mainStoreQty) || 0,
        Number(item.cabinetQty) || 0,
        Number(item.totalQty) || 0,
        Number(item.minInventory) || 0,
        item.isLowStock ? 'Dưới mức tối thiểu' : 'An toàn'
      ]);

      try {
        await exportExcelReport({
          fileName: `Bao_cao_nhap_xuat_ton_tong_hop_${new Date().toISOString().slice(0, 10)}`,
          sheetName: 'Tồn kho tổng hợp',
          departmentName: 'Kho Dược Trung Tâm',
          reportTitle: 'BÁO CÁO NHẬP XUẤT TỒN DƯỢC PHẨM TỔNG HỢP',
          subtitle: `Tổng số danh mục: ${filteredSummary.length} thuốc / vật tư`,
          creator: user?.fullName || user?.username || 'Thủ kho / Dược sĩ',
          headers,
          rows,
          includeIndex: true,
          showSignatures: true
        });
      } catch (err) {
        console.error('Lỗi xuất Excel:', err);
        alert('Không thể xuất báo cáo Excel: ' + err.message);
      }
    } else {
      if (filteredBatches.length === 0) {
        alert("Không có danh sách lô thuốc để xuất.");
        return;
      }
      const headers = [
        "Mã Thuốc",
        "Tên Thuốc",
        "Số Lô Đăng Ký",
        "Nơi Lưu Trữ",
        "Đơn Giá Nhập",
        "Hạn Sử Dụng",
        "Số Lượng Tồn",
        "Trạng Thái Hạn Dùng"
      ];
      const rows = filteredBatches.map(item => {
        const today = new Date();
        const expiry = new Date(item.expiryDate);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        
        let indicatorText = 'An toàn';
        if (item.status === 'Cách ly') {
          indicatorText = 'Cách ly (Khóa phát)';
        } else if (item.status === 'Chờ tiêu hủy') {
          indicatorText = 'Chờ tiêu hủy';
        } else if (item.status === 'Thu hồi') {
          indicatorText = 'Đang thu hồi';
        } else if (item.status === 'Trả NCC') {
          indicatorText = 'Đã trả NCC';
        } else if (item.status === 'Tiêu hủy') {
          indicatorText = 'Đã tiêu hủy';
        } else if (diffDays <= 0) {
          indicatorText = 'Hết hạn';
        } else if (diffDays <= 90) {
          indicatorText = `Cận hạn (${diffDays} ngày)`;
        }

        return [
          item.medicineCode,
          item.medicineName,
          item.batchNumber,
          item.location === 'MainStore' ? 'Kho Chẵn' : `Tủ trực: ${item.location}`,
          Number(item.importPrice) || 0,
          new Date(item.expiryDate).toLocaleDateString('vi-VN'),
          Number(item.quantity) || 0,
          indicatorText
        ];
      });

      try {
        await exportExcelReport({
          fileName: `Bao_cao_nhap_xuat_ton_chi_tiet_lo_${new Date().toISOString().slice(0, 10)}`,
          sheetName: 'Chi tiết lô thuốc',
          departmentName: 'Kho Dược Trung Tâm',
          reportTitle: 'BÁO CÁO NHẬP XUẤT TỒN CHI TIẾT THEO TỪNG SỐ LÔ',
          subtitle: `Tổng số lô kiểm soát: ${filteredBatches.length} lô thuốc`,
          creator: user?.fullName || user?.username || 'Thủ kho / Dược sĩ',
          headers,
          rows,
          includeIndex: true,
          showSignatures: true
        });
      } catch (err) {
        console.error('Lỗi xuất Excel:', err);
        alert('Không thể xuất báo cáo Excel: ' + err.message);
      }
    }
  };

  const handleExportExpiring = async () => {
    try {
      const res = await fetch('/api/dashboard/summary?timeUnit=month');
      const summary = await res.json();
      const alerts = summary?.expiringAlerts || [];
      if (!alerts.length) {
        alert("Không có dữ liệu thuốc cận hạn sử dụng!");
        return;
      }
      const headers = [
        "Tên Thuốc / Vật Tư", 
        "Số Lô", 
        "Hạn Sử Dụng", 
        "Số Ngày Còn Lại", 
        "Tồn Kho Chẵn", 
        "Tồn Tủ Trực", 
        "Tổng Tồn",
        "Trạng Thái Cảnh Báo"
      ];
      const rows = alerts.map(a => [
        a.medicineName,
        a.batchNumber,
        new Date(a.expiryDate).toLocaleDateString('vi-VN'),
        Number(a.daysLeft) || 0,
        Number(a.mainStoreQty) || 0,
        Number(a.cabinetQty) || 0,
        (Number(a.mainStoreQty) || 0) + (Number(a.cabinetQty) || 0),
        a.daysLeft <= 0 ? "Đã hết hạn" : a.daysLeft <= 30 ? "Nguy cấp" : "Sắp hết hạn"
      ]);

      await exportExcelReport({
        fileName: `Bao_Cao_Thuoc_Can_Han_Dung_${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'Thuốc cận hạn',
        departmentName: 'Kho Dược Trung Tâm',
        reportTitle: 'BÁO CÁO THEO DÕI THUỐC & VẬT TƯ CẬN HẠN DÙNG',
        subtitle: `Số lượng lô cận hạn: ${alerts.length} lô`,
        creator: user?.fullName || user?.username || 'Dược sĩ quản lý hạn dùng',
        headers,
        rows,
        includeIndex: true,
        showSignatures: true
      });
    } catch (err) {
      console.error('Lỗi xuất Excel:', err);
      alert("Lỗi khi tải dữ liệu cận hạn: " + err.message);
    }
  };

  const handleExportWaste = async () => {
    try {
      const res = await fetch('/api/dashboard/waste-analytics?timeUnit=month');
      const wasteData = await res.json();
      const monthlyLoss = wasteData?.monthlyLoss || [];
      const wasteByGroup = wasteData?.wasteByGroup || [];
      const wasteByDepartment = wasteData?.wasteByDepartment || [];
      
      const rows = [];
      monthlyLoss.forEach(item => {
        rows.push(["Hao hụt theo thời gian", item.month, "Chi phí tiêu hủy / quá hạn", Number(item.lossAmount) || 0]);
      });
      wasteByGroup.forEach(item => {
        rows.push(["Cơ cấu theo nhóm dược lý", item.medicineGroup, "Tổng tiền hao hụt", Number(item.totalLoss) || 0]);
      });
      wasteByDepartment.forEach(item => {
        rows.push(["Hao hụt theo khoa lâm sàng", item.departmentName, "Tổng tiền hao hụt lâm sàng", Number(item.totalLoss) || 0]);
      });

      const headers = ["Phân Loại Hao Hụt", "Danh Mục / Đơn Vị", "Nội Dung Ghi Nhận", "Số Tiền Hao Hụt (VNĐ)"];
      await exportExcelReport({
        fileName: `Bao_Cao_Hao_Hut_Lang_Phi_${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'Phân tích hao hụt',
        departmentName: 'Kho Dược Trung Tâm',
        reportTitle: 'BÁO CÁO PHÂN TÍCH HAO HỤT & LÃNG PHÍ DƯỢC PHẨM',
        subtitle: `Dữ liệu phân tích tổn thất tài chính dược phẩm`,
        creator: user?.fullName || user?.username || 'Dược sĩ quản trị',
        headers,
        rows,
        includeIndex: true,
        showSignatures: true
      });
    } catch (err) {
      console.error('Lỗi xuất Excel:', err);
      alert("Lỗi khi tải dữ liệu hao hụt: " + err.message);
    }
  };

  if (loading) return <div style={{ color: '#fff', padding: '2rem' }}>Đang tải báo cáo tồn kho bệnh viện...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Báo Cáo Nhập - Xuất - Tồn Kho</h1>
          <p className="page-subtitle">Theo dõi số lượng tồn kho tổng hợp và chi tiết các lô thuốc đang lưu hành.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }} onClick={fetchReports}>
            <RefreshCw size={14} /> Làm mới
          </button>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }} onClick={handleExportInventory}>
            Xuất BC Nhập-Xuất-Tồn
          </button>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }} onClick={handleExportExpiring}>
            Xuất BC Cận Hạn
          </button>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }} onClick={handleExportWaste}>
            Xuất BC Hao Hụt
          </button>
        </div>
      </div>

      {/* Toggle View and Search Bar */}
      <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={reportType === 'summary' ? 'btn-premium' : 'btn-secondary'} 
            onClick={() => setReportType('summary')}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            Báo cáo tổng hợp tồn
          </button>
          <button 
            className={reportType === 'batches' ? 'btn-premium' : 'btn-secondary'} 
            onClick={() => setReportType('batches')}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            Danh sách thẻ kho theo lô
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {reportType === 'batches' && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.42rem 0.8rem',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <option value="all">Tất cả nguồn thuốc</option>
              <option value="returned">Chỉ thuốc hoàn trả (PHT)</option>
              <option value="recalled">Chỉ thuốc thu hồi/cách ly (QĐTH)</option>
              <option value="normal">Chỉ thuốc bình thường (Kho chính)</option>
            </select>
          )}

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '8px', 
            padding: '0.4rem 0.8rem', 
            width: '320px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Search size={16} color="var(--text-dim)" style={{ marginRight: '0.5rem' }} />
            <input 
              type="text" 
              placeholder="Tìm theo tên thuốc, mã, hoạt chất..." 
              style={{ 
                border: 'none', 
                background: 'none', 
                padding: 0, 
                fontSize: '0.85rem', 
                outline: 'none', 
                color: 'var(--text-main)',
                width: '100%'
              }}
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
        </div>
      </div>

      {/* REPORT VIEWS */}
      <div className="glass-card">
        {reportType === 'summary' ? (
          <div>
            <h3>Bảng Tổng Hợp Tồn Kho Dược & Vật Tư Y Tế</h3>
            <div className="table-container">
              {filteredSummary.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Không tìm thấy dược phẩm nào khớp với tìm kiếm.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Mã Thuốc</th>
                      <th>Tên Thuốc / Hoạt Chất</th>
                      <th>Quy Cách</th>
                      <th>ĐVT</th>
                      <th>Tồn Kho Chẵn</th>
                      <th>Tồn Tủ Trực Khoa</th>
                      <th>Tổng Tồn Thực Tế</th>
                      <th>Mức tối thiểu</th>
                      <th>Cảnh báo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSummary.map(item => (
                      <tr key={item.medicineID}>
                        <td><strong>{item.medicineCode}</strong></td>
                        <td>
                          <div><strong>{item.medicineName}</strong></div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.genericName}</div>
                        </td>
                        <td>{item.specification}</td>
                        <td>{item.unit}</td>
                        <td>{item.mainStoreQty}</td>
                        <td>{item.cabinetQty}</td>
                        <td>
                          <span style={{ fontSize: '1.05rem', fontWeight: '700', color: item.isLowStock ? 'var(--color-warning)' : 'var(--color-success)' }}>
                            {item.totalQty}
                          </span>
                        </td>
                        <td>{item.minInventory}</td>
                        <td>
                          {item.isLowStock ? (
                            <span className="badge-alert warning" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                              <AlertTriangle size={10} style={{ marginRight: '0.25rem', display: 'inline' }} /> Dưới mức min
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-success)', fontSize: '0.8rem' }}>An toàn</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h3>Danh Sách Chi Tiết Số Lô Đang Lưu Hành (Thẻ Kho)</h3>
            <div className="table-container">
              {filteredBatches.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Không tìm thấy lô hàng nào khớp với tìm kiếm.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Mã Thuốc</th>
                      <th>Tên Thuốc</th>
                      <th>Số Lô Đăng Ký</th>
                      <th>Nơi Lưu Trữ</th>
                      <th>Đơn Giá Nhập</th>
                      <th>Hạn Sử Dụng</th>
                      <th>Số Lượng Tồn</th>
                      <th>Hạn dùng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBatches.map((item, idx) => {
                      const today = new Date();
                      const expiry = new Date(item.expiryDate);
                      const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                      
                      let indicatorClass = 'safe';
                      let indicatorText = 'An toàn';
                      
                      if (item.status === 'Cách ly') {
                        indicatorClass = 'warning';
                        indicatorText = 'Cách ly (Khóa phát)';
                      } else if (item.status === 'Chờ tiêu hủy') {
                        indicatorClass = 'critical';
                        indicatorText = 'Chờ tiêu hủy';
                      } else if (item.status === 'Thu hồi') {
                        indicatorClass = 'critical';
                        indicatorText = 'Đang thu hồi';
                      } else if (item.status === 'Trả NCC') {
                        indicatorClass = 'critical';
                        indicatorText = 'Đã trả NCC';
                      } else if (item.status === 'Tiêu hủy') {
                        indicatorClass = 'critical';
                        indicatorText = 'Đã tiêu hủy';
                      } else if (diffDays <= 0) {
                        indicatorClass = 'critical';
                        indicatorText = 'Hết hạn';
                      } else if (diffDays <= 90) {
                        indicatorClass = 'warning';
                        indicatorText = `Cận hạn (${diffDays} ngày)`;
                      }

                      // Calculate if this batch is the earliest expiring batch for this medicine in this specific location (FEFO priority)
                      const sameMedAndLoc = filteredBatches.filter(b => b.medicineCode === item.medicineCode && b.location === item.location && b.quantity > 0);
                      const sortedSame = [...sameMedAndLoc].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
                      const isFEFO = sortedSame.length > 0 && sortedSame[0].batchNumber === item.batchNumber;

                      return (
                        <tr key={idx}>
                          <td><strong>{item.medicineCode}</strong></td>
                          <td><strong>{item.medicineName}</strong></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ background: 'rgba(255,255,255,0.03)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-glass)', fontWeight: '600' }}>
                                {item.batchNumber}
                              </span>
                              {item.sourceCode && (
                                <span style={{ 
                                  fontSize: '0.68rem', 
                                  fontWeight: '600', 
                                  color: '#3b82f6', 
                                  background: 'rgba(59, 130, 246, 0.08)', 
                                  border: '1px solid rgba(59, 130, 246, 0.2)', 
                                  padding: '0.1rem 0.35rem', 
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap'
                                }} title="Mã nguồn hoàn trả/thu hồi">
                                  {item.sourceCode}
                                </span>
                              )}
                              {isFEFO && (
                                <span style={{ 
                                  fontSize: '0.64rem', 
                                  fontWeight: '700', 
                                  color: '#10b981', 
                                  background: 'rgba(16, 185, 129, 0.08)', 
                                  border: '1px solid rgba(16, 185, 129, 0.2)', 
                                  padding: '0.1rem 0.35rem', 
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap'
                                }} title="Lô cận hạn nhất trong kho, sẽ được hệ thống ưu tiên xuất trước theo nguyên tắc FEFO">
                                  ★ ƯU TIÊN FEFO
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>{item.location}</span>
                              {item.quarantineStockID && (user?.role === 'pharmacist' || user?.role === 'director') && (
                                <button 
                                  onClick={() => handleRestoreQuarantine(item.quarantineStockID, item.medicineName, item.quantity)}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '0.15rem 0.35rem',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    height: '22px',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}
                                  title="Khôi phục về kho chẵn chính (Sửa lỗi cập nhật nhầm)"
                                >
                                  Khôi phục
                                </button>
                              )}
                            </div>
                          </td>
                          <td>{item.importPrice.toLocaleString('vi-VN')}đ</td>
                          <td>{expiry.toLocaleDateString('vi-VN')}</td>
                          <td>
                            <span style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                              {item.quantity}
                            </span>
                          </td>
                          <td>
                            <span className={`expiry-indicator ${indicatorClass}`}>
                              {indicatorText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
