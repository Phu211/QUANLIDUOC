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
  Building2 
} from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  // Demo accounts categorized for clinical workflow evaluation
  const demoUsers = [
    {
      category: "Dược chính & Lãnh đạo",
      color: "#0d9488",
      users: [
        { username: "giamdoc", name: "Lê Minh Trí", title: "Giám đốc bệnh viện", role: "PGS.TS. Giám đốc" },
        { username: "thukho", name: "Hà Lâm Đình Phú", title: "Thủ kho Dược (Kho chẵn chính)", role: "DS. Thủ kho chẵn" }
      ]
    },
    {
      category: "Dược sĩ Kho Lẻ Các Khoa (Satellite Pharmacy)",
      color: "#f59e0b",
      users: [
        { username: "ds_khambenh", name: "Nguyễn Thị Thảo", title: "DS. Kho lẻ Khám Bệnh", role: "Khoa Khám Bệnh" },
        { username: "ds_capcuu", name: "Phạm Hồng Phúc", title: "DS. Kho lẻ Cấp Cứu", role: "Khoa Cấp Cứu" },
        { username: "ds_noitonghop", name: "Trần Hoàng Nam", title: "DS. Kho lẻ Nội Tổng Hợp", role: "Khoa Nội TH" }
      ]
    },
    {
      category: "Khoa Cấp Cứu & Lâm Sàng",
      color: "#0284c7",
      users: [
        { username: "tkcapcuu", name: "Lê Văn Chương", title: "Trưởng khoa Cấp Cứu", role: "BS.CKII. Trưởng khoa" },
        { username: "dieuduong", name: "Trần Vỹ Khang", title: "ĐD trưởng Cấp Cứu", role: "ĐDT. Cấp Cứu" },
        { username: "tkkhambenh", name: "Nguyễn Hữu Lực", title: "Trưởng khoa Khám Bệnh", role: "BS. Trưởng khoa KB" }
      ]
    }
  ];

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
      padding: '2rem 1.5rem',
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
        maxWidth: '1100px',
        display: 'grid',
        gridTemplateColumns: 'minmax(340px, 440px) 1fr',
        background: 'rgba(17, 24, 39, 0.75)',
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
          padding: '3rem 2.5rem',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxSizing: 'border-box'
        }}>
          {/* Hospital Logo Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #0d9488, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 8px 24px rgba(13, 148, 136, 0.4)'
            }}>
              <Activity size={36} color="#ffffff" />
            </div>
            <h2 style={{ 
              fontSize: '1.5rem', 
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
              margin: '0.4rem 0 0 0', 
              textTransform: 'uppercase', 
              letterSpacing: '1.8px', 
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
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <span style={{ 
              fontSize: '0.68rem', 
              padding: '0.2rem 0.55rem', 
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
              fontSize: '0.68rem', 
              padding: '0.2rem 0.55rem', 
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
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#fca5a5',
              fontSize: '0.82rem',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0, color: '#ef4444' }} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.72rem', 
                fontWeight: '700', 
                color: '#94a3b8', 
                textTransform: 'uppercase', 
                letterSpacing: '0.8px', 
                marginBottom: '0.5rem' 
              }}>
                Tài khoản đăng nhập
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={18} color="#64748b" style={{ position: 'absolute', left: '1rem' }} />
                <input
                  type="text"
                  placeholder="Mã nhân viên / Tên tài khoản"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(10, 15, 29, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem 0.85rem 2.75rem',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#0284c7';
                    e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.25)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.boxShadow = 'none';
                  }}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.72rem', 
                fontWeight: '700', 
                color: '#94a3b8', 
                textTransform: 'uppercase', 
                letterSpacing: '0.8px', 
                marginBottom: '0.5rem' 
              }}>
                Mật khẩu
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={18} color="#64748b" style={{ position: 'absolute', left: '1rem' }} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(10, 15, 29, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '0.85rem 2.75rem 0.85rem 2.75rem',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#0284c7';
                    e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.25)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
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
                    right: '0.85rem',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #0d9488, #0284c7)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 18px rgba(13, 148, 136, 0.35)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxSizing: 'border-box'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 22px rgba(13, 148, 136, 0.45)';
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
          padding: '2.75rem',
          background: 'rgba(10, 15, 30, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{
              fontSize: '0.95rem',
              fontWeight: '800',
              color: '#ffffff',
              margin: '0 0 0.35rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              letterSpacing: '0.3px'
            }}>
              <Building2 size={18} color="#0d9488" />
              ĐĂNG NHẬP NHANH THEO VAI TRÒ (DEMO ROLES)
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
              Chọn tài khoản theo phân quyền nghiệp vụ để trải nghiệm kiểm thử:
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.25rem',
            flexGrow: 1
          }}>
            {demoUsers.map((cat, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{
                  color: cat.color,
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  borderBottom: `1px solid rgba(255, 255, 255, 0.06)`,
                  paddingBottom: '0.35rem'
                }}>
                  {cat.category}
                </div>

                {cat.users.map((usr, uIdx) => (
                  <div
                    key={uIdx}
                    onClick={() => handleQuickLogin(usr.username, '123')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '10px',
                      padding: '0.7rem 0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      position: 'relative'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                      e.currentTarget.style.borderColor = cat.color;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <strong style={{ color: '#ffffff', fontSize: '0.85rem' }}>{usr.username}</strong>
                      <span style={{ 
                        color: cat.color, 
                        fontSize: '0.68rem', 
                        fontWeight: '700',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px'
                      }}>
                        Đăng nhập
                      </span>
                    </div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.78rem', fontWeight: '500' }}>{usr.name}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '0.15rem' }}>{usr.role}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
