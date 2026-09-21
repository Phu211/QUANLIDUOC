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
  Eraser
} from 'lucide-react';
import { handleIntegerKeyDown, sanitizeInteger, handleIntegerPaste } from '../utils/numberInputUtils';

const SIG = {
  duoc: (
    <svg width="100" height="50" viewBox="0 0 120 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M15,35 C30,15 45,5 55,25 C65,45 80,45 95,20 C105,5 110,15 115,25 M35,45 C50,35 70,25 90,40" fill="none" stroke="#0000ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  khoa: (
    <svg width="100" height="50" viewBox="0 0 120 60" style={{ display: 'block', margin: 'auto' }}>
      <path d="M10,25 Q30,45 50,20 T90,30 T110,15 M20,15 C40,25 60,35 80,20" fill="none" stroke="#0000ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
};

const RedStamp = ({ name = "DS. TRƯỞNG KHOA" }) => (
  <svg width="85" height="85" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clearance/analyze?daysThreshold=${daysThreshold}`);
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
    // Check if empty
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
    setTransferNotes(`Điều chuyển giải phóng thuốc cận date lô ${item.batchNumber} (HSD: ${new Date(item.expiryDate).toLocaleDateString('vi-VN')})`);
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
          'X-User-Role': user?.role || 'pharmacist',
          'X-User-FullName': encodeURIComponent(user?.fullName || 'Thủ kho Dược')
        },
        body: JSON.stringify(payload)
      });

      const resJson = await res.json();
      if (res.ok) {
        alert(resJson.message || "Đã điều chuyển thuốc cận date thành công!");
        setTransferModalItem(null);
        fetchData();
      } else {
        alert(resJson.error || "Lỗi khi thực hiện điều chuyển.");
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
    setVendorReason('Lô thuốc cận hạn sử dụng (< 90 ngày) theo cam kết hợp đồng thầu dược phẩm');
    setVendorNotes(`Kính đề nghị ${item.supplierName} đổi date mới cho lô thuốc ${item.batchNumber} theo hợp đồng ${item.contractNumber || 'nguyên tắc'}`);
    setVendorSignature(null);
  };

  // Execute Vendor Return
  const handleConfirmVendorReturn = async () => {
    const qty = parseInt(vendorQuantity);
    if (!qty || qty <= 0 || qty > vendorModalItem.currentQuantity) {
      alert(`Số lượng trả không hợp lệ. Tối đa hiện có: ${vendorModalItem.currentQuantity}`);
      return;
    }

    const sig = vendorSignature || getCanvasSignature();

    try {
      const payload = {
        batchID: vendorModalItem.batchID,
        sourceLocationType: vendorModalItem.locationType,
        sourceDepartmentID: vendorModalItem.departmentID,
        supplierID: vendorModalItem.supplierID,
        quantity: qty,
        returnReason: vendorReason,
        contractNumber: vendorModalItem.contractNumber,
        notes: vendorNotes,
        digitalSignature: sig,
        approverName: user?.fullName || "Thủ kho Dược"
      };

      const res = await fetch('/api/clearance/create-vendor-return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || 'pharmacist',
          'X-User-FullName': encodeURIComponent(user?.fullName || 'Thủ kho Dược')
        },
        body: JSON.stringify(payload)
      });

      const resJson = await res.json();
      if (res.ok) {
        alert(resJson.message || "Đã phát hành biên bản đổi date gửi Nhà cung cấp thành công!");
        setVendorModalItem(null);
        fetchData();
      } else {
        alert(resJson.error || "Lỗi khi tạo biên bản đổi trả.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ.");
    }
  };

  // Open Matrix Modal
  const handleOpenMatrix = async (item) => {
    setMatrixModalItem(item);
    setMatrixLoading(true);
    try {
      const res = await fetch(`/api/clearance/departments-matrix/${item.medicineID}`);
      if (res.ok) {
        const json = await res.json();
        setMatrixData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMatrixLoading(false);
    }
  };

  // Dismiss action
  const handleDismiss = async (item) => {
    const reason = prompt("Nhập lý do không điều chuyển (Ví dụ: 'Đã có ca bệnh dự kiến dùng hết', 'Thuốc cấp cứu dự phòng bắt buộc'):", "Đã có kế hoạch sử dụng nội bộ");
    if (!reason) return;

    try {
      const res = await fetch('/api/clearance/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-FullName': encodeURIComponent(user?.fullName || 'Cán bộ quản lý')
        },
        body: JSON.stringify({
          batchID: item.batchID,
          sourceLocationType: item.locationType,
          sourceDepartmentID: item.departmentID,
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
    // Search
    const matchesSearch = !searchTerm || 
      item.medicineName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.medicineCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.genericName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplierName?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Filter Risk
    if (filterRisk === 'CRITICAL' && item.riskLevel !== 'Critical' && item.daysToExpiry > 30) return false;
    if (filterRisk === 'VENDOR' && item.recommendedAction !== 'VendorReturn' && !(item.daysToExpiry > 30 && item.daysToExpiry <= 90)) return false;
    if (filterRisk === 'TRANSFER' && item.recommendedAction !== 'InternalTransfer' && !(item.daysToExpiry > 90 && item.daysToExpiry <= 180)) return false;

    // Filter Location
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
    if (days <= 0) return <span className="badge badge-danger">ĐÃ HẾT HẠN</span>;
    if (days <= 30) return <span className="badge badge-danger" title="Khẩn cấp: Dưới 30 ngày">Còn {days} ngày</span>;
    if (days <= 90) return <span className="badge badge-warning" title="Cảnh báo cao: Ngưỡng đổi date NCC">Còn {days} ngày</span>;
    return <span className="badge badge-info" title="Cảnh báo trung bình: Điều chuyển nội bộ">Còn {days} ngày</span>;
  };

  return (
    <div className="page-container fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-title-container">
          <div className="title-icon-badge" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)' }}>
            <ArrowLeftRight size={24} color="#ffffff" />
          </div>
          <div>
            <h1 className="page-title">Cảnh Báo & Điều Chuyển Thuốc Cận Date</h1>
            <p className="page-subtitle">
              Thuật toán đối chiếu Tốc độ tiêu thụ (ADC) & Tự động đề xuất Điều chuyển nội bộ hoặc Đổi date Nhà cung cấp
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={fetchData} 
            disabled={loading}
            title="Quét và phân tích lại dữ liệu"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Đang phân tích...' : 'Phân tích lại'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="stats-grid mb-6">
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Lô cận date có rủi ro hủy</span>
            <div className="stat-value">{data.summary.totalRiskBatches} <span className="text-sm font-normal text-muted">lô ({data.summary.totalUnitsAtRisk} đv)</span></div>
            <span className="stat-subtext text-danger">Có nguy cơ không dùng kịp</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <ShieldAlert size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Thiệt hại tài chính dự kiến</span>
            <div className="stat-value text-warning">{formatVND(data.summary.totalEstimatedLoss)}</div>
            <span className="stat-subtext">Nếu không giải phóng hàng kịp thời</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(2, 132, 199, 0.12)', color: '#0284c7' }}>
            <ArrowLeftRight size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Có thể cứu vãn qua Điều chuyển</span>
            <div className="stat-value text-primary">{data.summary.transferableCount} <span className="text-sm font-normal text-muted">lô</span></div>
            <span className="stat-subtext text-success">Khoa khác đang có nhu cầu cao</span>
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <Building2 size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Kích hoạt Đổi date Nhà cung cấp</span>
            <div className="stat-value text-success">{data.summary.vendorReturnCount} <span className="text-sm font-normal text-muted">lô</span></div>
            <span className="stat-subtext">Trong hạn hợp đồng (≤ 90 ngày)</span>
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="content-card mb-6" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: Quick filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <button 
              className={`btn btn-sm ${filterRisk === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilterRisk('ALL')}
            >
              Tất cả ({data.items?.length || 0})
            </button>
            <button 
              className={`btn btn-sm ${filterRisk === 'CRITICAL' ? 'btn-danger' : 'btn-outline'}`}
              onClick={() => setFilterRisk('CRITICAL')}
              style={{ borderColor: filterRisk !== 'CRITICAL' ? '#fca5a5' : undefined }}
            >
              <Clock size={14} />
              Nguy cấp &le; 30 ngày ({data.summary.criticalCount || 0})
            </button>
            <button 
              className={`btn btn-sm ${filterRisk === 'VENDOR' ? 'btn-warning' : 'btn-outline'}`}
              onClick={() => setFilterRisk('VENDOR')}
              style={{ borderColor: filterRisk !== 'VENDOR' ? '#fcd34d' : undefined }}
            >
              <Building2 size={14} />
              Đổi date NCC (30-90 ngày) ({data.summary.vendorReturnCount || 0})
            </button>
            <button 
              className={`btn btn-sm ${filterRisk === 'TRANSFER' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilterRisk('TRANSFER')}
            >
              <ArrowLeftRight size={14} />
              Điều chuyển nội bộ ({data.summary.transferableCount || 0})
            </button>
          </div>

          {/* Right: Search & Location selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div className="search-box" style={{ width: '260px' }}>
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                placeholder="Tìm thuốc, hoạt chất, số lô..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <select 
              className="form-select" 
              style={{ width: '200px', height: '38px', fontSize: '13px' }}
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
            >
              <option value="ALL">🏢 Toàn bộ Kho & Khoa</option>
              <option value="MAINSTORE">📦 Kho chẵn chính</option>
              {(data.departments || []).map(d => (
                <option key={d.departmentID} value={d.departmentID}>
                  🏥 {d.departmentName}
                </option>
              ))}
            </select>

            <select 
              className="form-select" 
              style={{ width: '150px', height: '38px', fontSize: '13px' }}
              value={daysThreshold}
              onChange={e => setDaysThreshold(Number(e.target.value))}
              title="Khung thời gian quét hạn dùng"
            >
              <option value={90}>Trong 90 ngày</option>
              <option value={180}>Trong 6 tháng</option>
              <option value={365}>Trong 1 năm</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="content-card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '16px 20px' }}>
          <div>
            <h3 className="card-title">Danh Sách Lô Thuốc Cần Xử Lý Giải Phóng</h3>
            <p className="card-subtitle">Hiển thị {filteredItems.length} kết quả phân tích theo thuật toán tiêu thụ</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Thuốc & Hoạt Chất</th>
                <th>Số Lô & Hạn Dùng</th>
                <th>Vị Trí Hiện Tại</th>
                <th className="text-center">Tồn Kho</th>
                <th className="text-center">Tốc Độ Tiêu Thụ (ADC)</th>
                <th className="text-center">Rủi Ro Hao Hụt</th>
                <th>Đề Xuất Hành Động</th>
                <th className="text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-8">
                    <RefreshCw className="spin mx-auto mb-2 text-primary" size={28} />
                    <p className="text-muted">Đang phân tích dữ liệu kho và đối chiếu thuật toán tiêu thụ...</p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8">
                    <ShieldCheck className="mx-auto mb-2 text-success" size={32} />
                    <p className="font-semibold text-main">Không có lô thuốc nào có nguy cơ bị hủy trong khung lọc này</p>
                    <p className="text-muted text-sm">Các khoa phòng đang duy trì tốc độ tiêu thụ tốt hoặc không có thuốc cận hạn.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const wastePercent = item.currentQuantity > 0 
                    ? Math.min(100, Math.round((item.estimatedWaste / item.currentQuantity) * 100)) 
                    : 0;

                  return (
                    <tr key={`${item.batchID}_${item.locationType}_${item.departmentID || 0}`}>
                      {/* Medicine Info */}
                      <td>
                        <div className="font-semibold text-main">{item.medicineName}</div>
                        <div className="text-xs text-muted" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                          <span className="badge badge-subtle">{item.medicineCode}</span>
                          <span>{item.genericName || item.specification || item.medicineGroup}</span>
                        </div>
                      </td>

                      {/* Batch & Expiry */}
                      <td>
                        <div className="font-mono font-medium text-sm">{item.batchNumber}</div>
                        <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="text-xs text-muted">{new Date(item.expiryDate).toLocaleDateString('vi-VN')}</span>
                          {getDaysBadge(item.daysToExpiry)}
                        </div>
                      </td>

                      {/* Location */}
                      <td>
                        <div className="font-medium" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Building2 size={14} className="text-muted" />
                          <span>{item.locationName}</span>
                        </div>
                        <div className="text-xs text-muted">
                          {item.locationType === 'MainStore' ? 'Kho trung tâm' : 'Tủ trực lâm sàng'}
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td className="text-center">
                        <div className="font-bold text-main">{item.currentQuantity} <span className="text-xs font-normal text-muted">{item.unit}</span></div>
                        <div className="text-xs text-muted">{formatVND(item.importPrice * item.currentQuantity)}</div>
                      </td>

                      {/* Consumption ADC & Days of Supply */}
                      <td className="text-center">
                        <div className="font-medium text-sm">
                          <span className="text-primary font-bold">{item.adc}</span> {item.unit}/ngày
                        </div>
                        <div className="text-xs text-muted" title="Thời gian cần để dùng hết lượng tồn hiện tại">
                          Tồn trữ: <span className={item.daysOfSupply > item.daysToExpiry ? 'text-danger font-semibold' : 'text-success'}>{item.daysOfSupply >= 999 ? '∞' : `${item.daysOfSupply} ngày`}</span>
                        </div>
                      </td>

                      {/* Risk Progress Meter */}
                      <td className="text-center" style={{ minWidth: '130px' }}>
                        {item.estimatedWaste > 0 ? (
                          <div>
                            <div className="text-xs font-semibold text-danger mb-1">
                              Hủy dự kiến: {item.estimatedWaste} {item.unit} ({wastePercent}%)
                            </div>
                            <div className="progress-bar-bg" style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  height: '100%', 
                                  width: `${wastePercent}%`, 
                                  backgroundColor: wastePercent > 70 ? '#ef4444' : wastePercent > 40 ? '#f59e0b' : '#0284c7',
                                  transition: 'width 0.3s ease'
                                }} 
                              />
                            </div>
                            <div className="text-xs text-danger font-mono mt-1">
                              Thất thoát: {formatVND(item.estimatedWasteValue)}
                            </div>
                          </div>
                        ) : (
                          <div className="badge badge-success text-xs">
                            <CheckCircle2 size={12} className="inline mr-1" />
                            Dùng kịp trước HSD
                          </div>
                        )}
                      </td>

                      {/* Smart Recommendation */}
                      <td>
                        {item.recommendedAction === 'InternalTransfer' ? (
                          <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--color-primary-light)', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
                            <div className="text-xs font-bold text-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Sparkles size={12} />
                              <span>ĐIỀU CHUYỂN NỘI BỘ</span>
                            </div>
                            <div className="text-xs text-main font-medium mt-1">
                              Chuyển <span className="font-bold text-primary">{item.recommendedTransferQty}</span> {item.unit} &rarr; <span className="font-bold">{item.recommendedTargetDeptName}</span>
                            </div>
                          </div>
                        ) : item.recommendedAction === 'VendorReturn' ? (
                          <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--color-warning-light)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            <div className="text-xs font-bold text-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Building2 size={12} />
                              <span>ĐỔI DATE NHÀ CUNG CẤP</span>
                            </div>
                            <div className="text-xs text-main mt-1">
                              NCC: <span className="font-semibold">{item.supplierName}</span>
                            </div>
                            {item.contractNumber && (
                              <div className="text-xs text-muted">HĐ: {item.contractNumber}</div>
                            )}
                          </div>
                        ) : item.recommendedAction === 'Liquidation' ? (
                          <div className="badge badge-danger text-xs font-semibold">
                            CẦN LẬP BIÊN BẢN TIÊU HỦY
                          </div>
                        ) : (
                          <div className="badge badge-outline text-xs">
                            THEO DÕI SỬ DỤNG
                          </div>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="text-right">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {item.recommendedAction === 'InternalTransfer' ? (
                            <button 
                              className="btn btn-sm btn-primary"
                              onClick={() => handleOpenTransfer(item)}
                              title="Tạo lệnh điều chuyển sang khoa đích"
                            >
                              <ArrowLeftRight size={14} />
                              <span>Điều chuyển</span>
                            </button>
                          ) : (
                            <button 
                              className="btn btn-sm btn-outline"
                              onClick={() => handleOpenTransfer(item)}
                              title="Chuyển kho thủ công"
                            >
                              <ArrowLeftRight size={14} />
                            </button>
                          )}

                          {item.daysToExpiry <= 90 && (
                            <button 
                              className="btn btn-sm btn-warning"
                              onClick={() => handleOpenVendorReturn(item)}
                              title="Lập biên bản đề nghị NCC đổi date mới"
                            >
                              <Building2 size={14} />
                              <span>Đổi date NCC</span>
                            </button>
                          )}

                          <button 
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleOpenMatrix(item)}
                            title="Xem ma trận tiêu thụ toàn viện"
                          >
                            <TrendingUp size={14} />
                          </button>

                          <button 
                            className="btn btn-sm btn-ghost text-muted"
                            onClick={() => handleDismiss(item)}
                            title="Bỏ qua cảnh báo này"
                          >
                            <Ban size={14} />
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
      </div>

      {/* MODAL 1: Điều Chuyển Nội Bộ */}
      {transferModalItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '760px', width: '92%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', zIndex: 10 }}
              onClick={() => setTransferModalItem(null)}
              title="Đóng"
            >
              <X size={22} />
            </button>

            <div style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <ArrowLeftRight className="text-primary" size={22} />
                <span>Lập Lệnh Điều Chuyển Thuốc Cận Date</span>
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Hệ thống tự động trừ kho nguồn và cộng kho đích để giải phóng hàng
              </p>
            </div>

            <div className="modal-body" style={{ padding: 0 }}>
              {/* Medicine details card */}
              <div className="card-subtle mb-4" style={{ padding: '14px 18px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                <div className="font-bold text-main text-base">{transferModalItem.medicineName}</div>
                <div className="text-xs text-muted mt-1.5" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span>Mã: <b>{transferModalItem.medicineCode}</b></span>
                  <span>Lô: <b>{transferModalItem.batchNumber}</b></span>
                  <span>HSD: <b className="text-danger">{new Date(transferModalItem.expiryDate).toLocaleDateString('vi-VN')}</b></span>
                  <span>Hiện có: <b className="text-primary">{transferModalItem.currentQuantity} {transferModalItem.unit}</b></span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Kho nguồn (Xuất đi):</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={transferModalItem.locationName} 
                    disabled 
                    style={{ backgroundColor: 'var(--bg-content)', fontWeight: 500 }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Khoa / Phòng tiếp nhận (Đích): <span className="text-danger">*</span>
                  </label>
                  <select 
                    className="form-select"
                    value={transferTargetDept}
                    onChange={e => setTransferTargetDept(e.target.value)}
                    style={{ height: '42px', fontWeight: 500 }}
                  >
                    <option value="">-- Chọn Khoa tiếp nhận --</option>
                    {(data.departments || []).map(d => {
                      if (transferModalItem.locationType === 'Cabinet' && d.departmentID === transferModalItem.departmentID) {
                        return null; // Don't transfer to itself
                      }
                      const isRecommended = d.departmentID === transferModalItem.recommendedTargetDeptID;
                      return (
                        <option key={d.departmentID} value={d.departmentID}>
                          {d.departmentName} {isRecommended ? '★ (Gợi ý tối ưu - Tiêu thụ cao)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Số lượng điều chuyển: <span className="text-danger">*</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="text" 
                      className="form-control"
                      value={transferQuantity}
                      onKeyDown={handleIntegerKeyDown}
                      onPaste={handleIntegerPaste}
                      onChange={e => setTransferQuantity(sanitizeInteger(e.target.value, 1, transferModalItem.currentQuantity))}
                      style={{ fontWeight: 'bold', fontSize: '16px', height: '42px' }}
                    />
                    <span className="text-sm font-semibold text-muted">{transferModalItem.unit}</span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    Gợi ý tối ưu: <a href="#suggest" onClick={(e) => { e.preventDefault(); setTransferQuantity(transferModalItem.recommendedTransferQty); }} className="text-primary font-bold underline">{transferModalItem.recommendedTransferQty} {transferModalItem.unit}</a>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Người phê duyệt / Điều phối:</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={user?.fullName || "Thủ kho Dược"} 
                    disabled 
                    style={{ backgroundColor: 'var(--bg-content)', height: '42px' }}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Ghi chú & Lý do điều chuyển:</label>
                <textarea 
                  className="form-control" 
                  rows="2"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  placeholder="Nhập lý do điều chuyển..."
                />
              </div>

              {/* Digital Signature */}
              <div className="mb-2">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>
                    <PenTool size={14} className="inline mr-1 text-primary" />
                    Chữ ký điện tử xác nhận điều chuyển:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn btn-xs btn-ghost text-primary"
                      onClick={() => setTransferSignature('QUICK_SIG')}
                    >
                      Dùng chữ ký số mặc định
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-xs btn-ghost text-muted"
                      onClick={clearCanvas}
                    >
                      <Eraser size={12} className="inline mr-1" />
                      Xóa vẽ lại
                    </button>
                  </div>
                </div>

                {transferSignature === 'QUICK_SIG' ? (
                  <div style={{ height: '90px', border: '1px dashed var(--color-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2, 132, 199, 0.05)' }}>
                    {SIG.duoc}
                  </div>
                ) : (
                  <canvas 
                    ref={canvasRef} 
                    width={680} 
                    height={90} 
                    style={{ border: '1px dashed var(--border-color)', borderRadius: '8px', cursor: 'crosshair', width: '100%', background: '#ffffff' }}
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => setTransferModalItem(null)}>
                Hủy bỏ
              </button>
              <button className="btn btn-primary" onClick={handleConfirmTransfer}>
                <CheckCircle2 size={16} />
                <span>Xác nhận & Chuyển ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Biên Bản Đổi Date Nhà Cung Cấp */}
      {vendorModalItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '880px', width: '94%', maxHeight: '92vh', overflowY: 'auto', padding: '2rem' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', zIndex: 10 }}
              onClick={() => setVendorModalItem(null)}
              title="Đóng"
            >
              <X size={22} />
            </button>

            <div style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <Building2 className="text-warning" size={22} />
                <span>Biên Bản Đề Nghị Đổi Date Mới - Nhà Cung Cấp</span>
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Lập công văn điện tử gửi NCC theo điều khoản hợp đồng thầu dược phẩm
              </p>
            </div>

            <div className="modal-body" style={{ padding: 0 }}>
              {/* Form inputs */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Nhà cung cấp tiếp nhận:</label>
                  <input 
                    type="text" 
                    className="form-control font-semibold" 
                    value={vendorModalItem.supplierName} 
                    disabled 
                    style={{ height: '40px' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Số Hợp đồng mua bán / Thầu:</label>
                  <input 
                    type="text" 
                    className="form-control font-mono font-medium" 
                    value={vendorModalItem.contractNumber || 'HĐ-DƯỢC-2026/HIS'} 
                    disabled 
                    style={{ height: '40px' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Số lượng đề nghị đổi date: <span className="text-danger">*</span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="text" 
                      className="form-control"
                      value={vendorQuantity}
                      onKeyDown={handleIntegerKeyDown}
                      onPaste={handleIntegerPaste}
                      onChange={e => setVendorQuantity(sanitizeInteger(e.target.value, 1, vendorModalItem.currentQuantity))}
                      style={{ fontWeight: 'bold', fontSize: '16px', height: '40px' }}
                    />
                    <span className="font-semibold text-muted">{vendorModalItem.unit}</span>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Lý do đổi trả:</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={vendorReason}
                    onChange={e => setVendorReason(e.target.value)}
                    style={{ height: '40px' }}
                  />
                </div>
              </div>

              {/* Printable Document Preview Area */}
              <div className="print-area mt-4 mb-4" style={{ padding: '24px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#0f172a', fontFamily: 'Times New Roman, serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #000', paddingBottom: '12px', marginBottom: '16px' }}>
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

                <div style={{ textAlign: 'center', margin: '16px 0' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>BIÊN BẢN ĐỀ NGHỊ ĐỔI DATE THUỐC CẬN HẠN DÙNG</div>
                  <div style={{ fontSize: '12px', fontStyle: 'italic', marginTop: '4px' }}>Kính gửi: {vendorModalItem.supplierName}</div>
                </div>

                <div style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '14px' }}>
                  Căn cứ vào Hợp đồng cung ứng thuốc số <b>{vendorModalItem.contractNumber || 'HĐ-DƯỢC-2026/HIS'}</b> ký giữa Bệnh viện và Quý Công ty;
                  <br />
                  Khoa Dược Bệnh viện xin thông báo lô thuốc sau đây đã bước vào ngưỡng cận hạn dùng (&le; 90 ngày) theo điều khoản cam kết hỗ trợ đổi date mới của Nhà cung cấp:
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }} border="1">
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '8px' }}>Tên Thuốc / Hoạt Chất</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Số Lô</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Hạn Dùng</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Số Lượng</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Đơn Giá</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Thành Tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px' }}><b>{vendorModalItem.medicineName}</b> ({vendorModalItem.genericName})</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>{vendorModalItem.batchNumber}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{new Date(vendorModalItem.expiryDate).toLocaleDateString('vi-VN')}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{vendorQuantity} {vendorModalItem.unit}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{formatVND(vendorModalItem.importPrice)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatVND(vendorModalItem.importPrice * vendorQuantity)}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                  Đề nghị Quý Công ty cử đại diện tiếp nhận và hoàn tất thủ tục đổi date mới có hạn dùng tối thiểu trên 18 tháng trong vòng 07 ngày làm việc kể từ ngày nhận được biên bản này.
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', textAlign: 'center' }}>
                  <div style={{ width: '200px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>ĐẠI DIỆN NHÀ CUNG CẤP</div>
                    <div style={{ fontSize: '11px', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</div>
                  </div>
                  <div style={{ width: '200px', position: 'relative' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>TRƯỞNG KHOA DƯỢC</div>
                    <div style={{ fontSize: '11px', fontStyle: 'italic' }}>(Ký đóng dấu)</div>
                    <div style={{ position: 'absolute', top: '15px', right: '15px' }}>
                      <RedStamp name="DS. TRƯỞNG KHOA" />
                    </div>
                    <div style={{ marginTop: '55px', fontSize: '12px', fontWeight: 'bold' }}>
                      {user?.fullName || "DS. Lê Văn Chương"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={16} />
                <span>In biên bản (Print)</span>
              </button>
              <button className="btn btn-warning" onClick={handleConfirmVendorReturn}>
                <CheckCircle2 size={16} />
                <span>Xác nhận gửi & Khóa xuất lô</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Ma Trận Tiêu Thụ Toàn Viện (Heatmap Matrix) */}
      {matrixModalItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '840px', width: '92%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <button 
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', zIndex: 10 }}
              onClick={() => setMatrixModalItem(null)}
              title="Đóng"
            >
              <X size={22} />
            </button>

            <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                <TrendingUp className="text-primary" size={22} />
                <span>Ma Trận Nhu Cầu & Tiêu Thụ Toàn Viện</span>
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Chi tiết mức dùng thuốc <b>{matrixModalItem.medicineName}</b> tại tất cả các khoa lâm sàng
              </p>
            </div>

            <div className="modal-body" style={{ padding: 0 }}>
              {matrixLoading ? (
                <div className="py-12 text-center">
                  <RefreshCw className="spin mx-auto mb-2 text-primary" size={28} />
                  <p className="text-muted">Đang tính toán tiêu thụ 30 ngày qua trên các khoa...</p>
                </div>
              ) : matrixData ? (
                <div>
                  <div className="card-subtle p-3 mb-4" style={{ background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div className="font-bold text-main text-base">{matrixData.medicine?.medicineName}</div>
                    <div className="text-xs text-muted mt-1" style={{ display: 'flex', gap: '12px' }}>
                      <span>Mã: <b>{matrixData.medicine?.medicineCode}</b></span>
                      <span>Hoạt chất: <b>{matrixData.medicine?.genericName}</b></span>
                      <span>Quy cách: <b>{matrixData.medicine?.specification}</b></span>
                    </div>
                  </div>

                  <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <table className="custom-table" style={{ width: '100%', margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: '220px' }}>Khoa Phòng</th>
                          <th className="text-center" style={{ width: '140px' }}>Đã Dùng (30 ngày)</th>
                          <th className="text-center" style={{ width: '130px' }}>Tốc Độ ADC</th>
                          <th className="text-center" style={{ width: '120px' }}>Tồn Hiện Tại</th>
                          <th className="text-center" style={{ width: '140px' }}>Số Ngày Tồn Trữ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(matrixData.departments || []).map(dept => {
                          const isHighUsage = dept.thirtyDayUsage > 0;
                          return (
                            <tr key={dept.departmentID}>
                              <td className="font-medium">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span className="font-semibold text-main">{dept.departmentName}</span>
                                  {dept.departmentID === matrixModalItem.recommendedTargetDeptID && (
                                    <span className="badge badge-primary text-xs font-semibold">★ Gợi ý chuyển đến</span>
                                  )}
                                  {dept.departmentID === matrixModalItem.departmentID && (
                                    <span className="badge badge-outline text-xs">Vị trí hiện tại</span>
                                  )}
                                </div>
                              </td>
                              <td className="text-center font-bold text-main">{dept.thirtyDayUsage}</td>
                              <td className="text-center">
                                <span className={isHighUsage ? 'text-primary font-bold' : 'text-muted'}>
                                  {dept.adc}
                                </span> /ngày
                              </td>
                              <td className="text-center font-semibold text-main">{dept.currentStock}</td>
                              <td className="text-center font-medium">
                                {dept.daysOfSupply >= 999 ? (
                                  <span className="text-muted">Không dùng</span>
                                ) : (
                                  <span className={dept.daysOfSupply < 30 ? 'text-danger font-bold' : 'text-main'}>
                                    {dept.daysOfSupply} ngày
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn btn-secondary" onClick={() => setMatrixModalItem(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
