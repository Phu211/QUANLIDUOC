import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert, PenTool, Eraser, Eye, RefreshCw, X } from 'lucide-react';

export default function BreakageReportList({ departmentId, user, onUpdateNeeded }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approving, setApproving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Approval Canvas
  const approveCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const fetchReports = () => {
    setLoading(true);
    fetch(`/api/breakage?departmentId=${departmentId || ''}&_t=${Date.now()}`, {
      headers: {
        'X-User-Role': user?.role || '',
        'X-User-DepartmentID': departmentId || ''
      }
    })
      .then(res => res.json())
      .then(data => {
        setReports(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching breakage reports: ", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReports();
  }, [departmentId]);

  const canApprove = user?.role === 'head_nurse' || user?.role === 'head' || user?.role === 'pharmacist' || user?.role === 'director';

  const startDrawing = (e) => {
    const canvas = approveCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = approveCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = approveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleApprove = () => {
    if (!hasDrawn) {
      alert("Vui lòng ký tên xác nhận duyệt trước khi hoàn tất.");
      return;
    }

    const signatureBase64 = approveCanvasRef.current.toDataURL('image/png');
    setApproving(true);

    fetch(`/api/breakage/${selectedReport.reportID}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || '',
        'X-User-FullName': encodeURIComponent(user?.fullName || '')
      },
      body: JSON.stringify({
        approverSignature: signatureBase64,
        approverName: user?.fullName || 'Người duyệt'
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || "Lỗi duyệt biên bản"); });
        }
        return res.json();
      })
      .then(data => {
        alert(data.message || "Đã phê duyệt biên bản và trừ tồn kho tủ trực thành công!");
        setShowApproveModal(false);
        setApproving(false);
        fetchReports();
        onUpdateNeeded?.();
      })
      .catch(err => {
        alert("Lỗi: " + err.message);
        setApproving(false);
      });
  };

  return (
    <div className="glass-card" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
            <AlertTriangle size={18} /> Nhật Ký Biên Bản Hư Hao / Vỡ Hỏng Đột Xuất
          </h3>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Ghi nhận rơi vỡ tại chỗ, trừ tồn cơ số và tạo mã băm SHA-256 bảo toàn tính pháp lý cho kiểm kê cuối tháng.
          </p>
        </div>
        <button 
          className="btn-secondary" 
          onClick={fetchReports} 
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
        >
          <RefreshCw size={13} /> Làm mới
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Đang tải danh sách biên bản...</p>
      ) : reports.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Chưa có biên bản vỡ hỏng nào được ghi nhận tại khoa này.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Mã Biên Bản</th>
                <th style={{ width: '130px' }}>Ngày Ghi Nhận</th>
                <th>Người Báo Cáo</th>
                <th>Lý Do Hư Hao</th>
                <th>Thuốc / Lô / Số Lượng</th>
                <th>Thiệt Hại</th>
                <th>Trạng Thái & Chữ Ký</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.reportID}>
                  <td>
                    <strong>{r.reportCode}</strong>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {new Date(r.reportDate).toLocaleDateString('vi-VN')}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(r.reportDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{r.reportedBy}</div>
                    {r.digitalSignature && (
                      <span style={{ fontSize: '0.7rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <CheckCircle2 size={11} /> Đã ký báo cáo
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ color: '#b91c1c', fontWeight: '500' }}>{r.reason}</div>
                    {r.notes && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.notes}</div>}
                    {r.damageImage && (
                      <button
                        onClick={() => setPreviewImage(r.damageImage)}
                        style={{ marginTop: '0.25rem', padding: '0.15rem 0.4rem', fontSize: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Eye size={10} /> Xem ảnh hiện trường
                      </button>
                    )}
                  </td>
                  <td>
                    {r.details?.map(d => (
                      <div key={d.detailID} style={{ fontSize: '0.82rem' }}>
                        • <strong>{d.batch?.medicine?.medicineName || 'Thuốc'}</strong> (Lô: {d.batch?.batchNumber}) : <span style={{ color: '#dc2626', fontWeight: 'bold' }}>-{d.damagedQuantity}</span> {d.batch?.medicine?.unit}
                      </div>
                    ))}
                  </td>
                  <td style={{ fontWeight: '700', color: '#dc2626' }}>
                    {r.totalLossAmount?.toLocaleString('vi-VN')} đ
                  </td>
                  <td>
                    {r.status === 'Approved' ? (
                      <div>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          ✓ Đã duyệt trừ tồn
                        </span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Bởi: {r.approverName}
                        </div>

                        {/* Document Integrity Badge */}
                        {r.documentHash && (
                          <div style={{ marginTop: '0.35rem' }}>
                            {r.isIntegrityValid ? (
                              <span style={{ fontSize: '0.68rem', padding: '0.12rem 0.35rem', borderRadius: '4px', background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }} title={`SHA-256: ${r.documentHash}`}>
                                <ShieldCheck size={11} /> Toàn vẹn (SHA-256)
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.68rem', padding: '0.12rem 0.35rem', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 'bold' }}>
                                <ShieldAlert size={11} /> CẢNH BÁO CAN THIỆP
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        ⏳ Chờ ký duyệt
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {r.status === 'Pending' && canApprove && (
                      <button
                        className="btn-danger"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', background: '#dc2626', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        onClick={() => {
                          setSelectedReport(r);
                          setShowApproveModal(true);
                        }}
                      >
                        <PenTool size={12} /> Ký duyệt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedReport && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '95%', padding: '1.75rem' }}>
            <button
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setShowApproveModal(false)}
            >
              <X size={22} />
            </button>

            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} /> Ký Duyệt Trừ Tồn Hao Hụt [{selectedReport.reportCode}]
            </h3>

            <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div><strong>Lý do hư hao:</strong> {selectedReport.reason}</div>
              <div><strong>Người báo cáo:</strong> {selectedReport.reportedBy}</div>
              <div><strong>Tổng giá trị hao hụt:</strong> <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{selectedReport.totalLossAmount?.toLocaleString('vi-VN')} đ</span></div>
              <div style={{ marginTop: '0.35rem', color: '#64748b', fontSize: '0.78rem' }}>
                * Sau khi ký duyệt, hệ thống sẽ tự động trừ số lượng thuốc khỏi tủ trực và tạo mã hash SHA-256 khóa biên bản.
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label className="form-label" style={{ fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <PenTool size={14} /> Chữ Ký Phê Duyệt ({user?.fullName || 'Người duyệt'}) (*)
                </label>
                <button
                  type="button"
                  onClick={clearCanvas}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  <Eraser size={13} /> Xóa ký lại
                </button>
              </div>
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc', overflow: 'hidden' }}>
                <canvas
                  ref={approveCanvasRef}
                  width={540}
                  height={130}
                  style={{ width: '100%', height: '130px', display: 'block', cursor: 'crosshair' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setShowApproveModal(false)} disabled={approving}>
                Đóng
              </button>
              <button
                className="btn-premium"
                style={{ background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                onClick={handleApprove}
                disabled={approving}
              >
                {approving ? 'Đang duyệt & băm mã...' : 'Xác Nhận Ký Số & Trừ Tồn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%', padding: '1rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Hiện trường" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px' }} />
            <button className="btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => setPreviewImage(null)}>
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
