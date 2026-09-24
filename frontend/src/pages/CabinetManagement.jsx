import React, { useState, useEffect, useRef } from 'react';
import { 
  Layers, User, PlusCircle, RefreshCw, Send, CheckSquare, X, 
  PenTool, Eraser, ThumbsUp, ShieldAlert, Sparkles, CheckCircle2, 
  AlertCircle, Stethoscope, Search, AlertTriangle, Monitor, Clock, 
  Building2, PackageCheck, FileSpreadsheet 
} from 'lucide-react';
import { handleIntegerKeyDown, sanitizeInteger, handleIntegerPaste } from '../utils/numberInputUtils';
import BreakageReportModal from '../components/BreakageReportModal';
import BreakageReportList from '../components/BreakageReportList';
import { exportExcelReport } from '../utils/excelExportHelper';

export default function CabinetManagement({ user }) {
  const isSupervisor = user?.role === 'director' || user?.role === 'pharmacist' || user?.role === 'pharmacist_admin';
  const isReadOnly = isSupervisor || user?.role === 'dispensary';
  const isPharmacist = user?.role === 'dispensary' || user?.role === 'pharmacist';

  const authHeaders = {
    'X-User-Role': user?.role || '',
    'X-User-DeptID': user?.departmentID ? user.departmentID.toString() : '',
    'X-User-FullName': encodeURIComponent(user?.fullName || '')
  };

  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [cabinetStocks, setCabinetStocks] = useState([]);
  const [cabinetSearchTerm, setCabinetSearchTerm] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Supervisor-specific states
  const [supervisorTab, setSupervisorTab] = useState('stocks'); // 'stocks' or 'history'
  const [supervisorFilter, setSupervisorFilter] = useState('all'); // 'all', 'expiring', 'special'

  // Selective Refill States
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [pendingRefillMedicines, setPendingRefillMedicines] = useState([]);
  const [selectedMedicineIds, setSelectedMedicineIds] = useState([]);

  // Breakage Report States
  const [showBreakageModal, setShowBreakageModal] = useState(false);
  const [activeCabinetTab, setActiveCabinetTab] = useState('stocks'); // 'stocks' or 'breakage'

  // Patient Export Form State
  const [patientCode, setPatientCode] = useState('');
  const [patientName, setPatientName] = useState('');
  const [exportItems, setExportItems] = useState([{ batchID: '', quantity: '' }]);
  const [exporting, setExporting] = useState(false);

  // Patient Auto-Lookup & Order Auto-fill State
  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
  const [selectedPatientOrder, setSelectedPatientOrder] = useState(null);
  const [autoFillNotice, setAutoFillNotice] = useState(null);
  const patientDropdownRef = useRef(null);

  // Fetch patient suggestions on department change
  const fetchPatientSuggestions = (query = '') => {
    fetch(`/api/cabinet/lookup-patient?query=${encodeURIComponent(query)}&departmentId=${selectedDept || 0}`)
      .then(res => res.json())
      .then(data => {
        setPatientSuggestions(data || []);
      })
      .catch(err => console.error("Error looking up patients:", err));
  };

  useEffect(() => {
    if (selectedDept) {
      fetchPatientSuggestions('');
    }
  }, [selectedDept]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target)) {
        setShowPatientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Automatically fill patient info and map medical orders to cabinet stock
  const applyPatientData = (p) => {
    if (!p) return;
    setPatientCode(p.patientCode);
    setPatientName(p.patientName);
    setSelectedPatientOrder(p);
    setShowPatientSuggestions(false);

    if (p.medicines && p.medicines.length > 0) {
      const mappedItems = [];
      const notInCabinet = [];

      p.medicines.forEach(m => {
        // Find batch in cabinet matching this medicine and has positive quantity
        const stock = cabinetStocks.find(s => s.batch?.medicineID === m.medicineID && s.currentQuantity > 0);
        if (stock) {
          mappedItems.push({
            batchID: stock.batchID.toString(),
            quantity: Math.min(m.requestedQuantity || 1, stock.currentQuantity).toString()
          });
        } else {
          notInCabinet.push(m.medicineName);
        }
      });

      if (mappedItems.length > 0) {
        setExportItems(mappedItems);
        setAutoFillNotice({
          type: 'success',
          text: `Đã tự động nhận diện hồ sơ bệnh nhân và nạp ${mappedItems.length} loại thuốc theo y lệnh của ${p.doctorName || 'Bác sĩ điều trị'}.`,
          missing: notInCabinet.length > 0 ? notInCabinet : null
        });
      } else {
        setAutoFillNotice({
          type: 'warning',
          text: `Đã điền thông tin bệnh nhân, nhưng các thuốc trong y lệnh hiện không có sẵn trong tủ trực của khoa.`,
          missing: notInCabinet
        });
      }
    } else {
      setAutoFillNotice({
        type: 'info',
        text: `Đã nhận diện hồ sơ bệnh nhân: ${p.patientName}. Vui lòng chọn thuốc trong tủ trực cần cấp.`,
        missing: null
      });
    }
  };

  const handlePatientCodeChange = (val) => {
    setPatientCode(val);
    setAutoFillNotice(null);
    if (!val.trim()) {
      setShowPatientSuggestions(false);
      setSelectedPatientOrder(null);
      return;
    }
    setShowPatientSuggestions(true);
    fetchPatientSuggestions(val.trim());

    // Check if exact match exists in current suggestions
    const exact = patientSuggestions.find(p => p.patientCode.toLowerCase() === val.trim().toLowerCase());
    if (exact) {
      applyPatientData(exact);
    }
  };

  useEffect(() => {
    fetch('/api/requisition/departments', { headers: authHeaders })
      .then(res => res.json())
      .then(data => {
        setDepartments(data);
        if (!isSupervisor && user?.departmentID) {
          setSelectedDept(user.departmentID.toString());
        } else if (user?.departmentID) {
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
      fetch(`/api/cabinet/stocks/${deptId}`, { headers: authHeaders }).then(res => res.json()),
      fetch(`/api/cabinet/transactions/${deptId}`, { headers: authHeaders }).then(res => res.json())
    ])
    .then(([stocksData, txsData]) => {
      setCabinetStocks(Array.isArray(stocksData) ? stocksData : []);
      setTransactions(Array.isArray(txsData) ? txsData : []);
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
        'X-User-Role': user?.role || '',
        'X-User-FullName': encodeURIComponent(user?.fullName || '')
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
      setSelectedPatientOrder(null);
      setAutoFillNotice(null);
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

  const handleExportCabinetStocks = async () => {
    if (!cabinetStocks || cabinetStocks.length === 0) {
      alert("Không có dữ liệu tồn tủ trực để xuất.");
      return;
    }
    const headers = [
      "Thuốc / Hóa Chất / Vật Tư",
      "Số Lô Sản Xuất",
      "Hạn Dùng (HSD)",
      "Tồn Tủ Trực",
      "Đơn Giá Nhập",
      "Trạng Thái Sử Dụng"
    ];
    const rows = cabinetStocks.map(stock => [
      stock.batch?.medicine?.medicineName || '',
      stock.batch?.batchNumber || '',
      new Date(stock.batch?.expiryDate).toLocaleDateString('vi-VN'),
      Number(stock.currentQuantity) || 0,
      Number(stock.batch?.importPrice) || 0,
      stock.batch?.status || 'Bình thường'
    ]);

    try {
      await exportExcelReport({
        fileName: `Ton_kho_tu_truc_${currentDeptName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'Tồn tủ trực',
        departmentName: currentDeptName,
        reportTitle: `BÁO CÁO CƠ SỐ TỒN KHO TỦ TRỰC LÂM SÀNG - ${currentDeptName.toUpperCase()}`,
        subtitle: `Khoa lâm sàng: ${currentDeptName} | Tổng số mặt hàng: ${cabinetStocks.length} loại`,
        creator: user?.fullName || user?.username || 'Cán bộ Y tế',
        headers,
        rows,
        includeIndex: true,
        showSignatures: true
      });
    } catch (err) {
      console.error('Lỗi xuất Excel:', err);
      alert('Không thể xuất báo cáo Excel: ' + err.message);
    }
  };

  const handleExportTransactions = async () => {
    if (!transactions || transactions.length === 0) {
      alert("Không có nhật ký xuất tủ trực nào để xuất.");
      return;
    }
    const headers = [
      "Tên Bệnh Nhân",
      "Mã Hồ Sơ / BA",
      "Thuốc Cấp Phát",
      "Số Lượng Xuất",
      "Số Lô",
      "Thời Gian Cấp",
      "Trạng Thái Bù Tủ"
    ];
    const rows = transactions.map(tx => [
      tx.patientName || '',
      tx.patientCode || '',
      tx.batch?.medicine?.medicineName || '',
      Number(tx.quantity) || 0,
      tx.batch?.batchNumber || '',
      new Date(tx.transactionDate).toLocaleString('vi-VN'),
      !tx.requisition 
        ? 'Chưa bù' 
        : tx.requisition.status === 'Pending' 
        ? 'Chờ duyệt bù' 
        : tx.requisition.status === 'Approved' 
        ? 'Đã bù tủ' 
        : 'Bị từ chối'
    ]);

    try {
      await exportExcelReport({
        fileName: `Nhat_ky_xuat_tu_truc_${currentDeptName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`,
        sheetName: 'Nhật ký xuất tủ',
        departmentName: currentDeptName,
        reportTitle: `BÁO CÁO NHẬT KÝ CẤP PHÁT THUỐC TỦ TRỰC - ${currentDeptName.toUpperCase()}`,
        subtitle: `Khoa lâm sàng: ${currentDeptName} | Tổng số lượt cấp: ${transactions.length} lượt`,
        creator: user?.fullName || user?.username || 'Cán bộ Y tế',
        headers,
        rows,
        includeIndex: true,
        showSignatures: true
      });
    } catch (err) {
      console.error('Lỗi xuất Excel:', err);
      alert('Không thể xuất báo cáo Excel: ' + err.message);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalStockItems = cabinetStocks.length;
  const totalQuantity = cabinetStocks.reduce((sum, s) => sum + (Number(s.currentQuantity) || 0), 0);
  const totalValue = cabinetStocks.reduce((sum, s) => sum + ((Number(s.currentQuantity) || 0) * (Number(s.batch?.importPrice) || 0)), 0);

  const expiringSoonCount = cabinetStocks.filter(s => {
    if (!s.batch?.expiryDate) return false;
    const exp = new Date(s.batch.expiryDate);
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 90;
  }).length;

  const expiredCount = cabinetStocks.filter(s => {
    if (!s.batch?.expiryDate) return false;
    const exp = new Date(s.batch.expiryDate);
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    return diffDays <= 0;
  }).length;

  const specialDrugsCount = cabinetStocks.filter(s => 
    s.batch?.medicine?.drugClassification === 'NarcoticPsychotropic' || 
    s.batch?.medicine?.drugClassification === 'SpecialAntibiotic' ||
    s.batch?.medicine?.priorityLevel === 'Critical'
  ).length;

  const filteredStocks = cabinetStocks.filter(stock => {
    if (cabinetSearchTerm.trim()) {
      const q = cabinetSearchTerm.toLowerCase().trim();
      const name = (stock.batch?.medicine?.medicineName || '').toLowerCase();
      const batch = (stock.batch?.batchNumber || '').toLowerCase();
      const code = (stock.batch?.medicine?.medicineCode || '').toLowerCase();
      const generic = (stock.batch?.medicine?.genericName || '').toLowerCase();
      if (!name.includes(q) && !batch.includes(q) && !code.includes(q) && !generic.includes(q)) {
        return false;
      }
    }
    if (isReadOnly && supervisorFilter === 'expiring') {
      if (!stock.batch?.expiryDate) return false;
      const exp = new Date(stock.batch.expiryDate);
      const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      return diffDays <= 90;
    }
    if (isReadOnly && supervisorFilter === 'special') {
      return stock.batch?.medicine?.drugClassification === 'NarcoticPsychotropic' || 
             stock.batch?.medicine?.drugClassification === 'SpecialAntibiotic' ||
             stock.batch?.medicine?.priorityLevel === 'Critical';
    }
    return true;
  });

  return (
    <div className="cabinet-management">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">
            {isSupervisor ? 'Tra Cứu Tồn Kho Tủ Thuốc Từng Khoa' : (isReadOnly ? 'Giám Sát Tủ Thuốc Khoa Lâm Sàng' : 'Tủ Trực Khoa Lâm Sàng')}
          </h1>
          <p className="page-subtitle">
            {isSupervisor 
              ? 'Theo dõi chi tiết danh mục thuốc, số lô, hạn dùng và số lượng tồn hiện có tại tủ trực của từng khoa phòng (Chế độ tra cứu tồn kho).'
              : (isReadOnly 
                  ? 'Theo dõi cơ số tủ thuốc các khoa phòng và đối chiếu nhật ký xuất dùng.'
                  : 'Nhập xuất tủ trực ngoài giờ, lập biên bản hư hao/vỡ hỏng và đề nghị bù cơ số về khoa Dược.')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isReadOnly && user?.role !== 'head' && (
            <button
              className="btn-danger"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                fontSize: '0.82rem',
                background: '#dc2626',
                color: '#fff',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600'
              }}
              onClick={() => setShowBreakageModal(true)}
            >
              <AlertTriangle size={15} /> Báo Cáo Đổ Vỡ / Hư Hao
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label className="form-label" style={{ margin: 0, textTransform: 'none', fontWeight: '600' }}>Khoa lâm sàng:</label>
            <select 
              className="form-input" 
              style={{
                minWidth: '220px',
                fontWeight: '500',
                cursor: (!isSupervisor && !!user?.departmentID) ? 'not-allowed' : 'pointer',
                opacity: (!isSupervisor && !!user?.departmentID) ? 0.85 : 1
              }}
              value={selectedDept} 
              onChange={e => {
                if (isSupervisor || !user?.departmentID) {
                  setSelectedDept(e.target.value);
                }
              }}
              disabled={!isSupervisor && !!user?.departmentID}
            >
              {departments
                .filter(d => isSupervisor || !user?.departmentID || d.departmentID === user?.departmentID)
                .map(d => (
                  <option key={d.departmentID} value={d.departmentID}>{d.departmentName}</option>
                ))}
            </select>
            {!isSupervisor && !!user?.departmentID && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                🔒 (Cố định theo khoa phụ trách)
              </span>
            )}
          </div>
        </div>
      </div>

      {isReadOnly ? (
        /* SUPERVISOR / READ-ONLY VIEW (Ban Giám Đốc, Thủ kho Kho Chẵn, Dược sĩ) */
        <div>
          {/* Banner */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
                <Monitor size={22} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>
                  Đang xem cơ số tủ thuốc: <span style={{ color: '#3b82f6' }}>{currentDeptName}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Chế độ giám sát tồn kho dành cho {user?.role === 'director' ? 'Ban Giám Đốc' : (user?.role === 'pharmacist' ? 'Thủ kho Kho Chẵn' : 'Dược sĩ')}. Chỉ tra cứu danh mục và cơ số thuốc đang có trong tủ của từng khoa lâm sàng.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }} 
                onClick={handleExportCabinetStocks}
              >
                <FileSpreadsheet size={14} /> Xuất Excel Tồn Tủ
              </button>
              <button 
                className="btn-secondary" 
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }} 
                onClick={() => fetchCabinetData(selectedDept)}
              >
                <RefreshCw size={14} /> Làm Mới
              </button>
            </div>
          </div>

          {/* 4 Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="glass-card" style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => { setSupervisorTab('stocks'); setSupervisorFilter('all'); }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>TỔNG MẶT HÀNG TỦ THUỐC</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--color-primary)', marginTop: '0.3rem' }}>
                {totalStockItems} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-dim)' }}>loại thuốc</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Tại tủ trực {currentDeptName}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>TỔNG CƠ SỐ TỒN TỦ</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#10b981', marginTop: '0.3rem' }}>
                {totalQuantity.toLocaleString('vi-VN')} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-dim)' }}>đơn vị</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Trị giá tồn: <strong>{totalValue.toLocaleString('vi-VN')} đ</strong>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1rem', cursor: 'pointer', border: supervisorFilter === 'expiring' ? '1px solid #f59e0b' : undefined }} onClick={() => { setSupervisorTab('stocks'); setSupervisorFilter(supervisorFilter === 'expiring' ? 'all' : 'expiring'); }}>
              <div style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={14} /> CẬN HẠN DÙNG (≤ 90 NGÀY)
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: expiringSoonCount > 0 ? '#f59e0b' : 'var(--text-dim)', marginTop: '0.3rem' }}>
                {expiringSoonCount} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-dim)' }}>lô cận date</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {expiredCount > 0 ? <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{expiredCount} lô đã hết hạn</span> : 'Cần theo dõi sử dụng'}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1rem', cursor: 'pointer', border: supervisorFilter === 'special' ? '1px solid #8b5cf6' : undefined }} onClick={() => { setSupervisorTab('stocks'); setSupervisorFilter(supervisorFilter === 'special' ? 'all' : 'special'); }}>
              <div style={{ fontSize: '0.78rem', color: '#8b5cf6', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <ShieldAlert size={14} /> KIỂM SOÁT ĐẶC BIỆT
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: specialDrugsCount > 0 ? '#8b5cf6' : 'var(--text-dim)', marginTop: '0.3rem' }}>
                {specialDrugsCount} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-dim)' }}>mặt hàng</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Hướng thần, gây nghiện, KS đặc biệt
              </div>
            </div>
          </div>

          {/* Navigation Tabs for Supervisor */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setSupervisorTab('stocks')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: supervisorTab === 'stocks' ? 'var(--color-primary)' : 'var(--bg-secondary)',
                  color: supervisorTab === 'stocks' ? '#fff' : 'var(--text-muted)'
                }}
              >
                <Layers size={16} /> Danh Mục Thuốc Trong Tủ ({filteredStocks.length})
              </button>
              <button
                onClick={() => setSupervisorTab('history')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: supervisorTab === 'history' ? 'var(--color-primary)' : 'var(--bg-secondary)',
                  color: supervisorTab === 'history' ? '#fff' : 'var(--text-muted)'
                }}
              >
                <Clock size={16} /> Nhật Ký Xuất Dùng Của Khoa ({transactions.length})
              </button>
            </div>

            {supervisorTab === 'stocks' && (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lọc nhanh:</span>
                <button 
                  className={supervisorFilter === 'all' ? 'btn-premium' : 'btn-secondary'}
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                  onClick={() => setSupervisorFilter('all')}
                >
                  Tất cả ({totalStockItems})
                </button>
                <button 
                  className={supervisorFilter === 'expiring' ? 'btn-premium' : 'btn-secondary'}
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                  onClick={() => setSupervisorFilter('expiring')}
                >
                  Cận HSD ({expiringSoonCount})
                </button>
                <button 
                  className={supervisorFilter === 'special' ? 'btn-premium' : 'btn-secondary'}
                  style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                  onClick={() => setSupervisorFilter('special')}
                >
                  Đặc biệt ({specialDrugsCount})
                </button>
              </div>
            )}
          </div>

          {/* Tab 1: Full-width Stocks Table */}
          {supervisorTab === 'stocks' && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ position: 'relative', minWidth: '320px', flex: 1 }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="🔍 Tìm nhanh tên thuốc, biệt dược, hoạt chất, số lô, mã thuốc trong tủ..." 
                    value={cabinetSearchTerm} 
                    onChange={e => setCabinetSearchTerm(e.target.value)}
                    style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.85rem' }}
                  />
                  <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Đang hiển thị <strong>{filteredStocks.length}</strong> / {totalStockItems} mặt hàng
                </span>
              </div>

              {loading ? (
                <p style={{ color: 'var(--text-muted)', padding: '2rem 0', textAlign: 'center' }}>Đang tải cơ số thuốc của khoa {currentDeptName}...</p>
              ) : filteredStocks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Layers size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                  <p style={{ margin: 0, fontWeight: '600' }}>
                    {cabinetSearchTerm ? 'Không tìm thấy thuốc nào khớp với từ khóa tìm kiếm.' : `Tủ thuốc của ${currentDeptName} hiện đang trống.`}
                  </p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-dim)' }}>
                    Khoa phòng có thể gửi Phiếu lĩnh thuốc lên Kho Dược để được duyệt xuất cấp cơ số tủ trực.
                  </p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '45px', textAlign: 'center' }}>STT</th>
                        <th>Tên Thuốc & Biệt Dược / Hoạt Chất</th>
                        <th>Mã Thuốc</th>
                        <th style={{ textAlign: 'center' }}>ĐVT</th>
                        <th style={{ textAlign: 'center' }}>Số Lô</th>
                        <th style={{ textAlign: 'center' }}>Hạn Dùng (HSD)</th>
                        <th style={{ textAlign: 'center' }}>Số Lượng Tồn</th>
                        <th style={{ textAlign: 'right' }}>Đơn Giá Nhập</th>
                        <th style={{ textAlign: 'right' }}>Thành Tiền Tồn</th>
                        <th style={{ textAlign: 'center' }}>Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStocks.map((stock, idx) => {
                        const expiryDate = new Date(stock.batch?.expiryDate);
                        const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                        const itemTotal = (Number(stock.currentQuantity) || 0) * (Number(stock.batch?.importPrice) || 0);

                        return (
                          <tr key={stock.departmentStockID || idx}>
                            <td style={{ textAlign: 'center', color: 'var(--text-dim)' }}>{idx + 1}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                                <strong style={{ fontSize: '0.92rem' }}>{stock.batch?.medicine?.medicineName}</strong>
                                {stock.batch?.medicine?.drugClassification === 'NarcoticPsychotropic' && (
                                  <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                                    🚨 Gây nghiện/Hướng thần
                                  </span>
                                )}
                                {stock.batch?.medicine?.drugClassification === 'SpecialAntibiotic' && (
                                  <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700 }}>
                                    💊 Kháng sinh kiểm soát
                                  </span>
                                )}
                              </div>
                              {stock.batch?.medicine?.genericName && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                  Hoạt chất: {stock.batch?.medicine?.genericName}
                                </div>
                              )}
                            </td>
                            <td><code style={{ fontSize: '0.78rem' }}>{stock.batch?.medicine?.medicineCode}</code></td>
                            <td style={{ textAlign: 'center' }}>{stock.batch?.medicine?.unit}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{stock.batch?.batchNumber}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{
                                color: diffDays <= 0 ? '#ef4444' : (diffDays <= 90 ? '#f59e0b' : 'inherit'),
                                fontWeight: diffDays <= 90 ? '700' : 'normal'
                              }}>
                                {stock.batch?.expiryDate ? new Date(stock.batch.expiryDate).toLocaleDateString('vi-VN') : 'N/A'}
                              </div>
                              {diffDays <= 0 ? (
                                <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.3rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '4px', fontWeight: 'bold' }}>
                                  ĐÃ HẾT HẠN
                                </span>
                              ) : diffDays <= 90 ? (
                                <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.3rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '4px', fontWeight: 'bold' }}>
                                  Còn {diffDays} ngày
                                </span>
                              ) : null}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                                {stock.currentQuantity}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {(stock.batch?.importPrice || 0).toLocaleString('vi-VN')} đ
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: '600' }}>
                              {itemTotal.toLocaleString('vi-VN')} đ
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {diffDays <= 0 ? (
                                <span className="badge-status rejected" style={{ fontSize: '0.72rem', textTransform: 'none' }}>Hết hạn</span>
                              ) : stock.batch?.status && stock.batch.status !== 'Bình thường' && stock.batch.status !== 'Đang sử dụng' ? (
                                <span className="badge-status rejected" style={{ fontSize: '0.72rem', textTransform: 'none' }}>{stock.batch.status}</span>
                              ) : diffDays <= 90 ? (
                                <span className="badge-status warning" style={{ fontSize: '0.72rem', textTransform: 'none' }}>Cận date</span>
                              ) : (
                                <span className="badge-status approved" style={{ fontSize: '0.72rem', textTransform: 'none' }}>Đang dùng</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Full-width Transactions Table */}
          {supervisorTab === 'history' && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Lịch Sử Xuất Dùng Thuốc Tủ Trực ({currentDeptName})</h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Theo dõi đối soát các lần khoa xuất thuốc cho bệnh nhân
                  </span>
                </div>
                <button 
                  type="button"
                  className="btn-secondary" 
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={handleExportTransactions}
                >
                  <FileSpreadsheet size={14} /> Xuất Excel Nhật Ký
                </button>
              </div>

              {transactions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Chưa có ghi nhận xuất dùng thuốc nào tại khoa này.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '45px', textAlign: 'center' }}>STT</th>
                        <th>Bệnh Nhân (Mã BA/BN)</th>
                        <th>Thuốc Đã Cấp</th>
                        <th style={{ textAlign: 'center' }}>Số Lượng</th>
                        <th style={{ textAlign: 'center' }}>Số Lô</th>
                        <th style={{ textAlign: 'center' }}>Thời Gian Xuất</th>
                        <th>Người Thực Hiện</th>
                        <th style={{ textAlign: 'center' }}>Trạng Thái Bù Tủ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr key={tx.transactionID || idx}>
                          <td style={{ textAlign: 'center', color: 'var(--text-dim)' }}>{idx + 1}</td>
                          <td>
                            <strong>{tx.patientName}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>{tx.patientCode}</div>
                          </td>
                          <td>
                            <strong>{tx.batch?.medicine?.medicineName}</strong>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mã: {tx.batch?.medicine?.medicineCode}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <strong style={{ fontSize: '1rem', color: 'var(--color-secondary)' }}>{tx.quantity}</strong> {tx.batch?.medicine?.unit}
                          </td>
                          <td style={{ textAlign: 'center' }}>{tx.batch?.batchNumber}</td>
                          <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                            {new Date(tx.transactionDate).toLocaleString('vi-VN')}
                          </td>
                          <td>{tx.performedBy || 'Điều dưỡng khoa'}</td>
                          <td style={{ textAlign: 'center' }}>
                            {!tx.requisition ? (
                              <span className="badge-status pending" style={{ fontSize: '0.72rem', textTransform: 'none' }}>Chưa bù</span>
                            ) : tx.requisition.status === 'Pending' || tx.requisition.status === 'PendingHead' ? (
                              <span className="badge-status warning" style={{ fontSize: '0.72rem', textTransform: 'none' }}>Chờ duyệt bù</span>
                            ) : tx.requisition.status === 'Approved' || tx.requisition.status === 'Completed' || tx.requisition.status === 'Received' ? (
                              <span className="badge-status approved" style={{ fontSize: '0.72rem', textTransform: 'none' }}>Đã bù tủ</span>
                            ) : (
                              <span className="badge-status rejected" style={{ fontSize: '0.72rem', textTransform: 'none' }}>Bị từ chối</span>
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
        </div>
      ) : (
        /* CLINICAL STAFF VIEW (Điều dưỡng, Điều dưỡng trưởng, Bác sĩ Trưởng khoa) */
        <>
          {/* Tabs Switcher: Chỉ hiển thị cho Điều dưỡng lâm sàng / Trưởng khoa */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <button
              onClick={() => setActiveCabinetTab('stocks')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: activeCabinetTab === 'stocks' ? 'var(--color-primary)' : 'var(--bg-secondary)',
                color: activeCabinetTab === 'stocks' ? '#fff' : 'var(--text-muted)'
              }}
            >
              <Layers size={16} /> Cơ Số Tủ Trực & Xuất Dùng Bệnh Nhân
            </button>
            <button
              onClick={() => setActiveCabinetTab('breakage')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: activeCabinetTab === 'breakage' ? '#dc2626' : 'var(--bg-secondary)',
                color: activeCabinetTab === 'breakage' ? '#fff' : 'var(--text-muted)'
              }}
            >
              <AlertTriangle size={16} /> Biên Bản Hư Hao / Vỡ Hỏng Đột Xuất
            </button>
          </div>

          {activeCabinetTab === 'breakage' ? (
            <BreakageReportList
              departmentId={selectedDept}
              user={user}
              onUpdateNeeded={() => fetchCabinetData(selectedDept)}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
              {/* Left column: Cabinet Stocks & Patients Export Form */}
              <div>
                {/* Cabinet Inventory List */}
                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Cơ Số Tủ Trực Hiện Có ({currentDeptName})</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', borderRadius: '8px' }} onClick={handleExportCabinetStocks}>
                        Xuất báo cáo
                      </button>
                      <button className="btn-secondary" style={{ padding: '0.4rem', borderRadius: '8px' }} onClick={() => fetchCabinetData(selectedDept)}>
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Instant Search Bar */}
                  <div style={{ marginBottom: '1rem', position: 'relative' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="🔍 Tìm nhanh tên thuốc, số lô, mã thuốc trong tủ trực..." 
                      value={cabinetSearchTerm} 
                      onChange={e => setCabinetSearchTerm(e.target.value)}
                      style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.85rem' }}
                    />
                    <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>

                  {loading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Đang tải tồn tủ trực...</p>
                  ) : filteredStocks.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>
                      {cabinetSearchTerm ? 'Không tìm thấy thuốc nào khớp với từ khóa tìm kiếm.' : 'Tủ trực của khoa hiện đang trống hoặc chưa được cấp thuốc.'}
                    </p>
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
                          {filteredStocks.map(stock => (
                            <tr key={stock.departmentStockID}>
                              <td>
                                <strong>{stock.batch?.medicine?.medicineName}</strong>
                                {(() => {
                                  const expiryDate = new Date(stock.batch?.expiryDate);
                                  const diffTime = expiryDate - today;
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                  
                                  if (diffDays <= 0) {
                                    return (
                                      <div style={{ marginTop: '0.25rem' }}>
                                        <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.35rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', display: 'inline-block', fontWeight: 'bold' }}>
                                          ĐÃ HẾT HẠN
                                        </span>
                                      </div>
                                    );
                                  } else if (diffDays <= 90) {
                                    return (
                                      <div style={{ marginTop: '0.25rem' }}>
                                        <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.35rem', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '4px', display: 'inline-block', fontWeight: 'bold' }}>
                                          Sắp hết hạn ({diffDays} ngày)
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
                                const diffTime = expiryDate - today;
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                if (diffDays <= 0) return { color: '#ef4444', fontWeight: 'bold' };
                                if (diffDays <= 90) return { color: '#f59e0b', fontWeight: '600' };
                                return {};
                              })()}>
                                {new Date(stock.batch?.expiryDate).toLocaleDateString('vi-VN')}
                              </td>
                              <td>
                                <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                                  {stock.currentQuantity}
                                </span> {stock.batch?.medicine?.unit}
                              </td>
                              <td>{stock.batch?.importPrice.toLocaleString('vi-VN')}đ</td>
                              <td>
                                {stock.batch?.status && stock.batch.status !== 'Bình thường' && stock.batch.status !== 'Đang sử dụng' ? (
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
                    <div className="form-row" style={{ position: 'relative' }}>
                      <div className="form-group" ref={patientDropdownRef} style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <label className="form-label" style={{ margin: 0 }}>
                            Mã Bệnh Án / Bệnh Nhân (BA/BN) *
                          </label>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: '600' }}>
                            <Sparkles size={12} /> Tự động nạp y lệnh
                          </span>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="Gõ mã BN hoặc chọn gợi ý (VD: BN-002847)..." 
                            value={patientCode} 
                            onChange={e => handlePatientCodeChange(e.target.value)}
                            onFocus={() => {
                              fetchPatientSuggestions(patientCode);
                              setShowPatientSuggestions(true);
                            }}
                            style={{ width: '100%', paddingRight: '2rem' }}
                          />
                          <Search size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        </div>

                        {/* Auto-suggest Dropdown */}
                        {showPatientSuggestions && patientSuggestions.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 100,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '8px',
                            marginTop: '4px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
                          }}>
                            <div style={{ padding: '0.4rem 0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-glass)', fontWeight: '700' }}>
                              BỆNH NHÂN CÓ Y LỆNH NỘI TRÚ / PHÒNG KHÁM ({patientSuggestions.length}):
                            </div>
                            {patientSuggestions.map(p => (
                              <div
                                key={p.patientCode}
                                onClick={() => applyPatientData(p)}
                                style={{
                                  padding: '0.55rem 0.75rem',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                                  transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(14, 165, 233, 0.15)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <strong style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>{p.patientCode}</strong>
                                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-main)' }}>{p.patientName}</span>
                                </div>
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                  {p.diagnosis ? `${p.diagnosis} • ` : ''}
                                  <span style={{ color: '#10b981', fontWeight: '600' }}>{p.medicines?.length || 0} thuốc trong y lệnh</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">Họ và Tên Bệnh Nhân *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Tự động điền hoặc nhập tay nếu cấp cứu..." 
                          value={patientName} 
                          onChange={e => setPatientName(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Quick Suggestion Pills */}
                    {patientSuggestions.length > 0 && !selectedPatientOrder && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Gợi ý nhanh:</span>
                        {patientSuggestions.slice(0, 4).map(p => (
                          <button
                            key={p.patientCode}
                            type="button"
                            onClick={() => applyPatientData(p)}
                            style={{
                              padding: '0.15rem 0.5rem',
                              fontSize: '0.73rem',
                              borderRadius: '999px',
                              border: '1px solid var(--border-glass)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--color-primary)';
                              e.currentTarget.style.color = 'var(--color-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border-glass)';
                              e.currentTarget.style.color = 'var(--text-main)';
                            }}
                          >
                            {p.patientCode} - {p.patientName}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Dynamic Items Rows */}
                    <div style={{ marginTop: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label className="form-label" style={{ margin: 0 }}>Danh Sách Thuốc Cần Xuất Dùng *</label>
                        <button type="button" className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={addExportItem}>
                          + Thêm thuốc
                        </button>
                      </div>

                      {exportItems.map((item, index) => {
                        const currentStock = cabinetStocks.find(s => s.batchID.toString() === item.batchID);
                        const maxAllowed = currentStock ? currentStock.currentQuantity : 0;
                        return (
                          <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                            <select 
                              className="form-input" 
                              style={{ flex: 2 }}
                              value={item.batchID} 
                              onChange={e => updateExportItem(index, 'batchID', e.target.value)}
                              required
                            >
                              <option value="">-- Chọn thuốc trong tủ trực --</option>
                              {cabinetStocks.map(stock => (
                                <option 
                                  key={stock.departmentStockID} 
                                  value={stock.batchID}
                                  disabled={stock.batch?.status && stock.batch.status !== 'Bình thường' && stock.batch.status !== 'Đang sử dụng'}
                                >
                                  {stock.batch?.medicine?.medicineName} (Lô: {stock.batch?.batchNumber} - Còn: {stock.currentQuantity} {stock.batch?.medicine?.unit})
                                </option>
                              ))}
                            </select>

                            <input 
                              type="text" 
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="form-input" 
                              style={{ flex: 1 }}
                              placeholder={`Số lượng (max: ${maxAllowed})`}
                              value={item.quantity} 
                              onChange={e => updateExportItem(index, 'quantity', sanitizeInteger(e.target.value))}
                              onKeyDown={handleIntegerKeyDown}
                              onPaste={handleIntegerPaste}
                              required
                            />

                            {exportItems.length > 1 && (
                              <button type="button" className="btn-danger" style={{ padding: '0.5rem', borderRadius: '8px' }} onClick={() => removeExportItem(index)}>
                                <X size={16} />
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
                        Tủ trực của khoa hiện đang trống. Khoa cần nhận thuốc cấp phát thường quy từ Kho Dược hoặc thực hiện quy trình bù tủ trực để có cơ số thuốc trước khi xuất cho bệnh nhân.
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Nhật Ký Xuất Tủ Trực Khoa</h3>
                    {isPharmacist && (
                      <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        Đối chiếu lịch sử xuất thuốc tại tủ trực
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button 
                      type="button"
                      className="btn-secondary" 
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      onClick={handleExportTransactions}
                    >
                      Xuất nhật ký
                    </button>
                    {!isPharmacist && user?.role !== 'nurse' && (
                      <button 
                        className="btn-premium" 
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        onClick={handleRefillRequest}
                      >
                        <CheckSquare size={14} /> Bù tủ trực
                      </button>
                    )}
                  </div>
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
          )}
        </>
      )}

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

      {/* Breakage Report Modal */}
      <BreakageReportModal
        isOpen={showBreakageModal}
        onClose={() => setShowBreakageModal(false)}
        cabinetStocks={cabinetStocks}
        departmentId={selectedDept}
        user={user}
        onSuccess={() => {
          fetchCabinetData(selectedDept);
          setActiveCabinetTab('breakage');
        }}
      />
    </div>
  );
}
