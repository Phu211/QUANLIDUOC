import React, { useState, useEffect, useRef } from 'react';
import { AlertOctagon, FileText, Check, Printer, RefreshCw, Layers, ShieldAlert, RotateCcw, Search, X, PenTool, Eraser, ThumbsUp } from 'lucide-react';

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

const RedStamp = ({ name, subText = "KHOA DƯỢC ★" }) => (
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
      <textPath href="#stampTextPathBottom" startOffset="50%" textAnchor="middle">{subText}</textPath>
    </text>
    <text x="60" y="52" fill="#dc2626" fontSize="10" fontFamily="Times New Roman, serif" fontWeight="bold" textAnchor="middle">ĐÃ DUYỆT</text>
    <text x="60" y="66" fill="#dc2626" fontSize="6.5" fontFamily="Arial, sans-serif" fontWeight="bold" textAnchor="middle">{name}</text>
  </svg>
);

export default function Recall({ user }) {
  const [recalls, setRecalls] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedBatchID, setSelectedBatchID] = useState('');
  const [reason, setReason] = useState('Thu hồi từ nhà sản xuất / Bộ Y tế');
  const [actionType, setActionType] = useState('Cách ly'); // 'Cách ly', 'Trả NCC', 'Tiêu hủy'
  const [searchTerm, setSearchTerm] = useState('');

  // Print States
  const [activeRecallForPrint, setActiveRecallForPrint] = useState(null);

  // Digital Signature States
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState(null); // { action: 'create' } or { action: 'approve', id: 123 }
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);

  // Canvas drawing setup for digital signature
  useEffect(() => {
    if (showSignatureModal) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#1e3a8a'; // Dark clinical blue ink
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

  const handleConfirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const buffer = new Uint32Array(
      canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    const isEmpty = !buffer.some(color => color !== 0);
    if (isEmpty) {
      alert("Vui lòng vẽ chữ ký tay của bạn lên bảng trước khi xác nhận.");
      return;
    }

    const base64Signature = canvas.toDataURL('image/png');
    setShowSignatureModal(false);
    
    if (signatureTarget?.action === 'create') {
      handleCreateRecall(null, base64Signature);
    } else if (signatureTarget?.action === 'approve') {
      handleApproveRecall(signatureTarget.id, base64Signature);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/recall').then(res => res.json()),
      fetch('/api/inventory/batches').then(res => res.json())
    ])
    .then(([recallData, batchData]) => {
      setRecalls(recallData);
      setAllBatches(batchData);
      setLoading(false);
      setSelectedBatchID('');
    })
    .catch(err => {
      console.error("Error loading recall data: ", err);
      setLoading(false);
    });
  };

  const handleCreateRecall = (e, signatureData = null) => {
    if (e) e.preventDefault();
    if (!selectedBatchID) {
      alert("Vui lòng chọn lô thuốc cần thu hồi.");
      return;
    }
    if (!reason) {
      alert("Vui lòng nhập lý do thu hồi.");
      return;
    }

    if (!signatureData) {
      setSignatureTarget({ action: 'create' });
      setShowSignatureModal(true);
      return;
    }

    const payload = {
      batchID: parseInt(selectedBatchID),
      reason: reason,
      actionType: actionType,
      digitalSignature: signatureData
    };

    fetch('/api/recall/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || '',
        'X-User-FullName': encodeURIComponent(user?.fullName || '')
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) return res.json().then(data => { throw new Error(data.error || "Lỗi tạo phiếu."); });
      return res.json();
    })
    .then(() => {
      alert("Thiết lập lệnh thu hồi / cách ly thành công!");
      fetchData();
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  const handleRestoreRecall = (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy lệnh cách ly và đưa lô thuốc này quay lại hoạt động bình thường?")) return;
    fetch(`/api/recall/${id}/restore`, {
      method: 'POST',
      headers: {
        'X-User-Role': user?.role || '',
        'X-User-FullName': encodeURIComponent(user?.fullName || '')
      }
    })
    .then(res => {
      if (!res.ok) return res.json().then(data => { throw new Error(data.error || "Lỗi khôi phục."); });
      return res.json();
    })
    .then(() => {
      alert("Lô thuốc đã được giải phóng cách ly thành công!");
      fetchData();
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  const handleStartApproveRecall = (id) => {
    setSignatureTarget({ action: 'approve', id: id });
    setShowSignatureModal(true);
  };

  const handleApproveRecall = (id, signatureData) => {
    fetch(`/api/recall/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || '',
        'X-User-FullName': encodeURIComponent(user?.fullName || '')
      },
      body: JSON.stringify({
        ApprovedBy: user?.fullName || 'PGS.TS. Lê Minh Trí',
        DigitalSignature: signatureData
      })
    })
    .then(res => {
      if (!res.ok) return res.json().then(data => { throw new Error(data.error || "Lỗi duyệt phiếu."); });
      return res.json();
    })
    .then(() => {
      alert("Lãnh đạo đã duyệt và ký tên quyết định thu hồi thuốc thành công!");
      fetchData();
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  const handleRejectRecall = (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn từ chối quyết định thu hồi này và đưa lô thuốc về hoạt động bình thường?")) return;
    fetch(`/api/recall/${id}/reject`, {
      method: 'POST',
      headers: {
        'X-User-Role': user?.role || ''
      }
    })
    .then(res => {
      if (!res.ok) return res.json().then(data => { throw new Error(data.error || "Lỗi từ chối."); });
      return res.json();
    })
    .then(() => {
      alert("Lãnh đạo đã từ chối lệnh thu hồi.");
      fetchData();
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  // Filter batches based on search
  const filteredBatches = allBatches.filter(b => 
    (b.medicineName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.batchNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div style={{ color: '#fff', padding: '2rem' }}>Đang tải dữ liệu nghiệp vụ thu hồi...</div>;

  return (
    <div>
      <h1 className="page-title">Thu Hồi & Cách Ly Thuốc</h1>
      <p className="page-subtitle">Quản lý cách ly khẩn cấp, đình chỉ phát hành hoặc hủy bỏ/trả NCC các lô thuốc không đạt tiêu chuẩn GSP.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {/* Left Side: Create recall command */}
        <div>
          <div className="glass-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)', marginBottom: '1.25rem', fontSize: '1.1rem' }}>
              <ShieldAlert size={20} /> Lập Lệnh Đình Chỉ / Thu Hồi Lô Thuốc
            </h3>

            <form onSubmit={handleCreateRecall}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Tìm kiếm lô thuốc đang hoạt động</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Nhập tên thuốc hoặc số lô để tìm..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '2.2rem' }}
                  />
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Chọn lô thuốc cần xử lý (Tìm thấy {filteredBatches.length} lô)</label>
                <select 
                  className="form-input"
                  value={selectedBatchID}
                  onChange={e => setSelectedBatchID(e.target.value)}
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                >
                  <option value="">-- Chọn lô thuốc --</option>
                  {filteredBatches.map(b => (
                    <option key={`${b.batchID}-${b.location}`} value={b.batchID}>
                      {b.medicineName} (Lô: {b.batchNumber} - Tồn: {b.quantity} - {b.location})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Lý do thu hồi / cách ly</label>
                <select 
                  className="form-input"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}
                >
                  <option value="Lỗi bao bì / đóng gói sản phẩm">Lỗi bao bì / đóng gói sản phẩm</option>
                  <option value="Vaccine / thuốc bảo quản sai nhiệt độ chuẩn">Vaccine / thuốc bảo quản sai nhiệt độ chuẩn</option>
                  <option value="Thuốc có dấu hiệu ẩm mốc, biến dạng màu sắc">Thuốc có dấu hiệu ẩm mốc, biến dạng màu sắc</option>
                  <option value="Quyết định thu hồi chính thức từ nhà sản xuất / Bộ Y tế">Quyết định thu hồi chính thức từ nhà sản xuất / Bộ Y tế</option>
                  <option value="Lô thuốc quá hạn bảo quản hoặc mất hồ sơ tem nhãn">Lô thuốc quá hạn bảo quản hoặc mất hồ sơ tem nhãn</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Hướng xử lý y tế</label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.88rem' }}>
                    <input 
                      type="radio" 
                      name="actionType" 
                      value="Cách ly" 
                      checked={actionType === 'Cách ly'} 
                      onChange={() => setActionType('Cách ly')}
                    />
                    Cách ly tạm thời (Khóa cấp phát)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.88rem' }}>
                    <input 
                      type="radio" 
                      name="actionType" 
                      value="Trả NCC" 
                      checked={actionType === 'Trả NCC'} 
                      onChange={() => setActionType('Trả NCC')}
                    />
                    Trả nhà cung cấp (Trừ tồn kho về 0)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.88rem' }}>
                    <input 
                      type="radio" 
                      name="actionType" 
                      value="Tiêu hủy" 
                      checked={actionType === 'Tiêu hủy'} 
                      onChange={() => setActionType('Tiêu hủy')}
                    />
                    Tiêu hủy kho hoàn toàn
                  </label>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn-premium" 
                style={{ 
                  width: '100%', 
                  justifyContent: 'center', 
                  background: actionType === 'Cách ly' ? 'linear-gradient(90deg, #f59e0b, #d97706)' : actionType === 'Trả NCC' ? 'linear-gradient(90deg, #3b82f6, #2563eb)' : 'linear-gradient(90deg, #ef4444, #dc2626)'
                }}
              >
                <ShieldAlert size={16} /> Thực hiện Thu hồi / Cách ly
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Recall log list */}
        <div>
          <div className="glass-card">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-secondary)', marginBottom: '1.25rem', fontSize: '1.1rem' }}>
              <FileText size={20} /> Lịch Sử Lệnh Thu Hồi & Biện Pháp
            </h3>

            <div style={{ maxHeight: '550px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {recalls.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>Chưa có lệnh thu hồi hoặc cách ly dược phẩm nào được thiết lập.</p>
              ) : (
                recalls.map(log => (
                  <div key={log.recallID} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700' }}>Biên bản #RCL-{log.recallID}</span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button 
                          className="btn-secondary" 
                          title="In quyết định thu hồi"
                          style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', height: '28px' }}
                          onClick={() => setActiveRecallForPrint(log)}
                        >
                          <Printer size={12} /> In biên bản
                        </button>
                        <span className="badge-status" style={{ 
                          fontSize: '0.72rem', 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '6px', 
                          fontWeight: '600',
                          textTransform: 'none',
                          background: log.status === 'Approved' ? 'rgba(16, 185, 129, 0.12)' : log.status === 'Rejected' ? 'rgba(100, 116, 139, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: log.status === 'Approved' ? '#10b981' : log.status === 'Rejected' ? '#64748b' : '#f59e0b',
                          border: log.status === 'Approved' ? '1px solid rgba(16, 185, 129, 0.2)' : log.status === 'Rejected' ? '1px solid rgba(100, 116, 139, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)'
                        }}>
                          {log.status === 'Approved' ? 'Đã duyệt quyết định' : log.status === 'Rejected' ? 'Đã từ chối' : 'Chờ Lãnh đạo duyệt'}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      <p style={{ margin: '0 0 0.35rem 0' }}><strong>Thuốc thu hồi:</strong> <span style={{ color: 'var(--color-secondary)', fontWeight: '600' }}>{log.batch?.medicine?.medicineName}</span></p>
                      <p style={{ margin: '0 0 0.35rem 0' }}><strong>Số lô:</strong> {log.batch?.batchNumber} - <strong>Hạn dùng:</strong> {log.batch ? new Date(log.batch.expiryDate).toLocaleDateString('vi-VN') : ''}</p>
                      <p style={{ margin: '0 0 0.35rem 0' }}><strong>Biện pháp:</strong> {log.actionType === 'Cách ly' ? 'Cách ly tạm thời' : log.actionType === 'Trả NCC' ? 'Trả Nhà cung cấp' : 'Tiêu hủy kho'}</p>
                      <p style={{ margin: '0 0 0.35rem 0' }}><strong>Lý do:</strong> {log.reason}</p>
                      <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}><strong>Người đề xuất:</strong> {log.createdBy}</p>
                      {log.status === 'Approved' && (
                        <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}><strong>Lãnh đạo duyệt:</strong> {log.approvedBy || 'PGS.TS. Lê Minh Trí'}</p>
                      )}
                      <p style={{ margin: '0 0 0.35rem 0' }}><strong>Ngày tạo lệnh:</strong> {new Date(log.recallDate).toLocaleString('vi-VN')}</p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
                        {log.status === 'Pending' && user?.role === 'director' && (
                          <>
                            <button
                              type="button"
                              className="btn-premium"
                              style={{ 
                                padding: '0.25rem 0.75rem', 
                                fontSize: '0.74rem', 
                                height: '28px', 
                                background: 'linear-gradient(135deg, #10b981, #059669)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.2rem', 
                                fontWeight: '600' 
                              }}
                              onClick={() => handleStartApproveRecall(log.recallID)}
                            >
                              <Check size={12} /> Ký Duyệt Quyết Định
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ 
                                padding: '0.25rem 0.75rem', 
                                fontSize: '0.74rem', 
                                height: '28px', 
                                color: '#ef4444', 
                                borderColor: 'rgba(239, 68, 68, 0.4)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.2rem', 
                                background: 'none' 
                              }}
                              onClick={() => handleRejectRecall(log.recallID)}
                            >
                              <X size={12} /> Từ chối
                            </button>
                          </>
                        )}
                        {log.status === 'Approved' && log.actionType === 'Cách ly' && (user?.role === 'pharmacist' || user?.role === 'director') &&
                          <button
                            type="button"
                            className="btn-premium"
                            style={{ 
                              padding: '0.25rem 0.75rem', 
                              fontSize: '0.74rem', 
                              height: '28px', 
                              background: 'linear-gradient(135deg, #10b981, #059669)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.2rem', 
                              fontWeight: '600' 
                            }}
                            onClick={() => handleRestoreRecall(log.recallID)}
                          >
                            <RotateCcw size={12} /> Giải phóng cách ly (Bình thường)
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PRINT MODAL (QUYẾT ĐỊNH THU HỒI DƯỢC PHẨM CHUYÊN NGHIỆP) */}
      {activeRecallForPrint && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto', background: '#fff', color: '#000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Bệnh Viện Đa Khoa HIS Pharmacy</h4>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.72rem', color: '#666' }}>Khoa Dược - Quản lý an toàn dược</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.72rem', fontStyle: 'italic' }}>Độc lập - Tự do - Hạnh phúc</p>
              </div>
            </div>

            <div id="printable-recall-invoice" style={{ fontFamily: 'Times New Roman, serif', padding: '0.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  QUYẾT ĐỊNH THU HỒI & ĐÌNH CHỈ PHÁT HÀNH DƯỢC PHẨM
                </h2>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#333', fontWeight: '600' }}>Mã quyết định: RCL-{activeRecallForPrint.recallID}</p>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>
                  Biện pháp xử lý: <strong>{activeRecallForPrint.actionType}</strong>
                </p>
              </div>

              <div style={{ fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                <p>Căn cứ thông báo chất lượng dược phẩm và quy chế chuyên môn Dược lâm sàng bệnh viện.</p>
                <p>Khoa Dược phối hợp với Hội đồng Thu hồi & Tiêu hủy quyết định xử lý lô thuốc sau:</p>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: '1rem', marginBottom: '1rem' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Tên thuốc / Hàm lượng</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Số lô</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Hạn dùng</th>
                      <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Đơn vị tính</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>{activeRecallForPrint.batch?.medicine?.medicineName}</strong></td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{activeRecallForPrint.batch?.batchNumber}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{activeRecallForPrint.batch ? new Date(activeRecallForPrint.batch.expiryDate).toLocaleDateString('vi-VN') : ''}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{activeRecallForPrint.batch?.medicine?.unit}</td>
                    </tr>
                  </tbody>
                </table>

                <p><strong>Lý do đình chỉ & thu hồi:</strong> {activeRecallForPrint.reason}</p>
                <p><strong>Phương hướng xử lý thực tế:</strong> {
                  activeRecallForPrint.actionType === 'Cách ly' 
                    ? 'Niêm phong, chuyển vào kho biệt trữ cách ly tạm thời, cấm mọi hành vi cấp phát lâm sàng.' 
                    : activeRecallForPrint.actionType === 'Trả NCC' 
                    ? 'Hủy tư cách sử dụng, trừ tồn kho về 0 và lập biên bản đóng gói hoàn trả cho Nhà cung cấp.'
                    : 'Bàn giao Hội đồng Tiêu hủy tiêu hủy an toàn theo quy trình rác thải y tế độc hại và trừ tồn kho.'
                }</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '3rem', fontSize: '0.85rem', textAlign: 'center' }}>
                <div>
                  <p style={{ margin: '0 0 1rem 0' }}><strong>ĐẠI DIỆN KHOA DƯỢC</strong><br />(Ký và ghi rõ họ tên)</p>
                  {activeRecallForPrint.digitalSignature ? (
                    <div style={{ margin: '0.5rem auto', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <img 
                        src={activeRecallForPrint.digitalSignature} 
                        alt="Chữ ký số" 
                        style={{ maxHeight: '100%', maxWidth: '200px', objectFit: 'contain' }} 
                      />
                    </div>
                  ) : (
                    <div style={{ margin: '0.5rem auto', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {SIG.khoa}
                    </div>
                  )}
                  <p style={{ margin: 0, fontStyle: 'italic', color: '#666' }}>{activeRecallForPrint.createdBy}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 0.2rem 0' }}><strong>GIÁM ĐỐC BỆNH VIỆN</strong><br />(Ký, đóng dấu duyệt)</p>
                  {activeRecallForPrint.status === 'Approved' ? (
                    <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.5rem 0', position: 'relative' }}>
                      {activeRecallForPrint.approverSignature ? (
                        <img 
                          src={activeRecallForPrint.approverSignature} 
                          alt="Chữ ký Lãnh đạo" 
                          style={{ maxHeight: '100%', maxWidth: '200px', objectFit: 'contain', zIndex: 1 }} 
                        />
                      ) : (
                        <div style={{ position: 'absolute', zIndex: 1 }}>{SIG.duoc}</div>
                      )}
                      <div style={{ position: 'absolute', zIndex: 2, top: '-15px', left: '50%', transform: 'translateX(-40%)', pointerEvents: 'none' }}>
                        <RedStamp name="PGS.TS. Lê Minh Trí" subText="GIÁM ĐỐC ★" />
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontStyle: 'italic', fontSize: '0.8rem' }}>
                      (Chờ Giám đốc phê duyệt ký tên)
                    </div>
                  )}
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{activeRecallForPrint.approvedBy || 'PGS.TS. Lê Minh Trí'}</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <button 
                className="btn-secondary" 
                onClick={() => window.print()}
                style={{ background: '#3b82f6', color: '#fff', border: 'none' }}
              >
                In Lệnh Thu Hồi
              </button>
              <button className="btn-secondary" onClick={() => setActiveRecallForPrint(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DIGITAL SIGNATURE MODAL */}
      {showSignatureModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', padding: '2rem' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setShowSignatureModal(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PenTool size={20} color="var(--color-secondary)" /> Ký Lệnh Thu Hồi / Cách Ly
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              Vui lòng vẽ chữ ký tay của bạn (Dược sĩ/Cán bộ phụ trách) vào ô dưới đây để xác nhận lệnh thu hồi / cách ly lô thuốc.
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
                height="220" 
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
                  <ThumbsUp size={14} /> Xác nhận ký lệnh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
