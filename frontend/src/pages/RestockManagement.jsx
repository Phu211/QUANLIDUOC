import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  FileText, 
  PlusCircle, 
  Printer, 
  RefreshCw, 
  CheckSquare, 
  X, 
  Eraser, 
  PenTool, 
  ThumbsUp,
  Trash,
  ChevronRight
} from 'lucide-react';

export default function RestockManagement({ user }) {
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' or 'history'
  const [lowStockItems, setLowStockItems] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]); // Full medicines catalog for manual adding
  const [checkedItemIDs, setCheckedItemIDs] = useState([]); // Checked items in low-stock table
  const [loading, setLoading] = useState(true);

  // Proposal Form State (Modal)
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [proposalReason, setProposalReason] = useState('Đề xuất mua bổ sung định kỳ thuốc thiếu định mức.');
  const [proposalItems, setProposalItems] = useState([]);

  // Signature Pad State (Modal)
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureProposalId, setSignatureProposalId] = useState(null);
  const [signatureAction, setSignatureAction] = useState(null); // 'create' or 'approve'
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Printing state
  const [activeProposalForPrint, setActiveProposalForPrint] = useState(null);

  const fetchInitialData = () => {
    setLoading(true);
    const t = Date.now();
    Promise.all([
      fetch(`/api/purchaseproposal/low-stock?_t=${t}`).then(res => res.json()),
      fetch(`/api/purchaseproposal?_t=${t}`).then(res => res.json()),
      fetch(`/api/import/suppliers?_t=${t}`).then(res => res.json()),
      fetch(`/api/import/medicines?_t=${t}`).then(res => res.json()) // Load all medicines
    ])
    .then(([lowStockData, proposalsData, suppliersData, medicinesData]) => {
      setLowStockItems(lowStockData);
      setProposals(proposalsData);
      setSuppliers(suppliersData);
      setMedicines(medicinesData);
      
      // Auto-check all items by default on load or refresh
      setCheckedItemIDs(lowStockData.map(item => item.medicineID));
      
      setLoading(false);
    })
    .catch(err => {
      console.error("Error loading restock data: ", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchInitialData();

    const handleUpdate = (e) => {
      if (e.detail === 'Proposals' || e.detail === 'Inventory') {
        fetchInitialData();
      }
    };
    window.addEventListener('pharmacy-update', handleUpdate);
    return () => window.removeEventListener('pharmacy-update', handleUpdate);
  }, []);

  // Handle opening creation modal
  const handleOpenProposalModal = () => {
    // Filter lowStockItems by checked IDs
    const selectedItems = lowStockItems.filter(item => checkedItemIDs.includes(item.medicineID));
    
    // Convert to proposal items format
    const items = selectedItems.map(item => ({
      medicineID: item.medicineID,
      medicineCode: item.medicineCode,
      medicineName: item.medicineName,
      unit: item.unit,
      currentQuantity: item.totalQty,
      minInventory: item.minInventory,
      suggestedQuantity: item.suggestedQuantity,
      isManual: false
    }));
    
    setProposalItems(items);
    setSelectedSupplier('');
    setProposalReason(selectedItems.length > 0 
      ? 'Đề xuất mua bổ sung định kỳ thuốc thiếu định mức.' 
      : 'Đề xuất mua bổ sung dược phẩm ngoại định mức.');
    setShowProposalModal(true);
  };

  const handleQtyChange = (idx, val) => {
    const updated = [...proposalItems];
    updated[idx].suggestedQuantity = parseInt(val) || 0;
    setProposalItems(updated);
  };

  const handleRemoveItem = (idx) => {
    const updated = proposalItems.filter((_, i) => i !== idx);
    setProposalItems(updated);
  };

  const handleAddManualRow = () => {
    setProposalItems([
      ...proposalItems,
      {
        medicineID: '',
        medicineCode: '',
        medicineName: '',
        unit: '',
        currentQuantity: 0,
        minInventory: 0,
        suggestedQuantity: 1,
        isManual: true
      }
    ]);
  };

  const handleManualMedicineChange = (idx, medID) => {
    const matched = medicines.find(m => m.medicineID.toString() === medID.toString());
    if (!matched) return;

    const updated = [...proposalItems];
    updated[idx] = {
      ...updated[idx],
      medicineID: matched.medicineID,
      medicineCode: matched.medicineCode,
      medicineName: matched.medicineName,
      unit: matched.unit,
      currentQuantity: 0,
      minInventory: matched.minInventory,
      suggestedQuantity: updated[idx].suggestedQuantity || 1,
      isManual: true
    };
    setProposalItems(updated);
  };

  // Submit Draft Proposal
  const handleSubmitProposal = (e) => {
    e.preventDefault();
    if (proposalItems.length === 0) {
      alert("Vui lòng chọn hoặc thêm ít nhất một mặt hàng thuốc để lập đề xuất.");
      return;
    }
    if (proposalItems.some(item => !item.medicineID)) {
      alert("Vui lòng chọn đầy đủ thuốc cho các dòng mới thêm.");
      return;
    }
    if (proposalItems.some(item => item.suggestedQuantity <= 0)) {
      alert("Vui lòng điền số lượng mua lớn hơn 0.");
      return;
    }

    // Trigger signature modal for proposer (storekeeper)
    setSignatureAction('create');
    setShowSignatureModal(true);
  };

  // Delete Proposal
  const handleDeleteProposal = (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy phiếu đề xuất mua thuốc này không?")) return;

    fetch(`/api/purchaseproposal/${id}`, {
      method: 'DELETE',
      headers: { 'X-User-Role': user?.role || '' }
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(data => { throw new Error(data.error || "Lỗi xóa phiếu"); });
      }
      return res.json();
    })
    .then(() => {
      alert("Đã xóa phiếu đề xuất thành công.");
      fetchInitialData();
    })
    .catch(err => alert("Lỗi: " + err.message));
  };

  // --------------------------------------------------------
  // Interactive Canvas Drawing Code
  // --------------------------------------------------------
  useEffect(() => {
    if (showSignatureModal) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#1e3a8a'; // Dark clinical blue ink
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Drawing Helpers
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

      // Add non-passive event listeners for mobile touch prevention
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

  const handleOpenSignatureModal = (id) => {
    setSignatureProposalId(id);
    setSignatureAction('approve');
    setShowSignatureModal(true);
  };

  const handleConfirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if canvas is empty (simplified check: is transparent pixel-only)
    const buffer = new Uint32Array(
      canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    const isEmpty = !buffer.some(color => color !== 0);
    if (isEmpty) {
      alert("Vui lòng vẽ chữ ký tay của bạn lên bảng trước khi xác nhận.");
      return;
    }

    const base64Signature = canvas.toDataURL('image/png');

    if (signatureAction === 'create') {
      const payload = {
        supplierID: selectedSupplier ? parseInt(selectedSupplier) : null,
        reason: proposalReason.trim(),
        createdBy: user?.fullName || 'Dược sĩ Khoa',
        proposerSignature: base64Signature,
        items: proposalItems.map(item => ({
          medicineID: parseInt(item.medicineID),
          currentQuantity: item.currentQuantity,
          minInventory: item.minInventory,
          suggestedQuantity: item.suggestedQuantity
        }))
      };

      fetch('/api/purchaseproposal/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || ''
        },
        body: JSON.stringify(payload)
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || "Lỗi khi lập đề xuất"); });
        }
        return res.json();
      })
      .then(() => {
        alert("Đã lập và ký xác nhận phiếu đề xuất mua thuốc thành công!");
        setShowSignatureModal(false);
        setShowProposalModal(false);
        setSignatureAction(null);
        setActiveTab('history');
        fetchInitialData();
      })
      .catch(err => alert("Lỗi: " + err.message));
    } else {
      const payload = {
        approvedBy: user?.fullName || 'PGS.TS. Lê Minh Dược',
        digitalSignature: base64Signature
      };

      fetch(`/api/purchaseproposal/${signatureProposalId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || ''
        },
        body: JSON.stringify(payload)
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || "Lỗi duyệt phiếu"); });
        }
        return res.json();
      })
      .then(() => {
        alert("Đã duyệt và ký nhận trực tuyến phiếu đề xuất thành công!");
        setShowSignatureModal(false);
        setSignatureProposalId(null);
        setSignatureAction(null);
        fetchInitialData();
      })
      .catch(err => alert("Lỗi: " + err.message));
    }
  };

  const handleShowPrintDetail = (id) => {
    setLoading(true);
    fetch(`/api/purchaseproposal/${id}`)
      .then(res => res.json())
      .then(data => {
        setActiveProposalForPrint(data);
        setLoading(false);
      })
      .catch(err => {
        alert("Lỗi tải chi tiết phiếu in: " + err.message);
        setLoading(false);
      });
  };

  if (loading && proposals.length === 0 && lowStockItems.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw className="nav-icon" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem', width: '30px', height: '30px' }} />
          <p>Đang tải dữ liệu định mức tồn kho...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Đặt Hàng & Dự Trù Tự Động</h1>
          <p className="page-subtitle">Hệ thống quét định mức, tự động cảnh báo reorder và lập biên bản đề xuất mua thuốc trực tuyến.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={fetchInitialData}>
            <RefreshCw size={16} /> Làm mới dữ liệu
          </button>
          {user?.role === 'pharmacist' && (
            <button className="btn-premium" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleOpenProposalModal}>
              <PlusCircle size={16} /> Lập đề xuất mua thuốc
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
        <button 
          className={`btn-secondary ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
          style={{
            background: activeTab === 'alerts' ? 'var(--color-primary)' : 'none',
            color: activeTab === 'alerts' ? '#ffffff' : 'var(--text-main)',
            border: 'none',
            padding: '0.5rem 1.25rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.88rem'
          }}
        >
          Thuốc thiếu định mức ({lowStockItems.length})
        </button>
        <button 
          className={`btn-secondary ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          style={{
            background: activeTab === 'history' ? 'var(--color-primary)' : 'none',
            color: activeTab === 'history' ? '#ffffff' : 'var(--text-main)',
            border: 'none',
            padding: '0.5rem 1.25rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.88rem'
          }}
        >
          Lịch sử phiếu đề xuất ({proposals.length})
        </button>
      </div>

      {/* VIEW: ALERTS LIST */}
      {activeTab === 'alerts' && (
        <div>
          {lowStockItems.length > 0 ? (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '12px',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.5rem',
              flexWrap: 'wrap',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <AlertTriangle color="#f59e0b" size={32} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h3 style={{ color: '#f59e0b', margin: '0 0 0.25rem 0', fontWeight: '700' }}>Phát Hiện {lowStockItems.length} Dược Phẩm Dưới Định Mức An Toàn!</h3>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.88rem' }}>
                    Tổng tồn kho chẵn và kho tủ trực lẻ của các loại thuốc này đang thấp hơn định mức dự trữ tối thiểu. Hãy gom và tạo đề xuất đặt hàng ngay.
                  </p>
                </div>
              </div>
              {user?.role === 'pharmacist' && (
                <button 
                  className="btn-premium" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)' }}
                  onClick={handleOpenProposalModal}
                >
                  <PlusCircle size={16} /> Lập Phiếu Đề Xuất Mua Thuốc
                </button>
              )}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--color-success)' }}>
              <ThumbsUp size={48} style={{ marginBottom: '1rem' }} />
              <h3>Kho dược an toàn!</h3>
              <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>Không phát hiện loại thuốc hay vật tư nào có mức tồn dưới định mức tối thiểu.</p>
            </div>
          )}

          {lowStockItems.length > 0 && (
            <div className="glass-card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input 
                          type="checkbox"
                          checked={checkedItemIDs.length === lowStockItems.length && lowStockItems.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCheckedItemIDs(lowStockItems.map(item => item.medicineID));
                            } else {
                              setCheckedItemIDs([]);
                            }
                          }}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </th>
                      <th>Mã Thuốc</th>
                      <th>Tên Thuốc / Hoạt Chất</th>
                      <th>Quy Cách</th>
                      <th>ĐVT</th>
                      <th style={{ textAlign: 'center' }}>Tồn Kho Chẵn</th>
                      <th style={{ textAlign: 'center' }}>Tồn Tủ Trực</th>
                      <th style={{ textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)' }}>Tổng Tồn</th>
                      <th style={{ textAlign: 'center' }}>Mức Tối Thiểu</th>
                      <th style={{ textAlign: 'center', color: 'var(--color-secondary)' }}>Đề Xuất Mua</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockItems.map(item => (
                      <tr key={item.medicineID}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={checkedItemIDs.includes(item.medicineID)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCheckedItemIDs([...checkedItemIDs, item.medicineID]);
                              } else {
                                setCheckedItemIDs(checkedItemIDs.filter(id => id !== item.medicineID));
                              }
                            }}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                        </td>
                        <td><strong>{item.medicineCode}</strong></td>
                        <td>
                          <div><strong>{item.medicineName}</strong></div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.genericName}</div>
                        </td>
                        <td>{item.specification || '-'}</td>
                        <td>{item.unit}</td>
                        <td style={{ textAlign: 'center' }}>{item.mainQty}</td>
                        <td style={{ textAlign: 'center' }}>{item.cabinetQty}</td>
                        <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.02)' }}>
                          {item.totalQty}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: '600' }}>{item.minInventory}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: 'rgba(13,148,136,0.1)', color: 'var(--color-secondary)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '700' }}>
                            +{item.suggestedQuantity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW: PROPOSALS HISTORY */}
      {activeTab === 'history' && (
        <div className="glass-card">
          {proposals.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Chưa có phiếu đề xuất đặt hàng nào được lập.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã Phiếu</th>
                    <th>Nhà Cung Cấp Đề Xuất</th>
                    <th>Ngày Lập</th>
                    <th>Người Lập</th>
                    <th style={{ textAlign: 'center' }}>Số Mặt Hàng</th>
                    <th>Lý do đề xuất</th>
                    <th>Trạng Thái</th>
                    <th>Chữ ký duyệt</th>
                    <th style={{ textAlign: 'center' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map(p => (
                    <tr key={p.proposalID}>
                      <td><strong>#PRP-{p.proposalID}</strong></td>
                      <td><strong>{p.supplierName}</strong></td>
                      <td>{new Date(p.proposalDate).toLocaleString('vi-VN')}</td>
                      <td>{p.createdBy}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600' }}>
                          {p.itemsCount} thuốc
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.reason || '-'}
                      </td>
                      <td>
                        <span className={`badge-status ${p.status.toLowerCase()}`}>
                          {p.status === 'Draft' ? 'Chờ duyệt' : p.status === 'Approved' ? 'Đã duyệt' : 'Đã đặt hàng'}
                        </span>
                      </td>
                      <td>
                        {p.status === 'Approved' ? (
                          <span style={{ color: 'var(--color-success)', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            ✍️ Đã ký điện tử
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Chưa ký</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => handleShowPrintDetail(p.proposalID)}
                          >
                            <Printer size={12} /> Xem/In
                          </button>
                          
                          {/* Director Approval Button */}
                          {p.status === 'Draft' && user?.role === 'director' && (
                            <button 
                              className="btn-premium" 
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              onClick={() => handleOpenSignatureModal(p.proposalID)}
                            >
                              <CheckSquare size={12} /> Ký duyệt
                            </button>
                          )}

                          {/* Pharmacist / Director Delete Button */}
                          {p.status === 'Draft' && (user?.role === 'pharmacist' || user?.role === 'director') && (
                            <button 
                              className="btn-danger" 
                              style={{ padding: '0.35rem 0.5rem', borderRadius: '6px' }}
                              onClick={() => handleDeleteProposal(p.proposalID)}
                            >
                              <Trash size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE PROPOSAL MODAL (FOR PHARMACIST) */}
      {showProposalModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <button 
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setShowProposalModal(false)}
            >
              <X size={24} />
            </button>

            <h3 style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PlusCircle size={22} color="var(--color-primary)" /> Lập Phiếu Đề Xuất Mua Thuốc (Dự Thảo)
            </h3>

            <form onSubmit={handleSubmitProposal}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Chọn nhà cung cấp chính đề xuất (Tùy chọn)</label>
                  <select 
                    className="form-input"
                    value={selectedSupplier}
                    onChange={e => setSelectedSupplier(e.target.value)}
                  >
                    <option value="">-- Nhiều nhà cung cấp hoặc chọn sau --</option>
                    {suppliers.map(s => (
                      <option key={s.supplierID} value={s.supplierID}>{s.supplierName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Lý do lập đề xuất</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={proposalReason} 
                    onChange={e => setProposalReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.88rem', fontWeight: '600' }}>Danh sách đề xuất bổ sung ({proposalItems.length} dược phẩm)</h4>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '600' }}
                    onClick={handleAddManualRow}
                  >
                    + Thêm thuốc khác
                  </button>
                </div>
                
                {proposalItems.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-glass)', borderRadius: '10px', margin: '1rem 0' }}>
                    Chưa có loại thuốc nào được đưa vào danh sách đề xuất. Hãy nhấn "+ Thêm thuốc khác" hoặc đóng cửa sổ để chọn từ bảng.
                  </p>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {proposalItems.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 0.4fr',
                        gap: '0.75rem',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '10px',
                        padding: '0.75rem 0.9rem',
                        marginBottom: '0.5rem',
                        alignItems: 'center',
                        position: 'relative'
                      }}>
                        {/* Cột 1: Tên thuốc hoặc Ô chọn thuốc */}
                        <div>
                          {item.isManual ? (
                            <select
                              className="form-input"
                              value={item.medicineID}
                              onChange={e => handleManualMedicineChange(idx, e.target.value)}
                              style={{ height: '35px', fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                              required
                            >
                              <option value="">-- Chọn thuốc cần mua --</option>
                              {medicines.map(med => (
                                <option key={med.medicineID} value={med.medicineID}>{med.medicineName} ({med.medicineCode})</option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{item.medicineName}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mã: {item.medicineCode} - ĐVT: {item.unit}</div>
                            </>
                          )}
                        </div>

                        {/* Cột 2: Tồn thực tế */}
                        <div style={{ fontSize: '0.8rem' }}>
                          {item.isManual ? (
                            <>ĐVT: <strong>{item.unit || '-'}</strong></>
                          ) : (
                            <>Tồn: <strong>{item.currentQuantity}</strong></>
                          )}
                        </div>

                        {/* Cột 3: Định mức tối thiểu */}
                        <div style={{ fontSize: '0.8rem' }}>
                          {item.isManual ? (
                            <>Tối thiểu: <strong>{item.minInventory}</strong></>
                          ) : (
                            <>Định mức: <strong>{item.minInventory}</strong></>
                          )}
                        </div>

                        {/* Cột 4: Số lượng mua */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mua:</span>
                          <input 
                            type="number"
                            className="form-input"
                            style={{ width: '70px', padding: '0.2rem 0.4rem', height: '32px', fontSize: '0.8rem' }}
                            value={item.suggestedQuantity}
                            min="1"
                            onChange={e => handleQtyChange(idx, e.target.value)}
                            required
                          />
                        </div>

                        {/* Cột 5: Nút xóa dòng */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button 
                            type="button" 
                            className="btn-danger" 
                            style={{ padding: '0.25rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => handleRemoveItem(idx)}
                            title="Xóa dòng này"
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowProposalModal(false)}>Hủy bỏ</button>
                <button type="submit" className="btn-premium">Lập phiếu nháp</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIGNATURE CANVAS MODAL (FOR DIRECTOR APPROVAL) */}
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
              <PenTool size={20} color="var(--color-secondary)" /> Ký Duyệt Đề Xuất Mua Thuốc
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              Vui lòng vẽ chữ ký tay của bạn vào khung bên dưới. Chữ ký này sẽ được mã hóa và đóng dấu đỏ lưu trữ chính thức trên tài liệu.
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
                  touchAction: 'none' // Disable double-tap zoom on iOS
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
                  <ThumbsUp size={14} /> {signatureAction === 'create' ? 'Xác nhận đề xuất' : 'Xác nhận ký duyệt'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {activeProposalForPrint && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', background: '#fff', color: '#000', padding: '2.5rem' }}>
            <button 
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setActiveProposalForPrint(null)}
            >
              <X size={24} />
            </button>

            {/* Printable Invoice Area */}
            <div id="printable-proposal">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.95rem' }}>BỆNH VIỆN TRUNG ƯƠNG</h4>
                  <h5 style={{ margin: 0, color: '#555', fontSize: '0.85rem' }}>KHOA DƯỢC - HÓA CHẤT</h5>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>ĐỀ NGHỊ MUA THUỐC & VẬT TƯ</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Số phiếu: #PRP-{activeProposalForPrint.proposalID}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                <div>
                  <p style={{ margin: '0.25rem 0' }}><strong>Đơn vị đề xuất:</strong> Kho chẵn chính - Khoa Dược</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Nhà cung cấp dự kiến:</strong> {activeProposalForPrint.supplier?.supplierName || 'Nhiều nhà cung cấp / Chưa chọn'}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Lý do đề xuất:</strong> {activeProposalForPrint.reason}</p>
                </div>
                <div>
                  <p style={{ margin: '0.25rem 0' }}><strong>Ngày đề xuất:</strong> {new Date(activeProposalForPrint.proposalDate).toLocaleString('vi-VN')}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Người lập đề xuất:</strong> {activeProposalForPrint.createdBy}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Trạng thái:</strong> {activeProposalForPrint.status === 'Draft' ? 'Chờ phê duyệt' : 'Đã duyệt đề xuất'}</p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd', marginBottom: '2rem', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #000' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', color: '#000', textAlign: 'center' }}>STT</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', color: '#000' }}>Mã Thuốc</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', color: '#000' }}>Tên thuốc / hóa chất</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', color: '#000' }}>Quy cách</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', color: '#000', textAlign: 'center' }}>ĐVT</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', color: '#000', textAlign: 'center' }}>Tồn Hiện Tại</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', color: '#000', textAlign: 'center' }}>Mức Tối Thiểu</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', color: '#000', textAlign: 'center' }}>Số Lượng Mua</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProposalForPrint.details?.map((d, index) => (
                    <tr key={d.proposalDetailID} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{index + 1}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{d.medicine?.medicineCode}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}><strong>{d.medicine?.medicineName}</strong></td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{d.medicine?.specification}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{d.medicine?.unit}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{d.currentQuantity}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{d.minInventory}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center', background: 'rgba(0,0,0,0.02)', fontWeight: '700' }}>
                        {d.suggestedQuantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '0.88rem', marginTop: '2.5rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <p><strong>Người lập đề xuất</strong></p>
                  <p style={{ fontSize: '0.8rem', color: '#555', margin: '0 0 0.25rem 0' }}>(Ký và ghi rõ họ tên)</p>
                  {activeProposalForPrint.proposerSignature ? (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.5rem 0' }}>
                      <img src={activeProposalForPrint.proposerSignature} alt="Proposer Signature" style={{ height: '75px', maxWidth: '180px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      Chưa ký đề xuất
                    </div>
                  )}
                  <p><strong>{activeProposalForPrint.createdBy}</strong></p>
                </div>
                <div style={{ textAlign: 'center', position: 'relative' }}>
                  <p><strong>Trưởng khoa Dược / Giám đốc</strong></p>
                  <p style={{ fontSize: '0.8rem', color: '#555', margin: '0 0 1rem 0' }}>(Ký và đóng dấu đỏ trực tuyến)</p>
                  
                  {activeProposalForPrint.status === 'Approved' && activeProposalForPrint.digitalSignature ? (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      height: '80px',
                      position: 'relative',
                      margin: '0.5rem 0'
                    }}>
                      {/* HANDWRITTEN DIGITAL SIGNATURE IMAGE */}
                      <img 
                        src={activeProposalForPrint.digitalSignature} 
                        alt="Director Signature" 
                        style={{ 
                          height: '75px', 
                          maxWidth: '180px',
                          zIndex: 2,
                          objectFit: 'contain'
                        }}
                      />

                      {/* STYLISH RED MEDICAL OFFICIAL STAMP OVERLAY */}
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        right: 'calc(50% - 65px)',
                        border: '3px double #ef4444',
                        color: '#ef4444',
                        borderRadius: '50%',
                        textTransform: 'uppercase',
                        transform: 'rotate(-10deg)',
                        width: '120px',
                        height: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: "'Inter', sans-serif",
                        lineHeight: '1.2',
                        zIndex: 1,
                        opacity: 0.75,
                        pointerEvents: 'none',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                        padding: '5px'
                      }}>
                        <div style={{ fontSize: '0.5rem', fontWeight: '700' }}>BỆNH VIỆN TRUNG ƯƠNG</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '800', borderTop: '1px solid #ef4444', borderBottom: '1px solid #ef4444', margin: '2px 0', padding: '1px 0' }}>ĐÃ DUYỆT</div>
                        <div style={{ fontSize: '0.45rem', fontWeight: '700' }}>KHOA DƯỢC - HÓA CHẤT</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      Chưa phê duyệt ký nhận
                    </div>
                  )}

                  <p style={{ marginTop: '0.5rem' }}>
                    <strong>{activeProposalForPrint.approvedBy || ''}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn-secondary" style={{ background: '#eee', color: '#000', borderColor: '#ccc' }} onClick={() => setActiveProposalForPrint(null)}>
                Đóng
              </button>
              <button 
                className="btn-premium" 
                onClick={() => {
                  const printContents = document.getElementById('printable-proposal').innerHTML;
                  const originalContents = document.body.innerHTML;
                  document.body.innerHTML = printContents;
                  window.print();
                  document.body.innerHTML = originalContents;
                  window.location.reload(); // Restore React
                }}
              >
                <Printer size={16} /> In biên bản đề xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
