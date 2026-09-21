import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  RefreshCw, 
  X,
  Package,
  FileText,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

export default function AccountingPeriodModal({ isOpen, onClose, user }) {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form states for locking
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmLockModal, setConfirmLockModal] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchPeriods();
    }
  }, [isOpen]);

  const fetchPeriods = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accountingperiod');
      if (!res.ok) throw new Error('Không thể tải danh sách kỳ kế toán dược.');
      const data = await res.json();
      setPeriods(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLockPeriod = async () => {
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/accountingperiod/lock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || '',
          'X-User-FullName': encodeURIComponent(user?.fullName || '')
        },
        body: JSON.stringify({
          month: parseInt(selectedMonth, 10),
          year: parseInt(selectedYear, 10),
          notes: notes.trim()
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || result.Error || 'Lỗi khi khóa sổ kỳ Dược.');
      }

      setSuccessMsg(result.message || result.Message || 'Khóa sổ kỳ Dược thành công!');
      setConfirmLockModal(false);
      setNotes('');
      fetchPeriods();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockPeriod = async (period) => {
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/accountingperiod/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || '',
          'X-User-FullName': encodeURIComponent(user?.fullName || '')
        },
        body: JSON.stringify({
          month: period.periodMonth,
          year: period.periodYear
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || result.Error || 'Lỗi khi mở khóa kỳ Dược.');
      }

      setSuccessMsg(result.message || result.Message || 'Mở khóa kỳ Dược thành công!');
      setUnlockTarget(null);
      fetchPeriods();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isAuthorizedToLock = user?.role === 'director' || user?.role === 'pharmacist';
  const isDirector = user?.role === 'director';

  return (
    <div className="modal-backdrop" style={{ zIndex: 1200 }}>
      <div className="modal-container" style={{ maxWidth: '960px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '8px', 
              background: 'rgba(239, 68, 68, 0.1)', 
              color: '#ef4444', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Lock size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                Khóa Sổ Kỳ Dược Cuối Tháng (Monthly Accounting Lock)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Chốt số dư tồn kho, bảo vệ toàn vẹn dữ liệu Nhập - Xuất - Tồn và chống sửa đổi số liệu quá khứ
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ 
              padding: '0.75rem 1rem', 
              background: 'rgba(239, 68, 68, 0.1)', 
              borderLeft: '4px solid #ef4444', 
              borderRadius: '6px', 
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: '#ef4444'
            }}>
              <AlertCircle size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ 
              padding: '0.75rem 1rem', 
              background: 'rgba(16, 185, 129, 0.1)', 
              borderLeft: '4px solid #10b981', 
              borderRadius: '6px', 
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: '#10b981'
            }}>
              <CheckCircle2 size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{successMsg}</span>
            </div>
          )}

          {/* Action Box: Khóa sổ tháng mới */}
          {isAuthorizedToLock && (
            <div style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '10px', 
              padding: '1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <ShieldAlert size={18} style={{ color: '#ef4444' }} />
                Thực hiện Khóa sổ Kỳ Dược
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 140px 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Tháng:</label>
                  <select 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Năm:</label>
                  <select 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>Ghi chú chốt sổ:</label>
                  <input 
                    type="text" 
                    placeholder="VD: Chốt sổ kiểm kê định kỳ cuối quý..." 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
                  />
                </div>

                <button 
                  onClick={() => setConfirmLockModal(true)} 
                  disabled={submitting}
                  className="btn-danger"
                  style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                >
                  <Lock size={16} />
                  <span>Khóa Sổ Kỳ Này</span>
                </button>
              </div>

              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                * Sau khi khóa sổ, hệ thống sẽ chốt số dư tồn kho làm số dư đầu kỳ tháng sau và chặn hoàn toàn mọi thao tác Thêm/Sửa/Xóa/Duyệt phiếu có ngày thuộc kỳ này.
              </p>
            </div>
          )}

          {/* Periods Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                Lịch sử các Kỳ Dược đã ghi nhận ({periods.length})
              </h4>
              <button 
                onClick={fetchPeriods} 
                disabled={loading}
                className="btn-secondary" 
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
                <span>Làm mới</span>
              </button>
            </div>

            {loading && periods.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Đang tải dữ liệu kỳ Dược...
              </div>
            ) : periods.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                Chưa có kỳ Dược nào được thiết lập hoặc khóa sổ.
              </div>
            ) : (
              <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Kỳ Dược</th>
                      <th style={{ padding: '0.75rem' }}>Trạng thái</th>
                      <th style={{ padding: '0.75rem' }}>Tồn cuối kỳ (Số lượng)</th>
                      <th style={{ padding: '0.75rem' }}>Giá trị tồn (VNĐ)</th>
                      <th style={{ padding: '0.75rem' }}>Tổng nhập / Hư hao</th>
                      <th style={{ padding: '0.75rem' }}>Người khóa & Thời gian</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', background: p.isLocked ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                          <span style={{ fontSize: '0.95rem' }}>Tháng {p.periodMonth}/{p.periodYear}</span>
                          {p.notes && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '2px' }}>
                              {p.notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          {p.isLocked ? (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.35rem', 
                              padding: '0.2rem 0.55rem', 
                              borderRadius: '20px', 
                              fontSize: '0.75rem', 
                              fontWeight: 600, 
                              background: 'rgba(239, 68, 68, 0.1)', 
                              color: '#ef4444' 
                            }}>
                              <Lock size={12} /> ĐÃ KHÓA SỔ
                            </span>
                          ) : (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.35rem', 
                              padding: '0.2rem 0.55rem', 
                              borderRadius: '20px', 
                              fontSize: '0.75rem', 
                              fontWeight: 600, 
                              background: 'rgba(16, 185, 129, 0.1)', 
                              color: '#10b981' 
                            }}>
                              <Unlock size={12} /> Đang mở
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                          {p.closingStockCount ? p.closingStockCount.toLocaleString() : '---'}
                        </td>
                        <td style={{ padding: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                          {p.closingStockValue ? `${p.closingStockValue.toLocaleString()} đ` : '---'}
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.8rem' }}>
                          <div>Nhập: <strong>{p.totalImportValue ? `${p.totalImportValue.toLocaleString()} đ` : '0 đ'}</strong></div>
                          <div style={{ color: '#ef4444' }}>Hao hụt: <strong>{p.totalLossValue ? `${p.totalLossValue.toLocaleString()} đ` : '0 đ'}</strong></div>
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.8rem' }}>
                          {p.isLocked ? (
                            <>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <UserCheck size={13} style={{ color: '#10b981' }} />
                                {p.lockedBy || 'Hệ thống'}
                              </div>
                              <div style={{ color: 'var(--text-muted)' }}>
                                {p.lockedAt ? new Date(p.lockedAt).toLocaleString('vi-VN') : ''}
                              </div>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>---</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          {p.isLocked && isDirector && (
                            <button 
                              onClick={() => setUnlockTarget(p)}
                              className="btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b', borderColor: '#f59e0b' }}
                              title="Chỉ Ban Giám Đốc mới có quyền mở khóa kỳ Dược"
                            >
                              <Unlock size={12} /> Mở khóa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">
            Đóng
          </button>
        </div>
      </div>

      {/* Confirm Lock Sub-Modal */}
      {confirmLockModal && (
        <div className="modal-backdrop" style={{ zIndex: 1300 }}>
          <div className="modal-container" style={{ maxWidth: '520px', width: '90%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#ef4444' }}>
              <AlertTriangle size={28} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Xác nhận Khóa Sổ Tháng {selectedMonth}/{selectedYear}?
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              Thao tác này sẽ chính thức <strong>chốt toàn bộ số liệu kho</strong> trong tháng {selectedMonth}/{selectedYear}. 
              Sau khi khóa:
            </p>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', lineHeight: 1.6 }}>
              <li>Toàn bộ phiếu Nhập kho, Xuất cấp phát, Hư hao và Kiểm kê thuộc tháng này sẽ <strong>không thể thêm, sửa, xóa hoặc hủy duyệt</strong>.</li>
              <li>Số dư tồn kho hiện tại sẽ được kết chuyển thành số dư đầu kỳ cho tháng tiếp theo.</li>
              <li>Chỉ có <strong>Ban Giám Đốc</strong> mới có thẩm quyền mở khóa sau này.</li>
            </ul>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                onClick={() => setConfirmLockModal(false)} 
                className="btn-secondary"
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleLockPeriod} 
                className="btn-danger"
                disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
              >
                <Lock size={15} />
                {submitting ? 'Đang chốt sổ...' : 'Xác nhận Khóa sổ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Unlock Sub-Modal */}
      {unlockTarget && (
        <div className="modal-backdrop" style={{ zIndex: 1300 }}>
          <div className="modal-container" style={{ maxWidth: '480px', width: '90%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#f59e0b' }}>
              <Unlock size={28} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Mở Khóa Kỳ Dược Tháng {unlockTarget.periodMonth}/{unlockTarget.periodYear}?
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              Ban Giám Đốc đang chuẩn bị mở khóa cho kỳ Dược này. Khi mở khóa, các giao dịch trong tháng có thể được điều chỉnh lại.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                onClick={() => setUnlockTarget(null)} 
                className="btn-secondary"
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => handleUnlockPeriod(unlockTarget)} 
                className="btn-warning"
                disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
              >
                <Unlock size={15} />
                {submitting ? 'Đang xử lý...' : 'Xác nhận Mở khóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
