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

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('his-pharmacy-user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('his-pharmacy-user');
    if (saved) {
      const u = JSON.parse(saved);
      const isPharm = u.role === 'dispensary' || u.role === 'pharmacist';
      return u.role === 'nurse' ? 'cabinet' : isPharm ? 'dispensing' : 'dashboard';
    }
    return 'dashboard';
  });

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
      case 'requisitions': return 'Cấp Phát Thuốc & Vật Tư Khoa';
      case 'cabinet': return 'Quản Lý Tủ Trực Khoa';
      case 'returns': return 'Hoàn Trả Thuốc Thừa';
      case 'liquidation': return 'Thanh Lý Tài Sản';
      case 'recall': return 'Thu Hồi & Cách Ly Lô';
      case 'tracking': return 'Báo Cáo Nhập Xuất Tồn';
      case 'audit': return 'Kiểm Kê Kho & Tủ Trực';
      case 'restock': return 'Cảnh Báo & Đề Xuất Đặt Hàng';
      case 'clearance': return 'Cảnh Báo & Điều Chuyển Thuốc Cận Date';
      case 'dispensing': return 'Cấp Phát Thuốc Ngoại Trú & Quét Đơn Thuốc';
      case 'accounting-period': return 'Khóa Sổ Kỳ Dược Cuối Tháng';
      case 'audit-trail': return 'Nhật Ký Kiểm Toán Tự Động';
      case 'patient-portal': return 'Cổng Bệnh Nhân Tra Cứu Đơn Thuốc & ADR';
      default: return 'Hệ Thống Quản Lý Dược';
    }
  };

  const renderPage = () => {
    // Dược sĩ chỉ có vai trò: Cấp phát thuốc cho bệnh nhân ('dispensing') và Xem tồn kho tủ thuốc ('cabinet')
    const isPharmacist = user?.role === 'dispensary' || user?.role === 'pharmacist';
    if (isPharmacist) {
      const allowedPharmacistPages = ['dispensing', 'cabinet', 'patient-portal'];
      if (!allowedPharmacistPages.includes(page)) {
        return <OutpatientDispensing user={user} setPage={setPage} />;
      }
    }

    switch (page) {
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
        return isPharmacist
          ? <OutpatientDispensing user={user} setPage={setPage} />
          : (user?.role === 'nurse' || user?.role === 'head_nurse' || user?.role === 'head') 
          ? <CabinetManagement user={user} /> 
          : <Dashboard setPage={setPage} user={user} />;
    }
  };

  const getRoleDisplayName = (r) => {
    switch (r) {
      case 'pharmacist': return 'Dược sĩ Bệnh Viện';
      case 'dispensary': return user?.departmentName ? `Dược sĩ Quầy (${user.departmentName})` : 'Dược sĩ Quầy Thuốc';
      case 'nurse': return 'Điều dưỡng';
      case 'head_nurse': return 'Điều dưỡng trưởng';
      case 'head': return 'Trưởng khoa';
      case 'director': return 'Ban Giám Đốc';
      default: return 'Cán bộ Y tế';
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
          setUser(u);
          localStorage.setItem('his-pharmacy-user', JSON.stringify(u));
          const isPharm = u.role === 'dispensary' || u.role === 'pharmacist';
          setPage(u.role === 'nurse' ? 'cabinet' : isPharm ? 'dispensing' : 'dashboard');
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
          {/* Hệ thống (Chỉ Ban Giám Đốc quản trị toàn viện) */}
          {user.role === 'director' && (
            <>
              <div className="nav-section-title" title="Hệ thống">Hệ thống</div>
              <a 
                className={`nav-item ${page === 'dashboard' ? 'active' : ''}`}
                onClick={() => setPage('dashboard')}
                title="Tổng quan"
              >
                <LayoutDashboard className="nav-icon" />
                <span>Tổng quan</span>
              </a>
              <a 
                className={`nav-item ${page === 'medicine' ? 'active' : ''}`}
                onClick={() => setPage('medicine')}
                title="Danh mục thuốc viện"
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
                title="Nhật ký kiểm toán tự động"
              >
                <ShieldCheck className="nav-icon" style={{ color: '#3b82f6' }} />
                <span>Nhật ký kiểm toán</span>
              </a>
            </>
          )}

          {/* Phân hệ Dược sĩ: Chỉ Cấp phát thuốc cho bệnh nhân và Xem tồn kho tủ thuốc */}
          {(user.role === 'dispensary' || user.role === 'pharmacist') && (
            <>
              <div className="nav-section-title" title="Dược sĩ Quầy Thuốc & Kho Lẻ">
                {user.departmentName ? `Quầy Dược: ${user.departmentName}` : 'Dược sĩ Quầy Thuốc'}
              </div>
              <a 
                className={`nav-item ${page === 'dispensing' ? 'active' : ''}`}
                onClick={() => setPage('dispensing')}
                title="Cấp phát thuốc cho bệnh nhân theo đơn"
              >
                <Stethoscope className="nav-icon" />
                <span>Cấp phát theo đơn</span>
              </a>
              <a 
                className={`nav-item ${page === 'cabinet' ? 'active' : ''}`}
                onClick={() => setPage('cabinet')}
                title="Xem thuốc đó còn trong tủ thuốc hay không"
              >
                <Monitor className="nav-icon" />
                <span>Xem tồn kho tủ thuốc</span>
              </a>
            </>
          )}

          {/* Tủ trực khoa lâm sàng */}
          {(user.role === 'nurse' || user.role === 'head_nurse' || user.role === 'head') && (
            <>
              <div className="nav-section-title" title="Tủ trực lâm sàng">Tủ trực lâm sàng</div>
              <a 
                className={`nav-item ${page === 'dashboard' ? 'active' : ''}`}
                onClick={() => setPage('dashboard')}
                title="Tổng quan"
              >
                <LayoutDashboard className="nav-icon" />
                <span>Tổng quan</span>
              </a>
              <a 
                className={`nav-item ${page === 'cabinet' ? 'active' : ''}`}
                onClick={() => setPage('cabinet')}
                title="Tủ trực khoa"
              >
                <Monitor className="nav-icon" />
                <span>Tủ trực khoa</span>
              </a>
              <a 
                className={`nav-item ${page === 'requisitions' ? 'active' : ''}`}
                onClick={() => setPage('requisitions')}
                title="Yêu cầu lĩnh thuốc"
              >
                <ClipboardList className="nav-icon" />
                <span>Yêu cầu lĩnh thuốc</span>
              </a>
              <a 
                className={`nav-item ${page === 'returns' ? 'active' : ''}`}
                onClick={() => setPage('returns')}
                title="Hoàn trả thuốc thừa"
              >
                <RotateCcw className="nav-icon" />
                <span>Hoàn trả thuốc thừa</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit' ? 'active' : ''}`}
                onClick={() => setPage('audit')}
                title="Kiểm kê tủ trực"
              >
                <ClipboardList className="nav-icon" />
                <span>Kiểm kê tủ trực</span>
              </a>
              <a 
                className={`nav-item ${page === 'recall' ? 'active' : ''}`}
                onClick={() => setPage('recall')}
                title="Truy vết thuốc thu hồi"
              >
                <ShieldAlert className="nav-icon" />
                <span>Truy vết thuốc thu hồi</span>
              </a>
            </>
          )}

          {/* Quản trị rủi ro & Duyệt Kho chẵn (Chỉ Ban Giám Đốc) */}
          {user.role === 'director' && (
            <>
              <div className="nav-section-title" title="Quản trị rủi ro">Quản trị rủi ro & Kho</div>
              <a 
                className={`nav-item ${page === 'imports' ? 'active' : ''}`}
                onClick={() => setPage('imports')}
                title="Duyệt nhập kho"
              >
                <Package className="nav-icon" />
                <span>Duyệt nhập kho</span>
              </a>
              <a 
                className={`nav-item ${page === 'liquidation' ? 'active' : ''}`}
                onClick={() => setPage('liquidation')}
                title="Thanh lý hao hụt"
              >
                <Trash2 className="nav-icon" />
                <span>Thanh lý hao hụt</span>
              </a>
              <a 
                className={`nav-item ${page === 'returns' ? 'active' : ''}`}
                onClick={() => setPage('returns')}
                title="Duyệt hoàn trả thuốc"
              >
                <RotateCcw className="nav-icon" />
                <span>Duyệt hoàn trả thuốc</span>
              </a>
              <a 
                className={`nav-item ${page === 'restock' ? 'active' : ''}`}
                onClick={() => setPage('restock')}
                title="Duyệt đề xuất mua"
              >
                <ClipboardList className="nav-icon" />
                <span>Duyệt đề xuất mua</span>
              </a>
              <a 
                className={`nav-item ${page === 'clearance' ? 'active' : ''}`}
                onClick={() => setPage('clearance')}
                title="Điều chuyển cận date"
              >
                <ArrowLeftRight className="nav-icon" />
                <span>Điều chuyển cận date</span>
              </a>
              <a 
                className={`nav-item ${page === 'recall' ? 'active' : ''}`}
                onClick={() => setPage('recall')}
                title="Duyệt thu hồi & cách ly"
              >
                <ShieldAlert className="nav-icon" />
                <span>Duyệt thu hồi & cách ly</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit' ? 'active' : ''}`}
                onClick={() => setPage('audit')}
                title="Duyệt kiểm kê kho"
              >
                <ClipboardList className="nav-icon" />
                <span>Duyệt kiểm kê kho</span>
              </a>
            </>
          )}

          {/* Thống kê & Báo cáo (Ban Giám Đốc) */}
          {user.role === 'director' && (
            <>
              <div className="nav-section-title" title="Thống kê & Báo cáo">Thống kê & Báo cáo</div>
              <a 
                className={`nav-item ${page === 'tracking' ? 'active' : ''}`}
                onClick={() => setPage('tracking')}
                title="Thống kê Nhập - Xuất - Tồn"
              >
                <BarChart3 className="nav-icon" />
                <span>Thống kê Nhập - Xuất - Tồn</span>
              </a>
            </>
          )}

          {/* Giám sát Kho lẻ & Quầy Dược (Chỉ Ban Giám Đốc theo dõi toàn viện) */}
          {user.role === 'director' && (
            <>
              <div className="nav-section-title" title="Kho lẻ & Quầy Dược">Kho lẻ & Quầy Dược</div>
              <a 
                className={`nav-item ${page === 'dispensing' ? 'active' : ''}`}
                onClick={() => setPage('dispensing')}
                title="Giám sát cấp phát ngoại trú toàn viện"
              >
                <Stethoscope className="nav-icon" />
                <span>Cấp phát ngoại trú</span>
              </a>
              <a 
                className={`nav-item ${page === 'cabinet' ? 'active' : ''}`}
                onClick={() => setPage('cabinet')}
                title="Giám sát tủ trực các khoa"
              >
                <Monitor className="nav-icon" />
                <span>Tủ trực các khoa</span>
              </a>
            </>
          )}
        </div>

        {/* Sidebar Footer User Info */}
        <div className="sidebar-footer">
          <div className="user-quick-card" title={`${user.fullName} (${getRoleDisplayName(user.role)})`}>
            <div className="user-avatar">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : <User size={16} />}
            </div>
            {!isSidebarCollapsed && (
              <div className="user-info-text">
                <div className="user-name">{user.fullName}</div>
                <div className="user-role-label">{getRoleDisplayName(user.role)}</div>
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
                {(user.role === 'dispensary' || user.role === 'pharmacist')
                  ? (user.departmentName ? `Quầy Dược (${user.departmentName})` : 'Quầy Dược Bệnh Viện')
                  : (user.role === 'nurse' || user.role === 'head_nurse' || user.role === 'head') 
                  ? `Khoa: ${user.departmentName || 'Lâm sàng'}` 
                  : 'Ban Giám Đốc'}
              </span>
            </div>

            {/* Time & Date */}
            <div className="top-bar-badge">
              <Clock size={15} style={{ color: 'var(--color-secondary)' }} />
              <span>{currentTime.toLocaleTimeString('vi-VN')}</span>
            </div>

            {/* Accounting Period Quick Button: Chỉ hiển thị cho Ban Giám Đốc */}
            {user.role === 'director' && (
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

            {/* Audit Trail Quick Button: Chỉ hiển thị cho Ban Giám Đốc */}
            {user.role === 'director' && (
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
                title="Nhật ký kiểm toán hệ thống"
              >
                <ShieldCheck size={14} />
                <span>Kiểm toán</span>
              </button>
            )}

            {/* Quick Access to Patient QR Portal */}
            <button
              onClick={() => setPage(page === 'patient-portal' ? 'dashboard' : 'patient-portal')}
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
