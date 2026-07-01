import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, RefreshCw, X, AlertTriangle, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
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

          const type = forcedType; // 'medicine' or 'supply'

          let code = getVal(['mã thuốc', 'mathuoc', 'medicinecode', 'code', 'mã', 'mã vật tư', 'mavattu']);
          if (!code || !String(code).trim()) {
            code = generateNextCode(type, tempMedicines);
          }

          const newMed = {
            medicineCode: String(code).trim(),
            medicineName: name ? String(name).trim() : '',
            genericName: type === 'supply' ? null : (generic ? String(generic).trim() : null),
            specification: spec ? String(spec).trim() : null,
            manufacturer: mfg ? String(mfg).trim() : null,
            unit: unit ? String(unit).trim() : '',
            minInventory: minInvVal ? parseInt(minInvVal) || 10 : 10,
            medicineGroup: group ? String(group).trim() : (type === 'supply' ? 'Vật tư tiêu hao' : 'Dược phẩm khác')
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
          "Nhóm Vật Tư": "Vật tư tiêu hao"
        },
        {
          "Tên Vật Tư (Bắt buộc)": "Bơm tiêm 5ml dùng 1 lần",
          "Quy Cách": "Cái",
          "Đơn Vị Tính (Bắt buộc)": "Cái",
          "Nhà Sản Xuất": "Vinahankook",
          "Tồn Tối Thiểu": 50,
          "Nhóm Vật Tư": "Vật tư can thiệp"
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
          "Nhóm Thuốc": "Thuốc giảm đau, hạ sốt"
        },
        {
          "Tên Thuốc (Bắt buộc)": "Cefixim 200mg",
          "Hoạt Chất": "Cefixim",
          "Quy Cách": "Hộp 2 vỉ x 10 viên",
          "Đơn Vị Tính (Bắt buộc)": "Viên",
          "Nhà Sản Xuất": "DHG Pharma",
          "Tồn Tối Thiểu": 40,
          "Nhóm Thuốc": "Kháng sinh"
        }
      ];
      filename = "mau_nhap_danh_muc_thuoc.xlsx";
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, templateType === 'supply' ? "Vật tư mẫu" : "Thuốc mẫu");
    XLSX.writeFile(workbook, filename);
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
    setShowModal(true);
  };

  const handleDeleteMedicine = (id, code, name) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa thuốc "${name}" (${code}) khỏi danh mục không?`)) {
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
      .then(() => {
        alert("Xóa khỏi danh mục thuốc thành công!");
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
      medicineGroup: medicineGroup
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
      'Kháng sinh': { bg: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' },
      'Giảm đau & Hạ sốt': { bg: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' },
      'Vitamin & Bổ trợ': { bg: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' },
      'Dược phẩm khác': { bg: 'rgba(107, 114, 128, 0.08)', color: '#6b7280', border: '1px solid rgba(107, 114, 128, 0.2)' }
    };
    const style = styles[group] || styles['Dược phẩm khác'];
    return (
      <span style={{ 
        padding: '0.2rem 0.5rem', 
        borderRadius: '6px', 
        fontSize: '0.78rem', 
        fontWeight: '600',
        display: 'inline-block',
        ...style 
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
                background: '#ffffff', 
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
                background: '#ffffff', 
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

          <button className="btn-premium" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: '36px' }} onClick={handleOpenAddModal}>
            <Plus size={14} /> Khai báo mới
          </button>
        </div>
      </div>

      {/* Control bar */}
      <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
          <Layers size={18} /> Tổng số: {filteredMedicines.length} thuốc / vật tư
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
                      <div><strong>{med.medicineName}</strong></div>
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
                        <button 
                          className="btn-danger" 
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => handleDeleteMedicine(med.medicineID, med.medicineCode, med.medicineName)}
                        >
                          <Trash2 size={12} /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CRUD MODAL FOR ADD/EDIT */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
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
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
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

              <div className="form-row">
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

              <div className="form-group" style={{ marginBottom: '1rem' }}>
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

              <div className="form-row">
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

              <div className="form-group">
                <label className="form-label">Mức cảnh báo tồn tối thiểu (Min inventory)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  min="0"
                  value={minInventory} 
                  onChange={e => setMinInventory(e.target.value)}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Hệ thống sẽ hiện cảnh báo khi tổng tồn kho chẵn + lẻ rơi xuống dưới mức này.</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
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
