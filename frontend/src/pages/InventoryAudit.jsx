import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash, FileText, Printer, Check, X, RefreshCw,
  AlertTriangle, Building2, User, FileEdit, ArrowRight, Upload,
  Eye, Download, Image, PenTool, Eraser, ThumbsUp, ClipboardCheck, 
  Activity, Calendar, BadgeAlert, CheckCircle2, Ban, ShieldAlert,
  ArrowRightLeft
} from 'lucide-react';

const SIG = {
  duoc: (
    <svg width="100" height="50" viewBox="0 0 120 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M15,35 C30,15 45,5 55,25 C65,45 80,45 95,20 C105,5 110,15 115,25 M35,45 C50,35 70,25 90,40" fill="none" stroke="#0000ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  khoa: (
    <svg width="100" height="50" viewBox="0 0 120 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M10,25 Q30,45 50,20 T90,30 T110,15 M20,15 C40,25 60,35 80,20" fill="none" stroke="#0000ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  hong: (
    <svg width="100" height="50" viewBox="0 0 120 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M15,20 Q35,5 50,35 T85,25 T110,40 M40,45 C60,40 80,35 100,30" fill="none" stroke="#0000ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chuong: (
    <svg width="100" height="50" viewBox="0 0 120 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M12,30 C25,10 40,20 50,40 C60,15 75,5 90,25 C100,45 108,35 115,20 M25,45 Q55,30 85,45" fill="none" stroke="#0000ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
};

const RedStamp = ({ name }) => (
  <svg width="85" height="85" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
    <circle cx="60" cy="60" r="52" fill="none" stroke="#dc2626" strokeWidth="3" />
    <circle cx="60" cy="60" r="46" fill="none" stroke="#dc2626" strokeWidth="1.2" />
    <circle cx="60" cy="60" r="46" fill="none" stroke="#dc2626" strokeWidth="1.2" />
    <defs>
      <path id="stampTextPathTop" d="M 18 60 A 42 42 0 0 1 102 60" fill="none" />
      <path id="stampTextPathBottom" d="M 102 60 A 42 42 0 0 1 18 60" fill="none" />
    </defs>
    <text fill="#dc2626" fontSize="7.5" fontFamily="Arial, Helvetica, sans-serif" fontWeight="bold" letterSpacing="0.5">
      <textPath href="#stampTextPathTop" startOffset="50%" textAnchor="middle">BỆNH VIỆN ĐA KHOA HIS PHARMACY</textPath>
    </text>
    <text fill="#dc2626" fontSize="8" fontFamily="Arial, Helvetica, sans-serif" fontWeight="bold" letterSpacing="1">
      <textPath href="#stampTextPathBottom" startOffset="50%" textAnchor="middle">KHOA DƯỢC ★</textPath>
    </text>
    <text x="60" y="52" fill="#dc2626" fontSize="10" fontFamily="Times New Roman, serif" fontWeight="bold" textAnchor="middle">ĐÃ DUYỆT</text>
    <text x="60" y="66" fill="#dc2626" fontSize="6.5" fontFamily="Arial, sans-serif" fontWeight="bold" textAnchor="middle">{name}</text>
  </svg>
);

export default function InventoryAudit({ user }) {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' or 'logs'
  const [audits, setAudits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [locationType, setLocationType] = useState('MainStore'); // 'MainStore' or 'Cabinet'
  const [departmentId, setDepartmentId] = useState('');
  const [auditType, setAuditType] = useState('Định kỳ');
  const [notes, setNotes] = useState('');

  // Active Audit Detail / Edit State
  const [activeAudit, setActiveAudit] = useState(null);
  const [actualQuantities, setActualQuantities] = useState({}); // { detailId: qty }
  const [discrepancyReasons, setDiscrepancyReasons] = useState({}); // { detailId: reason }
  const [isEditing, setIsEditing] = useState(false);

  // Digital Signature Modal State
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState(''); // 'confirm' or 'approve'
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);

  // Cancellation State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Print Preview state
  const [activeAuditForPrint, setActiveAuditForPrint] = useState(null);

  useEffect(() => {
    fetchData();
    fetchDepartments();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const headers = {
      'X-User-Role': user?.role || '',
      'X-User-DepartmentID': user?.departmentID?.toString() || ''
    };
    try {
      const resAudits = await fetch('/api/audit', { headers });
      const dataAudits = await resAudits.json();
      setAudits(dataAudits);

      const resLogs = await fetch('/api/audit/logs', { headers });
      const dataLogs = await resLogs.json();
      setLogs(dataLogs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/requisition/departments');
      const data = await res.json();
      setDepartments(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Setup drawing signature canvas
  useEffect(() => {
    if (showSignatureModal) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#0000ff'; // Blue ink
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        return {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      };

      const start = (e) => {
        if (e.touches) e.preventDefault();
        setIsDrawing(true);
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      };

      const draw = (e) => {
        if (!isDrawing) return;
        if (e.touches) e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      };

      const stop = () => {
        setIsDrawing(false);
      };

      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', draw);
      canvas.addEventListener('mouseup', stop);
      canvas.addEventListener('mouseleave', stop);

      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', draw, { passive: false });
      canvas.addEventListener('touchend', stop);

      return () => {
        canvas.removeEventListener('mousedown', start);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stop);
        canvas.removeEventListener('mouseleave', stop);

        canvas.removeEventListener('touchstart', start);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stop);
      };
    }
  }, [showSignatureModal, isDrawing]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleCreateAudit = async (e) => {
    e.preventDefault();
    if (locationType === 'Cabinet' && !departmentId) {
      alert('Vui lòng chọn tủ trực khoa phòng lâm sàng!');
      return;
    }

    try {
      const res = await fetch('/api/audit/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || '',
          'X-User-DepartmentID': user?.departmentID?.toString() || ''
        },
        body: JSON.stringify({
          LocationType: locationType,
          DepartmentId: locationType === 'MainStore' ? null : parseInt(departmentId),
          CreatedBy: user?.fullName || 'Cán bộ kiểm kê',
          AuditType: auditType,
          Notes: notes
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Lỗi tạo phiếu kiểm kê');
        return;
      }
      setShowCreateModal(false);
      setNotes('');
      // Reset values
      setLocationType('MainStore');
      setDepartmentId('');
      setAuditType('Định kỳ');
      alert(`Đã khởi tạo phiếu kiểm kê ${data.auditCode} thành công! Kho đã bị khóa các giao dịch xuất nhập.`);
      fetchData();
      selectAudit(data);
    } catch (err) {
      alert('Lỗi kết nối máy chủ!');
    }
  };

  const selectAudit = (audit) => {
    setActiveAudit(audit);
    setIsEditing(false);
    // Populate quantities and reasons
    const qtys = {};
    const reasons = {};
    audit.details.forEach(d => {
      qtys[d.auditDetailID] = d.actualQuantity;
      reasons[d.auditDetailID] = d.reason || 'Hư hỏng';
    });
    setActualQuantities(qtys);
    setDiscrepancyReasons(reasons);
  };

  const handleUpdateQuantities = async () => {
    const updatedDetails = activeAudit.details.map(d => ({
      AuditDetailID: d.auditDetailID,
      ActualQuantity: actualQuantities[d.auditDetailID] !== undefined ? parseInt(actualQuantities[d.auditDetailID]) : d.systemQuantity,
      Reason: discrepancyReasons[d.auditDetailID] || 'Vỡ/Hỏng'
    }));

    try {
      const res = await fetch(`/api/audit/${activeAudit.auditID}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || '',
          'X-User-DepartmentID': user?.departmentID?.toString() || ''
        },
        body: JSON.stringify({
          AuditType: activeAudit.auditType,
          Notes: activeAudit.notes,
          Details: updatedDetails
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Lỗi cập nhật số liệu kiểm kê');
        return;
      }
      alert('Đã cập nhật số liệu kiểm kê và lý do chênh lệch.');
      setIsEditing(false);
      fetchData();
      selectAudit(data);
    } catch (e) {
      alert('Lỗi kết nối máy chủ!');
    }
  };

  const openSignatureModal = (target) => {
    // Validate role permissions based on target & store type
    if (target === 'confirm') {
      if (activeAudit.locationType === 'MainStore' && user?.role !== 'pharmacist' && user?.role !== 'director') {
        alert('Chỉ Dược sĩ trưởng / Thủ kho Dược mới có quyền xác nhận đối chiếu kho chẵn!');
        return;
      }
      if (activeAudit.locationType === 'Cabinet') {
        if (user?.role !== 'head_nurse') {
          alert('Chỉ Điều dưỡng trưởng khoa mới có quyền ký xác nhận đối chiếu tủ trực!');
          return;
        }
        if (user?.departmentID !== activeAudit.departmentID) {
          alert('Quyền ký bị giới hạn. Bạn chỉ được ký xác nhận tủ trực khoa của mình!');
          return;
        }
      }
    } else if (target === 'approve') {
      if (user?.role !== 'director') {
        alert('Chỉ Ban Giám Đốc (Lãnh đạo bệnh viện) mới có quyền duyệt chênh lệch lớn!');
        return;
      }
    }

    setSignatureTarget(target);
    setShowSignatureModal(true);
  };

  const handleConfirmSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureBase64 = canvas.toDataURL();

    // Check if canvas is empty
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      alert('Vui lòng vẽ chữ ký viết tay trước khi xác nhận!');
      return;
    }

    try {
      const endpoint = signatureTarget === 'confirm' 
        ? `/api/audit/${activeAudit.auditID}/confirm` 
        : `/api/audit/${activeAudit.auditID}/approve`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || '',
          'X-User-DepartmentID': user?.departmentID?.toString() || ''
        },
        body: JSON.stringify({
          Signature: signatureBase64,
          SignedBy: user?.fullName || 'Người ký'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Lỗi ký duyệt phiếu');
        return;
      }
      setShowSignatureModal(false);
      alert(signatureTarget === 'confirm' 
        ? 'Đã hoàn tất ký xác nhận đối chiếu. ' + (data.status === 'Có chênh lệch' ? 'Phát hiện chênh lệch lớn, đang chờ Ban Giám Đốc duyệt chênh lệch.' : 'Phiếu đã sẵn sàng để điều chỉnh tồn kho.')
        : 'Ban Giám Đốc đã ký duyệt chênh lệch thành công.'
      );
      fetchData();
      selectAudit(data);
    } catch (e) {
      alert('Lỗi kết nối máy chủ!');
    }
  };

  const handleCancelAudit = async () => {
    if (!cancelReason.trim()) {
      alert('Vui lòng nhập lý do hủy phiếu kiểm kê!');
      return;
    }

    try {
      const res = await fetch(`/api/audit/${activeAudit.auditID}/cancel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || '',
          'X-User-DepartmentID': user?.departmentID?.toString() || ''
        },
        body: JSON.stringify({
          Reason: cancelReason,
          CancelledBy: user?.fullName || 'Người hủy'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Lỗi hủy phiếu kiểm kê');
        return;
      }
      setShowCancelModal(false);
      setCancelReason('');
      alert('Phiếu kiểm kê đã được hủy thành công. Kho đã được mở khóa.');
      fetchData();
      selectAudit(data);
    } catch (e) {
      alert('Lỗi kết nối máy chủ!');
    }
  };

  const handleAdjustStock = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn thực hiện cân đối và điều chỉnh tồn kho theo số lượng thực tế kiểm kê? Hành động này sẽ cập nhật cơ sở dữ liệu và khóa vĩnh viễn phiếu kiểm kê.')) {
      return;
    }

    try {
      const res = await fetch(`/api/audit/${activeAudit.auditID}/adjust`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || '',
          'X-User-DepartmentID': user?.departmentID?.toString() || ''
        },
        body: JSON.stringify({
          AdjustedBy: user?.fullName || 'Thủ kho Dược'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Lỗi điều chỉnh tồn kho');
        return;
      }
      alert('Cân đối và điều chỉnh tồn kho vật lý thành công! Phiếu đã được khóa vĩnh viễn.');
      fetchData();
      selectAudit(data);
    } catch (e) {
      alert('Lỗi kết nối máy chủ!');
    }
  };

  const triggerPrint = (audit) => {
    setActiveAuditForPrint(audit);
    setTimeout(() => {
      const printContents = document.getElementById('printable-audit-invoice').innerHTML;
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload(); // Quick refresh to restore React bindings cleanly
    }, 300);
  };

  // Helper calculating badge color for HSD
  const getExpiryBadge = (expiryDateStr) => {
    if (!expiryDateStr) return null;
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span style={{ color: '#ef4444', background: '#fee2e2', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold' }}>Hết hạn</span>;
    }
    if (diffDays < 30) {
      return <span style={{ color: '#ef4444', background: '#fee2e2', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold' }}>Hạn &lt;30 ngày 🔴</span>;
    }
    if (diffDays < 90) {
      return <span style={{ color: '#f97316', background: '#ffedd5', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold' }}>Hạn &lt;90 ngày 🟠</span>;
    }
    return null;
  };

  const getPriorityBadge = (prio) => {
    switch (prio) {
      case 'Critical':
        return <span style={{ color: '#f43f5e', background: '#ffe4e6', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold' }}>Gây nghiện 🚨</span>;
      case 'High':
        return <span style={{ color: '#a855f7', background: '#f3e8ff', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 'bold' }}>Hướng thần ⚕️</span>;
      case 'Medium':
        return <span style={{ color: '#3b82f6', background: '#dbeafe', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem' }}>Kháng sinh</span>;
      default:
        return null;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Nháp': return 'status-draft';
      case 'Chờ xác nhận': return 'status-pending';
      case 'Có chênh lệch': return 'status-urgent';
      case 'Đã xác nhận': return 'status-processing';
      case 'Đã điều chỉnh': return 'status-approved';
      case 'Đã hủy': return 'status-rejected';
      default: return '';
    }
  };

  // Parse timeline
  const parseTimeline = (timelineJson) => {
    try {
      return JSON.parse(timelineJson || '[]');
    } catch (e) {
      return [];
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: activeAudit ? '1fr 380px' : '1fr', gap: '1.5rem', width: '100%' }}>
      <div className="glass-card" style={{ padding: '1.5rem', marginBottom: 0 }}>
        {/* Title Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardCheck size={24} color="var(--color-secondary)" /> Kiểm Kê & Cân Đối Tồn Kho
            </h2>
            <p className="section-subtitle">
              Đối soát tồn kho hệ thống với thực tế, phê duyệt chênh lệch và điều chỉnh số liệu tồn kho an toàn.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={fetchData}>
              <RefreshCw size={15} /> Làm mới
            </button>
            {(user?.role === 'pharmacist' || user?.role === 'director') && (
              <button 
                className="btn-premium" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} /> Lập Phiếu Kiểm Kê
              </button>
            )}
          </div>
        </div>

        {/* Tab Links */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('audit')}
            style={{
              background: activeTab === 'audit' ? 'var(--color-secondary)' : 'none',
              color: activeTab === 'audit' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              transition: 'all 0.15s ease'
            }}
          >
            Danh Sách Phiếu Kiểm Kê
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            style={{
              background: activeTab === 'logs' ? 'var(--color-secondary)' : 'none',
              color: activeTab === 'logs' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              transition: 'all 0.15s ease'
            }}
          >
            Nhật Ký Điều Chỉnh Tồn Kho
          </button>
        </div>

        {/* LOADING SCREEN */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw className="spin-icon" size={32} style={{ marginBottom: '1rem' }} />
            <p>Đang tải dữ liệu kiểm kê kho phòng lâm sàng...</p>
          </div>
        ) : activeTab === 'audit' ? (
          /* AUDIT LIST TAB */
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Kho / Tủ trực</th>
                  <th>Ngày lập</th>
                  <th>Người lập</th>
                  <th>Loại kiểm kê</th>
                  <th>Cảnh báo</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {audits.length > 0 ? (
                  audits.map(a => (
                    <tr 
                      key={a.auditID} 
                      className={activeAudit?.auditID === a.auditID ? 'row-selected' : ''}
                      onClick={() => selectAudit(a)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 'bold', color: 'var(--color-secondary)' }}>{a.auditCode}</td>
                      <td>
                        {a.locationType === 'MainStore' ? (
                          <span style={{ fontWeight: '600' }}>📦 Kho Chẵn Chính</span>
                        ) : (
                          <span>🏥 Tủ trực: {a.department?.departmentName}</span>
                        )}
                      </td>
                      <td>{new Date(a.auditDate).toLocaleDateString('vi-VN')}</td>
                      <td>{a.createdBy}</td>
                      <td>{a.auditType}</td>
                      <td>
                        {a.discrepancyThresholdExceeded ? (
                          <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <AlertTriangle size={13} /> Lệch lớn
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Không</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${getStatusClass(a.status)}`}>
                          {a.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button 
                            className="action-btn view" 
                            title="Xem chi tiết"
                            onClick={() => selectAudit(a)}
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            className="action-btn edit" 
                            title="In biên bản kiểm kê"
                            onClick={() => triggerPrint(a)}
                          >
                            <Printer size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Không có phiếu kiểm kê nào được lập.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* STOCK ADJUSTMENT LOGS TAB */
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Ngày điều chỉnh</th>
                  <th>Thuốc</th>
                  <th>Số lô</th>
                  <th>Kho/Phòng</th>
                  <th>Tồn cũ</th>
                  <th>Tồn thực tế</th>
                  <th>Chênh lệch</th>
                  <th>Người thực hiện</th>
                  <th>Lý do ghi nhận</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map(l => (
                    <tr key={l.logID}>
                      <td>{new Date(l.adjustmentDate).toLocaleString('vi-VN')}</td>
                      <td style={{ fontWeight: 'bold' }}>{l.batch?.medicine?.medicineName}</td>
                      <td>{l.batch?.batchNumber}</td>
                      <td>
                        {l.locationType === 'MainStore' ? (
                          <span style={{ color: 'var(--color-primary)' }}>Kho chẵn</span>
                        ) : (
                          <span>Tủ trực: {departments.find(d => d.departmentID === l.departmentID)?.departmentName || 'Khoa phòng'}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>{l.oldQuantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{l.newQuantity}</td>
                      <td style={{ 
                        textAlign: 'right', 
                        fontWeight: 'bold', 
                        color: l.discrepancy > 0 ? '#10b981' : l.discrepancy < 0 ? '#ef4444' : 'var(--text-main)' 
                      }}>
                        {l.discrepancy > 0 ? `+${l.discrepancy}` : l.discrepancy}
                      </td>
                      <td>{l.adjustedBy}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '180px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {l.reason}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      Chưa có lịch sử điều chỉnh số liệu tồn kho.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RIGHT AUDIT DETAIL PANEL */}
      {activeAudit && (
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: 'fit-content', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 'bold', color: 'var(--color-secondary)' }}>Phiếu: {activeAudit.auditCode}</h3>
            <button 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              onClick={() => setActiveAudit(null)}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ fontSize: '0.82rem', lineHeight: '1.6', marginBottom: '1.25rem', color: 'var(--text-muted)' }}>
            <p><strong>Loại kho:</strong> {activeAudit.locationType === 'MainStore' ? '📦 Kho Chẵn Chính' : `🏥 Tủ trực: ${activeAudit.department?.departmentName}`}</p>
            <p><strong>Ngày kiểm:</strong> {new Date(activeAudit.auditDate).toLocaleString('vi-VN')}</p>
            <p><strong>Loại kiểm kê:</strong> {activeAudit.auditType}</p>
            <p><strong>Ghi chú:</strong> {activeAudit.notes || 'Không'}</p>
            <div style={{ marginTop: '0.5rem' }}>
              <strong>Trạng thái: </strong>
              <span className={`status-badge ${getStatusClass(activeAudit.status)}`} style={{ fontSize: '0.7rem' }}>
                {activeAudit.status}
              </span>
            </div>
          </div>

          {/* DRUG LIST UNDER AUDIT */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Chi tiết lô kiểm đếm:</h4>
            {activeAudit.details?.length > 0 ? (
              activeAudit.details.map(d => {
                const diff = (actualQuantities[d.auditDetailID] !== undefined ? parseInt(actualQuantities[d.auditDetailID]) : d.systemQuantity) - d.systemQuantity;
                return (
                  <div key={d.auditDetailID} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-main)' }}>{d.batch?.medicine?.medicineName}</span>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {getExpiryBadge(d.batch?.expiryDate)}
                        {getPriorityBadge(d.batch?.medicine?.priorityLevel)}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '0.15rem' }}>
                      <span>Lô: {d.batch?.batchNumber} - HSD: {new Date(d.batch?.expiryDate).toLocaleDateString('vi-VN')}</span>
                      <span>Tồn: <strong>{d.systemQuantity}</strong></span>
                    </div>

                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Thực tế:</span>
                        {isEditing && activeAudit.status === 'Nháp' ? (
                          <input 
                            type="number" 
                            min="0"
                            style={{ width: '65px', height: '24px', fontSize: '0.78rem', background: '#0a0f1d', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '4px', textAlign: 'center' }}
                            value={actualQuantities[d.auditDetailID] !== undefined ? actualQuantities[d.auditDetailID] : d.actualQuantity}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setActualQuantities({ ...actualQuantities, [d.auditDetailID]: val });
                            }}
                          />
                        ) : (
                          <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>{d.actualQuantity}</span>
                        )}
                      </div>
                      <span style={{ 
                        fontSize: '0.78rem', 
                        fontWeight: 'bold', 
                        color: diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : 'var(--text-muted)' 
                      }}>
                        {diff > 0 ? `+${diff} Lệch` : diff < 0 ? `${diff} Lệch` : 'Khớp'}
                      </span>
                    </div>

                    {/* Discrepancy Reason Input */}
                    {diff !== 0 && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <span style={{ fontSize: '0.7rem', color: '#f87171', display: 'block', marginBottom: '0.15rem' }}>Lý do chênh lệch:</span>
                        {isEditing && activeAudit.status === 'Nháp' ? (
                          <select
                            style={{ width: '100%', height: '26px', fontSize: '0.74rem', background: '#0a0f1d', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '4px' }}
                            value={discrepancyReasons[d.auditDetailID] || 'Vỡ/Hỏng'}
                            onChange={(e) => setDiscrepancyReasons({ ...discrepancyReasons, [d.auditDetailID]: e.target.value })}
                          >
                            <option value="Hư hỏng">Hư hỏng / Hết hạn</option>
                            <option value="Vỡ/Hao hụt vật lý">Vỡ / Hao hụt vật lý</option>
                            <option value="Xuất thiếu chứng từ">Xuất thiếu chứng từ</option>
                            <option value="Nhập sai số liệu">Nhập sai số liệu</option>
                            <option value="Thất thoát">Thất thoát không rõ</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: '0.74rem', fontStyle: 'italic', color: '#fca5a5' }}>
                            {d.reason || 'Vỡ/Hao hụt vật lý'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Không có lô nào trong kho để kiểm đếm.</p>
            )}
          </div>

          {/* VISUAL TIMELINE */}
          <div style={{ marginBottom: '1.25rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Activity size={14} color="var(--color-secondary)" /> Nhật ký Dòng thời gian:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
              {parseTimeline(activeAudit.timelineJson).map((e, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', lineHeight: '1.3' }}>
                  <div style={{ color: 'var(--color-secondary)', whiteSpace: 'nowrap' }}>{e.Time}</div>
                  <div style={{ borderLeft: '2px solid var(--border-glass)', paddingLeft: '0.5rem', paddingBottom: '0.25rem' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{e.Activity}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>Thực hiện: {e.User}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {activeAudit.status === 'Nháp' && (
              <>
                {!isEditing ? (
                  <button 
                    className="btn-premium" 
                    style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
                    onClick={() => setIsEditing(true)}
                  >
                    Nhập Số Liệu Thực Tế
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn-secondary" 
                      style={{ flex: 1, height: '36px', fontSize: '0.82rem' }}
                      onClick={() => setIsEditing(false)}
                    >
                      Hủy
                    </button>
                    <button 
                      className="btn-premium" 
                      style={{ flex: 1, height: '36px', fontSize: '0.82rem' }}
                      onClick={handleUpdateQuantities}
                    >
                      Lưu số liệu
                    </button>
                  </div>
                )}
                
                <button 
                  className="btn-secondary" 
                  style={{ width: '100%', height: '36px', fontSize: '0.82rem', background: '#059669', color: '#fff', border: 'none' }}
                  onClick={() => openSignatureModal('confirm')}
                >
                  Ký Đối Chiếu Xác Nhận
                </button>
              </>
            )}

            {activeAudit.status === 'Có chênh lệch' && user?.role === 'director' && (
              <button 
                className="btn-premium" 
                style={{ width: '100%', height: '36px', fontSize: '0.82rem', background: '#7c3aed', color: '#fff', border: 'none' }}
                onClick={() => openSignatureModal('approve')}
              >
                Ký Duyệt Chênh Lệch Lớn
              </button>
            )}

            {activeAudit.status === 'Đã xác nhận' && (user?.role === 'pharmacist' || user?.role === 'director') && (
              <button 
                className="btn-premium" 
                style={{ width: '100%', height: '36px', fontSize: '0.82rem', background: '#2563eb', color: '#fff', border: 'none' }}
                onClick={handleAdjustStock}
              >
                Cân Đối & Điều Chỉnh Tồn Kho
              </button>
            )}

            {(activeAudit.status === 'Nháp' || activeAudit.status === 'Chờ xác nhận' || activeAudit.status === 'Có chênh lệch' || activeAudit.status === 'Đã xác nhận') && (
              <button 
                className="btn-secondary" 
                style={{ width: '100%', height: '36px', fontSize: '0.82rem', background: '#dc2626', color: '#fff', border: 'none' }}
                onClick={() => setShowCancelModal(true)}
              >
                Hủy Bỏ Phiếu Kiểm Kê
              </button>
            )}

            <button 
              className="btn-secondary" 
              style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
              onClick={() => triggerPrint(activeAudit)}
            >
              In Biên Bản A4
            </button>
          </div>
        </div>
      )}

      {/* CREATE AUDIT MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ zIndex: 900 }}>
          <div className="modal-content" style={{ maxWidth: '500px', padding: '2rem' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setShowCreateModal(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} color="var(--color-primary)" /> Lập Phiếu Kiểm Kê Kho Mới
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Khởi tạo snapshot đối soát tồn kho. Sau khi lập phiếu, hệ thống sẽ tự động khóa các giao dịch xuất nhập kho tương ứng để tránh sai lệch số liệu.
            </p>

            <form onSubmit={handleCreateAudit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Chọn Kho / Tủ Trực Kiểm Kê</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.35rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.82rem' }}>
                    <input 
                      type="radio" 
                      name="locationType" 
                      value="MainStore" 
                      checked={locationType === 'MainStore'} 
                      onChange={() => setLocationType('MainStore')} 
                    />
                    📦 Kho Chẵn Chính
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.82rem' }}>
                    <input 
                      type="radio" 
                      name="locationType" 
                      value="Cabinet" 
                      checked={locationType === 'Cabinet'} 
                      onChange={() => setLocationType('Cabinet')} 
                    />
                    🏥 Tủ Trực Khoa Lâm Sàng
                  </label>
                </div>
              </div>

              {locationType === 'Cabinet' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Khoa Lâm Sàng</label>
                  <select 
                    className="form-input" 
                    value={departmentId} 
                    onChange={(e) => setDepartmentId(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn khoa phòng tủ trực --</option>
                    {departments.map(d => (
                      <option key={d.departmentID} value={d.departmentID}>{d.departmentName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Loại Kiểm Kê</label>
                <select className="form-input" value={auditType} onChange={(e) => setAuditType(e.target.value)}>
                  <option value="Định kỳ">Hàng tháng / Hàng quý (Định kỳ)</option>
                  <option value="Đột xuất">Kiểm kê đột xuất</option>
                  <option value="Cuối năm">Quyết toán cuối năm</option>
                  <option value="Sau thu hồi">Sau thu hồi và cách ly lô</option>
                  <option value="Kiểm kê luân phiên">Kiểm kê luân phiên (Cycle count)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Ghi Chú / Lý Do</label>
                <textarea 
                  className="form-input" 
                  rows="3" 
                  placeholder="Ghi chú mục đích hoặc phân công hội đồng kiểm kê..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Hủy</button>
                <button type="submit" className="btn-premium">Lập Phiếu Đăng Ký</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIGITAL SIGNATURE MODAL */}
      {showSignatureModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '500px', padding: '2rem' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setShowSignatureModal(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PenTool size={20} color="var(--color-secondary)" /> {signatureTarget === 'confirm' ? 'Ký Xác Nhận Đối Chiếu Kiểm Kê' : 'Lãnh Đạo Phê Duyệt Ký Số'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              Vui lòng vẽ chữ ký viết tay của bạn vào ô bên dưới để ghi dấu ấn kiểm toán và lưu mốc thời gian ký.
            </p>

            <div style={{ 
              background: '#f8fafc', 
              border: '2px dashed #cbd5e1', 
              borderRadius: '8px', 
              overflow: 'hidden', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              position: 'relative'
            }}>
              <canvas 
                ref={canvasRef} 
                width="440" 
                height="200" 
                style={{ 
                  background: '#ffffff', 
                  cursor: 'crosshair',
                  touchAction: 'none'
                }}
              />
              <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', fontSize: '0.7rem', color: '#94a3b8', pointerEvents: 'none' }}>
                Khung ký vẽ tay (Canvas)
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={clearCanvas}
              >
                <Eraser size={14} /> Xóa vẽ lại
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setShowSignatureModal(false)}>Hủy</button>
                <button 
                  type="button" 
                  className="btn-premium" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 1rem', fontSize: '0.8rem' }}
                  onClick={handleConfirmSignature}
                >
                  <ThumbsUp size={14} /> Xác nhận ký số
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {showCancelModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '450px', padding: '2rem' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setShowCancelModal(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '0.5rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Ban size={20} /> Hủy Bỏ Phiếu Kiểm Kê
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem' }}>
              Hủy bỏ phiếu kiểm kê sẽ giải phóng trạng thái khóa kho, cho phép các giao dịch xuất nhập kho diễn ra bình thường trở lại.
            </p>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Lý do hủy bắt buộc (*)</label>
              <textarea 
                className="form-input" 
                rows="3" 
                placeholder="Nhập lý do hủy phiếu..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setShowCancelModal(false)}>Hủy</button>
              <button 
                className="btn-premium" 
                style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                onClick={handleCancelAudit}
              >
                Xác Nhận Hủy Phiếu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A4 PRINT LAYOUT CONTAINER */}
      {activeAuditForPrint && (
        <div style={{ display: 'none' }}>
          <div id="printable-audit-invoice" style={{ fontFamily: '"Times New Roman", Times, serif', padding: '2rem', color: '#000', fontSize: '13.5px', lineHeight: '1.4' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', marginBottom: '1.5rem', borderBottom: '2px solid #000', paddingBottom: '0.8rem' }}>
              <div>
                <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase' }}>SỞ Y TẾ THÀNH PHỐ HỒ CHÍ MINH</p>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', textDecoration: 'underline' }}>BỆNH VIỆN ĐA KHOA HIS PHARMACY</p>
                <p style={{ margin: 0, fontSize: '11px', fontStyle: 'italic' }}>Địa chỉ: 120 Trần Hưng Đạo, Quận 1, TP.HCM</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', textDecoration: 'underline' }}>Độc lập - Tự do - Hạnh phúc</p>
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: '11px' }}>Hồ Chí Minh, ngày {new Date(activeAuditForPrint.auditDate).getDate()} tháng {new Date(activeAuditForPrint.auditDate).getMonth() + 1} năm {new Date(activeAuditForPrint.auditDate).getFullYear()}</p>
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
              <h3 style={{ margin: '0 0 0.3rem 0', fontWeight: 'bold', fontSize: '18px', textTransform: 'uppercase' }}>BIÊN BẢN KIỂM KÊ KHO DƯỢC</h3>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '13px' }}>Mã số phiếu: {activeAuditForPrint.auditCode}</p>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: '11px' }}>(Đối chiếu số liệu tồn kho hệ thống và tồn kho thực đếm thực tế)</p>
            </div>

            {/* General Info */}
            <div style={{ marginBottom: '1.25rem', background: '#f9f9f9', padding: '0.75rem', borderRadius: '4px', border: '1px solid #ddd' }}>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>1. Kho kiểm kê:</strong> {activeAuditForPrint.locationType === 'MainStore' ? 'Kho Chẵn Chính Bệnh Viện' : `Tủ Trực Lâm Sàng Khoa: ${activeAuditForPrint.department?.departmentName}`}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>2. Thời điểm kiểm kê:</strong> {new Date(activeAuditForPrint.auditDate).toLocaleString('vi-VN')}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>3. Loại hình kiểm kê:</strong> {activeAuditForPrint.auditType}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>4. Hội đồng / Cán bộ lập biên bản:</strong> {activeAuditForPrint.createdBy}</p>
              <p style={{ margin: 0 }}><strong>5. Ý kiến ghi chú:</strong> {activeAuditForPrint.notes || 'Không ghi nhận ý kiến đặc biệt.'}</p>
            </div>

            {/* Table Detail */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f2f2f2', fontWeight: 'bold' }}>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '40px' }}>STT</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Tên thuốc / vật tư y tế</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '80px' }}>Số lô</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '80px' }}>Hạn dùng</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '60px' }}>Đơn vị</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', width: '80px' }}>Tồn hệ thống</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', width: '80px' }}>Thực tế đếm</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', width: '80px' }}>Chênh lệch</th>
                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', width: '130px' }}>Lý do chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {activeAuditForPrint.details?.map((d, index) => (
                  <tr key={d.auditDetailID}>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>{d.batch?.medicine?.medicineName}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{d.batch?.batchNumber}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{new Date(d.batch?.expiryDate).toLocaleDateString('vi-VN')}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{d.batch?.medicine?.unit}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{d.systemQuantity}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{d.actualQuantity}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', fontWeight: 'bold', color: d.discrepancy !== 0 ? '#ff0000' : '#000' }}>
                      {d.discrepancy > 0 ? `+${d.discrepancy}` : d.discrepancy}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '6px', fontSize: '11px', color: '#ff0000', fontStyle: 'italic' }}>
                      {d.discrepancy !== 0 ? (d.reason || 'Hao hụt tự nhiên/hỏng') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Audit Timeline */}
            <div style={{ marginBottom: '2rem', fontSize: '11.5px', border: '1px solid #ddd', padding: '0.6rem', borderRadius: '4px' }}>
              <p style={{ margin: '0 0 0.3rem 0', fontWeight: 'bold' }}>DÒNG THỜI GIAN KIỂM TOÁN VÀ XÁC THỰC MỐC THỜI GIAN KÝ SỐ:</p>
              {parseTimeline(activeAuditForPrint.timelineJson).map((e, idx) => (
                <p key={idx} style={{ margin: '0 0 0.15rem 0' }}>• {e.Time} - {e.Activity} (Người thực hiện: {e.User})</p>
              ))}
            </div>

            {/* Signatures Block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center', fontSize: '13px', marginTop: '1.5rem', pageBreakInside: 'avoid' }}>
              
              {/* Creator */}
              <div>
                <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold' }}>THỦ KHO DƯỢC / NGƯỜI LẬP</p>
                <p style={{ margin: '0 0 0.5rem 0', color: '#555', fontStyle: 'italic', fontSize: '11px' }}>(Ký nhận thực đếm)</p>
                <div style={{ height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                  {SIG.khoa}
                </div>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{activeAuditForPrint.createdBy}</p>
                <p style={{ margin: 0, color: '#666', fontSize: '10px' }}>(Đã xác nhận kiểm kê)</p>
              </div>

              {/* Checker / Supervisor */}
              <div>
                <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold' }}>DƯỢC SĨ TRƯỞNG / TRƯỞNG KHOA</p>
                <p style={{ margin: '0 0 0.5rem 0', color: '#555', fontStyle: 'italic', fontSize: '11px' }}>(Ký xác nhận đối chiếu)</p>
                <div style={{ height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                  {activeAuditForPrint.checkerSignature ? (
                    <img src={activeAuditForPrint.checkerSignature} alt="Chữ ký Cán bộ xác nhận" style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain' }} />
                  ) : activeAuditForPrint.status === 'Đã điều chỉnh' || activeAuditForPrint.status === 'Đã xác nhận' ? (
                    activeAuditForPrint.locationType === 'MainStore' ? SIG.khoa : SIG.chuong
                  ) : (
                    <span style={{ color: '#888', fontStyle: 'italic', fontSize: '11px' }}>Chưa ký đối chiếu</span>
                  )}
                </div>
                <p style={{ margin: 0, fontWeight: 'bold' }}>
                  {activeAuditForPrint.checkerSignedBy || 
                   (activeAuditForPrint.locationType === 'MainStore' ? 'Dược sĩ trưởng khoa Dược' : 'Điều dưỡng trưởng khoa lâm sàng')}
                </p>
                {activeAuditForPrint.checkerSignedAt && (
                  <p style={{ margin: 0, color: '#666', fontSize: '10px' }}>Ký lúc: {new Date(activeAuditForPrint.checkerSignedAt).toLocaleString('vi-VN')}</p>
                )}
              </div>

              {/* Director */}
              <div>
                <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold' }}>ĐẠI DIỆN BAN GIÁM ĐỐC</p>
                <p style={{ margin: '0 0 0.5rem 0', color: '#555', fontStyle: 'italic', fontSize: '11px' }}>(Ký đóng dấu phê duyệt)</p>
                <div style={{ height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0', position: 'relative' }}>
                  {activeAuditForPrint.directorSignature ? (
                    <>
                      <img src={activeAuditForPrint.directorSignature} alt="Chữ ký Giám đốc" style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain', position: 'absolute', zIndex: 1 }} />
                      <div style={{ position: 'absolute', zIndex: 2, top: '-15px', left: '50%', transform: 'translateX(-40%)', pointerEvents: 'none' }}>
                        <RedStamp name="PGS.TS. L.M.DƯỢC" />
                      </div>
                    </>
                  ) : activeAuditForPrint.discrepancyThresholdExceeded && (activeAuditForPrint.status === 'Đã điều chỉnh' || activeAuditForPrint.status === 'Đã xác nhận') ? (
                    <>
                      <div style={{ position: 'absolute', zIndex: 1 }}>{SIG.duoc}</div>
                      <div style={{ position: 'absolute', zIndex: 2, top: '-15px', left: '50%', transform: 'translateX(-40%)', pointerEvents: 'none' }}>
                        <RedStamp name="PGS.TS. L.M.DƯỢC" />
                      </div>
                    </>
                  ) : (
                    <span style={{ color: '#888', fontStyle: 'italic', fontSize: '11px' }}>
                      {activeAuditForPrint.discrepancyThresholdExceeded ? 'Chờ Ban Giám Đốc duyệt' : 'Không yêu cầu'}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontWeight: 'bold' }}>PGS.TS. Lê Minh Dược</p>
                {activeAuditForPrint.directorSignedAt && (
                  <p style={{ margin: 0, color: '#666', fontSize: '10px' }}>Ký lúc: {new Date(activeAuditForPrint.directorSignedAt).toLocaleString('vi-VN')}</p>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
