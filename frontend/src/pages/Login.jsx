import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  Activity, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  Building2,
  Search,
  X
} from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRoleTab, setSelectedRoleTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const executeLogin = (userVal, passVal) => {
    setError('');
    setLoading(true);

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userVal.trim(), password: passVal })
    })
    .then(async res => {
      const contentType = res.headers.get("content-type");
      if (!res.ok) {
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          throw new Error(data.error || "Đăng nhập thất bại.");
        } else {
          throw new Error("Không thể kết nối đến Máy chủ API. Vui lòng đảm bảo Backend API (dotnet run) đang hoạt động.");
        }
      }
      return res.json();
    })
    .then(userData => {
      setLoading(false);
      onLoginSuccess(userData);
    })
    .catch(err => {
      setLoading(false);
      setError(err.message);
    });
  };

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (!username.trim()) return setError("Vui lòng nhập tên đăng nhập.");
    if (!password.trim()) return setError("Vui lòng nhập mật khẩu.");
    executeLogin(username, password);
  };

  const handleQuickLogin = (demoUser, demoPass) => {
    setUsername(demoUser);
    setPassword(demoPass);
    executeLogin(demoUser, demoPass);
  };

  // Full demo accounts for all hospital departments and clinical roles
  const demoUsers = [
    {
      category: "Ban Giám Đốc & Lãnh Đạo",
      color: "#0d9488",
      key: "director",
      users: [
        { username: "giamdoc", name: "Lê Minh Trí", title: "Giám đốc Bệnh viện", role: "PGS.TS. Giám đốc", dept: "Ban Giám Đốc", badge: "Phê duyệt tối cao" },
        { username: "duy", name: "Nguyễn Thanh Duy", title: "Phó Giám đốc Bệnh viện", role: "PGS.TS. Phó Giám đốc", dept: "Ban Giám Đốc", badge: "Duyệt kiểm kê & Tiêu hủy" }
      ]
    },
    {
      category: "Thủ Kho Kho Chẵn (Kho Dược Trung Tâm)",
      color: "#10b981",
      key: "pharmacist",
      users: [
        { username: "thukho", name: "Hà Lâm Đình Phú", title: "Thủ kho Dược chính", role: "Thủ kho Kho Chẵn", dept: "Kho Dược Trung Tâm", badge: "Nhập & Xuất kho chẵn" },
        { username: "anh", name: "Kiều Đức Anh", title: "Thủ kho Kho Chẵn", role: "Thủ kho Kho Chẵn", dept: "Kho Dược Trung Tâm", badge: "Kiểm tra & Xuất kho chẵn" }
      ]
    },
    {
      category: "Dược Sĩ (Cấp Phát & Xem Tủ Thuốc)",
      color: "#f59e0b",
      key: "dispensary",
      users: [
        { username: "ds_khambenh", name: "Nguyễn Thị Thảo", title: "Dược sĩ Khoa Khám Bệnh", role: "Dược sĩ", dept: "Khoa Khám Bệnh", badge: "Cấp phát thuốc & Xem tủ thuốc" },
        { username: "ds_capcuu", name: "Phạm Hồng Phúc", title: "Dược sĩ Khoa Cấp Cứu", role: "Dược sĩ", dept: "Khoa Cấp Cứu", badge: "Cấp phát thuốc & Xem tủ thuốc" },
        { username: "ds_noitonghop", name: "Trần Hoàng Nam", title: "Dược sĩ Khoa Nội Tổng Hợp", role: "Dược sĩ", dept: "Khoa Nội Tổng Hợp", badge: "Cấp phát thuốc & Xem tủ thuốc" }
      ]
    },
    {
      category: "Bác Sĩ Trưởng Khoa Lâm Sàng",
      color: "#0284c7",
      key: "head",
      users: [
        { username: "tkkhambenh", name: "Nguyễn Hữu Lực", title: "Trưởng khoa Khám Bệnh", role: "BS.CKII. Trưởng khoa", dept: "Khoa Khám Bệnh", badge: "Ký duyệt y lệnh KB" },
        { username: "tkcapcuu", name: "Lê Văn Chương", title: "Trưởng khoa Cấp Cứu", role: "BS.CKII. Trưởng khoa", dept: "Khoa Cấp Cứu", badge: "Duyệt bù tủ khẩn" },
        { username: "tknoitonghop", name: "Nguyễn Đăng Đức Anh", title: "Trưởng khoa Nội Tổng Hợp", role: "BS.CKII. Trưởng khoa", dept: "Khoa Nội Tổng Hợp", badge: "Ký duyệt y lệnh nội trú" },
        { username: "tkxetnghiem", name: "Trương Minh Quân", title: "Trưởng khoa Xét Nghiệm", role: "BS.CKII. Trưởng khoa", dept: "Khoa Xét Nghiệm", badge: "Duyệt vật tư XN" },
        { username: "tkdongy", name: "Nguyễn Xuân Duy Thắng", title: "Trưởng khoa Đông Y", role: "BS.CKII. Trưởng khoa", dept: "Khoa Đông Y", badge: "Ký y lệnh Đông Y" }
      ]
    },
    {
      category: "Điều Dưỡng Trưởng Khoa (Quản Lý Tủ Trực)",
      color: "#8b5cf6",
      key: "head_nurse",
      users: [
        { username: "dieuduong", name: "Trần Vỹ Khang", title: "Điều dưỡng trưởng Cấp Cứu", role: "ĐDT. Cấp Cứu", dept: "Khoa Cấp Cứu", badge: "Lập phiếu bù tủ trực" },
        { username: "ddkhambenh", name: "Trần Trung Nam", title: "Điều dưỡng trưởng Khám Bệnh", role: "ĐDT. Khám Bệnh", dept: "Khoa Khám Bệnh", badge: "Lập phiếu lĩnh thường quy" },
        { username: "ddnoitonghop", name: "Trần Thanh Phương", title: "Điều dưỡng trưởng Nội TH", role: "ĐDT. Nội Tổng Hợp", dept: "Khoa Nội Tổng Hợp", badge: "Lập phiếu lĩnh nội trú" },
        { username: "ddxetnghiem", name: "Nguyễn Trần Gia Khang", title: "Điều dưỡng trưởng Xét Nghiệm", role: "ĐDT. Xét Nghiệm", dept: "Khoa Xét Nghiệm", badge: "Quản lý vật tư XN" },
        { username: "dddongy", name: "Nguyễn Thái Bình Dương", title: "Điều dưỡng trưởng Đông Y", role: "ĐDT. Đông Y", dept: "Khoa Đông Y", badge: "Lập phiếu lĩnh thuốc ĐY" }
      ]
    },
    {
      category: "Điều Dưỡng Viên Lâm Sàng",
      color: "#ec4899",
      key: "nurse",
      users: [
        { username: "quan", name: "Đặng Anh Quân", title: "Điều dưỡng viên Cấp Cứu", role: "Điều dưỡng viên", dept: "Khoa Cấp Cứu", badge: "Cấp phát thuốc tủ trực" }
      ]
    }
  ];

  const totalUsersCount = demoUsers.reduce((sum, c) => sum + c.users.length, 0);

  const filteredDemoUsers = demoUsers.map(cat => {
    if (selectedRoleTab !== 'all' && cat.key !== selectedRoleTab) return null;
    const matchedUsers = cat.users.filter(u => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return u.username.toLowerCase().includes(q) ||
             u.name.toLowerCase().includes(q) ||
             u.dept.toLowerCase().includes(q) ||
             u.role.toLowerCase().includes(q) ||
             (u.badge && u.badge.toLowerCase().includes(q));
    });
    if (matchedUsers.length === 0) return null;
    return { ...cat, users: matchedUsers };
  }).filter(Boolean);

  return (
    <div style={{
      width: '100vw',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top left, #0f172a 0%, #070d19 100%)',
      fontFamily: "'Inter', sans-serif",
      margin: 0,
      padding: '1.5rem',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Soft ambient glowing gradients */}
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(14, 165, 233, 0.14) 0%, rgba(14, 165, 233, 0) 70%)',
        borderRadius: '50%',
        top: '-180px',
        right: '-120px',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '550px',
        height: '550px',
        background: 'radial-gradient(circle, rgba(13, 148, 136, 0.16) 0%, rgba(13, 148, 136, 0) 70%)',
        borderRadius: '50%',
        bottom: '-160px',
        left: '-120px',
        pointerEvents: 'none'
      }} />

      {/* Main Login Frame */}
      <div style={{
        width: '100%',
        maxWidth: '1260px',
        maxHeight: 'min(860px, 94vh)',
        height: 'min(860px, 94vh)',
        display: 'grid',
        gridTemplateColumns: 'minmax(330px, 380px) 1fr',
        background: 'rgba(17, 24, 39, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(13, 148, 136, 0.1)',
        color: '#f8fafc',
        boxSizing: 'border-box',
        overflow: 'hidden',
        animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 10
      }}>
        {/* Left Side: Login Form */}
        <div style={{
          padding: '2.5rem 2rem',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}>
          {/* Hospital Logo Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.75rem' }}>
            <div style={{
              width: '58px',
              height: '58px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0d9488, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.85rem',
              boxShadow: '0 8px 24px rgba(13, 148, 136, 0.4)'
            }}>
              <Activity size={32} color="#ffffff" />
            </div>
            <h2 style={{ 
              fontSize: '1.4rem', 
              fontWeight: '800', 
              letterSpacing: '-0.01em', 
              textAlign: 'center', 
              margin: 0, 
              color: '#ffffff', 
              fontFamily: "'Outfit', sans-serif" 
            }}>
              HIS - PHARMACY
            </h2>
            <p style={{ 
              fontSize: '0.72rem', 
              color: '#38bdf8', 
              margin: '0.35rem 0 0 0', 
              textTransform: 'uppercase', 
              letterSpacing: '1.6px', 
              fontWeight: '700' 
            }}>
              Hệ Thống Quản Lý Dược Bệnh Viện
            </p>
          </div>

          {/* System Feature Tags */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '0.5rem', 
            marginBottom: '1.25rem',
            flexWrap: 'wrap'
          }}>
            <span style={{ 
              fontSize: '0.66rem', 
              padding: '0.2rem 0.5rem', 
              borderRadius: '6px', 
              background: 'rgba(14, 165, 233, 0.12)', 
              color: '#38bdf8',
              border: '1px solid rgba(14, 165, 233, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontWeight: '600'
            }}>
              <ShieldCheck size={12} /> Tiêu chuẩn BYT
            </span>
            <span style={{ 
              fontSize: '0.66rem', 
              padding: '0.2rem 0.5rem', 
              borderRadius: '6px', 
              background: 'rgba(16, 185, 129, 0.12)', 
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontWeight: '600'
            }}>
              <Zap size={12} /> Real-time FEFO
            </span>
          </div>

          {/* Error Alert Box */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '0.75rem 0.9rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              color: '#fca5a5',
              fontSize: '0.8rem',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.73rem',
                fontWeight: '700',
                color: '#cbd5e1',
                marginBottom: '0.35rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Tài Khoản Đăng Nhập
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={17} style={{
                  position: 'absolute',
                  left: '1rem',
                  color: '#94a3b8',
                  pointerEvents: 'none'
                }} />
                <input
                  type="text"
                  placeholder="Mã nhân viên / Tên tài khoản"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '0.86rem',
                    outline: 'none',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#0d9488';
                    e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.2)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.target.style.boxShadow = 'none';
                  }}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{
                  fontSize: '0.73rem',
                  fontWeight: '700',
                  color: '#cbd5e1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Mật Khẩu
                </label>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={17} style={{
                  position: 'absolute',
                  left: '1rem',
                  color: '#94a3b8',
                  pointerEvents: 'none'
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.75rem 0.75rem 2.75rem',
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '0.86rem',
                    outline: 'none',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#0d9488';
                    e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.2)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.target.style.boxShadow = 'none';
                  }}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.25rem'
                  }}
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #0d9488, #0284c7)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 18px rgba(13, 148, 136, 0.35)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxSizing: 'border-box'
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 22px rgba(13, 148, 136, 0.45)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 18px rgba(13, 148, 136, 0.35)';
              }}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw size={18} style={{ animation: 'spin 2s linear infinite' }} />
              ) : (
                "Đăng Nhập Hệ Thống"
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Quick Demo Login Grid */}
        <div style={{
          padding: '1.75rem 2rem',
          background: 'rgba(10, 15, 30, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
          minWidth: 0
        }}>
          {/* Header & Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{
                fontSize: '0.98rem',
                fontWeight: '800',
                color: '#ffffff',
                margin: '0 0 0.25rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                letterSpacing: '0.3px'
              }}>
                <Building2 size={19} color="#0d9488" />
                ĐĂNG NHẬP NHANH THEO VAI TRÒ ({totalUsersCount} TÀI KHOẢN)
              </h3>
              <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: 0 }}>
                Hệ thống đầy đủ tất cả phân quyền. Bấm vào tài khoản để đăng nhập kiểm thử (Pass: <strong style={{ color: '#38bdf8' }}>123</strong>):
              </p>
            </div>

            {/* Quick Search Bar */}
            <div style={{ position: 'relative', width: '230px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Tìm tên, user, khoa..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 1.8rem 0.45rem 2rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Tabs (Wrap to show completely without horizontal scrollbar) */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.4rem',
            paddingBottom: '0.65rem',
            marginBottom: '0.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)'
          }}>
            {[
              { key: 'all', label: `Tất cả (${totalUsersCount})` },
              { key: 'director', label: '👑 Ban Giám Đốc (2)' },
              { key: 'pharmacist', label: '💊 Kho Chẵn (2)' },
              { key: 'dispensary', label: '🏥 Dược Sĩ Kho Lẻ (3)' },
              { key: 'head', label: '🩺 Bác Sĩ Trưởng Khoa (5)' },
              { key: 'head_nurse', label: '📋 Điều Dưỡng Trưởng (5)' },
              { key: 'nurse', label: '💉 Điều Dưỡng Viên (1)' }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedRoleTab(tab.key)}
                style={{
                  padding: '0.32rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: selectedRoleTab === tab.key ? '700' : '500',
                  background: selectedRoleTab === tab.key ? '#0d9488' : 'rgba(255, 255, 255, 0.04)',
                  color: selectedRoleTab === tab.key ? '#ffffff' : '#94a3b8',
                  border: selectedRoleTab === tab.key ? '1px solid #14b8a6' : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable User Cards List */}
          <div 
            className="login-user-list-scroll"
            style={{
              flexGrow: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: '0.4rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.1rem'
            }}>
            {filteredDemoUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                Không tìm thấy tài khoản nào khớp với từ khóa "{searchQuery}".
              </div>
            ) : (
              filteredDemoUsers.map((cat, idx) => (
                <div key={idx}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.55rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingBottom: '0.25rem'
                  }}>
                    <div style={{
                      color: cat.color,
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: cat.color, display: 'inline-block' }} />
                      {cat.category}
                    </div>
                    <span style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: '600' }}>
                      {cat.users.length} tài khoản
                    </span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                    gap: '0.6rem'
                  }}>
                    {cat.users.map((usr, uIdx) => (
                      <div
                        key={uIdx}
                        onClick={() => handleQuickLogin(usr.username, '123')}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderLeft: `3px solid ${cat.color}`,
                          borderRadius: '10px',
                          padding: '0.6rem 0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                          position: 'relative'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                          e.currentTarget.style.borderColor = cat.color;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 6px 18px rgba(0,0,0,0.35), 0 0 12px ${cat.color}22`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                          e.currentTarget.style.borderLeft = `3px solid ${cat.color}`;
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                          <span style={{ 
                            color: '#38bdf8', 
                            fontSize: '0.82rem', 
                            fontWeight: '700',
                            fontFamily: 'monospace'
                          }}>
                            {usr.username}
                          </span>
                          <span style={{ 
                            color: cat.color, 
                            fontSize: '0.65rem', 
                            fontWeight: '700',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}>
                            ⚡ Đăng nhập
                          </span>
                        </div>

                        <div style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.15rem' }}>
                          {usr.name}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: '500' }}>
                            {usr.role}
                          </span>
                          {usr.badge && (
                            <span style={{ 
                              fontSize: '0.62rem', 
                              color: '#cbd5e1', 
                              background: 'rgba(255,255,255,0.05)', 
                              padding: '0.08rem 0.3rem', 
                              borderRadius: '4px',
                              fontStyle: 'italic'
                            }}>
                              {usr.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
