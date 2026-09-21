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
  UserCheck,
  TrendingDown,
  Info,
  Clock,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

export default function AccountingPeriodPage({ user }) {
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
    fetchPeriods();
  }, []);

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

  const isDirector = user?.role === 'director';
  const isAuthorizedToLock = isDirector;

  // Metrics
  const lockedCount = periods.filter(p => p.isLocked).length;
  const latestLocked = periods.find(p => p.isLocked);
  const currentMonthLocked = periods.some(p => p.periodMonth === (currentDate.getMonth() + 1) && p.periodYear === currentDate.getFullYear() && p.isLocked);

  return (
    <div className="page-container fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="header-title-container">
          <div className="title-icon-badge" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: '#ffffff', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' }}>
            <Lock size={26} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
              Khóa Sổ Kỳ Dược Cuối Tháng
            </h1>
            <p className="page-subtitle" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Chốt số dư tồn kho, bảo vệ tính toàn vẹn dữ liệu Nhập - Xuất - Tồn và niêm phong chống sửa đổi số liệu quá khứ.
            </p>
          </div>
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={fetchPeriods} 
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.1rem' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={{ 
          padding: '0.9rem 1.25rem', 
          background: 'rgba(239, 68, 68, 0.1)', 
          borderLeft: '4px solid #ef4444', 
          borderRadius: '8px', 
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#ef4444',
          fontSize: '0.92rem'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ 
          padding: '0.9rem 1.25rem', 
          background: 'rgba(16, 185, 129, 0.1)', 
          borderLeft: '4px solid #10b981', 
          borderRadius: '8px', 
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#10b981',
          fontSize: '0.92rem'
        }}>
          <CheckCircle2 size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kỳ Hiện Tại (T{currentDate.getMonth() + 1}/{currentDate.getFullYear()})</span>
            <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: currentMonthLocked ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {currentMonthLocked ? (
              <>
                <Lock size={20} /> ĐÃ KHÓA SỔ
              </>
            ) : (
              <>
                <Unlock size={20} /> ĐANG MỞ
              </>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {currentMonthLocked ? 'Mọi giao dịch trong tháng đang được đóng băng' : 'Các giao dịch nhập - xuất bình thường'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kỳ Đã Niêm Phong</span>
            <ShieldCheck size={18} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {lockedCount} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>kỳ</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Đã chốt sổ và bảo vệ toàn vẹn lịch sử
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tồn Kho Kỳ Gần Nhất</span>
            <DollarSign size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-primary)' }}>
            {latestLocked ? `${latestLocked.closingStockValue.toLocaleString()} đ` : '---'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {latestLocked ? `Chốt số lượng: ${latestLocked.closingStockCount.toLocaleString()} đơn vị` : 'Chưa có kỳ nào được khóa'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hao Hụt Kỳ Gần Nhất</span>
            <TrendingDown size={18} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ef4444' }}>
            {latestLocked ? `${latestLocked.totalLossValue.toLocaleString()} đ` : '0 đ'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Tổng hợp từ các biên bản hư hao vỡ hỏng đã duyệt
          </div>
        </div>
      </div>

      {/* Banner thông báo chế độ giám sát tra cứu cho Dược sĩ */}
      {!isDirector && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          fontSize: '0.86rem',
          color: 'var(--text-main)'
        }}>
          <Info size={22} color="#3b82f6" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#3b82f6' }}>Chế độ Tra Cứu Kỳ Dược (Read-Only):</strong> Bạn đang đăng nhập với vai trò <strong style={{ color: 'var(--text-main)' }}>{user?.fullName || 'Dược sĩ / Thủ kho'}</strong>. Theo quy định bệnh viện, quyền thực hiện <strong>Khóa Sổ</strong> hoặc <strong>Mở Khóa</strong> kỳ Dược chỉ dành cho <strong>Ban Giám Đốc</strong>. Dữ liệu bên dưới được cung cấp để Dược sĩ theo dõi số dư tồn kho đã chốt và đối soát báo cáo tài chính.
          </div>
        </div>
      )}

      {/* Action Box: Thực hiện Khóa sổ - Chỉ hiển thị cho Ban Giám Đốc */}
      {isAuthorizedToLock && (
        <div className="card" style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px', 
          padding: '1.5rem',
          marginBottom: '1.75rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <ShieldAlert size={22} style={{ color: '#ef4444' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                Thực hiện Khóa Sổ Kỳ Dược Cuối Tháng
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Chỉ Ban Giám Đốc có thẩm quyền chốt sổ. Hệ thống sẽ tự động tổng hợp số dư tồn kho, tổng nhập và chi phí hao hụt.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) auto', gap: '1rem', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>Tháng chốt:</label>
              <select 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 600 }}
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>Năm chốt:</label>
              <select 
                value={selectedYear} 
                onChange={e => setSelectedYear(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 600 }}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>Ghi chú chốt sổ:</label>
              <input 
                type="text" 
                placeholder="VD: Khóa sổ định kỳ cuối tháng, phục vụ đối chiếu BCTC..." 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.88rem' }}
              />
            </div>

            <button 
              onClick={() => setConfirmLockModal(true)} 
              disabled={submitting}
              className="btn-danger"
              style={{ padding: '0.65rem 1.4rem', height: '42px', fontSize: '0.88rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
            >
              <Lock size={16} />
              <span>Khóa Sổ Ngay</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
              Danh Sách Lịch Sử Các Kỳ Dược Đã Thiết Lập
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Theo dõi tình trạng niêm phong, kiểm toán số dư tồn kho và người thực hiện khóa sổ
            </p>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Tổng số: {periods.length} kỳ
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="spin" style={{ margin: 'auto', marginBottom: '0.75rem', color: 'var(--color-primary)' }} />
            <div>Đang tải dữ liệu kỳ kế toán Dược...</div>
          </div>
        ) : periods.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Calendar size={48} style={{ opacity: 0.35, marginBottom: '0.75rem', strokeWidth: 1.5 }} />
            <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-main)' }}>Chưa có kỳ kế toán nào được ghi nhận</div>
            <p style={{ maxWidth: '460px', margin: '0.5rem auto 0 auto', fontSize: '0.85rem' }}>
              Hãy thực hiện khóa sổ tháng đầu tiên để chốt số dư tồn kho và bảo vệ toàn vẹn lịch sử giao dịch.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '0.9rem 1.25rem' }}>Kỳ Dược</th>
                  <th style={{ padding: '0.9rem' }}>Trạng Thái</th>
                  <th style={{ padding: '0.9rem' }}>Tồn Kho Chốt</th>
                  <th style={{ padding: '0.9rem' }}>Giá Trị Tồn Chốt</th>
                  <th style={{ padding: '0.9rem' }}>Tổng Nhập & Hao Hụt</th>
                  <th style={{ padding: '0.9rem' }}>Người Khóa & Thời Gian</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {periods.map(p => (
                  <tr key={p.periodID} style={{ borderBottom: '1px solid var(--border-color)', background: p.isLocked ? 'rgba(239, 68, 68, 0.015)' : 'transparent' }}>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: 700 }}>
                      <div style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Tháng {p.periodMonth} / {p.periodYear}</div>
                      {p.notes && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '3px' }}>
                          {p.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem 0.9rem' }}>
                      {p.isLocked ? (
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.4rem', 
                          padding: '0.25rem 0.75rem', 
                          borderRadius: '20px', 
                          fontSize: '0.78rem', 
                          fontWeight: 700, 
                          background: 'rgba(239, 68, 68, 0.1)', 
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)'
                        }}>
                          <Lock size={12} /> ĐÃ KHÓA SỔ
                        </span>
                      ) : (
                        <span style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.4rem', 
                          padding: '0.25rem 0.75rem', 
                          borderRadius: '20px', 
                          fontSize: '0.78rem', 
                          fontWeight: 700, 
                          background: 'rgba(16, 185, 129, 0.1)', 
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          <Unlock size={12} /> Đang mở
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 0.9rem', fontWeight: 600 }}>
                      {p.closingStockCount ? p.closingStockCount.toLocaleString() : '---'}
                    </td>
                    <td style={{ padding: '1rem 0.9rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {p.closingStockValue ? `${p.closingStockValue.toLocaleString()} đ` : '---'}
                    </td>
                    <td style={{ padding: '1rem 0.9rem', fontSize: '0.82rem' }}>
                      <div>Nhập: <strong>{p.totalImportValue ? `${p.totalImportValue.toLocaleString()} đ` : '0 đ'}</strong></div>
                      <div style={{ color: '#ef4444', marginTop: '2px' }}>Hao hụt: <strong>{p.totalLossValue ? `${p.totalLossValue.toLocaleString()} đ` : '0 đ'}</strong></div>
                    </td>
                    <td style={{ padding: '1rem 0.9rem', fontSize: '0.82rem' }}>
                      {p.isLocked ? (
                        <>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <UserCheck size={14} style={{ color: '#10b981' }} />
                            {p.lockedBy || 'Hệ thống'}
                          </div>
                          <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                            {p.lockedAt ? new Date(p.lockedAt).toLocaleString('vi-VN') : ''}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>---</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                      {p.isLocked && isDirector && (
                        <button 
                          onClick={() => setUnlockTarget(p)}
                          className="btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b', borderColor: '#f59e0b' }}
                          title="Chỉ Ban Giám Đốc mới có quyền mở khóa kỳ Dược đã chốt"
                        >
                          <Unlock size={13} /> Mở khóa
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

      {/* Confirmation Modal for Lock */}
      {confirmLockModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', padding: '1.75rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
              <AlertTriangle size={22} />
              Xác Nhận Khóa Sổ Kỳ Dược?
            </h3>
            <p style={{ fontSize: '0.92rem', lineHeight: '1.6', color: 'var(--text-main)', marginBottom: '1.25rem' }}>
              Bạn đang chuẩn bị khóa sổ kỳ Dược <strong>Tháng {selectedMonth}/{selectedYear}</strong>. Sau khi khóa:
            </p>
            <ul style={{ fontSize: '0.88rem', lineHeight: '1.6', color: 'var(--text-muted)', marginBottom: '1.25rem', paddingLeft: '1.25rem' }}>
              <li>Toàn bộ phiếu nhập, xuất, chuyển kho và biên bản hao hụt trong tháng sẽ bị <strong>đóng băng</strong>.</li>
              <li>Hệ thống <strong>từ chối mọi thao tác sửa/xóa/duyệt</strong> giao dịch thuộc kỳ này.</li>
              <li>Chỉ <strong>Ban Giám Đốc</strong> mới có quyền mở khóa lại kỳ này.</li>
            </ul>

            {error && (
              <div style={{ 
                padding: '0.65rem 0.9rem', 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderLeft: '4px solid #ef4444', 
                borderRadius: '6px', 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#ef4444',
                fontSize: '0.85rem'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
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
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {submitting ? <RefreshCw size={14} className="spin" /> : <Lock size={14} />}
                <span>Đồng ý Khóa Sổ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Unlock */}
      {unlockTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', padding: '1.75rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
              <Unlock size={22} />
              Xác Nhận Mở Khóa Kỳ Dược (Lệnh Ban Giám Đốc)
            </h3>
            <p style={{ fontSize: '0.92rem', lineHeight: '1.6', color: 'var(--text-main)', marginBottom: '1.25rem' }}>
              Bạn có chắc chắn muốn mở khóa sổ cho kỳ Dược <strong>Tháng {unlockTarget.periodMonth}/{unlockTarget.periodYear}</strong>?
            </p>
            <p style={{ fontSize: '0.85rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: '6px', borderLeft: '3px solid #ef4444', marginBottom: '1.25rem' }}>
              ⚠ Lưu ý: Thao tác mở khóa này sẽ được ghi vào <strong>Nhật ký kiểm toán tự động (Audit Trail)</strong> để phục vụ thanh tra.
            </p>

            {error && (
              <div style={{ 
                padding: '0.65rem 0.9rem', 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderLeft: '4px solid #ef4444', 
                borderRadius: '6px', 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#ef4444',
                fontSize: '0.85rem'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                onClick={() => setUnlockTarget(null)}
                className="btn-secondary"
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => handleUnlockPeriod(unlockTarget)}
                className="btn-premium"
                disabled={submitting}
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                {submitting ? <RefreshCw size={14} className="spin" /> : <Unlock size={14} />}
                <span>Xác nhận Mở Khóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
