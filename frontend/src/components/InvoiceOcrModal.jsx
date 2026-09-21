import React, { useState, useEffect, useRef } from 'react';
import { 
  ScanLine, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Sparkles, 
  ArrowRight, 
  Building2, 
  Calendar, 
  Layers, 
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Trash2,
  Plus,
  Image as ImageIcon,
  ClipboardPaste,
  ShieldCheck,
  Search
} from 'lucide-react';
import { handleIntegerKeyDown, sanitizeInteger } from '../utils/numberInputUtils';

export default function InvoiceOcrModal({ 
  isOpen, 
  onClose, 
  onApplyData, 
  medicines = [], 
  suppliers = [] 
}) {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPdf, setIsPdf] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Preview Zoom & Rotate
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const fileInputRef = useRef(null);

  // Lắng nghe tổ hợp phím Paste (Ctrl + V) trên toàn cửa sổ khi Modal mở
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            handleFileSelected(blob, `Ảnh_Clipboard_${new Date().getTime()}.png`);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  // Giải phóng Blob URL khi unmount hoặc đổi file
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleFileSelected = (file, customName) => {
    if (!file) return;

    // Kiểm tra định dạng hợp lệ
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type) && !file.name?.match(/\.(jpg|jpeg|png|webp|pdf)$/i)) {
      setErrorMessage("Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG, WEBP hoặc tệp PDF.");
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const namedFile = customName ? new File([file], customName, { type: file.type || 'image/png' }) : file;
    setUploadedFile(namedFile);
    setIsPdf(namedFile.type === 'application/pdf' || namedFile.name.toLowerCase().endsWith('.pdf'));
    setPreviewUrl(URL.createObjectURL(namedFile));
    setErrorMessage(null);
    setOcrResult(null);
    setZoom(1);
    setRotation(0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleRunOcr = async () => {
    if (!uploadedFile) {
      setErrorMessage("Vui lòng tải lên hoặc dán ảnh/PDF hóa đơn trước khi quét.");
      return;
    }

    setScanning(true);
    setErrorMessage(null);

    try {
      // Chuyển file sang Base64
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });

      const payload = {
        fileBase64: base64Data,
        fileName: uploadedFile.name,
        mimeType: uploadedFile.type || (isPdf ? 'application/pdf' : 'image/jpeg')
      };

      const res = await fetch('/api/ocr/parse-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Lỗi máy chủ (${res.status})`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Không thể nhận diện nội dung hóa đơn.");
      }

      // Khởi tạo các trường chỉnh sửa
      setOcrResult({
        ...data,
        supplierID: data.supplierID ? String(data.supplierID) : '',
        items: (data.items || []).map(it => ({
          ...it,
          medicineID: it.medicineID ? String(it.medicineID) : '',
          importPrice: String(it.importPrice || 0),
          quantity: String(it.quantity || 1)
        }))
      });
    } catch (err) {
      setErrorMessage(err.message || "Đã xảy ra lỗi khi quét hóa đơn qua Gemini Vision AI.");
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateHeader = (field, val) => {
    if (!ocrResult) return;
    setOcrResult(prev => ({
      ...prev,
      [field]: val
    }));
  };

  const handleSupplierSelect = (supplierIdStr) => {
    if (!ocrResult) return;
    const sup = suppliers.find(s => String(s.supplierID) === supplierIdStr);
    setOcrResult(prev => ({
      ...prev,
      supplierID: supplierIdStr,
      supplierName: sup ? sup.supplierName : prev.supplierName
    }));
  };

  const handleUpdateItem = (idx, field, val) => {
    if (!ocrResult) return;
    const updatedItems = [...ocrResult.items];
    updatedItems[idx] = { ...updatedItems[idx], [field]: val };
    setOcrResult({ ...ocrResult, items: updatedItems });
  };

  const handleMedicineSelect = (idx, medicineIdStr) => {
    if (!ocrResult) return;
    const updatedItems = [...ocrResult.items];
    const med = medicines.find(m => String(m.medicineID) === medicineIdStr);

    if (med) {
      updatedItems[idx] = {
        ...updatedItems[idx],
        medicineID: medicineIdStr,
        medicineCode: med.medicineCode,
        matchedMedicineName: med.medicineName,
        genericName: med.genericName || '',
        unit: med.unit || updatedItems[idx].unit,
        isMatched: true,
        warning: null
      };
    } else {
      updatedItems[idx] = {
        ...updatedItems[idx],
        medicineID: '',
        medicineCode: '',
        matchedMedicineName: '',
        isMatched: false
      };
    }

    setOcrResult({ ...ocrResult, items: updatedItems });
  };

  const handleAddItem = () => {
    if (!ocrResult) return;
    const newItem = {
      medicineID: '',
      medicineCode: '',
      medicineName: 'Thuốc bổ sung',
      matchedMedicineName: '',
      genericName: '',
      batchNumber: '',
      expiryDate: '',
      unit: 'viên',
      importPrice: '0',
      quantity: '1',
      isMatched: false,
      confidence: 1.0
    };
    setOcrResult(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleRemoveItem = (idx) => {
    if (!ocrResult) return;
    const updated = ocrResult.items.filter((_, i) => i !== idx);
    setOcrResult(prev => ({
      ...prev,
      items: updated
    }));
  };

  const handleConfirmApply = () => {
    if (!ocrResult) return;

    onApplyData({
      invoiceNumber: ocrResult.invoiceNumber,
      invoiceDate: ocrResult.invoiceDate,
      deliveryNoteNumber: ocrResult.deliveryNoteNumber,
      supplierID: ocrResult.supplierID,
      supplierName: ocrResult.supplierName,
      items: ocrResult.items.map(item => ({
        medicineID: item.medicineID ? String(item.medicineID) : '',
        medicineName: item.matchedMedicineName || item.medicineName,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        importPrice: String(item.importPrice || '0'),
        quantity: String(item.quantity || '1'),
        contractPrice: item.contractPrice,
        remainingContractQty: item.remainingContractQty
      }))
    });

    onClose();
  };

  const handleReset = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
    setErrorMessage(null);
    setZoom(1);
    setRotation(0);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(7, 10, 19, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        color: 'var(--text-main, #0f172a)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: ocrResult || previewUrl ? '1350px' : '780px',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(2, 132, 199, 0.25)',
        overflow: 'hidden',
        transition: 'max-width 0.3s ease'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.1), transparent)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7, #0d9488)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
            }}>
              <ScanLine size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Bóc Tách Hóa Đơn Dược Phẩm (Smart OCR)
                </h3>
                <span className="badge-status" style={{
                  background: 'rgba(13, 148, 136, 0.15)',
                  color: '#0d9488',
                  border: '1px solid rgba(13, 148, 136, 0.3)',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  padding: '0.2rem 0.55rem'
                }}>
                  <Sparkles size={11} style={{ marginRight: '4px', verticalAlign: '-1px' }} /> Google Gemini Vision AI
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Tải ảnh hoặc PDF hóa đơn thực tế. AI tự động nhận diện Số HĐ, Ngày lập, Nhà cung cấp, Số lô và Hạn dùng.
              </p>
            </div>
          </div>
          
          <button 
            type="button" 
            onClick={onClose}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid var(--border-color)', 
              color: 'var(--text-main)', 
              cursor: 'pointer', 
              padding: '0.5rem', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            title="Đóng cửa sổ"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          
          {/* Error Banner */}
          {errorMessage && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              color: '#ef4444',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} />
                <span>{errorMessage}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setErrorMessage(null)} 
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* VIEW 1: Khi chưa có tệp hoặc chưa có kết quả -> Khu vực tải lên */}
          {!previewUrl && (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                flex: 1,
                border: dragActive ? '2px dashed #0284c7' : '2px dashed var(--border-color)',
                borderRadius: '16px',
                padding: '2.5rem 2rem',
                textAlign: 'center',
                background: dragActive ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-primary, #f8fafc)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelected(e.target.files[0]);
                  }
                }}
              />

              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15), rgba(13, 148, 136, 0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0284c7',
                marginBottom: '1rem'
              }}>
                <Upload size={32} />
              </div>

              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                Kéo thả ảnh hoặc tệp PDF hóa đơn thực tế vào đây
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '460px', lineHeight: '1.5' }}>
                Hoặc bấm để chọn tệp từ máy tính. Bạn cũng có thể bấm <strong style={{ color: 'var(--color-primary)' }}>Ctrl + V</strong> để dán ảnh chụp màn hình hóa đơn trực tiếp.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span className="badge-status" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', fontSize: '0.76rem' }}>
                  <ImageIcon size={13} style={{ marginRight: '4px' }} /> Hỗ trợ JPG, PNG, WEBP
                </span>
                <span className="badge-status" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', fontSize: '0.76rem' }}>
                  <FileText size={13} style={{ marginRight: '4px' }} /> Tệp PDF hóa đơn điện tử
                </span>
                <span className="badge-status" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.25)', fontSize: '0.76rem', fontWeight: '700' }}>
                  <ClipboardPaste size={13} style={{ marginRight: '4px' }} /> Hỗ trợ Ctrl + V (Paste ảnh)
                </span>
              </div>
            </div>
          )}

          {/* VIEW 2: Khi đã có tệp -> Giao diện chia đôi (Split View) */}
          {previewUrl && (
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '40% 60%', gap: '1.25rem', overflow: 'hidden' }}>
              
              {/* CỘT TRÁI: KHUNG XEM TRƯỚC TÀI LIỆU HÓA ĐƠN THỰC TẾ */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                background: 'var(--bg-primary, #f8fafc)',
                overflow: 'hidden'
              }}>
                {/* Thanh công cụ xem trước */}
                <div style={{
                  padding: '0.6rem 0.85rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(0,0,0,0.02)',
                  fontSize: '0.78rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)', fontWeight: '600', overflow: 'hidden' }}>
                    {isPdf ? <FileText size={15} color="#ef4444" /> : <ImageIcon size={15} color="#0284c7" />}
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '170px' }} title={uploadedFile?.name}>
                      {uploadedFile?.name || "Hóa đơn VAT"}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={() => setZoom(prev => Math.max(0.6, prev - 0.2))}
                      style={{ padding: '0.25rem 0.45rem', height: '28px' }}
                      title="Thu nhỏ"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <span style={{ fontSize: '0.74rem', minWidth: '40px', textAlign: 'center', fontWeight: '600' }}>
                      {Math.round(zoom * 100)}%
                    </span>
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={() => setZoom(prev => Math.min(2.5, prev + 0.2))}
                      style={{ padding: '0.25rem 0.45rem', height: '28px' }}
                      title="Phóng to"
                    >
                      <ZoomIn size={14} />
                    </button>
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={() => setRotation(prev => (prev + 90) % 360)}
                      style={{ padding: '0.25rem 0.45rem', height: '28px' }}
                      title="Xoay 90 độ"
                    >
                      <RotateCw size={14} />
                    </button>
                    <button 
                      type="button" 
                      className="btn-secondary"
                      onClick={handleReset}
                      style={{ padding: '0.25rem 0.55rem', height: '28px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                      title="Chọn tệp khác"
                    >
                      Đổi tệp
                    </button>
                  </div>
                </div>

                {/* Khung hiển thị tài liệu */}
                <div style={{
                  flex: 1,
                  overflow: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem',
                  background: 'rgba(0,0,0,0.06)'
                }}>
                  {isPdf ? (
                    <embed 
                      src={previewUrl} 
                      type="application/pdf" 
                      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '6px' }}
                    />
                  ) : (
                    <img 
                      src={previewUrl} 
                      alt="Xem trước hóa đơn" 
                      style={{
                        maxWidth: '100%',
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        transformOrigin: 'center center',
                        transition: 'transform 0.15s ease-out',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                        borderRadius: '6px'
                      }}
                    />
                  )}
                </div>

                {/* Nút bấm quét nếu chưa quét */}
                {!ocrResult && (
                  <div style={{ padding: '0.85rem', borderTop: '1px solid var(--border-color)', background: 'var(--card-bg, #ffffff)' }}>
                    <button
                      type="button"
                      className="btn-premium"
                      disabled={scanning}
                      onClick={handleRunOcr}
                      style={{
                        width: '100%',
                        padding: '0.7rem',
                        fontSize: '0.88rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      {scanning ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          Đang bóc tách qua Gemini Vision AI...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          Bắt Đầu Bóc Tách Hóa Đơn Bằng AI
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* CỘT PHẢI: KẾT QUẢ BÓC TÁCH & ĐỐI CHIẾU DANH MỤC */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                background: 'var(--bg-primary, #f8fafc)',
                overflow: 'hidden'
              }}>
                {!ocrResult ? (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)'
                  }}>
                    {scanning ? (
                      <>
                        <RefreshCw size={42} className="animate-spin" style={{ color: 'var(--color-primary)', marginBottom: '1rem' }} />
                        <h4 style={{ color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>AI đang đọc dữ liệu hóa đơn...</h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: '360px' }}>
                          Mô hình Gemini Vision đang phân tích bảng số liệu, nhận diện số hóa đơn, ngày lập, nhà cung cấp, số lô và hạn dùng.
                        </p>
                      </>
                    ) : (
                      <>
                        <ScanLine size={48} style={{ color: 'var(--text-dim)', marginBottom: '1rem', opacity: 0.5 }} />
                        <h4 style={{ color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>Sẵn sàng quét tài liệu</h4>
                        <p style={{ margin: 0, fontSize: '0.82rem', maxWidth: '340px' }}>
                          Nhấn nút <strong>"Bắt Đầu Bóc Tách Hóa Đơn Bằng AI"</strong> ở cột bên trái để trích xuất số liệu tự động.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    
                    {/* Thanh thông tin bóc tách thành công */}
                    <div style={{
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--border-color)',
                      background: 'rgba(16, 185, 129, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={18} color="#10b981" />
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>
                          Bóc tách thành công {ocrResult.items?.length || 0} mặt hàng
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge-status" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', fontSize: '0.72rem' }}>
                          ⚡ {ocrResult.aiEngine || "Gemini Vision AI (Live)"}
                        </span>
                        <button
                          type="button"
                          onClick={handleRunOcr}
                          disabled={scanning}
                          className="btn-secondary"
                          style={{ height: '26px', padding: '0 0.5rem', fontSize: '0.72rem' }}
                          title="Quét lại hóa đơn này"
                        >
                          <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} /> Quét lại
                        </button>
                      </div>
                    </div>

                    {/* Vùng nội dung cuộn */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      
                      {/* Form Thông tin Hóa đơn & Nhà Cung Cấp */}
                      <div style={{
                        background: 'var(--card-bg, #ffffff)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '0.85rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.75rem'
                      }}>
                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                            Số Hóa Đơn (VAT) (*)
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={ocrResult.invoiceNumber || ''}
                            onChange={(e) => handleUpdateHeader('invoiceNumber', e.target.value)}
                            style={{ height: '34px', fontSize: '0.82rem', fontWeight: '700' }}
                            placeholder="Số HĐ"
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                            Ký Hiệu Mẫu HĐ
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={ocrResult.invoiceSymbol || ''}
                            onChange={(e) => handleUpdateHeader('invoiceSymbol', e.target.value)}
                            style={{ height: '34px', fontSize: '0.82rem' }}
                            placeholder="VD: 1C26TDH"
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                            Ngày Lập HĐ (*)
                          </label>
                          <input
                            type="date"
                            className="form-input"
                            value={ocrResult.invoiceDate || ''}
                            onChange={(e) => handleUpdateHeader('invoiceDate', e.target.value)}
                            style={{ height: '34px', fontSize: '0.82rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                            Số Phiếu Xuất Kho / BBGH
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            value={ocrResult.deliveryNoteNumber || ''}
                            onChange={(e) => handleUpdateHeader('deliveryNoteNumber', e.target.value)}
                            style={{ height: '34px', fontSize: '0.82rem' }}
                            placeholder="VD: PX-0826"
                          />
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                            Nhà Cung Cấp / Công Ty Bán (*)
                          </label>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <select
                              className="form-input"
                              value={ocrResult.supplierID || ''}
                              onChange={(e) => handleSupplierSelect(e.target.value)}
                              style={{ height: '34px', fontSize: '0.82rem', flex: 1 }}
                            >
                              <option value="">-- Khớp hoặc chọn Nhà cung cấp trong CSDL --</option>
                              {suppliers.map(s => (
                                <option key={s.supplierID} value={String(s.supplierID)}>
                                  {s.supplierName} {s.contractNumber ? `(HĐ: ${s.contractNumber})` : ''}
                                </option>
                              ))}
                            </select>
                            {ocrResult.supplierName && (
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title="Tên đọc từ hóa đơn">
                                Đọc được: <strong>{ocrResult.supplierName}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bảng Chi Tiết Mặt Hàng Dược Phẩm */}
                      <div style={{
                        background: 'var(--card-bg, #ffffff)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          padding: '0.6rem 0.85rem',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(0,0,0,0.02)'
                        }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)' }}>
                            Chi tiết các mặt hàng thuốc trích xuất ({ocrResult.items?.length || 0})
                          </span>
                          <button
                            type="button"
                            onClick={handleAddItem}
                            className="btn-secondary"
                            style={{ height: '26px', padding: '0 0.6rem', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <Plus size={13} /> Thêm thuốc
                          </button>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '0.5rem', textAlign: 'left', minWidth: '200px' }}>Thuốc (Map vào CSDL)</th>
                                <th style={{ padding: '0.5rem', textAlign: 'center', width: '110px' }}>Số Lô (*)</th>
                                <th style={{ padding: '0.5rem', textAlign: 'center', width: '120px' }}>Hạn Dùng (*)</th>
                                <th style={{ padding: '0.5rem', textAlign: 'center', width: '70px' }}>ĐVT</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', width: '85px' }}>Số lượng</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', width: '95px' }}>Đơn giá</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', width: '100px' }}>Thành tiền</th>
                                <th style={{ padding: '0.5rem', textAlign: 'center', width: '40px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {ocrResult.items?.map((item, idx) => {
                                const totalItem = (parseInt(item.quantity) || 0) * (parseFloat(item.importPrice) || 0);

                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: item.warning ? 'rgba(239, 68, 68, 0.03)' : 'transparent' }}>
                                    
                                    {/* Tên thuốc & Map CSDL */}
                                    <td style={{ padding: '0.5rem' }}>
                                      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                                        {item.medicineName}
                                      </div>
                                      <select
                                        className="form-input"
                                        value={item.medicineID || ''}
                                        onChange={(e) => handleMedicineSelect(idx, e.target.value)}
                                        style={{ height: '28px', fontSize: '0.75rem', padding: '0 0.4rem', borderColor: item.isMatched ? '#10b981' : '#f59e0b' }}
                                      >
                                        <option value="">-- Chọn thuốc trong kho để map --</option>
                                        {medicines.map(m => (
                                          <option key={m.medicineID} value={String(m.medicineID)}>
                                            {m.medicineName} ({m.medicineCode})
                                          </option>
                                        ))}
                                      </select>
                                      {item.warning && (
                                        <div style={{ fontSize: '0.7rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                          <AlertTriangle size={11} /> {item.warning}
                                        </div>
                                      )}
                                    </td>

                                    {/* Số lô */}
                                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={item.batchNumber}
                                        onChange={(e) => handleUpdateItem(idx, 'batchNumber', e.target.value)}
                                        style={{ height: '30px', fontSize: '0.78rem', textAlign: 'center', padding: '0 0.3rem', fontWeight: '700' }}
                                        placeholder="Số lô"
                                      />
                                    </td>

                                    {/* Hạn dùng */}
                                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                      <input
                                        type="date"
                                        className="form-input"
                                        value={item.expiryDate}
                                        onChange={(e) => handleUpdateItem(idx, 'expiryDate', e.target.value)}
                                        style={{ height: '30px', fontSize: '0.76rem', padding: '0 0.3rem' }}
                                      />
                                    </td>

                                    {/* Đơn vị tính */}
                                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                      <input
                                        type="text"
                                        className="form-input"
                                        value={item.unit}
                                        onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                                        style={{ height: '30px', fontSize: '0.76rem', textAlign: 'center', padding: '0 0.2rem' }}
                                      />
                                    </td>

                                    {/* Số lượng */}
                                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        className="form-input"
                                        value={item.quantity}
                                        onKeyDown={handleIntegerKeyDown}
                                        onChange={(e) => handleUpdateItem(idx, 'quantity', sanitizeInteger(e.target.value, false))}
                                        style={{ height: '30px', fontSize: '0.78rem', textAlign: 'right', padding: '0 0.4rem', fontWeight: '700' }}
                                      />
                                    </td>

                                    {/* Đơn giá */}
                                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        className="form-input"
                                        value={item.importPrice}
                                        onKeyDown={handleIntegerKeyDown}
                                        onChange={(e) => handleUpdateItem(idx, 'importPrice', sanitizeInteger(e.target.value, false))}
                                        style={{ height: '30px', fontSize: '0.78rem', textAlign: 'right', padding: '0 0.4rem' }}
                                      />
                                    </td>

                                    {/* Thành tiền */}
                                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: 'var(--color-primary)' }}>
                                      {totalItem.toLocaleString('vi-VN')} đ
                                    </td>

                                    {/* Xóa dòng */}
                                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveItem(idx)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                                        title="Xóa dòng này"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>

                    {/* Footer của Cột Phải: Tổng tiền & Áp dụng */}
                    <div style={{
                      padding: '0.85rem 1rem',
                      borderTop: '1px solid var(--border-color)',
                      background: 'var(--card-bg, #ffffff)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Tổng giá trị hóa đơn: </span>
                        <strong style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>
                          {(ocrResult.items?.reduce((sum, it) => sum + ((parseInt(it.quantity) || 0) * (parseFloat(it.importPrice) || 0)), 0) || 0).toLocaleString('vi-VN')} đ
                        </strong>
                      </div>

                      <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleReset}
                          style={{ fontSize: '0.82rem' }}
                        >
                          Quét Hóa Đơn Khác
                        </button>
                        <button
                          type="button"
                          className="btn-premium"
                          onClick={handleConfirmApply}
                          style={{
                            background: 'linear-gradient(135deg, #10b981, #0d9488)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.55rem 1.4rem',
                            fontSize: '0.84rem',
                            fontWeight: '700'
                          }}
                        >
                          <CheckCircle2 size={16} /> Áp Dụng Vào Phiếu Nhập Kho
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Info */}
        <div style={{
          padding: '0.75rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.02)',
          fontSize: '0.76rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Dữ liệu bóc tách được đối chiếu tự động với danh mục thuốc và hợp đồng thầu trong hệ thống HIS.</span>
          </div>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={onClose}
            style={{ 
              background: 'var(--card-bg, #ffffff)', 
              color: 'var(--text-main)', 
              border: '1px solid var(--border-color)',
              padding: '0.3rem 1rem',
              fontWeight: '600',
              fontSize: '0.78rem'
            }}
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
