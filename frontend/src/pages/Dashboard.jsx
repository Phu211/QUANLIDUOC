import React, { useState, useEffect } from 'react';
import { 
  Package, 
  ClipboardList, 
  AlertTriangle, 
  RefreshCw, 
  TrendingUp, 
  PieChart, 
  BarChart4,
  Users
} from 'lucide-react';

export default function Dashboard({ setPage, user }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = () => {
    setLoading(true);
    const url = user?.departmentID ? `/api/dashboard/summary?departmentId=${user.departmentID}` : '/api/dashboard/summary';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setSummary(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading dashboard data: ", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSummary();

    const handleUpdate = (e) => {
      if (e.detail === 'Dashboard' || e.detail === 'Inventory' || e.detail === 'Requisitions') {
        fetchSummary();
      }
    };
    window.addEventListener('pharmacy-update', handleUpdate);
    return () => window.removeEventListener('pharmacy-update', handleUpdate);
  }, [user]);

  const renderLineChart = () => {
    const data = summary?.importCosts || [];
    if (data.length === 0) {
      return (
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', height: '260px', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <TrendingUp size={36} color="var(--text-dim)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{user?.departmentID ? 'Số lượng thuốc tiêu hao' : 'Chi phí mua thuốc nhập kho'}</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: 0, maxWidth: '240px' }}>{user?.departmentID ? 'Chưa có dữ liệu tiêu hao thuốc tại khoa để vẽ biểu đồ.' : 'Chưa có dữ liệu. Vui lòng thực hiện nhập kho chẵn để vẽ biểu đồ.'}</p>
        </div>
      );
    }

    const left = 45;
    const right = 20;
    const top = 20;
    const bottom = 30;
    const width = 500;
    const height = 200;
    const plotW = width - left - right;
    const plotH = height - top - bottom;

    const maxVal = Math.max(...data.map(d => d.value)) * 1.15 || 10;
    
    const points = data.map((d, i) => {
      const x = data.length === 1 
        ? left + plotW / 2 
        : left + (i * (plotW / (data.length - 1)));
      const y = height - bottom - (d.value / maxVal) * plotH;
      return { x, y, name: d.name, value: d.value };
    });

    const linePath = data.length === 1 
      ? `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y}`
      : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      
    const areaPath = data.length === 1
      ? `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y} L ${points[0].x + 20} ${height - bottom} L ${points[0].x - 20} ${height - bottom} Z`
      : `${linePath} L ${points[points.length - 1].x} ${height - bottom} L ${points[0].x} ${height - bottom} Z`;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
      val: (maxVal * f).toFixed(0),
      y: height - bottom - f * plotH
    }));

    return (
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', height: '260px' }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <TrendingUp size={14} color="var(--color-secondary)" /> {user?.departmentID ? 'Số lượng thuốc tiêu hao tại khoa (đvt)' : 'Chi phí mua thuốc nhập kho (Triệu VND)'}
        </h4>
        <div style={{ flexGrow: 1, position: 'relative', height: '100%' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {yTicks.map((t, idx) => (
              <g key={idx}>
                <line x1={left} y1={t.y} x2={width - right} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <text x={left - 8} y={t.y + 4} textAnchor="end" fill="var(--text-dim)" fontSize="9" fontWeight="500">{t.val}{user?.departmentID ? '' : 'M'}</text>
              </g>
            ))}

            {/* Shaded Area */}
            <path d={areaPath} fill="url(#line-grad)" />

            {/* Plot Line */}
            <path d={linePath} stroke="var(--color-secondary)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* Data Points */}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle cx={p.x} cy={p.y} r="4" fill="var(--color-secondary)" stroke="var(--bg-primary)" strokeWidth="2" />
                <text x={p.x} y={height - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="9.5" fontWeight="600">{p.name}</text>
                <text x={p.x} y={p.y - 10} textAnchor="middle" fill="var(--color-secondary)" fontSize="9" fontWeight="700">{p.value.toFixed(0)}{user?.departmentID ? '' : 'M'}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  const renderDonutChart = () => {
    const data = summary?.groupDistribution || [];
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (data.length === 0 || total === 0) {
      return (
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', height: '260px', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <PieChart size={36} color="var(--text-dim)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Cơ cấu nhóm thuốc</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: 0, maxWidth: '200px' }}>Chưa có thuốc trong danh mục để phân loại cơ cấu.</p>
        </div>
      );
    }

    const colors = ['#0d9488', '#3b82f6', '#f59e0b', '#a855f7', '#64748b'];

    const r = 55;
    const cx = 90;
    const cy = 90;
    const circumference = 2 * Math.PI * r;

    let accumulatedPercent = 0;

    const segments = data.map((d, i) => {
      const percent = d.value / total;
      const strokeLength = percent * circumference;
      const strokeOffset = circumference - (accumulatedPercent * circumference);
      accumulatedPercent += percent;

      return {
        ...d,
        percent: (percent * 100).toFixed(0),
        color: colors[i % colors.length],
        strokeLength,
        strokeOffset
      };
    });

    return (
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', height: '260px' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.88rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <PieChart size={14} color="#3b82f6" /> Cơ cấu thuốc & vật tư lưu hành
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <div style={{ width: '160px', height: '160px', position: 'relative', flexShrink: 0 }}>
            <svg width="100%" height="100%" viewBox="0 0 180 180">
              <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="14" />
              {segments.map((s, idx) => (
                <circle
                  key={idx}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth="14"
                  strokeDasharray={`${s.strokeLength} ${circumference}`}
                  strokeDashoffset={s.strokeOffset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              ))}
              <text x={cx} y={cy - 2} textAnchor="middle" fill="var(--text-main)" fontSize="16" fontWeight="800">
                {summary?.totalMedicines || total}
              </text>
              <text x={cx} y={cy + 13} textAnchor="middle" fill="var(--text-dim)" fontSize="8.5" fontWeight="600" letterSpacing="0.5">
                MẶT HÀNG
              </text>
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginLeft: '0.75rem', flexGrow: 1 }}>
            {segments.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={s.name}>
                    {s.name}
                  </span>
                </div>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.78rem', marginLeft: '0.25rem' }}>{s.percent}%</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderBarChart = () => {
    const data = summary?.deptConsumption || [];
    if (data.length === 0) {
      return (
        <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', height: '180px', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <BarChart4 size={36} color="var(--text-dim)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{user?.departmentID ? 'Lượng tiêu hao thuốc tại khoa' : 'Lượng tiêu hao dược phẩm tại các khoa'}</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: 0, maxWidth: '300px' }}>{user?.departmentID ? 'Chưa có dữ liệu tiêu hao thuốc từ tủ trực khoa.' : 'Chưa có dữ liệu tiêu hao thuốc từ tủ trực của các khoa lâm sàng.'}</p>
        </div>
      );
    }

    const left = user?.departmentID ? 180 : 160;
    const right = 80;
    const top = 20;
    const bottom = 10;
    const width = 600;
    const height = 240;
    
    const maxVal = Math.max(...data.map(d => d.value)) || 10;
    const barH = 22;
    const spacing = 40;
    const maxBarW = user?.departmentID ? 320 : 340;

    return (
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <BarChart4 size={16} color="#0d9488" /> {user?.departmentID ? 'Top thuốc tiêu hao nhiều nhất tại khoa (đvt)' : 'Lượng tiêu hao dược phẩm tại các khoa lâm sàng (Viên/Vỉ/Lọ)'}
        </h4>
        <div style={{ width: '100%', height: '220px' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
            {data.map((d, i) => {
              const y = top + i * spacing;
              const barW = (d.value / maxVal) * maxBarW;
              const colors = ['#0d9488', '#3b82f6', '#f59e0b', '#10b981', '#6366f1'];
              const color = colors[i % colors.length];

              return (
                <g key={i}>
                  <text x={left - 15} y={y + 15} textAnchor="end" fill="var(--text-main)" fontSize="11" fontWeight="600">
                    {d.name.length > 25 ? `${d.name.substring(0, 23)}...` : d.name}
                  </text>
                  <rect x={left} y={y} width={maxBarW} height={barH} rx="4" fill="rgba(255,255,255,0.02)" />
                  <rect x={left} y={y} width={barW} height={barH} rx="4" fill={color} style={{ transition: 'width 0.5s ease-out' }} />
                  <text x={left + barW + 10} y={y + 15} textAnchor="start" fill="var(--color-secondary)" fontSize="11" fontWeight="700">
                    {d.value} đvt
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw className="nav-icon" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem', width: '30px', height: '30px' }} />
          <p>Đang tải dữ liệu Dashboard y tế...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">{user?.departmentID ? 'Tổng Quan Tủ Trực Khoa' : 'Tổng Quan Phân Hệ Dược'}</h1>
          <p className="page-subtitle">{user?.departmentID ? 'Giám sát cơ số thuốc tủ trực, đề xuất bù cơ số và quản lý hạn sử dụng thuốc tại khoa.' : 'Giám sát tồn kho, điều phối FEFO và cảnh báo an toàn thuốc bệnh viện.'}</p>
        </div>
        <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={fetchSummary}>
          <RefreshCw size={16} /> Làm mới
        </button>
      </div>

      {/* Metric Cards Grid */}
      {/* Metric Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.5rem'
      }}>
        {/* Card 1: Medicines */}
        <div className="glass-card metric-card">
          <div className="metric-info">
            <h4>{user?.departmentID ? 'Cơ số tủ trực' : 'Danh mục thuốc & vật tư'}</h4>
            <div className="value">{summary?.totalMedicines || 0}</div>
          </div>
          <div className="metric-icon-wrapper blue">
            <Package size={24} />
          </div>
        </div>

        {/* Card 2: Suppliers (Global only) */}
        {!user?.departmentID && (
          <div className="glass-card metric-card">
            <div className="metric-info">
              <h4>Nhà cung cấp</h4>
              <div className="value">{summary?.totalSuppliers || 0}</div>
            </div>
            <div className="metric-icon-wrapper blue" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <Users size={24} />
            </div>
          </div>
        )}

        {/* Card 3: Pending Requisitions */}
        <div className="glass-card metric-card">
          <div className="metric-info">
            <h4>{user?.departmentID ? 'Dự trù chờ duyệt' : 'Phiếu lĩnh chờ duyệt'}</h4>
            <div className="value" style={{ color: summary?.pendingRequisitions > 0 ? 'var(--color-warning)' : 'inherit' }}>
              {summary?.pendingRequisitions || 0}
            </div>
          </div>
          <div className="metric-icon-wrapper purple">
            <ClipboardList size={24} />
          </div>
        </div>

        {/* Card 4: Low Stock Warnings */}
        <div className="glass-card metric-card">
          <div className="metric-info">
            <h4>Cảnh báo tồn thấp</h4>
            <div className="value" style={{ color: summary?.lowStockCount > 0 ? 'var(--color-danger)' : 'inherit' }}>
              {summary?.lowStockCount || 0}
            </div>
          </div>
          <div className="metric-icon-wrapper red" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Card 5: Near Expiry */}
        <div className="glass-card metric-card">
          <div className="metric-info">
            <h4>{user?.departmentID ? 'Sắp hết hạn (khoa)' : 'Thuốc sắp hết hạn'}</h4>
            <div className="value" style={{ color: summary?.expiringBatchesCount > 0 ? 'var(--color-warning)' : 'inherit' }}>
              {summary?.expiringBatchesCount || 0}
            </div>
          </div>
          <div className="metric-icon-wrapper orange">
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Card 6: Expired */}
        <div className="glass-card metric-card">
          <div className="metric-info">
            <h4>{user?.departmentID ? 'Đã hết hạn (khoa)' : 'Lô đã hết hạn'}</h4>
            <div className="value" style={{ color: summary?.expiredBatchesCount > 0 ? 'var(--color-danger)' : 'inherit' }}>
              {summary?.expiredBatchesCount || 0}
            </div>
          </div>
          <div className="metric-icon-wrapper red">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Visual Charts Grid (Real-time updates) */}
      <div style={{ marginTop: '1.75rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.25rem 0' }}>
          📊 {user?.departmentID ? 'Báo cáo Thống kê Khoa Lâm Sàng' : 'Báo cáo Thống kê Hệ thống (Visual Analytics)'}
        </h3>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.82rem' }}>
          {user?.departmentID ? 'Biểu đồ phân tích trực quan về cơ cấu tủ trực và lượng thuốc tiêu hao thực tế tại khoa.' : 'Biểu đồ phân tích trực quan về dòng tài chính nhập kho, cơ cấu danh mục dược phẩm và tiêu hao tại các khoa lâm sàng.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.62fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {renderLineChart()}
        {renderDonutChart()}
      </div>

      {renderBarChart()}

      {/* Bottom Grid: Requisitions & Warnings */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Left Side: Recent Requisitions */}
        <div className="glass-card" style={{ marginBottom: 0 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <ClipboardList size={20} color="var(--color-secondary)" /> {user?.departmentID ? 'Phiếu dự trù lĩnh dược của khoa' : 'Phiếu dự trù mới nhận'}
          </h3>
          <div className="table-container">
            {summary?.recentRequisitions?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>{user?.departmentID ? 'Không có phiếu dự trù của khoa.' : 'Không có phiếu dự trù gần đây.'}</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Mã Phiếu</th>
                    <th>Khoa / Phòng</th>
                    <th>Loại Lĩnh</th>
                    <th>Ngày Lập</th>
                    <th>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.recentRequisitions?.map(req => (
                    <tr key={req.requisitionID} style={{ cursor: 'pointer' }} onClick={() => setPage('requisitions')}>
                      <td><strong>#REQ-{req.requisitionID}</strong></td>
                      <td>{req.departmentName}</td>
                      <td>
                        <span className={`badge-status ${req.requisitionType === 'Regular' ? 'regular' : req.requisitionType === 'Urgent' ? 'urgent' : 'refill'}`}>
                          {req.requisitionType === 'Regular' ? 'Lĩnh thường quy' : req.requisitionType === 'Urgent' ? '🚨 Lĩnh khẩn' : 'Bù tủ trực'}
                        </span>
                      </td>
                      <td>{new Date(req.requisitionDate).toLocaleString('vi-VN')}</td>
                      <td>
                        <span className={`badge-status ${req.status.toLowerCase()}`}>
                          {req.status === 'Pending' ? 'Chờ duyệt' : req.status === 'Approved' ? 'Đã duyệt' : 'Từ chối'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: Expiry Warnings */}
        <div className="glass-card" style={{ marginBottom: 0 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <AlertTriangle size={20} color="var(--color-danger)" /> Cảnh báo hạn sử dụng
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {summary?.expiringAlerts?.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>Không có cảnh báo hạn sử dụng cận kề.</p>
            ) : (
              summary?.expiringAlerts?.map(alert => (
                <div key={alert.batchID} style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  <div style={{ display: 'flex', justifyContext: 'space-between', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{alert.medicineName}</span>
                    <span className={`badge-alert ${alert.daysLeft <= 30 ? 'danger' : 'warning'}`} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                      {alert.daysLeft} ngày
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Lô: {alert.batchNumber}</span>
                    <span>Hạn: {new Date(alert.expiryDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    <span>Tồn kho chẵn: {alert.mainStoreQty}</span>
                    <span>Tồn tủ trực: {alert.cabinetQty}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Quick Access Grid */}
      <div className="glass-card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Thực thi thao tác nhanh</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {user?.role === 'pharmacist' && (
            <>
              <button className="btn-premium" onClick={() => setPage('imports')}>Nhập Kho Chẵn</button>
              <button className="btn-premium" onClick={() => setPage('requisitions')}>Duyệt Lĩnh Dược</button>
              <button className="btn-premium" onClick={() => setPage('restock')}>Đề Xuất Đặt Hàng</button>
              <button className="btn-premium" onClick={() => setPage('tracking')}>Nhập Xuất Tồn</button>
            </>
          )}
          {user?.role === 'director' && (
            <>
              <button className="btn-premium" onClick={() => setPage('liquidation')}>Xử Lý Thanh Lý</button>
              <button className="btn-premium" onClick={() => setPage('restock')}>Duyệt Đề Xuất Mua</button>
              <button className="btn-premium" onClick={() => setPage('tracking')}>Nhập Xuất Tồn</button>
            </>
          )}
          {!!user?.departmentID && (
            <>
              <button className="btn-premium" onClick={() => setPage('cabinet')}>Tủ Trực Khoa Lâm Sàng</button>
              <button className="btn-premium" onClick={() => setPage('requisitions')}>Phiếu Đề Nghị Lĩnh</button>
              <button className="btn-premium" onClick={() => setPage('returns')}>Hoàn Trả Thuốc Thừa</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
