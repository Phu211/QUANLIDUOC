import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ClipboardList, 
  Monitor, 
  RotateCcw, 
  Trash2, 
  BarChart3, 
  Activity, 
  User, 
  Clock, 
  Warehouse, 
  Database, 
  LogOut, 
  AlertTriangle, 
  ShieldAlert,
  Sun,
  Moon,
  Menu,
  ChevronLeft,
  ChevronRight,
  Building2,
  Calendar,
  ArrowLeftRight,
  Stethoscope,
  Lock,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import Dashboard from './pages/Dashboard';
import ImportReceipts from './pages/ImportReceipts';
import Requisitions from './pages/Requisitions';
import CabinetManagement from './pages/CabinetManagement';
import Returns from './pages/Returns';
import Liquidation from './pages/Liquidation';
import Recall from './pages/Recall';
import InventoryTracking from './pages/InventoryTracking';
import InventoryAudit from './pages/InventoryAudit';
import MedicineManagement from './pages/MedicineManagement';
import Login from './pages/Login';
import RestockManagement from './pages/RestockManagement';
import ShortDatedClearance from './pages/ShortDatedClearance';
import OutpatientDispensing from './pages/OutpatientDispensing';
import PharmacyChatbot from './components/PharmacyChatbot';
import AccountingPeriodPage from './pages/AccountingPeriodPage';
import AuditTrailPage from './pages/AuditTrailPage';
import PatientPortal from './pages/PatientPortal';

const sanitizeUserData = (u) => {
  if (!u) return u;
  const clone = { ...u };
  if (clone.fullName && (clone.fullName.includes('á»') || clone.fullName.includes('Ă') || clone.fullName.includes('Ä') || clone.fullName.includes('ï¿½'))) {
    if (clone.username === 'thukho' || clone.username === 'phu') {
      clone.fullName = 'Thủ kho Hà Lâm Đình Phú';
    } else if (clone.username === 'anh') {
      clone.fullName = 'Thủ kho Kiều Đức Anh';
    }
  }
  return clone;
};

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('his-pharmacy-user');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      const sanitized = sanitizeUserData(parsed);
      if (JSON.stringify(sanitized) !== saved) {
        localStorage.setItem('his-pharmacy-user', JSON.stringify(sanitized));
      }
      return sanitized;
    } catch {
      return null;
    }
  });
  
  const getInitialPageForUser = (u) => {
    if (!u) return 'dashboard';
    switch (u.role) {
      case 'director': return 'dashboard';
      case 'pharmacist': return 'dashboard';
      case 'dispensary': return 'dispensing';
      case 'head': return 'cabinet';
      case 'head_nurse': return 'cabinet';
      case 'nurse': return 'cabinet';
      default: return 'dashboard';
    }
  };

  const isPageAllowedForRole = (p, role) => {
    if (role === 'director') return true;
    if (p === 'patient-portal') return true;
    
    switch (role) {
      case 'pharmacist':
        return [
          'dashboard', 'imports', 'requisitions', 'returns', 'tracking', 
          'audit', 'restock', 'clearance', 'recall', 'liquidation', 
          'cabinet', 'medicine', 'accounting-period', 'audit-trail'
        ].includes(p);
        
      case 'dispensary':
        return ['dispensing', 'cabinet'].includes(p);
        
      case 'head':
        return ['dashboard', 'cabinet', 'requisitions', 'returns', 'audit', 'recall', 'audit-trail'].includes(p);
        
      case 'head_nurse':
        return ['cabinet', 'requisitions', 'returns', 'audit', 'recall', 'audit-trail'].includes(p);
        
      case 'nurse':
        return ['cabinet'].includes(p);
        
      default:
        return false;
    }
  };

  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('his-pharmacy-user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        return getInitialPageForUser(u);
      } catch {
        return 'dashboard';
      }
    }
    return 'dashboard';
  });

  // Tự động điều hướng về trang mặc định của vai trò nếu trang hiện tại không được cấp quyền
  useEffect(() => {
    if (user && !isPageAllowedForRole(page, user.role)) {
      setPage(getInitialPageForUser(user));
    }
  }, [user, page]);

  const [isPublicPortal, setIsPublicPortal] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('portal') || urlParams.has('prescription') || window.location.pathname.startsWith('/portal');
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [realtimeStatus, setRealtimeStatus] = useState('connecting'); // 'connecting', 'connected', 'error'
  
  // Theme state: default to 'light' for optimal clinical contrast
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('his-pharmacy-theme') || 'light';
  });

  // Collapsible sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('his-pharmacy-sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('his-pharmacy-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('his-pharmacy-sidebar-collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Establish real-time SignalR connection
  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl('/pharmacyHub')
      .withAutomaticReconnect()
      .build();

    connection.start()
      .then(() => {
        console.log("Real-time SignalR connected successfully.");
        setRealtimeStatus('connected');
        
        connection.on("NotifyUpdate", (eventType) => {
          console.log(`SignalR: Real-time update signal received for '${eventType}'`);
          // Dispatch a browser-level custom event so pages can listen and reload their data
          window.dispatchEvent(new CustomEvent('pharmacy-update', { detail: eventType }));
        });
      })
      .catch(err => {
        console.error("SignalR connection error: ", err);
        setRealtimeStatus('error');
      });

    return () => {
      connection.stop();
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('his-pharmacy-user');
    setUser(null);
  };

  const getPageTitle = () => {
    switch (page) {
      case 'dashboard': return 'Bảng Điều Khiển Trung Tâm';
      case 'medicine': return 'Quản Lý Danh Mục Thuốc';
      case 'imports': return 'Nhập Kho & Kiểm Nhập';
      case 'requisitions': return (user?.role === 'pharmacist') ? 'Xuất Kho Theo Phiếu Lĩnh Khoa Phòng' : 'Yêu Cầu Lĩnh Thuốc & Vật Tư Khoa';
      case 'cabinet': return (user?.role === 'director' || user?.role === 'pharmacist' || user?.role === 'dispensary')
        ? 'Tra Cứu Tồn Kho Tủ Thuốc Từng Khoa'
        : 'Quản Lý Tủ Trực Khoa';
      case 'returns': return 'Hoàn Trả Thuốc Thừa';
      case 'liquidation': return 'Thanh Lý Tài Sản';
      case 'recall': return 'Thu Hồi & Cách Ly Lô';
      case 'tracking': return 'Báo Cáo Nhập Xuất Tồn';
      case 'audit': return 'Kiểm Kê Kho & Tủ Trực';
      case 'restock': return 'Cảnh Báo & Đề Xuất Đặt Hàng';
      case 'clearance': return 'Cảnh Báo & Điều Chuyển Thuốc Cận Date';
      case 'dispensing': return 'Cấp Phát Thuốc Ngoại Trú & Quét Đơn Thuốc';
      case 'accounting-period': return 'Khóa Sổ Kỳ Dược Cuối Tháng';
      case 'audit-trail': return (user?.role === 'head' || user?.role === 'head_nurse') 
        ? `Nhật Ký Hoạt Động - ${user?.departmentName || 'Khoa Lâm Sàng'}` 
        : 'Nhật Ký Hoạt Động & Kiểm Toán Tự Động';
      case 'patient-portal': return 'Cổng Bệnh Nhân Tra Cứu Đơn Thuốc & ADR';
      default: return 'Hệ Thống Quản Lý Dược';
    }
  };

  const renderPageComponent = (p) => {
    switch (p) {
      case 'dashboard':
        return <Dashboard setPage={setPage} user={user} />;
      case 'medicine':
        return <MedicineManagement user={user} />;
      case 'dispensing':
        return <OutpatientDispensing user={user} setPage={setPage} />;
      case 'imports':
        return <ImportReceipts user={user} />;
      case 'requisitions':
        return <Requisitions user={user} />;
      case 'cabinet':
        return <CabinetManagement user={user} />;
      case 'returns':
        return <Returns user={user} />;
      case 'liquidation':
        return <Liquidation user={user} />;
      case 'recall':
        return <Recall user={user} />;
      case 'tracking':
        return <InventoryTracking user={user} />;
      case 'audit':
        return <InventoryAudit user={user} />;
      case 'restock':
        return <RestockManagement user={user} />;
      case 'clearance':
        return <ShortDatedClearance user={user} setPage={setPage} />;
      case 'accounting-period':
        return <AccountingPeriodPage user={user} />;
      case 'audit-trail':
        return <AuditTrailPage user={user} />;
      case 'patient-portal':
        return <PatientPortal onSwitchToStaffLogin={() => setPage('dashboard')} />;
      default:
        return <Dashboard setPage={setPage} user={user} />;
    }
  };

  const renderPage = () => {
    if (user && !isPageAllowedForRole(page, user.role)) {
      const fallback = getInitialPageForUser(user);
      return renderPageComponent(fallback);
    }
    return renderPageComponent(page);
  };

  const getRoleDisplayName = (u) => {
    if (!u) return 'Cán bộ Y tế';
    const role = typeof u === 'string' ? u : u.role;
    const username = typeof u === 'object' ? u.username : user?.username;
    const dept = typeof u === 'object' ? u.departmentName : user?.departmentName;

    switch (role) {
      case 'director':
        return username === 'duy' ? 'PGS.TS. Phó Giám Đốc' : 'PGS.TS. Giám Đốc Bệnh Viện';
      case 'pharmacist':
        if (username === 'thukho') return 'Thủ kho Kho Chẵn (Chính)';
        return 'Thủ kho Kho Chẵn';
      case 'dispensary':
        return dept ? `Dược sĩ (${dept})` : 'Dược sĩ';
      case 'head':
        return dept ? `BS.CKII. Trưởng ${dept}` : 'BS. Trưởng khoa';
      case 'head_nurse':
        return dept ? `ĐD Trưởng (${dept})` : 'Điều dưỡng trưởng';
      case 'nurse':
        return dept ? `Điều dưỡng viên (${dept})` : 'Điều dưỡng viên';
      default:
        return 'Cán bộ Y tế';
    }
  };

  // Trang công khai Cổng Bệnh Nhân (Public Portal): không cần đăng nhập
  if (isPublicPortal) {
    const codeParam = new URLSearchParams(window.location.search).get('code') || 
                      new URLSearchParams(window.location.search).get('prescription') || '';
    return (
      <PatientPortal 
        initialCode={codeParam} 
        onSwitchToStaffLogin={() => {
          setIsPublicPortal(false);
          window.history.replaceState({}, '', window.location.pathname);
        }} 
      />
    );
  }

  if (!user) {
    return (
      <Login 
        onLoginSuccess={(u) => {
          const sanitized = sanitizeUserData(u);
          setUser(sanitized);
          localStorage.setItem('his-pharmacy-user', JSON.stringify(sanitized));
          setPage(getInitialPageForUser(sanitized));
        }} 
      />
    );
  }

  return (
    <div className="app-container">
      {/* Grouped & Collapsible Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="logo-container">
          <div className="logo-badge" title="HIS - Quản Lý Dược Bệnh Viện">
            <Activity size={24} />
          </div>
          <div className="logo-info">
            <div className="logo-text">HIS - PHARMACY</div>
            <div className="logo-sub">Phân hệ Quản Lý Dược</div>
          </div>
        </div>

        <div className="nav-links">
          {/* 1. BAN GIÁM ĐỐC (director) - Quản trị toàn viện, phê duyệt & giám sát */}
          {user.role === 'director' && (
            <>
              <div className="nav-section-title" title="Ban Giám Đốc Bệnh Viện">Hệ Thống Lãnh Đạo</div>
              <a 
                className={`nav-item ${page === 'dashboard' ? 'active' : ''}`}
                onClick={() => setPage('dashboard')}
                title="Tổng quan toàn viện"
              >
                <LayoutDashboard className="nav-icon" />
                <span>Tổng quan toàn viện</span>
              </a>
              <a 
                className={`nav-item ${page === 'medicine' ? 'active' : ''}`}
                onClick={() => setPage('medicine')}
                title="Danh mục thuốc bệnh viện"
              >
                <Database className="nav-icon" />
                <span>Danh mục thuốc viện</span>
              </a>
              <a 
                className={`nav-item ${page === 'accounting-period' ? 'active' : ''}`}
                onClick={() => setPage('accounting-period')}
                title="Khóa sổ kỳ Dược cuối tháng"
              >
                <Lock className="nav-icon" style={{ color: '#ef4444' }} />
                <span>Khóa sổ kỳ Dược</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit-trail' ? 'active' : ''}`}
                onClick={() => setPage('audit-trail')}
                title="Nhật ký kiểm toán hệ thống"
              >
                <ShieldCheck className="nav-icon" style={{ color: '#3b82f6' }} />
                <span>Nhật ký kiểm toán</span>
              </a>

              <div className="nav-section-title" title="Kho Dược & Phê Duyệt">Kho Dược & Phê Duyệt</div>
              <a 
                className={`nav-item ${page === 'imports' ? 'active' : ''}`}
                onClick={() => setPage('imports')}
                title="Duyệt nhập kho & Kiểm nhập"
              >
                <Package className="nav-icon" />
                <span>Phê duyệt nhập kho</span>
              </a>
              <a 
                className={`nav-item ${page === 'requisitions' ? 'active' : ''}`}
                onClick={() => setPage('requisitions')}
                title="Giám sát cấp phát phiếu lĩnh"
              >
                <ClipboardList className="nav-icon" />
                <span>Giám sát phiếu lĩnh</span>
              </a>
              <a 
                className={`nav-item ${page === 'returns' ? 'active' : ''}`}
                onClick={() => setPage('returns')}
                title="Duyệt hoàn trả thuốc thừa"
              >
                <RotateCcw className="nav-icon" />
                <span>Duyệt nhận hoàn trả</span>
              </a>
              <a 
                className={`nav-item ${page === 'tracking' ? 'active' : ''}`}
                onClick={() => setPage('tracking')}
                title="Báo cáo Nhập - Xuất - Tồn toàn viện"
              >
                <BarChart3 className="nav-icon" />
                <span>Thống kê Nhập Xuất Tồn</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit' ? 'active' : ''}`}
                onClick={() => setPage('audit')}
                title="Phê duyệt kiểm kê Kho Dược"
              >
                <ClipboardList className="nav-icon" />
                <span>Phê duyệt kiểm kê</span>
              </a>

              <div className="nav-section-title" title="Dự Trù & Rủi Ro">Dự Trù & Rủi Ro</div>
              <a 
                className={`nav-item ${page === 'restock' ? 'active' : ''}`}
                onClick={() => setPage('restock')}
                title="Phê duyệt dự trù & mua sắm thuốc"
              >
                <ClipboardList className="nav-icon" />
                <span>Duyệt dự trù mua sắm</span>
              </a>
              <a 
                className={`nav-item ${page === 'clearance' ? 'active' : ''}`}
                onClick={() => setPage('clearance')}
                title="Điều chuyển thuốc cận date"
              >
                <ArrowLeftRight className="nav-icon" />
                <span>Điều chuyển cận date</span>
              </a>
              <a 
                className={`nav-item ${page === 'recall' ? 'active' : ''}`}
                onClick={() => setPage('recall')}
                title="Phê duyệt thu hồi & Cách ly lô thuốc"
              >
                <ShieldAlert className="nav-icon" />
                <span>Thu hồi & Cách ly lô</span>
              </a>
              <a 
                className={`nav-item ${page === 'liquidation' ? 'active' : ''}`}
                onClick={() => setPage('liquidation')}
                title="Phê duyệt thanh lý & Hủy hao hụt"
              >
                <Trash2 className="nav-icon" />
                <span>Thanh lý & Hao hụt</span>
              </a>

              <div className="nav-section-title" title="Lâm Sàng & Phân Phối">Phân Phối & Lâm Sàng</div>
              <a 
                className={`nav-item ${page === 'dispensing' ? 'active' : ''}`}
                onClick={() => setPage('dispensing')}
                title="Giám sát cấp phát thuốc theo đơn ngoại trú"
              >
                <Stethoscope className="nav-icon" />
                <span>Cấp phát ngoại trú</span>
              </a>
              <a 
                className={`nav-item ${page === 'cabinet' ? 'active' : ''}`}
                onClick={() => setPage('cabinet')}
                title="Xem tủ kho thuốc & tồn kho từng khoa lâm sàng"
              >
                <Monitor className="nav-icon" />
                <span>Tủ thuốc từng khoa</span>
              </a>
            </>
          )}

          {/* 2. KHO DƯỢC TRUNG TÂM / KHO CHẴN (pharmacist: thukho, anh) */}
          {user.role === 'pharmacist' && (
            <>
              <div className="nav-section-title" title="Kho Dược Trung Tâm">
                {user.username === 'thukho' ? 'Thủ Kho Kho Chẵn' : 'Kho Dược Trung Tâm'}
              </div>
              <a 
                className={`nav-item ${page === 'dashboard' ? 'active' : ''}`}
                onClick={() => setPage('dashboard')}
                title="Tổng quan Kho Dược Trung Tâm"
              >
                <LayoutDashboard className="nav-icon" />
                <span>Tổng quan Kho Dược</span>
              </a>
              <a 
                className={`nav-item ${page === 'imports' ? 'active' : ''}`}
                onClick={() => setPage('imports')}
                title="Nhập kho & Kiểm nhập dược phẩm"
              >
                <Package className="nav-icon" />
                <span>Nhập kho & Kiểm nhập</span>
              </a>
              <a 
                className={`nav-item ${page === 'requisitions' ? 'active' : ''}`}
                onClick={() => setPage('requisitions')}
                title="Duyệt và xuất kho dược phẩm theo phiếu lĩnh của khoa phòng"
              >
                <ClipboardList className="nav-icon" />
                <span>Xuất kho phiếu lĩnh</span>
              </a>
              <a 
                className={`nav-item ${page === 'returns' ? 'active' : ''}`}
                onClick={() => setPage('returns')}
                title="Tiếp nhận thuốc hoàn trả từ khoa lâm sàng"
              >
                <RotateCcw className="nav-icon" />
                <span>Tiếp nhận hoàn trả</span>
              </a>
              <a 
                className={`nav-item ${page === 'tracking' ? 'active' : ''}`}
                onClick={() => setPage('tracking')}
                title="Thẻ kho & Thống kê Nhập - Xuất - Tồn"
              >
                <BarChart3 className="nav-icon" />
                <span>Thống kê Nhập Xuất Tồn</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit' ? 'active' : ''}`}
                onClick={() => setPage('audit')}
                title="Kiểm kê Kho Dược & Đối soát tồn thực tế"
              >
                <ClipboardList className="nav-icon" />
                <span>Kiểm kê Kho Dược</span>
              </a>

              <div className="nav-section-title" title="Dự Trù & Điều Phối">Dự Trù & Điều Phối</div>
              <a 
                className={`nav-item ${page === 'restock' ? 'active' : ''}`}
                onClick={() => setPage('restock')}
                title="Lập dự trù & Đặt hàng dược phẩm"
              >
                <ClipboardList className="nav-icon" />
                <span>Dự trù & Đặt hàng</span>
              </a>
              <a 
                className={`nav-item ${page === 'clearance' ? 'active' : ''}`}
                onClick={() => setPage('clearance')}
                title="Điều chuyển thuốc cận hạn sử dụng"
              >
                <ArrowLeftRight className="nav-icon" />
                <span>Điều chuyển cận date</span>
              </a>
              <a 
                className={`nav-item ${page === 'recall' ? 'active' : ''}`}
                onClick={() => setPage('recall')}
                title="Thu hồi & Cách ly lô thuốc khẩn cấp"
              >
                <ShieldAlert className="nav-icon" />
                <span>Thu hồi & Cách ly lô</span>
              </a>
              <a 
                className={`nav-item ${page === 'liquidation' ? 'active' : ''}`}
                onClick={() => setPage('liquidation')}
                title="Biên bản thanh lý thuốc & Hủy hao hụt"
              >
                <Trash2 className="nav-icon" />
                <span>Thanh lý & Hao hụt</span>
              </a>

              <div className="nav-section-title" title="Lâm Sàng & Danh Mục">Lâm Sàng & Danh Mục</div>
              <a 
                className={`nav-item ${page === 'cabinet' ? 'active' : ''}`}
                onClick={() => setPage('cabinet')}
                title="Xem tủ kho thuốc & tồn kho từng khoa lâm sàng"
              >
                <Monitor className="nav-icon" />
                <span>Tủ thuốc từng khoa</span>
              </a>
              <a 
                className={`nav-item ${page === 'medicine' ? 'active' : ''}`}
                onClick={() => setPage('medicine')}
                title="Danh mục thuốc bệnh viện"
              >
                <Database className="nav-icon" />
                <span>Danh mục thuốc viện</span>
              </a>
              <a 
                className={`nav-item ${page === 'accounting-period' ? 'active' : ''}`}
                onClick={() => setPage('accounting-period')}
                title="Khóa sổ kỳ Dược cuối tháng"
              >
                <Lock className="nav-icon" style={{ color: '#ef4444' }} />
                <span>Khóa sổ kỳ Dược</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit-trail' ? 'active' : ''}`}
                onClick={() => setPage('audit-trail')}
                title="Nhật ký kiểm toán & vết hoạt động hệ thống"
              >
                <ShieldCheck className="nav-icon" style={{ color: '#3b82f6' }} />
                <span>Nhật ký hoạt động</span>
              </a>
            </>
          )}

          {/* 3. DƯỢC SĨ (dispensary: ds_khambenh, ds_capcuu, ds_noitonghop) - CHỈ CÓ QUYỀN CẤP PHÁT THUỐC VÀ XEM TỦ THUỐC */}
          {user.role === 'dispensary' && (
            <>
              <div className="nav-section-title" title="Dược Sĩ Cấp Phát & Tủ Thuốc">
                {user.departmentName ? `Dược Sĩ: ${user.departmentName}` : 'Dược Sĩ'}
              </div>
              <a 
                className={`nav-item ${page === 'dispensing' ? 'active' : ''}`}
                onClick={() => setPage('dispensing')}
                title="Cấp phát thuốc cho bệnh nhân theo đơn ngoại trú"
              >
                <Stethoscope className="nav-icon" />
                <span>Cấp phát theo đơn</span>
              </a>
              <a 
                className={`nav-item ${page === 'cabinet' ? 'active' : ''}`}
                onClick={() => setPage('cabinet')}
                title="Xem tồn kho tủ thuốc lâm sàng & quầy"
              >
                <Monitor className="nav-icon" />
                <span>Xem tủ thuốc</span>
              </a>
            </>
          )}

          {/* 4. BÁC SĨ TRƯỞNG KHOA LÂM SÀNG (head: tkkhambenh, tkcapcuu, tknoitonghop...) */}
          {user.role === 'head' && (
            <>
              <div className="nav-section-title" title="Lãnh Đạo Khoa Lâm Sàng">
                {user.departmentName ? `Trưởng ${user.departmentName}` : 'Trưởng Khoa Lâm Sàng'}
              </div>
              <a 
                className={`nav-item ${page === 'dashboard' ? 'active' : ''}`}
                onClick={() => setPage('dashboard')}
                title="Tổng quan hoạt động khoa"
              >
                <LayoutDashboard className="nav-icon" />
                <span>Tổng quan khoa</span>
              </a>
              <a 
                className={`nav-item ${page === 'cabinet' ? 'active' : ''}`}
                onClick={() => setPage('cabinet')}
                title="Quản lý & Giám sát tủ trực khoa"
              >
                <Monitor className="nav-icon" />
                <span>Quản lý tủ trực khoa</span>
              </a>
              <a 
                className={`nav-item ${page === 'requisitions' ? 'active' : ''}`}
                onClick={() => setPage('requisitions')}
                title="Ký duyệt phiếu lĩnh thuốc bù cơ số"
              >
                <ClipboardList className="nav-icon" />
                <span>Ký duyệt phiếu lĩnh</span>
              </a>
              <a 
                className={`nav-item ${page === 'returns' ? 'active' : ''}`}
                onClick={() => setPage('returns')}
                title="Duyệt hoàn trả thuốc thừa về kho"
              >
                <RotateCcw className="nav-icon" />
                <span>Duyệt hoàn trả thuốc</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit' ? 'active' : ''}`}
                onClick={() => setPage('audit')}
                title="Phê duyệt biên bản kiểm kê tủ trực định kỳ"
              >
                <ClipboardList className="nav-icon" />
                <span>Duyệt kiểm kê tủ trực</span>
              </a>
              <a 
                className={`nav-item ${page === 'recall' ? 'active' : ''}`}
                onClick={() => setPage('recall')}
                title="Cảnh báo & Xử lý thuốc thu hồi tại khoa"
              >
                <ShieldAlert className="nav-icon" />
                <span>Cảnh báo thuốc thu hồi</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit-trail' ? 'active' : ''}`}
                onClick={() => setPage('audit-trail')}
                title="Nhật ký hoạt động & vết thao tác của khoa"
              >
                <ShieldCheck className="nav-icon" style={{ color: '#3b82f6' }} />
                <span>Nhật ký hoạt động khoa</span>
              </a>
            </>
          )}

          {/* 5. ĐIỀU DƯỠNG TRƯỞNG KHOA (head_nurse: dieuduong, ddkhambenh, ddnoitonghop...) */}
          {user.role === 'head_nurse' && (
            <>
              <div className="nav-section-title" title="Quản Lý Tủ Trực Khoa">
                {user.departmentName ? `ĐD Trưởng ${user.departmentName}` : 'Điều Dưỡng Trưởng Khoa'}
              </div>
              <a 
                className={`nav-item ${page === 'cabinet' ? 'active' : ''}`}
                onClick={() => setPage('cabinet')}
                title="Quản lý cơ số tủ trực & báo hỏng vỡ"
              >
                <Monitor className="nav-icon" />
                <span>Quản lý tủ trực khoa</span>
              </a>
              <a 
                className={`nav-item ${page === 'requisitions' ? 'active' : ''}`}
                onClick={() => setPage('requisitions')}
                title="Lập dự trù lĩnh bù cơ số tủ trực"
              >
                <ClipboardList className="nav-icon" />
                <span>Lập phiếu lĩnh bù cơ số</span>
              </a>
              <a 
                className={`nav-item ${page === 'returns' ? 'active' : ''}`}
                onClick={() => setPage('returns')}
                title="Lập phiếu hoàn trả thuốc thừa, thuốc hỏng"
              >
                <RotateCcw className="nav-icon" />
                <span>Lập phiếu trả thuốc thừa</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit' ? 'active' : ''}`}
                onClick={() => setPage('audit')}
                title="Thực hiện kiểm kê tủ trực khoa định kỳ"
              >
                <ClipboardList className="nav-icon" />
                <span>Kiểm kê tủ trực định kỳ</span>
              </a>
              <a 
                className={`nav-item ${page === 'recall' ? 'active' : ''}`}
                onClick={() => setPage('recall')}
                title="Kiểm tra & Rà soát thuốc thu hồi tại tủ"
              >
                <ShieldAlert className="nav-icon" />
                <span>Rà soát thuốc thu hồi</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit-trail' ? 'active' : ''}`}
                onClick={() => setPage('audit-trail')}
                title="Nhật ký hoạt động & vết thao tác của khoa"
              >
                <ShieldCheck className="nav-icon" style={{ color: '#3b82f6' }} />
                <span>Nhật ký hoạt động khoa</span>
              </a>
            </>
          )}

          {/* 6. ĐIỀU DƯỠNG VIÊN LÂM SÀNG (nurse: quan) */}
          {user.role === 'nurse' && (
            <>
              <div className="nav-section-title" title="Điều Dưỡng Lâm Sàng">
                {user.departmentName ? `ĐDV ${user.departmentName}` : 'Điều Dưỡng Viên'}
              </div>
              <a 
                className={`nav-item ${page === 'cabinet' ? 'active' : ''}`}
                onClick={() => setPage('cabinet')}
                title="Xuất thuốc tại giường bệnh & Báo hỏng vỡ tủ trực"
              >
                <Monitor className="nav-icon" />
                <span>Tủ trực khoa (Xuất thuốc)</span>
              </a>
            </>
          )}
        </div>

        {/* Sidebar Footer User Info */}
        <div className="sidebar-footer">
          <div className="user-quick-card" title={`${user.fullName} (${getRoleDisplayName(user)})`}>
            <div className="user-avatar">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : <User size={16} />}
            </div>
            {!isSidebarCollapsed && (
              <div className="user-info-text">
                <div className="user-name">{user.fullName}</div>
                <div className="user-role-label">{getRoleDisplayName(user)}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`main-content ${isSidebarCollapsed ? 'expanded' : ''}`}>
        <header className="top-bar">
          <div className="top-bar-left">
            <button 
              className="sidebar-toggle-btn" 
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Mở rộng thanh menu" : "Thu gọn thanh menu"}
              aria-label="Toggle Sidebar"
            >
              {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            <h2 style={{ 
              fontSize: '1.2rem', 
              fontWeight: '700', 
              letterSpacing: '-0.01em', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.65rem' 
            }}>
              <span>{getPageTitle()}</span>
              <span 
                style={{ 
                  width: '9px', 
                  height: '9px', 
                  borderRadius: '50%', 
                  background: realtimeStatus === 'connected' ? 'var(--color-success)' : realtimeStatus === 'connecting' ? 'var(--color-warning)' : 'var(--color-danger)',
                  display: 'inline-block',
                  boxShadow: realtimeStatus === 'connected' 
                    ? '0 0 10px var(--color-success)' 
                    : realtimeStatus === 'connecting' 
                    ? '0 0 10px var(--color-warning)' 
                    : '0 0 10px var(--color-danger)',
                  animation: 'pulse-urgent 2s infinite ease-in-out'
                }} 
                title={realtimeStatus === 'connected' ? 'SignalR: Đồng bộ thời gian thực Hoạt động' : 'Đang kết nối máy chủ thời gian thực...'} 
              />
            </h2>
          </div>

          <div className="top-bar-right">
            {/* Department Badge */}
            <div className="top-bar-badge">
              <Building2 size={15} style={{ color: 'var(--color-primary)' }} />
              <span>
                {user.role === 'pharmacist'
                  ? (user.username === 'thukho' ? 'Kho Dược Chính (Thủ Kho)' : 'Kho Dược Trung Tâm (Kho Chẵn)')
                  : user.role === 'dispensary'
                  ? (user.departmentName ? `Quầy Dược: ${user.departmentName}` : 'Quầy Dược Ngoại Trú')
                  : user.role === 'head'
                  ? `Lãnh Đạo: ${user.departmentName || 'Khoa Lâm Sàng'}`
                  : user.role === 'head_nurse'
                  ? `ĐD Trưởng: ${user.departmentName || 'Khoa Lâm Sàng'}`
                  : user.role === 'nurse'
                  ? `ĐDV: ${user.departmentName || 'Khoa Lâm Sàng'}`
                  : 'Ban Giám Đốc Bệnh Viện'}
              </span>
            </div>

            {/* Time & Date */}
            <div className="top-bar-badge">
              <Clock size={15} style={{ color: 'var(--color-secondary)' }} />
              <span>{currentTime.toLocaleTimeString('vi-VN')}</span>
            </div>

            {/* Accounting Period Quick Button: Hiển thị cho Ban Giám Đốc và Thủ kho chẵn */}
            {(user.role === 'director' || user.role === 'pharmacist') && (
              <button
                onClick={() => setPage('accounting-period')}
                className={`btn-secondary ${page === 'accounting-period' ? 'active' : ''}`}
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                  height: '36px',
                  gap: '0.35rem',
                  color: '#ef4444',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  background: page === 'accounting-period' ? 'rgba(239, 68, 68, 0.1)' : undefined
                }}
                title="Khóa sổ kỳ Dược cuối tháng"
              >
                <Lock size={14} />
                <span>Khóa sổ</span>
              </button>
            )}

            {/* Audit Trail Quick Button: Hiển thị cho Ban Giám Đốc, Dược chính và Lãnh đạo khoa */}
            {(user.role === 'director' || user.role === 'pharmacist' || user.role === 'head' || user.role === 'head_nurse') && (
              <button
                onClick={() => setPage('audit-trail')}
                className={`btn-secondary ${page === 'audit-trail' ? 'active' : ''}`}
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.8rem',
                  height: '36px',
                  gap: '0.35rem',
                  color: '#3b82f6',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  background: page === 'audit-trail' ? 'rgba(59, 130, 246, 0.1)' : undefined
                }}
                title={user.role === 'head' || user.role === 'head_nurse' ? 'Nhật ký hoạt động của khoa' : 'Nhật ký hoạt động & kiểm toán hệ thống'}
              >
                <ShieldCheck size={14} />
                <span>{user.role === 'head' || user.role === 'head_nurse' ? 'Nhật ký khoa' : 'Kiểm toán'}</span>
              </button>
            )}

            {/* Quick Access to Patient QR Portal */}
            <button
              onClick={() => setPage(page === 'patient-portal' ? getInitialPageForUser(user) : 'patient-portal')}
              className={`btn-secondary ${page === 'patient-portal' ? 'active' : ''}`}
              style={{
                padding: '0.45rem 0.75rem',
                fontSize: '0.8rem',
                height: '36px',
                gap: '0.35rem',
                color: '#059669',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                background: page === 'patient-portal' ? 'rgba(16, 185, 129, 0.1)' : undefined
              }}
              title="Cổng Tra Cứu Bệnh Nhân (Patient QR Portal)"
            >
              <QrCode size={14} />
              <span>Cổng QR</span>
            </button>

            {/* Theme Toggle Button (Light / Dark) */}
            <button 
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Chuyển sang Chế độ Tối (Dark mode)' : 'Chuyển sang Chế độ Sáng (Light mode)'}
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Logout Button */}
            <button 
              onClick={handleLogout}
              className="btn-danger"
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                height: '36px',
                gap: '0.35rem'
              }}
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut size={14} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </header>

        <div className="content-body">
          {renderPage()}
        </div>
      </main>

      {/* Trợ Lý Dược Lâm Sàng AI Chatbot */}
      {user && <PharmacyChatbot user={user} />}
    </div>
  );
}
