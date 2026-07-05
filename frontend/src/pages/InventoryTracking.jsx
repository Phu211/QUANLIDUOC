import React, { useState, useEffect } from 'react';
import { Search, Info, HelpCircle, AlertTriangle, Layers, Calendar, RefreshCw } from 'lucide-react';

export default function InventoryTracking({ user }) {
  const [reportType, setReportType] = useState('summary'); // 'summary' or 'batches'
  const [summaryReport, setSummaryReport] = useState([]);
  const [batchReport, setBatchReport] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredBatches = batchReport.filter(item => 
    item.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.medicineCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.status && item.status.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <div style={{ color: '#fff', padding: '2rem' }}>Đang tải báo cáo tồn kho bệnh viện...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Báo Cáo Nhập - Xuất - Tồn Kho</h1>
          <p className="page-subtitle">Theo dõi số lượng tồn kho tổng hợp và chi tiết các lô thuốc đang lưu hành.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={fetchReports}>
            <RefreshCw size={16} /> Làm mới
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
