import React, { useState, useEffect, useRef } from 'react';
import { AlertOctagon, FileText, Check, Trash2, Printer, RefreshCw, Layers, PenTool, Eraser, ThumbsUp, X } from 'lucide-react';

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

export default function Liquidation({ user }) {
  const [liquidations, setLiquidations] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [reason, setReason] = useState('TL01 - Hết hạn sử dụng');
  const [selectedItems, setSelectedItems] = useState([]); // List of { batchID, location, quantity }
  const [allStoreBatches, setAllStoreBatches] = useState([]);
  const [activeTab, setActiveTab] = useState('liquidation'); // 'liquidation' or 'destruction'
  const [showAllLowUsage, setShowAllLowUsage] = useState(false); // Toggle to show other stock
  const [responsiblePerson, setResponsiblePerson] = useState('');

  // Digital Signature & Print States
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const [activeLiquidationForPrint, setActiveLiquidationForPrint] = useState(null);
  const [signatureTarget, setSignatureTarget] = useState(null); // { action, id }

  const getLiquidationCode = (liq) => {
    if (!liq) return '';
    const date = new Date(liq.liquidationDate);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const seq = String(liq.liquidationID).padStart(4, '0');
    const prefix = liq.type === 'Thanh lý' ? 'BBTL' : 'BBTH';
    return `${prefix}-${yyyy}${mm}${dd}-${seq}`;
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/liquidation').then(res => res.json()),
      fetch('/api/liquidation/expired').then(res => res.json()),
      fetch('/api/inventory/batches').then(res => res.json())
    ])
    .then(([liqData, expData, allBatches]) => {
      setLiquidations(liqData);
      setExpiredItems(expData);
      setAllStoreBatches(allBatches);
      setLoading(false);
      setSelectedItems([]);
      setReason('TL01 - Hết hạn sử dụng');
      setResponsiblePerson('');
    })
    .catch(err => {
      console.error("Error loading liquidation data: ", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();

    const handleUpdate = (e) => {
      if (e.detail === 'Liquidations') {
        fetchData();
      }
    };
    window.addEventListener('pharmacy-update', handleUpdate);
    return () => window.removeEventListener('pharmacy-update', handleUpdate);
  }, []);

  // Interactive Canvas Drawing Code for Signature
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
    
    if (signatureTarget?.action === 'approve_liquidation') {
      const id = signatureTarget.id;
      fetch(`/api/liquidation/${id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || '',
          'X-User-FullName': encodeURIComponent(user?.fullName || '')
        },
        body: JSON.stringify({ approverSignature: base64Signature })
      })
      .then(res => {
        if (!res.ok) return res.json().then(data => { throw new Error(data.error || "Lỗi phê duyệt."); });
        return res.json();
      })
      .then(() => {
        alert("Duyệt tiêu hủy tài sản và trừ tồn kho thành công!");
        fetchData();
      })
      .catch(err => alert("Lỗi phê duyệt: " + err.message));
    } else {
      // Resume creation with signature
      handleCreateLiquidation(null, base64Signature);
    }
  };

  const handleStartApprove = (id) => {
    setSignatureTarget({ action: 'approve_liquidation', id });
    setShowSignatureModal(true);
  };

  const handleRejectLiquidation = (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn từ chối yêu cầu thanh lý này không?")) return;
    fetch(`/api/liquidation/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || '',
        'X-User-FullName': encodeURIComponent(user?.fullName || '')
      }
    })
    .then(res => {
      if (!res.ok) return res.json().then(data => { throw new Error(data.error || "Lỗi từ chối."); });
      return res.json();
    })
    .then(() => {
      alert("Đã từ chối yêu cầu thanh lý thành công.");
      fetchData();
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  const handleExecuteLiquidation = (id) => {
    if (!window.confirm("Xác nhận đã thực hiện thanh lý/tiêu hủy thực tế và cập nhật giảm tồn kho?")) return;
    fetch(`/api/liquidation/${id}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || '',
        'X-User-FullName': encodeURIComponent(user?.fullName || '')
      }
    })
    .then(res => {
      if (!res.ok) return res.json().then(data => { throw new Error(data.error || "Lỗi xử lý thực tế."); });
      return res.json();
    })
    .then(() => {
      alert("Hoàn tất quy trình xử lý thực tế và trừ tồn kho thành công!");
      fetchData();
    })
    .catch(err => alert("Lỗi: " + err.message));
  };


  const handleSelectItem = (item) => {
    // Check if already selected
    const exists = selectedItems.find(x => x.batchID === item.batchID && x.location === item.location);
    if (exists) {
      setSelectedItems(selectedItems.filter(x => !(x.batchID === item.batchID && x.location === item.location)));
    } else {
      setSelectedItems([...selectedItems, { batchID: item.batchID, location: item.location, quantity: item.quantity }]);
    }
  };

  const handleQuantityChange = (batchID, location, val) => {
    const updated = selectedItems.map(x => {
      if (x.batchID === batchID && x.location === location) {
        return { ...x, quantity: parseInt(val) || 0 };
      }
      return x;
    });
    setSelectedItems(updated);
  };

  const handleCreateLiquidation = (e, signatureData = null) => {
    if (e) e.preventDefault();
    if (selectedItems.length === 0) {
      alert("Vui lòng chọn ít nhất một lô thuốc hết hạn để thanh lý.");
      return;
    }
    if (!reason) {
      alert("Vui lòng nhập lý do thanh lý tài sản.");
      return;
    }

    // INTERCEPT: Request digital signature before submitting liquidation
    if (!signatureData) {
      setSignatureTarget({ action: 'create_liquidation' });
      setShowSignatureModal(true);
      return;
    }

    const finalReason = (activeTab === 'destruction' && responsiblePerson)
      ? `${reason} (Trách nhiệm: ${responsiblePerson})`
      : reason;

    const payload = {
      reason: finalReason,
      type: activeTab === 'liquidation' ? 'Thanh lý' : 'Tiêu hủy',
      createdBy: user?.fullName || 'Thủ kho Dược',
      items: selectedItems,
      digitalSignature: signatureData
    };

    fetch('/api/liquidation/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || '',
        'X-User-FullName': encodeURIComponent(user?.fullName || '')
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(data => { throw new Error(data.error || "Lỗi thanh lý"); });
      }
      return res.json();
    })
    .then(newLiq => {
      if (user?.role === 'director') {
        alert("Đã duyệt tiêu hủy và trừ kho thành công!");
      } else {
        alert("Đã lập phiếu đề xuất thanh lý và gửi trình duyệt lên Ban lãnh đạo thành công!");
      }
      fetchData();
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  const getExpiryStatus = (expiryDateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateStr);
    expiry.setHours(0, 0, 0, 0);
    
    if (expiry <= today) {
      return <span className="badge-status rejected" style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', border: '1px solid rgba(239, 68, 68, 0.2)', textTransform: 'none' }}>Hết hạn</span>;
    } else {
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return <span className="badge-status pending" style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)', textTransform: 'none' }}>Cận hạn ({diffDays} ngày)</span>;
    }
  };

  if (loading) return <div style={{ color: '#fff', padding: '2rem' }}>Đang tải dữ liệu nghiệp vụ thanh lý...</div>;

  return (
    <div>
      <h1 className="page-title">Thanh Lý & Tiêu Hủy Tài Sản</h1>
      <p className="page-subtitle">Quản lý lập đề xuất và duyệt thanh lý các lô thuốc hết hạn, cận hạn (dưới 30 ngày) hoặc hư hỏng định kỳ.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {/* Left Side: Expired Candidates and liquidation form */}
        <div>
          {/* Candidates list */}
          <div className="glass-card">
            {/* Tab Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '1.25rem', gap: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => { setActiveTab('liquidation'); setSelectedItems([]); }}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'liquidation' ? '2.5px solid var(--color-secondary)' : '2.5px solid transparent',
                  color: activeTab === 'liquidation' ? 'var(--color-secondary)' : 'var(--text-muted)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  transition: 'all 0.15s ease'
                }}
              >
                1. Đề xuất Thanh lý (Cận hạn, ít dùng)
              </button>
              <button 
                type="button" 
                onClick={() => { setActiveTab('destruction'); setSelectedItems([]); }}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'destruction' ? '2.5px solid var(--color-danger)' : '2.5px solid transparent',
                  color: activeTab === 'destruction' ? 'var(--color-danger)' : 'var(--text-muted)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  transition: 'all 0.15s ease'
                }}
              >
                2. Đề xuất Tiêu hủy (Quá hạn, hỏng vỡ)
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeTab === 'liquidation' ? 'var(--color-secondary)' : 'var(--color-danger)', fontSize: '1rem' }}>
                <AlertOctagon size={18} /> 
                {activeTab === 'liquidation' ? 'Lô thuốc cận hạn/ít dùng chờ thanh lý' : 'Lô thuốc quá hạn chờ tiêu hủy'}
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {activeTab === 'liquidation' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={showAllLowUsage}
                      onChange={e => { setShowAllLowUsage(e.target.checked); setSelectedItems([]); }}
                      style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    Hiển thị tất cả thuốc trong kho (thuốc ít dùng)
                  </label>
                )}
                <button className="btn-secondary" style={{ padding: '0.4rem', borderRadius: '8px' }} onClick={fetchData}>
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
            
            {(() => {
              const today = new Date();
              today.setHours(0,0,0,0);
              const isExpired = (d) => {
                const expiry = new Date(d);
                expiry.setHours(0,0,0,0);
                return expiry <= today;
              };
              const candidates = activeTab === 'liquidation'
                ? (showAllLowUsage ? allStoreBatches.filter(b => !isExpired(b.expiryDate)) : expiredItems.filter(b => !isExpired(b.expiryDate)))
                : expiredItems.filter(b => isExpired(b.expiryDate));

              return candidates.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>
                  {activeTab === 'liquidation' 
                    ? 'Không phát hiện lô thuốc cận hạn hoặc ít dùng nào.' 
                    : 'Không phát hiện lô thuốc quá hạn nào còn tồn.'}
                </p>
              ) : (
                <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Chọn</th>
                        <th>Thuốc / Hóa chất</th>
                        <th>Số lô</th>
                        <th>Hạn dùng</th>
                        <th>Trạng thái</th>
                        <th>Nơi lưu trữ</th>
                        <th>Tồn kho</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map(item => {
                        const isSelected = !!selectedItems.find(x => x.batchID === item.batchID && x.location === item.location);
                        return (
                          <tr key={`${item.batchID}-${item.location}`}>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => handleSelectItem(item)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                              />
                            </td>
                            <td><strong>{item.medicineName}</strong></td>
                            <td>{item.batchNumber}</td>
                            <td>{new Date(item.expiryDate).toLocaleDateString('vi-VN')}</td>
                            <td>{getExpiryStatus(item.expiryDate)}</td>
                            <td>{item.location}</td>
                            <td><strong>{item.quantity}</strong></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* Form */}
          {selectedItems.length > 0 && (
            <div className="glass-card">
              <h3 style={{ marginBottom: '1.25rem' }}>
                {activeTab === 'liquidation' ? 'Lập Phiếu Đề Xuất Thanh Lý Tài Sản' : 'Lập Phiếu Đề Xuất Tiêu Hủy Tài Sản'}
              </h3>
              <form onSubmit={handleCreateLiquidation}>
                <div className="form-group">
                  <label className="form-label">
                    {activeTab === 'liquidation' ? 'Lý do đề xuất thanh lý' : 'Lý do đề xuất tiêu hủy'}
                  </label>
                  <select 
                    className="form-input" 
                    value={reason} 
                    onChange={e => setReason(e.target.value)}
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.6rem 0.8rem', cursor: 'pointer', width: '100%' }}
                  >
                    <option value="TL01 - Hết hạn sử dụng">TL01 - Hết hạn sử dụng</option>
                    <option value="TL02 - Hư hỏng">TL02 - Hư hỏng</option>
                    <option value="TL03 - Thu hồi nhà sản xuất">TL03 - Thu hồi nhà sản xuất</option>
                    <option value="TL04 - Bảo quản sai điều kiện">TL04 - Bảo quản sai điều kiện</option>
                    <option value="TL05 - Bao bì không đạt">TL05 - Bao bì không đạt</option>
                    <option value="TL06 - Không còn nhu cầu sử dụng">TL06 - Không còn nhu cầu sử dụng</option>
                  </select>
                </div>

                {activeTab === 'destruction' && (
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="form-label">Ghi nhận trách nhiệm / Cá nhân làm hao hụt (nếu có)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="VD: Điều dưỡng Nguyễn Văn A (Làm vỡ chai truyền)"
                      value={responsiblePerson}
                      onChange={e => setResponsiblePerson(e.target.value)}
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.6rem 0.8rem' }}
                    />
                  </div>
                )}

                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Danh sách chọn ({selectedItems.length})</h4>
                  {selectedItems.map((item, idx) => {
                    const orig = expiredItems.find(x => x.batchID === item.batchID && x.location === item.location) || allStoreBatches.find(x => x.batchID === item.batchID && x.location === item.location);
                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '10px',
                        padding: '0.75rem 1rem',
                        marginBottom: '0.5rem'
                      }}>
                        <div>
                          <span style={{ fontWeight: '600' }}>{orig?.medicineName}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '1rem' }}>
                            (Lô: {orig?.batchNumber} - Kho: {item.location})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <label className="form-label" style={{ margin: 0, fontSize: '0.75rem' }}>
                            {activeTab === 'liquidation' ? 'SL thanh lý:' : 'SL tiêu hủy:'}
                          </label>
                          <input 
                            type="number"
                            className="form-input"
                            style={{ width: '80px', padding: '0.25rem 0.5rem' }}
                            value={item.quantity}
                            max={orig?.quantity}
                            onChange={e => handleQuantityChange(item.batchID, item.location, e.target.value)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button 
                  type="submit" 
                  className="btn-premium" 
                  style={{ 
                    width: '100%', 
                    justifyContent: 'center', 
                    marginTop: '1rem',
                    background: activeTab === 'liquidation' ? 'linear-gradient(90deg, var(--color-secondary), #0d9488)' : 'linear-gradient(90deg, var(--color-danger), #b91c1c)' 
                  }}
                >
                  {user?.role === 'director' 
                    ? (activeTab === 'liquidation' ? 'Lập Biên Bản & Thanh Lý Ngay' : 'Lập Biên Bản & Tiêu Hủy Ngay')
                    : (activeTab === 'liquidation' ? 'Lập Đề Xuất Thanh Lý & Ký Trình' : 'Lập Đề Xuất Tiêu Hủy & Ký Trình')}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Side: Historical Liquidations */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--color-secondary)" /> Lịch Sử Thanh Lý & Tiêu Hủy
          </h3>
          <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {liquidations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Chưa có lịch sử thanh lý/tiêu hủy tài sản.</p>
            ) : (
              liquidations.map(liq => (
                <div key={liq.liquidationID} style={{
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
                    <span style={{ fontWeight: '700' }}>Biên bản {getLiquidationCode(liq)}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        className="btn-secondary" 
                        title="Xem / In biên bản thanh lý"
                        style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', height: '28px' }}
                        onClick={() => setActiveLiquidationForPrint(liq)}
                      >
                        <Printer size={12} /> In biên bản
                      </button>
                      <span className="badge-status" style={{ 
                        fontSize: '0.72rem', 
                        padding: '0.2rem 0.5rem', 
                        borderRadius: '6px', 
                        fontWeight: '600',
                        textTransform: 'none',
                        background: liq.type === 'Thanh lý' ? 'rgba(13, 148, 136, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: liq.type === 'Thanh lý' ? '#0d9488' : '#ef4444',
                        border: liq.type === 'Thanh lý' ? '1px solid rgba(13, 148, 136, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                      }}>
                        {liq.type || 'Tiêu hủy'}
                      </span>
                      {liq.status === 'Chờ duyệt' && <span className="badge-status pending" style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>Chờ duyệt</span>}
                      {liq.status === 'Đã duyệt' && <span className="badge-status approved" style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>Đã duyệt</span>}
                      {liq.status === 'Đã thanh lý' && <span className="badge-status approved" style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>Đã thanh lý</span>}
                      {liq.status === 'Đã tiêu hủy' && <span className="badge-status approved" style={{ fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>Đã tiêu hủy</span>}
                      {liq.status === 'Từ chối' && <span className="badge-status rejected" style={{ fontSize: '0.75rem', background: 'rgba(120, 120, 120, 0.1)', color: '#999', border: '1px solid rgba(120, 120, 120, 0.2)' }}>Từ chối</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <p style={{ margin: '0 0 0.35rem 0' }}><strong>Lý do:</strong> {liq.reason}</p>
                    <p style={{ margin: '0 0 0.35rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}><strong>Người lập:</strong> {liq.createdBy || 'Thủ kho Dược'}</p>
                    <p style={{ margin: '0 0 0.35rem 0' }}><strong>Ngày thực hiện:</strong> {new Date(liq.liquidationDate).toLocaleString('vi-VN')}</p>
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '0.5rem 0.75rem', marginTop: '0.5rem' }}>
                      {liq.details?.map(d => (
                        <div key={d.liquidationDetailID} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          • {d.batch?.medicine?.medicineName} (Lô: {d.batch?.batchNumber} - SL: {d.quantity} {d.batch?.medicine?.unit})
                        </div>
                      ))}
                    </div>

                    {liq.status === 'Chờ duyệt' && user?.role === 'director' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
                        <button
                          type="button"
                          className="btn-premium"
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.74rem', height: '28px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: '600' }}
                          onClick={() => handleStartApprove(liq.liquidationID)}
                        >
                          <Check size={12} /> Duyệt {liq.type === 'Thanh lý' ? 'thanh lý' : 'tiêu hủy'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.75rem', fontSize: '0.74rem', height: '28px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'none' }}
                          onClick={() => handleRejectLiquidation(liq.liquidationID)}
                        >
                          <X size={12} /> Từ chối
                        </button>
                      </div>
                    )}

                    {liq.status === 'Đã duyệt' && (user?.role === 'pharmacist' || user?.role === 'director') && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
                        <button
                          type="button"
                          className="btn-premium"
                          style={{ 
                            padding: '0.25rem 0.75rem', 
                            fontSize: '0.74rem', 
                            height: '28px', 
                            background: liq.type === 'Thanh lý' ? 'linear-gradient(135deg, #0d9488, #0f766e)' : 'linear-gradient(135deg, #ef4444, #dc2626)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.2rem', 
                            fontWeight: '600' 
                          }}
                          onClick={() => handleExecuteLiquidation(liq.liquidationID)}
                        >
                          <Check size={12} /> Xác nhận đã {liq.type === 'Thanh lý' ? 'thanh lý' : 'tiêu hủy'} thực tế
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PRINT MODAL (BIÊN BẢN THANH LÝ DƯỢC PHẨM CHUYÊN NGHIỆP SOP) */}
      {activeLiquidationForPrint && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto', background: '#fff', color: '#000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Bệnh Viện Đa Khoa HIS Pharmacy</h4>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.72rem', color: '#666' }}>Hội đồng thanh lý & kiểm kê</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.72rem', fontStyle: 'italic' }}>Độc lập - Tự do - Hạnh phúc</p>
              </div>
            </div>

            <div id="printable-liquidation-invoice" style={{ fontFamily: 'Times New Roman, serif', padding: '0.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {activeLiquidationForPrint.type === 'Thanh lý' 
                    ? 'BIÊN BẢN THANH LÝ DƯỢC PHẨM CẬN HẠN / ÍT DÙNG' 
                    : activeLiquidationForPrint.reason?.includes('Trách nhiệm:') 
                    ? 'BIÊN BẢN HAO HỤT VÀ TIÊU HỦY DƯỢC PHẨM HỎNG VỠ' 
                    : 'BIÊN BẢN TIÊU HỦY DƯỢC PHẨM HẾT HẠN / HƯ HỎNG'}
                </h2>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#333', fontWeight: '600' }}>Mã biên bản: {getLiquidationCode(activeLiquidationForPrint)}</p>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>
                  Trạng thái: <strong>
                    {activeLiquidationForPrint.status === 'Chờ duyệt' && 'Yêu cầu (Chờ duyệt)'}
                    {activeLiquidationForPrint.status === 'Đã duyệt' && (activeLiquidationForPrint.type === 'Thanh lý' ? 'Đã duyệt thanh lý kho chính thức (GSP)' : 'Đã duyệt tiêu hủy kho chính thức (GSP)')}
                    {activeLiquidationForPrint.status === 'Từ chối' && 'Yêu cầu đã bị từ chối'}
                  </strong>
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', fontSize: '0.82rem', marginBottom: '1.5rem', lineHeight: '1.5', borderBottom: '1px dashed #ccc', paddingBottom: '1rem' }}>
                <div>
                  <p style={{ margin: '0.25rem 0' }}><strong>Lý do:</strong> {activeLiquidationForPrint.reason}</p>
                  <p style={{ margin: '0.25rem 0' }}>
                    <strong>Biện pháp xử lý:</strong> {activeLiquidationForPrint.type === 'Thanh lý' 
                      ? 'Thanh lý thu hồi vốn hoặc điều chuyển cơ sở lâm sàng.' 
                      : 'Đóng băng hủy kho, tiêu hủy theo quy định xử lý chất thải y tế.'}
                  </p>
                </div>
                <div>
                  <p style={{ margin: '0.25rem 0' }}><strong>Ngày lập biên bản:</strong> {new Date(activeLiquidationForPrint.liquidationDate).toLocaleString('vi-VN')}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Cấp thẩm quyền quyết định:</strong> Giám đốc bệnh viện</p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '40px' }}>STT</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Tên thuốc / Hoạt chất</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Số lô</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Hạn dùng</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '80px' }}>Đơn vị</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', width: '100px' }}>Đơn giá</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', width: '100px' }}>SL thanh lý</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', width: '120px' }}>Thành tiền hao hụt</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLiquidationForPrint.details && activeLiquidationForPrint.details.length > 0 ? (
                    activeLiquidationForPrint.details.map((d, index) => {
                      const price = d.batch?.importPrice || 0;
                      const qty = d.quantity || 0;
                      const subtotal = price * qty;
                      return (
                        <tr key={d.liquidationDetailID}>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{index + 1}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                            <strong>{d.batch?.medicine?.medicineName}</strong>
                            <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.1rem' }}>Mã: {d.batch?.medicine?.medicineCode}</div>
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{d.batch?.batchNumber}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                            {d.batch?.expiryDate ? new Date(d.batch.expiryDate).toLocaleDateString('vi-VN') : '-'}
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{d.batch?.medicine?.unit}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{price.toLocaleString('vi-VN')} đ</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{qty}</td>
                          <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{subtotal.toLocaleString('vi-VN')} đ</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', color: '#666' }}>Không có chi tiết thuốc thanh lý</td>
                    </tr>
                  )}
                  <tr style={{ background: '#fafafa', fontWeight: 'bold' }}>
                    <td colSpan="7" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Tổng giá trị hao hụt (tiêu hủy):</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', color: '#ef4444' }}>
                      {activeLiquidationForPrint.details?.reduce((sum, d) => sum + ((d.batch?.importPrice || 0) * d.quantity), 0).toLocaleString('vi-VN') || 0} đ
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures block */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', fontSize: '0.82rem', marginTop: '1.5rem', lineHeight: '1.4' }}>
                <div>
                  <p style={{ margin: 0 }}><strong>Người lập đề xuất</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký ghi nhận đề xuất)</p>
                  {activeLiquidationForPrint.proposerSignature ? (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <img src={activeLiquidationForPrint.proposerSignature} alt="Chữ ký Người lập" style={{ maxHeight: '100%', maxWidth: '120px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      {SIG.khoa}
                    </div>
                  )}
                  <p style={{ fontWeight: 'bold' }}>{activeLiquidationForPrint.createdBy || 'Thủ kho Dược'}</p>
                </div>
                <div>
                  <p style={{ margin: 0 }}><strong>Ban kiểm kê Dược</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Xác nhận đối chiếu)</p>
                  <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                    {SIG.chuong}
                  </div>
                  <p style={{ fontWeight: 'bold' }}>Thành viên Hội đồng</p>
                </div>
                <div>
                  <p style={{ margin: 0 }}><strong>Giám đốc bệnh viện</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký duyệt tiêu hủy)</p>
                  {activeLiquidationForPrint.approverSignature ? (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0', position: 'relative' }}>
                      <img src={activeLiquidationForPrint.approverSignature} alt="Chữ ký Giám đốc" style={{ maxHeight: '100%', maxWidth: '120px', objectFit: 'contain', position: 'absolute', zIndex: 1 }} />
                      <div style={{ position: 'absolute', zIndex: 2, top: '-15px', left: '50%', transform: 'translateX(-40%)', pointerEvents: 'none' }}>
                        <RedStamp name="PGS.TS. L.M.DƯỢC" />
                      </div>
                    </div>
                  ) : activeLiquidationForPrint.status === 'Đã duyệt' ? (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0', position: 'relative' }}>
                      <div style={{ position: 'absolute', zIndex: 1 }}>{SIG.duoc}</div>
                      <div style={{ position: 'absolute', zIndex: 2, top: '-15px', left: '50%', transform: 'translateX(-40%)', pointerEvents: 'none' }}>
                        <RedStamp name="PGS.TS. L.M.DƯỢC" />
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0', color: '#eab308', fontWeight: 'bold', fontSize: '0.74rem' }}>
                      {activeLiquidationForPrint.status === 'Từ chối' ? 'ĐÃ TỪ CHỐI' : 'CHỜ DUYỆT'}
                    </div>
                  )}
                  <p style={{ fontWeight: 'bold' }}>PGS.TS. Lê Minh Dược</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <button className="btn-secondary" style={{ background: '#f3f4f6', color: '#1f2937', borderColor: '#d1d5db', height: '36px', padding: '0 1rem', fontSize: '0.82rem' }} onClick={() => setActiveLiquidationForPrint(null)}>
                Đóng cửa sổ
              </button>
              <button 
                className="btn-premium" 
                style={{ height: '36px', padding: '0 1.25rem', fontSize: '0.82rem' }}
                onClick={() => {
                  const printContents = document.getElementById('printable-liquidation-invoice').innerHTML;
                  const originalContents = document.body.innerHTML;
                  document.body.innerHTML = printContents;
                  window.print();
                  window.location.reload(); // Reload to restore original React context
                }}
              >
                <Printer size={14} /> In biên bản (A4)
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
              <PenTool size={20} color="var(--color-secondary)" /> Ký Phê Duyệt Thanh Lý
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              Vui lòng vẽ chữ ký của bạn (Lãnh đạo/Giám đốc) vào ô dưới đây để phê duyệt biên bản thanh lý tiêu hủy dược phẩm.
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
                  <ThumbsUp size={14} /> Xác nhận & Phê duyệt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
