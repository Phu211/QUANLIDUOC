import React, { useState, useRef } from 'react';
import { X, PenTool, Eraser, AlertTriangle, Camera, Upload } from 'lucide-react';
import { handleIntegerKeyDown } from '../utils/numberInputUtils';

export default function BreakageReportModal({ isOpen, onClose, cabinetStocks, departmentId, user, onSuccess }) {
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Rơi vỡ khi thao tác tiêm');
  const [notes, setNotes] = useState('');
  const [damageImage, setDamageImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Canvas signature state
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  if (!isOpen) return null;

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Dung lượng ảnh không được vượt quá 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      setDamageImage(evt.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!batchId) return alert("Vui lòng chọn lô thuốc/vật tư bị vỡ hỏng.");
    if (!quantity || parseInt(quantity) <= 0) return alert("Số lượng hư hao phải lớn hơn 0.");

    const selectedStock = cabinetStocks.find(s => s.batchID.toString() === batchId);
    if (!selectedStock) return alert("Không tìm thấy thông tin tồn kho.");

    if (parseInt(quantity) > selectedStock.currentQuantity) {
      return alert(`Số lượng vỡ hỏng (${quantity}) vượt quá số lượng tồn hiện có trong tủ trực (${selectedStock.currentQuantity}).`);
    }

    if (!hasDrawn) {
      return alert("Vui lòng ký tên xác nhận biên bản trước khi gửi.");
    }

    const signatureBase64 = canvasRef.current.toDataURL('image/png');

    const payload = {
      departmentID: parseInt(departmentId),
      reason: reason,
      notes: notes,
      damageImage: damageImage,
      digitalSignature: signatureBase64,
      items: [
        {
          batchID: parseInt(batchId),
          damagedQuantity: parseInt(quantity),
          notes: notes
        }
      ]
    };

    setSubmitting(true);
    fetch('/api/breakage', {
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
          return res.json().then(data => { throw new Error(data.error || "Lỗi khi lập biên bản"); });
        }
        return res.json();
      })
      .then(data => {
        alert(data.message || "Đã gửi biên bản hư hao/vỡ hỏng thành công!");
        setSubmitting(false);
        onSuccess?.();
        onClose();
      })
      .catch(err => {
        alert("Lỗi: " + err.message);
        setSubmitting(false);
      });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '650px', width: '95%', padding: '1.75rem' }}>
        <button 
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
          onClick={onClose}
        >
          <X size={22} />
        </button>

        <h3 style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
          <AlertTriangle size={20} /> Biên Bản Ghi Nhận Hư Hao / Vỡ Hỏng Đột Xuất
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label" style={{ fontWeight: '600' }}>Chọn Thuốc / Lô Hư Hỏng (*)</label>
            <select
              className="form-input"
              value={batchId}
              onChange={e => setBatchId(e.target.value)}
              required
              style={{ height: '38px', fontSize: '0.85rem' }}
            >
              <option value="">-- Chọn thuốc trong cơ số tủ trực --</option>
              {cabinetStocks.map(s => (
                <option key={s.departmentStockID} value={s.batchID}>
                  {s.batch?.medicine?.medicineName} | Lô: {s.batch?.batchNumber} | Tồn: {s.currentQuantity} | Đơn giá: {s.batch?.importPrice?.toLocaleString('vi-VN')}đ
                </option>
              ))}
            </select>
          </div>

          <div className="form-row" style={{ marginBottom: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Số Lượng Hư Hao / Vỡ (*)</label>
              <input
                type="text"
                inputMode="numeric"
                className="form-input"
                placeholder="VD: 1, 2..."
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                onKeyDown={handleIntegerKeyDown}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Lý Do Đổ Vỡ / Hư Hao (*)</label>
              <select
                className="form-input"
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
                style={{ height: '38px', fontSize: '0.85rem' }}
              >
                <option value="Rơi vỡ khi thao tác tiêm">Rơi vỡ khi thao tác tiêm / lấy thuốc</option>
                <option value="Thuốc kết tủa / biến màu">Thuốc kết tủa / biến màu / vẩn đục</option>
                <option value="Quá nhiệt độ bảo quản">Quá nhiệt độ bảo quản (mất điện tủ lạnh)</option>
                <option value="Vỡ ống tiêm khi vận chuyển">Vỡ ống tiêm khi vận chuyển nội viện</option>
                <option value="Khác">Lý do khác (ghi rõ ghi chú)</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label">Ghi Chú Chi Tiết / Diễn Biến Sự Cố</label>
            <input
              type="text"
              className="form-input"
              placeholder="Mô tả cụ thể thời điểm, nguyên nhân rơi vỡ hoặc tình trạng biến chất..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Photo upload */}
          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Camera size={15} /> Ảnh Chụp Hiện Trường / Vỏ Lọ Vỡ (Tùy chọn)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ fontSize: '0.82rem' }}
            />
            {damageImage && (
              <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                <img 
                  src={damageImage} 
                  alt="Hiện trường đổ vỡ" 
                  style={{ maxHeight: '120px', borderRadius: '6px', border: '1px solid var(--border-color)', objectFit: 'cover' }} 
                />
              </div>
            )}
          </div>

          {/* Canvas Signature */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <PenTool size={14} /> Chữ Ký Điều Dưỡng Báo Cáo (*)
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <Eraser size={13} /> Xóa ký lại
              </button>
            </div>
            <div style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc', overflow: 'hidden' }}>
              <canvas
                ref={canvasRef}
                width={590}
                height={130}
                style={{ width: '100%', height: '130px', display: 'block', cursor: 'crosshair' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
            <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
              * Dùng chuột hoặc bút cảm ứng ký tên xác nhận chịu trách nhiệm sự việc hư hao.
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn-danger"
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#dc2626', color: '#fff' }}
            >
              {submitting ? 'Đang gửi biên bản...' : 'Ký & Gửi Biên Bản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
