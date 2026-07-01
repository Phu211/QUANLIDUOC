import React, { useState, useEffect, useRef } from 'react';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle, 
  Printer, 
  Eye, 
  RefreshCw, 
  Info, 
  Send, 
  X, 
  PenTool, 
  Eraser, 
  ThumbsUp,
  Clock,
  FileText,
  PlusCircle,
  Trash
} from 'lucide-react';

export default function Requisitions({ user }) {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReqForDetail, setActiveReqForDetail] = useState(null);
  
  // Custom Dispensing Qty State (keyed by RequisitionDetailID)
  const [adjustedQuantities, setAdjustedQuantities] = useState({});

  // Main store inventory batches for calculating stock levels and FEFO previews
  const [mainStoreBatches, setMainStoreBatches] = useState([]);

  // Direct Transfer States
  const [activeTab, setActiveTab] = useState('requisitions');
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [submittingDirect, setSubmittingDirect] = useState(false);

  // Digital Signature States
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState(null); // { action: 'approve_requisition'|'direct_transfer', requisitionID?: number }
  const canvasRef = useRef(null);

  // Create Requisition States for Nurse
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [requisitionType, setRequisitionType] = useState('Regular'); // 'Regular' or 'Urgent'
  const [requisitionItems, setRequisitionItems] = useState([{ medicineID: '', requestedQuantity: '' }]);
  const [allMedicines, setAllMedicines] = useState([]);

  // History Tab States
  const [internalTransfers, setInternalTransfers] = useState([]);
  const [activeTransferForDetail, setActiveTransferForDetail] = useState(null);
  const [historyTabType, setHistoryTabType] = useState('requisition_based'); // 'requisition_based' | 'direct_based'

  // Printable Modal States (Vietnamese SOP A4 Papers)
  const [activeReqForPrint, setActiveReqForPrint] = useState(null);
  const [activeTransferForPrint, setActiveTransferForPrint] = useState(null);

  // Fetch all requisitions
  const fetchRequisitions = () => {
    setLoading(true);
    fetch('/api/requisition')
      .then(res => res.json())
      .then(data => {
        setRequisitions(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading requisitions: ", err);
        setLoading(false);
      });
  };

  // Fetch main store inventory batches
  const fetchMainStoreBatches = () => {
    fetch('/api/inventory/batches')
      .then(res => res.json())
      .then(data => {
        const filtered = data.filter(b => 
          b.location === 'Kho chẵn chính' && 
          b.status === 'Bình thường' && 
          new Date(b.expiryDate) > new Date()
        );
        setMainStoreBatches(filtered);
      })
      .catch(err => console.error("Error loading inventory batches: ", err));
  };

  // Fetch departments for direct transfer dropdown
  const fetchDepartments = () => {
    fetch('/api/requisition/departments')
      .then(res => res.json())
      .then(data => setDepartments(data))
      .catch(err => console.error("Error loading departments: ", err));
  };

  // Fetch direct internal transfers history
  const fetchInternalTransfers = () => {
    fetch('/api/requisition/transfers')
      .then(res => res.json())
      .then(data => setInternalTransfers(data))
      .catch(err => console.error("Error loading internal transfers: ", err));
  };

  const [isDelegated, setIsDelegated] = useState(false);

  const fetchDelegationStatus = () => {
    fetch('/api/requisition/delegation-status')
      .then(res => res.json())
      .then(data => setIsDelegated(data.isDelegated))
      .catch(err => console.error("Error fetching delegation status: ", err));
  };

  const handleToggleDelegation = () => {
    const nextVal = !isDelegated;
    fetch('/api/requisition/toggle-delegation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isDelegated: nextVal })
    })
      .then(res => res.json())
      .then(data => {
        setIsDelegated(data.isDelegated);
        alert(data.isDelegated ? "Đã kích hoạt chế độ ủy quyền ký duyệt cho Điều dưỡng trưởng." : "Đã hủy kích hoạt chế độ ủy quyền.");
      })
      .catch(err => alert("Lỗi khi thay đổi trạng thái ủy quyền: " + err.message));
  };

  useEffect(() => {
    fetchRequisitions();
    fetchMainStoreBatches();
    fetchDepartments();
    fetchInternalTransfers();
    fetchDelegationStatus();

    // Fetch all medicines catalog for nurse creation form
    fetch('/api/medicine')
      .then(res => res.json())
      .then(data => setAllMedicines(data))
      .catch(err => console.error("Error loading medicines: ", err));

    const handleUpdate = (e) => {
      if (e.detail === 'Requisitions') {
        fetchRequisitions();
        fetchInternalTransfers();
      }
      if (e.detail === 'Inventory' || e.detail === 'Cabinets') {
        fetchMainStoreBatches();
        fetchInternalTransfers();
      }
    };
    window.addEventListener('pharmacy-update', handleUpdate);
    return () => window.removeEventListener('pharmacy-update', handleUpdate);
  }, []);

  // Signature Canvas Drawing Logic
  useEffect(() => {
    if (showSignatureModal) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#1e3a8a'; // Clinical dark blue ink
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

  // Open Requisition Details & Init Adjusted Quantities
  const handleOpenDetail = (req) => {
    setActiveReqForDetail(req);
    if (req && req.details) {
      const initial = {};
      req.details.forEach(d => {
        initial[d.requisitionDetailID] = d.requestedQuantity;
      });
      setAdjustedQuantities(initial);
    }
  };

  const getMedicinesSummary = (details) => {
    if (!details || details.length === 0) return 'Không có thuốc';
    const names = details.map(d => d.medicine?.medicineName || 'Thuốc');
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} (+${names.length - 2} khác)`;
  };

  // Helper: Sum stock for a specific medicine in main store
  const getMainStoreStockForMedicine = (medicineID) => {
    return mainStoreBatches
      .filter(b => b.medicineID === medicineID)
      .reduce((sum, b) => sum + b.quantity, 0);
  };

  // Helper: Calculate FEFO preview allocations for an item
  const getFefoPreviewForMedicine = (medicineID, quantity) => {
    if (quantity <= 0) return [];
    const activeBatches = mainStoreBatches
      .filter(b => b.medicineID === medicineID && b.quantity > 0 && new Date(b.expiryDate) > new Date())
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    let remaining = quantity;
    const allocation = [];
    for (const b of activeBatches) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      allocation.push({
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        take: take
      });
      remaining -= take;
    }
    return allocation;
  };

  const handleQtyChange = (detailId, val) => {
    const qty = Math.max(0, parseInt(val) || 0);
    setAdjustedQuantities(prev => ({
      ...prev,
      [detailId]: qty
    }));
  };

  // Reject Requisition
  const handleReject = (id) => {
    const isCabinetRefill = activeReqForDetail?.requisitionType === 'CabinetRefill';
    const promptMsg = isCabinetRefill 
      ? "Nhập lý do từ chối yêu cầu bù tủ trực khoa phòng (Bắt buộc):" 
      : "Nhập lý do từ chối yêu cầu lĩnh thuốc/vật tư (Không bắt buộc):";
      
    const reason = window.prompt(promptMsg);
    if (reason === null) return; // User clicked Cancel
    
    if (isCabinetRefill && !reason.trim()) {
      alert("Bạn bắt buộc phải nhập lý do từ chối khi từ chối yêu cầu bù tủ trực của khoa!");
      return;
    }

    setSignatureTarget({ 
      action: 'reject_requisition', 
      requisitionID: id, 
      reason: reason.trim() 
    });
    setShowSignatureModal(true);
  };

  // Intercept: Approve Requisition -> Open Signature Pad
  const handleApproveClick = () => {
    let hasError = false;
    activeReqForDetail.details.forEach(d => {
      const qty = adjustedQuantities[d.requisitionDetailID] ?? d.requestedQuantity;
      const maxStock = getMainStoreStockForMedicine(d.medicineID);
      if (qty > maxStock) {
        alert(`Số lượng cấp phát cho ${d.medicine?.medicineName || "vật tư"} (${qty}) vượt quá tồn kho chính sẵn có (${maxStock}). Vui lòng giảm số lượng thực cấp.`);
        hasError = true;
      }
    });

    if (hasError) return;

    setSignatureTarget({ action: 'approve_requisition', requisitionID: activeReqForDetail.requisitionID });
    setShowSignatureModal(true);
  };

  const handleAddReqRow = () => {
    setRequisitionItems([...requisitionItems, { medicineID: '', requestedQuantity: '' }]);
  };

  const handleRemoveReqRow = (index) => {
    const newItems = requisitionItems.filter((_, idx) => idx !== index);
    setRequisitionItems(newItems.length ? newItems : [{ medicineID: '', requestedQuantity: '' }]);
  };

  const handleReqItemChange = (index, field, value) => {
    const newItems = [...requisitionItems];
    newItems[index][field] = value;
    setRequisitionItems(newItems);
  };

  const handleSubmitRequisition = (e) => {
    if (e) e.preventDefault();
    
    // Validate rows
    const selectedMeds = new Set();
    for (let i = 0; i < requisitionItems.length; i++) {
      const item = requisitionItems[i];
      if (!item.medicineID || !item.requestedQuantity) {
        alert(`Vui lòng điền đầy đủ thông tin ở dòng thứ ${i + 1}`);
        return;
      }

      if (selectedMeds.has(item.medicineID)) {
        alert(`Dòng thứ ${i + 1}: Thuốc này đã được chọn ở dòng khác. Vui lòng không chọn trùng lặp một loại thuốc.`);
        return;
      }
      selectedMeds.add(item.medicineID);

      const qtyStr = item.requestedQuantity.toString().trim();
      if (!/^\d+$/.test(qtyStr)) {
        alert(`Dòng thứ ${i + 1}: Số lượng yêu cầu phải là số nguyên dương lớn hơn 0.`);
        return;
      }
      const qty = parseInt(qtyStr, 10);
      if (qty <= 0) {
        alert(`Dòng thứ ${i + 1}: Số lượng yêu cầu phải là số nguyên dương lớn hơn 0.`);
        return;
      }
    }

    // Open signature modal
    setSignatureTarget({ action: 'submit_requisition' });
    setShowSignatureModal(true);
  };

  // Intercept: Direct Transfer -> Open Signature Pad
  const handleDirectTransferSubmit = (e) => {
    e.preventDefault();
    if (!selectedDept || !selectedBatchId || !transferQty) {
      alert("Vui lòng điền đầy đủ thông tin cấp phát.");
      return;
    }

    const qty = parseInt(transferQty);
    const batchItem = mainStoreBatches.find(b => b.batchID.toString() === selectedBatchId);
    if (!batchItem || batchItem.quantity < qty) {
      alert(`Số lượng tồn kho chính không đủ (Hiện có: ${batchItem?.quantity || 0}).`);
      return;
    }

    setSignatureTarget({ action: 'direct_transfer' });
    setShowSignatureModal(true);
  };

  // Handle Confirmed Signatures
  const handleConfirmSignature = () => {
    if (isCanvasEmpty()) {
      alert("Vui lòng vẽ chữ ký tay để xác nhận giao dịch cấp phát.");
      return;
    }

    const signatureBase64 = canvasRef.current.toDataURL('image/png');
    setShowSignatureModal(false);

    if (signatureTarget.action === 'approve_requisition') {
      const id = signatureTarget.requisitionID;
      const payloadDetails = activeReqForDetail.details.map(d => ({
        requisitionDetailID: d.requisitionDetailID,
        dispensedQuantity: adjustedQuantities[d.requisitionDetailID] ?? d.requestedQuantity
      }));

      fetch(`/api/requisition/${id}/approve`, { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || '' 
        },
        body: JSON.stringify({
          approverSignature: signatureBase64,
          details: payloadDetails
        })
      })
        .then(async res => {
          const text = await res.text();
          if (res.ok) {
            alert("Phê duyệt hoàn tất! Hệ thống đã xuất kho chẵn và chuyển vào kho tủ trực khoa phòng.");
            fetchRequisitions();
            fetchMainStoreBatches();
            fetchInternalTransfers();
            setActiveReqForDetail(null);
          } else {
            let errorMsg = "Không đủ tồn kho chẵn";
            try {
              const data = JSON.parse(text);
              errorMsg = data.error || data.message || errorMsg;
            } catch (e) {
              errorMsg = text || `Mã lỗi: ${res.status}`;
            }
            alert("Lỗi khi xử lý phê duyệt: " + errorMsg);
          }
        })
        .catch(err => alert("Lỗi kết nối API: " + err.message));
    } else if (signatureTarget.action === 'direct_transfer') {
      setSubmittingDirect(true);
      fetch('/api/requisition/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || ''
        },
        body: JSON.stringify({
          departmentID: parseInt(selectedDept),
          batchID: parseInt(selectedBatchId),
          quantity: parseInt(transferQty),
          digitalSignature: signatureBase64
        })
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || "Lỗi cấp phát trực tiếp"); });
        }
        return res.json();
      })
      .then(data => {
        alert("Cấp phát trực tiếp thành công! Cơ số đã được chuyển xuống tủ trực khoa.");
        setTransferQty('');
        setSelectedBatchId('');
        fetchRequisitions();
        fetchMainStoreBatches();
        fetchInternalTransfers();
        setSubmittingDirect(false);
      })
      .catch(err => {
        alert(err.message);
        setSubmittingDirect(false);
      });
    } else if (signatureTarget.action === 'reject_requisition') {
      const id = signatureTarget.requisitionID;
      const reason = signatureTarget.reason;
      
      fetch(`/api/requisition/${id}/reject`, { 
        method: 'POST',
        headers: { 
          'X-User-Role': user?.role || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          rejectReason: reason,
          approverSignature: signatureBase64
        })
      })
        .then(async res => {
          const text = await res.text();
          if (res.ok) {
            alert("Đã từ chối phiếu lĩnh thành công.");
            fetchRequisitions();
            setActiveReqForDetail(null);
          } else {
            let errorMsg = "Lỗi nghiệp vụ";
            try {
              const data = JSON.parse(text);
              errorMsg = data.error || data.message || errorMsg;
            } catch (e) {
              errorMsg = text || `Mã lỗi: ${res.status}`;
            }
            alert("Lỗi khi từ chối phiếu: " + errorMsg);
          }
        })
        .catch(err => alert("Lỗi kết nối: " + err.message));
     } else if (signatureTarget.action === 'head_approve_requisition') {
       const id = signatureTarget.requisitionID;
       fetch(`/api/requisition/${id}/head-approve`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'X-User-Role': user?.role || ''
         },
         body: JSON.stringify({
           digitalSignature: signatureBase64,
           signerName: user?.fullName || ''
         })
       })
       .then(async res => {
         const text = await res.text();
         if (res.ok) {
           alert("Trưởng khoa đã ký duyệt phiếu lĩnh thành công! Phiếu đã được chuyển lên Kho Dược.");
           fetchRequisitions();
           setShowSignatureModal(false);
         } else {
           let errorMsg = "Lỗi ký duyệt";
           try {
             const data = JSON.parse(text);
             errorMsg = data.error || data.message || errorMsg;
           } catch (e) {
             errorMsg = text || `Mã lỗi: ${res.status}`;
           }
           alert("Lỗi khi ký duyệt: " + errorMsg);
         }
       })
       .catch(err => alert("Lỗi kết nối: " + err.message));
     } else if (signatureTarget.action === 'submit_requisition') {
      const payload = {
        departmentID: user?.departmentID || parseInt(selectedDept) || 1,
        requisitionType: requisitionType,
        digitalSignature: signatureBase64,
        details: requisitionItems.map(item => ({
          medicineID: parseInt(item.medicineID),
          requestedQuantity: parseInt(item.requestedQuantity)
        }))
      };

      fetch('/api/requisition/submit', {
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
          alert(requisitionType === 'Urgent' ? "Gửi đề nghị lĩnh thuốc KHẨN CẤP thành công! Kho Dược đã nhận tín hiệu ưu tiên." : "Gửi đề nghị lĩnh thuốc thường quy thành công!");
          fetchRequisitions();
          setShowCreateModal(false);
          setRequisitionItems([{ medicineID: '', requestedQuantity: '' }]);
        } else {
          let errorMsg = "Lỗi tạo phiếu lĩnh";
          try {
            const data = JSON.parse(text);
            errorMsg = data.error || data.message || errorMsg;
          } catch (e) {
            errorMsg = text || `Mã lỗi: ${res.status}`;
          }
          alert("Lỗi khi tạo phiếu lĩnh: " + errorMsg);
        }
      })
      .catch(err => alert("Lỗi kết nối: " + err.message));
    }
  };

  if (loading) return <div style={{ color: '#fff', padding: '2rem' }}>Đang tải dữ liệu phiếu dự trù y tế...</div>;

  const pendingCount = requisitions.filter(r => r.status === 'Pending').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">
            {(user?.role === 'nurse' || user?.role === 'head_nurse' || user?.role === 'head') ? 'Yêu Cầu Lĩnh Thuốc Khoa Lâm Sàng' : 'Cấp Phát Thuốc & Vật Tư Khoa Phòng'}
          </h1>
          <p className="page-subtitle">
            {(user?.role === 'nurse' || user?.role === 'head_nurse' || user?.role === 'head') 
              ? `Theo dõi trạng thái các phiếu lĩnh thuốc của khoa ${user.departmentName || ''} và lập yêu cầu mới.` 
              : 'Quản lý cấp phát thường quy và bù tủ trực cho các khoa phòng theo nguyên tắc FEFO.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {(user?.role === 'nurse' || user?.role === 'head_nurse' || user?.role === 'head') && (
            <button 
              className="btn-premium" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} 
              onClick={() => {
                setRequisitionItems([{ medicineID: '', requestedQuantity: '' }]);
                setRequisitionType('Regular');
                setShowCreateModal(true);
              }}
            >
              <PlusCircle size={16} /> Lập Phiếu Lĩnh Thuốc
            </button>
          )}
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={fetchRequisitions}>
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>
      </div>

      {user?.role === 'head' && (
        <div className="glass-card" style={{ 
          marginBottom: '1.25rem', 
          background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)', 
          border: '1px solid rgba(13, 148, 136, 0.2)',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '1rem 1.5rem'
        }}>
          <div>
            <h4 style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '0.95rem', fontWeight: '600' }}>⚡ Chế độ ủy quyền phê duyệt vắng mặt</h4>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cho phép Điều dưỡng trưởng khoa (`head_nurse`) thay mặt Trưởng khoa ký duyệt lâm sàng các phiếu lĩnh thuốc.</p>
          </div>
          <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={isDelegated} 
              onChange={handleToggleDelegation} 
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: isDelegated ? 'var(--color-secondary)' : 'rgba(255,255,255,0.1)',
              transition: '.3s', borderRadius: '24px', border: '1px solid var(--border-glass)'
            }}>
              <span style={{
                position: 'absolute', height: '16px', width: '16px', left: isDelegated ? '26px' : '4px', bottom: '3px',
                backgroundColor: 'white', transition: '.3s', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </span>
          </label>
        </div>
      )}

      {user?.role === 'head_nurse' && isDelegated && (
        <div className="glass-card" style={{ 
          marginBottom: '1.25rem', 
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)', 
          border: '1px solid rgba(245, 158, 11, 0.3)',
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          padding: '0.75rem 1.25rem',
          color: '#f59e0b',
          fontSize: '0.82rem'
        }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <span>
            <strong>Ủy quyền đang kích hoạt:</strong> Trưởng khoa hiện đang vắng mặt và đã ủy quyền duyệt lâm sàng cho bạn. Bạn có thể ký duyệt thay Trưởng khoa đối với các phiếu lĩnh thuốc của khoa mình.
          </span>
        </div>
      )}

      {(user?.role === 'nurse' || user?.role === 'head_nurse' || user?.role === 'head') ? (
        // Giao diện của Điều dưỡng: Chỉ xem danh sách phiếu lĩnh thuốc của khoa mình
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3>Danh Sách Phiếu Yêu Cầu Lĩnh Thuốc Đã Gửi</h3>
            <span className="badge-status pending" style={{ textTransform: 'none', background: 'rgba(13, 148, 136, 0.1)', color: 'var(--color-secondary)' }}>
              Khoa: {user.departmentName}
            </span>
          </div>

          {requisitions.filter(r => r.departmentID === user.departmentID).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Khoa chưa gửi phiếu lĩnh thuốc nào.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã Phiếu</th>
                    <th>Loại Yêu Cầu</th>
                    <th>Ngày Đề Nghị</th>
                    <th>Vật Tư Yêu Cầu</th>
                    <th>Trạng Thái</th>
                    <th>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions
                    .filter(r => r.departmentID === user.departmentID)
                    .sort((a, b) => new Date(b.requisitionDate) - new Date(a.requisitionDate))
                    .map(req => (
                      <tr key={req.requisitionID}>
                        <td><strong>#REQ-{req.requisitionID}</strong></td>
                        <td>
                          <span className={`badge-status ${req.requisitionType === 'Regular' ? 'regular' : req.requisitionType === 'Urgent' ? 'urgent' : 'refill'}`}>
                            {req.requisitionType === 'Regular' ? 'Lĩnh thường quy' : req.requisitionType === 'Urgent' ? '🚨 Lĩnh khẩn' : 'Bù tủ trực cấp cứu'}
                          </span>
                        </td>
                        <td>{new Date(req.requisitionDate).toLocaleString('vi-VN')}</td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                            {getMedicinesSummary(req.details)}
                          </span>
                        </td>
                        <td>
                          <span className={`badge-status ${req.status.toLowerCase()}`}>
                            {req.status === 'PendingHead' ? 'Chờ Trưởng khoa duyệt' : req.status === 'Pending' ? 'Chờ Dược duyệt' : req.status === 'Approved' ? 'Đã duyệt' : 'Đã từ chối'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                              onClick={() => handleOpenDetail(req)}
                            >
                              Chi tiết
                            </button>
                            {req.status === 'Approved' && (
                              <button 
                                className="btn-premium" 
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveReqForPrint(req);
                                }}
                              >
                                <Printer size={12} /> In (A4)
                              </button>
                            )}
                            {((user?.role === 'head') || (user?.role === 'head_nurse' && isDelegated)) && (req.status === 'PendingHead' || !req.headSignature) && req.status !== 'Rejected' && (
                              <>
                                <button 
                                  className="btn-premium" 
                                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#059669', borderColor: '#059669' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSignatureTarget({ action: 'head_approve_requisition', requisitionID: req.requisitionID });
                                    setShowSignatureModal(true);
                                  }}
                                >
                                  {user?.role === 'head_nurse' ? '✍️ Ký duyệt thay' : (req.status === 'PendingHead' ? 'Ký duyệt' : 'Ký bổ sung')}
                                </button>
                                {req.status === 'PendingHead' && (
                                  <button 
                                    className="btn-danger" 
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const reason = prompt("Nhập lý do từ chối phiếu lĩnh:");
                                      if (reason === null) return;
                                      if (!reason.trim()) {
                                        alert("Lý do từ chối không được để trống.");
                                        return;
                                      }
                                      setSignatureTarget({ action: 'reject_requisition', requisitionID: req.requisitionID, reason: reason });
                                      setShowSignatureModal(true);
                                    }}
                                  >
                                    Từ chối
                                  </button>
                                )}
                              </>
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
      ) : (
        // Giao diện của Thủ kho Dược: Có Tab Navigation và các chức năng phê duyệt/cấp phát trực tiếp
        <>
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
        <button 
          className={activeTab === 'requisitions' ? 'btn-premium' : 'btn-secondary'}
          onClick={() => setActiveTab('requisitions')}
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <ClipboardCheck size={15} /> Phê duyệt yêu cầu lĩnh cấp từ khoa
        </button>
        <button 
          className={activeTab === 'direct' ? 'btn-premium' : 'btn-secondary'}
          onClick={() => setActiveTab('direct')}
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <Send size={15} /> Chủ động cấp phát trực tiếp xuống khoa
        </button>
        <button 
          className={activeTab === 'history' ? 'btn-premium' : 'btn-secondary'}
          onClick={() => setActiveTab('history')}
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <Clock size={15} /> Lịch sử & Hồ sơ cấp phát
        </button>
      </div>

      {activeTab === 'requisitions' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3>Danh Sách Yêu Cầu Cấp Phát Thuốc & Vật Tư Y Tế ({pendingCount} Phiếu chờ duyệt)</h3>
          </div>

          {requisitions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Không có phiếu dự trù/lĩnh thuốc nào được tìm thấy.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã Phiếu</th>
                    <th>Khoa / Phòng Lĩnh</th>
                    <th>Loại Yêu Cầu</th>
                    <th>Ngày Đề Nghị</th>
                    <th>Vật Tư Yêu Cầu</th>
                    <th>Trạng Thái</th>
                    <th>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {[...requisitions]
                    .filter(req => req.status !== 'PendingHead')
                    .sort((a, b) => {
                      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                      if (a.requisitionType === 'Urgent' && b.requisitionType !== 'Urgent') return -1;
                      if (a.requisitionType !== 'Urgent' && b.requisitionType === 'Urgent') return 1;
                      return new Date(b.requisitionDate) - new Date(a.requisitionDate);
                    })
                    .map(req => (
                    <tr key={req.requisitionID}>
                      <td><strong>#REQ-{req.requisitionID}</strong></td>
                      <td><strong>{req.department?.departmentName}</strong></td>
                      <td>
                        <span className={`badge-status ${req.requisitionType === 'Regular' ? 'regular' : req.requisitionType === 'Urgent' ? 'urgent' : 'refill'}`}>
                          {req.requisitionType === 'Regular' ? 'Lĩnh thường quy' : req.requisitionType === 'Urgent' ? '🚨 Lĩnh khẩn' : 'Bù tủ trực cấp cứu'}
                        </span>
                      </td>
                      <td>{new Date(req.requisitionDate).toLocaleString('vi-VN')}</td>
                      <td>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                          {getMedicinesSummary(req.details)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status ${req.status.toLowerCase()}`}>
                          {req.status === 'Pending' ? 'Chờ duyệt' : req.status === 'Approved' ? 'Đã duyệt' : 'Đã từ chối'}
                        </span>
                      </td>
                      <td>
                        {req.status === 'Pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn-premium" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                              onClick={() => handleOpenDetail(req)}
                            >
                              Xem & Duyệt cấp phát
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Đã hoàn tất</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'direct' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
          {/* Left Column: Direct Transfer Form */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={20} color="var(--color-secondary)" /> Chủ Động Cấp Phát Trực Tiếp
            </h3>
            <form onSubmit={handleDirectTransferSubmit}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Khoa Lâm Sàng Tiếp Nhận</label>
                <select 
                  className="form-input"
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  required
                >
                  <option value="">-- Chọn khoa tiếp nhận --</option>
                  {departments.map(d => (
                    <option key={d.departmentID} value={d.departmentID}>{d.departmentName}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Chọn Thuốc / Vật Tư xuất từ Kho Chẵn</label>
                <select 
                  className="form-input"
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  required
                >
                  <option value="">-- Chọn lô dược phẩm / vật tư có trong kho --</option>
                  {mainStoreBatches.map(b => {
                    const expDate = b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('vi-VN') : 'N/A';
                    return (
                      <option key={b.batchID} value={b.batchID}>
                        {b.medicineName} (Lô: {b.batchNumber} - Tồn chính: {b.quantity} - HSD: {expDate})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Số lượng cấp phát thực tế</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Nhập số lượng cấp phát"
                  value={transferQty}
                  onChange={e => setTransferQty(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn-premium" 
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={submittingDirect}
              >
                <Send size={16} /> {submittingDirect ? "Đang thực hiện..." : "Xác nhận cấp phát trực tiếp"}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} color="var(--color-secondary)" /> Lịch Sử & Hồ Sơ Cấp Phát Thuốc - Vật Tư Khoa Phòng
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className={historyTabType === 'requisition_based' ? 'btn-premium' : 'btn-secondary'}
                onClick={() => setHistoryTabType('requisition_based')}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
              >
                Cấp phát theo yêu cầu lĩnh ({requisitions.filter(r => r.status === 'Approved').length})
              </button>
              <button 
                className={historyTabType === 'direct_based' ? 'btn-premium' : 'btn-secondary'}
                onClick={() => setHistoryTabType('direct_based')}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
              >
                Cấp phát chủ động trực tiếp ({internalTransfers.length})
              </button>
            </div>
          </div>

          {historyTabType === 'requisition_based' ? (
            requisitions.filter(r => r.status === 'Approved').length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Chưa có hồ sơ cấp phát theo yêu cầu lĩnh nào được phê duyệt.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Mã Hồ Sơ</th>
                      <th>Khoa Lâm Sàng</th>
                      <th>Loại Cấp Phát</th>
                      <th>Ngày Cấp Phát</th>
                      <th style={{ textAlign: 'center' }}>Số Mặt Hàng</th>
                      <th style={{ textAlign: 'center' }}>Chữ Ký Số</th>
                      <th>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisitions.filter(r => r.status === 'Approved').map(req => (
                      <tr key={req.requisitionID}>
                        <td><strong>#REQ-{req.requisitionID}</strong></td>
                        <td><strong>{req.department?.departmentName}</strong></td>
                        <td>
                          <span className={`badge-status ${req.requisitionType === 'Regular' ? 'regular' : req.requisitionType === 'Urgent' ? 'urgent' : 'refill'}`}>
                            {req.requisitionType === 'Regular' ? 'Lĩnh thường quy' : req.requisitionType === 'Urgent' ? '🚨 Lĩnh khẩn' : 'Bù tủ trực cấp cứu'}
                          </span>
                        </td>
                        <td>{new Date(req.requisitionDate).toLocaleString('vi-VN')}</td>
                        <td style={{ textAlign: 'center' }}><strong>{req.details?.length || 0}</strong></td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge-status approved" style={{ textTransform: 'none', fontSize: '0.72rem', padding: '0.15rem 0.4rem' }}>
                            ✍️ Đã ký số hai đầu
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn-premium" 
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => handleOpenDetail(req)}
                          >
                            <FileText size={12} /> Xem hồ sơ cấp phát
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            internalTransfers.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Chưa có hồ sơ xuất chuyển trực tiếp chủ động nào được thực hiện.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Mã Hồ Sơ</th>
                      <th>Khoa Lâm Sàng Nhận</th>
                      <th>Nguồn Xuất</th>
                      <th>Ngày Cấp Phát</th>
                      <th style={{ textAlign: 'center' }}>Tổng Số Lượng</th>
                      <th style={{ textAlign: 'center' }}>Chữ Ký Số</th>
                      <th>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {internalTransfers.map(tx => {
                      const totalQty = tx.details?.reduce((sum, d) => sum + d.quantity, 0) || 0;
                      return (
                        <tr key={tx.transferID}>
                          <td><strong>#PTX-{tx.transferID}</strong></td>
                          <td><strong>{tx.toDepartment?.departmentName}</strong></td>
                          <td><span className="badge-status regular" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Kho chẵn chính</span></td>
                          <td>{new Date(tx.transferDate).toLocaleString('vi-VN')}</td>
                          <td style={{ textAlign: 'center' }}><strong>{totalQty}</strong> sản phẩm</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge-status approved" style={{ textTransform: 'none', fontSize: '0.72rem', padding: '0.15rem 0.4rem' }}>
                              ✍️ Đã ký xác nhận
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn-premium" 
                              style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              onClick={() => setActiveTransferForDetail(tx)}
                            >
                              <FileText size={12} /> Xem hồ sơ xuất chuyển
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </>
  )}

      {/* DETAILED REVIEW & APPROVAL MODAL */}
      {activeReqForDetail && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 900 }}>
          <div className="modal-content" style={{ maxWidth: '850px', padding: '1.5rem', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888', zIndex: 10 }}
              onClick={() => setActiveReqForDetail(null)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              {activeReqForDetail.status === 'Pending' ? 'Xem xét & Phê duyệt cấp phát chi tiết' : 'Chi tiết phiếu lĩnh cấp'} #REQ-{activeReqForDetail.requisitionID}
            </h3>
            
            {/* TIMELINE / TIME LOG */}
            {(() => {
              const isRejected = activeReqForDetail.status === 'Rejected';
              const isRejectedByHead = isRejected && !activeReqForDetail.headSignature;
              const isRejectedByPharmacist = isRejected && activeReqForDetail.headSignature;

              // Step 2 variables
              let step2Bg = '#334155';
              let step2Label = 'Trưởng khoa duyệt';
              let step2Color = '#64748b';
              let step2Date = activeReqForDetail.headApproveDate ? new Date(activeReqForDetail.headApproveDate).toLocaleString('vi-VN') : 'Chờ duyệt';
              let step2BoxShadow = 'none';

              if (isRejectedByHead) {
                step2Bg = '#ef4444';
                step2Label = 'Bị từ chối';
                step2Color = '#ef4444';
                step2Date = 'Trưởng khoa từ chối';
                step2BoxShadow = '0 0 10px rgba(239, 68, 68, 0.5)';
              } else if (activeReqForDetail.headSignature) {
                step2Bg = '#059669';
                step2Label = 'Trưởng khoa duyệt';
                step2Color = 'var(--text-main)';
                step2BoxShadow = '0 0 10px rgba(5, 150, 105, 0.5)';
              } else if (activeReqForDetail.status === 'PendingHead') {
                step2Bg = '#f59e0b';
                step2Color = '#f59e0b';
                step2BoxShadow = '0 0 10px rgba(245, 158, 11, 0.5)';
              }

              // Step 3 variables
              let step3Bg = '#334155';
              let step3Label = 'Dược sĩ xuất kho';
              let step3Color = '#64748b';
              let step3Date = activeReqForDetail.dispenseDate ? new Date(activeReqForDetail.dispenseDate).toLocaleString('vi-VN') : 'Chờ cấp phát';
              let step3BoxShadow = 'none';

              if (isRejectedByHead) {
                step3Bg = '#1e293b';
                step3Color = '#475569';
                step3Date = 'Bị hủy';
              } else if (isRejectedByPharmacist) {
                step3Bg = '#ef4444';
                step3Label = 'Bị từ chối';
                step3Color = '#ef4444';
                step3Date = 'Dược sĩ từ chối';
                step3BoxShadow = '0 0 10px rgba(239, 68, 68, 0.5)';
              } else if (activeReqForDetail.approverSignature) {
                step3Bg = '#7e22ce';
                step3Label = 'Dược sĩ xuất kho';
                step3Color = 'var(--text-main)';
                step3BoxShadow = '0 0 10px rgba(126, 34, 206, 0.5)';
              } else if (activeReqForDetail.status === 'Pending') {
                step3Bg = '#f59e0b';
                step3Color = '#f59e0b';
                step3BoxShadow = '0 0 10px rgba(245, 158, 11, 0.5)';
              }

              // Step 4 variables
              let step4Bg = '#334155';
              let step4Label = 'Khoa lâm sàng nhận';
              let step4Color = '#64748b';
              let step4Date = activeReqForDetail.receiveDate ? new Date(activeReqForDetail.receiveDate).toLocaleString('vi-VN') : 'Chờ xác nhận';
              let step4BoxShadow = 'none';

              if (isRejected) {
                step4Bg = '#1e293b';
                step4Color = '#475569';
                step4Date = 'Bị hủy';
              } else if (activeReqForDetail.receiveDate) {
                step4Bg = '#10b981';
                step4Label = 'Khoa lâm sàng nhận';
                step4Color = 'var(--text-main)';
                step4BoxShadow = '0 0 10px rgba(16, 185, 129, 0.5)';
              } else if (activeReqForDetail.status === 'Approved') {
                step4Bg = '#f59e0b';
                step4Color = '#f59e0b';
                step4BoxShadow = '0 0 10px rgba(245, 158, 11, 0.5)';
              }

              // Line gradient
              let lineBg = 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary) 15%, #334155 35%, #334155 100%)';
              if (isRejectedByHead) {
                lineBg = 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary) 15%, #ef4444 35%, #1e293b 50%, #1e293b 100%)';
              } else if (isRejectedByPharmacist) {
                lineBg = 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary) 15%, #059669 35%, #059669 50%, #ef4444 65%, #1e293b 80%, #1e293b 100%)';
              } else {
                lineBg = `linear-gradient(90deg, 
                  var(--color-primary) 0%, 
                  var(--color-primary) 15%, 
                  ${activeReqForDetail.headSignature ? '#059669' : '#334155'} 35%, 
                  ${activeReqForDetail.headSignature ? '#059669' : '#334155'} 50%, 
                  ${activeReqForDetail.approverSignature ? '#7e22ce' : '#334155'} 65%, 
                  ${activeReqForDetail.approverSignature ? '#7e22ce' : '#334155'} 80%, 
                  ${activeReqForDetail.receiveDate ? '#10b981' : '#334155'} 100%)`;
              }

              return (
                <div style={{
                  background: 'rgba(241, 245, 249, 0.8)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.75px', color: 'var(--color-secondary)' }}>
                    <Clock size={14} /> Tiến Trình & Nhật Ký Thời Gian
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', padding: '0.5rem 0' }}>
                    
                    {/* Step 1: Lập đề nghị */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24%', textAlign: 'center', zIndex: 1 }}>
                      <div style={{ 
                        width: '30px', 
                        height: '30px', 
                        borderRadius: '50%', 
                        background: 'var(--color-primary)', 
                        color: '#ffffff', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontWeight: 'bold', 
                        fontSize: '0.8rem',
                        border: '3px solid #ffffff',
                        boxShadow: '0 0 10px rgba(13, 148, 136, 0.3)'
                      }}>
                        1
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', marginTop: '0.5rem', color: 'var(--text-main)' }}>Gửi yêu cầu</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'block', lineHeight: '1.2', fontWeight: '500' }}>
                        {new Date(activeReqForDetail.requisitionDate).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    {/* Step 2: Trưởng khoa duyệt */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24%', textAlign: 'center', zIndex: 1 }}>
                      <div style={{ 
                        width: '30px', 
                        height: '30px', 
                        borderRadius: '50%', 
                        background: step2Bg, 
                        color: '#ffffff', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontWeight: 'bold', 
                        fontSize: '0.8rem',
                        border: '3px solid #ffffff',
                        boxShadow: step2BoxShadow
                      }}>
                        2
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', marginTop: '0.5rem', color: step2Color }}>{step2Label}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'block', lineHeight: '1.2', fontWeight: '500' }}>
                        {step2Date}
                      </span>
                      {activeReqForDetail.delegatedBy && (
                        <span style={{ fontSize: '0.58rem', color: '#d97706', display: 'block', marginTop: '0.2rem', fontWeight: '600', lineHeight: '1.2' }}>
                          ✍️ Ký thay: {activeReqForDetail.delegatedTo}<br />
                          (Ủy quyền: {activeReqForDetail.delegatedBy})
                        </span>
                      )}
                    </div>

                    {/* Step 3: Xuất kho */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24%', textAlign: 'center', zIndex: 1 }}>
                      <div style={{ 
                        width: '30px', 
                        height: '30px', 
                        borderRadius: '50%', 
                        background: step3Bg, 
                        color: '#ffffff', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontWeight: 'bold', 
                        fontSize: '0.8rem',
                        border: '3px solid #ffffff',
                        boxShadow: step3BoxShadow
                      }}>
                        3
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', marginTop: '0.5rem', color: step3Color }}>{step3Label}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'block', lineHeight: '1.2', fontWeight: '500' }}>
                        {step3Date}
                      </span>
                    </div>

                    {/* Step 4: Nhận thuốc */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24%', textAlign: 'center', zIndex: 1 }}>
                      <div style={{ 
                        width: '30px', 
                        height: '30px', 
                        borderRadius: '50%', 
                        background: step4Bg, 
                        color: '#ffffff', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontWeight: 'bold', 
                        fontSize: '0.8rem',
                        border: '3px solid #ffffff',
                        boxShadow: step4BoxShadow
                      }}>
                        4
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', marginTop: '0.5rem', color: step4Color }}>{step4Label}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'block', lineHeight: '1.2', fontWeight: '500' }}>
                        {step4Date}
                      </span>
                    </div>

                    {/* Connecting lines */}
                    <div style={{
                      position: 'absolute',
                      top: '15px',
                      left: '12%',
                      right: '12%',
                      height: '2px',
                      background: lineBg,
                      zIndex: 0
                    }} />

                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.88rem' }}>
              <div>
                <p style={{ marginBottom: '0.35rem' }}><strong>Khoa lâm sàng nhận:</strong> {activeReqForDetail.department?.departmentName}</p>
                <p style={{ marginBottom: '0.35rem' }}><strong>Loại phiếu đề nghị:</strong> {activeReqForDetail.requisitionType === 'Regular' ? 'Lĩnh thường quy' : 'Bù tủ trực cấp cứu'}</p>
                <p style={{ marginBottom: '0' }}><strong>Ngày lập phiếu:</strong> {new Date(activeReqForDetail.requisitionDate).toLocaleString('vi-VN')}</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Trạng thái:</span>
                  <span className={`badge-status ${activeReqForDetail.status.toLowerCase()}`}>
                    {activeReqForDetail.status === 'PendingHead' ? 'Chờ Trưởng khoa duyệt' : activeReqForDetail.status === 'Pending' ? 'Chờ kiểm duyệt' : activeReqForDetail.status === 'Approved' ? 'Đã duyệt cấp phát' : 'Đã từ chối'}
                  </span>
                </p>
                {activeReqForDetail.status === 'Rejected' && activeReqForDetail.rejectReason && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#f87171', borderTop: '1px dashed rgba(239, 68, 68, 0.2)', paddingTop: '0.35rem', lineHeight: '1.4' }}>
                    <strong>Lý do từ chối:</strong> {activeReqForDetail.rejectReason}
                  </p>
                )}
              </div>
            </div>

            {activeReqForDetail.status === 'Pending' && (
              <div style={{ 
                background: 'rgba(59, 130, 246, 0.08)', 
                border: '1px solid rgba(59, 130, 246, 0.25)', 
                borderRadius: '8px', 
                padding: '0.6rem 0.8rem', 
                marginBottom: '1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                fontSize: '0.78rem',
                color: 'var(--text-main)',
                lineHeight: '1.4'
              }}>
                <Info size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span>
                  <strong>Hướng dẫn nghiệp vụ cấp phát chi tiết:</strong> Bạn có thể điều chỉnh số lượng thực cấp của từng món cho phù hợp với cơ số hiện có. Hệ thống tự động tính toán <strong>Lô xuất theo nguyên tắc FEFO (Cận hạn xuất trước)</strong> ở cột bên phải tương ứng với số lượng bạn nhập.
                </span>
              </div>
            )}

            {/* PENDING: EDITABLE VIEW */}
            {activeReqForDetail.status === 'Pending' && user?.role === 'pharmacist' ? (
              <div className="table-container" style={{ marginBottom: '1.25rem', maxHeight: '350px', overflowY: 'auto' }}>
                <table style={{ border: '1px solid var(--border-glass)' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <th>Tên hàng / Vật tư</th>
                      <th style={{ textAlign: 'center' }}>ĐVT</th>
                      <th style={{ textAlign: 'center' }}>Đề Nghị</th>
                      <th style={{ textAlign: 'center' }}>Tồn Kho Chẵn</th>
                      <th style={{ textAlign: 'center', width: '110px' }}>Thực Cấp</th>
                      <th>Xem trước phân bổ lô (FEFO Preview)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReqForDetail.details?.map(d => {
                      const maxStock = getMainStoreStockForMedicine(d.medicineID);
                      const currentDispensed = adjustedQuantities[d.requisitionDetailID] ?? d.requestedQuantity;
                      const fefoAlloc = getFefoPreviewForMedicine(d.medicineID, currentDispensed);
                      const isExceeded = currentDispensed > maxStock;

                      return (
                        <tr key={d.requisitionDetailID} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td>
                            <strong>{d.medicine?.medicineName}</strong>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Mã: {d.medicine?.medicineCode}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>{d.medicine?.unit}</td>
                          <td style={{ textAlign: 'center', fontWeight: '600' }}>{d.requestedQuantity}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ 
                              color: maxStock === 0 ? 'var(--color-danger)' : maxStock < d.requestedQuantity ? 'var(--color-warning)' : 'var(--color-success)',
                              fontWeight: '600'
                            }}>
                              {maxStock}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="number" 
                              className="form-input" 
                              style={{ 
                                padding: '0.25rem 0.4rem', 
                                fontSize: '0.85rem', 
                                width: '80px', 
                                textAlign: 'center',
                                border: isExceeded ? '1px solid var(--color-danger)' : '1px solid var(--border-glass)',
                                background: isExceeded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                                color: isExceeded ? '#f87171' : '#ffffff',
                                margin: '0 auto'
                              }}
                              value={currentDispensed}
                              onChange={e => handleQtyChange(d.requisitionDetailID, e.target.value)}
                              min="0"
                            />
                          </td>
                          <td style={{ fontSize: '0.75rem' }}>
                            {isExceeded ? (
                              <span style={{ color: 'var(--color-danger)', fontWeight: '600' }}>⚠️ Vượt quá tồn kho chính!</span>
                            ) : fefoAlloc.length === 0 ? (
                              <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Không cấp phát (SL = 0)</span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                {fefoAlloc.map((alloc, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.15rem 0.3rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                    <span>Lô: <strong>{alloc.batchNumber}</strong></span>
                                    <span style={{ color: 'var(--color-secondary)' }}>SL: <strong>{alloc.take}</strong></span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* HISTORIC READ-ONLY VIEW WITH BOTH COLS */
              <div className="table-container" style={{ marginBottom: '1.25rem' }}>
                <table style={{ border: '1px solid var(--border-glass)' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <th>Tên hàng / Vật tư</th>
                      <th style={{ textAlign: 'center' }}>ĐVT</th>
                      <th style={{ textAlign: 'center' }}>Số lượng Đề Nghị</th>
                      <th style={{ textAlign: 'center' }}>Số lượng Thực Cấp</th>
                      <th>Trạng thái cấp phát</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReqForDetail.details?.map(d => {
                      const isPending = activeReqForDetail.status === 'Pending' || activeReqForDetail.status === 'PendingHead';
                      const dispensed = d.dispensedQuantity ?? d.requestedQuantity;
                      return (
                        <tr key={d.requisitionDetailID}>
                          <td>
                            <strong>{d.medicine?.medicineName}</strong>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mã: {d.medicine?.medicineCode}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>{d.medicine?.unit}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontWeight: '500' }}>{d.requestedQuantity}</td>
                          <td style={{ textAlign: 'center' }}>
                            <strong style={{ 
                              color: isPending 
                                ? 'var(--text-dim)' 
                                : (dispensed === 0 ? 'var(--color-danger)' : dispensed < d.requestedQuantity ? 'var(--color-warning)' : 'var(--color-success)'),
                              fontSize: '1.05rem'
                            }}>
                              {isPending ? '-' : dispensed}
                            </strong>
                          </td>
                          <td>
                            <span className={`badge-status ${isPending ? 'pending' : (dispensed === 0 ? 'rejected' : dispensed < d.requestedQuantity ? 'warning' : 'approved')}`} style={{ textTransform: 'none', fontSize: '0.72rem' }}>
                              {isPending ? 'Chờ phê duyệt' : (dispensed === 0 ? 'Từ chối cấp phát' : dispensed < d.requestedQuantity ? 'Cấp phát một phần' : 'Đã cấp đủ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* TRIPLE SIGNATURES DISPLAY FOR HISTORIC RECORDS */}
            {activeReqForDetail.status !== 'Pending' && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr', 
                gap: '1rem', 
                marginTop: '1.5rem', 
                borderTop: '1px solid var(--border-glass)', 
                paddingTop: '1rem' 
              }}>
                {/* Proposer Signature */}
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  border: '1px solid var(--border-glass)', 
                  borderRadius: '8px', 
                  padding: '0.75rem', 
                  textAlign: 'center' 
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    CHỮ KÝ NGƯỜI LẬP (ĐIỀU DƯỠNG)
                  </div>
                  {activeReqForDetail.digitalSignature ? (
                    <div style={{ height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#ffffff', borderRadius: '4px', padding: '0.25rem' }}>
                      <img src={activeReqForDetail.digitalSignature} alt="Chữ ký điều dưỡng" style={{ maxHeight: '100%', maxWidth: '180px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      Không có chữ ký số
                    </div>
                  )}
                  <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', fontWeight: '500', color: 'var(--text-dim)' }}>
                    {activeReqForDetail.requisitionType === 'CabinetRefill' ? 'Ký duyệt tự động bù tủ' : 'Ký gửi phiếu đề xuất'}
                  </div>
                </div>

                {/* Head Signature (Trưởng khoa) */}
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  border: '1px solid var(--border-glass)', 
                  borderRadius: '8px', 
                  padding: '0.75rem', 
                  textAlign: 'center' 
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    CHỮ KÝ TRƯỞNG KHOA LÂM SÀNG
                  </div>
                  {activeReqForDetail.headSignature ? (
                    <div style={{ height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#ffffff', borderRadius: '4px', padding: '0.25rem' }}>
                      <img src={activeReqForDetail.headSignature} alt="Chữ ký Trưởng khoa" style={{ maxHeight: '100%', maxWidth: '180px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      {activeReqForDetail.status === 'PendingHead' ? 'Chờ Trưởng khoa ký' : 'Không yêu cầu ký'}
                    </div>
                  )}
                  <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', fontWeight: '500', color: 'var(--text-dim)' }}>
                    {activeReqForDetail.headSignature ? (() => {
                      const deptId = activeReqForDetail.departmentID;
                      const deptName = activeReqForDetail.department?.departmentName || '';
                      if (deptId === 2 || String(deptName).toLowerCase().includes('cấp cứu')) return 'BS.CKII. Lê Văn Chương';
                      if (deptId === 1 || String(deptName).toLowerCase().includes('khám bệnh')) return 'BS.CKII. Nguyễn Hữu Lực';
                      if (deptId === 3 || String(deptName).toLowerCase().includes('nội tổng hợp')) return 'BS.CKII. Nguyễn Đăng Đức Anh';
                      if (deptId === 4 || String(deptName).toLowerCase().includes('xét nghiệm')) return 'BS.CKII. Trương Minh Quân';
                      if (deptId === 5 || String(deptName).toLowerCase().includes('đông y')) return 'BS.CKII. Nguyễn Xuân Duy Thắng';
                      return 'Trưởng khoa (Đã Duyệt)';
                    })() : 'Chưa ký'}
                  </div>
                </div>

                {/* Approver Signature */}
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  border: '1px solid var(--border-glass)', 
                  borderRadius: '8px', 
                  padding: '0.75rem', 
                  textAlign: 'center' 
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    {activeReqForDetail.status === 'Rejected' ? 'CHỮ KÝ NGƯỜI TỪ CHỐI (THỦ KHO DƯỢC)' : 'CHỮ KÝ CẤP PHÁT (THỦ KHO DƯỢC)'}
                  </div>
                  {activeReqForDetail.approverSignature ? (
                    <div style={{ height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#ffffff', borderRadius: '4px', padding: '0.25rem' }}>
                      <img src={activeReqForDetail.approverSignature} alt="Chữ ký thủ kho" style={{ maxHeight: '100%', maxWidth: '180px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      {activeReqForDetail.status === 'Rejected' ? 'Không có chữ ký số từ chối' : 'Chờ xuất kho'}
                    </div>
                  )}
                  <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', fontWeight: '500', color: 'var(--text-dim)' }}>
                    {activeReqForDetail.status === 'Approved' 
                      ? 'Dược sĩ Nguyễn Văn Khoa (Đã Duyệt)' 
                      : activeReqForDetail.status === 'Rejected' 
                      ? 'Dược sĩ Nguyễn Văn Khoa (Đã Từ Chối)' 
                      : 'Từ chối cấp phát'}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setActiveReqForDetail(null)}>Đóng</button>
              {activeReqForDetail.status === 'Pending' && user?.role === 'pharmacist' && (
                <>
                  <button className="btn-danger" onClick={() => handleReject(activeReqForDetail.requisitionID)}>Từ chối toàn bộ</button>
                  <button className="btn-premium" onClick={handleApproveClick}>
                    <PenTool size={14} /> Duyệt & Ký Cấp Phát
                  </button>
                </>
              )}
              {activeReqForDetail.status === 'Approved' && (
                <>
                  {!activeReqForDetail.receiveDate && (user?.role === 'nurse' || user?.role === 'head_nurse' || user?.role === 'head') && (
                    <button 
                      className="btn-premium" 
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#10b981', borderColor: '#059669' }}
                      onClick={() => {
                        if (window.confirm("Bạn xác nhận đã nhận bàn giao đầy đủ cơ số thực tế từ Kho Dược?")) {
                          fetch(`/api/requisition/${activeReqForDetail.requisitionID}/receive`, {
                            method: 'POST',
                            headers: {
                              'X-User-Role': user?.role || ''
                            }
                          })
                          .then(async res => {
                            if (!res.ok) {
                              const errText = await res.text();
                              throw new Error(errText || "Không thể xác nhận nhận thuốc.");
                            }
                            return res.json();
                          })
                          .then(() => {
                            alert("Đã xác nhận nhận thuốc thành công!");
                            fetchRequisitions();
                            setActiveReqForDetail(null);
                          })
                          .catch(err => alert("Lỗi khi xác nhận nhận thuốc: " + err.message));
                        }
                      }}
                    >
                      <CheckCircle2 size={14} /> Xác nhận đã nhận thuốc
                    </button>
                  )}
                  <button 
                    className="btn-premium" 
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={() => setActiveReqForPrint(activeReqForDetail)}
                  >
                    <Printer size={14} /> Xem & In hồ sơ (A4)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIRECT TRANSFER DOSSIER MODAL */}
      {activeTransferForDetail && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 900 }}>
          <div className="modal-content" style={{ maxWidth: '750px', padding: '1.5rem', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888', zIndex: 10 }}
              onClick={() => setActiveTransferForDetail(null)}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-glass)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-secondary)', margin: '0 0 0.25rem 0' }}>
                Hồ Sơ Cấp Phát Thuốc & Vật Tư Trực Tiếp
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                (Biên bản bàn giao xuất chuyển kho nội bộ chủ động)
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', marginBottom: '1.5rem', fontSize: '0.88rem', lineHeight: '1.5' }}>
              <div>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>Mã hồ sơ xuất:</strong> #PTX-{activeTransferForDetail.transferID}</p>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>Kho xuất phát:</strong> Kho chẵn chính (Kho Dược)</p>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>Khoa lâm sàng nhận:</strong> {activeTransferForDetail.toDepartment?.departmentName}</p>
                <p style={{ margin: 0 }}><strong>Thời gian xuất chuyển:</strong> {new Date(activeTransferForDetail.transferDate).toLocaleString('vi-VN')}</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ margin: '0 0 0.25rem 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Trạng thái:</span>
                  <span className="badge-status approved" style={{ textTransform: 'none' }}>Đã cấp phát trực tiếp</span>
                </p>
                <p style={{ margin: 0, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nghiệp vụ:</span>
                  <span style={{ color: 'var(--color-secondary)', fontWeight: '600' }}>Cấp phát chủ động</span>
                </p>
              </div>
            </div>

            <div className="table-container" style={{ marginBottom: '1.5rem' }}>
              <table style={{ border: '1px solid var(--border-glass)' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th>Tên hàng / Dược phẩm</th>
                    <th style={{ textAlign: 'center' }}>ĐVT</th>
                    <th style={{ textAlign: 'center' }}>Lô hàng</th>
                    <th style={{ textAlign: 'center' }}>Hạn dùng</th>
                    <th style={{ textAlign: 'center' }}>Số lượng thực cấp</th>
                    <th style={{ textAlign: 'right' }}>Đơn giá</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTransferForDetail.details?.map(d => {
                    const expDate = d.batch?.expiryDate ? new Date(d.batch.expiryDate).toLocaleDateString('vi-VN') : 'N/A';
                    return (
                      <tr key={d.transferDetailID}>
                        <td>
                          <strong>{d.batch?.medicine?.medicineName}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mã: {d.batch?.medicine?.medicineCode}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{d.batch?.medicine?.unit || 'Lần'}</td>
                        <td style={{ textAlign: 'center' }}><strong>{d.batch?.batchNumber}</strong></td>
                        <td style={{ textAlign: 'center' }}>{expDate}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-secondary)' }}>
                            {d.quantity}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{d.batch?.importPrice?.toLocaleString('vi-VN')}đ</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Signature Area */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr', 
              width: '260px',
              marginLeft: 'auto',
              background: 'rgba(255, 255, 255, 0.01)', 
              border: '1px solid var(--border-glass)', 
              borderRadius: '8px', 
              padding: '0.75rem', 
              textAlign: 'center' 
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                NGƯỜI XUẤT CẤP (THỦ KHO DƯỢC)
              </div>
              {activeTransferForDetail.digitalSignature ? (
                <div style={{ height: '85px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#ffffff', borderRadius: '4px', padding: '0.25rem' }}>
                  <img src={activeTransferForDetail.digitalSignature} alt="Chữ ký thủ kho" style={{ maxHeight: '100%', maxWidth: '180px', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ height: '85px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  Không có chữ ký số
                </div>
              )}
              <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', fontWeight: '500', color: 'var(--text-dim)' }}>
                Dược sĩ Nguyễn Văn Khoa
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <button className="btn-secondary" onClick={() => setActiveTransferForDetail(null)}>Đóng</button>
              <button 
                className="btn-premium" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                onClick={() => setActiveTransferForPrint(activeTransferForDetail)}
              >
                <Printer size={14} /> Xem & In biên bản (A4)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL SIGNATURE MODAL FOR PHARMACIST */}
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
              <PenTool size={20} color="var(--color-secondary)" /> {signatureTarget?.action === 'submit_requisition' ? 'Ký Xác Nhận Gửi Phiếu Lĩnh Thuốc' : signatureTarget?.action === 'head_approve_requisition' ? 'Ký Duyệt Phiếu Lĩnh (Trưởng Khoa)' : 'Ký Xác Nhận Cấp Phát Vật Tư'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              {signatureTarget?.action === 'direct_transfer' 
                ? 'Vui lòng vẽ chữ ký tay điện tử để xác nhận xuất chuyển trực tiếp vật tư xuống tủ trực khoa lâm sàng.'
                : signatureTarget?.action === 'reject_requisition'
                ? 'Vui lòng vẽ chữ ký tay điện tử để xác nhận từ chối phiếu lĩnh/yêu cầu bù tủ trực của khoa.'
                : signatureTarget?.action === 'submit_requisition'
                ? 'Vui lòng vẽ chữ ký tay điện tử để xác nhận gửi đề xuất lĩnh thuốc khoa lâm sàng lên Kho Dược.'
                : signatureTarget?.action === 'head_approve_requisition'
                ? 'Vui lòng vẽ chữ ký tay điện tử để xác nhận phê duyệt (ký duyệt) phiếu lĩnh thuốc của khoa lâm sàng.'
                : 'Vui lòng vẽ chữ ký tay điện tử để xác nhận phê duyệt cấp phát cơ số thuốc/vật tư y tế theo phiếu lĩnh.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{signatureTarget?.action === 'submit_requisition' ? (user?.role === 'head_nurse' ? 'Chữ ký Người lập phiếu (Điều dưỡng trưởng khoa)' : 'Chữ ký Người lập phiếu (Điều dưỡng viên)') : signatureTarget?.action === 'head_approve_requisition' ? (user?.role === 'head_nurse' ? 'Chữ ký Điều dưỡng trưởng (Ký thay Trưởng khoa)' : 'Chữ ký Trưởng khoa lâm sàng') : 'Chữ ký Người cấp phát (Thủ kho Dược)'} <span style={{ color: '#ef4444' }}>*</span></span>
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
                onClick={handleConfirmSignature}
              >
                <ThumbsUp size={14} /> {signatureTarget?.action === 'submit_requisition' ? 'Xác nhận & Gửi yêu cầu' : signatureTarget?.action === 'head_approve_requisition' ? 'Phê duyệt & Ký nhận' : 'Xác nhận & Cấp phát'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A4 PRINT PREVIEW: REQUISITION HANDOVER DOSSIER */}
      {activeReqForPrint && (() => {
        const associatedTransfer = internalTransfers.find(t => t.requisitionID === activeReqForPrint.requisitionID);
        const printDate = new Date(activeReqForPrint.requisitionDate);
        return (
          <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.8)', zIndex: 2000 }}>
            <div className="modal-content" style={{ maxWidth: '850px', background: '#ffffff', color: '#000000', padding: '0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              
              {/* Toolbar */}
              <div style={{ background: '#f3f4f6', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Printer size={16} /> Xem trước bản in A4 (Biên bản cấp phát thuốc #REQ-{activeReqForPrint.requisitionID})
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn-secondary" 
                    style={{ background: '#ffffff', color: '#374151', border: '1px solid #d1d5db', padding: '0.35rem 0.75rem', fontSize: '0.8rem', height: '30px' }} 
                    onClick={() => setActiveReqForPrint(null)}
                  >
                    Đóng bản in
                  </button>
                  <button 
                    className="btn-premium" 
                    style={{ background: '#10b981', borderColor: '#059669', color: '#ffffff', padding: '0.35rem 1rem', fontSize: '0.8rem', height: '30px', fontWeight: '600' }} 
                    onClick={() => {
                      const printContents = document.getElementById('printable-requisition-invoice').innerHTML;
                      const originalContents = document.body.innerHTML;
                      document.body.innerHTML = printContents;
                      window.print();
                      window.location.reload();
                    }}
                  >
                    Xác nhận in ấn (A4)
                  </button>
                </div>
              </div>

              {/* Printable Page Body */}
              <div style={{ padding: '2.5rem', maxHeight: '75vh', overflowY: 'auto', background: '#fff' }}>
                <div id="printable-requisition-invoice" style={{ fontFamily: '"Times New Roman", Times, serif', color: '#000000', padding: '1rem', lineHeight: '1.4', fontSize: '14px' }}>
                  
                  {/* National Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div style={{ textAlign: 'center', width: '40%' }}>
                      <h4 style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>BỆNH VIỆN TRUNG ƯƠNG</h4>
                      <h4 style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>KHOA DƯỢC</h4>
                      <div style={{ width: '60px', borderBottom: '1px solid #000000', margin: '0.3rem auto 0 auto' }}></div>
                      <p style={{ margin: '0.4rem 0 0 0', fontSize: '12px', fontStyle: 'italic' }}>Số: REQ-{activeReqForPrint.requisitionID}</p>
                    </div>
                    <div style={{ textAlign: 'center', width: '55%' }}>
                      <h4 style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
                      <h4 style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', fontSize: '13px' }}>Độc lập - Tự do - Hạnh phúc</h4>
                      <div style={{ width: '120px', borderBottom: '1px dashed #000000', margin: '0.3rem auto 0 auto' }}></div>
                    </div>
                  </div>

                  {/* Document Title */}
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: '0 0 0.3rem 0', fontWeight: 'bold', fontSize: '18px', textTransform: 'uppercase' }}>BIÊN BẢN GIAO NHẬN THUỐC & VẬT TƯ Y TẾ</h2>
                    <p style={{ margin: 0, fontSize: '13px', fontStyle: 'italic' }}>
                      (Cấp phát theo phiếu lĩnh thuốc số: REQ-{activeReqForPrint.requisitionID} - Loại: {activeReqForPrint.requisitionType === 'Regular' ? 'Thường quy' : activeReqForPrint.requisitionType === 'Urgent' ? 'Lĩnh khẩn (Khẩn cấp)' : 'Bù tủ trực'})
                    </p>
                  </div>

                  {/* Introduction */}
                  <div style={{ marginBottom: '1rem', fontSize: '14px' }}>
                    <p style={{ margin: '0 0 0.4rem 0', textIndent: '20px' }}>
                      Hôm nay, ngày {printDate.getDate()} tháng {printDate.getMonth() + 1} năm {printDate.getFullYear()}, tại Kho Dược chính bệnh viện, chúng tôi gồm:
                    </p>
                    <table style={{ width: '100%', border: 'none', margin: '0.2rem 0 0.5rem 0', fontSize: '14px' }}>
                      <tbody>
                        <tr>
                          <td style={{ width: '50%', padding: '0.15rem 0' }}><strong>1. Bên giao (Kho Dược):</strong> Dược sĩ Nguyễn Văn Khoa</td>
                          <td style={{ width: '50%', padding: '0.15rem 0' }}>Chức vụ: Thủ kho Dược chính</td>
                        </tr>
                        <tr>
                          <td style={{ width: '50%', padding: '0.15rem 0' }}><strong>2. Bên nhận (Khoa lâm sàng):</strong> Đại diện Điều dưỡng Khoa</td>
                          <td style={{ width: '50%', padding: '0.15rem 0' }}>Khoa/phòng nhận: {activeReqForPrint.department?.departmentName}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p style={{ margin: '0.4rem 0 0.8rem 0', textIndent: '20px' }}>
                      Hai bên đã tiến hành giao nhận thực tế cơ số dược phẩm, vật tư y tế quy chuẩn theo phiếu lĩnh đã được phê duyệt, chi tiết như sau:
                    </p>
                  </div>

                  {/* Items Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', marginBottom: '1.25rem', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f2f2f2', fontWeight: 'bold' }}>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.2rem', textAlign: 'center', width: '5%' }}>STT</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.3rem', textAlign: 'left', width: '35%' }}>Tên thuốc / Quy cách vật tư y tế</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.2rem', textAlign: 'center', width: '8%' }}>ĐVT</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.3rem', textAlign: 'center', width: '12%' }}>Số lô xuất</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.3rem', textAlign: 'center', width: '12%' }}>Hạn dùng</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.2rem', textAlign: 'center', width: '8%' }}>SL Yêu cầu</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.2rem', textAlign: 'center', width: '8%' }}>SL Thực cấp</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.3rem', textAlign: 'right', width: '12%' }}>Đơn giá thầu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {associatedTransfer && associatedTransfer.details && associatedTransfer.details.length > 0 ? (
                        associatedTransfer.details.map((d, index) => {
                          const reqDetail = activeReqForPrint.details.find(rd => rd.medicineID === d.batch?.medicineID);
                          const reqQty = reqDetail ? reqDetail.requestedQuantity : '-';
                          const expStr = d.batch?.expiryDate ? new Date(d.batch.expiryDate).toLocaleDateString('vi-VN') : 'N/A';
                          return (
                            <tr key={d.transferDetailID}>
                              <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center' }}>{index + 1}</td>
                              <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'left' }}><strong>{d.batch?.medicine?.medicineName}</strong></td>
                              <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center' }}>{d.batch?.medicine?.unit}</td>
                              <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'center' }}>{d.batch?.batchNumber}</td>
                              <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'center' }}>{expStr}</td>
                              <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center' }}>{reqQty}</td>
                              <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center', fontWeight: 'bold' }}>{d.quantity}</td>
                              <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'right' }}>{d.batch?.importPrice?.toLocaleString('vi-VN')}đ</td>
                            </tr>
                          );
                        })
                      ) : (
                        activeReqForPrint.details?.map((d, index) => (
                          <tr key={d.requisitionDetailID}>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center' }}>{index + 1}</td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'left' }}><strong>{d.medicine?.medicineName}</strong></td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center' }}>{d.medicine?.unit}</td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>Không có thông tin lô</td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>N/A</td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center' }}>{d.requestedQuantity}</td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center', fontWeight: 'bold' }}>{d.dispensedQuantity ?? d.requestedQuantity}</td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'right', color: '#666', fontStyle: 'italic' }}>Chờ xuất kho</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Notes & Conclusion */}
                  <div style={{ marginBottom: '1.5rem', fontSize: '13.5px' }}>
                    <p style={{ margin: '0 0 0.3rem 0', fontStyle: 'italic' }}>
                      * Ý kiến cảm quan về lô giao nhận: Bao bì nguyên vẹn, nhãn mác đúng quy chế, chất lượng cảm quan đạt yêu cầu chuyên môn.
                    </p>
                    <p style={{ margin: '0 0 0.3rem 0', fontStyle: 'italic' }}>
                      * Biên bản được lập thành 02 bản có giá trị pháp lý tương đương, mỗi bên giữ 01 bản để làm căn cứ thẻ kho vật lý.
                    </p>
                  </div>

                  {/* Signatures Section */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '0.75rem', textAlign: 'center', marginTop: '2rem', fontSize: '12px', pageBreakInside: 'avoid' }}>
                    
                    {/* Receiver */}
                    <div>
                      <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', textTransform: 'uppercase' }}>ĐIỀU DƯỠNG TIẾP NHẬN</p>
                      <p style={{ margin: '0 0 0.5rem 0', color: '#555', fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</p>
                      <div style={{ height: '70px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0.5rem 0' }}>
                        {activeReqForPrint.digitalSignature ? (
                          <img src={activeReqForPrint.digitalSignature} alt="Chữ ký nhận" style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ color: '#888', fontStyle: 'italic', fontSize: '10px' }}>Ký số tự động</span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>Trần Thị Hồng</p>
                    </div>

                    {/* Trưởng khoa Lâm sàng */}
                    <div>
                      <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', textTransform: 'uppercase' }}>TRƯỞNG KHOA LÂM SÀNG</p>
                      <p style={{ margin: '0 0 0.5rem 0', color: '#555', fontStyle: 'italic' }}>(Ký duyệt hoặc Ký thay)</p>
                      <div style={{ height: '70px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0.5rem 0' }}>
                        {activeReqForPrint.headSignature ? (
                          <img src={activeReqForPrint.headSignature} alt="Chữ ký Trưởng khoa" style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ color: '#888', fontStyle: 'italic', fontSize: '10px' }}>Chờ ký duyệt</span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>{(() => {
                        const deptId = activeReqForPrint.departmentID;
                        const deptName = activeReqForPrint.department?.departmentName || '';
                        if (deptId === 2 || String(deptName).toLowerCase().includes('cấp cứu')) return 'BS.CKII. Lê Văn Chương';
                        if (deptId === 1 || String(deptName).toLowerCase().includes('khám bệnh')) return 'BS.CKII. Nguyễn Hữu Lực';
                        if (deptId === 3 || String(deptName).toLowerCase().includes('nội tổng hợp')) return 'BS.CKII. Nguyễn Đăng Đức Anh';
                        if (deptId === 4 || String(deptName).toLowerCase().includes('xét nghiệm')) return 'BS.CKII. Trương Minh Quân';
                        if (deptId === 5 || String(deptName).toLowerCase().includes('đông y')) return 'BS.CKII. Nguyễn Xuân Duy Thắng';
                        return 'Trưởng khoa';
                      })()}</p>
                    </div>

                    {/* Dispenser */}
                    <div>
                      <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', textTransform: 'uppercase' }}>THỦ KHO CẤP PHÁT</p>
                      <p style={{ margin: '0 0 0.5rem 0', color: '#555', fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</p>
                      <div style={{ height: '70px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0.5rem 0' }}>
                        {activeReqForPrint.approverSignature ? (
                          <img src={activeReqForPrint.approverSignature} alt="Chữ ký giao" style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ color: '#888', fontStyle: 'italic', fontSize: '11px' }}>Chờ ký duyệt</span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>Nguyễn Văn Khoa</p>
                    </div>

                    {/* Chief / Director */}
                    <div>
                      <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', textTransform: 'uppercase' }}>TRƯỞNG KHOA DƯỢC / LÃNH ĐẠO</p>
                      <p style={{ margin: '0 0 0.5rem 0', color: '#555', fontStyle: 'italic' }}>(Ký duyệt điện tử, đóng dấu)</p>
                      <div style={{ height: '70px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0.5rem 0', fontSize: '11px', color: '#059669', border: '1px dashed #a7f3d0', borderRadius: '4px', background: '#f0fdf4' }}>
                        <strong>ĐÃ DUYỆT ĐIỆN TỬ</strong>
                        <br />
                        Bởi Khoa Dược
                      </div>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>PGS.TS. Lê Minh Dược</p>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* A4 PRINT PREVIEW: DIRECT TRANSFER INVOICE */}
      {activeTransferForPrint && (() => {
        const printDate = new Date(activeTransferForPrint.transferDate);
        return (
          <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.8)', zIndex: 2000 }}>
            <div className="modal-content" style={{ maxWidth: '850px', background: '#ffffff', color: '#000000', padding: '0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
              
              {/* Toolbar */}
              <div style={{ background: '#f3f4f6', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Printer size={16} /> Xem trước bản in A4 (Biên bản xuất chuyển kho trực tiếp #PTX-{activeTransferForPrint.transferID})
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn-secondary" 
                    style={{ background: '#ffffff', color: '#374151', border: '1px solid #d1d5db', padding: '0.35rem 0.75rem', fontSize: '0.8rem', height: '30px' }} 
                    onClick={() => setActiveTransferForPrint(null)}
                  >
                    Đóng bản in
                  </button>
                  <button 
                    className="btn-premium" 
                    style={{ background: '#10b981', borderColor: '#059669', color: '#ffffff', padding: '0.35rem 1rem', fontSize: '0.8rem', height: '30px', fontWeight: '600' }} 
                    onClick={() => {
                      const printContents = document.getElementById('printable-direct-invoice').innerHTML;
                      const originalContents = document.body.innerHTML;
                      document.body.innerHTML = printContents;
                      window.print();
                      window.location.reload();
                    }}
                  >
                    Xác nhận in ấn (A4)
                  </button>
                </div>
              </div>

              {/* Printable Page Body */}
              <div style={{ padding: '2.5rem', maxHeight: '75vh', overflowY: 'auto', background: '#fff' }}>
                <div id="printable-direct-invoice" style={{ fontFamily: '"Times New Roman", Times, serif', color: '#000000', padding: '1rem', lineHeight: '1.4', fontSize: '14px' }}>
                  
                  {/* National Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div style={{ textAlign: 'center', width: '40%' }}>
                      <h4 style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>BỆNH VIỆN TRUNG ƯƠNG</h4>
                      <h4 style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>KHOA DƯỢC</h4>
                      <div style={{ width: '60px', borderBottom: '1px solid #000000', margin: '0.3rem auto 0 auto' }}></div>
                      <p style={{ margin: '0.4rem 0 0 0', fontSize: '12px', fontStyle: 'italic' }}>Số: PTX-{activeTransferForPrint.transferID}</p>
                    </div>
                    <div style={{ textAlign: 'center', width: '55%' }}>
                      <h4 style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
                      <h4 style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', fontSize: '13px' }}>Độc lập - Tự do - Hạnh phúc</h4>
                      <div style={{ width: '120px', borderBottom: '1px dashed #000000', margin: '0.3rem auto 0 auto' }}></div>
                    </div>
                  </div>

                  {/* Document Title */}
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: '0 0 0.3rem 0', fontWeight: 'bold', fontSize: '18px', textTransform: 'uppercase' }}>BIÊN BẢN XUẤT CHUYỂN KHO NỘI BỘ</h2>
                    <p style={{ margin: 0, fontSize: '13px', fontStyle: 'italic' }}>
                      (Chủ động cấp phát thuốc/vật tư xuống tủ trực - Số phiếu: PTX-{activeTransferForPrint.transferID})
                    </p>
                  </div>

                  {/* Introduction */}
                  <div style={{ marginBottom: '1rem', fontSize: '14px' }}>
                    <p style={{ margin: '0 0 0.4rem 0', textIndent: '20px' }}>
                      Hôm nay, ngày {printDate.getDate()} tháng {printDate.getMonth() + 1} năm {printDate.getFullYear()}, tại Kho Dược chính, chúng tôi đã hoàn tất thủ tục bàn giao cơ số thuốc và vật tư y tế xuất chuyển nội bộ trực tiếp:
                    </p>
                    <table style={{ width: '100%', border: 'none', margin: '0.2rem 0 0.5rem 0', fontSize: '14px' }}>
                      <tbody>
                        <tr>
                          <td style={{ width: '50%', padding: '0.15rem 0' }}><strong>Nguồn xuất chuyển:</strong> Kho chẵn chính (Kho Dược)</td>
                          <td style={{ width: '50%', padding: '0.15rem 0' }}><strong>Khoa lâm sàng nhận:</strong> Khoa {activeTransferForPrint.toDepartment?.departmentName}</td>
                        </tr>
                        <tr>
                          <td style={{ width: '50%', padding: '0.15rem 0' }}><strong>Người lập phiếu (Xuất cấp):</strong> Dược sĩ Nguyễn Văn Khoa</td>
                          <td style={{ width: '50%', padding: '0.15rem 0' }}><strong>Chức vụ:</strong> Thủ kho Dược chính</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Items Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', marginBottom: '1.25rem', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f2f2f2', fontWeight: 'bold' }}>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.2rem', textAlign: 'center', width: '5%' }}>STT</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.3rem', textAlign: 'left', width: '40%' }}>Tên thuốc / Quy cách vật tư y tế</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.2rem', textAlign: 'center', width: '10%' }}>ĐVT</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.3rem', textAlign: 'center', width: '15%' }}>Số lô</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.3rem', textAlign: 'center', width: '15%' }}>Hạn dùng</th>
                        <th style={{ border: '1px solid #000000', padding: '0.4rem 0.2rem', textAlign: 'center', width: '15%' }}>Số lượng xuất chuyển</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeTransferForPrint.details?.map((d, index) => {
                        const expStr = d.batch?.expiryDate ? new Date(d.batch.expiryDate).toLocaleDateString('vi-VN') : 'N/A';
                        return (
                          <tr key={d.transferDetailID}>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center' }}>{index + 1}</td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'left' }}><strong>{d.batch?.medicine?.medicineName}</strong></td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center' }}>{d.batch?.medicine?.unit || 'Lần'}</td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'center' }}>{d.batch?.batchNumber}</td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.3rem', textAlign: 'center' }}>{expStr}</td>
                            <td style={{ border: '1px solid #000000', padding: '0.35rem 0.2rem', textAlign: 'center', fontWeight: 'bold' }}>{d.quantity}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Notes */}
                  <div style={{ marginBottom: '2rem', fontSize: '13px', fontStyle: 'italic' }}>
                    <p style={{ margin: '0 0 0.3rem 0' }}>
                      * Lưu ý nghiệp vụ: Hệ thống đã trừ tồn chẵn chính và cộng tồn tủ trực tương ứng tại tủ trực tiếp nhận để phục vụ giường bệnh ngoài giờ.
                    </p>
                    <p style={{ margin: 0 }}>
                      * Yêu cầu điều dưỡng khoa nhận thuốc thực hiện đối chiếu vật lý thực tế tại tủ và ký nhận sổ tay theo dõi.
                    </p>
                  </div>

                  {/* Signatures Section */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', textAlign: 'center', marginTop: '2.5rem', fontSize: '13.5px', pageBreakInside: 'avoid' }}>
                    
                    {/* Receiver */}
                    <div>
                      <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', textTransform: 'uppercase' }}>ĐẠI DIỆN KHOA LÂM SÀNG NHẬN</p>
                      <p style={{ margin: '0 0 0.5rem 0', color: '#555', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên khi nhận thuốc)</p>
                      <div style={{ height: '75px', borderBottom: '1px dashed #888', width: '200px', margin: '0.5rem auto 2.5rem auto' }}></div>
                      <p style={{ margin: 0, color: '#888', fontStyle: 'italic' }}>(Tập thể điều dưỡng khoa)</p>
                    </div>

                    {/* Dispenser */}
                    <div>
                      <p style={{ margin: '0 0 0.2rem 0', fontWeight: 'bold', textTransform: 'uppercase' }}>THỦ KHO XUẤT CHUYỂN</p>
                      <p style={{ margin: '0 0 0.5rem 0', color: '#555', fontStyle: 'italic' }}>(Ký và ghi rõ họ tên)</p>
                      <div style={{ height: '75px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0.5rem auto' }}>
                        {activeTransferForPrint.digitalSignature ? (
                          <img src={activeTransferForPrint.digitalSignature} alt="Chữ ký thủ kho" style={{ maxHeight: '100%', maxWidth: '120px', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ color: '#888', fontStyle: 'italic', fontSize: '11px' }}>Không có chữ ký số</span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontWeight: 'bold' }}>Nguyễn Văn Khoa</p>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* NURSE CREATE REQUISITION MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 900 }}>
          <div className="modal-content" style={{ maxWidth: '650px', padding: '2rem', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888', zIndex: 10 }}
              onClick={() => setShowCreateModal(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PlusCircle size={20} color={requisitionType === 'Urgent' ? 'var(--color-danger)' : 'var(--color-primary)'} /> 
              Lập Phiếu Đề Nghị Lĩnh Thuốc {requisitionType === 'Urgent' ? 'KHẨN CẤP ⚡' : 'Thường Quy'}
            </h3>
            
            <form onSubmit={handleSubmitRequisition}>
              <div className="form-group" style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                <label className="form-label">Phân loại lĩnh thuốc</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.35rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                    <input 
                      type="radio" 
                      name="requisitionType" 
                      value="Regular" 
                      checked={requisitionType === 'Regular'} 
                      onChange={() => setRequisitionType('Regular')} 
                    />
                    Lĩnh Thường Quy (Định kỳ)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: '#f87171', fontSize: '0.85rem', fontWeight: '600' }}>
                    <input 
                      type="radio" 
                      name="requisitionType" 
                      value="Urgent" 
                      checked={requisitionType === 'Urgent'} 
                      onChange={() => setRequisitionType('Urgent')} 
                    />
                    🚨 Lĩnh Khẩn Cấp (Ưu tiên duyệt)
                  </label>
                </div>
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContext: 'space-between', alignItems: 'center', marginBottom: '1rem', justifyContent: 'space-between' }}>
                  <h4 style={{ color: 'var(--text-muted)', margin: 0 }}>Danh mục thuốc cần lĩnh</h4>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                    onClick={handleAddReqRow}
                  >
                    <PlusCircle size={14} /> Thêm dòng
                  </button>
                </div>

                {requisitionItems.map((item, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '12px',
                    padding: '1rem',
                    marginBottom: '1rem',
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: '2.5fr 1fr',
                    gap: '1rem',
                    alignItems: 'end'
                  }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Chọn thuốc / dược chất</label>
                      <select 
                        className="form-input" 
                        value={item.medicineID} 
                        onChange={e => handleReqItemChange(idx, 'medicineID', e.target.value)}
                        required
                      >
                        <option value="">-- Chọn thuốc trong danh mục --</option>
                        {allMedicines.map(m => (
                          <option key={m.medicineID} value={m.medicineID}>
                            {m.medicineName} ({m.specification || 'Quy cách'} - {m.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Số lượng lĩnh</label>
                      <input 
                        type="number" 
                        min="1"
                        step="1"
                        className="form-input" 
                        placeholder="VD: 10"
                        value={item.requestedQuantity} 
                        onChange={e => handleReqItemChange(idx, 'requestedQuantity', e.target.value)}
                        required
                      />
                    </div>

                    {requisitionItems.length > 1 && (
                      <button 
                        type="button" 
                        className="btn-danger" 
                        style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', padding: '0.25rem', borderRadius: '6px' }}
                        onClick={() => handleRemoveReqRow(idx)}
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Hủy</button>
                <button type="submit" className="btn-premium" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Send size={14} /> Ký & Gửi Phiếu Lĩnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
