import React, { useState, useEffect, useRef } from 'react';
import { Layers, User, PlusCircle, RefreshCw, Send, CheckSquare, X, PenTool, Eraser, ThumbsUp, ShieldAlert } from 'lucide-react';

export default function CabinetManagement({ user }) {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [cabinetStocks, setCabinetStocks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Selective Refill States
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [pendingRefillMedicines, setPendingRefillMedicines] = useState([]);
  const [selectedMedicineIds, setSelectedMedicineIds] = useState([]);

  // Patient Export Form State
  const [patientCode, setPatientCode] = useState('');
  const [patientName, setPatientName] = useState('');
  const [exportItems, setExportItems] = useState([{ batchID: '', quantity: '' }]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch('/api/requisition/departments')
      .then(res => res.json())
      .then(data => {
        setDepartments(data);
        if (user?.departmentID) {
          setSelectedDept(user.departmentID.toString());
        } else if (data.length > 0) {
          setSelectedDept(data[0].departmentID.toString());
        }
      })
      .catch(err => console.error("Error loading departments: ", err));
  }, [user]);

  const fetchCabinetData = (deptId) => {
    if (!deptId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/cabinet/stocks/${deptId}`).then(res => res.json()),
      fetch(`/api/cabinet/transactions/${deptId}`).then(res => res.json())
    ])
    .then(([stocksData, txsData]) => {
      setCabinetStocks(stocksData);
      setTransactions(txsData);
      setLoading(false);
    })
    .catch(err => {
      console.error("Error loading cabinet data: ", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (selectedDept) {
      fetchCabinetData(selectedDept);
    }

    const handleUpdate = (e) => {
      if (e.detail === 'Cabinets' && selectedDept) {
        fetchCabinetData(selectedDept);
      }
    };
    window.addEventListener('pharmacy-update', handleUpdate);
    return () => window.removeEventListener('pharmacy-update', handleUpdate);
  }, [selectedDept]);

  const addExportItem = () => {
    setExportItems([...exportItems, { batchID: '', quantity: '' }]);
  };

  const updateExportItem = (index, field, value) => {
    const updated = [...exportItems];
    updated[index][field] = value;
    setExportItems(updated);
  };

  const removeExportItem = (index) => {
    const updated = exportItems.filter((_, idx) => idx !== index);
    setExportItems(updated);
  };

  const handleExportSubmit = (e) => {
    e.preventDefault();
    if (!selectedDept || exporting) return;
    if (!patientCode || !patientName) {
      alert("Vui lòng điền đầy đủ thông tin bệnh nhân.");
      return;
    }

    if (exportItems.length === 0) {
      alert("Vui lòng thêm ít nhất một loại thuốc để xuất tủ.");
      return;
    }

    // Validate items
    const validatedItems = [];
    for (let i = 0; i < exportItems.length; i++) {
      const item = exportItems[i];
      if (!item.batchID || !item.quantity) {
        alert(`Dòng số ${i + 1}: Vui lòng chọn thuốc và nhập số lượng.`);
        return;
      }

      const qtyStr = item.quantity.toString().trim();
      if (!/^\d+$/.test(qtyStr)) {
        alert(`Dòng số ${i + 1}: Số lượng xuất phải là số nguyên dương lớn hơn hoặc bằng 1.`);
        return;
      }
      const qty = parseInt(qtyStr, 10);
      if (qty <= 0) {
        alert(`Dòng số ${i + 1}: Số lượng xuất phải là số nguyên dương lớn hơn hoặc bằng 1.`);
        return;
      }

      const stockItem = cabinetStocks.find(s => s.batchID.toString() === item.batchID);
      if (!stockItem || stockItem.currentQuantity < qty) {
        alert(`Dòng số ${i + 1}: Số lượng tồn trong tủ trực của thuốc "${stockItem?.batch?.medicine?.medicineName || 'đã chọn'}" không đủ để cấp.`);
        return;
      }

      // Check duplicates
      if (validatedItems.some(v => v.batchID === parseInt(item.batchID))) {
        alert(`Dòng số ${i + 1}: Thuốc này đã bị trùng lặp trong danh sách xuất.`);
        return;
      }

      validatedItems.push({
        batchID: parseInt(item.batchID),
        quantity: qty
      });
    }

    const payload = {
      departmentID: parseInt(selectedDept),
      patientCode: patientCode,
      patientName: patientName,
      items: validatedItems
    };

    setExporting(true);

    fetch('/api/cabinet/export', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || ''
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(data => { throw new Error(data.error || "Lỗi xuất tủ trực"); });
      }
      return res.json();
    })
    .then(newTxs => {
      alert(`Đã xuất tủ trực thành công cho bệnh nhân: ${patientName}.`);
      setPatientCode('');
      setPatientName('');
      setExportItems([{ batchID: '', quantity: '' }]);
      fetchCabinetData(selectedDept);
    })
    .catch(err => alert(err.message))
    .finally(() => setExporting(false));
  };

  const handleReturnRecall = (batchID) => {
    if (!window.confirm("Xác nhận trả khẩn cấp lô thuốc bị thu hồi này về kho cách ly trung tâm?")) return;
    fetch('/api/recall/return-dept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || '',
        'X-User-FullName': encodeURIComponent(user?.fullName || '')
      },
      body: JSON.stringify({
        departmentID: parseInt(selectedDept),
        batchID: batchID
      })
    })
    .then(res => {
      if (!res.ok) return res.json().then(data => { throw new Error(data.error || "Lỗi hoàn trả."); });
      return res.json();
    })
    .then(() => {
      alert("Đã hoàn trả thuốc thu hồi cách ly thành công! Số lượng tại khoa đã chuyển về 0.");
      fetchCabinetData(selectedDept);
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const canvasRef = useRef(null);

  // Canvas drawing setup
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

      let drawing = false;

      const start = (e) => {
        if (e.touches) e.preventDefault();
        drawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
      };

      const draw = (e) => {
        if (!drawing) return;
        if (e.touches) e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      };

      const stop = () => {
        drawing = false;
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
  }, [showSignatureModal]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const isCanvasEmpty = () => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const buffer = new Uint32Array(
      canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !buffer.some(color => color !== 0);
  };

  const handleRefillRequest = () => {
    if (user?.role === 'nurse') {
      alert("Quyền hạn bị từ chối. Chỉ Điều dưỡng trưởng khoa mới có quyền đề xuất và ký duyệt phiếu bù tủ trực.");
      return;
    }
    if (!selectedDept) return;
    const pendingTxs = transactions.filter(t => !t.requisition || t.requisition.status === 'Rejected');
    if (pendingTxs.length === 0) {
      alert("Không có phiếu xuất tủ trực nào chưa được bù hoặc bị từ chối để tổng hợp.");
      return;
    }

    // Group by Medicine ID to show in checklist
    const grouped = {};
    pendingTxs.forEach(t => {
      const medId = t.batch?.medicineID;
      const medName = t.batch?.medicine?.medicineName || 'Không rõ';
      const medCode = t.batch?.medicine?.medicineCode || 'N/A';
      if (!medId) return;
      if (!grouped[medId]) {
        grouped[medId] = {
          medicineID: medId,
          medicineName: medName,
          medicineCode: medCode,
          totalQty: 0
        };
      }
      grouped[medId].totalQty += t.quantity;
    });
    
    const groupedList = Object.values(grouped);
    setPendingRefillMedicines(groupedList);
    setSelectedMedicineIds(groupedList.map(g => g.medicineID)); // Select all by default
    setShowSelectionModal(true);
  };

  const handleConfirmRefillWithSignature = () => {
    if (isCanvasEmpty()) {
      alert("Vui lòng ký tên xác nhận trước khi gửi đề xuất bù tủ trực.");
      return;
    }

    const signatureBase64 = canvasRef.current.toDataURL('image/png');
    setShowSignatureModal(false);

    fetch(`/api/cabinet/refill/${selectedDept}`, { 
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || '',
        'X-User-FullName': encodeURIComponent(user?.fullName || '')
      },
      body: JSON.stringify({ 
        digitalSignature: signatureBase64,
        selectedMedicineIds: selectedMedicineIds
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || "Lỗi tổng hợp bù tủ"); });
        }
        return res.json();
      })
      .then(data => {
        alert("Tổng hợp đề nghị bù tủ trực và ký số thành công! Phiếu bù đã gửi tới Khoa Dược để duyệt.");
        fetchCabinetData(selectedDept);
      })
      .catch(err => alert(err.message));
  };

  const currentDeptName = departments.find(d => d.departmentID.toString() === selectedDept)?.departmentName || "Tủ trực";

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">Tủ Trực Khoa Lâm Sàng</h1>
          <p className="page-subtitle">Nhập xuất tủ trực ngoài giờ và đề nghị bù tủ trực định kỳ về khoa Dược.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <label className="form-label" style={{ margin: 0, textTransform: 'none', fontWeight: '500' }}>Khoa lâm sàng:</label>
          <select 
            className="form-input" 
            style={{ width: '220px' }}
            value={selectedDept} 
            onChange={e => setSelectedDept(e.target.value)}
            disabled={!!user?.departmentID}
          >
            {departments.map(d => (
              <option key={d.departmentID} value={d.departmentID}>{d.departmentName}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
        {/* Left column: Cabinet Stocks & Patients Export Form */}
        <div>
          {/* Cabinet Inventory List */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Cơ Số Tủ Trực Hiện Có ({currentDeptName})</h3>
              <button className="btn-secondary" style={{ padding: '0.4rem', borderRadius: '8px' }} onClick={() => fetchCabinetData(selectedDept)}>
                <RefreshCw size={14} />
              </button>
            </div>
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Đang tải tồn tủ trực...</p>
            ) : cabinetStocks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Tủ trực của khoa hiện đang trống hoặc chưa được cấp thuốc.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Thuốc / Hóa chất</th>
                      <th>Lô thuốc</th>
                      <th>Hạn dùng</th>
                      <th>Tồn tủ trực</th>
                      <th>Đơn giá</th>
                      <th>Trạng thái / Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cabinetStocks.map(stock => (
                      <tr key={stock.departmentStockID}>
                        <td>
                          <strong>{stock.batch?.medicine?.medicineName}</strong>
                          {(() => {
                            const expiryDate = new Date(stock.batch?.expiryDate);
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const diffTime = expiryDate - today;
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            if (diffDays <= 0) {
                              return (
                                <div style={{ marginTop: '0.25rem' }}>
                                  <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.35rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', display: 'inline-block', fontWeight: 'bold' }}>
                                    ⚠️ ĐÃ HẾT HẠN
                                  </span>
                                </div>
                              );
                            } else if (diffDays <= 90) {
                              return (
                                <div style={{ marginTop: '0.25rem' }}>
                                  <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.35rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '4px', display: 'inline-block', fontWeight: 'bold' }}>
                                    ⚠️ Sắp hết hạn ({diffDays} ngày)
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td>{stock.batch?.batchNumber}</td>
                        <td style={(() => {
                          const expiryDate = new Date(stock.batch?.expiryDate);
                          const today = new Date();
                          today.setHours(0,0,0,0);
                          const diffTime = expiryDate - today;
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          if (diffDays <= 0) return { color: '#ef4444', fontWeight: 'bold' };
                          if (diffDays <= 90) return { color: '#f59e0b', fontWeight: '600' };
                          return {};
                        })()}>
                          {new Date(stock.batch?.expiryDate).toLocaleDateString('vi-VN')}
                        </td>
                        <td>
                          <span style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-primary)' }}>
                            {stock.currentQuantity}
                          </span> {stock.batch?.medicine?.unit}
                        </td>
                        <td>{stock.batch?.importPrice.toLocaleString('vi-VN')}đ</td>
                        <td>
                          {stock.batch?.status !== 'Bình thường' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                              <span className="badge-status rejected" style={{ fontSize: '0.68rem', padding: '0.15rem 0.35rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', textTransform: 'none', whiteSpace: 'nowrap' }}>
                                Đình chỉ: {stock.batch?.status}
                              </span>
                              {stock.currentQuantity > 0 && (
                                <button 
                                  type="button" 
                                  className="btn-secondary" 
                                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.68rem', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.15rem', whiteSpace: 'nowrap' }}
                                  onClick={() => handleReturnRecall(stock.batchID)}
                                >
                                  Trả thu hồi khẩn cấp
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="badge-status approved" style={{ fontSize: '0.68rem', padding: '0.15rem 0.35rem', textTransform: 'none' }}>Bình thường</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bedside Export Simulator Form */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PlusCircle size={20} color="var(--color-secondary)" /> Xuất Tủ Trực Cho Bệnh Nhân (Ngoài Giờ / Cấp Cứu)
            </h3>
            <form onSubmit={handleExportSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Mã Bệnh Án / Bệnh Nhân (BA/BN)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="VD: BN-8972" 
                    value={patientCode} 
                    onChange={e => setPatientCode(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Họ và Tên Bệnh Nhân</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="VD: Nguyễn Văn A" 
                    value={patientName} 
                    onChange={e => setPatientName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    Danh sách Thuốc / Vật tư cấp phát:
                  </span>
                  <button 
                    type="button" 
                    className="btn-premium" 
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', height: '28px', background: 'var(--color-secondary)', borderColor: 'var(--color-secondary)', color: '#ffffff' }}
                    onClick={addExportItem}
                  >
                    + Thêm thuốc
                  </button>
                </div>

                {exportItems.map((item, index) => {
                  return (
                    <div key={index} className="form-row" style={{ marginTop: '0.5rem', alignItems: 'flex-end', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.75rem' }}>
                      <div className="form-group" style={{ flex: 3 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Thuốc trong tủ / Lô sản xuất ({index + 1})</label>
                        <select 
                          className="form-input"
                          value={item.batchID}
                          onChange={e => updateExportItem(index, 'batchID', e.target.value)}
                        >
                          <option value="">-- Chọn thuốc xuất tủ --</option>
                          {cabinetStocks.map((s, idx) => {
                            const isEarliest = cabinetStocks.findIndex(it => it.batch?.medicineID === s.batch?.medicineID) === idx;
                            const expiryStr = s.batch?.expiryDate ? new Date(s.batch.expiryDate).toLocaleDateString('vi-VN') : 'N/A';
                            const isSuspended = s.batch?.status !== 'Bình thường';
                            const expiryDate = s.batch?.expiryDate ? new Date(s.batch.expiryDate) : null;
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const isExpired = expiryDate ? (expiryDate - today) <= 0 : false;
                            const isDisabled = isSuspended || isExpired;
                            return (
                              <option key={s.batchID} value={s.batchID} disabled={isDisabled}>
                                {s.batch?.medicine?.medicineName} (Lô: {s.batch?.batchNumber} - Tồn: {s.currentQuantity} - HSD: {expiryStr}){isSuspended ? ` [ĐÌNH CHỈ / THU HỒI: ${s.batch?.status}]` : isExpired ? ' [⚠️ HẾT HẠN]' : isEarliest ? ' ★ [ƯU TIÊN FEFO]' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Số lượng</label>
                        <input 
                          type="number" 
                          min="1"
                          step="1"
                          className="form-input" 
                          placeholder="SL" 
                          value={item.quantity} 
                          onChange={e => updateExportItem(index, 'quantity', e.target.value)}
                        />
                      </div>
                      {exportItems.length > 1 && (
                        <button 
                          type="button" 
                          className="btn-danger" 
                          style={{ padding: '0.4rem 0.5rem', height: '38px', minWidth: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0px', background: '#ef4444', borderColor: '#ef4444', color: '#ffffff', borderRadius: '6px' }}
                          onClick={() => removeExportItem(index)}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {cabinetStocks.length === 0 && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  color: '#fcd34d',
                  fontSize: '0.85rem',
                  marginTop: '1rem',
                  lineHeight: '1.4'
                }}>
                  ⚠️ Tủ trực của khoa hiện đang trống. Khoa cần nhận thuốc cấp phát thường quy từ Kho Dược hoặc thực hiện quy trình bù tủ trực để có cơ số thuốc trước khi xuất cho bệnh nhân.
                </div>
              )}

              <div style={{ margin: '0.75rem 0', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontStyle: 'italic' }}>
                <ShieldAlert size={14} color="var(--color-secondary)" />
                <span>Điều dưỡng lâm sàng thực hiện cấp phát tủ trực theo y lệnh của Bác sĩ điều trị.</span>
              </div>

              <button 
                type="submit" 
                className="btn-premium" 
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', opacity: exporting ? 0.7 : 1 }} 
                disabled={cabinetStocks.length === 0 || exporting}
              >
                {exporting ? 'Đang xử lý...' : (
                  <>
                    <Send size={16} /> Xác nhận cấp xuất từ tủ trực (Theo Y lệnh)
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Cabinet Logs and Aggregation trigger */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3>Nhật Ký Xuất Tủ Trực Khoa</h3>
            {user?.role !== 'nurse' && (
              <button 
                className="btn-premium" 
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                onClick={handleRefillRequest}
              >
                <CheckSquare size={14} /> Bù tủ trực
              </button>
            )}
          </div>
          
          <div style={{ maxHeight: '530px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {transactions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Chưa có giao dịch xuất tủ trực nào trong ngày.</p>
            ) : (
              transactions.map(tx => (
                <div key={tx.transactionID} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>BN: {tx.patientName} ({tx.patientCode})</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Cấp: {tx.batch?.medicine?.medicineName} (SL: {tx.quantity}) - Lô: {tx.batch?.batchNumber}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                      {new Date(tx.transactionDate).toLocaleString('vi-VN')}
                    </div>
                    {tx.requisition && tx.requisition.status === 'Rejected' && (
                      <div style={{ fontSize: '0.78rem', color: '#f87171', marginTop: '0.35rem', fontStyle: 'italic', fontWeight: '500', lineHeight: '1.4' }}>
                        Lý do từ chối: {tx.requisition.rejectReason || 'Không có lý do'}
                      </div>
                    )}
                  </div>
                  {(() => {
                    if (!tx.requisition) {
                      return (
                        <span className="badge-status pending" style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.2)', fontSize: '0.75rem', textTransform: 'none' }}>
                          Chưa bù
                        </span>
                      );
                    }
                    if (tx.requisition.status === 'Pending') {
                      return (
                        <span className="badge-status pending" style={{ fontSize: '0.75rem', textTransform: 'none' }}>
                          Chờ duyệt bù
                        </span>
                      );
                    }
                    if (tx.requisition.status === 'Approved') {
                      return (
                        <span className="badge-status approved" style={{ fontSize: '0.75rem', textTransform: 'none' }}>
                          Đã bù tủ
                        </span>
                      );
                    }
                    if (tx.requisition.status === 'Rejected') {
                      return (
                        <span className="badge-status rejected" style={{ fontSize: '0.75rem', textTransform: 'none' }}>
                          Bị từ chối
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* DIGITAL SIGNATURE MODAL */}
      {showSignatureModal && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '500px', padding: '1.5rem', width: '90%' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888', zIndex: 10 }}
              onClick={() => setShowSignatureModal(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PenTool size={20} color="var(--color-secondary)" /> Ký Đề Nghị Bù Tủ Trực
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Vui lòng vẽ chữ ký tay điện tử của bạn vào khung bên dưới để xác nhận tổng hợp và ký gửi đề xuất bù cơ số tủ trực lên Khoa Dược.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Chữ ký Người lập đề xuất (Điều dưỡng) <span style={{ color: '#ef4444' }}>*</span></span>
                  <button type="button" className="btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', height: '22px', display: 'flex', alignItems: 'center', gap: '0.15rem' }} onClick={clearCanvas}>
                    <Eraser size={10} /> Xóa chữ ký
                  </button>
                </div>
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', overflow: 'hidden', height: '150px' }}>
                  <canvas ref={canvasRef} width="440" height="150" style={{ background: '#ffffff', cursor: 'crosshair', touchAction: 'none', width: '100%', height: '100%' }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: '34px' }} onClick={() => setShowSignatureModal(false)}>Hủy</button>
              <button 
                type="button" 
                className="btn-premium" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 1rem', fontSize: '0.8rem', height: '34px' }}
                onClick={handleConfirmRefillWithSignature}
              >
                <ThumbsUp size={14} /> Xác nhận & Gửi đề nghị
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEDICINE SELECTION MODAL FOR REFILL */}
      {showSelectionModal && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '550px', padding: '1.5rem', width: '95%' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888', zIndex: 10 }}
              onClick={() => setShowSelectionModal(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} color="var(--color-secondary)" /> Chọn Loại Thuốc & Vật Tư Cần Bù Tủ Trực
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Dưới đây là danh sách dược phẩm/vật tư đã tiêu hao chưa được bù của khoa. Vui lòng chọn các loại thuốc bạn muốn gửi đề xuất bù cơ số:
            </p>

            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.01)', padding: '0.5rem 0.75rem', marginBottom: '1.25rem' }}>
              {pendingRefillMedicines.map(med => {
                const isChecked = selectedMedicineIds.includes(med.medicineID);
                return (
                  <div 
                    key={med.medicineID} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.5rem', 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      background: isChecked ? 'rgba(59, 130, 246, 0.03)' : 'transparent'
                    }}
                    onClick={() => {
                      if (isChecked) {
                        setSelectedMedicineIds(prev => prev.filter(id => id !== med.medicineID));
                      } else {
                        setSelectedMedicineIds(prev => [...prev, med.medicineID]);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => {}} // Handled by parent div click
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: isChecked ? 'var(--text-main)' : 'var(--text-muted)' }}>{med.medicineName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Mã thuốc: {med.medicineCode}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge-status pending" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                        Cần bù: {med.totalQty}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: '34px' }} onClick={() => setShowSelectionModal(false)}>Hủy</button>
              <button 
                type="button" 
                className="btn-premium" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 1.25rem', fontSize: '0.8rem', height: '34px' }}
                onClick={() => {
                  if (selectedMedicineIds.length === 0) {
                    alert("Vui lòng chọn ít nhất một loại thuốc/vật tư để đề xuất bù!");
                    return;
                  }
                  setShowSelectionModal(false);
                  setShowSignatureModal(true);
                }}
              >
                Tiếp tục ký tên đề xuất &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
