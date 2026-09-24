import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeftRight, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Building2, 
  FileText, 
  Printer, 
  CheckCircle2, 
  X, 
  Search, 
  Filter, 
  TrendingUp, 
  ShieldAlert, 
  ShieldCheck, 
  HelpCircle, 
  ChevronRight, 
  Info,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Ban,
  PenTool,
  Eraser,
  SlidersHorizontal,
  FileCheck2,
  ChevronDown,
  Gauge,
  Activity,
  Zap,
  TrendingDown,
  Percent,
  Warehouse
} from 'lucide-react';
import { handleIntegerKeyDown, sanitizeInteger, handleIntegerPaste } from '../utils/numberInputUtils';

const SIG = {
  duoc: (
    <svg width="100" height="50" viewBox="0 0 120 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M15,35 C30,15 45,5 55,25 C65,45 80,45 95,20 C105,5 110,15 115,25 M35,45 C50,35 70,25 90,40" fill="none" stroke="#0284c7" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  khoa: (
    <svg width="100" height="50" viewBox="0 0 120 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M10,25 Q30,45 50,20 T90,30 T110,15 M20,15 C40,25 60,35 80,20" fill="none" stroke="#0284c7" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
};

const RedStamp = ({ name = "DS. TRƯỞNG KHOA" }) => (
  <svg width="85" height="85" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.88 }}>
    <circle cx="60" cy="60" r="52" fill="none" stroke="#dc2626" strokeWidth="3" />
    <circle cx="60" cy="60" r="46" fill="none" stroke="#dc2626" strokeWidth="1.2" />
    <defs>
      <path id="stampPathTop" d="M 18 60 A 42 42 0 0 1 102 60" fill="none" />
      <path id="stampPathBottom" d="M 102 60 A 42 42 0 0 1 18 60" fill="none" />
    </defs>
    <text fill="#dc2626" fontSize="7" fontFamily="Arial, sans-serif" fontWeight="bold" letterSpacing="0.4">
      <textPath href="#stampPathTop" startOffset="50%" textAnchor="middle">BỆNH VIỆN ĐA KHOA HIS PHARMACY</textPath>
    </text>
    <text fill="#dc2626" fontSize="7.5" fontFamily="Arial, sans-serif" fontWeight="bold" letterSpacing="0.8">
      <textPath href="#stampPathBottom" startOffset="50%" textAnchor="middle">KHOA DƯỢC ★</textPath>
    </text>
    <text x="60" y="52" fill="#dc2626" fontSize="10" fontFamily="Times New Roman, serif" fontWeight="bold" textAnchor="middle">ĐÃ DUYỆT</text>
    <text x="60" y="66" fill="#dc2626" fontSize="6.5" fontFamily="Arial, sans-serif" fontWeight="bold" textAnchor="middle">{name}</text>
  </svg>
);

export default function ShortDatedClearance({ user, setPage }) {
  const [data, setData] = useState({
    summary: {
      totalRiskBatches: 0,
      totalUnitsAtRisk: 0,
      totalEstimatedLoss: 0,
      transferableCount: 0,
      vendorReturnCount: 0,
      criticalCount: 0
    },
    items: [],
    departments: []
  });

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState('ALL'); // 'ALL', 'CRITICAL', 'VENDOR', 'TRANSFER'
  const [filterLocation, setFilterLocation] = useState('ALL'); // 'ALL', 'MAINSTORE', or deptId
  const [daysThreshold, setDaysThreshold] = useState(180);
  const [showInfoBanner, setShowInfoBanner] = useState(false);

  // Modals state
  const [transferModalItem, setTransferModalItem] = useState(null);
  const [transferTargetDept, setTransferTargetDept] = useState('');
  const [transferQuantity, setTransferQuantity] = useState(1);
  const [transferNotes, setTransferNotes] = useState('');
  const [transferSignature, setTransferSignature] = useState(null);

  const [vendorModalItem, setVendorModalItem] = useState(null);
  const [vendorQuantity, setVendorQuantity] = useState(1);
  const [vendorReason, setVendorReason] = useState('Lô thuốc cận hạn sử dụng (< 90 ngày) theo cam kết hợp đồng thầu');
  const [vendorNotes, setVendorNotes] = useState('');
  const [vendorSignature, setVendorSignature] = useState(null);

  const [matrixModalItem, setMatrixModalItem] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixData, setMatrixData] = useState(null);

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  // Horizontal Scroll Drag State & Handlers
  const tableContainerRef = useRef(null);
  const [scrollPercent, setScrollPercent] = useState(0);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const checkScrollability = () => {
    if (!tableContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tableContainerRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollPercent((scrollLeft / maxScroll) * 100);
    } else {
      setScrollPercent(0);
    }
  };

  const handleTableScroll = () => {
    checkScrollability();
  };

  const handleRangeScroll = (e) => {
    const val = Number(e.target.value);
    setScrollPercent(val);
    if (tableContainerRef.current) {
      const { scrollWidth, clientWidth } = tableContainerRef.current;
      const maxScroll = scrollWidth - clientWidth;
      tableContainerRef.current.scrollLeft = (val / 100) * maxScroll;
    }
  };

  const scrollByAmount = (amount) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const scrollToPosition = (pos) => {
    if (tableContainerRef.current) {
      const { scrollWidth, clientWidth } = tableContainerRef.current;
      tableContainerRef.current.scrollTo({ 
        left: pos === 'end' ? scrollWidth - clientWidth : 0, 
        behavior: 'smooth' 
      });
    }
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a') || e.target.closest('select')) return;
    isMouseDownRef.current = true;
    startXRef.current = e.pageX - (tableContainerRef.current?.offsetLeft || 0);
    scrollLeftRef.current = tableContainerRef.current?.scrollLeft || 0;
    if (tableContainerRef.current) {
      tableContainerRef.current.style.cursor = 'grabbing';
      tableContainerRef.current.style.userSelect = 'none';
    }
  };

  const handleMouseMove = (e) => {
    if (!isMouseDownRef.current || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - (tableContainerRef.current.offsetLeft || 0);
    const walk = (x - startXRef.current) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    if (isMouseDownRef.current && tableContainerRef.current) {
      isMouseDownRef.current = false;
      tableContainerRef.current.style.cursor = 'grab';
      tableContainerRef.current.style.removeProperty('user-select');
    }
  };

  const authHeaders = {
    'X-User-Role': user?.role || 'pharmacist',
    'X-User-DeptID': user?.departmentID ? user.departmentID.toString() : '',
    'X-User-FullName': encodeURIComponent(user?.fullName || 'Thủ kho Dược')
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clearance/analyze?daysThreshold=${daysThreshold}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const json = await res.json();
        setData({
          summary: json.summary || json.Summary || {},
          items: json.items || json.Items || [],
          departments: json.departments || json.Departments || []
        });
      }
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu phân tích cận date:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handlePharmacyUpdate = (e) => {
      if (e.detail === 'Clearance' || e.detail === 'Inventory') {
        fetchData();
      }
    };
    window.addEventListener('pharmacy-update', handlePharmacyUpdate);
    return () => window.removeEventListener('pharmacy-update', handlePharmacyUpdate);
  }, [daysThreshold]);

  // Setup Canvas Signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0284c7';

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const start = (e) => {
      e.preventDefault();
      isDrawing.current = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const stop = () => {
      isDrawing.current = false;
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
  }, [transferModalItem, vendorModalItem]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getCanvasSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const pixelBuffer = new Uint32Array(
      canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    const hasDrawn = pixelBuffer.some(color => color !== 0);
    return hasDrawn ? canvas.toDataURL('image/png') : null;
  };

  // Open Transfer Modal
  const handleOpenTransfer = (item) => {
    setTransferModalItem(item);
    setTransferTargetDept(item.recommendedTargetDeptID || '');
    setTransferQuantity(item.recommendedTransferQty || item.estimatedWaste || 1);
    setTransferNotes(`Điều chuyển tối ưu giải phóng thuốc cận date lô ${item.batchNumber} (HSD: ${new Date(item.expiryDate).toLocaleDateString('vi-VN')})`);
    setTransferSignature(null);
  };

  // Execute Transfer Action
  const handleConfirmTransfer = async () => {
    if (!transferTargetDept) {
      alert("Vui lòng chọn Khoa phòng tiếp nhận thuốc.");
      return;
    }
    const qty = parseInt(transferQuantity);
    if (!qty || qty <= 0 || qty > transferModalItem.currentQuantity) {
      alert(`Số lượng chuyển không hợp lệ. Tối đa hiện có: ${transferModalItem.currentQuantity}`);
      return;
    }

    const sig = transferSignature || getCanvasSignature();

    try {
      const payload = {
        batchID: transferModalItem.batchID,
        sourceLocationType: transferModalItem.locationType,
        sourceDepartmentID: transferModalItem.departmentID,
        targetDepartmentID: parseInt(transferTargetDept),
        quantity: qty,
        notes: transferNotes,
        digitalSignature: sig,
        approverName: user?.fullName || "Thủ kho Dược"
      };

      const res = await fetch('/api/clearance/execute-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("Lệnh điều chuyển đã được thực thi thành công! Thuốc đã được trừ kho nguồn và cộng vào kho đích.");
        setTransferModalItem(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || "Có lỗi xảy ra khi thực hiện điều chuyển.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ.");
    }
  };

  // Open Vendor Return Modal
  const handleOpenVendorReturn = (item) => {
    setVendorModalItem(item);
    setVendorQuantity(item.currentQuantity);
    setVendorReason('Lô thuốc cận hạn sử dụng (≤ 90 ngày) theo cam kết hợp đồng thầu');
    setVendorNotes(`Đề nghị đổi date mới có hạn dùng tối thiểu 18 tháng`);
    setVendorSignature(null);
  };

  // Confirm Vendor Return
  const handleConfirmVendorReturn = async () => {
    const qty = parseInt(vendorQuantity);
    if (!qty || qty <= 0 || qty > vendorModalItem.currentQuantity) {
      alert(`Số lượng không hợp lệ. Tối đa: ${vendorModalItem.currentQuantity}`);
      return;
    }

    const sig = vendorSignature || getCanvasSignature();

    try {
      const payload = {
        batchID: vendorModalItem.batchID,
        quantity: qty,
        reason: vendorReason,
        notes: vendorNotes,
        approverName: user?.fullName || "Thủ kho Dược",
        digitalSignature: sig
      };

      const res = await fetch('/api/clearance/vendor-return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("Biên bản đổi date đã được khởi tạo và gửi lưu hồ sơ thầu. Lô thuốc đã được khóa xuất lâm sàng.");
        setVendorModalItem(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.message || "Có lỗi xảy ra khi gửi yêu cầu đổi date.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ.");
    }
  };

  // Open Consumption Matrix Modal
  const handleOpenMatrix = async (item) => {
    setMatrixModalItem(item);
    setMatrixLoading(true);
    try {
      const res = await fetch(`/api/clearance/consumption-matrix/${item.medicineID}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const json = await res.json();
        setMatrixData(json);
      }
    } catch (err) {
      console.error("Lỗi khi tải ma trận tiêu thụ:", err);
    } finally {
      setMatrixLoading(false);
    }
  };

  // Dismiss / Ignore warning
  const handleDismiss = async (item) => {
    const reason = prompt("Nhập lý do không thực hiện điều chuyển / đổi date cho lô này:", "Đã có kế hoạch sử dụng trong phác đồ điều trị");
    if (reason === null) return;

    try {
      const res = await fetch(`/api/clearance/dismiss/${item.batchID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          reason: reason
        })
      });

      if (res.ok) {
        alert("Đã ghi nhận lý do bỏ qua.");
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter items
  const filteredItems = (data.items || []).filter(item => {
    const matchesSearch = !searchTerm || 
      item.medicineName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.medicineCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.genericName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterRisk === 'CRITICAL' && item.riskLevel !== 'Critical' && item.daysToExpiry > 30) return false;
    if (filterRisk === 'VENDOR' && item.recommendedAction !== 'VendorReturn' && !(item.daysToExpiry > 30 && item.daysToExpiry <= 90)) return false;
    if (filterRisk === 'TRANSFER' && item.recommendedAction !== 'InternalTransfer' && !(item.daysToExpiry > 90 && item.daysToExpiry <= 180)) return false;

    if (filterLocation === 'MAINSTORE' && item.locationType !== 'MainStore') return false;
    if (filterLocation !== 'ALL' && filterLocation !== 'MAINSTORE') {
      if (item.locationType !== 'Cabinet' || String(item.departmentID) !== String(filterLocation)) return false;
    }

    return true;
  });

  const formatVND = (num) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
  };

  const getDaysBadge = (days) => {
    if (days <= 0) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.2rem 0.55rem',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: '700',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          <Clock size={11} /> ĐÃ HẾT HẠN
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.2rem 0.55rem',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: '700',
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          <AlertTriangle size={11} /> Còn {days} ngày (Gấp)
        </span>
      );
    }
    if (days <= 90) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.2rem 0.55rem',
          borderRadius: '9999px',
          fontSize: '0.72rem',
          fontWeight: '700',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        }}>
          <Building2 size={11} /> Còn {days} ngày (Đổi NCC)
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.2rem 0.55rem',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: '700',
        background: 'rgba(14, 165, 233, 0.12)',
        color: 'var(--color-primary)',
        border: '1px solid rgba(14, 165, 233, 0.25)'
      }}>
        <Clock size={11} /> Còn {days} ngày
      </span>
    );
  };

  return (
    <div className="page-container fade-in" style={{ padding: '0.25rem 0', width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* 1. HERO HEADER WITH GLASSMORPHISM */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(13, 148, 136, 0.06) 50%, rgba(245, 158, 11, 0.04) 100%)',
        border: '1px solid var(--border-glass)',
        borderRadius: '16px',
        padding: '1.5rem 1.75rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-card)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow ambient background circles */}
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(2, 132, 199, 0.3)',
              color: '#ffffff',
              flexShrink: 0
            }}>
              <ArrowLeftRight size={28} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  Cảnh Báo & Điều Chuyển Thuốc Cận Date
                </h1>
                <span style={{
                  background: 'rgba(14, 165, 233, 0.15)',
                  color: 'var(--color-primary)',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <Zap size={11} /> Thuật toán ADC 30 Ngày
                </span>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <ShieldCheck size={11} /> FEFO Optimizer
                </span>
              </div>

              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Tự động đối chiếu tốc độ tiêu hao thực tế giữa các khoa phòng để ghép cặp điều chuyển nội bộ và đề xuất đổi date Nhà cung cấp
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowInfoBanner(!showInfoBanner)}
              className="btn-secondary"
              style={{
                height: '40px',
                padding: '0 0.9rem',
                fontSize: '0.82rem',
                borderRadius: '10px',
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer'
              }}
            >
              <Info size={16} color="var(--color-primary)" />
              <span>{showInfoBanner ? 'Ẩn quy chế' : 'Quy chế & Cơ chế ADC'}</span>
            </button>

            <button 
              onClick={fetchData} 
              disabled={loading}
              className="btn-primary"
              style={{
                height: '40px',
                padding: '0 1.15rem',
                fontSize: '0.82rem',
                fontWeight: '700',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Đang phân tích...' : 'Phân tích lại dữ liệu'}</span>
            </button>
          </div>
        </div>

        {/* COLLAPSIBLE INFO BANNER EXPLAINING ALGORITHM */}
        {showInfoBanner && (
          <div style={{
            marginTop: '1.25rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-color)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontWeight: '700', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                <Activity size={15} /> Chỉ số ADC (Average Daily Consumption)
              </div>
              <div>Được tính bằng tổng số lượng thuốc đã dùng tại khoa trong 30 ngày qua chia cho 30. Đại diện cho tốc độ tiêu thụ thuốc trung bình mỗi ngày.</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontWeight: '700', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                <Clock size={15} /> Chỉ số DOS (Days of Supply)
              </div>
              <div>Số ngày tồn trữ = Lượng tồn hiện tại / ADC. Nếu <strong>DOS &gt; Số ngày còn hạn (DTE)</strong>, hệ thống gắn cờ báo động nguy cơ thất thoát.</div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontWeight: '700', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                <Building2 size={15} /> Cam kết Đổi Date NCC
              </div>
              <div>Thuốc cận hạn <strong>≤ 90 ngày</strong> được ưu tiên kích hoạt lập biên bản điện tử đề nghị Nhà cung cấp đổi date mới theo hợp đồng thầu.</div>
            </div>
          </div>
        )}
      </div>

      {/* 2. STATS KPI CARDS GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Card 1: Critical Risk */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: 'var(--shadow-card)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            background: '#ef4444'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Lô cận date có rủi ro hủy
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '0.35rem', lineHeight: 1.1 }}>
                {data.summary.totalRiskBatches}
                <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                  lô ({data.summary.totalUnitsAtRisk?.toLocaleString('vi-VN')} đv)
                </span>
              </div>
              <div style={{ marginTop: '0.65rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: '#ef4444',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px'
                }}>
                  <AlertTriangle size={11} /> Có nguy cơ quá hạn không dùng kịp
                </span>
              </div>
            </div>

            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={22} />
            </div>
          </div>
        </div>

        {/* Card 2: Financial Loss */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          boxShadow: 'var(--shadow-card)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            background: '#f59e0b'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Thiệt hại tài chính dự kiến
              </span>
              <div style={{ fontSize: '1.65rem', fontWeight: '800', color: '#f59e0b', marginTop: '0.35rem', lineHeight: 1.1 }}>
                {formatVND(data.summary.totalEstimatedLoss)}
              </div>
              <div style={{ marginTop: '0.65rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.72rem',
                  fontWeight: '600',
                  color: 'var(--text-muted)'
                }}>
                  <Percent size={11} /> Nếu không giải phóng hàng kịp thời
                </span>
              </div>
            </div>

            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldAlert size={22} />
            </div>
          </div>
        </div>

        {/* Card 3: Transferable */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid rgba(2, 132, 199, 0.25)',
          boxShadow: 'var(--shadow-card)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            background: '#0284c7'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cứu vãn qua Điều chuyển
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-primary)', marginTop: '0.35rem', lineHeight: 1.1 }}>
                {data.summary.transferableCount}
                <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>lô thuốc</span>
              </div>
              <div style={{ marginTop: '0.65rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px'
                }}>
                  <Sparkles size={11} /> Khoa khác đang có nhu cầu cao
                </span>
              </div>
            </div>

            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(2, 132, 199, 0.12)',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ArrowLeftRight size={22} />
            </div>
          </div>
        </div>

        {/* Card 4: Vendor Return */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          padding: '1.25rem',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          boxShadow: 'var(--shadow-card)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '4px',
            height: '100%',
            background: '#10b981'
          }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Kích hoạt Đổi date NCC
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#10b981', marginTop: '0.35rem', lineHeight: 1.1 }}>
                {data.summary.vendorReturnCount}
                <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>lô thuốc</span>
              </div>
              <div style={{ marginTop: '0.65rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.72rem',
                  fontWeight: '600',
                  color: 'var(--text-muted)'
                }}>
                  <Building2 size={11} /> Trong hạn hợp đồng thầu (≤ 90 ngày)
                </span>
              </div>
            </div>

            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Building2 size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONTROL TOOLBAR WITH SEGMENTED PILLS & SEARCH */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: '14px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Left: Modern Segmented Filter Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
            <button
              onClick={() => setFilterRisk('ALL')}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                borderRadius: '8px',
                border: filterRisk === 'ALL' ? '1px solid var(--color-primary)' : '1px solid var(--border-glass)',
                background: filterRisk === 'ALL' ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                color: filterRisk === 'ALL' ? 'var(--color-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Tất cả ({data.items?.length || 0})
            </button>

            <button
              onClick={() => setFilterRisk('CRITICAL')}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                borderRadius: '8px',
                border: filterRisk === 'CRITICAL' ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.25)',
                background: filterRisk === 'CRITICAL' ? '#ef4444' : 'rgba(239, 68, 68, 0.08)',
                color: filterRisk === 'CRITICAL' ? '#ffffff' : '#ef4444',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <Clock size={13} />
              Nguy cấp ≤ 30 ngày ({data.summary.criticalCount || 0})
            </button>

            <button
              onClick={() => setFilterRisk('VENDOR')}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                borderRadius: '8px',
                border: filterRisk === 'VENDOR' ? '1px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.25)',
                background: filterRisk === 'VENDOR' ? '#f59e0b' : 'rgba(245, 158, 11, 0.08)',
                color: filterRisk === 'VENDOR' ? '#ffffff' : '#f59e0b',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <Building2 size={13} />
              Đổi date NCC ({data.summary.vendorReturnCount || 0})
            </button>

            <button
              onClick={() => setFilterRisk('TRANSFER')}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                borderRadius: '8px',
                border: filterRisk === 'TRANSFER' ? '1px solid #0284c7' : '1px solid rgba(2, 132, 199, 0.25)',
                background: filterRisk === 'TRANSFER' ? '#0284c7' : 'rgba(2, 132, 199, 0.08)',
                color: filterRisk === 'TRANSFER' ? '#ffffff' : '#0284c7',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowLeftRight size={13} />
              Điều chuyển nội bộ ({data.summary.transferableCount || 0})
            </button>
          </div>

          {/* Right: Search, Location, and Days threshold */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
            {/* Search Box */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              padding: '0 0.75rem',
              width: '240px',
              height: '38px'
            }}>
              <Search size={15} color="var(--text-dim)" style={{ marginRight: '0.4rem', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Tìm thuốc, số lô, NCC..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontSize: '0.82rem',
                  color: 'var(--text-main)'
                }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-dim)' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Location Selector */}
            <select
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
              className="form-input"
              style={{
                height: '38px',
                padding: '0 0.75rem',
                fontSize: '0.82rem',
                borderRadius: '8px',
                fontWeight: '600',
                color: 'var(--text-main)',
                minWidth: '180px'
              }}
            >
              <option value="ALL">🏢 Toàn viện (Kho & Tủ)</option>
              <option value="MAINSTORE">📦 Kho Chẵn Trung Tâm</option>
              {(data.departments || []).map(d => (
                <option key={d.departmentID} value={d.departmentID}>
                  🏥 {d.departmentName}
                </option>
              ))}
            </select>

            {/* Days Threshold Segmented Pill */}
            <div style={{
              display: 'inline-flex',
              padding: '2px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px'
            }}>
              {[
                { val: 90, label: '90 ngày' },
                { val: 180, label: '6 tháng' },
                { val: 365, label: '1 năm' }
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setDaysThreshold(opt.val)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.78rem',
                    fontWeight: daysThreshold === opt.val ? '700' : '500',
                    borderRadius: '6px',
                    border: 'none',
                    background: daysThreshold === opt.val ? 'var(--color-primary)' : 'transparent',
                    color: daysThreshold === opt.val ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. MAIN DATA TABLE */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden'
      }}>
        {/* Table Header Section */}
        <div style={{
          padding: '1.15rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'var(--table-header-bg)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Danh Sách Lô Thuốc Cần Xử Lý Giải Phóng
              </h3>
              <span style={{
                background: 'rgba(2, 132, 199, 0.15)',
                color: 'var(--color-primary)',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.72rem',
                fontWeight: '700'
              }}>
                {filteredItems.length} kết quả
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Được sắp xếp theo mức độ ưu tiên xử lý rủi ro hao hụt tài chính
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Nguy cấp (&le; 30d)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} /> Đổi NCC (30-90d)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }} /> Điều chuyển (&gt; 90d)
            </span>
          </div>
        </div>

        {/* THANH KÉO CUỘN NGANG (HORIZONTAL SCROLL DRAG CONTROLLER) */}
        <div style={{
          padding: '0.65rem 1.25rem',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary)', fontWeight: '700', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            <SlidersHorizontal size={15} />
            <span>Thanh kéo ngang:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              onClick={() => scrollToPosition('start')}
              disabled={scrollPercent <= 1}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                cursor: scrollPercent <= 1 ? 'not-allowed' : 'pointer',
                opacity: scrollPercent <= 1 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Về đầu trang bảng (Cột trái cùng)"
            >
              « Đầu bảng
            </button>
            <button
              onClick={() => scrollByAmount(-220)}
              disabled={scrollPercent <= 1}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                cursor: scrollPercent <= 1 ? 'not-allowed' : 'pointer',
                opacity: scrollPercent <= 1 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Cuộn sang trái 220px"
            >
              ‹ Sang trái
            </button>
          </div>

          {/* Interactive Range Track */}
          <div style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <input
              type="range"
              min="0"
              max="100"
              value={scrollPercent}
              onChange={handleRangeScroll}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '6px',
                cursor: 'ew-resize',
                accentColor: 'var(--color-primary)',
                background: `linear-gradient(to right, var(--color-primary) ${scrollPercent}%, var(--border-color) ${scrollPercent}%)`
              }}
              title="Kéo con trượt này sang trái hoặc sang phải để xem hết tất cả các cột"
            />
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              fontFamily: 'monospace',
              padding: '0.15rem 0.45rem',
              borderRadius: '5px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--color-primary)',
              minWidth: '45px',
              textAlign: 'center'
            }}>
              {Math.round(scrollPercent)}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              onClick={() => scrollByAmount(220)}
              disabled={scrollPercent >= 99}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                cursor: scrollPercent >= 99 ? 'not-allowed' : 'pointer',
                opacity: scrollPercent >= 99 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Cuộn sang phải 220px"
            >
              Sang phải ›
            </button>
            <button
              onClick={() => scrollToPosition('end')}
              disabled={scrollPercent >= 99}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                cursor: scrollPercent >= 99 ? 'not-allowed' : 'pointer',
                opacity: scrollPercent >= 99 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Đến cuối bảng (Cột Thao Tác bên phải cùng)"
            >
              Cuối bảng »
            </button>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: scrollPercent >= 95 ? '#10b981' : '#f59e0b' }} />
            <span>{scrollPercent >= 95 ? 'Đã xem hết bên phải (Thao tác)' : 'Có thể giữ chuột kéo bảng hoặc kéo thanh trượt'}</span>
          </div>
        </div>

        {/* Responsive Table */}
        <div 
          ref={tableContainerRef}
          className="table-responsive" 
          onScroll={handleTableScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          <table className="custom-table" style={{ width: '100%', minWidth: '1120px', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '170px' }}>THUỐC & HOẠT CHẤT</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '145px' }}>SỐ LÔ & HẠN DÙNG</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '120px' }}>VỊ TRÍ KHO</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', minWidth: '105px' }}>TỒN KHO & GIÁ TRỊ</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', minWidth: '115px' }}>TIÊU THỤ (ADC / DOS)</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', minWidth: '135px' }}>RỦI RO THẤT THOÁT</th>
                <th style={{ padding: '0.75rem 0.85rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '190px' }}>ĐỀ XUẤT THUẬT TOÁN</th>
                <th className="sticky-action-col" style={{ padding: '0.75rem 0.85rem', fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'right', minWidth: '175px' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <RefreshCw className="animate-spin" size={32} color="var(--color-primary)" style={{ margin: '0 auto 0.75rem auto' }} />
                    <p style={{ fontWeight: '600', color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>Đang đối chiếu dữ liệu kho...</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Đang chạy thuật toán phân tích ADC tiêu thụ và tìm kiếm cặp ghép tối ưu.</p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
                    <ShieldCheck size={42} color="#10b981" style={{ margin: '0 auto 0.75rem auto', opacity: 0.8 }} />
                    <h4 style={{ color: 'var(--text-main)', margin: '0 0 0.25rem 0', fontWeight: '700' }}>Không có lô thuốc nào có nguy cơ bị hủy</h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                      Các khoa phòng đang duy trì tốc độ tiêu thụ tốt hoặc thuốc trong kho đều còn hạn dùng dài và đảm bảo an toàn.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const wastePercent = item.currentQuantity > 0 
                    ? Math.min(100, Math.round((item.estimatedWaste / item.currentQuantity) * 100)) 
                    : 0;

                  const isDosExceeded = item.daysOfSupply > item.daysToExpiry;

                  return (
                    <tr 
                      key={`${item.batchID}_${item.locationType}_${item.departmentID || 0}`}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--table-row-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'}
                    >
                      {/* Cột 1: Thuốc & Hoạt chất */}
                      <td style={{ padding: '0.7rem 0.85rem' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.88rem' }}>
                          {item.medicineName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            fontFamily: 'monospace',
                            background: 'var(--bg-primary)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            color: 'var(--color-primary)',
                            border: '1px solid var(--border-glass)'
                          }}>
                            {item.medicineCode}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {item.genericName || item.specification || item.medicineGroup}
                          </span>
                        </div>
                      </td>

                      {/* Cột 2: Số Lô & Hạn Dùng */}
                      <td style={{ padding: '0.7rem 0.85rem' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                          {item.batchNumber}
                        </div>
                        <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            HSD: {new Date(item.expiryDate).toLocaleDateString('vi-VN')}
                          </span>
                          {getDaysBadge(item.daysToExpiry)}
                        </div>
                      </td>

                      {/* Cột 3: Vị Trí Kho */}
                      <td style={{ padding: '0.7rem 0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600', color: 'var(--text-main)', fontSize: '0.83rem' }}>
                          {item.locationType === 'MainStore' ? (
                            <Warehouse size={15} color="var(--color-primary)" />
                          ) : (
                            <Building2 size={15} color="#0d9488" />
                          )}
                          <span>{item.locationName}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {item.locationType === 'MainStore' ? 'Kho Dược Trung Tâm' : 'Tủ trực khoa lâm sàng'}
                        </div>
                      </td>

                      {/* Cột 4: Tồn Kho & Giá Trị */}
                      <td style={{ padding: '0.7rem 0.85rem', textAlign: 'center' }}>
                        <div style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          {item.currentQuantity?.toLocaleString('vi-VN')} <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-muted)' }}>{item.unit}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {formatVND(item.importPrice * item.currentQuantity)}
                        </div>
                      </td>

                      {/* Cột 5: Tiêu Thụ ADC & DOS */}
                      <td style={{ padding: '0.7rem 0.85rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.83rem' }}>
                          <Activity size={13} />
                          <span>{item.adc}</span>
                          <span style={{ fontSize: '0.72rem', fontWeight: '500', color: 'var(--text-muted)' }}>{item.unit}/ngày</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Tồn trữ: </span>
                          <span style={{
                            fontWeight: '700',
                            color: isDosExceeded ? '#ef4444' : '#10b981'
                          }}>
                            {item.daysOfSupply >= 999 ? '∞ (Không dùng)' : `${item.daysOfSupply} ngày`}
                          </span>
                        </div>
                      </td>

                      {/* Cột 6: Rủi Ro Thất Thoát (Waste Progress Meter) */}
                      <td style={{ padding: '0.7rem 0.85rem', textAlign: 'center' }}>
                        {item.estimatedWaste > 0 ? (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: '700', color: '#ef4444', marginBottom: '0.25rem' }}>
                              <span>Hủy: {item.estimatedWaste} {item.unit}</span>
                              <span>{wastePercent}%</span>
                            </div>
                            <div style={{
                              height: '6px',
                              background: 'var(--border-color)',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${wastePercent}%`,
                                background: wastePercent > 60 
                                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)' 
                                  : 'linear-gradient(90deg, #0284c7, #f59e0b)',
                                borderRadius: '3px'
                              }} />
                            </div>
                            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#ef4444', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                              -{formatVND(item.estimatedWasteValue)}
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '9999px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            fontSize: '0.72rem',
                            fontWeight: '700'
                          }}>
                            <CheckCircle2 size={12} /> Tiêu thụ an toàn
                          </div>
                        )}
                      </td>

                      {/* Cột 7: Đề Xuất Thuật Toán (Smart Action Box) */}
                      <td style={{ padding: '0.7rem 0.85rem' }}>
                        {item.recommendedAction === 'InternalTransfer' ? (
                          <div style={{
                            background: 'rgba(2, 132, 199, 0.08)',
                            border: '1px solid rgba(2, 132, 199, 0.25)',
                            borderRadius: '10px',
                            padding: '0.55rem 0.75rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                              <Sparkles size={12} /> ĐIỀU CHUYỂN NỘI BỘ
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem', fontSize: '0.78rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Đến:</span>
                              <strong style={{ color: 'var(--text-main)' }}>{item.recommendedTargetDeptName}</strong>
                              <span style={{
                                marginLeft: 'auto',
                                background: 'var(--color-primary)',
                                color: '#ffffff',
                                fontSize: '0.7rem',
                                fontWeight: '800',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '4px'
                              }}>
                                +{item.recommendedTransferQty} {item.unit}
                              </span>
                            </div>
                          </div>
                        ) : item.recommendedAction === 'VendorReturn' ? (
                          <div style={{
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            borderRadius: '10px',
                            padding: '0.55rem 0.75rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: '800', color: '#f59e0b' }}>
                              <Building2 size={12} /> ĐỔI DATE NHÀ CUNG CẤP
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>
                              NCC: <strong style={{ color: 'var(--text-main)' }}>{item.supplierName}</strong>
                            </div>
                            {item.contractNumber && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                                HĐ: {item.contractNumber}
                              </div>
                            )}
                          </div>
                        ) : item.recommendedAction === 'Liquidation' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            fontSize: '0.75rem',
                            fontWeight: '700'
                          }}>
                            <AlertTriangle size={12} /> Lập Biên Bản Tiêu Hủy
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-glass)',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            Theo Dõi Sử Dụng
                          </span>
                        )}
                      </td>

                      {/* Cột 8: Thao Tác (Actions) */}
                      <td className="sticky-action-col" style={{ padding: '0.7rem 0.85rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center', whiteSpace: 'nowrap' }}>
                          {item.recommendedAction === 'InternalTransfer' ? (
                            <button 
                              onClick={() => handleOpenTransfer(item)}
                              style={{
                                padding: '0.38rem 0.7rem',
                                fontSize: '0.74rem',
                                fontWeight: '700',
                                borderRadius: '7px',
                                background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
                                color: '#ffffff',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                                whiteSpace: 'nowrap'
                              }}
                              title="Tạo lệnh điều chuyển sang khoa đích"
                            >
                              <ArrowLeftRight size={13} />
                              <span>Điều chuyển</span>
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleOpenTransfer(item)}
                              className="btn-secondary"
                              style={{
                                padding: '0.38rem 0.55rem',
                                fontSize: '0.74rem',
                                borderRadius: '7px',
                                border: '1px solid var(--border-glass)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                              title="Chuyển kho thủ công"
                            >
                              <ArrowLeftRight size={13} />
                            </button>
                          )}

                          {item.daysToExpiry <= 90 && (
                            <button 
                              onClick={() => handleOpenVendorReturn(item)}
                              style={{
                                padding: '0.38rem 0.7rem',
                                fontSize: '0.74rem',
                                fontWeight: '700',
                                borderRadius: '7px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                whiteSpace: 'nowrap'
                              }}
                              title="Lập biên bản đề nghị NCC đổi date mới"
                            >
                              <Building2 size={13} />
                              <span>Đổi date NCC</span>
                            </button>
                          )}

                          <button 
                            onClick={() => handleOpenMatrix(item)}
                            className="btn-secondary"
                            style={{
                              padding: '0.38rem 0.55rem',
                              fontSize: '0.74rem',
                              borderRadius: '7px',
                              border: '1px solid var(--border-glass)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="Xem ma trận tiêu thụ toàn viện (Heatmap)"
                          >
                            <TrendingUp size={13} />
                          </button>

                          <button 
                            onClick={() => handleDismiss(item)}
                            style={{
                              padding: '0.38rem 0.45rem',
                              fontSize: '0.74rem',
                              borderRadius: '7px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-dim)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="Bỏ qua cảnh báo này"
                          >
                            <Ban size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Bottom Control Bar */}
        <div style={{
          padding: '0.65rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--table-header-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>Hiển thị <strong>{filteredItems.length}</strong> lô thuốc</span>
            <span>•</span>
            <span>Tiến độ cuộn ngang: <strong style={{ color: 'var(--color-primary)' }}>{Math.round(scrollPercent)}%</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              💡 Mẹo: Giữ chuột trái trên bảng để kéo ngang hoặc dùng thanh trượt ở trên
            </span>
            <button
              onClick={() => scrollToPosition('start')}
              disabled={scrollPercent <= 1}
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.7rem',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                cursor: scrollPercent <= 1 ? 'not-allowed' : 'pointer',
                opacity: scrollPercent <= 1 ? 0.5 : 1
              }}
            >
              « Về đầu bảng
            </button>
            <button
              onClick={() => scrollToPosition('end')}
              disabled={scrollPercent >= 99}
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.7rem',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                cursor: scrollPercent >= 99 ? 'not-allowed' : 'pointer',
                opacity: scrollPercent >= 99 ? 0.5 : 1
              }}
            >
              Đến cột Thao Tác »
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: ĐIỀU CHUYỂN NỘI BỘ */}
      {transferModalItem && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            borderRadius: '18px',
            maxWidth: '780px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            position: 'relative'
          }}>
            <button 
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                border: 'none',
                background: 'var(--bg-primary)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
              onClick={() => setTransferModalItem(null)}
            >
              <X size={18} />
            </button>

            {/* Modal Title */}
            <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7, #0d9488)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}>
                  <ArrowLeftRight size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Lập Lệnh Điều Chuyển Thuốc Cận Date
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Hệ thống tự động trừ kho nguồn và nhập vào kho đích để giải phóng cơ số kịp thời
                  </p>
                </div>
              </div>
            </div>

            {/* Medicine Details Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(13, 148, 136, 0.04) 100%)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>
                {transferModalItem.medicineName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Mã: <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{transferModalItem.medicineCode}</strong></span>
                <span>Số lô: <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{transferModalItem.batchNumber}</strong></span>
                <span>HSD: <strong style={{ color: '#ef4444' }}>{new Date(transferModalItem.expiryDate).toLocaleDateString('vi-VN')}</strong></span>
                <span>Hiện có: <strong style={{ color: 'var(--color-primary)' }}>{transferModalItem.currentQuantity} {transferModalItem.unit}</strong></span>
              </div>
            </div>

            {/* Department Source & Target Route */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1.25rem',
              background: 'var(--bg-primary)',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--border-glass)'
            }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Kho nguồn (Xuất đi)
                </label>
                <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.92rem' }}>
                  {transferModalItem.locationName}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {transferModalItem.locationType === 'MainStore' ? 'Kho Dược Trung Tâm' : 'Tủ trực khoa'}
                </div>
              </div>

              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--color-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ArrowRight size={18} />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Khoa tiếp nhận (Đích) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={transferTargetDept}
                  onChange={e => setTransferTargetDept(e.target.value)}
                  className="form-input"
                  style={{
                    height: '40px',
                    fontWeight: '700',
                    color: 'var(--color-primary)',
                    width: '100%',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">-- Chọn Khoa tiếp nhận --</option>
                  {(data.departments || []).map(d => {
                    if (transferModalItem.locationType === 'Cabinet' && d.departmentID === transferModalItem.departmentID) {
                      return null;
                    }
                    const isRecommended = d.departmentID === transferModalItem.recommendedTargetDeptID;
                    return (
                      <option key={d.departmentID} value={d.departmentID}>
                        {d.departmentName} {isRecommended ? '★ (Gợi ý tối ưu - ADC cao)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Quantity Input with Quick Preset Chips */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                  Số lượng điều chuyển <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Tối đa khả dụng: <strong>{transferModalItem.currentQuantity} {transferModalItem.unit}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <input 
                  type="text" 
                  className="form-input"
                  value={transferQuantity}
                  onKeyDown={handleIntegerKeyDown}
                  onPaste={handleIntegerPaste}
                  onChange={e => setTransferQuantity(sanitizeInteger(e.target.value, 1, transferModalItem.currentQuantity))}
                  style={{ fontWeight: '800', fontSize: '1.15rem', height: '44px', width: '180px', color: 'var(--color-primary)' }}
                />
                <span style={{ fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{transferModalItem.unit}</span>

                {/* Preset chips */}
                <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                  {transferModalItem.recommendedTransferQty > 0 && transferModalItem.recommendedTransferQty < transferModalItem.currentQuantity && (
                    <button
                      type="button"
                      onClick={() => setTransferQuantity(transferModalItem.recommendedTransferQty)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--color-primary)',
                        background: 'rgba(2, 132, 199, 0.1)',
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        fontWeight: '700'
                      }}
                    >
                      Gợi ý: {transferModalItem.recommendedTransferQty}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTransferQuantity(Math.max(1, Math.round(transferModalItem.currentQuantity * 0.5)))}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-glass)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferQuantity(transferModalItem.currentQuantity)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-glass)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    100% (Toàn bộ)
                  </button>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', display: 'block', marginBottom: '0.35rem' }}>
                Lý do & Ghi chú điều chuyển
              </label>
              <textarea 
                className="form-input" 
                rows="2"
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
                placeholder="Nhập ghi chú cho hai khoa phòng..."
                style={{ width: '100%', resize: 'none', fontSize: '0.82rem' }}
              />
            </div>

            {/* Digital Signature */}
            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '1rem',
              border: '1px solid var(--border-glass)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <PenTool size={14} color="var(--color-primary)" /> Chữ Ký Điện Tử Xác Nhận Điều Phối
                </span>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setTransferSignature('QUICK_SIG')}
                    style={{
                      padding: '0.2rem 0.55rem',
                      fontSize: '0.72rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(2, 132, 199, 0.3)',
                      background: 'rgba(2, 132, 199, 0.1)',
                      color: 'var(--color-primary)',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Ký số mặc định
                  </button>
                  <button 
                    type="button" 
                    onClick={clearCanvas}
                    style={{
                      padding: '0.2rem 0.55rem',
                      fontSize: '0.72rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-glass)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem'
                    }}
                  >
                    <Eraser size={11} /> Xóa vẽ lại
                  </button>
                </div>
              </div>

              {transferSignature === 'QUICK_SIG' ? (
                <div style={{ height: '85px', border: '1px dashed var(--color-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2, 132, 199, 0.04)' }}>
                  {SIG.duoc}
                </div>
              ) : (
                <canvas 
                  ref={canvasRef} 
                  width={700} 
                  height={85} 
                  style={{ border: '1px dashed var(--border-color)', borderRadius: '8px', cursor: 'crosshair', width: '100%', background: '#ffffff', display: 'block' }}
                />
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setTransferModalItem(null)}
                style={{ padding: '0.55rem 1.15rem', borderRadius: '8px', fontSize: '0.85rem' }}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmTransfer}
                style={{
                  padding: '0.55rem 1.35rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <CheckCircle2 size={16} />
                <span>Xác nhận & Chuyển kho</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BIÊN BẢN ĐỀ NGHỊ ĐỔI DATE NCC */}
      {vendorModalItem && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            borderRadius: '18px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            position: 'relative'
          }}>
            <button 
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                border: 'none',
                background: 'var(--bg-primary)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
              onClick={() => setVendorModalItem(null)}
            >
              <X size={18} />
            </button>

            <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Biên Bản Đề Nghị Đổi Date Mới - Nhà Cung Cấp
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Lập công văn điện tử gửi NCC theo cam kết hợp đồng thầu dược phẩm
                  </p>
                </div>
              </div>
            </div>

            {/* Inputs Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                  Nhà cung cấp tiếp nhận:
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={vendorModalItem.supplierName} 
                  disabled 
                  style={{ height: '38px', fontWeight: '700', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                  Số hợp đồng thầu:
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={vendorModalItem.contractNumber || 'HĐ-DƯỢC-2026/HIS'} 
                  disabled 
                  style={{ height: '38px', fontFamily: 'monospace', fontWeight: '700', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                  Số lượng đề nghị đổi: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="form-input"
                    value={vendorQuantity}
                    onKeyDown={handleIntegerKeyDown}
                    onPaste={handleIntegerPaste}
                    onChange={e => setVendorQuantity(sanitizeInteger(e.target.value, 1, vendorModalItem.currentQuantity))}
                    style={{ fontWeight: '800', fontSize: '1rem', height: '38px', color: '#f59e0b', width: '120px' }}
                  />
                  <span style={{ fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{vendorModalItem.unit}</span>
                </div>
              </div>
            </div>

            {/* Official Printable A4 Letter Preview */}
            <div style={{
              padding: '1.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              background: '#ffffff',
              color: '#0f172a',
              fontFamily: 'Times New Roman, serif',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #000', paddingBottom: '10px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>BỆNH VIỆN ĐA KHOA HIS PHARMACY</div>
                  <div style={{ fontSize: '11px' }}>KHOA DƯỢC - BỘ PHẬN KHO CHẴN</div>
                  <div style={{ fontSize: '10px', fontStyle: 'italic' }}>Số: {vendorModalItem.batchID}/ĐN-ĐD/{new Date().getFullYear()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div style={{ fontSize: '11px', fontStyle: 'italic' }}>Độc lập - Tự do - Hạnh phúc</div>
                  <div style={{ fontSize: '10px', fontStyle: 'italic' }}>Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</div>
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '14px 0' }}>
                <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase' }}>BIÊN BẢN ĐỀ NGHỊ ĐỔI DATE THUỐC CẬN HẠN DÙNG</div>
                <div style={{ fontSize: '12px', fontStyle: 'italic', marginTop: '3px' }}>Kính gửi: {vendorModalItem.supplierName}</div>
              </div>

              <div style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '12px' }}>
                Căn cứ vào Hợp đồng cung ứng thuốc số <b>{vendorModalItem.contractNumber || 'HĐ-DƯỢC-2026/HIS'}</b> ký giữa Bệnh viện và Quý Công ty;
                <br />
                Khoa Dược Bệnh viện xin thông báo lô thuốc sau đây đã bước vào ngưỡng cận hạn dùng (&le; 90 ngày) theo điều khoản cam kết hỗ trợ đổi date mới của Nhà cung cấp:
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '14px' }} border="1">
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '6px' }}>Tên Thuốc / Hoạt Chất</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Số Lô</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Hạn Dùng</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Số Lượng</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>Đơn Giá</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>Thành Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px' }}><b>{vendorModalItem.medicineName}</b> ({vendorModalItem.genericName})</td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>{vendorModalItem.batchNumber}</td>
                    <td style={{ padding: '6px', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{new Date(vendorModalItem.expiryDate).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>{vendorQuantity} {vendorModalItem.unit}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{formatVND(vendorModalItem.importPrice)}</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{formatVND(vendorModalItem.importPrice * vendorQuantity)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                Đề nghị Quý Công ty cử đại diện tiếp nhận và hoàn tất thủ tục đổi date mới có hạn dùng tối thiểu trên 18 tháng trong vòng 07 ngày làm việc kể từ ngày nhận được biên bản này.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', textAlign: 'center' }}>
                <div style={{ width: '200px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>ĐẠI DIỆN NHÀ CUNG CẤP</div>
                  <div style={{ fontSize: '11px', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</div>
                </div>
                <div style={{ width: '200px', position: 'relative' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>TRƯỞNG KHOA DƯỢC</div>
                  <div style={{ fontSize: '11px', fontStyle: 'italic' }}>(Ký đóng dấu)</div>
                  <div style={{ position: 'absolute', top: '10px', right: '15px' }}>
                    <RedStamp name="DS. TRƯỞNG KHOA" />
                  </div>
                  <div style={{ marginTop: '55px', fontSize: '12px', fontWeight: 'bold' }}>
                    {user?.fullName || "DS. Lê Văn Chương"}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                className="btn-secondary" 
                onClick={() => window.print()}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Printer size={15} />
                <span>In biên bản (A4)</span>
              </button>
              <button 
                onClick={handleConfirmVendorReturn}
                style={{
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <CheckCircle2 size={16} />
                <span>Xác nhận & Khóa xuất lô</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MA TRẬN TIÊU THỤ ADC TOÀN VIỆN */}
      {matrixModalItem && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            borderRadius: '18px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            position: 'relative'
          }}>
            <button 
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                border: 'none',
                background: 'var(--bg-primary)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
              onClick={() => setMatrixModalItem(null)}
            >
              <X size={18} />
            </button>

            <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}>
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Ma Trận Nhu Cầu & Tiêu Thụ Toàn Viện
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Phân tích chi tiết mức dùng thuốc <strong>{matrixModalItem.medicineName}</strong> tại tất cả các khoa lâm sàng
                  </p>
                </div>
              </div>
            </div>

            {matrixLoading ? (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                <RefreshCw className="animate-spin" size={32} color="var(--color-primary)" style={{ margin: '0 auto 0.75rem auto' }} />
                <p style={{ fontWeight: '600', color: 'var(--text-main)' }}>Đang tính toán ma trận tiêu thụ 30 ngày qua...</p>
              </div>
            ) : matrixData ? (
              <div>
                {/* Medicine info header */}
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: '0.85rem 1.15rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                  marginBottom: '1.25rem'
                }}>
                  <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                    {matrixData.medicine?.medicineName}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Mã: <strong style={{ color: 'var(--text-main)' }}>{matrixData.medicine?.medicineCode}</strong></span>
                    <span>Hoạt chất: <strong style={{ color: 'var(--text-main)' }}>{matrixData.medicine?.genericName}</strong></span>
                    <span>Quy cách: <strong style={{ color: 'var(--text-main)' }}>{matrixData.medicine?.specification}</strong></span>
                  </div>
                </div>

                {/* Matrix table with mini progress bars */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                  <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Khoa Phòng</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Đã dùng (30 ngày)</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tốc độ ADC</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tồn hiện tại</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Số ngày tồn trữ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const depts = matrixData.departments || [];
                        const maxUsage = Math.max(...depts.map(d => d.thirtyDayUsage || 0), 1);

                        return depts.map(dept => {
                          const isRecommended = dept.departmentID === matrixModalItem.recommendedTargetDeptID;
                          const isCurrent = dept.departmentID === matrixModalItem.departmentID;
                          const barWidth = Math.round(((dept.thirtyDayUsage || 0) / maxUsage) * 100);

                          return (
                            <tr key={dept.departmentID} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{dept.departmentName}</span>
                                  {isRecommended && (
                                    <span style={{
                                      background: 'rgba(2, 132, 199, 0.15)',
                                      color: 'var(--color-primary)',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      fontWeight: '700'
                                    }}>
                                      ★ Gợi ý chuyển đến
                                    </span>
                                  )}
                                  {isCurrent && (
                                    <span style={{
                                      background: 'var(--bg-primary)',
                                      color: 'var(--text-muted)',
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem',
                                      fontWeight: '600'
                                    }}>
                                      Kho nguồn hiện tại
                                    </span>
                                  )}
                                </div>

                                {/* Mini visual bar representing usage */}
                                <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', marginTop: '0.35rem', overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${barWidth}%`,
                                    background: isRecommended ? '#0284c7' : 'var(--text-dim)',
                                    borderRadius: '2px'
                                  }} />
                                </div>
                              </td>

                              <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '800', color: 'var(--text-main)' }}>
                                {dept.thirtyDayUsage}
                              </td>

                              <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                <span style={{ fontWeight: '700', color: dept.thirtyDayUsage > 0 ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                                  {dept.adc}
                                </span> /ngày
                              </td>

                              <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '700', color: 'var(--text-main)' }}>
                                {dept.currentStock}
                              </td>

                              <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                {dept.daysOfSupply >= 999 ? (
                                  <span style={{ color: 'var(--text-muted)' }}>Không tiêu thụ</span>
                                ) : (
                                  <span style={{
                                    fontWeight: '700',
                                    color: dept.daysOfSupply < 30 ? '#ef4444' : 'var(--text-main)'
                                  }}>
                                    {dept.daysOfSupply} ngày
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1.25rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setMatrixModalItem(null)}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem' }}
              >
                Đóng ma trận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
