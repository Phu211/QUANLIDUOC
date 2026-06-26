import React, { useState, useEffect, useRef } from 'react';
import { AlertOctagon, FileText, Check, Trash2, Printer, RefreshCw, Layers, PenTool, Eraser, ThumbsUp, X } from 'lucide-react';

export default function Liquidation({ user }) {
  const [liquidations, setLiquidations] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [reason, setReason] = useState('');
  const [selectedItems, setSelectedItems] = useState([]); // List of { batchID, location, quantity }

  // Digital Signature & Print States
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const [activeLiquidationForPrint, setActiveLiquidationForPrint] = useState(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/liquidation').then(res => res.json()),
      fetch('/api/liquidation/expired').then(res => res.json())
    ])
    .then(([liqData, expData]) => {
      setLiquidations(liqData);
      setExpiredItems(expData);
      setLoading(false);
      setSelectedItems([]);
      setReason('');
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
    
    // Resume creation with signature
    handleCreateLiquidation(null, base64Signature);
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
      setShowSignatureModal(true);
      return;
    }

    const payload = {
      reason: reason,
      items: selectedItems,
      digitalSignature: signatureData // Save director signature
    };

    fetch('/api/liquidation/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || ''
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
      alert("Phiếu yêu cầu thanh lý đã được duyệt nhận, ký nhận và xử lý kho thành công!");
      fetchData();
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  if (loading) return <div style={{ color: '#fff', padding: '2rem' }}>Đang tải dữ liệu nghiệp vụ thanh lý...</div>;

  return (
    <div>
      <h1 className="page-title">Thanh Lý Tài Sản Hỏng, Vỡ, Hết Date</h1>
      <p className="page-subtitle">Quản lý đóng băng và thanh lý vật tư hỏng vỡ, thuốc quá hạn dùng định kỳ.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        {/* Left Side: Expired Candidates and liquidation form */}
        <div>
          {/* Candidates list */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)' }}>
                <AlertOctagon size={20} /> Lô thuốc quá hạn chờ thanh lý
              </h3>
              <button className="btn-secondary" style={{ padding: '0.4rem', borderRadius: '8px' }} onClick={fetchData}>
                <RefreshCw size={14} />
              </button>
            </div>
            
            {expiredItems.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Hiện không phát hiện lô thuốc hết hạn nào còn tồn tại trong kho.</p>
            ) : (
              <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Chọn</th>
                      <th>Thuốc / Hóa chất</th>
                      <th>Số lô</th>
                      <th>Hạn dùng</th>
                      <th>Nơi lưu trữ</th>
                      <th>Tồn kho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiredItems.map(item => {
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
                          <td style={{ color: 'var(--color-danger)' }}>{new Date(item.expiryDate).toLocaleDateString('vi-VN')}</td>
                          <td>{item.location}</td>
                          <td><strong>{item.quantity}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Form */}
          {selectedItems.length > 0 && (
            <div className="glass-card">
              <h3 style={{ marginBottom: '1.25rem' }}>Lập Phiếu Trình Lãnh Đạo Phê Duyệt Thanh Lý</h3>
              <form onSubmit={handleCreateLiquidation}>
                <div className="form-group">
                  <label className="form-label">Lý do thanh lý tài sản</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="VD: Thuốc hết hạn sử dụng định kỳ, vỡ hỏng trong bảo quản..."
                    value={reason} 
                    onChange={e => setReason(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Danh sách chọn ({selectedItems.length})</h4>
                  {selectedItems.map((item, idx) => {
                    // find details in expiredItems
                    const orig = expiredItems.find(x => x.batchID === item.batchID && x.location === item.location);
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
                          <label className="form-label" style={{ margin: 0, fontSize: '0.75rem' }}>SL thanh lý:</label>
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

                <button type="submit" className="btn-premium" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
                  Tạo Phiếu Yêu Cầu & Thanh Lý Hủy Kho
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Side: Historical Liquidations */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--color-secondary)" /> Biên Bản Thanh Lý Đã Thực Hiện
          </h3>
          <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {liquidations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Chưa có lịch sử thanh lý tài sản.</p>
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
                    <span style={{ fontWeight: '700' }}>Biên bản #LIQ-{liq.liquidationID}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        className="btn-secondary" 
                        title="Xem / In biên bản thanh lý"
                        style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', height: '28px' }}
                        onClick={() => setActiveLiquidationForPrint(liq)}
                      >
                        <Printer size={12} /> In biên bản
                      </button>
                      <span className="badge-status rejected" style={{ fontSize: '0.75rem' }}>Đã hủy kho</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <p><strong>Lý do:</strong> {liq.reason}</p>
                    <p><strong>Ngày thực hiện:</strong> {new Date(liq.liquidationDate).toLocaleString('vi-VN')}</p>
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '0.5rem 0.75rem', marginTop: '0.5rem' }}>
                      {liq.details?.map(d => (
                        <div key={d.liquidationDetailID} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          • {d.batch?.medicine?.medicineName} (Lô: {d.batch?.batchNumber} - SL: {d.quantity} {d.batch?.medicine?.unit})
                        </div>
                      ))}
                    </div>
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
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>BIÊN BẢN THANH LÝ TIÊU HỦY DƯỢC PHẨM HẾT HẠN</h2>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#333', fontWeight: '600' }}>Mã biên bản: LIQ-{activeLiquidationForPrint.liquidationID}</p>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>Trạng thái: <strong>Đã tiêu hủy kho chính thức (GSP)</strong></p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', fontSize: '0.82rem', marginBottom: '1.5rem', lineHeight: '1.5', borderBottom: '1px dashed #ccc', paddingBottom: '1rem' }}>
                <div>
                  <p style={{ margin: '0.25rem 0' }}><strong>Lý do thanh lý:</strong> {activeLiquidationForPrint.reason}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Biện pháp xử lý:</strong> Đóng băng hủy kho, tiêu hủy theo quy định xử lý chất thải y tế.</p>
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
                  <p style={{ margin: 0 }}><strong>Người lập biên bản</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</p>
                  <p style={{ marginTop: '3.5rem', fontWeight: 'bold' }}>Thủ kho Dược</p>
                </div>
                <div>
                  <p style={{ margin: 0 }}><strong>Hội đồng thanh lý khoa</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</p>
                  <p style={{ marginTop: '3.5rem', fontWeight: 'bold' }}>Ban kiểm kê Dược</p>
                </div>
                <div>
                  <p style={{ margin: 0 }}><strong>Giám đốc bệnh viện</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký tay trên hệ thống, đóng dấu)</p>
                  {activeLiquidationForPrint.digitalSignature ? (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <img src={activeLiquidationForPrint.digitalSignature} alt="Chữ ký Giám đốc" style={{ maxHeight: '100%', maxWidth: '120px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '55px' }} />
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
