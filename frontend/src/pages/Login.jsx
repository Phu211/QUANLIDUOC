import React, { useState } from 'react';
import { User, Lock, Activity, AlertCircle, RefreshCw } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!username.trim()) return setError("Vui lòng nhập tên đăng nhập.");
    if (!password.trim()) return setError("Vui lòng nhập mật khẩu.");

    setLoading(true);

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password: password })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(data => { throw new Error(data.error || "Đăng nhập thất bại."); });
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

  const handleQuickLogin = (demoUser, demoPass) => {
    setUsername(demoUser);
    setPassword(demoPass);
    // Auto submit after state update
    setTimeout(() => {
      setLoading(true);
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: demoUser, password: demoPass })
      })
      .then(res => {
        if (!res.ok) return res.json().then(data => { throw new Error(data.error); });
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
    }, 100);
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
      fontFamily: "'Inter', sans-serif",
      margin: 0,
      padding: '1rem',
      boxSizing: 'border-box',
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      {/* Background glowing blobs */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: 'rgba(13, 148, 136, 0.15)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        top: '-100px',
        right: '-50px',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        width: '350px',
        height: '350px',
        background: 'rgba(99, 102, 241, 0.1)',
        borderRadius: '50%',
        filter: 'blur(70px)',
        bottom: '-80px',
        left: '-50px',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(30, 41, 59, 0.45)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        color: '#f8fafc',
        animation: 'fadeIn 0.4s ease-out',
        boxSizing: 'border-box'
      }}>
        {/* Hospital Logo Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #0d9488, #1e3a8a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 0 20px rgba(13, 148, 136, 0.4)'
          }}>
            <Activity size={32} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: '700', letterSpacing: '1px', textAlign: 'center', margin: 0, color: '#ffffff', fontFamily: "'Outfit', sans-serif" }}>
            HIS - PHARMACY
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.25rem 0 0 0', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '600' }}>
            Phân hệ Quản Lý Cấp Phát Dược
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>
              Tên đăng nhập
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User size={18} color="#64748b" style={{ position: 'absolute', left: '1rem' }} />
              <input
                type="text"
                placeholder="Nhập tài khoản"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem 0.75rem 2.5rem',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box'
                }}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={18} color="#64748b" style={{ position: 'absolute', left: '1rem' }} />
              <input
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem 0.75rem 2.5rem',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box'
                }}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              background: 'linear-gradient(90deg, #0d9488, #0f766e)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.8rem',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)',
              transition: 'all 0.2s ease',
              marginBottom: '1.5rem',
              boxSizing: 'border-box'
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

        {/* Quick Demo Login Help Card */}
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '1.25rem',
          marginTop: '0.5rem'
        }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tài khoản chạy thử (Demo Accounts)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onClick={() => handleQuickLogin('thukho', '123')}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(13, 148, 136, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
            >
              <div>
                <strong style={{ color: '#ffffff' }}>thukho</strong> <span style={{ color: '#64748b' }}>(mật khẩu: 123)</span>
                <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '0.15rem' }}>Thủ kho Dược - Dược sĩ Khoa</div>
              </div>
              <span style={{ color: '#0d9488', fontWeight: '600', fontSize: '0.72rem' }}>Chọn nhanh</span>
            </div>

            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onClick={() => handleQuickLogin('dieuduong', '123')}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(13, 148, 136, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
            >
              <div>
                <strong style={{ color: '#ffffff' }}>dieuduong</strong> <span style={{ color: '#64748b' }}>(mật khẩu: 123)</span>
                <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '0.15rem' }}>Điều dưỡng - Trần Thị Hồng (Cấp cứu)</div>
              </div>
              <span style={{ color: '#0d9488', fontWeight: '600', fontSize: '0.72rem' }}>Chọn nhanh</span>
            </div>

            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onClick={() => handleQuickLogin('giamdoc', '123')}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(13, 148, 136, 0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
            >
              <div>
                <strong style={{ color: '#ffffff' }}>giamdoc</strong> <span style={{ color: '#64748b' }}>(mật khẩu: 123)</span>
                <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginTop: '0.15rem' }}>Trưởng khoa / Giám đốc - PGS.TS Dược</div>
              </div>
              <span style={{ color: '#0d9488', fontWeight: '600', fontSize: '0.72rem' }}>Chọn nhanh</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
