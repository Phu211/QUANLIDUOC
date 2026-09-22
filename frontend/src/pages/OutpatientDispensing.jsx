import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  User, 
  Layers, 
  RefreshCw, 
  FileText, 
  Sparkles, 
  Check, 
  X, 
  ArrowRight, 
  History, 
  Plus, 
  Stethoscope, 
  ShieldCheck, 
  Building2,
  DollarSign,
  AlertCircle,
  QrCode,
  Phone,
  MessageSquareWarning,
  ExternalLink,
  ScanLine,
  PenTool,
  Eraser
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import BarcodeRenderer from '../components/BarcodeRenderer';
import { handleIntegerKeyDown, sanitizeInteger, handleIntegerPaste } from '../utils/numberInputUtils';

// Danh mục các Bác sĩ Trưởng khoa tương ứng tài khoản thực tế của bệnh viện
export const HOSPITAL_DOCTORS = [
  { username: 'tkkhambenh', name: 'BS.CKII. Nguyễn Hữu Lực', deptId: 1, title: 'Trưởng khoa Khám Bệnh' },
  { username: 'tkcapcuu', name: 'BS.CKII. Lê Văn Chương', deptId: 2, title: 'Trưởng khoa Cấp Cứu' },
  { username: 'tknoitonghop', name: 'BS.CKII. Nguyễn Đăng Đức Anh', deptId: 3, title: 'Trưởng khoa Nội Tổng Hợp' },
  { username: 'tkxetnghiem', name: 'BS.CKII. Trương Minh Quân', deptId: 4, title: 'Trưởng khoa Xét Nghiệm' },
  { username: 'tkdongy', name: 'BS.CKII. Nguyễn Xuân Duy Thắng', deptId: 5, title: 'Trưởng khoa Đông Y' },
  { username: 'giamdoc', name: 'PGS.TS. Lê Minh Trí', deptId: 1, title: 'PGS.TS. Giám đốc Bệnh viện' }
];

export const getDoctorForUser = (currentUser) => {
  if (!currentUser) return 'BS.CKII. Nguyễn Hữu Lực';
  
  // 1. Match by username in HOSPITAL_DOCTORS
  if (currentUser.username) {
    const byUsername = HOSPITAL_DOCTORS.find(d => 
      d.username?.toLowerCase() === currentUser.username.toLowerCase()
    );
    if (byUsername) return byUsername.name;
  }

  // 2. Match by fullName in HOSPITAL_DOCTORS
  if (currentUser.fullName) {
    const cleanUser = currentUser.fullName.toLowerCase().trim();
    const byName = HOSPITAL_DOCTORS.find(d => {
      const docClean = d.name.toLowerCase()
        .replace('bs.ckii. ', '')
        .replace('pgs.ts. ', '')
        .trim();
      return docClean === cleanUser || d.name.toLowerCase().includes(cleanUser) || cleanUser.includes(docClean);
    });
    if (byName) return byName.name;
  }

  // 3. User with custom title
  const rawName = currentUser.fullName || currentUser.username || 'Bác sĩ điều trị';
  if (rawName.startsWith('BS.') || rawName.startsWith('PGS.') || rawName.startsWith('TS.')) {
    return rawName;
  }
  return `BS. ${rawName}`;
};

export const getDefaultDoctor = (deptId, currentUser) => {
  if (currentUser) {
    return getDoctorForUser(currentUser);
  }
  const match = HOSPITAL_DOCTORS.find(d => d.deptId === deptId);
  return match ? match.name : 'BS.CKII. Nguyễn Hữu Lực';
};

// Chữ ký nét bút điện tử y tế mực xanh chuẩn GPP
const SIG = {
  luc: (
    <svg width="120" height="52" viewBox="0 0 140 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M15,38 C28,14 44,6 54,26 C64,44 78,46 94,18 C104,6 114,16 128,26 M32,44 C55,34 80,24 122,38 M45,18 C60,10 76,28 92,40" fill="none" stroke="#0044cc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chuong: (
    <svg width="120" height="52" viewBox="0 0 140 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M12,34 C28,10 44,18 54,42 C64,14 80,4 96,24 C106,44 114,32 126,18 M26,46 Q60,28 108,42 M48,26 Q74,14 116,22" fill="none" stroke="#0044cc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  thao: (
    <svg width="120" height="52" viewBox="0 0 140 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M18,40 C28,16 42,10 54,28 C66,46 80,20 94,14 C108,6 116,22 124,34 M24,28 C48,22 80,34 120,26 M64,26 Q84,12 104,30" fill="none" stroke="#0033bb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  phuc: (
    <svg width="120" height="52" viewBox="0 0 140 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M14,26 Q32,6 48,32 T84,24 T116,14 M24,42 C50,32 82,28 118,38 M40,20 C62,12 86,36 102,44" fill="none" stroke="#0033bb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  phu: (
    <svg width="120" height="52" viewBox="0 0 140 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M16,36 C30,12 48,8 60,26 C72,44 88,20 104,12 C116,24 120,36 126,28 M30,44 Q70,26 116,38" fill="none" stroke="#0033bb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  generic: () => (
    <svg width="120" height="52" viewBox="0 0 140 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M15,32 C30,12 48,6 60,24 C70,42 85,34 100,16 C110,6 118,18 128,26 M28,42 C55,32 85,26 118,38" fill="none" stroke="#0033bb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
};

const renderDoctorSignature = (presc) => {
  if (presc?.doctorSignature && presc.doctorSignature.startsWith('data:image')) {
    return <img src={presc.doctorSignature} alt="Chữ ký bác sĩ" style={{ maxHeight: '48px', maxWidth: '130px', objectFit: 'contain' }} />;
  }
  const name = presc?.doctorName || '';
  if (name.includes('Lực') || name.includes('luc')) return SIG.luc;
  if (name.includes('Chương') || name.includes('chuong')) return SIG.chuong;
  return SIG.generic();
};

const renderDispenserSignature = (presc, currentUser) => {
  const sig = presc?.dispenserSignature || presc?.digitalSignature;
  if (sig && sig.startsWith('data:image')) {
    return <img src={sig} alt="Chữ ký dược sĩ" style={{ maxHeight: '48px', maxWidth: '130px', objectFit: 'contain' }} />;
  }
  const name = presc?.dispensedBy || currentUser?.fullName || '';
  if (name.includes('Thảo') || name.includes('thao')) return SIG.thao;
  if (name.includes('Phúc') || name.includes('phuc')) return SIG.phuc;
  if (name.includes('Phú') || name.includes('phu')) return SIG.phu;
  return SIG.generic();
};

export default function OutpatientDispensing({ user, setPage }) {
  // Navigation & Workspace Tabs
  const [activeTab, setActiveTab] = useState('dispense'); // 'dispense', 'history', 'inventory'
  
  // Data States
  const [selectedDeptId, setSelectedDeptId] = useState(user?.departmentID || 1);
  const [departmentList, setDepartmentList] = useState([]);
  const [pendingPrescriptions, setPendingPrescriptions] = useState([]);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [dispensaryStocks, setDispensaryStocks] = useState([]);
  
  // Search & Barcode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);
  
  // Processing States
  const [isDispensing, setIsDispensing] = useState(false);
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [batchOverrides, setBatchOverrides] = useState({}); // { detailId: batchId }
  
  // Modals & UI States
  const [printModalData, setPrintModalData] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Digital Signature Canvas Modal States
  const [signatureModal, setSignatureModal] = useState(null); // { target: 'dispenser' | 'patient' | 'doctor', title: '...' }
  const canvasRef = useRef(null);
  const [dispenserSignatureDraft, setDispenserSignatureDraft] = useState(null);

  // ADR Adverse Reaction States
  const [adrReports, setAdrReports] = useState([]);
  const [loadingAdr, setLoadingAdr] = useState(false);
  const [selectedAdr, setSelectedAdr] = useState(null);
  const [adrNoteInput, setAdrNoteInput] = useState('');
  
  // New Prescription Simulation Form
  const [newPresc, setNewPresc] = useState({
    patientName: '',
    patientCode: '',
    birthYear: 1985,
    gender: 'Nam',
    address: 'TP. Hồ Chí Minh',
    insuranceCardNumber: 'DN4791122334455',
    insuranceRate: 80,
    diagnosis: 'J02.9 - Viêm họng cấp, sốt siêu vi',
    doctorName: getDoctorForUser(user),
    departmentID: user?.departmentID || 1,
    notes: '',
    selectedMedicines: [] // [{ medicineId, quantity, morning, noon, afternoon, night, instructions, usageTime }]
  });

  // Luôn đồng bộ tên Bác sĩ kê đơn theo tài khoản đang đăng nhập
  useEffect(() => {
    if (user) {
      setNewPresc(prev => ({
        ...prev,
        doctorName: getDoctorForUser(user),
        departmentID: user?.departmentID || prev.departmentID || selectedDeptId
      }));
    }
  }, [user]);

  // Sound Effect (Đã tắt để tránh phát tiếng bíp khi vào trang)
  const playBeep = () => {};

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // 1. Load initial pending prescriptions & inventory
  const loadPendingPrescriptions = async (deptId = selectedDeptId) => {
    try {
      const res = await fetch(`/api/prescription/pending?departmentId=${deptId}`);
      if (res.ok) {
        const data = await res.json();
        setPendingPrescriptions(data);
        // If no prescription is currently selected, select the first pending one
        if (data.length > 0) {
          loadPrescriptionDetail(data[0].prescriptionID);
        } else {
          setSelectedPrescription(null);
        }
      }
    } catch (err) {
      console.error("Error loading pending prescriptions:", err);
    }
  };

  const loadDispensingHistory = async (deptId = selectedDeptId) => {
    try {
      const res = await fetch(`/api/prescription/history?departmentId=${deptId}&take=30`);
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  const loadDispensaryStocks = async (deptId = selectedDeptId) => {
    try {
      const res = await fetch(`/api/prescription/available-medicines?departmentId=${deptId}`);
      if (res.ok) {
        const data = await res.json();
        setDispensaryStocks(data);
      }
    } catch (err) {
      console.error("Error loading dispensary stock:", err);
    }
  };

  const loadAdrReports = async () => {
    setLoadingAdr(true);
    try {
      const res = await fetch('/api/patientportal/adr-reports');
      if (res.ok) {
        const data = await res.json();
        setAdrReports(data);
      }
    } catch (err) {
      console.error("Error loading ADR reports:", err);
    } finally {
      setLoadingAdr(false);
    }
  };

  const handleDepartmentChange = (deptId) => {
    setSelectedDeptId(deptId);
    loadPendingPrescriptions(deptId);
    loadDispensaryStocks(deptId);
    loadDispensingHistory(deptId);
    setNewPresc(prev => ({ ...prev, departmentID: deptId }));
  };

  // 2. Load Single Prescription with Automated FEFO Allocation
  const loadPrescriptionDetail = async (id) => {
    try {
      setSearchLoading(true);
      const res = await fetch(`/api/prescription/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPrescription(data);
        setBatchOverrides({}); // Reset overrides
      } else {
        showToast("Không tìm thấy đơn thuốc yêu cầu.", "error");
      }
    } catch (err) {
      console.error("Error loading prescription detail:", err);
      showToast("Lỗi kết nối khi tải đơn thuốc.", "error");
    } finally {
      setSearchLoading(false);
    }
  };

  // 3. Search or Barcode Scan Handler
  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      loadPendingPrescriptions(selectedDeptId);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/prescription/search?query=${encodeURIComponent(searchQuery.trim())}&departmentId=${selectedDeptId}`);
      if (res.ok) {
        const results = await res.json();
        if (results.length === 1) {
          // Exact match found (barcode scanned) -> directly open details
          await loadPrescriptionDetail(results[0].prescriptionID);
          showToast(`Đã nạp thành công đơn thuốc: ${results[0].prescriptionCode}`, "success");
        } else if (results.length > 1) {
          setPendingPrescriptions(results);
          await loadPrescriptionDetail(results[0].prescriptionID);
          showToast(`Tìm thấy ${results.length} đơn thuốc phù hợp.`, "info");
        } else {
          showToast(`Không tìm thấy đơn thuốc cho mã: "${searchQuery}"`, "warning");
        }
      }
    } catch (err) {
      console.error("Error searching prescription:", err);
      showToast("Lỗi tìm kiếm đơn thuốc.", "error");
    } finally {
      setSearchLoading(false);
    }
  };


  // 4. Execute 1-Click Dispensing
  const handleDispense = async () => {
    if (!selectedPrescription) return;

    if (selectedPrescription.status === 'Dispensed') {
      showToast("Đơn thuốc này đã được cấp phát trước đó.", "warning");
      return;
    }

    setIsDispensing(true);
    try {
      // Build allocation payload if pharmacist made manual overrides
      const allocations = Object.keys(batchOverrides).map(detailId => ({
        prescriptionDetailID: parseInt(detailId),
        batchID: parseInt(batchOverrides[detailId]),
        quantity: selectedPrescription.details.find(d => d.prescriptionDetailID === parseInt(detailId))?.requestedQuantity || 0
      }));

      const payload = {
        dispensedBy: user?.fullName || "DS. Quầy Dược Ngoại Trú",
        notes: dispenseNotes.trim() || undefined,
        dispenserSignature: dispenserSignatureDraft || undefined,
        allocations: allocations.length > 0 ? allocations : undefined
      };

      const res = await fetch(`/api/prescription/${selectedPrescription.prescriptionID}/dispense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (res.ok) {
        playBeep('success');
        showToast(`Cấp phát thành công đơn thuốc ${selectedPrescription.prescriptionCode}!`, "success");

        // Reload data
        await loadPrescriptionDetail(selectedPrescription.prescriptionID);
        await loadPendingPrescriptions(selectedDeptId);
        await loadDispensaryStocks(selectedDeptId);
        await loadDispensingHistory(selectedDeptId);

        // Automatically open the printable medical invoice and schedule modal
        const refreshedRes = await fetch(`/api/prescription/${selectedPrescription.prescriptionID}`);
        if (refreshedRes.ok) {
          const freshData = await refreshedRes.json();
          setPrintModalData(freshData);
        }
      } else {
        showToast(resData.message || "Không thể cấp phát đơn thuốc.", "error");
      }
    } catch (err) {
      console.error("Error dispensing prescription:", err);
      showToast("Lỗi hệ thống khi cấp phát.", "error");
    } finally {
      setIsDispensing(false);
    }
  };

  // Setup Signature Canvas listeners
  useEffect(() => {
    if (!signatureModal || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = signatureModal.target === 'dispenser' ? '#0033bb' : '#0044cc';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let drawing = false;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    const start = (e) => {
      drawing = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e) => {
      if (!drawing) return;
      if (e.preventDefault && e.cancelable) e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stop = () => {
      if (drawing) {
        ctx.closePath();
        drawing = false;
      }
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
  }, [signatureModal]);

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const isCanvasEmpty = () => {
    if (!canvasRef.current) return true;
    const buffer = new Uint32Array(
      canvasRef.current.getContext('2d').getImageData(0, 0, canvasRef.current.width, canvasRef.current.height).data.buffer
    );
    return !buffer.some(color => color !== 0);
  };

  const applyDefaultSignatureToCanvas = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#0033bb';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(40, 80);
    ctx.bezierCurveTo(65, 30, 95, 20, 120, 60);
    ctx.bezierCurveTo(140, 100, 165, 100, 195, 50);
    ctx.bezierCurveTo(215, 20, 235, 40, 265, 65);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(70, 95);
    ctx.bezierCurveTo(115, 75, 165, 60, 245, 90);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(105, 50);
    ctx.bezierCurveTo(135, 30, 165, 70, 190, 95);
    ctx.stroke();
  };

  const handleSaveSignature = async () => {
    if (!canvasRef.current || !signatureModal) return;
    if (isCanvasEmpty()) {
      showToast("Vui lòng vẽ chữ ký hoặc chọn 'Dùng chữ ký số chuẩn'.", "warning");
      return;
    }

    const dataUrl = canvasRef.current.toDataURL('image/png');
    const target = signatureModal.target; // 'dispenser' | 'patient' | 'doctor'
    const currentPrescId = printModalData?.prescriptionID || selectedPrescription?.prescriptionID;

    if (!currentPrescId) {
      if (target === 'dispenser') {
        setDispenserSignatureDraft(dataUrl);
        showToast("Đã ghi nhận mẫu chữ ký Dược sĩ cho lượt cấp phát này.", "success");
      }
      setSignatureModal(null);
      return;
    }

    try {
      const payload = {};
      if (target === 'dispenser') {
        payload.dispenserSignature = dataUrl;
        payload.dispensedBy = user?.fullName || 'Dược sĩ Quầy Dược';
      } else if (target === 'patient') {
        payload.patientSignature = dataUrl;
      } else if (target === 'doctor') {
        payload.doctorSignature = dataUrl;
      }

      const res = await fetch(`/api/prescription/${currentPrescId}/signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast("Đã lưu và cập nhật chữ ký số thành công!", "success");
        
        // Update printModalData
        if (printModalData && printModalData.prescriptionID === currentPrescId) {
          setPrintModalData(prev => ({
            ...prev,
            ...(target === 'dispenser' ? { dispenserSignature: dataUrl, dispensedBy: payload.dispensedBy || prev.dispensedBy } : {}),
            ...(target === 'patient' ? { patientSignature: dataUrl } : {}),
            ...(target === 'doctor' ? { doctorSignature: dataUrl } : {})
          }));
        }

        // Update selectedPrescription
        if (selectedPrescription && selectedPrescription.prescriptionID === currentPrescId) {
          setSelectedPrescription(prev => ({
            ...prev,
            ...(target === 'dispenser' ? { dispenserSignature: dataUrl, dispensedBy: payload.dispensedBy || prev.dispensedBy } : {}),
            ...(target === 'patient' ? { patientSignature: dataUrl } : {}),
            ...(target === 'doctor' ? { doctorSignature: dataUrl } : {})
          }));
        }

        setSignatureModal(null);
      } else {
        showToast("Không thể lưu chữ ký vào hệ thống.", "error");
      }
    } catch (err) {
      console.error("Error saving signature:", err);
      showToast("Lỗi kết nối khi lưu chữ ký.", "error");
    }
  };

  // Initial load
  useEffect(() => {
    fetch('/api/requisition/departments')
      .then(res => res.json())
      .then(depts => {
        setDepartmentList(depts);
      })
      .catch(err => console.error("Error loading departments:", err));

    const initialDept = user?.departmentID || 1;
    setSelectedDeptId(initialDept);
    loadPendingPrescriptions(initialDept);
    loadDispensaryStocks(initialDept);
    loadDispensingHistory(initialDept);
    loadAdrReports();

    // Hotkey listener: Press F9 or Ctrl+Enter to dispense, '/' to focus search
    const handleKeyDown = (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        handleDispense();
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Format currency VND
  const formatVND = (num) => {
    if (num == null || isNaN(num)) return '0 đ';
    return Number(num).toLocaleString('vi-VN') + ' đ';
  };

  // Helper: Insurance Badge
  const renderInsuranceBadge = (rate, cardNumber) => {
    if (rate === 100) {
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.25rem 0.65rem',
          borderRadius: '9999px',
          background: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          fontWeight: '700',
          fontSize: '0.78rem'
        }}>
          <ShieldCheck size={14} />
          <span>BHYT Chi trả 100% (Miễn phí)</span>
        </div>
      );
    }
    if (rate > 0) {
      return (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.25rem 0.65rem',
          borderRadius: '9999px',
          background: 'rgba(59, 130, 246, 0.15)',
          color: '#3b82f6',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          fontWeight: '700',
          fontSize: '0.78rem'
        }}>
          <ShieldCheck size={14} />
          <span>BHYT Chi trả {rate}% (Đồng chi trả {100 - rate}%)</span>
        </div>
      );
    }
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.25rem 0.65rem',
        borderRadius: '9999px',
        background: 'rgba(245, 158, 11, 0.15)',
        color: '#f59e0b',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        fontWeight: '700',
        fontSize: '0.78rem'
      }}>
        <DollarSign size={14} />
        <span>Khám Dịch Vụ - Thu phí 100%</span>
      </div>
    );
  };

  // Helper: Status badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            background: 'rgba(245, 158, 11, 0.12)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            <Clock size={12} /> Chờ cấp phát
          </span>
        );
      case 'Dispensed':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            background: 'rgba(16, 185, 129, 0.12)',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            <CheckCircle2 size={12} /> Đã cấp phát
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  // Add Medicine in Prescription Modal
  const handleAddMedicineToPrescription = (medId) => {
    const med = dispensaryStocks.find(m => m.medicineID === parseInt(medId));
    if (!med) return;
    if (newPresc.selectedMedicines.some(m => m.medicineID === med.medicineID)) {
      showToast("Thuốc này đã có trong đơn.", "info");
      return;
    }

    setNewPresc(prev => ({
      ...prev,
      selectedMedicines: [
        ...prev.selectedMedicines,
        {
          medicineID: med.medicineID,
          medicineName: med.medicineName,
          unit: med.unit,
          unitPrice: med.defaultPrice,
          requestedQuantity: 10,
          morningDose: 1,
          noonDose: 0,
          afternoonDose: 0,
          nightDose: 1,
          usageTime: 'Sau ăn no',
          dosageInstructions: 'Ngày uống 2 lần, mỗi lần 1 viên sau ăn'
        }
      ]
    }));
  };

  const handleCreatePrescriptionSubmit = async (e) => {
    e.preventDefault();
    if (!newPresc.patientName.trim()) {
      showToast("Vui lòng nhập tên bệnh nhân.", "warning");
      return;
    }
    if (newPresc.selectedMedicines.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 loại thuốc vào đơn.", "warning");
      return;
    }

    try {
      const payload = {
        patientName: newPresc.patientName.trim(),
        patientCode: newPresc.patientCode.trim() || undefined,
        birthYear: parseInt(newPresc.birthYear) || 1985,
        gender: newPresc.gender,
        address: newPresc.address,
        insuranceCardNumber: newPresc.insuranceRate > 0 ? newPresc.insuranceCardNumber : undefined,
        insuranceRate: parseInt(newPresc.insuranceRate),
        diagnosis: newPresc.diagnosis,
        doctorName: newPresc.doctorName,
        departmentID: 1,
        notes: newPresc.notes,
        details: newPresc.selectedMedicines.map(m => ({
          medicineID: m.medicineID,
          requestedQuantity: parseInt(m.requestedQuantity) || 1,
          unitPrice: m.unitPrice,
          dosageInstructions: m.dosageInstructions,
          morningDose: m.morningDose,
          noonDose: m.noonDose,
          afternoonDose: m.afternoonDose,
          nightDose: m.nightDose,
          usageTime: m.usageTime
        }))
      };

      const res = await fetch('/api/prescription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Đã tạo đơn thuốc mới thành công!", "success");
        setShowCreateModal(false);
        // Reset form
        setNewPresc(prev => ({ ...prev, patientName: '', selectedMedicines: [] }));
        await loadPendingPrescriptions();
        if (data.prescriptionId) {
          await loadPrescriptionDetail(data.prescriptionId);
        }
      } else {
        showToast(data.message || "Lỗi khi tạo đơn thuốc.", "error");
      }
    } catch (err) {
      console.error("Error creating prescription:", err);
      showToast("Lỗi hệ thống.", "error");
    }
  };

  return (
    <div className="dispensing-container" style={{ padding: '0.5rem 0', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Toast Banner */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '25px',
          zIndex: 9999,
          padding: '0.85rem 1.4rem',
          borderRadius: '10px',
          background: toastMessage.type === 'error' ? '#ef4444' : toastMessage.type === 'warning' ? '#f59e0b' : '#10b981',
          color: '#ffffff',
          fontWeight: '600',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          {toastMessage.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
              <div style={{
                padding: '0.5rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(59, 130, 246, 0.2))',
                color: 'var(--color-primary)'
              }}>
                <Stethoscope size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                    Cấp Phát Thuốc Kho Lẻ
                  </h1>
                  <span style={{
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '6px',
                    background: 'rgba(14, 165, 233, 0.15)',
                    color: 'var(--color-primary)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    <Building2 size={14} />
                    {departmentList.find(d => d.departmentID === selectedDeptId)?.departmentName || (user?.departmentName || 'Khoa Khám Bệnh')}
                  </span>
                </div>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Dược sĩ phụ trách kho lẻ: <strong style={{ color: 'var(--text-main)' }}>{user?.fullName || 'DS. Chuyên Trách Khoa'}</strong> | Xuất kho FEFO theo cơ số khoa
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {/* Department Switcher: Cho phép Giám Đốc, Thủ kho và Dược sĩ chuyển đổi quầy dược / phòng khám */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-glass)',
              fontSize: '0.8rem'
            }}>
              <Building2 size={15} color="var(--color-primary)" />
              <span style={{ color: 'var(--text-muted)' }}>Quầy / Kho lẻ:</span>
              <select
                value={selectedDeptId}
                onChange={(e) => handleDepartmentChange(parseInt(e.target.value))}
                className="form-input"
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  fontWeight: '700',
                  color: 'var(--color-primary)',
                  cursor: 'pointer'
                }}
              >
                <option value={0}>🏥 Toàn viện (Tất cả quầy)</option>
                {departmentList.map(d => (
                  <option key={d.departmentID} value={d.departmentID}>
                    {d.departmentName}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Stats Chips */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-glass)',
              fontSize: '0.8rem'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Chờ cấp phát:</span>
              <span style={{
                background: '#f59e0b',
                color: '#fff',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
                fontWeight: '700',
                fontSize: '0.75rem'
              }}>
                {pendingPrescriptions.length} đơn
              </span>
            </div>

            <button
              className="btn-secondary"
              onClick={() => {
                loadPendingPrescriptions();
                loadDispensingHistory();
                loadDispensaryStocks();
                showToast("Đã làm mới dữ liệu từ hệ thống.", "info");
              }}
              title="Tải lại danh sách"
              style={{ height: '36px', padding: '0 0.8rem', fontSize: '0.82rem' }}
            >
              <RefreshCw size={14} /> Làm mới
            </button>

            <button
              className="btn-premium"
              onClick={() => setShowCreateModal(true)}
              style={{ height: '36px', padding: '0 1rem', fontSize: '0.82rem', gap: '0.4rem' }}
              title="Kê đơn mới hoặc tạo đơn thuốc mô phỏng để cấp phát ngay"
            >
              <Plus size={15} /> Kê Đơn Thuốc Mới
            </button>
          </div>
        </div>

        {/* Workspace Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.85rem' }}>
          <button
            onClick={() => setActiveTab('dispense')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              background: activeTab === 'dispense' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'dispense' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <Sparkles size={16} /> Cấp Phát Đơn Thuốc (Active)
          </button>

          <button
            onClick={() => {
              setActiveTab('history');
              loadDispensingHistory();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              background: activeTab === 'history' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'history' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <History size={16} /> Lịch Sử Đã Cấp Phát ({historyList.length})
          </button>

          <button
            onClick={() => {
              setActiveTab('inventory');
              loadDispensaryStocks();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              background: activeTab === 'inventory' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'inventory' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <Layers size={16} /> Tồn Kho Quầy Dược ({dispensaryStocks.length} loại)
          </button>

          <button
            onClick={() => {
              setActiveTab('adr');
              loadAdrReports();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease',
              background: activeTab === 'adr' ? '#ef4444' : 'transparent',
              color: activeTab === 'adr' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <AlertTriangle size={16} /> Phản Hồi Bệnh Nhân & ADR ({adrReports.length})
          </button>
        </div>
      </div>

      {/* TAB 1: MAIN OUTPATIENT DISPENSING WORKSPACE */}
      {activeTab === 'dispense' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.25rem', alignItems: 'start' }}>
          
          {/* Left Column: Smart Scanner & Queue */}
          <div>
            {/* BARCODE / QR SCANNER BOX */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Search size={16} color="var(--color-primary)" /> Quét Barcode / Mã Đơn
                </label>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                  Phím tắt: [/]
                </span>
              </div>

              <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Quét mã vạch hoặc gõ mã đơn / tên BN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '0.65rem 2.4rem 0.65rem 0.85rem',
                    fontSize: '0.85rem',
                    borderRadius: '8px',
                    borderColor: searchQuery ? 'var(--color-primary)' : 'var(--border-glass)',
                    boxShadow: searchQuery ? '0 0 0 3px rgba(14, 165, 233, 0.15)' : 'none'
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--color-primary)',
                    padding: '0.3rem'
                  }}
                  title="Tìm kiếm"
                >
                  <Search size={17} />
                </button>
              </form>

              <div style={{ marginTop: '0.75rem', fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                <span>Sẵn sàng kết nối súng quét Barcode USB / Camera 2D</span>
              </div>
            </div>

            {/* PENDING QUEUE LIST */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={16} /> Đơn Chờ Cấp Phát ({pendingPrescriptions.length})
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Bấm để nạp nhanh</span>
              </div>

              {pendingPrescriptions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
                  Không có đơn thuốc nào đang chờ cấp phát!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '550px', overflowY: 'auto' }}>
                  {pendingPrescriptions.map(p => {
                    const isSelected = selectedPrescription?.prescriptionID === p.prescriptionID;
                    return (
                      <div
                        key={p.prescriptionID}
                        onClick={() => loadPrescriptionDetail(p.prescriptionID)}
                        style={{
                          padding: '0.75rem 0.85rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(14, 165, 233, 0.12)' : 'var(--bg-secondary)',
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-glass)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.85rem', color: isSelected ? 'var(--color-primary)' : 'var(--text-main)' }}>
                            {p.prescriptionCode}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            background: p.insuranceRate === 100 ? 'rgba(16, 185, 129, 0.15)' : p.insuranceRate > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: p.insuranceRate === 100 ? '#10b981' : p.insuranceRate > 0 ? '#3b82f6' : '#f59e0b'
                          }}>
                            {p.insuranceRate > 0 ? `BHYT ${p.insuranceRate}%` : 'Dịch vụ'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                          {p.patientName} {p.birthYear && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({p.gender}, {new Date().getFullYear() - p.birthYear}t)</span>}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <span>Mã vạch: {p.barcode}</span>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{p.details?.length || 0} mục thuốc</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Prescription Content, FEFO Table, Cost Separation & 1-Click Action */}
          <div>
            {!selectedPrescription ? (
              <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Search size={48} style={{ opacity: 0.3, margin: '0 auto 1rem auto' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  Chưa chọn đơn thuốc nào
                </h3>
                <p style={{ maxWidth: '420px', margin: '0 auto', fontSize: '0.85rem' }}>
                  Vui lòng quét Barcode / QR trên đơn thuốc của bệnh nhân hoặc chọn một đơn thuốc trong danh sách chờ bên trái.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* 1. PATIENT & PRESCRIPTION CARD */}
                <div className="card" style={{ padding: '1.35rem 1.5rem', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>
                          {selectedPrescription.patientName}
                        </h2>
                        {renderInsuranceBadge(selectedPrescription.insuranceRate, selectedPrescription.insuranceCardNumber)}
                        {renderStatusBadge(selectedPrescription.status)}
                      </div>

                      <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span>Mã BN: <strong style={{ color: 'var(--text-main)' }}>{selectedPrescription.patientCode}</strong></span>
                        <span>Giới tính: <strong style={{ color: 'var(--text-main)' }}>{selectedPrescription.gender}</strong></span>
                        <span>Năm sinh: <strong style={{ color: 'var(--text-main)' }}>{selectedPrescription.birthYear} ({new Date().getFullYear() - (selectedPrescription.birthYear || 1990)} tuổi)</strong></span>
                        {selectedPrescription.insuranceCardNumber && (
                          <span>Số thẻ BHYT: <strong style={{ color: '#3b82f6', letterSpacing: '0.04em' }}>{selectedPrescription.insuranceCardNumber}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Barcode & Patient Portal Preview */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'flex-end' }}>
                      <div style={{ 
                        background: '#ffffff', 
                        padding: '0.5rem 0.75rem 0.35rem 0.75rem', 
                        borderRadius: '8px', 
                        border: '1px solid #cbd5e1',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '155px',
                        position: 'relative'
                      }}>
                        <div style={{ 
                          width: '100%',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          gap: '0.5rem',
                          marginBottom: '2px',
                          paddingBottom: '2px',
                          borderBottom: '1px dashed #e2e8f0'
                        }}>
                          <span style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: '800', 
                            color: '#0369a1', 
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <ScanLine size={11} color="#0284c7" /> CODE 128
                          </span>
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: '700',
                            color: '#059669',
                            background: 'rgba(16, 185, 129, 0.1)',
                            padding: '1px 5px',
                            borderRadius: '4px'
                          }}>
                            ✓ Sẵn sàng quét
                          </span>
                        </div>

                        {/* High-density Vector Code 128 Barcode */}
                        <div style={{ background: '#ffffff', width: '100%', display: 'flex', justifyContent: 'center' }}>
                          <BarcodeRenderer 
                            value={selectedPrescription.barcode} 
                            width={1.3} 
                            height={34} 
                            fontSize={11}
                            displayValue={true}
                            lineColor="#0f172a"
                            background="#ffffff"
                          />
                        </div>
                      </div>

                      <a
                        href={`/?portal=1&code=${selectedPrescription.prescriptionCode}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.3rem 0.65rem',
                          fontSize: '0.74rem',
                          color: '#059669',
                          borderColor: 'rgba(16, 185, 129, 0.3)',
                          background: 'rgba(16, 185, 129, 0.08)',
                          textDecoration: 'none',
                          fontWeight: 700,
                          borderRadius: '6px'
                        }}
                        title="Xem trước giao diện Cổng bệnh nhân khi quét mã QR này"
                      >
                        <QrCode size={13} />
                        <span>Xem Cổng Bệnh Nhân</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>

                  {/* Diagnosis & Doctor Info Box */}
                  <div style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-glass)',
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr',
                    gap: '1rem',
                    fontSize: '0.82rem'
                  }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Chẩn đoán y khoa:</div>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                        {selectedPrescription.diagnosis}
                      </div>
                    </div>

                    <div>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Bác sĩ chỉ định & Nơi kê:</div>
                      <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>
                        {selectedPrescription.doctorName} - {selectedPrescription.departmentName}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. AUTOMATED FEFO BATCH ALLOCATION TABLE */}
                <div className="card" style={{ padding: '1.35rem 1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Layers size={18} color="var(--color-primary)" /> Danh Sách Thuốc & Tự Động Phân Bổ Lô FEFO
                      </h3>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Hệ thống tự động quét và ưu tiên xuất lô thuốc có hạn sử dụng gần nhất còn tồn tại Kho lẻ Quầy Dược
                      </p>
                    </div>

                    <div style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      ⚡ Cơ chế FEFO đang bật
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                          <th>Tên thuốc & Hàm lượng</th>
                          <th>Lô xuất (FEFO)</th>
                          <th style={{ textAlign: 'center' }}>Tồn quầy</th>
                          <th style={{ textAlign: 'center' }}>Số lượng</th>
                          <th style={{ textAlign: 'right' }}>Đơn giá</th>
                          <th style={{ textAlign: 'right' }}>Thành tiền</th>
                          <th>Hướng dẫn sử dụng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPrescription.details?.map((item, idx) => {
                          const currentSelectedBatchId = batchOverrides[item.prescriptionDetailID] || item.allocatedBatchID;
                          const currentSelectedBatch = item.availableBatches?.find(b => b.batchID === currentSelectedBatchId);

                          return (
                            <tr key={item.prescriptionDetailID}>
                              <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)' }}>
                                {idx + 1}
                              </td>

                              {/* Medicine Name */}
                              <td>
                                <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                                  {item.medicineName}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  {item.genericName} • {item.unit}
                                </div>
                              </td>

                              {/* FEFO Batch Choice */}
                              <td>
                                {item.availableBatches && item.availableBatches.length > 0 ? (
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                      <select
                                        className="form-input"
                                        style={{
                                          fontSize: '0.78rem',
                                          padding: '0.25rem 0.5rem',
                                          borderRadius: '6px',
                                          fontWeight: '600',
                                          borderColor: '#10b981',
                                          background: 'rgba(16, 185, 129, 0.05)',
                                          cursor: 'pointer'
                                        }}
                                        value={currentSelectedBatchId || ''}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value);
                                          setBatchOverrides(prev => ({ ...prev, [item.prescriptionDetailID]: val }));
                                        }}
                                        disabled={selectedPrescription.status === 'Dispensed'}
                                      >
                                        {item.availableBatches.map(b => (
                                          <option key={b.batchID} value={b.batchID}>
                                            Lô {b.batchNumber} (HSD: {b.expiryDate} • Còn {b.currentQuantity})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '600' }}>
                                      {item.fefoStatus}
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: '#ef4444', fontWeight: '700', fontSize: '0.75rem' }}>
                                    Hết hàng tại quầy
                                  </span>
                                )}
                              </td>

                              {/* Current Dispensary Stock */}
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  fontWeight: '700',
                                  color: item.totalAvailableInDispensary >= item.requestedQuantity ? '#10b981' : '#ef4444'
                                }}>
                                  {item.totalAvailableInDispensary}
                                </span>
                              </td>

                              {/* Prescribed Quantity */}
                              <td style={{ textAlign: 'center' }}>
                                <span style={{
                                  fontWeight: '800',
                                  fontSize: '0.9rem',
                                  background: 'var(--bg-secondary)',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px'
                                }}>
                                  {item.requestedQuantity}
                                </span>
                              </td>

                              {/* Unit Price */}
                              <td style={{ textAlign: 'right' }}>
                                {formatVND(item.unitPrice)}
                              </td>

                              {/* Total Amount */}
                              <td style={{ textAlign: 'right', fontWeight: '700' }}>
                                {formatVND(item.amount)}
                              </td>

                              {/* Dosage instructions */}
                              <td>
                                <div style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                                  {item.dosageInstructions}
                                </div>
                                <div style={{ display: 'flex', gap: '0.35rem', fontSize: '0.72rem' }}>
                                  {item.morningDose > 0 && <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>Sáng {item.morningDose}v</span>}
                                  {item.noonDose > 0 && <span style={{ background: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>Trưa {item.noonDose}v</span>}
                                  {item.afternoonDose > 0 && <span style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>Chiều {item.afternoonDose}v</span>}
                                  {item.nightDose > 0 && <span style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>Tối {item.nightDose}v</span>}
                                  {item.usageTime && <span style={{ color: 'var(--text-muted)' }}>({item.usageTime})</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. COST SEPARATION & 1-CLICK DISPENSE ACTION */}
                <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
                    
                    {/* Financial Summary */}
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '10px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-glass)'
                    }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                        Phân Tách Chi Phí Thanh Toán (BHYT vs Bệnh Nhân)
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Tổng chi phí tiền thuốc:</span>
                          <span style={{ fontWeight: '700' }}>{formatVND(selectedPrescription.totalAmount)}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                          <span>Quỹ BHYT chi trả ({selectedPrescription.insuranceRate}%):</span>
                          <span style={{ fontWeight: '700' }}>- {formatVND(selectedPrescription.insuranceCoverageAmount)}</span>
                        </div>

                        <div style={{
                          borderTop: '1px dashed var(--border-glass)',
                          paddingTop: '0.65rem',
                          marginTop: '0.25rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline'
                        }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: '800', color: 'var(--text-main)' }}>
                            BỆNH NHÂN CẦN THANH TOÁN:
                          </span>
                          <span style={{ fontSize: '1.35rem', fontWeight: '900', color: selectedPrescription.patientCoPayAmount > 0 ? '#ea580c' : '#10b981' }}>
                            {formatVND(selectedPrescription.patientCoPayAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {selectedPrescription.status === 'Pending' ? (
                        <>
                          <button
                            className="btn-premium"
                            onClick={handleDispense}
                            disabled={isDispensing}
                            style={{
                              padding: '0.85rem 1.25rem',
                              fontSize: '0.95rem',
                              fontWeight: '800',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                              height: '48px'
                            }}
                          >
                            {isDispensing ? (
                              <>Đang xuất kho & ghi nhận...</>
                            ) : (
                              <>
                                <CheckCircle2 size={20} /> Xuất Kho & Cấp Phát [F9]
                              </>
                            )}
                          </button>

                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                            * Hệ thống sẽ trừ tồn kho lẻ tức thời, ghi nhật ký và tự động mở phiếu thu in ấn.
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                          <div style={{
                            padding: '0.65rem',
                            borderRadius: '8px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            color: '#10b981',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            marginBottom: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem'
                          }}>
                            <CheckCircle2 size={18} /> Đơn thuốc đã cấp phát lúc {selectedPrescription.dispensedAt} bởi {selectedPrescription.dispensedBy}
                          </div>

                          <button
                            className="btn-secondary"
                            onClick={() => setPrintModalData(selectedPrescription)}
                            style={{ width: '100%', height: '42px', fontSize: '0.85rem', fontWeight: '700', justifyContent: 'center' }}
                          >
                            <Printer size={16} /> In Lại Phiếu Thu & Hướng Dẫn Sử Dụng
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DISPENSING HISTORY */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={20} color="var(--color-primary)" /> Lịch Sử Cấp Phát Thuốc Ngoại Trú
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Danh sách các đơn thuốc đã xuất kho thành công tại Quầy Dược Kho lẻ
              </p>
            </div>

            <button
              className="btn-secondary"
              onClick={loadDispensingHistory}
              style={{ height: '34px', fontSize: '0.8rem' }}
            >
              <RefreshCw size={13} /> Làm mới
            </button>
          </div>

          {historyList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Chưa có dữ liệu cấp phát trong hôm nay.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Thời gian cấp</th>
                    <th>Bệnh nhân</th>
                    <th>Đối tượng</th>
                    <th>Tổng tiền</th>
                    <th>BHYT trả</th>
                    <th>BN cùng trả</th>
                    <th>Dược sĩ cấp</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map(item => (
                    <tr key={item.prescriptionID}>
                      <td style={{ fontWeight: '700', color: 'var(--color-primary)' }}>
                        {item.prescriptionCode}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {new Date(item.dispensedAt).toLocaleString('vi-VN')}
                      </td>
                      <td>
                        <strong>{item.patientName}</strong> ({item.patientCode})
                      </td>
                      <td>
                        {renderInsuranceBadge(item.insuranceRate)}
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        {formatVND(item.totalAmount)}
                      </td>
                      <td style={{ color: '#10b981', fontWeight: '600' }}>
                        {formatVND(item.insuranceCoverageAmount)}
                      </td>
                      <td style={{ color: '#ea580c', fontWeight: '700' }}>
                        {formatVND(item.patientCoPayAmount)}
                      </td>
                      <td>
                        {item.dispensedBy}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => setPrintModalData(item)}
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', gap: '0.3rem' }}
                          title="In phiếu thu"
                        >
                          <Printer size={13} /> In phiếu
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DISPENSARY LIVE STOCKS */}
      {activeTab === 'inventory' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={20} color="var(--color-primary)" /> Tồn Kho Quầy Dược Ngoại Trú (Kho Lẻ)
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Tồn khả dụng theo từng mặt hàng tại Khoa Khám Bệnh / Quầy Dược (DepartmentID = 1)
              </p>
            </div>

            <button
              className="btn-secondary"
              onClick={loadDispensaryStocks}
              style={{ height: '34px', fontSize: '0.8rem' }}
            >
              <RefreshCw size={13} /> Làm mới
            </button>
          </div>

          <div className="table-responsive">
            <table className="table" style={{ width: '100%', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>STT</th>
                  <th>Tên thuốc</th>
                  <th>Hoạt chất</th>
                  <th>Đơn vị tính</th>
                  <th style={{ textAlign: 'center' }}>Tồn kho quầy</th>
                  <th style={{ textAlign: 'right' }}>Giá bán lẻ tham chiếu</th>
                  <th>Tình trạng tồn</th>
                </tr>
              </thead>
              <tbody>
                {dispensaryStocks.map((m, i) => (
                  <tr key={m.medicineID}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: '700' }}>{m.medicineName}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{m.genericName}</td>
                    <td>{m.unit}</td>
                    <td style={{ textAlign: 'center', fontWeight: '800', color: m.totalStock > 20 ? '#10b981' : '#f59e0b' }}>
                      {m.totalStock}
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatVND(m.defaultPrice)}</td>
                    <td>
                      {m.totalStock > 50 ? (
                        <span style={{ color: '#10b981', fontWeight: '600' }}>● Dồi dào</span>
                      ) : m.totalStock > 0 ? (
                        <span style={{ color: '#f59e0b', fontWeight: '600' }}>▲ Bình thường</span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: '700' }}>✕ Hết hàng</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PATIENT ADR & FEEDBACKS */}
      {activeTab === 'adr' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                <AlertTriangle size={20} color="#ef4444" /> Báo Cáo Phản Ứng Bất Thường / Tác Dụng Phụ (ADR)
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Các phản hồi, triệu chứng dị ứng và phản ánh bất thường gửi trực tiếp từ điện thoại bệnh nhân qua Cổng QR
              </p>
            </div>

            <button
              className="btn-secondary"
              onClick={loadAdrReports}
              style={{ height: '34px', fontSize: '0.8rem' }}
            >
              <RefreshCw size={13} className={loadingAdr ? 'spin' : ''} /> Làm mới
            </button>
          </div>

          {adrReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>Chưa có phản ánh ADR nào từ bệnh nhân!</div>
              <p style={{ fontSize: '0.82rem', maxWidth: '400px', margin: '0.35rem auto 0 auto' }}>
                Khi bệnh nhân quét mã QR trên toa thuốc và báo cáo triệu chứng lạ, danh sách sẽ hiển thị ngay tại đây để Dược sĩ liên hệ tư vấn.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Mã Đơn</th>
                    <th>Thời Gian Gửi</th>
                    <th>Bệnh Nhân & Số Điện Thoại</th>
                    <th>Thuốc Nghi Ngờ</th>
                    <th>Triệu Chứng Phản Ứng</th>
                    <th style={{ textAlign: 'center' }}>Mức Độ</th>
                    <th style={{ textAlign: 'center' }}>Trạng Thái</th>
                    <th style={{ textAlign: 'center' }}>Xử Lý</th>
                  </tr>
                </thead>
                <tbody>
                  {adrReports.map(item => (
                    <tr key={item.reportID}>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {item.prescriptionCode}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(item.reportedAt).toLocaleString('vi-VN')}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.patientName}</div>
                        {item.patientPhone ? (
                          <a
                            href={`tel:${item.patientPhone}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              color: '#0284c7',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              marginTop: '2px'
                            }}
                          >
                            <Phone size={12} /> {item.patientPhone}
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>(Chưa có SĐT)</span>
                        )}
                      </td>
                      <td>
                        <strong style={{ color: '#b91c1c' }}>{item.suspectedMedicineName || 'Cả đơn'}</strong>
                      </td>
                      <td style={{ maxWidth: '280px', fontSize: '0.82rem' }}>
                        <div>{item.symptoms}</div>
                        {item.onsetDelay && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Khởi phát: {item.onsetDelay}
                          </div>
                        )}
                        {item.pharmacistNotes && (
                          <div style={{ fontSize: '0.74rem', color: '#059669', background: 'rgba(5, 150, 105, 0.08)', padding: '0.2rem 0.4rem', borderRadius: '4px', marginTop: '4px' }}>
                            <strong>DS ghi chú:</strong> {item.pharmacistNotes}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '12px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          background: item.severity === 'Nghiêm trọng' ? 'rgba(239, 68, 68, 0.15)' : item.severity === 'Trung bình' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: item.severity === 'Nghiêm trọng' ? '#dc2626' : item.severity === 'Trung bình' ? '#d97706' : '#059669',
                          border: item.severity === 'Nghiêm trọng' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          {item.severity}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: item.status === 'Resolved' ? '#059669' : item.status === 'Contacted' ? '#2563eb' : '#ea580c'
                        }}>
                          {item.status === 'Resolved' ? 'Đã giải quyết' : item.status === 'Contacted' ? 'Đã gọi tư vấn' : 'Chờ xử lý'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setSelectedAdr(item);
                            setAdrNoteInput(item.pharmacistNotes || '');
                          }}
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.76rem' }}
                        >
                          Cập nhật
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: PRINTABLE MEDICAL INVOICE & DOSAGE SCHEDULE */}
      {printModalData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', width: '92%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <button
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#888'
              }}
              onClick={() => setPrintModalData(null)}
              title="Đóng"
            >
              <X size={20} />
            </button>

            {/* Printable Area */}
            <div id="printable-dispense-receipt" style={{ background: '#ffffff', color: '#0f172a', padding: '1.5rem', borderRadius: '8px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase' }}>
                    SỞ Y TẾ TP. HỒ CHÍ MINH
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '900', color: '#0284c7' }}>
                    BỆNH VIỆN ĐA KHOA QUỐC TẾ HIS
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Khoa Dược - Quầy Dược Ngoại Trú / BHYT | Hotline: (028) 3822 5588
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Mẫu số: 01/BV-DUOC (Bộ Y Tế)</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#dc2626', marginBottom: '2px' }}>
                    MÃ ĐƠN: {printModalData.prescriptionCode}
                  </div>
                  <div style={{ 
                    background: '#ffffff', 
                    padding: '2px 4px', 
                    borderRadius: '4px', 
                    border: '1px solid #cbd5e1',
                    display: 'inline-block'
                  }}>
                    <BarcodeRenderer 
                      value={printModalData.barcode} 
                      width={1.2} 
                      height={26} 
                      fontSize={10} 
                      lineColor="#000000" 
                      background="#ffffff"
                    />
                  </div>
                </div>
              </div>

              {/* Title */}
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  PHIẾU THU TIỀN THUỐC & HƯỚNG DẪN SỬ DỤNG
                </h2>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.2rem' }}>
                  (Cấp phát ngoại trú - Áp dụng cơ chế xuất kho FEFO chuẩn GPP)
                </div>
              </div>

              {/* Patient Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.75rem', fontSize: '0.82rem', marginBottom: '1.25rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '6px' }}>
                <div>
                  <div>Họ và tên: <strong style={{ textTransform: 'uppercase' }}>{printModalData.patientName}</strong></div>
                  <div>Mã bệnh nhân: <strong>{printModalData.patientCode}</strong> | Năm sinh: <strong>{printModalData.birthYear}</strong> ({printModalData.gender})</div>
                  <div>Địa chỉ: {printModalData.address || 'TP. Hồ Chí Minh'}</div>
                  <div>Chẩn đoán: <strong>{printModalData.diagnosis}</strong></div>
                </div>

                <div>
                  <div>Đối tượng: <strong>{printModalData.insuranceRate > 0 ? `BHYT (${printModalData.insuranceRate}%)` : 'Khám Dịch Vụ'}</strong></div>
                  {printModalData.insuranceCardNumber && (
                    <div>Số thẻ BHYT: <strong style={{ color: '#0284c7' }}>{printModalData.insuranceCardNumber}</strong></div>
                  )}
                  <div>Bác sĩ kê đơn: <strong>{printModalData.doctorName}</strong></div>
                  <div>Thời gian cấp: {printModalData.dispensedAt || new Date().toLocaleString('vi-VN')}</div>
                </div>
              </div>

              {/* Medicine Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'center', width: '35px' }}>STT</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Tên thuốc & Quy cách</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Lô (FEFO) / HSD</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>SL</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Đơn giá</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Thành tiền</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Cách dùng (Liều lượng)</th>
                  </tr>
                </thead>
                <tbody>
                  {printModalData.details?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.45rem', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '0.45rem' }}>
                        <div style={{ fontWeight: '700' }}>{item.medicineName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.unit}</div>
                      </td>
                      <td style={{ padding: '0.45rem', textAlign: 'center', fontSize: '0.75rem' }}>
                        <div>{item.allocatedBatchNumber || 'N/A'}</div>
                        <div style={{ color: '#64748b' }}>{item.allocatedBatchExpiry || ''}</div>
                      </td>
                      <td style={{ padding: '0.45rem', textAlign: 'center', fontWeight: '700' }}>
                        {item.requestedQuantity || item.dispensedQuantity}
                      </td>
                      <td style={{ padding: '0.45rem', textAlign: 'right' }}>
                        {formatVND(item.unitPrice)}
                      </td>
                      <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: '700' }}>
                        {formatVND(item.amount)}
                      </td>
                      <td style={{ padding: '0.45rem', fontSize: '0.75rem' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{item.dosageInstructions}</div>
                        <div style={{ color: '#0284c7' }}>
                          {item.morningDose > 0 ? `Sáng: ${item.morningDose} ` : ''}
                          {item.noonDose > 0 ? `Trưa: ${item.noonDose} ` : ''}
                          {item.afternoonDose > 0 ? `Chiều: ${item.afternoonDose} ` : ''}
                          {item.nightDose > 0 ? `Tối: ${item.nightDose} ` : ''}
                          {item.usageTime ? `(${item.usageTime})` : ''}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Box */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <div style={{ width: '340px', fontSize: '0.82rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span>Tổng tiền thuốc:</span>
                    <strong>{formatVND(printModalData.totalAmount)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: '#0284c7' }}>
                    <span>Quỹ BHYT chi trả ({printModalData.insuranceRate}%):</span>
                    <strong>- {formatVND(printModalData.insuranceCoverageAmount)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '0.4rem', fontSize: '0.92rem', color: '#dc2626' }}>
                    <strong>BỆNH NHÂN ĐỒNG CHI TRẢ:</strong>
                    <strong>{formatVND(printModalData.patientCoPayAmount)}</strong>
                  </div>
                </div>
              </div>

              {/* Patient Portal QR Code Box */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                background: '#f8fafc',
                border: '1.5px dashed #0284c7',
                padding: '0.85rem 1.25rem',
                borderRadius: '8px',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  background: '#ffffff',
                  padding: '6px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <QRCodeSVG 
                    value={`${window.location.origin}/?portal=1&code=${printModalData.prescriptionCode}`} 
                    size={80}
                    level="M"
                  />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    📱 QUÉT MÃ QR BẰNG ĐIỆN THOẠI ĐỂ XEM HƯỚNG DẪN & BÁO CÁO TÁC DỤNG PHỤ (ADR)
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px', lineHeight: 1.45 }}>
                    Bệnh nhân dùng camera điện thoại quét mã QR để xem: <strong>Lịch uống thuốc 4 buổi chi tiết, hình ảnh nhận diện viên thuốc, các thực phẩm cần kiêng khem (trà, sữa, rượu bia)</strong> và gửi <strong>Báo cáo tác dụng phụ / Dị ứng thuốc</strong> trực tiếp đến Dược sĩ bệnh viện.
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#0284c7', fontFamily: 'monospace', marginTop: '3px' }}>
                    {window.location.origin}/?portal=1&code={printModalData.prescriptionCode}
                  </div>
                </div>
              </div>

              {/* Signatures & Red Seal */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', fontSize: '0.8rem', marginTop: '1.5rem', alignItems: 'start' }}>
                {/* Column 1: Patient */}
                <div>
                  <div><strong>Bệnh nhân / Người nhận</strong></div>
                  <div style={{ fontStyle: 'italic', fontSize: '0.72rem', color: '#64748b' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ height: '75px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {printModalData.patientSignature && printModalData.patientSignature.startsWith('data:image') ? (
                      <img src={printModalData.patientSignature} alt="Chữ ký bệnh nhân" style={{ maxHeight: '50px', maxWidth: '120px', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '70%', borderBottom: '1px dashed #94a3b8', marginTop: '35px' }}></div>
                    )}
                  </div>
                  <div><strong>{printModalData.patientName}</strong></div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Đã đối chiếu thông tin toa</div>
                </div>

                {/* Column 2: Doctor */}
                <div>
                  <div><strong>Bác sĩ kê đơn</strong></div>
                  <div style={{ fontStyle: 'italic', fontSize: '0.72rem', color: '#64748b' }}>(Ký số điện tử y tế)</div>
                  <div style={{ height: '75px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {renderDoctorSignature(printModalData)}
                    <div style={{ fontSize: '0.65rem', color: '#0284c7', fontWeight: '700', marginTop: '-4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <span>✓ E-Signed</span>
                      <span style={{ fontSize: '0.58rem', color: '#64748b', fontWeight: 'normal' }}>
                        ({printModalData.prescribedAt ? String(printModalData.prescribedAt).substring(0, 10) : new Date().toISOString().substring(0, 10)})
                      </span>
                    </div>
                  </div>
                  <div><strong>{printModalData.doctorName || 'BS.CKII. Nguyễn Hữu Lực'}</strong></div>
                  <div style={{ fontSize: '0.68rem', color: '#0369a1', fontWeight: '600' }}>Chứng thư số y tế SHA-256 Validated</div>
                </div>

                {/* Column 3: Dispensing Pharmacist with Stamp Overlap */}
                <div style={{ position: 'relative' }}>
                  <div><strong>Dược sĩ Cấp phát</strong></div>
                  <div style={{ fontStyle: 'italic', fontSize: '0.72rem', color: '#64748b' }}>(Xác nhận xuất kho lẻ GPP)</div>
                  
                  <div style={{ height: '75px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {/* Pharmacist Signature Stroke */}
                    <div style={{ zIndex: 1 }}>
                      {renderDispenserSignature(printModalData, user)}
                    </div>

                    {/* Clinic Red Stamp simulation */}
                    <div style={{
                      position: 'absolute',
                      top: '-5px',
                      left: '52%',
                      transform: 'translateX(-50%) rotate(-8deg)',
                      border: '3px solid #dc2626',
                      borderRadius: '50%',
                      width: '85px',
                      height: '85px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#dc2626',
                      fontSize: '0.62rem',
                      fontWeight: '900',
                      textTransform: 'uppercase',
                      opacity: 0.85,
                      pointerEvents: 'none',
                      zIndex: 2,
                      mixBlendMode: 'multiply'
                    }}>
                      <span>BV QUỐC TẾ</span>
                      <span style={{ fontSize: '0.55rem' }}>★ ★ ★</span>
                      <span>KHOA DƯỢC</span>
                    </div>
                  </div>

                  <div><strong>{printModalData.dispensedBy || user?.fullName || 'Dược sĩ Nguyễn Thị Thảo'}</strong></div>
                  <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: '600' }}>Đã xác nhận kiểm nhập & xuất kho GPP</div>
                </div>
              </div>

              {/* Footer Note */}
              <div style={{ marginTop: '2rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem', fontSize: '0.72rem', color: '#64748b', textAlign: 'center' }}>
                * Bệnh nhân vui lòng kiểm tra kỹ số lượng, hạn dùng của thuốc trước khi rời quầy. Uống thuốc đúng liều lượng và giờ theo hướng dẫn.
              </div>
            </div>

            {/* Modal Bottom Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-secondary"
                  onClick={() => setSignatureModal({ target: 'dispenser', title: `Ký xác nhận Dược sĩ Cấp phát (${printModalData.dispensedBy || user?.fullName || 'Dược sĩ'})` })}
                  style={{ height: '38px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0369a1', borderColor: '#0284c7' }}
                  title="Vẽ chữ ký tay hoặc áp dụng chữ ký số Dược sĩ"
                >
                  <PenTool size={14} /> ✍ Ký / Đổi chữ ký Dược sĩ
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => setSignatureModal({ target: 'patient', title: `Chữ ký Bệnh nhân nhận thuốc (${printModalData.patientName})` })}
                  style={{ height: '38px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  title="Cho bệnh nhân ký trực tiếp tại quầy thuốc"
                >
                  <PenTool size={14} /> ✍ Bệnh nhân ký nhận
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn-secondary"
                  onClick={() => setPrintModalData(null)}
                  style={{ height: '38px', padding: '0 1rem' }}
                >
                  Đóng cửa sổ
                </button>

                <button
                  className="btn-premium"
                  onClick={() => {
                    const printContents = document.getElementById('printable-dispense-receipt').innerHTML;
                    const win = window.open('', '', 'height=800,width=900');
                    win.document.write('<html><head><title>Phiếu Cấp Thuốc Ngoại Trú</title>');
                    win.document.write('<style>body { font-family: Arial, sans-serif; margin: 20px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #cbd5e1; padding: 6px; } @media print { @page { size: A4; margin: 15mm; } }</style>');
                    win.document.write('</head><body>');
                    win.document.write(printContents);
                    win.document.write('</body></html>');
                    win.document.close();
                    win.focus();
                    setTimeout(() => {
                      win.print();
                      win.close();
                    }, 300);
                  }}
                  style={{ height: '38px', padding: '0 1.25rem', gap: '0.45rem' }}
                >
                  <Printer size={16} /> In Phiếu Thu (A4)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TIEP NHAN VA KE DON THUOC NGOAI TRU */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '820px', width: '92%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <button
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#888'
              }}
              onClick={() => setShowCreateModal(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} color="var(--color-primary)" /> Tiếp Nhận & Kê Đơn Thuốc Ngoại Trú (Phòng Khám)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              Lập đơn thuốc khám bệnh ngoại trú — Dữ liệu tự động đồng bộ tức thì sang Quầy Dược và cấp phát theo lô FEFO
            </p>

            <form onSubmit={handleCreatePrescriptionSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: '600' }}>Họ tên Bệnh nhân *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: Vũ Thị Minh Ngọc"
                    value={newPresc.patientName}
                    onChange={(e) => setNewPresc(prev => ({ ...prev, patientName: e.target.value }))}
                    required
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: '600' }}>Năm sinh</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    placeholder="VD: 1990"
                    maxLength={4}
                    value={newPresc.birthYear}
                    onKeyDown={handleIntegerKeyDown}
                    onPaste={(e) => handleIntegerPaste(e, (val) => setNewPresc(prev => ({ ...prev, birthYear: val.slice(0, 4) })), false)}
                    onChange={(e) => {
                      const cleanVal = sanitizeInteger(e.target.value, false).slice(0, 4);
                      setNewPresc(prev => ({ ...prev, birthYear: cleanVal }));
                    }}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: '600' }}>Giới tính</label>
                  <select
                    className="form-input"
                    value={newPresc.gender}
                    onChange={(e) => setNewPresc(prev => ({ ...prev, gender: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: '600' }}>Đối tượng thanh toán *</label>
                  <select
                    className="form-input"
                    value={newPresc.insuranceRate}
                    onChange={(e) => setNewPresc(prev => ({ ...prev, insuranceRate: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="80">BHYT 80% (Bệnh nhân cùng trả 20%)</option>
                    <option value="100">BHYT 100% (Hưu trí / Đối tượng chính sách - 0đ)</option>
                    <option value="0">Khám Dịch Vụ 100% (Không dùng BHYT)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: '600' }}>Số thẻ BHYT (nếu có)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: DN4791234567890"
                    value={newPresc.insuranceCardNumber}
                    onChange={(e) => setNewPresc(prev => ({ ...prev, insuranceCardNumber: e.target.value }))}
                    disabled={parseInt(newPresc.insuranceRate) === 0}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: '600' }}>Chẩn đoán bệnh (ICD-10)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newPresc.diagnosis}
                    onChange={(e) => setNewPresc(prev => ({ ...prev, diagnosis: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: '600' }}>
                    Bác sĩ kê đơn * <span style={{ color: '#0284c7' }}>({getDoctorForUser(user)})</span>
                  </label>
                  <select
                    className="form-input"
                    value={newPresc.doctorName}
                    onChange={(e) => setNewPresc(prev => ({ ...prev, doctorName: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-primary)' }}
                  >
                    {(() => {
                      const userDocName = getDoctorForUser(user);
                      const docs = [...HOSPITAL_DOCTORS];
                      if (!docs.some(d => d.name === userDocName)) {
                        docs.unshift({
                          username: user?.username || 'current',
                          name: userDocName,
                          title: user?.departmentName ? `Bác sĩ ${user.departmentName}` : 'Bác sĩ điều trị',
                          deptId: user?.departmentID || 1
                        });
                      }
                      return docs.map(doc => {
                        const isCurrent = doc.name === userDocName;
                        return (
                          <option key={doc.username} value={doc.name}>
                            {doc.name} - {doc.title} {isCurrent ? '★ (Tài khoản đang đăng nhập)' : ''}
                          </option>
                        );
                      });
                    })()}
                  </select>
                </div>
              </div>

              {/* Medicine Picker */}
              <div style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>Danh Mục Thuốc Kê Đơn</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '6px' }}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddMedicineToPrescription(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>+ Chọn thuốc từ quầy Dược...</option>
                      {dispensaryStocks.map(m => (
                        <option key={m.medicineID} value={m.medicineID}>
                          {m.medicineName} ({m.unit} • Tồn {m.totalStock})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {newPresc.selectedMedicines.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Chưa có thuốc nào được chọn. Chọn từ danh sách thả xuống ở trên.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {newPresc.selectedMedicines.map((med, idx) => (
                      <div
                        key={med.medicineID}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.5fr 80px 1.5fr 30px',
                          gap: '0.75rem',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-glass)'
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.85rem' }}>{med.medicineName}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatVND(med.unitPrice)} / {med.unit}</div>
                        </div>

                        <div>
                          <input
                            type="number"
                            className="form-input"
                            min="1"
                            value={med.requestedQuantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setNewPresc(prev => ({
                                ...prev,
                                selectedMedicines: prev.selectedMedicines.map((m, i) => i === idx ? { ...m, requestedQuantity: val } : m)
                              }));
                            }}
                            style={{ width: '100%', padding: '0.3rem', fontSize: '0.82rem', textAlign: 'center' }}
                            title="Số lượng"
                          />
                        </div>

                        <div>
                          <input
                            type="text"
                            className="form-input"
                            value={med.dosageInstructions}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewPresc(prev => ({
                                ...prev,
                                selectedMedicines: prev.selectedMedicines.map((m, i) => i === idx ? { ...m, dosageInstructions: val } : m)
                              }));
                            }}
                            placeholder="Hướng dẫn liều dùng..."
                            style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                          />
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setNewPresc(prev => ({
                                ...prev,
                                selectedMedicines: prev.selectedMedicines.filter((_, i) => i !== idx)
                              }));
                            }}
                            style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                            title="Xóa thuốc"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  style={{ height: '38px', padding: '0 1rem' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn-premium"
                  style={{ height: '38px', padding: '0 1.25rem' }}
                >
                  <Check size={16} /> Lưu & Chuyển Quầy Dược Cấp Phát
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL 3: ADR RESOLUTION MODAL */}
      {selectedAdr && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', width: '92%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                Cập Nhật Xử Lý Phản Ánh ADR #{selectedAdr.reportID}
              </h3>
              <button
                onClick={() => setSelectedAdr(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', marginBottom: '1rem', background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '8px' }}>
              <div>Bệnh nhân: <strong>{selectedAdr.patientName}</strong> {selectedAdr.patientPhone && `• SĐT: ${selectedAdr.patientPhone}`}</div>
              <div>Mã đơn thuốc: <strong>{selectedAdr.prescriptionCode}</strong></div>
              <div>Thuốc nghi ngờ: <strong style={{ color: '#ef4444' }}>{selectedAdr.suspectedMedicineName}</strong></div>
              <div>Triệu chứng: {selectedAdr.symptoms}</div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Trạng thái giải quyết:
              </label>
              <select
                id="adr-status-select"
                defaultValue={selectedAdr.status}
                className="form-input"
                style={{ width: '100%', fontSize: '0.85rem' }}
              >
                <option value="New">Chờ xử lý (Mới nhận)</option>
                <option value="Contacted">Đã liên hệ điện thoại tư vấn bệnh nhân</option>
                <option value="Resolved">Đã giải quyết / Đổi thuốc / Khám lại</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Ghi chú chuyên môn của Dược sĩ:
              </label>
              <textarea
                rows={3}
                value={adrNoteInput}
                onChange={(e) => setAdrNoteInput(e.target.value)}
                placeholder="Ghi lại nội dung đã dặn bệnh nhân (vd: Đã hướng dẫn ngưng thuốc, uống nhiều nước, đến viện đổi sang nhóm thuốc khác)..."
                className="form-input"
                style={{ width: '100%', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedAdr(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-premium"
                onClick={async () => {
                  const newStatus = document.getElementById('adr-status-select')?.value || selectedAdr.status;
                  try {
                    const res = await fetch(`/api/patientportal/adr-reports/${selectedAdr.reportID}/status`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        status: newStatus,
                        pharmacistNotes: adrNoteInput,
                        reviewedBy: user?.fullName || 'Dược sĩ Quầy Ngoại Trú'
                      })
                    });
                    if (res.ok) {
                      showToast('Cập nhật trạng thái xử lý ADR thành công!');
                      setSelectedAdr(null);
                      loadAdrReports();
                    }
                  } catch (e) {
                    alert('Lỗi cập nhật');
                  }
                }}
              >
                Lưu Xử Lý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL SIGNATURE CANVAS MODAL */}
      {signatureModal && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.65)', zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '92%', padding: '1.5rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
                <PenTool size={18} /> {signatureModal.title}
              </h3>
              <button
                onClick={() => setSignatureModal(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.45 }}>
              Vui lòng vẽ nét chữ ký tay lên khung bên dưới (bằng chuột hoặc màn hình cảm ứng) hoặc chọn <strong>Dùng chữ ký số chuẩn</strong> để hệ thống tự động điền nét ký xác thực y tế.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)' }}>
                Khung ký tên điện tử <span style={{ color: '#ef4444' }}>*</span>
              </span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={clearCanvas}
                  style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.55rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Eraser size={12} /> Xóa nét
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={applyDefaultSignatureToCanvas}
                  style={{ fontSize: '0.72rem', height: '26px', padding: '0 0.55rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#0284c7', borderColor: '#0284c7' }}
                >
                  <Sparkles size={12} /> Dùng chữ ký số chuẩn
                </button>
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '2px dashed #94a3b8',
              borderRadius: '8px',
              overflow: 'hidden',
              height: '160px',
              marginBottom: '1.25rem',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.06)'
            }}>
              <canvas
                ref={canvasRef}
                width="480"
                height="160"
                style={{ width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSignatureModal(null)}
                style={{ height: '36px', fontSize: '0.82rem' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn-premium"
                onClick={handleSaveSignature}
                style={{ height: '36px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Check size={16} /> Xác nhận & Lưu chữ ký
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
