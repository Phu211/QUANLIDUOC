import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  FileSearch, 
  History, 
  User, 
  Clock, 
  ArrowRight, 
  Filter, 
  X, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  Layers,
  Eye,
  AlertCircle
} from 'lucide-react';

export default function AuditTrailModal({ isOpen, onClose, user }) {
  const [logs, setLogs] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filter states
  const [selectedTable, setSelectedTable] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [searchUser, setSearchUser] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Selected row for diff inspection
  const [inspectLog, setInspectLog] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchDistinctTables();
      fetchLogs();
    }
  }, [isOpen, page, selectedTable, selectedAction]);

  const fetchDistinctTables = async () => {
    try {
      const res = await fetch('/api/audit-trail/tables', {
        headers: {
          'X-User-Role': user?.role || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedTable && selectedTable !== 'all') params.append('tableName', selectedTable);
      if (selectedAction && selectedAction !== 'all') params.append('action', selectedAction);
      if (searchUser.trim()) params.append('username', searchUser.trim());
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      params.append('page', page);
      params.append('pageSize', pageSize);

      const res = await fetch(`/api/audit-trail?${params.toString()}`, {
        headers: {
          'X-User-Role': user?.role || '',
          'X-User-FullName': encodeURIComponent(user?.fullName || '')
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.Error || 'Không thể tải nhật ký kiểm toán.');
      }

      const result = await res.json();
      setLogs(result.data || []);
      setTotalPages(result.totalPages || 1);
      setTotalRecords(result.totalRecords || 0);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const parseJsonSafe = (str) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'INSERT':
        return (
          <span style={{ 
            background: 'rgba(16, 185, 129, 0.15)', 
            color: '#10b981', 
            padding: '0.2rem 0.55rem', 
            borderRadius: '4px', 
            fontSize: '0.75rem', 
            fontWeight: 700 
          }}>
            INSERT (Thêm mới)
          </span>
        );
      case 'UPDATE':
        return (
          <span style={{ 
            background: 'rgba(59, 130, 246, 0.15)', 
            color: '#3b82f6', 
            padding: '0.2rem 0.55rem', 
            borderRadius: '4px', 
            fontSize: '0.75rem', 
            fontWeight: 700 
          }}>
            UPDATE (Sửa đổi)
          </span>
        );
      case 'DELETE':
        return (
          <span style={{ 
            background: 'rgba(239, 68, 68, 0.15)', 
            color: '#ef4444', 
            padding: '0.2rem 0.55rem', 
            borderRadius: '4px', 
            fontSize: '0.75rem', 
            fontWeight: 700 
          }}>
            DELETE (Xóa)
          </span>
        );
      default:
        return <span>{action}</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1200 }}>
      <div className="modal-container" style={{ maxWidth: '1180px', width: '96%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '8px', 
              background: 'rgba(59, 130, 246, 0.1)', 
              color: '#3b82f6', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Nhật Ký Kiểm Toán Tự Động (System Audit Trail)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Theo dõi và truy vết tự động mọi biến động dữ liệu nhạy cảm (Kho chẵn, Kho tủ trực, Cấp phát, Thuốc) qua SaveChangesInterceptor
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{ 
          padding: '0.85rem 1.5rem', 
          background: 'var(--bg-secondary)', 
          borderBottom: '1px solid var(--border-color)' 
        }}>
          <form onSubmit={handleApplyFilter} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Bộ lọc:</span>
            </div>

            <select 
              value={selectedTable} 
              onChange={e => { setSelectedTable(e.target.value); setPage(1); }}
              style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', fontSize: '0.85rem' }}
            >
              <option value="all">Tất cả bảng dữ liệu</option>
              {tables.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="InventoryStocks">InventoryStocks (Kho chẵn)</option>
              <option value="DepartmentStocks">DepartmentStocks (Kho tủ trực)</option>
              <option value="Medicines">Medicines (Danh mục thuốc)</option>
              <option value="Batches">Batches (Lô thuốc & Date)</option>
              <option value="MedicineRequisitions">MedicineRequisitions (Phiếu xuất)</option>
              <option value="ImportReceipts">ImportReceipts (Phiếu nhập)</option>
              <option value="BreakageReports">BreakageReports (Hư hao đổ vỡ)</option>
              <option value="AccountingPeriods">AccountingPeriods (Kỳ Dược)</option>
            </select>

            <select 
              value={selectedAction} 
              onChange={e => { setSelectedAction(e.target.value); setPage(1); }}
              style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', fontSize: '0.85rem' }}
            >
              <option value="all">Tất cả hành động</option>
              <option value="INSERT">INSERT (Thêm mới)</option>
              <option value="UPDATE">UPDATE (Sửa đổi)</option>
              <option value="DELETE">DELETE (Xóa)</option>
            </select>

            <input 
              type="text" 
              placeholder="Người dùng (Username)..." 
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', fontSize: '0.85rem', width: '160px' }}
            />

            <input 
              type="date" 
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              title="Từ ngày"
              style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', fontSize: '0.85rem' }}
            />

            <input 
              type="date" 
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              title="Đến ngày"
              style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', fontSize: '0.85rem' }}
            />

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <FileSearch size={14} />
              <span>Tra cứu</span>
            </button>

            <button 
              type="button" 
              onClick={() => {
                setSelectedTable('all');
                setSelectedAction('all');
                setSearchUser('');
                setFromDate('');
                setToDate('');
                setPage(1);
                fetchLogs();
              }}
              className="btn-secondary" 
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            >
              Xóa lọc
            </button>

            <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Tổng: <strong>{totalRecords}</strong> bản ghi
            </div>
          </form>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ 
              padding: '0.75rem 1rem', 
              background: 'rgba(239, 68, 68, 0.1)', 
              borderLeft: '4px solid #ef4444', 
              borderRadius: '6px', 
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: '#ef4444'
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem' }} />
              <div>Đang truy vấn nhật ký kiểm toán...</div>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Không có bản ghi kiểm toán nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Thời gian</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Hành động</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Bảng / Đối tượng</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Khóa chính (PK)</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Cột thay đổi</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Người thực hiện</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Chi tiết sai khác</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const changedCols = parseJsonSafe(log.changedColumns);
                    const colsArray = Array.isArray(changedCols) ? changedCols : [];
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600 }}>{new Date(log.createdAt).toLocaleDateString('vi-VN')}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(log.createdAt).toLocaleTimeString('vi-VN')}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          {getActionBadge(log.action)}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ 
                            background: 'var(--bg-secondary)', 
                            border: '1px solid var(--border-color)', 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.8rem'
                          }}>
                            {log.tableName || log.entityName}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {log.keyValues ? log.keyValues : (log.entityId ? `#${log.entityId}` : '---')}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          {colsArray.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {colsArray.slice(0, 3).map((col, idx) => (
                                <span key={idx} style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '0.1rem 0.35rem', borderRadius: '3px', fontSize: '0.75rem' }}>
                                  {col}
                                </span>
                              ))}
                              {colsArray.length > 3 && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{colsArray.length - 3} cột</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {log.action === 'INSERT' ? 'Toàn bộ cột mới' : log.action === 'DELETE' ? 'Xóa bản ghi' : '---'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <User size={13} style={{ color: 'var(--color-primary)' }} />
                            <span>{log.username || 'System'}</span>
                          </div>
                          {log.ipAddress && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IP: {log.ipAddress}</div>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          <button 
                            onClick={() => setInspectLog(log)}
                            className="btn-secondary"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <Eye size={12} />
                            <span>So sánh Diff</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.5rem 0' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Trang {page} / {totalPages} (Hiển thị {logs.length} / {totalRecords} bản ghi)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ChevronLeft size={14} /> Trước
                </button>
                <button 
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  Tiếp <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">
            Đóng
          </button>
        </div>
      </div>

      {/* Diff Inspector Modal */}
      {inspectLog && (
        <DiffInspectorModal 
          log={inspectLog} 
          onClose={() => setInspectLog(null)} 
          parseJsonSafe={parseJsonSafe}
          getActionBadge={getActionBadge}
        />
      )}
    </div>
  );
}

function DiffInspectorModal({ log, onClose, parseJsonSafe, getActionBadge }) {
  const oldVals = parseJsonSafe(log.oldValues) || {};
  const newVals = parseJsonSafe(log.newValues) || {};
  const keyVals = parseJsonSafe(log.keyValues) || {};

  // All distinct keys
  const allKeys = Array.from(new Set([
    ...Object.keys(oldVals),
    ...Object.keys(newVals)
  ]));

  return (
    <div className="modal-backdrop" style={{ zIndex: 1350 }}>
      <div className="modal-container" style={{ maxWidth: '850px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileSearch size={20} style={{ color: 'var(--color-primary)' }} />
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
                Chi Tiết Biến Động Dữ Liệu (Audit Diff)
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Bảng: <strong>{log.tableName || log.entityName}</strong> | Thời điểm: {new Date(log.createdAt).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {/* Metadata Bar */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
            gap: '0.75rem', 
            background: 'var(--bg-secondary)', 
            padding: '0.85rem', 
            borderRadius: '6px', 
            marginBottom: '1.25rem',
            fontSize: '0.85rem'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Hành động:</span>
              <div style={{ marginTop: '3px' }}>{getActionBadge(log.action)}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Khóa chính:</span>
              <div style={{ fontWeight: 600, fontFamily: 'monospace', marginTop: '3px' }}>{JSON.stringify(keyVals)}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Người thực hiện:</span>
              <div style={{ fontWeight: 600, marginTop: '3px' }}>{log.username || 'System'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Địa chỉ IP:</span>
              <div style={{ fontWeight: 500, marginTop: '3px' }}>{log.ipAddress || '127.0.0.1'}</div>
            </div>
          </div>

          {/* Diff Table */}
          <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>Bảng So Sánh Giá Trị (Old Values vs New Values)</h5>

          {allKeys.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '6px', color: 'var(--text-muted)' }}>
              Không có trường dữ liệu dạng Key-Value (Thao tác thuần hệ thống).
            </div>
          ) : (
            <div className="table-container" style={{ border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.6rem 0.85rem', width: '25%' }}>Trường dữ liệu</th>
                    <th style={{ padding: '0.6rem 0.85rem', width: '37.5%', color: '#ef4444' }}>Giá trị trước (Old Value)</th>
                    <th style={{ padding: '0.6rem 0.85rem', width: '37.5%', color: '#10b981' }}>Giá trị sau (New Value)</th>
                  </tr>
                </thead>
                <tbody>
                  {allKeys.map(k => {
                    const oldVal = oldVals[k] !== undefined ? String(oldVals[k]) : '—';
                    const newVal = newVals[k] !== undefined ? String(newVals[k]) : '—';
                    const isChanged = oldVal !== newVal;

                    return (
                      <tr key={k} style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        background: isChanged ? 'rgba(245, 158, 11, 0.05)' : 'transparent'
                      }}>
                        <td style={{ padding: '0.6rem 0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                          {k}
                        </td>
                        <td style={{ 
                          padding: '0.6rem 0.85rem', 
                          background: isChanged && oldVal !== '—' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                          color: isChanged && oldVal !== '—' ? '#b91c1c' : 'inherit',
                          wordBreak: 'break-all'
                        }}>
                          {oldVal}
                        </td>
                        <td style={{ 
                          padding: '0.6rem 0.85rem', 
                          background: isChanged && newVal !== '—' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                          color: isChanged && newVal !== '—' ? '#047857' : 'inherit',
                          wordBreak: 'break-all'
                        }}>
                          {newVal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
