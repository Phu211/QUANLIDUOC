import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  X, 
  ChevronRight, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Calendar, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function PharmacyChatbot({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);

  const messagesEndRef = useRef(null);

  // Khởi tạo lời chào & danh sách câu hỏi mẫu phân quyền theo đúng tài khoản đăng nhập
  useEffect(() => {
    const role = (user?.role || user?.Role || 'pharmacist').toLowerCase();
    const name = user?.fullName || user?.FullName || user?.name || user?.username || 'Đồng nghiệp';
    const dept = user?.departmentName || user?.DepartmentName || '';

    let roleTitle = 'Dược sĩ / Thủ kho';
    let welcomeText = '';
    let defaultReplies = [];

    if (role === 'director') {
      roleTitle = 'Ban Giám Đốc Bệnh viện';
      welcomeText = `Kính chào **${name}** (${roleTitle}).\n\nTôi là Trợ lý Quản trị Kho Vận & Điều Hành Dược Phẩm. Tôi sẵn sàng cung cấp các báo cáo điều hành vĩ mô cho Lãnh đạo:\n- Báo cáo tổng quan: Thống kê quy mô tồn kho, tỷ lệ dự trữ toàn viện.\n- Cảnh báo rủi ro cận hạn: Giám sát các lô thuốc có nguy cơ tiêu hủy.\n- Giám sát luân chuyển: Theo dõi phân phối thuốc giữa Kho Chẵn và các khoa lâm sàng.`;
      defaultReplies = [
        "Báo cáo tổng quan tồn kho toàn viện",
        "Có những lô thuốc nào hết hạn trong kho?",
        "Thuốc Paracetamol được chuyển đi những khoa nào?",
        "Các khoa có thuốc sắp hết hạn cần xử lý"
      ];
    } else if (role === 'nurse' || role === 'head_nurse') {
      roleTitle = dept ? `Điều dưỡng ${dept}` : 'Điều dưỡng lâm sàng';
      welcomeText = `Chào **${name}** (${roleTitle}).\n\nTôi hỗ trợ tra cứu số liệu tủ trực phục vụ ca trực của khoa **${dept || 'lâm sàng'}**:\n- Kiểm tra cơ số tủ trực: Xem danh mục, số lượng thuốc dự phòng cấp cứu hiện có.\n- Cảnh báo thuốc cận date: Rà soát các mặt hàng sắp hết hạn để kịp thời làm thủ tục đổi trả.\n- Tra cứu Kho Chẵn: Kiểm tra xem Kho Dược trung tâm còn thuốc không để làm dự trù lĩnh.\n- Tiến độ phiếu lĩnh thuốc: Theo dõi các phiếu lĩnh bù cơ số của khoa.`;
      defaultReplies = [
        `Kiểm tra cơ số tủ trực ${dept || 'khoa'}`,
        `Thuốc nào trong tủ trực ${dept || 'khoa'} sắp hết hạn?`,
        "Kho Chẵn hiện còn Paracetamol 500mg không?",
        "Tiến độ phiếu lĩnh thuốc của khoa"
      ];
    } else if (role === 'head') {
      roleTitle = dept ? `Trưởng khoa ${dept}` : 'Bác sĩ Trưởng khoa';
      welcomeText = `Kính chào **${name}** (${roleTitle}).\n\nTôi hỗ trợ theo dõi công tác dược nội bộ khoa **${dept || 'Lâm Sàng'}**:\n- Cơ số tủ trực: Đảm bảo đủ thuốc cấp cứu theo định mức của khoa.\n- Phiếu lĩnh thuốc chờ duyệt: Giám sát tiến độ các phiếu dự trù thuốc của khoa.\n- Tồn kho Kho Chẵn: Kiểm tra khả năng cung ứng của Kho Dược trung tâm.\n- Lịch sử nhận thuốc: Xem các đợt khoa đã nhận thuốc cấp phát.`;
      defaultReplies = [
        `Cơ số tủ trực khoa ${dept || 'khoa'}`,
        `Phiếu lĩnh thuốc của khoa ${dept || 'khoa'} chờ duyệt`,
        "Kiểm tra tồn kho Paracetamol ở Kho Chẵn",
        `Thuốc nào trong tủ trực ${dept || 'khoa'} sắp hết hạn?`
      ];
    } else {
      // Pharmacist / Thủ kho
      roleTitle = 'Dược sĩ / Thủ kho Dược';
      welcomeText = `Chào **${name}** (${roleTitle}).\n\nTôi hỗ trợ tra cứu số liệu vận hành kho vận dược phẩm:\n- Hạn dùng toàn viện: Quản lý các lô hết hạn và cận date theo nguyên tắc FEFO.\n- Truy vết luân chuyển: Thuốc được chuyển đi đâu, khoa nào đang lưu trữ.\n- Kiểm soát xuất nhập tồn: Đối chiếu định mức an toàn tối thiểu và cảnh báo thiếu hàng.\n- Điều phối cấp phát: Xử lý các phiếu lĩnh thuốc của các khoa lâm sàng.`;
      defaultReplies = [
        "Có những lô thuốc nào hết hạn trong kho?",
        "Thuốc Paracetamol được chuyển đi đâu?",
        "Mặt hàng nào đang dưới định mức an toàn tối thiểu?",
        "Cơ số tủ trực khoa Cấp Cứu hiện có gì?"
      ];
    }

    setMessages([
      {
        id: 1,
        sender: 'bot',
        text: welcomeText,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setQuickReplies(defaultReplies);
  }, [user]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputVal).trim();
    if (!text || isTyping) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chatbot/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userRole: user?.role || user?.Role || 'pharmacist',
          userName: user?.fullName || user?.FullName || user?.name || user?.username || 'Cán bộ Y tế',
          departmentId: user?.departmentID || user?.DepartmentID || null,
          departmentName: user?.departmentName || user?.DepartmentName || null
        })
      });

      if (!res.ok) throw new Error("Lỗi kết nối máy chủ AI");
      const data = await res.json();

      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: data.replyText,
        cardType: data.cardType,
        cardData: data.cardData,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
      if (data.quickReplies && data.quickReplies.length > 0) {
        setQuickReplies(data.quickReplies);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: `⚠️ Rất tiếc, đã có lỗi kết nối khi xử lý câu hỏi: ${err.message}. Vui lòng thử lại sau giây lát.`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleResetChat = () => {
    const role = (user?.role || user?.Role || 'pharmacist').toLowerCase();
    const name = user?.fullName || user?.FullName || user?.name || user?.username || 'Đồng nghiệp';
    const dept = user?.departmentName || user?.DepartmentName || '';

    setMessages([
      {
        id: Date.now(),
        sender: 'bot',
        text: `Phiên hội thoại quản trị kho đã được làm mới. Tôi sẵn sàng hỗ trợ **${name}** (${dept ? `${dept}` : 'Kho Dược'})!`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Helper formatting markdown to styled HTML tags
  const renderFormattedText = (rawText) => {
    if (!rawText) return null;

    const lines = rawText.split('\n');
    const elements = [];
    let inTable = false;
    let tableRows = [];

    const flushTable = (key) => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(1).filter(r => !r.every(c => c.trim().match(/^:?-+:?$/)));

        elements.push(
          <div key={`table-${key}`} style={{ overflowX: 'auto', margin: '0.5rem 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', background: 'var(--bg-primary, #f8fafc)', borderRadius: '6px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: 'rgba(2, 132, 199, 0.08)', borderBottom: '1px solid var(--border-color)' }}>
                  {headerRow.map((cell, cIdx) => (
                    <th key={cIdx} style={{ padding: '0.35rem 0.45rem', textAlign: 'left', fontWeight: '700', color: 'var(--text-main)' }}>
                      {cell.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: '0.3rem 0.45rem', color: 'var(--text-main)' }} dangerouslySetInnerHTML={{
                        __html: cell.trim()
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em>$1</em>')
                          .replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.06); padding: 1px 3px; border-radius: 3px; font-family: monospace;">$1</code>')
                      }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
      inTable = false;
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        const cells = trimmed.slice(1, -1).split('|');
        tableRows.push(cells);
        return;
      } else if (inTable) {
        flushTable(idx);
      }

      let formatted = line;
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
      formatted = formatted.replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 4px; font-family: monospace; font-size: 0.85em;">$1</code>');

      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={idx} style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.88rem', fontWeight: '700', color: 'var(--color-primary)' }} 
            dangerouslySetInnerHTML={{ __html: formatted.replace('### ', '') }} 
          />
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h3 key={idx} style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.92rem', fontWeight: '800', color: 'var(--color-primary)' }} 
            dangerouslySetInnerHTML={{ __html: formatted.replace('## ', '') }} 
          />
        );
      } else if (line.startsWith('---')) {
        elements.push(<hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <div key={idx} style={{ display: 'flex', gap: '6px', margin: '0.15rem 0', paddingLeft: '0.4rem' }}>
            <span>•</span>
            <span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[-*]\s/, '') }} />
          </div>
        );
      } else if (trimmed === '') {
        elements.push(<div key={idx} style={{ height: '0.35rem' }} />);
      } else {
        elements.push(<div key={idx} style={{ margin: '0.15rem 0' }} dangerouslySetInnerHTML={{ __html: formatted }} />);
      }
    });

    if (inTable) {
      flushTable('end');
    }

    return elements;
  };

  // Render Rich Data Cards
  const renderCard = (type, data) => {
    if (!data) return null;

    if (type === 'executive_summary') {
      const totalMeds = data.totalMedicines ?? data.TotalMedicines ?? 0;
      const totalBatches = data.totalBatches ?? data.TotalBatches ?? 0;
      const expiredBatches = data.expiredBatches ?? data.ExpiredBatches ?? 0;
      const nearDateBatches = data.nearDateBatches ?? data.NearDateBatches ?? 0;
      const activeCabs = data.activeCabinets ?? data.ActiveCabinets ?? 0;
      const pendingReqs = data.pendingRequisitions ?? data.PendingRequisitions ?? 0;

      return (
        <div style={{ marginTop: '0.6rem', background: 'var(--bg-primary, #f8fafc)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem' }}>
          <div style={{ fontWeight: '800', color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
            Tổng quan quản trị toàn viện
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            <div style={{ background: 'var(--card-bg, #ffffff)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Tổng mặt hàng</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--color-primary)' }}>{totalMeds}</div>
            </div>
            <div style={{ background: 'var(--card-bg, #ffffff)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Lô thuốc lưu kho</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>{totalBatches}</div>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
              <div style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: '600' }}>Lô ĐÃ QUÁ HẠN</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ef4444' }}>{expiredBatches}</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <div style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: '600' }}>Lô cận date (≤90d)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#f59e0b' }}>{nearDateBatches}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-color)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span>Tủ trực lâm sàng: <strong>{activeCabs} khoa</strong></span>
            <span>Phiếu chờ duyệt: <strong style={{ color: 'var(--color-primary)' }}>{pendingReqs}</strong></span>
          </div>
        </div>
      );
    }

    if (type === 'stock_table') {
      const medName = data.medicineName || data.MedicineName || '';
      const unit = data.unit || data.Unit || '';
      const batches = data.batches || data.Batches || [];

      return (
        <div style={{ marginTop: '0.6rem', background: 'var(--bg-primary, #f8fafc)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', fontSize: '0.75rem' }}>
          <div style={{ fontWeight: '700', color: 'var(--color-primary)', marginBottom: '0.35rem' }}>
            Chi tiết các lô thuốc: {medName}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.2rem', textAlign: 'left' }}>Số lô</th>
                <th style={{ padding: '0.2rem', textAlign: 'center' }}>Hạn dùng</th>
                <th style={{ padding: '0.2rem', textAlign: 'right' }}>Tồn kho</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b, idx) => {
                const bNo = b.batchNumber || b.BatchNumber || 'N/A';
                const exp = b.expiryDate || b.ExpiryDate || '';
                const stock = b.stock ?? b.Stock ?? 0;
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.25rem', fontWeight: '600' }}>{bNo}</td>
                    <td style={{ padding: '0.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>{exp}</td>
                    <td style={{ padding: '0.25rem', textAlign: 'right', fontWeight: 'bold', color: stock > 0 ? '#10b981' : '#ef4444' }}>
                      {stock.toLocaleString('vi-VN')} {unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    if (type === 'expiry_list') {
      const list = Array.isArray(data) ? data : (data.items || data.Items || []);
      return (
        <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem' }}>
          {list.map((b, idx) => {
            const isExp = b.isExpired ?? b.IsExpired ?? false;
            const medName = b.medicineName || b.MedicineName || 'N/A';
            const batchNo = b.batchNumber || b.BatchNumber || 'N/A';
            const expDate = b.expiryDate || b.ExpiryDate;
            const mainStock = b.mainStock ?? b.MainStock ?? 0;
            const deptStock = b.deptStock ?? b.DeptStock ?? 0;
            const daysLeft = b.daysRemaining ?? b.DaysRemaining ?? 0;

            return (
              <div key={idx} style={{
                background: isExp ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-primary, #f8fafc)',
                border: `1px solid ${isExp ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)'}`,
                borderRadius: '6px',
                padding: '0.45rem 0.6rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: '700', color: isExp ? '#ef4444' : 'var(--text-main)' }}>
                    {medName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Lô: <strong>{batchNo}</strong> • HSD: {expDate ? new Date(expDate).toLocaleDateString('vi-VN') : 'N/A'}
                    {mainStock > 0 && ` • Kho: ${mainStock.toLocaleString('vi-VN')}`}
                    {deptStock > 0 && ` • Tủ: ${deptStock.toLocaleString('vi-VN')}`}
                  </div>
                </div>
                <span style={{
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  background: isExp ? '#ef4444' : '#f59e0b',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: '600'
                }}>
                  {isExp ? 'ĐÃ QUÁ HẠN' : `Còn ${daysLeft} ngày`}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    if (type === 'movement_history') {
      const medName = data.medicineName || data.MedicineName || '';
      const unit = data.unit || data.Unit || '';
      const currentLocs = data.currentLocations || data.CurrentLocations || [];
      const transfers = data.transfers || data.Transfers || [];

      return (
        <div style={{ marginTop: '0.6rem', background: 'var(--bg-primary, #f8fafc)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', fontSize: '0.75rem' }}>
          <div style={{ fontWeight: '700', color: 'var(--color-primary)', marginBottom: '0.4rem' }}>
            Lịch sử cấp phát và luân chuyển: {medName}
          </div>
          
          {currentLocs.length > 0 && (
            <div style={{ marginBottom: '0.55rem', padding: '0.45rem', background: 'rgba(2, 132, 199, 0.08)', borderRadius: '6px' }}>
              <div style={{ fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.72rem', marginBottom: '0.2rem' }}>
                Đang lưu trữ tại các tủ trực:
              </div>
              {currentLocs.map((loc, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '1px 0' }}>
                  <span>• {loc.departmentName || loc.DepartmentName} (Lô: {loc.batchNumber || loc.BatchNumber})</span>
                  <strong>{(loc.quantity ?? loc.Quantity ?? 0).toLocaleString('vi-VN')} {unit}</strong>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.25rem' }}>
            Lịch sử các lần xuất cấp phát gần nhất:
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.25rem', textAlign: 'left' }}>Khoa nhận</th>
                <th style={{ padding: '0.25rem', textAlign: 'center' }}>Ngày xuất</th>
                <th style={{ padding: '0.25rem', textAlign: 'right' }}>Số lượng</th>
                <th style={{ padding: '0.25rem', textAlign: 'center' }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((tr, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.3rem', fontWeight: '500' }}>
                    {tr.departmentName || tr.DepartmentName}
                    <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>{tr.requisitionType || tr.RequisitionType}</div>
                  </td>
                  <td style={{ padding: '0.3rem', textAlign: 'center', color: 'var(--text-muted)' }}>{tr.date || tr.Date}</td>
                  <td style={{ padding: '0.3rem', textAlign: 'right', fontWeight: 'bold' }}>
                    {(tr.dispensedQuantity ?? tr.DispensedQuantity ?? 0).toLocaleString('vi-VN')} {unit}
                  </td>
                  <td style={{ padding: '0.3rem', textAlign: 'center' }}>
                    <span className="badge-status" style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                      {tr.status || tr.Status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (type === 'cabinet_table') {
      const deptName = data.departmentName || data.DepartmentName || 'Khoa lâm sàng';
      const items = data.items || data.Items || [];

      return (
        <div style={{ marginTop: '0.6rem', background: 'var(--bg-primary, #f8fafc)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.65rem', fontSize: '0.75rem' }}>
          <div style={{ fontWeight: '700', color: 'var(--color-secondary)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Tủ trực: <strong>{deptName}</strong></span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{items.length} mặt hàng</span>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Hiện chưa ghi nhận thuốc lưu trong tủ trực khoa này.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.25rem', textAlign: 'left' }}>Thuốc</th>
                  <th style={{ padding: '0.25rem', textAlign: 'center' }}>Lô</th>
                  <th style={{ padding: '0.25rem', textAlign: 'center' }}>HSD</th>
                  <th style={{ padding: '0.25rem', textAlign: 'right' }}>Tồn thực tế</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const medName = it.medicineName || it.MedicineName || 'N/A';
                  const batchNo = it.batchNumber || it.BatchNumber || 'N/A';
                  const expDate = it.expiryDate || it.ExpiryDate || '';
                  const qty = it.quantity ?? it.Quantity ?? 0;
                  const unit = it.unit || it.Unit || '';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.35rem 0.25rem', fontWeight: '600' }}>{medName}</td>
                      <td style={{ padding: '0.35rem 0.25rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{batchNo}</td>
                      <td style={{ padding: '0.35rem 0.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {expDate ? new Date(expDate).toLocaleDateString('vi-VN') : 'N/A'}
                      </td>
                      <td style={{ padding: '0.35rem 0.25rem', textAlign: 'right', fontWeight: 'bold', color: qty > 0 ? '#10b981' : '#ef4444' }}>
                        {qty.toLocaleString('vi-VN')} {unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      );
    }

    if (type === 'requisition_list') {
      const list = Array.isArray(data) ? data : (data.items || data.Items || []);
      return (
        <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem' }}>
          {list.map((r, idx) => {
            const code = r.requisitionCode || r.RequisitionCode || '';
            const dept = r.departmentName || r.DepartmentName || '';
            const priority = r.priority || r.Priority || '';
            const createdAt = r.createdAt || r.CreatedAt || '';
            const status = r.status || r.Status || '';
            return (
              <div key={idx} style={{
                background: 'var(--bg-primary, #f8fafc)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{code} - {dept}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{priority} • {createdAt}</div>
                </div>
                <span className="badge-status" style={{
                  fontSize: '0.68rem',
                  background: status === 'Approved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                  color: status === 'Approved' ? '#10b981' : 'var(--color-primary)'
                }}>
                  {status}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.4), 0 0 15px rgba(13, 148, 136, 0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9990,
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          title="Mở Trợ Lý Quản Trị Kho Dược AI"
        >
          <Bot size={28} />
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: '#10b981',
            border: '2px solid var(--card-bg, #ffffff)',
            boxShadow: '0 0 8px #10b981'
          }} />
        </button>
      )}

      {/* Expandable Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '430px',
          maxWidth: 'calc(100vw - 32px)',
          height: '630px',
          maxHeight: 'calc(100vh - 48px)',
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text-main, #0f172a)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(2, 132, 199, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9995,
          overflow: 'hidden',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Top Bar Header */}
          <div style={{
            padding: '0.85rem 1rem',
            background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.12), rgba(13, 148, 136, 0.12))',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}>
                <Bot size={20} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Quản Trị Kho & Luân Chuyển Dược
                  <Sparkles size={13} color="var(--color-secondary)" />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                  Google Gemini 3.5 Flash (Live AI)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <button
                type="button"
                onClick={handleResetChat}
                title="Làm mới hội thoại"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.35rem', borderRadius: '6px' }}
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Thu nhỏ"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.35rem', borderRadius: '6px' }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Stream Container */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            background: 'var(--bg-content, #f8fafc)'
          }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: m.sender === 'user' 
                      ? 'linear-gradient(135deg, var(--color-primary), #0284c7)'
                      : 'var(--card-bg, #ffffff)',
                    color: m.sender === 'user' ? '#ffffff' : 'var(--text-main, #0f172a)',
                    border: m.sender === 'user' ? 'none' : '1px solid var(--border-color)',
                    boxShadow: m.sender === 'user' 
                      ? '0 2px 8px rgba(2, 132, 199, 0.25)' 
                      : '0 2px 6px rgba(0,0,0,0.04)',
                    fontSize: '0.82rem',
                    lineHeight: '1.45'
                  }}
                >
                  {renderFormattedText(m.text)}
                  {m.cardType && renderCard(m.cardType, m.cardData)}
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim, #94a3b8)', marginTop: '2px', padding: '0 4px' }}>
                  {m.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.4rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                <Bot size={14} className="animate-spin" />
                <span>AI đang truy vấn kho dữ liệu và phân tích...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div style={{
            padding: '0.4rem 0.85rem',
            background: 'var(--bg-primary, #f8fafc)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            gap: '0.4rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            {quickReplies.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(q)}
                style={{
                  fontSize: '0.72rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '12px',
                  background: 'var(--bg-primary, #f8fafc)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.color = 'var(--color-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              padding: '0.75rem 0.85rem',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '0.5rem',
              background: 'var(--card-bg, #ffffff)'
            }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="Hỏi tồn kho, lô hết hạn, thuốc A chuyển đi đâu..."
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              disabled={isTyping}
              style={{
                flex: 1,
                fontSize: '0.84rem',
                height: '38px',
                borderRadius: '8px'
              }}
            />
            <button
              type="submit"
              className="btn-premium"
              disabled={isTyping || !inputVal.trim()}
              style={{
                padding: '0 0.9rem',
                height: '38px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
