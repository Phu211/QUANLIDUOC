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
  ShieldAlert
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

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('his-pharmacy-user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('his-pharmacy-user');
    if (saved) {
      const u = JSON.parse(saved);
      return u.role === 'nurse' ? 'cabinet' : 'dashboard';
    }
    return 'dashboard';
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [realtimeStatus, setRealtimeStatus] = useState('connecting'); // 'connecting', 'connected', 'error'

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
      case 'restock': return 'Cảnh Báo & Đề Xuất Đặt Hàng';
      default: return 'Hệ Thống Quản Lý Dược';
    }
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard setPage={setPage} user={user} />;
      case 'medicine':
        return <MedicineManagement user={user} />;
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
      default:
        return (user?.role === 'nurse' || user?.role === 'head_nurse' || user?.role === 'head') ? <CabinetManagement user={user} /> : <Dashboard setPage={setPage} user={user} />;
    }
  };

  if (!user) {
    return (
      <Login 
        onLoginSuccess={(u) => {
          setUser(u);
          localStorage.setItem('his-pharmacy-user', JSON.stringify(u));
          setPage('dashboard');
        }} 
      />
    );
  }

  return (
    <div className="app-container">
      {/* Grouped Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <Activity size={26} color="var(--color-secondary)" style={{ filter: 'drop-shadow(0 0 6px rgba(13,148,136,0.3))' }} />
          <div>
            <div className="logo-text">HIS - PHARMACY</div>
            <div className="logo-sub">Phân hệ Quản Lý Dược</div>
          </div>
        </div>

        <div className="nav-links">
          {/* Hệ thống */}
          {(user.role === 'pharmacist' || user.role === 'director') && (
            <>
              <div className="nav-section-title">Hệ thống</div>
              <a 
                className={`nav-item ${page === 'dashboard' ? 'active' : ''}`}
                onClick={() => setPage('dashboard')}
              >
                <LayoutDashboard className="nav-icon" />
                <span>Tổng quan</span>
              </a>
              <a 
                className={`nav-item ${page === 'medicine' ? 'active' : ''}`}
                onClick={() => setPage('medicine')}
              >
                <Database className="nav-icon" />
                <span>Danh mục thuốc</span>
              </a>
            </>
          )}

          {/* Nhiệm vụ kho chẵn */}
          {user.role === 'pharmacist' && (
            <>
              <div className="nav-section-title">Nhiệm vụ kho chẵn</div>
              <a 
                className={`nav-item ${page === 'imports' ? 'active' : ''}`}
                onClick={() => setPage('imports')}
              >
                <Package className="nav-icon" />
                <span>Nhập kho chẵn</span>
              </a>
              <a 
                className={`nav-item ${page === 'requisitions' ? 'active' : ''}`}
                onClick={() => setPage('requisitions')}
              >
                <ClipboardList className="nav-icon" />
                <span>Cấp phát thuốc/vật tư</span>
              </a>
              <a 
                className={`nav-item ${page === 'returns' ? 'active' : ''}`}
                onClick={() => setPage('returns')}
              >
                <RotateCcw className="nav-icon" />
                <span>Duyệt hoàn trả thuốc</span>
              </a>
              <a 
                className={`nav-item ${page === 'liquidation' ? 'active' : ''}`}
                onClick={() => setPage('liquidation')}
              >
                <Trash2 className="nav-icon" />
                <span>Đề xuất thanh lý</span>
              </a>
              <a 
                className={`nav-item ${page === 'restock' ? 'active' : ''}`}
                onClick={() => setPage('restock')}
              >
                <AlertTriangle className="nav-icon" />
                <span>Đề xuất đặt hàng</span>
              </a>
              <a 
                className={`nav-item ${page === 'recall' ? 'active' : ''}`}
                onClick={() => setPage('recall')}
              >
                <ShieldAlert className="nav-icon" />
                <span>Thu hồi & cách ly</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit' ? 'active' : ''}`}
                onClick={() => setPage('audit')}
              >
                <ClipboardList className="nav-icon" />
                <span>Kiểm kê kho</span>
              </a>
            </>
          )}

          {/* Tủ trực khoa lâm sàng */}
          {(user.role === 'nurse' || user.role === 'head_nurse' || user.role === 'head') && (
            <>
              <div className="nav-section-title">Tủ trực khoa lâm sàng</div>
              <a 
                className={`nav-item ${page === 'dashboard' ? 'active' : ''}`}
                onClick={() => setPage('dashboard')}
              >
                <LayoutDashboard className="nav-icon" />
                <span>Tổng quan</span>
              </a>
              <a 
                className={`nav-item ${page === 'cabinet' ? 'active' : ''}`}
                onClick={() => setPage('cabinet')}
              >
                <Monitor className="nav-icon" />
                <span>Tủ trực khoa</span>
              </a>
              <a 
                className={`nav-item ${page === 'requisitions' ? 'active' : ''}`}
                onClick={() => setPage('requisitions')}
              >
                <ClipboardList className="nav-icon" />
                <span>Yêu cầu lĩnh thuốc</span>
              </a>
              <a 
                className={`nav-item ${page === 'returns' ? 'active' : ''}`}
                onClick={() => setPage('returns')}
              >
                <RotateCcw className="nav-icon" />
                <span>Hoàn trả thuốc thừa</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit' ? 'active' : ''}`}
                onClick={() => setPage('audit')}
              >
                <ClipboardList className="nav-icon" />
                <span>Kiểm kê tủ trực</span>
              </a>
            </>
          )}

          {/* Quản trị rủi ro */}
          {user.role === 'director' && (
            <>
              <div className="nav-section-title">Quản trị rủi ro</div>
              <a 
                className={`nav-item ${page === 'imports' ? 'active' : ''}`}
                onClick={() => setPage('imports')}
              >
                <Package className="nav-icon" />
                <span>Duyệt nhập kho</span>
              </a>
              <a 
                className={`nav-item ${page === 'liquidation' ? 'active' : ''}`}
                onClick={() => setPage('liquidation')}
              >
                <Trash2 className="nav-icon" />
                <span>Thanh lý hao hụt</span>
              </a>
              <a 
                className={`nav-item ${page === 'returns' ? 'active' : ''}`}
                onClick={() => setPage('returns')}
              >
                <RotateCcw className="nav-icon" />
                <span>Duyệt hoàn trả thuốc</span>
              </a>
              <a 
                className={`nav-item ${page === 'restock' ? 'active' : ''}`}
                onClick={() => setPage('restock')}
              >
                <ClipboardList className="nav-icon" />
                <span>Duyệt đề xuất mua</span>
              </a>
              <a 
                className={`nav-item ${page === 'recall' ? 'active' : ''}`}
                onClick={() => setPage('recall')}
              >
                <ShieldAlert className="nav-icon" />
                <span>Duyệt thu hồi & cách ly</span>
              </a>
              <a 
                className={`nav-item ${page === 'audit' ? 'active' : ''}`}
                onClick={() => setPage('audit')}
              >
                <ClipboardList className="nav-icon" />
                <span>Duyệt kiểm kê kho</span>
              </a>
            </>
          )}

          {/* Thống kê & Báo cáo */}
          {(user.role === 'pharmacist' || user.role === 'director') && (
            <>
              <div className="nav-section-title">Thống kê & Báo cáo</div>
              <a 
                className={`nav-item ${page === 'tracking' ? 'active' : ''}`}
                onClick={() => setPage('tracking')}
              >
                <BarChart3 className="nav-icon" />
                <span>Thống kê Nhập - Xuất - Tồn</span>
              </a>
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <p>Phân hệ Dược MQSOFT®</p>
          <p style={{ fontSize: '0.65rem', marginTop: '0.2rem' }}>Bệnh viện Trung Ương © 2026</p>
        </div>
      </aside>

      {/* Main Content Area with Header top-bar */}
      <main className="main-content">
        <header className="top-bar">
          <div className="top-bar-left">
            <h2 style={{ fontSize: '1.2rem', fontWeight: '600', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {getPageTitle()}
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: realtimeStatus === 'connected' ? 'var(--color-success)' : realtimeStatus === 'connecting' ? 'var(--color-warning)' : 'var(--color-danger)',
                display: 'inline-block',
                marginLeft: '0.5rem'
              }} title={realtimeStatus === 'connected' ? 'Kết nối Realtime: Tốt' : 'Đang kết nối Realtime...'} />
            </h2>
          </div>
          <div className="top-bar-right">
            <div className="top-bar-badge">
              <Warehouse size={14} />
              <span>
                {(user.role === 'nurse' || user.role === 'head_nurse' || user.role === 'head') 
                  ? `Khoa: ${user.departmentName || 'Lâm sàng'}` 
                  : (user.role === 'director' ? 'Ban Giám Đốc' : 'Kho: Kho chẵn chính')}
              </span>
            </div>
            <div className="top-bar-badge" style={{ background: 'rgba(13, 148, 136, 0.1)', color: 'var(--color-secondary)' }}>
              <User size={14} />
              <span>
                <strong>{user.fullName}</strong> ({user.role === 'pharmacist' ? 'Thủ kho Dược' : user.role === 'nurse' ? 'Điều dưỡng' : user.role === 'head_nurse' ? 'Điều dưỡng trưởng' : user.role === 'head' ? 'Trưởng khoa' : 'Trưởng khoa Dược / Trưởng phòng KHTH'})
              </span>
            </div>
            <div className="top-bar-badge">
              <Clock size={14} />
              <span>{currentTime.toLocaleTimeString('vi-VN')}</span>
            </div>
            <button 
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.color = '#ef4444';
              }}
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
    </div>
  );
}
