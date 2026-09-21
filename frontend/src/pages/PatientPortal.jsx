import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Pill, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  User, 
  Phone, 
  Search, 
  HeartHandshake, 
  Coffee, 
  Wine, 
  Droplet, 
  Thermometer, 
  Send, 
  X, 
  Sparkles,
  Info,
  ChevronRight,
  HelpCircle,
  Stethoscope,
  Building2,
  FileText,
  ScanLine
} from 'lucide-react';
import BarcodeRenderer from '../components/BarcodeRenderer';

export default function PatientPortal({ initialCode, onSwitchToStaffLogin }) {
  const [searchCode, setSearchCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('code') || params.get('prescription') || initialCode || 'DT-20260906-0003';
  });

  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFullName, setShowFullName] = useState(false);

  // ADR Modal State
  const [showAdrModal, setShowAdrModal] = useState(false);
  const [adrSubmitting, setAdrSubmitting] = useState(false);
  const [adrSuccessMsg, setAdrSuccessMsg] = useState(null);
  const [adrForm, setAdrForm] = useState({
    suspectedMedicineName: '',
    selectedSymptoms: [],
    severity: 'Nhẹ',
    onsetDelay: '30 phút',
    description: '',
    patientPhone: ''
  });

  useEffect(() => {
    if (searchCode) {
      fetchPrescription(searchCode);
    }
  }, []);

  const fetchPrescription = async (code) => {
    if (!code || !code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const clean = encodeURIComponent(code.trim());
      const res = await fetch(`/api/patientportal/prescription/${clean}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Không tìm thấy đơn thuốc tương ứng với mã quét.');
      }
      const data = await res.json();
      setPrescription(data);
      // Reset form default medicine
      setAdrForm(prev => ({
        ...prev,
        suspectedMedicineName: data.medicines?.[0]?.medicineName || 'Cả đơn thuốc',
        patientPhone: ''
      }));
    } catch (err) {
      console.error(err);
      setError(err.message);
      setPrescription(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    fetchPrescription(searchCode);
  };

  const toggleSymptom = (sym) => {
    setAdrForm(prev => {
      const exists = prev.selectedSymptoms.includes(sym);
      return {
        ...prev,
        selectedSymptoms: exists
          ? prev.selectedSymptoms.filter(s => s !== sym)
          : [...prev.selectedSymptoms, sym]
      };
    });
  };

  const handleAdrSubmit = async (e) => {
    e?.preventDefault();
    if (adrForm.selectedSymptoms.length === 0 && !adrForm.description.trim()) {
      alert('Vui lòng chọn ít nhất 1 triệu chứng hoặc mô tả biểu hiện bạn đang gặp phải.');
      return;
    }

    setAdrSubmitting(true);
    try {
      const symptomsStr = adrForm.selectedSymptoms.join(', ') + 
        (adrForm.description.trim() ? ` (Chi tiết: ${adrForm.description.trim()})` : '');

      const payload = {
        prescriptionCode: prescription.prescriptionCode,
        patientName: prescription.fullPatientName || prescription.patientName,
        patientPhone: adrForm.patientPhone,
        suspectedMedicineName: adrForm.suspectedMedicineName,
        symptoms: symptomsStr,
        severity: adrForm.severity,
        onsetDelay: adrForm.onsetDelay,
        description: adrForm.description
      };

      const res = await fetch('/api/patientportal/adr-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Không thể gửi báo cáo. Vui lòng thử lại hoặc gọi Hotline bệnh viện.');
      }

      const data = await res.json();
      setAdrSuccessMsg(data.message || 'Báo cáo của bạn đã được gửi thành công đến Dược sĩ lâm sàng!');
      setTimeout(() => {
        setShowAdrModal(false);
        setAdrSuccessMsg(null);
        setAdrForm({
          suspectedMedicineName: prescription?.medicines?.[0]?.medicineName || '',
          selectedSymptoms: [],
          severity: 'Nhẹ',
          onsetDelay: '30 phút',
          description: '',
          patientPhone: ''
        });
      }, 4000);
    } catch (err) {
      alert(err.message);
    } finally {
      setAdrSubmitting(false);
    }
  };

  // Group medicines by daily slots
  const morningMeds = prescription?.medicines?.filter(m => (m.morningDose || 0) > 0) || [];
  const noonMeds = prescription?.medicines?.filter(m => (m.noonDose || 0) > 0) || [];
  const afternoonMeds = prescription?.medicines?.filter(m => (m.afternoonDose || 0) > 0) || [];
  const nightMeds = prescription?.medicines?.filter(m => (m.nightDose || 0) > 0) || [];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f0fdf4 0%, #f8fafc 30%, #f1f5f9 100%)',
      color: '#0f172a',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* 1. Header Bar */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.85rem 1.25rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                BỆNH VIỆN ĐA KHOA QUỐC TẾ HIS
              </div>
              <h1 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                Cổng Tra Cứu Hướng Dẫn Thuốc
              </h1>
            </div>
          </div>

          {onSwitchToStaffLogin && (
            <button
              onClick={onSwitchToStaffLogin}
              style={{
                fontSize: '0.76rem',
                fontWeight: 600,
                color: '#64748b',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Cán bộ Y tế
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '1.25rem 1rem 5rem 1rem' }}>
        
        {/* Search / Scan Bar */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0',
          marginBottom: '1.25rem'
        }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text"
                placeholder="Nhập mã đơn thuốc (VD: DT-20260906-0003)..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.2rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {loading ? 'Đang tìm...' : 'Tra cứu'}
            </button>
          </form>
          <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Sparkles size={12} color="#10b981" />
            <span>Mã đơn thuốc được in ở góc phải trên cùng toa thuốc của bạn.</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: '#fef2f2',
            borderLeft: '4px solid #ef4444',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.25rem',
            color: '#dc2626',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <div className="spin" style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#10b981', borderRadius: '50%', margin: '0 auto 1rem auto' }} />
            <div style={{ fontWeight: 600 }}>Đang truy xuất hồ sơ đơn thuốc từ Kho Dược...</div>
          </div>
        )}

        {/* Prescription Details Card */}
        {prescription && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* 1. Patient & Prescription Header Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '1.35rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, #10b981, #06b6d4)'
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Đơn Thuốc Ngoại Trú
                  </div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0.2rem 0' }}>
                    {showFullName ? prescription.fullPatientName : prescription.patientName}
                    <button 
                      onClick={() => setShowFullName(!showFullName)}
                      style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.72rem',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '0.15rem 0.45rem',
                        cursor: 'pointer',
                        color: '#475569'
                      }}
                      title="Nhấp để ẩn/hiện đầy đủ họ tên"
                    >
                      {showFullName ? 'Ẩn tên' : 'Hiện tên đầy đủ'}
                    </button>
                  </h2>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem', color: '#64748b', flexWrap: 'wrap' }}>
                    <span>Mã BN: <strong>{prescription.patientCode}</strong></span>
                    <span>Năm sinh: <strong>{prescription.birthYear}</strong> ({prescription.gender})</span>
                    <span>Mã đơn: <strong style={{ color: '#0284c7' }}>{prescription.prescriptionCode}</strong></span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: prescription.status === 'Dispensed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    color: prescription.status === 'Dispensed' ? '#059669' : '#d97706',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    border: prescription.status === 'Dispensed' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                  }}>
                    <CheckCircle2 size={14} />
                    {prescription.status === 'Dispensed' ? 'Đã Cấp Phát Thuốc' : 'Đang Chờ Lấy Thuốc'}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem', marginBottom: '0.45rem' }}>
                    {prescription.dispensedAt ? `Cấp lúc: ${prescription.dispensedAt}` : `Kê lúc: ${prescription.prescribedAt}`}
                  </div>
                  {prescription.barcode && (
                    <div style={{
                      background: '#ffffff',
                      padding: '4px 8px 2px 8px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                      display: 'inline-block'
                    }}>
                      <BarcodeRenderer
                        value={prescription.barcode}
                        width={1.25}
                        height={28}
                        fontSize={10}
                        lineColor="#0f172a"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Diagnosis box */}
              <div style={{
                background: '#f8fafc',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                border: '1px solid #f1f5f9'
              }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '2px' }}>Chẩn đoán của bác sĩ:</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{prescription.diagnosis}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Bác sĩ điều trị: <strong>{prescription.doctorName}</strong> • {prescription.departmentName}
                </div>
              </div>
            </div>

            {/* 2. Floating Quick Action: Report Side Effect (ADR) */}
            <div style={{
              background: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              border: '1px solid #fecdd3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.92rem' }}>
                    Cảm thấy khó chịu, nổi mẩn hay buồn nôn sau khi uống thuốc?
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#b91c1c' }}>
                    Gửi phản hồi tác dụng phụ (ADR) trực tiếp đến Dược sĩ lâm sàng để được tư vấn xử trí.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowAdrModal(true)}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.1rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(239, 68, 68, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <span>Báo Cáo Tác Dụng Phụ (ADR)</span>
                <ChevronRight size={15} />
              </button>
            </div>

            {/* 3. Daily Dosage Visual Schedule (Lịch Uống 4 Buổi) */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '1.35rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                <Clock size={20} color="#10b981" /> Lịch Uống Thuốc Trực Quan Trong Ngày
              </h3>
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: '#64748b' }}>
                Phân bổ số lượng từng viên thuốc theo 4 khung giờ trong ngày để tránh quên liều:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
                {/* SÁNG */}
                <div style={{
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '10px',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#d97706', fontSize: '0.9rem', marginBottom: '0.6rem' }}>
                    <span>🌅 BUỔI SÁNG</span>
                  </div>
                  {morningMeds.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Không có thuốc buổi sáng</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {morningMeds.map(m => (
                        <div key={m.prescriptionDetailID} style={{ background: '#ffffff', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #fed7aa', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.medicineName}</div>
                          <div style={{ color: '#ea580c', fontWeight: 800, marginTop: '2px' }}>
                            Uống {m.morningDose} {m.unit}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{m.usageTime}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TRƯA */}
                <div style={{
                  background: 'rgba(234, 88, 12, 0.06)',
                  border: '1px solid rgba(234, 88, 12, 0.25)',
                  borderRadius: '10px',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#ea580c', fontSize: '0.9rem', marginBottom: '0.6rem' }}>
                    <span>☀️ BUỔI TRƯA</span>
                  </div>
                  {noonMeds.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Không có thuốc buổi trưa</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {noonMeds.map(m => (
                        <div key={m.prescriptionDetailID} style={{ background: '#ffffff', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #ffedd5', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.medicineName}</div>
                          <div style={{ color: '#ea580c', fontWeight: 800, marginTop: '2px' }}>
                            Uống {m.noonDose} {m.unit}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{m.usageTime}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CHIỀU */}
                <div style={{
                  background: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '10px',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#2563eb', fontSize: '0.9rem', marginBottom: '0.6rem' }}>
                    <span>🌇 BUỔI CHIỀU</span>
                  </div>
                  {afternoonMeds.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Không có thuốc buổi chiều</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {afternoonMeds.map(m => (
                        <div key={m.prescriptionDetailID} style={{ background: '#ffffff', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.medicineName}</div>
                          <div style={{ color: '#2563eb', fontWeight: 800, marginTop: '2px' }}>
                            Uống {m.afternoonDose} {m.unit}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{m.usageTime}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TỐI */}
                <div style={{
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '10px',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#4f46e5', fontSize: '0.9rem', marginBottom: '0.6rem' }}>
                    <span>🌙 BUỔI TỐI</span>
                  </div>
                  {nightMeds.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Không có thuốc buổi tối</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {nightMeds.map(m => (
                        <div key={m.prescriptionDetailID} style={{ background: '#ffffff', padding: '0.5rem 0.65rem', borderRadius: '6px', border: '1px solid #c7d2fe', fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.medicineName}</div>
                          <div style={{ color: '#4f46e5', fontWeight: 800, marginTop: '2px' }}>
                            Uống {m.nightDose} {m.unit}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{m.usageTime}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Detailed Medication List & Visual Pill Identifier */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '1.35rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                <Pill size={20} color="#10b981" /> Danh Mục Thuốc & Nhận Diện Viên Thuốc
              </h3>
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: '#64748b' }}>
                Chi tiết quy cách, hình dáng viên, tác dụng chính và lưu ý đặc biệt cho từng loại thuốc:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {prescription.medicines?.map((med, idx) => (
                  <div key={med.prescriptionDetailID} style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1rem 1.15rem',
                    background: '#f8fafc',
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '1rem',
                    alignItems: 'flex-start'
                  }}>
                    {/* Visual Pill Badge */}
                    <div style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                      border: '2px solid #a7f3d0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#059669',
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textAlign: 'center',
                      flexShrink: 0
                    }}>
                      <Pill size={22} />
                      <span>#{idx + 1}</span>
                    </div>

                    {/* Drug content */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{med.medicineName}</span>
                          {med.genericName && (
                            <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.5rem' }}>
                              ({med.genericName})
                            </span>
                          )}
                        </div>
                        <span style={{
                          background: '#e0f2fe',
                          color: '#0369a1',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700
                        }}>
                          Số lượng: {med.quantity} {med.unit}
                        </span>
                      </div>

                      {/* Pill features chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.45rem 0' }}>
                        <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.74rem', color: '#334155' }}>
                          🔍 Dạng viên: <strong>{med.pillShape}</strong>
                        </span>
                        <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.74rem', color: '#334155' }}>
                          🎨 Màu sắc: <strong>{med.pillColor}</strong>
                        </span>
                        <span style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.74rem', color: '#059669', fontWeight: 600 }}>
                          🏷️ {med.pillCategory}
                        </span>
                      </div>

                      {/* Dosage instruction */}
                      <div style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600, marginTop: '0.35rem' }}>
                        👉 Cách dùng: <span style={{ color: '#0284c7' }}>{med.dosageInstructions}</span> ({med.usageTime})
                      </div>

                      {/* Pill Special Warning */}
                      {med.pillWarning && (
                        <div style={{
                          marginTop: '0.45rem',
                          fontSize: '0.76rem',
                          color: '#b45309',
                          background: '#fef3c7',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}>
                          <Info size={13} />
                          <span><strong>Lưu ý: </strong>{med.pillWarning}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Critical Pharmacist Precautions & Dietary Restrictions */}
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '1.35rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                <HeartHandshake size={20} color="#10b981" /> Lời Dặn Của Dược Sĩ & Khuyến Cáo Kiêng Cữ
              </h3>
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem', color: '#64748b' }}>
                Tuân thủ những nguyên tắc vàng dưới đây để thuốc phát huy hiệu quả tối đa và tránh tương tác có hại:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '0.85rem', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fef3c7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#b45309', fontSize: '0.86rem', marginBottom: '0.3rem' }}>
                    <Coffee size={16} /> Tránh uống cùng Trà & Cà phê
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#92400e', lineHeight: 1.45 }}>
                    Chất Tanin trong nước chè hoặc Caffein gây tủa, làm mất tác dụng kháng sinh và cản trở hấp thu vi chất.
                  </div>
                </div>

                <div style={{ padding: '0.85rem', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #dcfce7' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#15803d', fontSize: '0.86rem', marginBottom: '0.3rem' }}>
                    <Droplet size={16} /> Tránh Sữa & Nước bưởi chùm
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#166534', lineHeight: 1.45 }}>
                    Canxi trong sữa gây khó hấp thu; nước bưởi ức chế men gan CYP3A4 làm tăng nồng độ thuốc quá mức an toàn.
                  </div>
                </div>

                <div style={{ padding: '0.85rem', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fee2e2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#b91c1c', fontSize: '0.86rem', marginBottom: '0.3rem' }}>
                    <Wine size={16} /> Tuyệt đối kiêng Rượu bia
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#991b1b', lineHeight: 1.45 }}>
                    Rượu bia gây quá tải cho gan, tổn thương niêm mạc dạ dày và có thể kích hoạt sốc tụt huyết áp cấp.
                  </div>
                </div>

                <div style={{ padding: '0.85rem', borderRadius: '10px', background: '#f0f9ff', border: '1px solid #e0f2fe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#0369a1', fontSize: '0.86rem', marginBottom: '0.3rem' }}>
                    <Thermometer size={16} /> Bảo quản thuốc đúng cách
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#075985', lineHeight: 1.45 }}>
                    Để thuốc nơi thoáng mát dưới 30°C, tránh ánh sáng chiếu trực tiếp và luôn để xa tầm với của trẻ nhỏ.
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Hospital Hotline & Emergency Support Box */}
            <div style={{
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '14px',
              padding: '1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Cần Hỗ Trợ Y Tế Khẩn Cấp?
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '2px' }}>
                  Đường Dây Nóng Khoa Dược Bệnh Viện HIS
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                  Hotline Dược: <strong style={{ color: '#38bdf8' }}>(028) 3822 5588</strong> • Cấp cứu 24/7: <strong style={{ color: '#f87171' }}>115 / (028) 3822 9999</strong>
                </div>
              </div>

              <a
                href="tel:02838225588"
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Phone size={16} /> Gọi Tư Vấn Dược Sĩ
              </a>
            </div>

          </div>
        )}

      </main>

      {/* 7. ADR MODAL (Biểu Mẫu Báo Cáo Tác Dụng Phụ Bất Thường) */}
      {showAdrModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <button
              onClick={() => setShowAdrModal(false)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Báo Cáo Phản Ứng Bất Thường (ADR)
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>
              Thông tin của bạn sẽ được gửi thẳng đến màn hình của Dược sĩ bệnh viện để hỗ trợ xử lý kịp thời.
            </p>

            {adrSuccessMsg ? (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center',
                color: '#166534'
              }}>
                <CheckCircle2 size={42} color="#16a34a" style={{ margin: '0 auto 0.75rem auto' }} />
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', fontWeight: 800 }}>Đã Gửi Thành Công!</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {adrSuccessMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handleAdrSubmit}>
                {/* 1. Suspected Medicine */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                    Thuốc nghi ngờ gây phản ứng khó chịu:
                  </label>
                  <select
                    value={adrForm.suspectedMedicineName}
                    onChange={(e) => setAdrForm(prev => ({ ...prev, suspectedMedicineName: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      background: '#ffffff'
                    }}
                  >
                    <option value="Không rõ / Nghi ngờ cả đơn">-- Nghi ngờ cả đơn / Chưa rõ loại nào --</option>
                    {prescription?.medicines?.map(m => (
                      <option key={m.prescriptionDetailID} value={m.medicineName}>
                        {m.medicineName} ({m.genericName || m.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Fast Symptom Checkboxes */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                    Dấu hiệu / Triệu chứng bạn gặp phải (Chọn các triệu chứng đúng):
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[
                      'Nổi mẩn đỏ / Ngứa ngáy',
                      'Phát ban / Mề đay',
                      'Buồn nôn / Nôn mửa',
                      'Đau bụng quặn / Tiêu chảy',
                      'Chóng mặt / Choáng váng',
                      'Sốt nhẹ / Nhức đầu',
                      'Sưng môi / Sưng mí mắt',
                      'Khó thở / Tức ngực (Khẩn)'
                    ].map(sym => {
                      const active = adrForm.selectedSymptoms.includes(sym);
                      const isUrgent = sym.includes('Khó thở');
                      return (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => toggleSymptom(sym)}
                          style={{
                            textAlign: 'left',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: active ? '2px solid #ef4444' : '1px solid #cbd5e1',
                            background: active ? '#fef2f2' : '#ffffff',
                            color: active ? '#991b1b' : '#334155',
                            fontSize: '0.78rem',
                            fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span>{sym}</span>
                          {active && <CheckCircle2 size={13} color="#ef4444" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Severity & Onset Time */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem', color: '#334155' }}>
                      Mức độ khó chịu:
                    </label>
                    <select
                      value={adrForm.severity}
                      onChange={(e) => setAdrForm(prev => ({ ...prev, severity: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.65rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem'
                      }}
                    >
                      <option value="Nhẹ">Nhẹ (Vẫn sinh hoạt bình thường)</option>
                      <option value="Trung bình">Trung bình (Mệt nhiều, khó chịu)</option>
                      <option value="Nghiêm trọng">Nghiêm trọng (Cần hỗ trợ gấp)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem', color: '#334155' }}>
                      Xuất hiện sau khi uống:
                    </label>
                    <select
                      value={adrForm.onsetDelay}
                      onChange={(e) => setAdrForm(prev => ({ ...prev, onsetDelay: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.65rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem'
                      }}
                    >
                      <option value="Dưới 30 phút">Dưới 30 phút</option>
                      <option value="Khoảng 1 - 2 giờ">Khoảng 1 - 2 giờ</option>
                      <option value="Nửa ngày">Nửa ngày</option>
                      <option value="Sau 1 - 2 ngày">Sau 1 - 2 ngày dùng thuốc</option>
                    </select>
                  </div>
                </div>

                {/* 4. Phone Number for Pharmacist Callback */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                    Số điện thoại để Dược sĩ liên hệ tư vấn lại: *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="VD: 0912 345 678"
                    value={adrForm.patientPhone}
                    onChange={(e) => setAdrForm(prev => ({ ...prev, patientPhone: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>

                {/* 5. Free Text Description */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', color: '#334155' }}>
                    Mô tả thêm (nếu có):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Mô tả cụ thể vị trí ngứa, thời điểm uống kèm thức ăn gì..."
                    value={adrForm.description}
                    onChange={(e) => setAdrForm(prev => ({ ...prev, description: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.82rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Modal Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowAdrModal(false)}
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      padding: '0.6rem 1.1rem',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={adrSubmitting}
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.6rem 1.35rem',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                    }}
                  >
                    <Send size={15} />
                    <span>{adrSubmitting ? 'Đang gửi...' : 'Gửi Báo Cáo Tới Dược Sĩ'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
