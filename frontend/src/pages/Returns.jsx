import React, { useState, useEffect, useRef } from 'react';
import { RefreshCcw, Send, CheckCircle, XCircle, FileText, Plus, Trash, PenTool, Eraser, ThumbsUp, Printer, X } from 'lucide-react';

export default function Returns({ user }) {
  const [returns, setReturns] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [deptCabinetStocks, setDeptCabinetStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [returnItems, setReturnItems] = useState([{ batchID: '', quantity: '' }]);
  const [returnReasonSelect, setReturnReasonSelect] = useState('');
  const [customReason, setCustomReason] = useState('');

  // Digital Signature & Print States
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState(null); // { action: 'submit' } or { action: 'approve', id: 123 }
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const [activeReturnForPrint, setActiveReturnForPrint] = useState(null);

  const fetchInitialData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/return').then(res => res.json()),
      fetch('/api/requisition/departments').then(res => res.json())
    ])
    .then(([returnsData, deptsData]) => {
      setReturns(returnsData);
      setDepartments(deptsData);
      if (user?.role === 'nurse' && user?.departmentID) {
        setSelectedDept(user.departmentID.toString());
      } else if (deptsData.length > 0) {
        setSelectedDept(deptsData[0].departmentID.toString());
      }
      setLoading(false);
    })
    .catch(err => {
      console.error("Error loading returns data: ", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchInitialData();

    const handleUpdate = (e) => {
      if (e.detail === 'Returns') {
        fetchInitialData();
      }
    };
    window.addEventListener('pharmacy-update', handleUpdate);
    return () => window.removeEventListener('pharmacy-update', handleUpdate);
  }, [user]);

  // When selected department changes, load its cabinet stocks to ensure they only return what they have
  useEffect(() => {
    if (selectedDept) {
      fetch(`/api/cabinet/stocks/${selectedDept}`)
        .then(res => res.json())
        .then(data => {
          setDeptCabinetStocks(data);
          // Reset return items since department changed
          setReturnItems([{ batchID: '', quantity: '' }]);
        })
        .catch(err => console.error("Error loading cabinet stocks: ", err));
    }
  }, [selectedDept]);

  const handleAddItemRow = () => {
    setReturnItems([...returnItems, { batchID: '', quantity: '' }]);
  };

  const handleRemoveItemRow = (index) => {
    const newItems = returnItems.filter((_, idx) => idx !== index);
    setReturnItems(newItems.length ? newItems : [{ batchID: '', quantity: '' }]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...returnItems];
    
    if (field === 'batchID') {
      newItems[index].batchID = value;
      // If there is already a quantity, check if it exceeds the new batch's stock
      if (newItems[index].quantity && value) {
        const cabinetItem = deptCabinetStocks.find(s => s.batchID.toString() === value.toString());
        if (cabinetItem) {
          const qty = parseInt(newItems[index].quantity, 10);
          if (!isNaN(qty) && qty > cabinetItem.currentQuantity) {
            newItems[index].quantity = cabinetItem.currentQuantity.toString();
          }
        }
      }
    } else if (field === 'quantity') {
      const batchID = newItems[index].batchID;
      if (batchID) {
        const cabinetItem = deptCabinetStocks.find(s => s.batchID.toString() === batchID.toString());
        if (cabinetItem) {
          const qty = parseInt(value, 10);
          if (!isNaN(qty) && qty > cabinetItem.currentQuantity) {
            alert(`Số lượng hoàn trả không được vượt quá số lượng hiện có trong tủ trực khoa (${cabinetItem.currentQuantity}).`);
            newItems[index].quantity = cabinetItem.currentQuantity.toString();
            setReturnItems(newItems);
            return;
          }
        }
      }
      newItems[index].quantity = value;
    } else {
      newItems[index][field] = value;
    }
    
    setReturnItems(newItems);
  };

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

    if (signatureTarget.action === 'submit') {
      handleSubmitReturn(null, base64Signature);
    } else if (signatureTarget.action === 'approve') {
      handleApproveReturn(signatureTarget.id, base64Signature);
    } else if (signatureTarget.action === 'reject') {
      handleRejectReturn(signatureTarget.id, signatureTarget.reason, base64Signature);
    }
  };

  const handleSubmitReturn = (e, signatureData = null) => {
    if (e) e.preventDefault();
    if (!selectedDept) return;

    // Validate return reason
    const finalReason = returnReasonSelect === 'Khác' ? customReason.trim() : returnReasonSelect;
    if (!finalReason) {
      alert("Vui lòng chọn hoặc nhập lý do hoàn trả thuốc.");
      return;
    }

    // Validate rows
    const formattedItems = [];
    const selectedBatches = new Set();

    for (let i = 0; i < returnItems.length; i++) {
      const item = returnItems[i];
      if (!item.batchID || !item.quantity) {
        alert("Vui lòng điền đầy đủ thông tin ở dòng thứ " + (i + 1));
        return;
      }

      // Check duplicate batches
      if (selectedBatches.has(item.batchID)) {
        alert(`Dòng thứ ${i + 1}: Lô thuốc này đã được chọn ở dòng khác. Vui lòng không chọn trùng lặp một lô thuốc.`);
        return;
      }
      selectedBatches.add(item.batchID);

      // Validate integer quantity > 0
      const qtyStr = item.quantity.toString().trim();
      if (!/^\d+$/.test(qtyStr)) {
        alert(`Dòng thứ ${i + 1}: Số lượng hoàn trả phải là số nguyên dương lớn hơn 0.`);
        return;
      }
      const qty = parseInt(qtyStr, 10);
      if (qty <= 0) {
        alert(`Dòng thứ ${i + 1}: Số lượng hoàn trả phải là số nguyên dương lớn hơn 0.`);
        return;
      }

      const cabinetItem = deptCabinetStocks.find(s => s.batchID.toString() === item.batchID);
      if (!cabinetItem || cabinetItem.currentQuantity < qty) {
        alert(`Số lượng hoàn trả dòng ${i + 1} (${qty}) vượt quá tồn kho hiện tại trong tủ trực (${cabinetItem?.currentQuantity || 0}).`);
        return;
      }

      formattedItems.push({
        batchID: parseInt(item.batchID),
        quantity: qty
      });
    }

    // INTERCEPT: Request signature before submitting return
    if (!signatureData) {
      setSignatureTarget({ action: 'submit' });
      setShowSignatureModal(true);
      return;
    }

    const payload = {
      departmentID: parseInt(selectedDept),
      details: formattedItems,
      returnReason: finalReason,
      digitalSignature: signatureData // Store nurse signature
    };

    fetch('/api/return/submit', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || ''
      },
      body: JSON.stringify(payload)
    })
    .then(async res => {
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(text || `Yêu cầu thất bại với mã trạng thái ${res.status}`);
      }
      if (!res.ok) {
        throw new Error(data.error || data.message || "Lỗi tạo phiếu hoàn trả");
      }
      return data;
    })
    .then(newReturn => {
      alert("Đã gửi phiếu hoàn trả thừa lên khoa Dược và đã ký trực tuyến.");
      setReturns([newReturn, ...returns]);
      setReturnItems([{ batchID: '', quantity: '' }]);
      setReturnReasonSelect('');
      setCustomReason('');
      // Reload department cabinet stocks
      fetch(`/api/cabinet/stocks/${selectedDept}`)
        .then(res => res.json())
        .then(data => setDeptCabinetStocks(data));
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  const handleApproveReturn = (id, signatureData = null) => {
    // INTERCEPT: Request signature before approving return
    if (!signatureData) {
      const confirmMsg = user?.role === 'director'
        ? "Xác nhận phê duyệt hành chính và ký đóng dấu đỏ biên bản hoàn trả? Vui lòng bấm OK và ký duyệt."
        : "Xác nhận kiểm nhận thực tế thuốc hoàn trả về kho chính? Vui lòng bấm OK và ký duyệt.";
      if (!window.confirm(confirmMsg)) return;
      setSignatureTarget({ action: 'approve', id: id });
      setShowSignatureModal(true);
      return;
    }

    const payload = {
      digitalSignature: signatureData
    };

    const endpoint = user?.role === 'director'
      ? `/api/return/${id}/leader-approve`
      : `/api/return/${id}/approve`;

    const successMsg = user?.role === 'director'
      ? "Lãnh đạo đã phê duyệt hành chính tối cao và ký đóng dấu đỏ thành công biên bản hoàn trả."
      : "Thủ kho Dược đã kiểm nhận thuốc hoàn trả thành công. Đang chờ Trưởng khoa ký duyệt hành chính.";

    fetch(endpoint, { 
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || '' 
      },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        const text = await res.text();
        if (res.ok) {
          alert(successMsg);
          fetchInitialData();
        } else {
          let errorMsg = "Lỗi nghiệp vụ";
          try {
            const data = JSON.parse(text);
            errorMsg = data.error || data.message || errorMsg;
          } catch (e) {
            errorMsg = text || `Mã lỗi: ${res.status}`;
          }
          alert("Lỗi khi duyệt hoàn trả: " + errorMsg);
        }
      })
      .catch(err => alert("Lỗi kết nối: " + err.message));
  };

  const handleRejectReturn = (id, reason = null, signatureData = null) => {
    if (!reason) {
      const inputReason = window.prompt("Vui lòng nhập lý do từ chối phiếu hoàn trả này:");
      if (inputReason === null) return; // User cancelled
      if (!inputReason.trim()) {
        alert("Lý do từ chối không được để trống.");
        return;
      }
      setSignatureTarget({ action: 'reject', id: id, reason: inputReason.trim() });
      setShowSignatureModal(true);
      return;
    }

    const payload = {
      rejectReason: reason,
      digitalSignature: signatureData
    };

    fetch(`/api/return/${id}/reject`, { 
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || '' 
      },
      body: JSON.stringify(payload)
    })
      .then(async res => {
        const text = await res.text();
        if (res.ok) {
          alert("Đã từ chối phiếu hoàn trả và lưu vết chữ ký.");
          fetchInitialData();
        } else {
          let errorMsg = "Lỗi khi từ chối";
          try {
            const data = JSON.parse(text);
            errorMsg = data.error || data.message || errorMsg;
          } catch (e) {
            errorMsg = text || `Mã lỗi: ${res.status}`;
          }
          alert("Lỗi khi từ chối: " + errorMsg);
        }
      })
      .catch(err => alert("Lỗi: " + err.message));
  };

  if (loading) return <div style={{ color: '#fff', padding: '2rem' }}>Đang tải dữ liệu nghiệp vụ hoàn trả...</div>;

  return (
    <div>
      <h1 className="page-title">Hoàn Trả Thuốc Thừa</h1>
      <p className="page-subtitle">
        {user?.role === 'pharmacist' 
          ? 'Xem xét và phê duyệt nhận thuốc dư thừa từ tủ trực các khoa lâm sàng thu hồi về kho chẵn.' 
          : 'Nhập và gửi phiếu đề xuất hoàn trả thuốc dư thừa từ tủ trực hoặc hao phí bệnh nhân về kho Dược chính.'}
      </p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: user?.role === 'pharmacist' ? '1fr' : '1.2fr 1fr', 
        gap: '1.5rem' 
      }}>
        {/* Left Side: Create Return Receipt - Only visible to nurses */}
        {user?.role === 'nurse' && (
          <div className="glass-card">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} color="var(--color-primary)" /> Đề Nghị Hoàn Trả Thuốc Thừa
            </h3>
            <form onSubmit={handleSubmitReturn}>
              <div className="form-group">
                <label className="form-label">Chọn Khoa Lâm Sàng Đề Nghị</label>
                <select 
                  className="form-input" 
                  value={selectedDept} 
                  onChange={e => setSelectedDept(e.target.value)}
                  disabled={user?.role === 'nurse'}
                >
                  {departments.map(d => (
                    <option key={d.departmentID} value={d.departmentID}>{d.departmentName}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label">Lý do hoàn trả thuốc <span style={{ color: 'var(--color-danger)', color: '#ef4444' }}>*</span></label>
                <select 
                  className="form-input" 
                  value={returnReasonSelect} 
                  onChange={e => {
                    setReturnReasonSelect(e.target.value);
                    if (e.target.value !== 'Khác') setCustomReason('');
                  }}
                  required
                >
                  <option value="">-- Chọn lý do hoàn trả --</option>
                  <option value="Người bệnh ra viện / Chuyển viện">Người bệnh ra viện / Chuyển viện</option>
                  <option value="Thay đổi y lệnh điều trị">Thay đổi y lệnh điều trị</option>
                  <option value="Người bệnh tử vong">Người bệnh tử vong</option>
                  <option value="Thuốc dư thừa / Hao phí tủ trực khoa">Thuốc dư thừa / Hao phí tủ trực khoa</option>
                  <option value="Khác">Lý do khác (Nhập chi tiết...)</option>
                </select>
              </div>

              {returnReasonSelect === 'Khác' && (
                <div className="form-group" style={{ marginTop: '0.75rem' }}>
                  <label className="form-label">Chi tiết lý do khác <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="VD: Thuốc sắp hết hạn, khoa trả lại để luân chuyển"
                    value={customReason} 
                    onChange={e => setCustomReason(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border-glass)', marginTop: '1rem', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContext: 'space-between', alignItems: 'center', marginBottom: '1rem', justifyContent: 'space-between' }}>
                  <h4 style={{ color: 'var(--text-muted)' }}>Thuốc/hóa chất cần trả</h4>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                    onClick={handleAddItemRow}
                  >
                    <Plus size={14} /> Thêm thuốc
                  </button>
                </div>

                {returnItems.map((item, idx) => {
                  const selectedBatch = deptCabinetStocks.find(s => s.batchID.toString() === item.batchID);
                  const maxQty = selectedBatch ? selectedBatch.currentQuantity : 0;
                  return (
                    <div key={idx} style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '12px',
                      padding: '1rem',
                      marginBottom: '1rem',
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr',
                      gap: '1rem'
                    }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Tên thuốc (Chọn từ tủ trực khoa)</label>
                        <select 
                          className="form-input" 
                          value={item.batchID} 
                          onChange={e => handleItemChange(idx, 'batchID', e.target.value)}
                        >
                          <option value="">-- Chọn thuốc --</option>
                          {deptCabinetStocks.map(s => (
                            <option key={s.batchID} value={s.batchID}>
                              {s.batch?.medicine?.medicineName} (Lô: {s.batch?.batchNumber} - Hiện có: {s.currentQuantity})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Số lượng trả</label>
                        <input 
                          type="number" 
                          min="1"
                          max={selectedBatch ? maxQty : undefined}
                          step="1"
                          className="form-input" 
                          placeholder={selectedBatch ? `Tối đa: ${maxQty}` : "Chọn thuốc trước"}
                          value={item.quantity} 
                          onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                          disabled={!item.batchID}
                        />
                      </div>

                      {returnItems.length > 1 && (
                        <button 
                          type="button" 
                          className="btn-danger" 
                          style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', padding: '0.25rem', borderRadius: '6px' }}
                          onClick={() => handleRemoveItemRow(idx)}
                        >
                          <Trash size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {deptCabinetStocks.length === 0 && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  color: '#fcd34d',
                  fontSize: '0.85rem',
                  marginTop: '1rem',
                  lineHeight: '1.4',
                  marginBottom: '1rem'
                }}>
                  ⚠️ Tủ trực của khoa hiện đang trống. Khoa không có thuốc thừa nào để thực hiện quy trình hoàn trả về Kho Dược.
                </div>
              )}

              <button type="submit" className="btn-premium" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} disabled={deptCabinetStocks.length === 0}>
                <Send size={16} /> Gửi Phiếu Đề Nghị Hoàn Trả
              </button>
            </form>
          </div>
        )}

        {/* Right Side: Return logs and approval console */}
        <div className="glass-card">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={20} color="var(--color-secondary)" /> 
            {user?.role === 'pharmacist' ? 'Danh Sách & Phê Duyệt Nhận Hoàn Trả Thuốc' : 'Theo Dõi Duyệt Hoàn Trả Thuốc Thừa'}
          </h3>
          <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {returns.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Chưa có phiếu hoàn trả nào.</p>
            ) : (
              returns.map(ret => (
                <div key={ret.returnID} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700' }}>Phiếu hoàn trả #RET-{ret.returnID}</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button 
                        className="btn-secondary" 
                        title="Xem / In biên bản hoàn trả"
                        style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', height: '28px' }}
                        onClick={() => setActiveReturnForPrint(ret)}
                      >
                        <Printer size={12} /> In biên bản
                      </button>
                      <span 
                        className="badge-status"
                        style={{
                          background: ret.status === 'Pending' 
                            ? 'rgba(245, 158, 11, 0.15)' 
                            : ret.status === 'PendingLeader'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : ret.status === 'Approved'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                          color: ret.status === 'Pending' 
                            ? '#f59e0b' 
                            : ret.status === 'PendingLeader'
                            ? '#3b82f6'
                            : ret.status === 'Approved'
                            ? '#10b981'
                            : '#ef4444',
                          border: `1px solid ${
                            ret.status === 'Pending' 
                              ? 'rgba(245, 158, 11, 0.3)' 
                              : ret.status === 'PendingLeader'
                              ? 'rgba(59, 130, 246, 0.3)'
                              : ret.status === 'Approved'
                              ? 'rgba(16, 185, 129, 0.3)'
                              : 'rgba(239, 68, 68, 0.3)'
                          }`
                        }}
                      >
                        {ret.status === 'Pending' 
                          ? 'Chờ thủ kho nhận' 
                          : ret.status === 'PendingLeader' 
                          ? 'Chờ lãnh đạo duyệt' 
                          : ret.status === 'Approved' 
                          ? 'Đã duyệt nhận' 
                          : 'Từ chối'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.9rem' }}>
                    <p><strong>Từ khoa:</strong> {ret.department?.departmentName}</p>
                    <p><strong>Ngày đề xuất:</strong> {new Date(ret.returnDate).toLocaleString('vi-VN')}</p>
                    <p><strong>Lý do hoàn trả:</strong> {ret.returnReason || 'Không xác định'}</p>
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '0.5rem 0.75rem', marginTop: '0.5rem' }}>
                      {ret.details?.map(d => (
                        <div key={d.returnDetailID} style={{ fontSize: '0.85rem' }}>
                          • {d.batch?.medicine?.medicineName} (Lô: {d.batch?.batchNumber} - SL trả: {d.quantity} {d.batch?.medicine?.unit})
                        </div>
                      ))}
                    </div>
                    {ret.status === 'Rejected' && ret.rejectReason && (
                      <div style={{ 
                        marginTop: '0.75rem', 
                        padding: '0.5rem 0.75rem', 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        border: '1px solid rgba(239, 68, 68, 0.2)', 
                        borderRadius: '8px',
                        color: '#fca5a5',
                        fontSize: '0.85rem'
                      }}>
                        <strong>Lý do từ chối:</strong> {ret.rejectReason}
                      </div>
                    )}
                  </div>
                  {ret.status === 'Pending' && user?.role === 'pharmacist' && (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button 
                        className="btn-danger" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => handleRejectReturn(ret.returnID)}
                      >
                        Từ chối
                      </button>
                      <button 
                        className="btn-premium" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => handleApproveReturn(ret.returnID)}
                      >
                        Duyệt Nhận Về Kho
                      </button>
                    </div>
                  )}
                  {ret.status === 'PendingLeader' && user?.role === 'director' && (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button 
                        className="btn-danger" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => handleRejectReturn(ret.returnID)}
                      >
                        Từ chối
                      </button>
                      <button 
                        className="btn-premium" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => handleApproveReturn(ret.returnID)}
                      >
                        Ký Duyệt (Lãnh đạo)
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PRINT MODAL (BIÊN BẢN HOÀN TRẢ THUỐC THỪA CHUYÊN NGHIỆP SOP) */}
      {activeReturnForPrint && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto', background: '#fff', color: '#000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Bệnh Viện Đa Khoa HIS Pharmacy</h4>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.72rem', color: '#666' }}>Khoa Dược - Phân hệ Lâm Sàng</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.72rem', fontStyle: 'italic' }}>Độc lập - Tự do - Hạnh phúc</p>
              </div>
            </div>

            <div id="printable-return-invoice" style={{ fontFamily: 'Times New Roman, serif', padding: '0.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 'bold' }}>BIÊN BẢN HOÀN TRẢ THUỐC THỪA VỀ KHO DƯỢC</h2>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#333', fontWeight: '600' }}>Số phiếu: RET-{activeReturnForPrint.returnID}</p>
                <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>Trạng thái: <strong>{
                  activeReturnForPrint.status === 'Pending' 
                    ? 'Chờ thủ kho nhận' 
                    : activeReturnForPrint.status === 'PendingLeader'
                    ? 'Chờ Lãnh đạo duyệt'
                    : activeReturnForPrint.status === 'Approved'
                    ? 'Đã thu hồi về kho chẵn' 
                    : 'Bị từ chối'
                }</strong></p>
              </div>

              {activeReturnForPrint.status === 'Rejected' && activeReturnForPrint.rejectReason && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  color: '#991b1b',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                  lineHeight: '1.4',
                  textAlign: 'left'
                }}>
                  <strong>Lý do từ chối biên bản:</strong> {activeReturnForPrint.rejectReason}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', fontSize: '0.82rem', marginBottom: '1.5rem', lineHeight: '1.5', borderBottom: '1px dashed #ccc', paddingBottom: '1rem' }}>
                <div>
                  <p style={{ margin: '0.25rem 0' }}><strong>Đơn vị đề xuất (Khoa phòng):</strong> {activeReturnForPrint.department?.departmentName}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Ngày thực hiện hoàn trả:</strong> {new Date(activeReturnForPrint.returnDate).toLocaleString('vi-VN')}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Lý do hoàn trả:</strong> {activeReturnForPrint.returnReason || 'Không xác định'}</p>
                </div>
                <div>
                  <p style={{ margin: '0.25rem 0' }}><strong>Cán bộ hoàn trả (Điều dưỡng):</strong> Điều dưỡng khoa lâm sàng</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Trạng thái phê duyệt:</strong> {activeReturnForPrint.status === 'Approved' ? 'Đã kiểm nhận nhập kho' : 'Chờ kiểm nhận'}</p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '40px' }}>STT</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Tên thuốc / Hoạt chất</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Số lô thầu</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Hạn dùng</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', width: '80px' }}>Đơn vị</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', width: '100px' }}>Đơn giá</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', width: '100px' }}>Số lượng trả</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', width: '120px' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReturnForPrint.details && activeReturnForPrint.details.length > 0 ? (
                    activeReturnForPrint.details.map((d, index) => {
                      const price = d.batch?.importPrice || 0;
                      const qty = d.quantity || 0;
                      const subtotal = price * qty;
                      return (
                        <tr key={d.returnDetailID}>
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
                      <td colSpan="8" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', color: '#666' }}>Không có chi tiết thuốc hoàn trả</td>
                    </tr>
                  )}
                  <tr style={{ background: '#fafafa', fontWeight: 'bold' }}>
                    <td colSpan="7" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Tổng giá trị thuốc hoàn trả:</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', color: '#0d9488' }}>
                      {activeReturnForPrint.details?.reduce((sum, d) => sum + ((d.batch?.importPrice || 0) * d.quantity), 0).toLocaleString('vi-VN') || 0} đ
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures block */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', fontSize: '0.82rem', marginTop: '1.5rem', lineHeight: '1.4' }}>
                <div>
                  <p style={{ margin: 0 }}><strong>Người lập đề nghị (Khoa)</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký tay trên hệ thống)</p>
                  {activeReturnForPrint.digitalSignature ? (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <img src={activeReturnForPrint.digitalSignature} alt="Chữ ký Điều dưỡng" style={{ maxHeight: '100%', maxWidth: '120px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '80px' }} />
                  )}
                  <p style={{ fontWeight: 'bold' }}>Điều dưỡng khoa lâm sàng</p>
                </div>
                <div>
                  <p style={{ margin: 0 }}><strong>Thủ kho Dược nhận</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký tay trên hệ thống)</p>
                  {activeReturnForPrint.approverSignature ? (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <img src={activeReturnForPrint.approverSignature} alt="Chữ ký Dược sĩ" style={{ maxHeight: '100%', maxWidth: '120px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '80px' }} />
                  )}
                  <p style={{ fontWeight: 'bold' }}>{
                    activeReturnForPrint.status === 'Pending' 
                      ? 'Chờ tiếp nhận' 
                      : activeReturnForPrint.status === 'Rejected' && activeReturnForPrint.approverSignature
                      ? 'Dược sĩ Khoa Dược (Từ chối)'
                      : 'Dược sĩ Khoa Dược (Đã nhận)'
                  }</p>
                </div>
                <div>
                  <p style={{ margin: 0 }}><strong>Trưởng Khoa / Lãnh đạo</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký, đóng dấu)</p>
                  {activeReturnForPrint.status === 'Approved' ? (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0', position: 'relative' }}>
                      {/* Leader handwritten signature */}
                      {activeReturnForPrint.directorSignature && (
                        <img 
                          src={activeReturnForPrint.directorSignature} 
                          alt="Chữ ký Lãnh đạo" 
                          style={{ 
                            maxHeight: '100%', 
                            maxWidth: '120px', 
                            objectFit: 'contain',
                            position: 'absolute',
                            zIndex: 1
                          }} 
                        />
                      )}
                      {/* Overlapping Red Stamp */}
                      <div style={{ 
                        position: 'absolute', 
                        zIndex: 2, 
                        top: '0px', 
                        left: '50%', 
                        transform: 'translateX(-40%) translateY(-5px)', 
                        pointerEvents: 'none'
                      }}>
                        <svg width="85" height="85" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
                          {/* Outer circle */}
                          <circle cx="60" cy="60" r="52" fill="none" stroke="#dc2626" stroke-width="3" />
                          {/* Inner circle */}
                          <circle cx="60" cy="60" r="46" fill="none" stroke="#dc2626" stroke-width="1.2" />
                          
                          {/* Curved text path */}
                          <defs>
                            <path id="stampTextPathTop" d="M 18 60 A 42 42 0 0 1 102 60" fill="none" />
                            <path id="stampTextPathBottom" d="M 102 60 A 42 42 0 0 1 18 60" fill="none" />
                          </defs>
                          
                          <text fill="#dc2626" font-size="7.5" font-family="Arial, Helvetica, sans-serif" font-weight="bold" letter-spacing="0.5">
                            <textPath href="#stampTextPathTop" startOffset="50%" text-anchor="middle">BỆNH VIỆN ĐA KHOA HIS PHARMACY</textPath>
                          </text>
                          
                          <text fill="#dc2626" font-size="8" font-family="Arial, Helvetica, sans-serif" font-weight="bold" letter-spacing="1">
                            <textPath href="#stampTextPathBottom" startOffset="50%" text-anchor="middle">KHOA DƯỢC ★</textPath>
                          </text>
                          
                          {/* Center text */}
                          <text x="60" y="52" fill="#dc2626" font-size="10" font-family="Times New Roman, serif" font-weight="bold" text-anchor="middle">ĐÃ DUYỆT</text>
                          <text x="60" y="66" fill="#dc2626" font-size="6.5" font-family="Arial, sans-serif" font-weight="bold" text-anchor="middle">PGS.TS. L.M.DƯỢC</text>
                        </svg>
                      </div>
                    </div>
                  ) : activeReturnForPrint.status === 'Rejected' && activeReturnForPrint.directorSignature ? (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <img src={activeReturnForPrint.directorSignature} alt="Chữ ký Lãnh đạo" style={{ maxHeight: '100%', maxWidth: '120px', objectFit: 'contain' }} />
                    </div>
                  ) : activeReturnForPrint.status === 'PendingLeader' ? (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <span style={{ color: '#3b82f6', fontSize: '0.8rem', fontWeight: 'bold', fontStyle: 'italic', border: '1px dashed #3b82f6', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                        Chờ Lãnh đạo ký duyệt
                      </span>
                    </div>
                  ) : (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                        {activeReturnForPrint.status === 'Rejected' ? 'Không yêu cầu ký' : 'Chờ kiểm nhận'}
                      </span>
                    </div>
                  )}
                  <p style={{ fontWeight: 'bold' }}>{
                    activeReturnForPrint.status === 'Approved' 
                      ? 'PGS.TS. Lê Minh Dược (Đã duyệt)' 
                      : activeReturnForPrint.status === 'Rejected' && activeReturnForPrint.directorSignature
                      ? 'PGS.TS. Lê Minh Dược (Từ chối)'
                      : 'Chờ phê duyệt'
                  }</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <button className="btn-secondary" style={{ background: '#f3f4f6', color: '#1f2937', borderColor: '#d1d5db', height: '36px', padding: '0 1rem', fontSize: '0.82rem' }} onClick={() => setActiveReturnForPrint(null)}>
                Đóng cửa sổ
              </button>
              <button 
                className="btn-premium" 
                style={{ height: '36px', padding: '0 1.25rem', fontSize: '0.82rem' }}
                onClick={() => {
                  const printContents = document.getElementById('printable-return-invoice').innerHTML;
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
              <PenTool size={20} color="var(--color-secondary)" /> Ký Xác Nhận Hoàn Trả Thuốc
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              {signatureTarget?.action === 'submit' 
                ? "Vui lòng vẽ chữ ký của bạn (Điều dưỡng khoa lâm sàng) vào ô dưới đây để gửi đề xuất hoàn trả."
                : user?.role === 'director'
                ? "Vui lòng vẽ chữ ký của bạn (PGS.TS. Lê Minh Dược - Trưởng Khoa) vào ô dưới đây để phê duyệt tối cao và đóng dấu mộc đỏ."
                : "Vui lòng vẽ chữ ký của bạn (Dược sĩ Thủ kho Dược) vào ô dưới đây để xác nhận tiếp nhận thực tế thuốc hoàn trả."}
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
                  <ThumbsUp size={14} /> Xác nhận & Đóng dấu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
