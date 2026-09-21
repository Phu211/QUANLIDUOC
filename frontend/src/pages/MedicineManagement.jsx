import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, RefreshCw, X, AlertTriangle, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
import { handleIntegerKeyDown, sanitizeInteger, handleIntegerPaste } from '../utils/numberInputUtils';
export default function MedicineManagement({ user }) {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showImportDropdown, setShowImportDropdown] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [currentId, setCurrentId] = useState(null);

  // Form Fields State
  const [itemType, setItemType] = useState('medicine'); // 'medicine' or 'supply'
  const [medicineCode, setMedicineCode] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [specification, setSpecification] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [unit, setUnit] = useState('');
  const [minInventory, setMinInventory] = useState(10);
  const [medicineGroup, setMedicineGroup] = useState('Dược phẩm khác');
  const [priorityLevel, setPriorityLevel] = useState('Low');
  const [drugClassification, setDrugClassification] = useState('Regular'); // 'Regular', 'SpecialAntibiotic', 'NarcoticPsychotropic'

  // Soft delete tab state
  const [catalogTab, setCatalogTab] = useState('active'); // 'active' or 'trash'
  const [trashList, setTrashList] = useState([]);
  const [loadingTrash, setLoadingTrash] = useState(false);

  // Hàm tự động sinh mã số tiếp theo cho Thuốc / Vật tư
  const generateNextCode = (type, currentMedicines = medicines) => {
    const prefix = type === 'medicine' ? 'THUOC-' : 'VATTU-';
    const matchingCodes = currentMedicines
      .map(m => m.medicineCode)
      .filter(code => code && code.startsWith(prefix));

    let maxNum = 0;
    matchingCodes.forEach(code => {
      const numPart = code.substring(prefix.length);
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });

    const nextNum = maxNum + 1;
    const formattedNum = String(nextNum).padStart(4, '0'); // Định dạng dạng 0001, 0002...
    return `${prefix}${formattedNum}`;
  };

  // Thay đổi phân loại (Thuốc hoặc Vật tư) trong Form
  const handleTypeChange = (type) => {
    setItemType(type);
    const nextCode = generateNextCode(type);
    setMedicineCode(nextCode);
  };

  const fetchMedicines = () => {
    setLoading(true);
    fetch(`/api/medicine?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        setMedicines(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading medicines catalog: ", err);
        setLoading(false);
      });
  };

  const fetchTrash = () => {
    setLoadingTrash(true);
    fetch(`/api/medicine/trash?_t=${Date.now()}`, {
      headers: { 'X-User-Role': user?.role || '' }
    })
      .then(res => res.json())
      .then(data => {
        setTrashList(Array.isArray(data) ? data : []);
        setLoadingTrash(false);
      })
      .catch(err => {
        console.error("Error loading trash list: ", err);
        setLoadingTrash(false);
      });
  };

  useEffect(() => {
    if (catalogTab === 'trash') {
      fetchTrash();
    }
  }, [catalogTab]);

  const handleExcelImport = (e, forcedType) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          alert("File Excel trống hoặc không đúng định dạng.");
          return;
        }

        // Map columns dynamically
        let tempMedicines = [...medicines];
        const medicinesList = json.map(row => {
          const getVal = (aliases) => {
            const matchedKey = Object.keys(row).find(k => {
              const cleanKey = k.replace(/\(.*?\)/g, '') // Remove parenthetical notes like (Bắt buộc)
                               .replace(/\r?\n|\r/g, ' ')
                               .replace(/\s+/g, ' ')
                               .toLowerCase()
                               .trim();
              return aliases.some(alias => cleanKey === alias.toLowerCase().trim());
            });
            return matchedKey ? row[matchedKey] : null;
          };

          const name = getVal(['tên thuốc', 'tenthuoc', 'medicinename', 'name', 'tên', 'tên thuốc / vật tư', 'tên thuốc/vật tư', 'tên vật tư', 'tenvattu', 'supplyname']);
          const generic = getVal(['hoạt chất', 'hoatchat', 'genericname', 'hoạt chất chính']);
          const spec = getVal(['quy cách', 'quycach', 'specification']);
          const mfg = getVal(['nhà sản xuất', 'nhasanxuat', 'manufacturer', 'hãng sản xuất']);
          const unit = getVal(['đơn vị tính', 'donvitinh', 'unit', 'đvt', 'đơn vị']);
          const minInvVal = getVal(['định mức tối thiểu', 'dinhmuctoithieu', 'mininventory', 'tồn tối thiểu', 'min']);
          const group = getVal(['nhóm thuốc', 'nhomthuoc', 'medicinegroup', 'group', 'nhóm', 'nhóm vật tư', 'nhomvattu']);
          const priority = getVal(['mức độ ưu tiên', 'prioritylevel', 'ưu tiên', 'priority', 'phân nhóm']);

          const type = forcedType; // 'medicine' or 'supply'

          let code = getVal(['mã thuốc', 'mathuoc', 'medicinecode', 'code', 'mã', 'mã vật tư', 'mavattu']);
          if (!code || !String(code).trim()) {
            code = generateNextCode(type, tempMedicines);
          }

          let mappedPriority = 'Low';
          if (priority) {
            const lowerPrio = String(priority).toLowerCase().trim();
            if (lowerPrio.includes('gây nghiện') || lowerPrio.includes('critical')) {
              mappedPriority = 'Critical';
            } else if (lowerPrio.includes('hướng thần') || lowerPrio.includes('high')) {
              mappedPriority = 'High';
            } else if (lowerPrio.includes('kháng sinh') || lowerPrio.includes('medium')) {
              mappedPriority = 'Medium';
            }
          }

          const newMed = {
            medicineCode: String(code).trim(),
            medicineName: name ? String(name).trim() : '',
            genericName: type === 'supply' ? null : (generic ? String(generic).trim() : null),
            specification: spec ? String(spec).trim() : null,
            manufacturer: mfg ? String(mfg).trim() : null,
            unit: unit ? String(unit).trim() : '',
            minInventory: minInvVal ? parseInt(minInvVal) || 10 : 10,
            medicineGroup: group ? String(group).trim() : (type === 'supply' ? 'Vật tư tiêu hao' : 'Dược phẩm khác'),
            priorityLevel: mappedPriority
          };

          tempMedicines.push(newMed);
          return newMed;
        });

        // Validate required fields (only Name and Unit are now user-mandatory, Code is auto-generated if missing)
        const invalidRows = medicinesList.filter(m => !m.medicineCode || !m.medicineName || !m.unit);
        if (invalidRows.length > 0) {
          const typeLabel = forcedType === 'supply' ? 'Tên vật tư hoặc Đơn vị tính' : 'Tên thuốc hoặc Đơn vị tính';
          alert(`Lỗi dữ liệu: Có ${invalidRows.length} dòng thiếu các cột bắt buộc (${typeLabel}). Vui lòng kiểm tra lại.`);
          return;
        }

        const confirmMsg = forcedType === 'supply' 
          ? `Bạn có chắc chắn muốn nhập ${medicinesList.length} vật tư y tế từ file Excel vào danh mục không?`
          : `Bạn có chắc chắn muốn nhập ${medicinesList.length} thuốc từ file Excel vào danh mục không?`;

        if (window.confirm(confirmMsg)) {
          fetch('/api/medicine/bulk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Role': user?.role || ''
            },
            body: JSON.stringify(medicinesList)
          })
          .then(async res => {
            const text = await res.text();
            if (res.ok) {
              const result = JSON.parse(text);
              alert(result.message || `Đã nhập thành công ${result.importedCount} mục vào danh mục.`);
              fetchMedicines();
            } else {
              let errorMsg = "Lỗi nhập danh mục";
              try {
                const data = JSON.parse(text);
                errorMsg = data.error || data.message || errorMsg;
              } catch (e) {
                errorMsg = text || `Mã lỗi: ${res.status}`;
              }
              alert("Lỗi khi nhập danh mục từ Excel: " + errorMsg);
            }
          })
          .catch(err => alert("Lỗi kết nối API: " + err.message));
        }
      } catch (err) {
        alert("Lỗi khi đọc file Excel: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const downloadExcelTemplate = (templateType) => {
    let data = [];
    let filename = "";

    if (templateType === 'supply') {
      data = [
        {
          "Tên Vật Tư (Bắt buộc)": "Bông y tế tiệt trùng 100g",
          "Quy Cách": "Gói 100g",
          "Đơn Vị Tính (Bắt buộc)": "Gói",
          "Nhà Sản Xuất": "Bông Bạch Tuyết",
          "Tồn Tối Thiểu": 20,
          "Nhóm Vật Tư": "Vật tư tiêu hao",
          "Mức Độ Ưu Tiên (Low/Medium/High/Critical)": "Low"
        },
        {
          "Tên Vật Tư (Bắt buộc)": "Bơm tiêm 5ml dùng 1 lần",
          "Quy Cách": "Cái",
          "Đơn Vị Tính (Bắt buộc)": "Cái",
          "Nhà Sản Xuất": "Vinahankook",
          "Tồn Tối Thiểu": 50,
          "Nhóm Vật Tư": "Vật tư can thiệp",
          "Mức Độ Ưu Tiên (Low/Medium/High/Critical)": "Low"
        }
      ];
      filename = "mau_nhap_danh_muc_vat_tu.xlsx";
    } else {
      data = [
        {
          "Tên Thuốc (Bắt buộc)": "Paracetamol 500mg",
          "Hoạt Chất": "Paracetamol",
          "Quy Cách": "Hộp 10 vỉ x 10 viên",
          "Đơn Vị Tính (Bắt buộc)": "Viên",
          "Nhà Sản Xuất": "Dược Hậu Giang (DHG)",
          "Tồn Tối Thiểu": 100,
          "Nhóm Thuốc": "Thuốc giảm đau, hạ sốt",
          "Mức Độ Ưu Tiên (Low/Medium/High/Critical)": "Low"
        },
        {
          "Tên Thuốc (Bắt buộc)": "Cefixim 200mg",
          "Hoạt Chất": "Cefixim",
          "Quy Cách": "Hộp 2 vỉ x 10 viên",
          "Đơn Vị Tính (Bắt buộc)": "Viên",
          "Nhà Sản Xuất": "DHG Pharma",
          "Tồn Tối Thiểu": 40,
          "Nhóm Thuốc": "Kháng sinh",
          "Mức Độ Ưu Tiên (Low/Medium/High/Critical)": "Medium"
        },
        {
          "Tên Thuốc (Bắt buộc)": "Morphin HCL 10mg/ml",
          "Hoạt Chất": "Morphin",
          "Quy Cách": "Ống 1ml",
          "Đơn Vị Tính (Bắt buộc)": "Ống",
          "Nhà Sản Xuất": "Dược Trung Ương",
          "Tồn Tối Thiểu": 50,
          "Nhóm Thuốc": "Thuốc giảm đau",
          "Mức Độ Ưu Tiên (Low/Medium/High/Critical)": "Critical"
        }
      ];
      filename = "mau_nhap_danh_muc_thuoc.xlsx";
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, templateType === 'supply' ? "Vật tư mẫu" : "Thuốc mẫu");
    XLSX.writeFile(workbook, filename);
  };

  const handleExportMedicines = () => {
    if (!medicines || medicines.length === 0) {
      alert("Không có danh mục để xuất báo cáo.");
      return;
    }
    const data = medicines.map(m => ({
      "Mã thuốc/vật tư": m.medicineCode,
      "Tên thuốc/vật tư": m.medicineName,
      "Hoạt chất/Tên gốc": m.genericName || '',
      "Quy cách": m.specification || '',
      "Đơn vị tính": m.unit,
      "Nhà sản xuất": m.manufacturer || '',
      "Tồn tối thiểu": m.minInventory,
      "Nhóm phân loại": m.medicineGroup || '',
      "Mức độ ưu tiên": m.priorityLevel === 'Low' ? 'Thấp' : m.priorityLevel === 'Medium' ? 'Trung bình' : m.priorityLevel === 'High' ? 'Cao' : 'Khẩn cấp'
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Danh mục");
    XLSX.writeFile(workbook, `Danh_muc_thuoc_vat_tu_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  useEffect(() => {
    fetchMedicines();

    const handleUpdate = (e) => {
      if (e.detail === 'Inventory') {
        fetchMedicines();
      }
    };
    window.addEventListener('pharmacy-update', handleUpdate);
    return () => window.removeEventListener('pharmacy-update', handleUpdate);
  }, []);

  const handleOpenAddModal = () => {
    setModalMode('add');
    setCurrentId(null);
    
    // Mặc định phân loại là Thuốc và tự sinh mã tương ứng
    const defaultType = 'medicine';
    setItemType(defaultType);
    const nextCode = generateNextCode(defaultType);
    
    setMedicineCode(nextCode);
    setMedicineName('');
    setGenericName('');
    setSpecification('');
    setManufacturer('');
    setUnit('');
    setMinInventory(10);
    setMedicineGroup('Dược phẩm khác');
    setPriorityLevel('Low');
    setDrugClassification('Regular');
    setShowModal(true);
  };

  const handleOpenEditModal = (med) => {
    setModalMode('edit');
    setCurrentId(med.medicineID);
    
    // Tự động nhận diện phân loại dựa trên tiền tố của mã sẵn có
    const isSupply = med.medicineCode && med.medicineCode.startsWith('VATTU-');
    setItemType(isSupply ? 'supply' : 'medicine');
    
    setMedicineCode(med.medicineCode);
    setMedicineName(med.medicineName);
    setGenericName(med.genericName || '');
    setSpecification(med.specification || '');
    setManufacturer(med.manufacturer || '');
    setUnit(med.unit);
    setMinInventory(med.minInventory);
    setMedicineGroup(med.medicineGroup || 'Dược phẩm khác');
    setPriorityLevel(med.priorityLevel || 'Low');
    setDrugClassification(med.drugClassification || 'Regular');
    setShowModal(true);
  };

  const handleDeleteMedicine = (id, code, name) => {
    if (window.confirm(`XÁC NHẬN XÓA MỀM (SOFT DELETE):\n\nBạn có chắc chắn muốn xóa thuốc "${name}" (${code}) khỏi danh mục?\n\n* Lưu ý chuẩn y tế HIS: Thuốc sẽ được chuyển vào "Thùng rác danh mục" và ẩn khỏi danh sách kê đơn/cấp phát, nhưng toàn bộ lịch sử xuất/nhập và tồn kho trong quá khứ vẫn được bảo toàn toàn vẹn!`)) {
      fetch(`/api/medicine/${id}`, {
        method: 'DELETE',
        headers: { 'X-User-Role': user?.role || '' }
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || "Không thể xóa thuốc"); });
        }
        return res.json();
      })
      .then(data => {
        alert(data.message || "Đã xóa mềm thuốc thành công!");
        fetchMedicines();
        if (catalogTab === 'trash') fetchTrash();
      })
      .catch(err => {
        alert("Lỗi: " + err.message);
      });
    }
  };

  const handleRestoreMedicine = (id, code, name) => {
    if (window.confirm(`Khôi phục thuốc "${name}" (${code}) trở lại danh mục hoạt động?`)) {
      fetch(`/api/medicine/${id}/restore`, {
        method: 'POST',
        headers: { 'X-User-Role': user?.role || '' }
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || "Không thể khôi phục thuốc"); });
        }
        return res.json();
      })
      .then(data => {
        alert(data.message || "Khôi phục thuốc thành công!");
        fetchTrash();
        fetchMedicines();
      })
      .catch(err => {
        alert("Lỗi: " + err.message);
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!medicineCode.trim()) return alert("Vui lòng điền mã thuốc.");
    if (!medicineName.trim()) return alert("Vui lòng điền tên thuốc.");
    if (!unit.trim()) return alert("Vui lòng điền đơn vị tính.");

    const payload = {
      medicineCode: medicineCode.trim(),
      medicineName: medicineName.trim(),
      genericName: genericName.trim() || null,
      specification: specification.trim() || null,
      manufacturer: manufacturer.trim() || null,
      unit: unit.trim(),
      minInventory: parseInt(minInventory) || 0,
      medicineGroup: medicineGroup,
      priorityLevel: priorityLevel,
      drugClassification: drugClassification
    };

    const url = modalMode === 'add' ? '/api/medicine' : `/api/medicine/${currentId}`;
    const method = modalMode === 'add' ? 'POST' : 'PUT';

    fetch(url, {
      method: method,
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || ''
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(data => { throw new Error(data.error || "Lỗi lưu thông tin thuốc"); });
      }
      return res.json();
    })
    .then(() => {
      alert(modalMode === 'add' ? "Thêm thuốc mới vào danh mục thành công!" : "Cập nhật thông tin thuốc thành công!");
      setShowModal(false);
      fetchMedicines();
    })
    .catch(err => {
      alert("Lỗi: " + err.message);
    });
  };

  const getGroupBadge = (group) => {
    const styles = {
      'Kháng sinh': { bg: 'var(--color-success-light)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)' },
      'Giảm đau & Hạ sốt': { bg: 'var(--color-primary-light)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.25)' },
      'Vitamin & Bổ trợ': { bg: 'var(--color-warning-light)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.25)' },
      'Dược phẩm khác': { bg: 'var(--bg-content)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }
    };
    const style = styles[group] || styles['Dược phẩm khác'];
    return (
      <span style={{ 
        padding: '0.2rem 0.55rem', 
        borderRadius: '6px', 
        fontSize: '0.75rem', 
        fontWeight: '600',
        display: 'inline-block',
        background: style.bg,
        color: style.color,
        border: style.border
      }}>
        {group || 'Dược phẩm khác'}
      </span>
    );
  };

  const filteredMedicines = medicines.filter(med => 
    med.medicineCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    med.medicineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (med.genericName && med.genericName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (med.manufacturer && med.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (med.medicineGroup && med.medicineGroup.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh', color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw className="nav-icon" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem', width: '30px', height: '30px' }} />
          <p>Đang tải danh mục thuốc...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Quản Lý Danh Mục Thuốc</h1>
          <p className="page-subtitle">Cấu hình danh mục các loại dược phẩm, vật tư y tế được cấp phát trong hệ thống.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.6rem', fontSize: '0.8rem', height: '36px' }} onClick={fetchMedicines}>
            <RefreshCw size={14} /> Làm mới
          </button>

          {/* Dropdown Tải file mẫu */}
          <div style={{ position: 'relative' }}>
            <button 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.6rem', fontSize: '0.8rem', height: '36px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.2)' }}
              onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
              title="Tải file Excel mẫu"
            >
              Tải file mẫu <span style={{ fontSize: '0.65rem' }}>▼</span>
            </button>
            {showTemplateDropdown && (
              <div style={{ 
                position: 'absolute', 
                top: '40px', 
                left: 0, 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                boxShadow: 'var(--shadow-md)', 
                zIndex: 100, 
                width: '180px',
                padding: '4px'
              }}>
                <button 
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8rem', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}
                  onClick={() => {
                    downloadExcelTemplate('medicine');
                    setShowTemplateDropdown(false);
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  File mẫu Thuốc
                </button>
                <button 
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8rem', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}
                  onClick={() => {
                    downloadExcelTemplate('supply');
                    setShowTemplateDropdown(false);
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  File mẫu Vật tư
                </button>
              </div>
            )}
          </div>
          
          {/* Nhập từ Excel Dropdown */}
          <input 
            type="file" 
            id="excel-import-medicine" 
            accept=".xlsx, .xls" 
            style={{ display: 'none' }} 
            onChange={(e) => handleExcelImport(e, 'medicine')} 
          />
          <input 
            type="file" 
            id="excel-import-supply" 
            accept=".xlsx, .xls" 
            style={{ display: 'none' }} 
            onChange={(e) => handleExcelImport(e, 'supply')} 
          />
          <div style={{ position: 'relative' }}>
            <button 
              className="btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.6rem', fontSize: '0.8rem', height: '36px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}
              onClick={() => setShowImportDropdown(!showImportDropdown)}
              title="Nhập danh mục từ tệp Excel"
            >
              Nhập từ Excel <span style={{ fontSize: '0.65rem' }}>▼</span>
            </button>
            {showImportDropdown && (
              <div style={{ 
                position: 'absolute', 
                top: '40px', 
                left: 0, 
                background: 'var(--bg-secondary)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px', 
                boxShadow: 'var(--shadow-md)', 
                zIndex: 100, 
                width: '180px',
                padding: '4px'
              }}>
                <button 
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8rem', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}
                  onClick={() => {
                    document.getElementById('excel-import-medicine').click();
                    setShowImportDropdown(false);
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  Nhập danh mục Thuốc
                </button>
                <button 
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.8rem', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}
                  onClick={() => {
                    document.getElementById('excel-import-supply').click();
                    setShowImportDropdown(false);
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  Nhập danh mục Vật tư
                </button>
              </div>
            )}
          </div>

          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.6rem', fontSize: '0.8rem', height: '36px' }} onClick={handleExportMedicines}>
            Xuất báo cáo
          </button>

          <button className="btn-premium" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: '36px' }} onClick={handleOpenAddModal}>
            <Plus size={14} /> Khai báo mới
          </button>
        </div>
      </div>

      {/* Tab Switcher: Active Catalog vs Soft-Deleted Trash */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setCatalogTab('active')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: catalogTab === 'active' ? 'var(--color-primary)' : 'var(--bg-secondary)',
            color: catalogTab === 'active' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <Layers size={16} /> Danh Mục Đang Hoạt Động ({medicines.length})
        </button>
        {user?.role === 'director' && (
          <button
            onClick={() => setCatalogTab('trash')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: catalogTab === 'trash' ? '#dc2626' : 'var(--bg-secondary)',
              color: catalogTab === 'trash' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <Trash2 size={16} /> Thùng Rác Danh Mục (Xóa Mềm) {trashList.length > 0 && `(${trashList.length})`}
          </button>
        )}
      </div>

      {/* Control bar */}
      <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: catalogTab === 'trash' ? '#dc2626' : 'var(--color-primary)' }}>
          <Layers size={18} /> {catalogTab === 'trash' ? `Thùng rác: ${trashList.length} thuốc đã xóa mềm (Bảo tồn lịch sử HIS)` : `Tổng số: ${filteredMedicines.length} thuốc / vật tư hoạt động`}
        </h3>
        
        {/* Styled search input to match light theme */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '8px', 
          padding: '0.4rem 0.8rem', 
          width: '320px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <Search size={16} color="var(--text-dim)" style={{ marginRight: '0.5rem' }} />
          <input 
            type="text" 
            placeholder="Tìm theo tên thuốc, mã, hoạt chất..." 
            style={{ 
              border: 'none', 
              background: 'none', 
              padding: 0, 
              fontSize: '0.85rem', 
              outline: 'none', 
              color: 'var(--text-main)',
              width: '100%'
            }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Medicine list table */}
      <div className="glass-card">
        {catalogTab === 'trash' ? (
          <div className="table-container">
            {loadingTrash ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Đang tải thùng rác...</p>
            ) : trashList.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Thùng rác trống. Không có thuốc nào đang ở trạng thái xóa mềm.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Mã Thuốc</th>
                    <th>Tên Thuốc / Hoạt Chất</th>
                    <th>Nhóm Thuốc</th>
                    <th>ĐVT</th>
                    <th>Thời Gian Xóa Mềm</th>
                    <th style={{ width: '150px', textAlign: 'center' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {trashList.map(med => (
                    <tr key={med.medicineID} style={{ opacity: 0.9 }}>
                      <td><strong>{med.medicineCode}</strong></td>
                      <td>
                        <strong>{med.medicineName}</strong>
                        {med.genericName && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{med.genericName}</div>}
                      </td>
                      <td>{getGroupBadge(med.medicineGroup)}</td>
                      <td><span style={{ background: 'rgba(13,148,136,0.06)', color: 'var(--color-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500' }}>{med.unit}</span></td>
                      <td style={{ color: '#dc2626', fontSize: '0.85rem' }}>
                        {med.deletedAt ? new Date(med.deletedAt).toLocaleString('vi-VN') : 'Đã xóa'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#059669', borderColor: '#059669', background: 'rgba(5, 150, 105, 0.08)' }}
                          onClick={() => handleRestoreMedicine(med.medicineID, med.medicineCode, med.medicineName)}
                        >
                          <RefreshCw size={12} /> Khôi phục
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="table-container">
            {filteredMedicines.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Không tìm thấy thuốc nào khớp với từ khóa tìm kiếm.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '120px' }}>Mã Thuốc</th>
                    <th>Tên Thuốc / Hoạt Chất</th>
                    <th style={{ width: '150px' }}>Nhóm Thuốc</th>
                    <th>Quy Cách</th>
                    <th>ĐVT</th>
                    <th>Hãng sản xuất</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Tồn tối thiểu</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map(med => (
                    <tr key={med.medicineID}>
                      <td><strong>{med.medicineCode}</strong></td>
                      <td>
                        <div>
                          <strong>{med.medicineName}</strong>
                          {med.priorityLevel && med.priorityLevel !== 'Low' && (
                            <span style={{ 
                              marginLeft: '0.5rem',
                              fontSize: '0.7rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: '700',
                              background: med.priorityLevel === 'Critical' ? 'var(--color-danger-light)' : med.priorityLevel === 'High' ? 'var(--color-accent-light)' : 'var(--color-primary-light)',
                              color: med.priorityLevel === 'Critical' ? '#dc2626' : med.priorityLevel === 'High' ? '#7c3aed' : '#0284c7',
                              border: '1px solid ' + (med.priorityLevel === 'Critical' ? 'rgba(239, 68, 68, 0.3)' : med.priorityLevel === 'High' ? 'rgba(124, 58, 237, 0.3)' : 'rgba(2, 132, 199, 0.3)')
                            }}>
                              {med.priorityLevel === 'Critical' ? 'Gây nghiện' : med.priorityLevel === 'High' ? 'Hướng thần' : 'Kháng sinh'}
                            </span>
                          )}
                          {med.drugClassification === 'NarcoticPsychotropic' && (
                            <div style={{ marginTop: '0.2rem' }}>
                              <span style={{ 
                                fontSize: '0.68rem',
                                padding: '0.12rem 0.4rem',
                                borderRadius: '4px',
                                fontWeight: '700',
                                background: 'rgba(124, 58, 237, 0.12)',
                                color: '#7c3aed',
                                border: '1px solid rgba(124, 58, 237, 0.3)'
                              }}>
                                🚨 Hướng thần / Gây nghiện (Kiểm soát 2 bước)
                              </span>
                            </div>
                          )}
                          {med.drugClassification === 'SpecialAntibiotic' && (
                            <div style={{ marginTop: '0.2rem' }}>
                              <span style={{ 
                                fontSize: '0.68rem',
                                padding: '0.12rem 0.4rem',
                                borderRadius: '4px',
                                fontWeight: '700',
                                background: 'rgba(2, 132, 199, 0.12)',
                                color: '#0284c7',
                                border: '1px solid rgba(2, 132, 199, 0.3)'
                              }}>
                                💊 Kháng sinh kiểm soát đặc biệt
                              </span>
                            </div>
                          )}
                        </div>
                        {med.genericName && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{med.genericName}</div>
                        )}
                      </td>
                      <td>{getGroupBadge(med.medicineGroup)}</td>
                      <td>{med.specification || '-'}</td>
                      <td><span style={{ background: 'rgba(13,148,136,0.06)', color: 'var(--color-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '500' }}>{med.unit}</span></td>
                      <td>{med.manufacturer || '-'}</td>
                      <td style={{ textAlign: 'center' }}>{med.minInventory}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => handleOpenEditModal(med)}
                          >
                            <Edit2 size={12} /> Sửa
                          </button>
                          {user?.role === 'director' && (
                            <button 
                              className="btn-danger" 
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              onClick={() => handleDeleteMedicine(med.medicineID, med.medicineCode, med.medicineName)}
                              title="Chỉ Ban Giám Đốc mới có thẩm quyền xóa thuốc khỏi danh mục bệnh viện"
                            >
                              <Trash2 size={12} /> Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* CRUD MODAL FOR ADD/EDIT */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', width: '95%', padding: '1.75rem' }}>
            <button 
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setShowModal(false)}
            >
              <X size={24} />
            </button>

            <h3 style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {modalMode === 'add' ? 'Khai Báo Dược Phẩm Mới' : 'Cập Nhật Thông Tin Dược Phẩm'}
            </h3>

            <form onSubmit={handleSubmit}>
              {/* Phân loại và Tự động sinh mã */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '0.4rem' }}>Phân loại đối tượng (*)</label>
                <div style={{ display: 'flex', gap: '2rem', marginTop: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: modalMode === 'edit' ? 'not-allowed' : 'pointer', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                    <input 
                      type="radio" 
                      name="itemType" 
                      value="medicine" 
                      checked={itemType === 'medicine'} 
                      onChange={() => handleTypeChange('medicine')}
                      disabled={modalMode === 'edit'}
                      style={{ accentColor: 'var(--color-primary)', cursor: modalMode === 'edit' ? 'not-allowed' : 'pointer' }}
                    />
                    Thuốc y tế (Mã tự sinh: THUOC-xxxx)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: modalMode === 'edit' ? 'not-allowed' : 'pointer', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                    <input 
                      type="radio" 
                      name="itemType" 
                      value="supply" 
                      checked={itemType === 'supply'} 
                      onChange={() => handleTypeChange('supply')}
                      disabled={modalMode === 'edit'}
                      style={{ accentColor: 'var(--color-primary)', cursor: modalMode === 'edit' ? 'not-allowed' : 'pointer' }}
                    />
                    Vật tư y tế (Mã tự sinh: VATTU-xxxx)
                  </label>
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Mã Thuốc / Vật Tư (Tự động sinh)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={medicineCode} 
                    readOnly
                    required
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.04)', 
                      cursor: 'not-allowed', 
                      color: 'var(--text-muted)', 
                      fontWeight: '600',
                      border: '1px solid var(--border-glass)'
                    }}
                    title="Mã này được hệ thống tự động sinh và không cho phép chỉnh sửa thủ công"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Đơn vị tính (*)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="VD: Viên, Vỉ, Lọ, Gói, Cái, Bộ..." 
                    value={unit} 
                    onChange={e => setUnit(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Tên Thuốc / Hóa Chất / Vật Tư (*)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="VD: Vitamin B1 250mg" 
                    value={medicineName} 
                    onChange={e => setMedicineName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tên gốc / Hoạt chất chính</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="VD: Thiamine" 
                    value={genericName} 
                    onChange={e => setGenericName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Nhóm phân loại thuốc (*)</label>
                  <select 
                    className="form-input"
                    value={medicineGroup}
                    onChange={e => setMedicineGroup(e.target.value)}
                    required
                    style={{ height: '38px', fontSize: '0.85rem' }}
                  >
                    <option value="Kháng sinh">Kháng sinh</option>
                    <option value="Giảm đau & Hạ sốt">Giảm đau & Hạ sốt</option>
                    <option value="Vitamin & Bổ trợ">Vitamin & Bổ trợ</option>
                    <option value="Dược phẩm khác">Dược phẩm khác</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Mức độ ưu tiên / Cảnh báo lâm sàng (*)</label>
                  <select 
                    className="form-input"
                    value={priorityLevel}
                    onChange={e => setPriorityLevel(e.target.value)}
                    required
                    style={{ height: '38px', fontSize: '0.85rem' }}
                  >
                    <option value="Low">Low (Thông thường)</option>
                    <option value="Medium">Medium (Kháng sinh)</option>
                    <option value="High">High (Thuốc hướng thần)</option>
                    <option value="Critical">Critical (Thuốc gây nghiện)</option>
                  </select>
                </div>
              </div>

              {/* Phân nhóm kiểm soát & FEFO */}
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ fontWeight: '600' }}>Phân nhóm kiểm soát theo Thông tư BYT & Quy chế FEFO (*)</label>
                <select 
                  className="form-input"
                  value={drugClassification}
                  onChange={e => setDrugClassification(e.target.value)}
                  required
                  style={{ height: '38px', fontSize: '0.85rem' }}
                >
                  <option value="Regular">Thuốc thường quy (Cấp phát FEFO tiêu chuẩn)</option>
                  <option value="SpecialAntibiotic">Kháng sinh kiểm soát đặc biệt (Hạn chế đề kháng, giám sát lâm sàng)</option>
                  <option value="NarcoticPsychotropic">Thuốc Hướng thần / Gây nghiện (Cấm bù tự động tủ trực, 2 bước ký duyệt xuất/nhận)</option>
                </select>
              </div>

              <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Quy cách đóng gói</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="VD: Hộp 10 vỉ x 10 viên" 
                    value={specification} 
                    onChange={e => setSpecification(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hãng sản xuất</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="VD: Mekophar" 
                    value={manufacturer} 
                    onChange={e => setManufacturer(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Mức cảnh báo tồn tối thiểu (Min inventory)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="form-input" 
                  placeholder="VD: 10"
                  value={minInventory} 
                  onKeyDown={handleIntegerKeyDown}
                  onChange={e => setMinInventory(sanitizeInteger(e.target.value, true))}
                  onPaste={e => handleIntegerPaste(e, val => setMinInventory(val), true)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Hủy bỏ</button>
                <button type="submit" className="btn-premium">
                  {modalMode === 'add' ? 'Khai báo mới' : 'Lưu cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
