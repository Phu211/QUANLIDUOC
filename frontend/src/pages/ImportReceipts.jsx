import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash, FileText, Printer, Check, X, RefreshCw,
  FileSpreadsheet, AlertTriangle, Building2, User, FileEdit,
  ArrowRight, ArrowLeft, Upload, Eye, Download, Image,
  FileCheck, ShieldAlert, AlertCircle, Layers, PenTool, Eraser, ThumbsUp
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ImportReceipts({ user }) {
  const [imports, setImports] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form Base State
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [createdBy, setCreatedBy] = useState(user?.fullName || 'Thủ kho Dược');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ medicineID: '', batchNumber: '', productionDate: '', expiryDate: '', importPrice: '', quantity: '' }]);

  // SOP Stepper & WMS Extensions
  const [activeStep, setActiveStep] = useState(1);
  const [invoiceDate, setInvoiceDate] = useState('');
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [secondInspector, setSecondInspector] = useState('');
  const [anomalyDescription, setAnomalyDescription] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState([]); // Array of { type, name, base64 }
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Cấu hình dịch vụ lưu trữ đám mây Cloudinary
  const CLOUDINARY_CONFIG = {
    cloudName: 'drxeoxtok', // Thay thế bằng Cloud Name của bạn
    uploadPreset: 'his_preset' // Thay thế bằng Upload Preset (Unsigned) của bạn
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'Lỗi tải lên.');
    }

    const data = await response.json();
    return data.secure_url;
  };
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [anomalyStatus, setAnomalyStatus] = useState('Từ chối');

  // GSP State Progression Extensions
  const [inspectingReceiptId, setInspectingReceiptId] = useState(null);
  const [inspectingReceiptCode, setInspectingReceiptCode] = useState('');
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [editingReceiptCode, setEditingReceiptCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitRef = useRef(false);

  // Digital Signature States
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState(null); // { saveAsDraft }
  const canvasRef1 = useRef(null);
  const canvasRef2 = useRef(null);
  const canvasRef3 = useRef(null);
  const canvasRef4 = useRef(null);

  // Dossier Viewer States
  const [activeReceiptForDossier, setActiveReceiptForDossier] = useState(null);
  const [activeDossierIndex, setActiveDossierIndex] = useState(0);

  // SOP Checklist Gates
  const [checkInvoiceMatches, setCheckInvoiceMatches] = useState(false);
  const [checkTempHumidity, setCheckTempHumidity] = useState(false);
  const [checkDeliveryRecordSigned, setCheckDeliveryRecordSigned] = useState(false); // Biên bản giao nhận
  const [checkDeliverySlipUploaded, setCheckDeliverySlipUploaded] = useState(false); // Phiếu xuất kho
  const [checkContractUploaded, setCheckContractUploaded] = useState(false); // Hợp đồng thầu
  const [checkPackagingIntact, setCheckPackagingIntact] = useState(false);
  const [checkLabelingClear, setCheckLabelingClear] = useState(false);
  const [checkSensoryOk, setCheckSensoryOk] = useState(false);

  // Print Mode State
  const [activeReceiptForPrint, setActiveReceiptForPrint] = useState(null);

  // Filter state for receipts list
  const [filterStatus, setFilterStatus] = useState(user?.role === 'director' ? 'pending_approval' : 'all');

  // Add Supplier Modal State
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierContractNumber, setNewSupplierContractNumber] = useState('');

  // 1. Tải file mẫu nhập kho Excel nâng cấp
  const handleDownloadTemplate = () => {
    const headers = [
      ["Số hợp đồng", "Số hóa đơn", "Nhà cung cấp", "Trạng thái", "Người kiểm nhập", "Ghi chú", "Mã thuốc", "Tên thuốc (Để tham khảo)", "Số lô", "Ngày sản xuất (DD/MM/YYYY)", "Hạn dùng (DD/MM/YYYY)", "Đơn giá nhập (VND)", "Số lượng"]
    ];

    const sampleRows = [];
    const defaultSupplier = suppliers[0]?.supplierName || "Công ty Dược phẩm Trung ương 1";
    const defaultInvoice = "00012345";
    const defaultContract = "HĐ-025/2026";
    const defaultStatus = "Đạt kiểm nhập";
    const defaultUser = user?.fullName || "Dược sĩ Nguyễn Văn Khoa";
    const defaultNotes = "Nhập kho đầy đủ chất lượng cảm quan tốt";

    if (medicines.length > 0) {
      medicines.slice(0, 5).forEach((m, idx) => {
        sampleRows.push([
          defaultContract,
          defaultInvoice,
          defaultSupplier,
          defaultStatus,
          defaultUser,
          defaultNotes,
          m.medicineCode,
          m.medicineName,
          `LO-HIENAI0${idx + 1}`,
          new Date().toLocaleDateString('vi-VN'), // Today
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN'), // 1 year from now
          (10000 + idx * 5000).toString(),
          "100"
        ]);
      });
    } else {
      sampleRows.push([
        defaultContract,
        defaultInvoice,
        defaultSupplier,
        defaultStatus,
        defaultUser,
        defaultNotes,
        "MED-SAMPLE",
        "Tên thuốc mẫu (Hãy thêm thuốc trong Danh mục trước)",
        "LO-SAMPLE01",
        "24/06/2026",
        "31/12/2027",
        "15000",
        "500"
      ]);
    }

    const wsData = [...headers, ...sampleRows];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 15 }, // Số hợp đồng
      { wch: 15 }, // Số hóa đơn
      { wch: 30 }, // Nhà cung cấp
      { wch: 15 }, // Trạng thái
      { wch: 25 }, // Người kiểm nhập
      { wch: 30 }, // Ghi chú
      { wch: 15 }, // Mã thuốc
      { wch: 40 }, // Tên thuốc
      { wch: 15 }, // Số lô
      { wch: 18 }, // Ngày sản xuất
      { wch: 18 }, // Hạn dùng
      { wch: 20 }, // Đơn giá nhập
      { wch: 12 }  // Số lượng
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_Kho");
    XLSX.writeFile(wb, "Mau_Nhap_Kho_Nang_Cap_HIS.xlsx");
  };

  // 2. Xử lý tải lên và phân tích file Excel
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          alert("Tập tin Excel trống hoặc không đúng định dạng.");
          return;
        }

        const parsedItems = [];
        const errors = [];
        let extInvoiceNumber = '';
        let extContractNumber = '';
        let extSupplierName = '';
        let extStatus = '';
        let extNotes = '';

        jsonData.forEach((row, index) => {
          const rowNum = index + 2;

          const getValue = (keys) => {
            const foundKey = Object.keys(row).find(k =>
              keys.some(key => k.toLowerCase().replace(/\s+/g, '').replace(/[^\w\s]/gi, '').includes(key))
            );
            return foundKey ? row[foundKey] : '';
          };

          if (index === 0) {
            extInvoiceNumber = getValue(['sohoadon', 'invoicenumber', 'invoice', 'sochungtu']);
            extContractNumber = getValue(['sohopdong', 'contractnumber', 'contract', 'hopdong']);
            extSupplierName = getValue(['nhacungcap', 'suppliername', 'supplier', 'tennhacungcap']);
            extStatus = getValue(['trangthai', 'status', 'kiemnhap']);
            extNotes = getValue(['ghichu', 'notes', 'note']);
          }

          const medCode = getValue(['mathuoc', 'medicinecode', 'code']);
          const medName = getValue(['tenthuoc', 'medicinename', 'name']);
          const batchNumber = getValue(['solo', 'batchnumber', 'lot', 'batch']);
          const prodDateRaw = getValue(['ngaysanxuat', 'productiondate', 'mfgdate', 'nsx']);
          const expiryDateRaw = getValue(['handung', 'expirydate', 'expiry', 'han']);
          const importPriceRaw = getValue(['dongianhap', 'importprice', 'price', 'dongia']);
          const quantityRaw = getValue(['soluong', 'quantity', 'qty']);

          if (!medCode && !medName) {
            errors.push(`Dòng ${rowNum}: Thiếu cột Mã thuốc hoặc Tên thuốc.`);
            return;
          }

          let matchedMed = null;
          if (medCode) {
            matchedMed = medicines.find(m => m.medicineCode.toString().trim().toLowerCase() === medCode.toString().trim().toLowerCase());
          }
          if (!matchedMed && medName) {
            matchedMed = medicines.find(m => m.medicineName.toString().trim().toLowerCase() === medName.toString().trim().toLowerCase());
          }

          if (!matchedMed) {
            errors.push(`Dòng ${rowNum}: Không tìm thấy thuốc có Mã hoặc Tên "${medCode || medName}" trong danh mục hệ thống.`);
            return;
          }

          if (!batchNumber) {
            errors.push(`Dòng ${rowNum}: Số lô trống.`);
            return;
          }

          let productionDate = '';
          if (prodDateRaw) {
            if (typeof prodDateRaw === 'number') {
              const date = new Date((prodDateRaw - 25569) * 86400 * 1000);
              productionDate = date.toISOString().split('T')[0];
            } else {
              const str = prodDateRaw.toString().trim();
              if (str.includes('/')) {
                const parts = str.split('/');
                if (parts.length === 3) {
                  productionDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              } else if (str.includes('-')) {
                const parts = str.split('-');
                if (parts.length === 3) {
                  productionDate = parts[0].length === 4 ? str : `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              } else {
                productionDate = str;
              }
            }
          }

          let expiryDate = '';
          if (expiryDateRaw) {
            if (typeof expiryDateRaw === 'number') {
              const date = new Date((expiryDateRaw - 25569) * 86400 * 1000);
              expiryDate = date.toISOString().split('T')[0];
            } else {
              const str = expiryDateRaw.toString().trim();
              if (str.includes('/')) {
                const parts = str.split('/');
                if (parts.length === 3) {
                  expiryDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              } else if (str.includes('-')) {
                const parts = str.split('-');
                if (parts.length === 3) {
                  expiryDate = parts[0].length === 4 ? str : `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              } else {
                expiryDate = str;
              }
            }
          }

          if (!expiryDate || isNaN(new Date(expiryDate).getTime())) {
            errors.push(`Dòng ${rowNum}: Hạn dùng "${expiryDateRaw}" không hợp lệ (Định dạng chuẩn: DD/MM/YYYY).`);
            return;
          }

          const importPrice = parseFloat(importPriceRaw);
          if (isNaN(importPrice) || importPrice <= 0) {
            errors.push(`Dòng ${rowNum}: Đơn giá nhập "${importPriceRaw}" phải là số lớn hơn 0.`);
            return;
          }

          const quantity = parseInt(quantityRaw);
          if (isNaN(quantity) || quantity <= 0) {
            errors.push(`Dòng ${rowNum}: Số lượng nhập "${quantityRaw}" phải là số nguyên lớn hơn 0.`);
            return;
          }

          parsedItems.push({
            medicineID: matchedMed.medicineID.toString(),
            batchNumber: batchNumber.toString().trim(),
            productionDate: productionDate,
            expiryDate: expiryDate,
            importPrice: importPrice.toString(),
            quantity: quantity.toString()
          });
        });

        if (errors.length > 0) {
          alert("Lỗi kiểm tra định dạng Excel:\n\n" + errors.slice(0, 10).join("\n") + (errors.length > 10 ? `\n... và ${errors.length - 10} lỗi khác.` : ""));
          return;
        }

        if (parsedItems.length > 0) {
          setItems(parsedItems);

          if (extInvoiceNumber) setInvoiceNumber(extInvoiceNumber.toString().trim());

          if (extNotes) setNotes(extNotes.toString().trim());

          if (extSupplierName) {
            const matchedSupplier = suppliers.find(s =>
              s.supplierName.toLowerCase().replace(/\s+/g, '').includes(extSupplierName.toString().toLowerCase().replace(/\s+/g, ''))
            );
            if (matchedSupplier) {
              setSelectedSupplier(matchedSupplier.supplierID.toString());
              setContractNumber(matchedSupplier.contractNumber || 'Chưa cấu hình hợp đồng');
            } else {
              setSelectedSupplier('');
              setContractNumber('');
              alert(`Cảnh báo: Nhà cung cấp "${extSupplierName}" trong file Excel không khớp hoàn toàn với danh mục hệ thống. Vui lòng tự chọn ở Form.`);
            }
          }

          alert(`Đọc thành công ${parsedItems.length} dòng dữ liệu từ Excel!`);
        }
      } catch (err) {
        console.error(err);
        alert("Lỗi đọc tệp Excel. Vui lòng kiểm tra định dạng tệp.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset
  };

  const handleCreateSupplier = (e) => {
    e.preventDefault();
    if (!newSupplierName.trim()) {
      alert("Vui lòng nhập tên nhà cung cấp.");
      return;
    }

    const payload = {
      supplierName: newSupplierName,
      phone: newSupplierPhone,
      address: newSupplierAddress,
      contractNumber: newSupplierContractNumber.trim() || null
    };

    fetch('/api/import/suppliers/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || ''
      },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || "Lỗi tạo nhà cung cấp"); });
        }
        return res.json();
      })
      .then(newSupplier => {
        alert("Thêm nhà cung cấp thành công!");
        setSuppliers([...suppliers, newSupplier]);
        setSelectedSupplier(newSupplier.supplierID.toString());
        setContractNumber(newSupplier.contractNumber || 'Chưa cấu hình hợp đồng');
        setShowSupplierModal(false);
        setNewSupplierName('');
        setNewSupplierPhone('');
        setNewSupplierAddress('');
        setNewSupplierContractNumber('');
      })
      .catch(err => alert("Lỗi: " + err.message));
  };

  const fetchInitialData = () => {
    setLoading(true);
    const t = Date.now();
    Promise.all([
      fetch(`/api/import?_t=${t}`).then(res => res.json()),
      fetch(`/api/import/suppliers?_t=${t}`).then(res => res.json()),
      fetch(`/api/import/medicines?_t=${t}`).then(res => res.json())
    ])
      .then(([importsData, suppliersData, medicinesData]) => {
        setImports(importsData);
        setSuppliers(suppliersData);
        setMedicines(medicinesData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading initial data: ", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInitialData();

    const handleUpdate = (e) => {
      if (e.detail === 'Imports' || e.detail === 'Inventory') {
        fetchInitialData();
      }
    };
    window.addEventListener('pharmacy-update', handleUpdate);
    return () => window.removeEventListener('pharmacy-update', handleUpdate);
  }, []);

  useEffect(() => {
    if (user?.fullName) {
      setCreatedBy(user.fullName);
    }
  }, [user]);

  useEffect(() => {
    if (activeReceiptForDossier) {
      setActiveDossierIndex(0);
    }
  }, [activeReceiptForDossier]);

  // Interactive Canvas Drawing Code for Signature (Multi-Signature)
  useEffect(() => {
    if (showSignatureModal) {
      const setupCanvas = (canvas) => {
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#1e3a8a'; // Dark clinical blue ink
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const getPos = (e) => {
          const rect = canvas.getBoundingClientRect();
          const clientX = e.clientX || (e.touches && e.touches[0].clientX);
          const clientY = e.clientY || (e.touches && e.touches[0].clientY);
          return {
            x: clientX - rect.left,
            y: clientY - rect.top
          };
        };

        let localDrawing = false;

        const start = (e) => {
          if (e.touches) e.preventDefault();
          localDrawing = true;
          const pos = getPos(e);
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
        };

        const draw = (e) => {
          if (!localDrawing) return;
          if (e.touches) e.preventDefault();
          const pos = getPos(e);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        };

        const stop = () => {
          localDrawing = false;
        };

        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stop);
        canvas.addEventListener('mouseleave', stop);

        canvas.addEventListener('touchstart', start, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stop);

        return () => {
          canvas.removeEventListener('mousedown', start);
          canvas.removeEventListener('mousemove', draw);
          canvas.removeEventListener('mouseup', stop);
          canvas.removeEventListener('mouseleave', stop);

          canvas.removeEventListener('touchstart', start);
          canvas.removeEventListener('touchmove', draw);
          canvas.removeEventListener('touchend', stop);
        };
      };

      const clean1 = setupCanvas(canvasRef1.current);
      const clean2 = setupCanvas(canvasRef2.current);
      const clean3 = setupCanvas(canvasRef3.current);
      const clean4 = setupCanvas(canvasRef4.current);

      return () => {
        if (clean1) clean1();
        if (clean2) clean2();
        if (clean3) clean3();
        if (clean4) clean4();
      };
    }
  }, [showSignatureModal]);

  const clearCanvas = (ref) => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const isCanvasEmpty = (canvas) => {
    if (!canvas) return true;
    const buffer = new Uint32Array(
      canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !buffer.some(color => color !== 0);
  };

  const handleConfirmSignature = () => {
    if (signatureTarget?.action === 'approve') {
      if (isCanvasEmpty(canvasRef4.current)) {
        alert("Vui lòng vẽ chữ ký của Ban lãnh đạo để phê duyệt nhập kho.");
        return;
      }
      const leaderSig = canvasRef4.current.toDataURL('image/png');
      const importID = signatureTarget.importID;

      setShowSignatureModal(false);

      fetch(`/api/import/${importID}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || ''
        },
        body: JSON.stringify({ approverSignature: leaderSig })
      })
        .then(res => {
          if (!res.ok) {
            return res.json().then(data => { throw new Error(data.error || "Lỗi duyệt phiếu"); });
          }
          return res.json();
        })
        .then(() => {
          alert("Phê duyệt nhập kho thành công! Hàng hóa đã được cộng vào tồn kho chẵn.");
          fetchInitialData();
        })
        .catch(err => alert("Lỗi duyệt phiếu: " + err.message));

      return;
    }

    const { saveAsDraft } = signatureTarget || {};

    // Determine which signatures are required
    // 1. Thủ kho (Người lập) - required when completing inspection (!saveAsDraft)
    const needSig1 = !saveAsDraft;
    // 2. Người giao hàng - required when completing inspection (!saveAsDraft)
    const needSig2 = !saveAsDraft;
    // 3. Người kiểm 2 - required when completing inspection (!saveAsDraft)
    const needSig3 = !saveAsDraft;

    if (needSig1 && isCanvasEmpty(canvasRef1.current)) {
      alert("Vui lòng vẽ chữ ký của Thủ kho (Người lập phiếu).");
      return;
    }
    if (needSig2 && isCanvasEmpty(canvasRef2.current)) {
      alert("Vui lòng vẽ chữ ký của Người giao hàng (Đại diện NCC).");
      return;
    }
    if (needSig3 && isCanvasEmpty(canvasRef3.current)) {
      alert("Vui lòng vẽ chữ ký của Dược sĩ cùng kiểm (Người kiểm thứ hai).");
      return;
    }

    const sig1 = needSig1 ? canvasRef1.current.toDataURL('image/png') : null;
    const sig2 = needSig2 ? canvasRef2.current.toDataURL('image/png') : null;
    const sig3 = needSig3 ? canvasRef3.current.toDataURL('image/png') : null;

    setShowSignatureModal(false);

    // Resume submit with signatures
    handleSubmitImport(null, saveAsDraft, sig1, sig2, sig3);
  };

  const handleSupplierChange = (supplierID) => {
    setSelectedSupplier(supplierID);
    const matchedSupplier = suppliers.find(s => s.supplierID.toString() === supplierID.toString());
    if (matchedSupplier) {
      setContractNumber(matchedSupplier.contractNumber || 'Chưa cấu hình hợp đồng');
    } else {
      setContractNumber('');
    }
  };

  const handleAddItemRow = () => {
    setItems([...items, { medicineID: '', batchNumber: '', productionDate: '', expiryDate: '', importPrice: '', quantity: '' }]);
  };

  const handleRemoveItemRow = (index) => {
    const newItems = items.filter((_, idx) => idx !== index);
    setItems(newItems.length ? newItems : [{ medicineID: '', batchNumber: '', productionDate: '', expiryDate: '', importPrice: '', quantity: '' }]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  // File Loading Handler with Cloudinary Upload and Local Base64 Fallback
  const handleFileChange = async (e, docType) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploadingFile(true);
    try {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const url = await uploadToCloudinary(file);
          setUploadedDocs(prev => [...prev, {
            type: docType,
            name: file.name,
            url: url,
            base64: url // Đồng bộ vào base64 để không phá vỡ cấu trúc hiển thị cũ
          }]);
        } else {
          // Fallback sang Base64 đối với các tệp không phải hình ảnh (ví dụ: PDF)
          const reader = new FileReader();
          reader.onload = (evt) => {
            setUploadedDocs(prev => [...prev, {
              type: docType,
              name: file.name,
              base64: evt.target.result
            }]);
          };
          reader.readAsDataURL(file);
        }
      }
    } catch (err) {
      console.warn("Cloudinary upload failed, falling back to local base64. Error:", err.message);

      // Fallback tự động sang Base64 nếu Cloudinary lỗi (giúp offline hoặc chưa cấu hình vẫn dùng được)
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          setUploadedDocs(prev => [...prev, {
            type: docType,
            name: file.name,
            base64: evt.target.result
          }]);
        };
        reader.readAsDataURL(file);
      }
    } finally {
      setIsUploadingFile(false);
      e.target.value = null; // reset input
    }
  };

  const handleRemoveDoc = (originalIdx) => {
    setUploadedDocs(prev => prev.filter((_, idx) => idx !== originalIdx));
  };

  // Stepper Validations
  const isStep1Valid = () => {
    return selectedSupplier && invoiceNumber && invoiceDate && deliveryNoteNumber && checkInvoiceMatches && checkDeliveryRecordSigned && checkDeliverySlipUploaded && checkContractUploaded;
  };

  const isStep2Valid = () => {
    const itemsValid = items.length > 0 && items.every(item =>
      item.medicineID && item.batchNumber && item.expiryDate && item.importPrice && item.quantity
    );
    return itemsValid;
  };

  const isStep3Valid = () => {
    if (isAnomaly) {
      return anomalyDescription.trim().length > 0;
    }
    return true;
  };

  const isStep4Valid = () => {
    return secondInspector.trim().length > 0;
  };

  const handleNextStep = () => {
    if (activeStep === 1 && !isStep1Valid()) {
      alert("Vui lòng nhập đầy đủ thông tin chứng từ và xác nhận checklists ở Bước 1 trước khi tiếp tục.");
      return;
    }
    if (activeStep === 2) {
      if (!isStep2Valid()) {
        alert("Vui lòng nhập đầy đủ thông tin chi tiết lô thuốc (Dược phẩm, Số lô, Hạn dùng, Đơn giá, Số lượng) trước khi tiếp tục.");
        return;
      }

      // Check if any physical quality checklist is unchecked
      const hasQualityAnomaly = !checkPackagingIntact || !checkLabelingClear || !checkSensoryOk;
      if (hasQualityAnomaly) {
        setIsAnomaly(true);
        alert("Phát hiện bất thường về cảm quan/bao bì thực tế (chưa tích đủ checklist chất lượng). Hệ thống tự động kích hoạt Chế độ Xử lý Bất thường ở Bước 3 để bạn lập hồ sơ cô lập hoặc từ chối lô hàng.");
      }
    }
    if (activeStep === 3 && !isStep3Valid()) {
      alert("Vui lòng nhập chi tiết mô tả bất thường trước khi tiếp tục.");
      return;
    }
    setActiveStep(prev => Math.min(prev + 1, 4));
  };

  const handlePrevStep = () => {
    setActiveStep(prev => Math.max(prev - 1, 1));
  };

  // State-progressive logic: Start physical counts on a draft receipt
  const handleStartInspection = (imp) => {
    setInspectingReceiptId(imp.importID);
    setInspectingReceiptCode(imp.importCode || `PNK-${imp.importID}`);

    // Load Step 1 values from the existing receipt (read-only during inspection)
    setSelectedSupplier(imp.supplierID.toString());
    const matchedSupplier = suppliers.find(s => s.supplierID.toString() === imp.supplierID.toString());
    setContractNumber(matchedSupplier?.contractNumber || imp.contractNumber || 'Chưa cấu hình hợp đồng');
    setInvoiceNumber(imp.invoiceNumber || '');
    setInvoiceDate(imp.invoiceDate ? imp.invoiceDate.split('T')[0] : '');
    setDeliveryNoteNumber(imp.deliveryNoteNumber || '');
    setNotes(imp.notes || '');

    // Auto-confirm Step 1 checklists since papers are already accepted
    setCheckInvoiceMatches(true);
    setCheckTempHumidity(true);
    setCheckDeliveryRecordSigned(true);
    setCheckDeliverySlipUploaded(true);
    setCheckContractUploaded(true);

    // Load documents
    try {
      const parsedDocs = JSON.parse(imp.documentsJson || '[]');
      setUploadedDocs(parsedDocs);
    } catch (e) {
      setUploadedDocs([]);
    }

    // Reset Steps 2, 3, 4 values
    setItems([{ medicineID: '', batchNumber: '', productionDate: '', expiryDate: '', importPrice: '', quantity: '' }]);
    setSecondInspector('');
    setIsAnomaly(false);
    setAnomalyDescription('');
    setCheckPackagingIntact(false);
    setCheckLabelingClear(false);
    setCheckSensoryOk(false);

    // Skip directly to Step 2
    setActiveStep(2);
  };

  const handleCancelInspection = () => {
    setInspectingReceiptId(null);
    setInspectingReceiptCode('');
    setEditingReceiptId(null);
    setEditingReceiptCode('');

    // Reset all form states
    setSelectedSupplier('');
    setContractNumber('');
    setInvoiceNumber('');
    setInvoiceDate('');
    setDeliveryNoteNumber('');
    setNotes('');
    setItems([{ medicineID: '', batchNumber: '', productionDate: '', expiryDate: '', importPrice: '', quantity: '' }]);

    setActiveStep(1);
    setUploadedDocs([]);
    setIsAnomaly(false);
    setAnomalyStatus('Từ chối');
    setAnomalyDescription('');
    setSecondInspector('');

    setCheckInvoiceMatches(false);
    setCheckTempHumidity(false);
    setCheckDeliveryRecordSigned(false);
    setCheckDeliverySlipUploaded(false);
    setCheckContractUploaded(false);
    setCheckPackagingIntact(false);
    setCheckLabelingClear(false);
    setCheckSensoryOk(false);
  };

  const handleStartEdit = (imp) => {
    setEditingReceiptId(imp.importID);
    setEditingReceiptCode(imp.importCode || `PNK-${imp.importID}`);
    setInspectingReceiptId(null);
    setInspectingReceiptCode('');

    setSelectedSupplier(imp.supplierID.toString());
    const matchedSupplier = suppliers.find(s => s.supplierID.toString() === imp.supplierID.toString());
    setContractNumber(matchedSupplier?.contractNumber || imp.contractNumber || 'Chưa cấu hình hợp đồng');
    setInvoiceNumber(imp.invoiceNumber || '');
    setInvoiceDate(imp.invoiceDate ? imp.invoiceDate.split('T')[0] : '');
    setDeliveryNoteNumber(imp.deliveryNoteNumber || '');
    setNotes(imp.notes || '');

    try {
      const parsedDocs = JSON.parse(imp.documentsJson || '[]');
      setUploadedDocs(parsedDocs);
    } catch (e) {
      setUploadedDocs([]);
    }

    if (imp.details && imp.details.length > 0) {
      const loadedItems = imp.details.map(d => ({
        medicineID: d.batch?.medicineID?.toString() || '',
        batchNumber: d.batch?.batchNumber || '',
        productionDate: d.batch?.productionDate ? d.batch.productionDate.split('T')[0] : '',
        expiryDate: d.batch?.expiryDate ? d.batch.expiryDate.split('T')[0] : '',
        importPrice: d.batch?.importPrice?.toString() || '',
        quantity: d.quantity?.toString() || ''
      }));
      setItems(loadedItems);
    } else {
      setItems([{ medicineID: '', batchNumber: '', productionDate: '', expiryDate: '', importPrice: '', quantity: '' }]);
    }

    setSecondInspector(imp.secondInspector || '');
    setAnomalyDescription(imp.anomalyDescription || '');
    setIsAnomaly(!!imp.anomalyDescription);

    setCheckInvoiceMatches(true);
    setCheckTempHumidity(true);
    setCheckDeliveryRecordSigned(true);
    setCheckDeliverySlipUploaded(true);
    setCheckContractUploaded(true);
    setCheckPackagingIntact(true);
    setCheckLabelingClear(true);
    setCheckSensoryOk(true);

    setActiveStep(1);
  };

  // Submit Handler
  const handleSubmitImport = (e, saveAsDraft = false, sig1 = null, sig2 = null, sig3 = null) => {
    if (e) e.preventDefault();

    if (isSubmitting || submitRef.current) return; // Prevent concurrent submissions

    // INTERCEPT: Prompt for digital signatures before submitting
    const hasRequiredSignatures = saveAsDraft
      ? true
      : (sig1 && sig2 && sig3);

    if (!hasRequiredSignatures) {
      if (saveAsDraft) {
        // Step 1 only validation for draft reception (allow missing checklists/documents for drafts)
        if (!selectedSupplier || !invoiceNumber || !invoiceDate || !deliveryNoteNumber) {
          alert("Vui lòng nhập đầy đủ thông tin cơ bản: Nhà cung cấp, Số hóa đơn, Ngày hóa đơn và Số phiếu xuất kho trước khi lưu hồ sơ.");
          return;
        }
      } else {
        if (!isStep1Valid() || !isStep2Valid() || !isStep3Valid() || !isStep4Valid()) {
          alert("Vui lòng hoàn thành tất cả các bước của quy trình kiểm nhận và điền đầy đủ các thông tin bắt buộc.");
          return;
        }
      }

      setSignatureTarget({ saveAsDraft });
      setShowSignatureModal(true);
      return;
    }

    if (saveAsDraft) {
      submitRef.current = true;
      setIsSubmitting(true);

      const payload = {
        supplierID: parseInt(selectedSupplier),
        contractNumber: contractNumber.trim() || null,
        invoiceNumber: invoiceNumber.trim() || null,
        createdBy: createdBy.trim(),
        notes: notes.trim() || null,
        status: 'Chờ kiểm nhập',
        invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : null,
        deliveryNoteNumber: deliveryNoteNumber.trim() || null,
        secondInspector: null,
        anomalyDescription: null,
        documentsJson: JSON.stringify(uploadedDocs),
        digitalSignature: sig1, // Attach digital signature (Thủ kho)
        deliveryPersonSignature: sig2, // Attach delivery signature
        items: [] // Empty items at reception phase
      };

      if (editingReceiptId) {
        // Cập nhật nháp của phiếu hiện có
        fetch(`/api/import/${editingReceiptId}/update`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Role': user?.role || ''
          },
          body: JSON.stringify(payload)
        })
          .then(res => {
            if (!res.ok) {
              return res.json().then(data => { throw new Error(data.error || "Lỗi cập nhật hồ sơ tiếp nhận"); });
            }
            return res.json();
          })
          .then(updatedImport => {
            alert(`Cập nhật hồ sơ nháp thành công!\nMã phiếu: ${updatedImport.importCode}`);
            setImports(imports.map(imp => imp.importID === updatedImport.importID ? updatedImport : imp));
            handleCancelInspection();
          })
          .catch(err => {
            alert("Lỗi cập nhật hồ sơ: " + err.message);
          })
          .finally(() => {
            submitRef.current = false;
            setIsSubmitting(false);
          });
      } else {
        // Tạo mới phiếu nháp
        fetch('/api/import/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Role': user?.role || ''
          },
          body: JSON.stringify(payload)
        })
          .then(res => {
            if (!res.ok) {
              return res.json().then(data => { throw new Error(data.error || "Lỗi lưu hồ sơ tiếp nhận"); });
            }
            return res.json();
          })
          .then(newImport => {
            alert(`Đăng ký tiếp nhận hồ sơ thành công!\nMã phiếu: ${newImport.importCode}\nTrạng thái: Chờ kiểm nhập thực tế.`);
            setImports([newImport, ...imports]);
            handleCancelInspection();
          })
          .catch(err => {
            alert("Lỗi tiếp nhận hồ sơ: " + err.message);
          })
          .finally(() => {
            submitRef.current = false;
            setIsSubmitting(false);
          });
      }
      return;
    }

    // Otherwise, completing full clinical inspection
    if (!isStep1Valid() || !isStep2Valid() || !isStep3Valid() || !isStep4Valid()) {
      alert("Vui lòng hoàn thành tất cả các bước của quy trình kiểm nhận và điền đầy đủ các thông tin bắt buộc.");
      return;
    }

    submitRef.current = true;
    setIsSubmitting(true);

    const finalStatus = isAnomaly ? anomalyStatus : 'Đạt kiểm nhập'; // Inspection passed, awaiting final approval/import to inventory

    const formattedItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      formattedItems.push({
        medicineID: parseInt(item.medicineID),
        batchNumber: item.batchNumber.trim(),
        productionDate: item.productionDate ? new Date(item.productionDate).toISOString() : null,
        expiryDate: new Date(item.expiryDate).toISOString(),
        importPrice: parseFloat(item.importPrice),
        quantity: parseInt(item.quantity)
      });
    }

    if (editingReceiptId) {
      submitRef.current = true;
      setIsSubmitting(true);

      const payload = {
        supplierID: parseInt(selectedSupplier),
        contractNumber: contractNumber.trim() || null,
        invoiceNumber: invoiceNumber.trim() || null,
        createdBy: createdBy.trim(),
        notes: notes.trim() || null,
        status: finalStatus,
        invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : null,
        deliveryNoteNumber: deliveryNoteNumber.trim() || null,
        secondInspector: secondInspector.trim() || null,
        anomalyDescription: isAnomaly ? anomalyDescription.trim() : null,
        documentsJson: JSON.stringify(uploadedDocs),
        digitalSignature: sig1 || null,
        secondInspectorSignature: sig3 || null,
        deliveryPersonSignature: sig2 || null,
        items: formattedItems
      };

      fetch(`/api/import/${editingReceiptId}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || ''
        },
        body: JSON.stringify(payload)
      })
        .then(res => {
          if (!res.ok) {
            return res.json().then(data => { throw new Error(data.error || "Lỗi điều chỉnh phiếu"); });
          }
          return res.json();
        })
        .then(updatedImport => {
          alert(`Điều chỉnh phiếu nhập kho thành công!\nSố phiếu nội bộ: ${updatedImport.importCode}`);
          setImports(imports.map(imp => imp.importID === updatedImport.importID ? updatedImport : imp));
          handleCancelInspection();
        })
        .catch(err => {
          alert("Lỗi điều chỉnh phiếu: " + err.message);
        })
        .finally(() => {
          submitRef.current = false;
          setIsSubmitting(false);
        });
      return;
    }

    if (inspectingReceiptId) {
      // Complete inspection of an existing reception draft
      const payload = {
        secondInspector: secondInspector.trim(),
        anomalyDescription: isAnomaly ? anomalyDescription.trim() : null,
        status: finalStatus,
        documentsJson: JSON.stringify(uploadedDocs),
        digitalSignature: sig1 || null, // Attach first signature if drawn (fast-import)
        secondInspectorSignature: sig3, // Attach second signature (Dược sĩ cùng kiểm)
        deliveryPersonSignature: sig2 || null, // Attach delivery signature if drawn
        items: formattedItems
      };

      fetch(`/api/import/${inspectingReceiptId}/complete-inspection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': user?.role || ''
        },
        body: JSON.stringify(payload)
      })
        .then(res => {
          if (!res.ok) {
            return res.json().then(data => { throw new Error(data.error || "Lỗi hoàn tất kiểm nhận"); });
          }
          return res.json();
        })
        .then(updatedImport => {
          let statusMsg = "Lập Biên bản Kiểm nhập thành công! Phiếu đã sẵn sàng chờ duyệt thực nhập.";
          if (updatedImport.status === 'Từ chối') {
            statusMsg = "Đã lập Biên bản Từ chối kiểm nhập (Từ chối nhận lô hàng lỗi).";
          } else if (updatedImport.status === 'Chờ kiểm nghiệm') {
            statusMsg = "Đã lưu biên bản và cách ly hàng hóa (Chờ kiểm nghiệm y tế).";
          }

          alert(`${statusMsg}\nSố phiếu nội bộ: ${updatedImport.importCode}`);
          setImports(imports.map(imp => imp.importID === updatedImport.importID ? updatedImport : imp));
          handleCancelInspection();
          setActiveReceiptForPrint(updatedImport);
        })
        .catch(err => {
          alert("Lỗi hoàn tất kiểm nhận: " + err.message);
        })
        .finally(() => {
          submitRef.current = false;
          setIsSubmitting(false);
        });
      return;
    }

    // Creating a new fast-import receipt (header + items in one go)
    const payload = {
      supplierID: parseInt(selectedSupplier),
      contractNumber: contractNumber.trim() || null,
      invoiceNumber: invoiceNumber.trim() || null,
      createdBy: createdBy.trim(),
      notes: notes.trim() || null,
      status: finalStatus,
      invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : null,
      deliveryNoteNumber: deliveryNoteNumber.trim() || null,
      secondInspector: secondInspector.trim() || null,
      anomalyDescription: isAnomaly ? anomalyDescription.trim() : null,
      documentsJson: JSON.stringify(uploadedDocs),
      digitalSignature: sig1,
      secondInspectorSignature: sig3,
      deliveryPersonSignature: sig2,
      items: formattedItems
    };

    fetch('/api/import/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': user?.role || ''
      },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || "Lỗi nhập kho"); });
        }
        return res.json();
      })
      .then(newImport => {
        let statusMsg = "Lập Biên bản Kiểm nhập thành công! Phiếu ở trạng thái 'Đạt kiểm nhập' (Chờ duyệt thực nhập).";
        if (newImport.status === 'Từ chối') {
          statusMsg = "Phiếu kiểm nhận đã được lưu trữ ở trạng thái 'Từ chối' do phát hiện sự cố.";
        }

        alert(`${statusMsg}\nSố phiếu nội bộ: ${newImport.importCode}`);
        setImports([newImport, ...imports]);
        handleCancelInspection();
        setActiveReceiptForPrint(newImport);
      })
      .catch(err => {
        alert("Lỗi nhập kho: " + err.message);
      })
      .finally(() => {
        submitRef.current = false;
        setIsSubmitting(false);
      });
  };

  // Approve and Import to Inventory (The final GSP stage)
  const handleApproveImport = (importID) => {
    setSignatureTarget({ action: 'approve', importID });
    setShowSignatureModal(true);
  };

  const calculateFormTotal = () => {
    return items.reduce((sum, item) => {
      const price = parseFloat(item.importPrice) || 0;
      const qty = parseInt(item.quantity) || 0;
      return sum + (price * qty);
    }, 0);
  };

  const getFilteredImports = () => {
    return imports.filter(imp => {
      const isAwaitingInspection = imp.status === 'Chờ kiểm nhập' || imp.status === 'Pending';
      const isPassedInspection = imp.status === 'Đạt kiểm nhập' || imp.status === 'Thiếu hàng' || imp.status === 'Chờ kiểm nghiệm';
      const isImported = imp.status === 'Đã nhập kho' || imp.status === 'Đã kiểm' || imp.status === 'Approved' || imp.status === 'Shortage';
      const isRejected = imp.status === 'Từ chối';

      if (filterStatus === 'pending_approval') {
        return isPassedInspection && imp.status !== 'Từ chối';
      }
      if (filterStatus === 'awaiting_inspection') {
        return isAwaitingInspection;
      }
      if (filterStatus === 'imported') {
        return isImported;
      }
      if (filterStatus === 'rejected') {
        return isRejected;
      }
      return true; // 'all'
    });
  };

  const getStatusBadge = (st) => {
    const styles = {
      'Chờ kiểm nhập': { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)' },
      'Chờ kiểm nghiệm': { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)' },
      'Đang kiểm': { bg: 'rgba(147, 51, 234, 0.1)', color: '#a855f7', border: '1px solid rgba(147, 51, 234, 0.25)' },
      'Đạt kiểm nhập': { bg: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.25)' },
      'Đã nhập kho': { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' },
      'Từ chối': { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)' },
      'Thiếu hàng': { bg: 'rgba(249, 115, 22, 0.1)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.25)' }
    };
    const style = styles[st] || { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.25)' };
    return (
      <span style={{
        padding: '0.2rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.74rem',
        fontWeight: '600',
        display: 'inline-block',
        ...style
      }}>
        {st}
      </span>
    );
  };

  // Beautiful visual timeline for history cards
  const renderCardTimeline = (status) => {
    const states = [
      { key: 'reception', label: 'Tiếp nhận' },
      { key: 'inspection', label: 'Kiểm cảm quan' },
      { key: 'approval', label: 'Duyệt thực nhập' }
    ];

    let activeIndex = 0;
    let isRejected = status === 'Từ chối';

    if (status === 'Chờ kiểm nhập' || status === 'Pending') {
      activeIndex = 0; // Awaiting inspection
    } else if (status === 'Đang kiểm') {
      activeIndex = 1; // Inspecting
    } else if (status === 'Đạt kiểm nhập' || status === 'Thiếu hàng' || status === 'Chờ kiểm nghiệm') {
      activeIndex = 2; // Inspection passed, awaiting approval
    } else if (status === 'Đã nhập kho' || status === 'Đã kiểm' || status === 'Approved' || status === 'Shortage') {
      activeIndex = 3; // Official imported
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem', marginBottom: '0.2rem' }}>
        {states.map((s, idx) => {
          const isDone = activeIndex > idx;
          const isCurrent = activeIndex === idx;
          const dotColor = isRejected
            ? '#ef4444'
            : isDone
              ? '#10b981'
              : isCurrent
                ? 'var(--color-primary)'
                : 'rgba(255,255,255,0.15)';

          return (
            <React.Fragment key={s.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: dotColor,
                  boxShadow: isCurrent && !isRejected ? '0 0 6px var(--color-primary)' : 'none'
                }} />
                <span style={{
                  fontSize: '0.66rem',
                  color: isCurrent ? 'var(--text-main)' : 'var(--text-muted)',
                  fontWeight: isCurrent ? '700' : '500'
                }}>
                  {isRejected && idx === 1 ? 'Từ chối' : s.label}
                </span>
              </div>
              {idx < states.length - 1 && (
                <div style={{
                  height: '1px',
                  width: '12px',
                  backgroundColor: isDone ? '#10b981' : 'rgba(255,255,255,0.1)'
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderUploadedFilesList = (type) => {
    const files = uploadedDocs.filter(d => d.type === type);
    if (files.length === 0) return null;

    return (
      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {files.map((doc, idx) => {
          const originalIdx = uploadedDocs.findIndex(d => d === doc);
          const isImg = doc.base64 && (doc.base64.startsWith('data:image') || doc.base64.startsWith('http'));
          return (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.35rem 0.6rem',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-glass)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', flexGrow: 1 }}>
                {isImg ? <Image size={14} color="#10b981" /> : <FileText size={14} color="#3b82f6" />}
                <span style={{ color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={doc.name}>
                  {doc.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveDoc(originalIdx)}
                style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderStepperHeader = () => {
    const steps = [
      { id: 1, label: 'Hồ sơ & Chứng từ' },
      { id: 2, label: 'Cảm quan & Số lượng' },
      { id: 3, label: 'Xử lý Bất thường' },
      { id: 4, label: 'Nhập kho & Hoàn tất' }
    ];

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        background: 'rgba(255,255,255,0.02)',
        padding: '0.9rem 1rem',
        borderRadius: '12px',
        border: '1px solid var(--border-glass)',
        overflowX: 'auto'
      }}>
        {steps.map((step, idx) => {
          const isActive = activeStep === step.id;
          const isCompleted = activeStep > step.id;

          return (
            <React.Fragment key={step.id}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '100px', position: 'relative' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  background: isCompleted
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : isActive
                      ? 'linear-gradient(135deg, var(--color-primary), #2563eb)'
                      : 'rgba(255,255,255,0.06)',
                  color: isCompleted || isActive ? '#fff' : 'var(--text-muted)',
                  border: isActive ? '2px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-glass)',
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? '0 0 12px rgba(59, 130, 246, 0.35)' : 'none'
                }}>
                  {isCompleted ? <Check size={16} /> : step.id}
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: isActive || isCompleted ? '600' : '500',
                  color: isActive
                    ? 'var(--color-primary)'
                    : isCompleted
                      ? '#10b981'
                      : 'var(--text-muted)',
                  marginTop: '0.4rem',
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}>
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div style={{
                  height: '2px',
                  flex: 1,
                  background: activeStep > step.id ? '#10b981' : 'rgba(255,255,255,0.08)',
                  margin: '0 0.5rem',
                  marginTop: '-1.2rem',
                  transition: 'all 0.3s ease'
                }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Đang tải dữ liệu nghiệp vụ nhập kho...</div>;

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title">{user?.role === 'director' ? 'Duyệt Nhập Kho Chẵn' : 'Quản Lý Nhập Kho Chẵn'}</h1>
        <p className="page-subtitle">
          {user?.role === 'director'
            ? 'Phê duyệt phiếu nhập kho chẵn và quản lý hồ sơ kiểm nhận từ Ban lãnh đạo.'
            : 'Kiểm nhận và lưu trữ hồ sơ thuốc, vật tư y tế thầu theo đúng quy trình SOP y tế.'}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>

        {/* Left Side: Create Import Wizard (Stepper) */}
        {user?.role !== 'director' && (
          <div className="glass-card" style={{ padding: '1.5rem', minHeight: '620px', display: 'flex', flexDirection: 'column' }}>

            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', fontSize: '1.05rem' }}>
              <FileText size={18} color="var(--color-primary)" /> Quy trình kiểm nhận thuốc tiêu chuẩn (SOP)
            </h3>

            {/* Locked draft banner if inspecting */}
            {inspectingReceiptId && (
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', padding: '0.6rem 0.8rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--color-primary)' }}>Đang kiểm thực tế cảm quan</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Số phiếu: <strong>{inspectingReceiptCode}</strong> (Hồ sơ pháp lý cố định)</div>
                </div>
                <button type="button" className="btn-secondary" onClick={handleCancelInspection} style={{ height: '28px', padding: '0 0.6rem', fontSize: '0.72rem', borderColor: '#ef4444', color: '#ef4444', background: 'none' }}>
                  Hủy & Thoát
                </button>
              </div>
            )}

            {/* Yellow banner if editing */}
            {editingReceiptId && (
              <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '8px', padding: '0.6rem 0.8rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#eab308' }}>Đang điều chỉnh thông tin phiếu nhập</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Số phiếu: <strong>{editingReceiptCode}</strong> (Nhấn Hoàn tất để lưu thay đổi)</div>
                </div>
                <button type="button" className="btn-secondary" onClick={handleCancelInspection} style={{ height: '28px', padding: '0 0.6rem', fontSize: '0.72rem', borderColor: '#ef4444', color: '#ef4444', background: 'none' }}>
                  Hủy & Thoát
                </button>
              </div>
            )}

            {renderStepperHeader()}

            <form onSubmit={(e) => handleSubmitImport(e, false)} style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

              {/* WIZARD STEP 1: HỒ SƠ & CHỨNG TỪ */}
              {activeStep === 1 && (
                <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                  <h4 style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileCheck size={16} color="var(--color-primary)" /> Bước 1: Tiếp nhận & Đối chiếu Hồ sơ Pháp lý từ NCC
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Nhà cung cấp / Công ty bán (*)</label>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <select
                          className="form-input"
                          value={selectedSupplier}
                          onChange={e => handleSupplierChange(e.target.value)}
                          disabled={inspectingReceiptId !== null}
                          style={{ flexGrow: 1, height: '38px', fontSize: '0.82rem' }}
                        >
                          <option value="">-- Chọn nhà cung cấp --</option>
                          {suppliers.map(s => (
                            <option key={s.supplierID} value={s.supplierID}>{s.supplierName}</option>
                          ))}
                        </select>
                        {!inspectingReceiptId && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: 0, height: '38px', minWidth: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => setShowSupplierModal(true)}
                            title="Thêm nhà cung cấp mới"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Số hợp đồng mua bán thầu (Chỉ đọc)</label>
                      <input
                        type="text"
                        className="form-input"
                        value={contractNumber}
                        readOnly
                        style={{
                          height: '38px',
                          fontSize: '0.82rem',
                          background: 'rgba(255, 255, 255, 0.03)',
                          cursor: 'not-allowed',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-glass)',
                          fontWeight: '600'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Số hóa đơn tài chính (VAT) (*)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="VD: 00012345"
                        value={invoiceNumber}
                        onChange={e => setInvoiceNumber(e.target.value)}
                        readOnly={inspectingReceiptId !== null}
                        style={{ height: '38px', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Ngày lập hóa đơn (*)</label>
                      <input
                        type="date"
                        className="form-input"
                        value={invoiceDate}
                        onChange={e => setInvoiceDate(e.target.value)}
                        readOnly={inspectingReceiptId !== null}
                        style={{ height: '38px', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Số phiếu xuất kho (NCC) (*)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="VD: PX-9988"
                        value={deliveryNoteNumber}
                        onChange={e => setDeliveryNoteNumber(e.target.value)}
                        readOnly={inspectingReceiptId !== null}
                        autoComplete="off"
                        style={{ height: '38px', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>

                  {/* File loaders for Documents (Each category is its own surrounding normal black frame) */}
                  <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginBottom: '1.25rem' }}>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '800', display: 'block', marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Tải hồ sơ đính kèm (Ảnh / PDF)
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      {[
                        { key: 'invoice', label: 'Hóa đơn thầu (VAT)', required: true },
                        { key: 'contract', label: 'Hợp đồng thầu / mua bán', required: true },
                        { key: 'delivery_slip', label: 'Phiếu xuất kho (NCC)', required: true },
                        { key: 'delivery_record', label: 'Biên bản giao hàng (NCC)', required: true },
                        { key: 'coa_coo', label: 'COA / COO chất lượng', required: false },
                        { key: 'temp_log', label: 'Log nhiệt độ vận chuyển', required: false }
                      ].map((dt) => {
                        const categoryFiles = uploadedDocs.filter(d => d.type === dt.key);
                        return (
                          <div key={dt.key} style={{
                            background: 'rgba(0, 0, 0, 0.05)',
                            border: '1px solid #000000',
                            borderRadius: '8px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            transition: 'all 0.2s ease'
                          }}>
                            {/* Header of the individual frame */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <FileText size={14} color="var(--text-muted)" />
                                {dt.label} {dt.required && <span style={{ color: '#ef4444' }}>*</span>}
                              </span>
                              <span style={{
                                fontSize: '0.64rem',
                                fontWeight: '700',
                                color: '#ffffff',
                                background: '#000000',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                border: '1px solid #000000',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px'
                              }}>
                                {dt.required ? 'Bắt buộc' : 'Bổ sung'}
                              </span>
                            </div>

                            {/* Clickable upload zone (Dashed black border frame) */}
                            <label style={{
                              cursor: inspectingReceiptId || isUploadingFile ? 'default' : 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              padding: '1rem 0.75rem',
                              background: 'rgba(0, 0, 0, 0.08)',
                              border: '1px dashed #000000',
                              borderRadius: '6px',
                              textAlign: 'center',
                              transition: 'all 0.2s ease',
                              margin: 0
                            }}
                              className="upload-dropzone"
                            >
                              {isUploadingFile ? (
                                <RefreshCw size={18} className="spin" color="var(--color-primary)" />
                              ) : (
                                <Upload size={18} color="var(--text-muted)" />
                              )}
                              <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                                {isUploadingFile ? 'Đang tải lên Cloudinary...' : (inspectingReceiptId ? 'Chỉ xem tệp đính kèm' : 'Nhấp để tải tệp lên')}
                              </span>
                              <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>
                                {isUploadingFile ? 'Vui lòng chờ trong giây lát...' : 'PDF hoặc Hình ảnh'}
                              </span>
                              <input
                                type="file"
                                disabled={inspectingReceiptId !== null || isUploadingFile}
                                style={{ display: 'none' }}
                                accept="image/*,application/pdf"
                                onChange={(e) => handleFileChange(e, dt.key)}
                              />
                            </label>

                            {/* List of uploaded files under the zone */}
                            {categoryFiles.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px dashed #000000', paddingTop: '0.6rem' }}>
                                {categoryFiles.map((doc, idx) => {
                                  const originalIdx = uploadedDocs.findIndex(d => d === doc);
                                  const isImg = doc.base64 && (doc.base64.startsWith('data:image') || doc.base64.startsWith('http'));
                                  return (
                                    <div key={idx} style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.3rem 0.5rem',
                                      background: 'rgba(0, 0, 0, 0.05)',
                                      border: '1px solid #000000',
                                      borderRadius: '4px',
                                      fontSize: '0.72rem',
                                      gap: '0.5rem'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', flexGrow: 1 }}>
                                        {isImg ? <Image size={12} color="#10b981" /> : <FileText size={12} color="#3b82f6" />}
                                        <span style={{ color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={doc.name}>
                                          {doc.name}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={inspectingReceiptId !== null}
                                        onClick={() => handleRemoveDoc(originalIdx)}
                                        style={{ color: '#ef4444', background: 'none', border: 'none', cursor: inspectingReceiptId ? 'default' : 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gate Checklist */}
                  <div style={{ background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--color-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <ShieldAlert size={14} /> Checklist chốt cổng kiểm hồ sơ chứng từ (SOP bắt buộc)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-main)', cursor: inspectingReceiptId ? 'default' : 'pointer', margin: 0 }}>
                        <input type="checkbox" disabled={inspectingReceiptId !== null} checked={checkInvoiceMatches} onChange={e => setCheckInvoiceMatches(e.target.checked)} style={{ width: '15px', height: '15px' }} />
                        <span>Xác nhận thông tin hóa đơn tài chính hoàn toàn khớp với hợp đồng mua bán thầu và phiếu xuất kho.</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-main)', cursor: inspectingReceiptId ? 'default' : 'pointer', margin: 0 }}>
                        <input type="checkbox" disabled={inspectingReceiptId !== null} checked={checkTempHumidity} onChange={e => setCheckTempHumidity(e.target.checked)} style={{ width: '15px', height: '15px' }} />
                        <span>Xác nhận thiết bị vận chuyển đạt nhiệt độ/độ ẩm bảo quan (Nếu có thuốc giữ lạnh - Không bắt buộc).</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-main)', cursor: inspectingReceiptId ? 'default' : 'pointer', margin: 0 }}>
                        <input type="checkbox" disabled={inspectingReceiptId !== null} checked={checkDeliveryRecordSigned} onChange={e => setCheckDeliveryRecordSigned(e.target.checked)} style={{ width: '15px', height: '15px' }} />
                        <span>Biên bản giao nhận hàng đã được ký xác nhận đầy đủ giữa đại diện bên giao và bên nhận.</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-main)', cursor: inspectingReceiptId ? 'default' : 'pointer', margin: 0 }}>
                        <input type="checkbox" disabled={inspectingReceiptId !== null} checked={checkDeliverySlipUploaded} onChange={e => setCheckDeliverySlipUploaded(e.target.checked)} style={{ width: '15px', height: '15px' }} />
                        <span>Phiếu xuất kho của nhà cung cấp đã được tải lên và đối chiếu đầy đủ.</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-main)', cursor: inspectingReceiptId ? 'default' : 'pointer', margin: 0 }}>
                        <input type="checkbox" disabled={inspectingReceiptId !== null} checked={checkContractUploaded} onChange={e => setCheckContractUploaded(e.target.checked)} style={{ width: '15px', height: '15px' }} />
                        <span>Hợp đồng mua bán/thầu đã được tải lên và đối chiếu đảm bảo hàng giao đúng danh mục thầu.</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* WIZARD STEP 2: CẢM QUAN & SỐ LƯỢNG */}
              {activeStep === 2 && (
                <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h4 style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileCheck size={16} color="#10b981" /> Bước 2: Kiểm nhập thực tế số lượng & Cảm quan lâm sàng
                    </h4>

                    {/* Excel tools */}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.06)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)', fontWeight: '600' }}
                        onClick={handleDownloadTemplate}
                      >
                        <FileSpreadsheet size={12} /> Mẫu Excel
                      </button>
                      <label
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', cursor: 'pointer', background: 'rgba(59, 130, 246, 0.06)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.2)', fontWeight: '600', margin: 0 }}
                      >
                        <Plus size={12} /> Tải Excel
                        <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleExcelUpload} />
                      </label>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', fontWeight: '500' }}
                        onClick={handleAddItemRow}
                      >
                        <Plus size={12} /> Thêm thuốc
                      </button>
                    </div>
                  </div>

                  {/* Items Table container */}
                  <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem', marginBottom: '1rem', border: '1px solid var(--border-glass)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                    {items.map((item, idx) => {
                      const selectedMed = medicines.find(m => m.medicineID.toString() === item.medicineID);
                      const unit = selectedMed?.unit || '-';
                      const price = parseFloat(item.importPrice) || 0;
                      const qty = parseInt(item.quantity) || 0;
                      const total = price * qty;

                      return (
                        <div key={idx} style={{
                          borderBottom: idx < items.length - 1 ? '1px solid var(--border-glass)' : 'none',
                          padding: '0.6rem 0.75rem',
                          position: 'relative'
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr 0.5fr', gap: '0.6rem', marginBottom: '0.4rem', alignItems: 'end' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', margin: 0 }}>Dược phẩm / Thuốc (*)</label>
                              <select
                                className="form-input"
                                value={item.medicineID}
                                onChange={e => handleItemChange(idx, 'medicineID', e.target.value)}
                                style={{ height: '33px', fontSize: '0.78rem', padding: '0 0.5rem' }}
                              >
                                <option value="">-- Chọn dược phẩm --</option>
                                {medicines.map(m => (
                                  <option key={m.medicineID} value={m.medicineID}>{m.medicineName}</option>
                                ))}
                              </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', margin: 0 }}>Số lô thầu (*)</label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Số lô thầu"
                                value={item.batchNumber}
                                onChange={e => handleItemChange(idx, 'batchNumber', e.target.value)}
                                style={{ height: '33px', fontSize: '0.78rem', padding: '0 0.5rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', margin: 0, textAlign: 'center' }}>ĐVT</label>
                              <input
                                type="text"
                                className="form-input"
                                value={unit}
                                disabled
                                style={{ height: '33px', fontSize: '0.78rem', background: 'rgba(255,255,255,0.02)', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border-glass)', padding: '0 0.5rem' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1fr 1fr 1.1fr', gap: '0.6rem', alignItems: 'end' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', margin: 0 }}>Ngày sản xuất (NSX)</label>
                              <input
                                type="date"
                                className="form-input"
                                value={item.productionDate}
                                onChange={e => handleItemChange(idx, 'productionDate', e.target.value)}
                                style={{ height: '33px', fontSize: '0.78rem', padding: '0 0.5rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', margin: 0 }}>Hạn sử dụng (HSD)</label>
                              <input
                                type="date"
                                className="form-input"
                                value={item.expiryDate}
                                onChange={e => handleItemChange(idx, 'expiryDate', e.target.value)}
                                style={{ height: '33px', fontSize: '0.78rem', padding: '0 0.5rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', margin: 0 }}>Đơn giá nhập</label>
                              <input
                                type="number"
                                className="form-input"
                                placeholder="Đơn giá"
                                value={item.importPrice}
                                onChange={e => handleItemChange(idx, 'importPrice', e.target.value)}
                                style={{ height: '33px', fontSize: '0.78rem', padding: '0 0.5rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', margin: 0 }}>Số lượng (SL)</label>
                              <input
                                type="number"
                                className="form-input"
                                placeholder="SL"
                                value={item.quantity}
                                onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                                style={{ height: '33px', fontSize: '0.78rem', padding: '0 0.5rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', margin: 0 }}>Thành tiền</label>
                              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', height: '33px', paddingLeft: '0.2rem' }}>
                                {total.toLocaleString('vi-VN')} đ
                              </div>
                            </div>
                          </div>

                          {items.length > 1 && (
                            <button
                              type="button"
                              className="btn-danger"
                              style={{ position: 'absolute', top: '0.3rem', right: '0.3rem', padding: '0.15rem', borderRadius: '4px' }}
                              onClick={() => handleRemoveItemRow(idx)}
                            >
                              <Trash size={11} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Form Total display */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: '500', color: 'var(--text-muted)' }}>Tổng cộng tiền hàng tạm tính:</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--color-primary)' }}>{calculateFormTotal().toLocaleString('vi-VN')} VNĐ</span>
                  </div>

                  {/* Sensory Image upload */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Chụp cảm quan hàng hóa thực tế (Bước 4 SOP)</label>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.6rem', border: '1px dashed var(--border-glass)', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Tải ảnh chụp cảm quan thuốc</span>
                        <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: '#10b981', fontWeight: '600', margin: 0 }}>
                          <Upload size={12} /> Tải ảnh
                          <input type="file" style={{ display: 'none' }} accept="image/*" multiple onChange={(e) => handleFileChange(e, 'sensory')} />
                        </label>
                      </div>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-glass)', paddingLeft: '1rem' }}>
                      <label style={{ color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: '600', display: 'block', marginBottom: '0.4rem' }}>Ảnh chụp cảm quan đã đính kèm</label>
                      <div style={{ maxHeight: '75px', overflowY: 'auto' }}>
                        {uploadedDocs.filter(d => d.type === 'sensory').length === 0 ? (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có ảnh chụp thực tế.</div>
                        ) : (
                          renderUploadedFilesList('sensory')
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Gate Checklist Step 2 */}
                  <div style={{ background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', padding: '0.6rem 0.8rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#10b981', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <ShieldAlert size={14} /> Checklist chốt cổng kiểm cảm quan & số lượng (SOP bắt buộc)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0 }}>
                        <input type="checkbox" checked={checkPackagingIntact} onChange={e => setCheckPackagingIntact(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                        <span>Bao bì nguyên vẹn, vỏ hộp ngoài không móp méo, rách nát hay ẩm ướt.</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0 }}>
                        <input type="checkbox" checked={checkLabelingClear} onChange={e => setCheckLabelingClear(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                        <span>Nhãn mác bao bì rõ ràng, đầy đủ thông tin số đăng ký, số lô, hạn sử dụng.</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-main)', cursor: 'pointer', margin: 0 }}>
                        <input type="checkbox" checked={checkSensoryOk} onChange={e => setCheckSensoryOk(e.target.checked)} style={{ width: '14px', height: '14px' }} />
                        <span>Cảm quan viên/thuốc đạt chuẩn y tế (không đổi màu, vón cục, vẩn đục, không nứt vỡ blister).</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* WIZARD STEP 3: XỬ LÝ BẤT THƯỜNG */}
              {activeStep === 3 && (
                <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                  <h4 style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldAlert size={16} color={isAnomaly ? 'var(--color-primary)' : 'var(--text-muted)'} /> Bước 3: Phân loại sự cố & Quy trình xử lý bất thường (SOP Bước 5)
                  </h4>

                  <div style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)' }}>Phát hiện bất thường trong lô thuốc bàn giao?</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Bật nếu phát hiện lỗi bao bì, móp méo, nhiệt độ lệch, cận date hoặc thiếu hụt số lượng thầu.</div>
                    </div>

                    {/* Toggle Switch */}
                    <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={isAnomaly}
                        onChange={e => setIsAnomaly(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: isAnomaly ? '#ef4444' : 'rgba(255,255,255,0.15)',
                        borderRadius: '34px',
                        transition: '0.3s',
                      }}>
                        <span style={{
                          position: 'absolute',
                          content: '""',
                          height: '18px', width: '18px',
                          left: isAnomaly ? '28px' : '4px',
                          bottom: '4px',
                          backgroundColor: '#fff',
                          borderRadius: '50%',
                          transition: '0.3s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }} />
                      </span>
                    </label>
                  </div>

                  {/* If NO Anomaly detected */}
                  {!isAnomaly && (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.05)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: '8px',
                      padding: '1.5rem',
                      textAlign: 'center',
                      marginBottom: '2rem',
                      animation: 'fadeIn 0.3s ease'
                    }}>
                      <FileCheck size={44} color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
                      <h5 style={{ color: '#10b981', fontWeight: '700', fontSize: '0.88rem', margin: '0 0 0.4rem 0' }}>Lô hàng sạch tiêu chuẩn</h5>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                        Không phát hiện bất thường nào về hồ sơ chứng từ, cảm quan hay số lượng bàn giao thực tế.<br />
                        Nhấn nút <strong>Tiếp tục</strong> bên dưới để tiến hành ký nhận người kiểm thứ hai và lập biên bản.
                      </p>
                    </div>
                  )}

                  {/* If Anomaly IS detected (SOP Quarantine & Exception handle) */}
                  {isAnomaly && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.03)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1rem',
                      animation: 'fadeIn 0.3s ease'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: '700' }}>Biện pháp xử lý bất thường (Trạng thái) (*)</label>
                          <select
                            className="form-input"
                            value={anomalyStatus}
                            onChange={e => setAnomalyStatus(e.target.value)}
                            style={{ height: '36px', fontSize: '0.82rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          >
                            <option value="Từ chối">Từ chối nhập (Trả lại nhà cung cấp lập tức)</option>
                            <option value="Thiếu hàng">Nhận thiếu (Nhận theo số lượng thực tế)</option>
                            <option value="Chờ kiểm nghiệm">Chờ kiểm nghiệm (Cô lập cách ly tại kho GSP)</option>
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.78rem' }}>Tải lên Biên bản sự cố bất thường (PDF/Ảnh)</label>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.6rem', border: '1px dashed rgba(239, 68, 68, 0.3)', borderRadius: '6px', height: '36px' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Chọn biên bản sự cố</span>
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: '#ef4444', fontWeight: '600', margin: 0 }}>
                              <Upload size={12} /> Đính kèm
                              <input type="file" style={{ display: 'none' }} accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'anomaly_report')} />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                        <label className="form-label" style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: '600' }}>Mô tả chi tiết sự cố bất thường (*)</label>
                        <textarea
                          className="form-input"
                          placeholder="Nhập mô tả cụ thể: Số lượng thiếu bao nhiêu? Trạng thái móp méo cụ thể ra sao? Nhiệt độ ghi nhận lúc nhận là bao nhiêu độ C?..."
                          value={anomalyDescription}
                          onChange={e => setAnomalyDescription(e.target.value)}
                          style={{ height: '70px', fontSize: '0.82rem', resize: 'none', paddingTop: '0.35rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        />
                      </div>

                      {/* Show anomaly file attachments */}
                      {uploadedDocs.filter(d => d.type === 'anomaly_report').length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem' }}>
                          <label style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontWeight: '600', display: 'block', marginBottom: '0.2rem' }}>Biên bản bất thường đã tải lên:</label>
                          {renderUploadedFilesList('anomaly_report')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* WIZARD STEP 4: NHẬP KHO & HOÀN TẤT */}
              {activeStep === 4 && (
                <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                  <h4 style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <FileCheck size={16} color="var(--color-primary)" /> Bước 4: Lập Biên bản Kiểm nhập (SOP Bước 6)
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>

                    {/* Left Column: Sign-off details */}
                    <div>
                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>Dược sĩ cùng kiểm tra (Người kiểm thứ hai) (*)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nhập tên dược sĩ khác cùng đối chiếu"
                          value={secondInspector}
                          onChange={e => setSecondInspector(e.target.value)}
                          style={{ height: '38px', fontSize: '0.82rem' }}
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                          * SOP yêu cầu tối thiểu 02 cán bộ y tế thực hiện đối chiếu kiểm nhận thuốc thầu để đảm bảo khách quan.
                        </span>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>Ghi chú hoàn tất biên bản kiểm nhận</label>
                        <textarea
                          className="form-input"
                          placeholder="Nhập ghi chú chung hoặc tóm tắt kết luận cảm quan (nếu có)..."
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          style={{ height: '80px', fontSize: '0.82rem', resize: 'none', paddingTop: '0.35rem' }}
                        />
                      </div>
                    </div>

                    {/* Right Column: Summarized Invoice Card */}
                    <div style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '10px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>Tóm tắt kết quả kiểm nhận</h5>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                          <div><strong>Nhà cung cấp:</strong> {suppliers.find(s => s.supplierID.toString() === selectedSupplier)?.supplierName || 'N/A'}</div>
                          <div><strong>Hợp đồng thầu:</strong> {contractNumber || 'N/A'}</div>
                          <div><strong>Hóa đơn GTGT (VAT):</strong> {invoiceNumber} (Ngày: {invoiceDate})</div>
                          <div><strong>Người kiểm nhận 1:</strong> {createdBy}</div>
                          <div><strong>Kết quả kiểm cảm quan:</strong> {getStatusBadge(isAnomaly ? anomalyStatus : 'Đạt kiểm nhập')}</div>
                          <div><strong>Số loại thuốc:</strong> {items.length} mặt hàng</div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '500' }}>Tổng giá trị hàng:</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--color-primary)' }}>{calculateFormTotal().toLocaleString('vi-VN')} VNĐ</span>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* NAVIGATION CONTROLS */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--border-glass)',
                paddingTop: '1rem',
                marginTop: '1.5rem'
              }}>
                {activeStep > 1 ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handlePrevStep}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '38px', padding: '0 1rem', fontSize: '0.82rem' }}
                  >
                    <ArrowLeft size={16} /> Quay lại
                  </button>
                ) : (
                  inspectingReceiptId ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCancelInspection}
                      style={{ height: '38px', padding: '0 1rem', fontSize: '0.82rem', borderColor: '#ef4444', color: '#ef4444', background: 'none' }}
                    >
                      Thoát chế độ kiểm
                    </button>
                  ) : <div />
                )}

                {activeStep === 1 ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!inspectingReceiptId && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={(e) => handleSubmitImport(e, true)}
                        disabled={isSubmitting}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '38px', padding: '0 1rem', fontSize: '0.82rem', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.25)', fontWeight: '600' }}
                      >
                        <FileText size={16} /> {isSubmitting ? 'Đang lưu...' : 'Lưu hồ sơ Tiếp nhận'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-premium"
                      onClick={handleNextStep}
                      disabled={isSubmitting}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '38px', padding: '0 1rem', fontSize: '0.82rem' }}
                    >
                      {inspectingReceiptId ? 'Tiến hành Kiểm hàng' : 'Kiểm nhập ngay'} <ArrowRight size={16} />
                    </button>
                  </div>
                ) : activeStep < 4 ? (
                  <button
                    type="button"
                    className="btn-premium"
                    onClick={handleNextStep}
                    disabled={isSubmitting}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '38px', padding: '0 1rem', fontSize: '0.82rem' }}
                  >
                    Tiếp tục <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn-premium"
                    disabled={isSubmitting}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      height: '38px',
                      padding: '0 1.25rem',
                      fontSize: '0.82rem',
                      background: isAnomaly && anomalyStatus === 'Từ chối'
                        ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                        : 'linear-gradient(135deg, var(--color-primary), #2563eb)'
                    }}
                  >
                    <Check size={16} /> {isSubmitting ? 'Đang xử lý...' : (isAnomaly && anomalyStatus === 'Từ chối' ? 'Lưu Phiếu Từ Chối & Hủy Lô' : 'Hoàn Tất Kiểm Nhận')}
                  </button>
                )}
              </div>

            </form>
          </div>
        )}

        {/* Right Side: Historical Imports list with SOP elements */}
        <div className="glass-card" style={{
          padding: '1.5rem',
          maxHeight: user?.role === 'director' ? '800px' : '620px',
          display: 'flex',
          flexDirection: 'column',
          width: '100%'
        }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', fontSize: '1.05rem' }}>
            <Printer size={18} color="var(--color-secondary)" /> {user?.role === 'director' ? 'Danh sách hồ sơ chờ duyệt nhập kho' : 'Bộ chứng từ kiểm nhận gần đây'}
          </h3>

          {/* Top Filter Tabs Bar */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border-glass)',
            paddingBottom: '0.5rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}>
            <button
              type="button"
              style={{
                background: filterStatus === 'all' ? 'rgba(59, 130, 246, 0.1)' : 'none',
                border: filterStatus === 'all' ? '1px solid #3b82f6' : '1px solid transparent',
                color: filterStatus === 'all' ? '#3b82f6' : 'var(--text-main)',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              onClick={() => setFilterStatus('all')}
            >
              Tất cả ({imports.length})
            </button>
            <button
              type="button"
              style={{
                background: filterStatus === 'pending_approval' ? 'rgba(245, 158, 11, 0.1)' : 'none',
                border: filterStatus === 'pending_approval' ? '1px solid #f59e0b' : '1px solid transparent',
                color: filterStatus === 'pending_approval' ? '#f59e0b' : 'var(--text-main)',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              onClick={() => setFilterStatus('pending_approval')}
            >
              Cần duyệt ({imports.filter(imp => (imp.status === 'Đạt kiểm nhập' || imp.status === 'Thiếu hàng' || imp.status === 'Chờ kiểm nghiệm')).length})
              {imports.filter(imp => (imp.status === 'Đạt kiểm nhập' || imp.status === 'Thiếu hàng' || imp.status === 'Chờ kiểm nghiệm')).length > 0 && (
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 6px #ef4444' }} />
              )}
            </button>
            {user?.role === 'pharmacist' && (
              <button
                type="button"
                style={{
                  background: filterStatus === 'awaiting_inspection' ? 'rgba(59, 130, 246, 0.1)' : 'none',
                  border: filterStatus === 'awaiting_inspection' ? '1px solid #3b82f6' : '1px solid transparent',
                  color: filterStatus === 'awaiting_inspection' ? '#3b82f6' : 'var(--text-main)',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
                onClick={() => setFilterStatus('awaiting_inspection')}
              >
                Chờ kiểm ({imports.filter(imp => (imp.status === 'Chờ kiểm nhập' || imp.status === 'Pending')).length})
              </button>
            )}
            <button
              type="button"
              style={{
                background: filterStatus === 'imported' ? 'rgba(16, 185, 129, 0.1)' : 'none',
                border: filterStatus === 'imported' ? '1px solid #10b981' : '1px solid transparent',
                color: filterStatus === 'imported' ? '#10b981' : 'var(--text-main)',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              onClick={() => setFilterStatus('imported')}
            >
              Đã nhập kho ({imports.filter(imp => (imp.status === 'Đã nhập kho' || imp.status === 'Đã kiểm' || imp.status === 'Approved' || imp.status === 'Shortage')).length})
            </button>
            <button
              type="button"
              style={{
                background: filterStatus === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'none',
                border: filterStatus === 'rejected' ? '1px solid #ef4444' : '1px solid transparent',
                color: filterStatus === 'rejected' ? '#ef4444' : 'var(--text-main)',
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              onClick={() => setFilterStatus('rejected')}
            >
              Bị từ chối ({imports.filter(imp => imp.status === 'Từ chối').length})
            </button>
          </div>

          <div style={{
            flexGrow: 1,
            overflowY: 'auto',
            paddingRight: '0.25rem',
            display: user?.role === 'director' ? 'grid' : 'block',
            gridTemplateColumns: user?.role === 'director' ? 'repeat(auto-fill, minmax(420px, 1fr))' : 'none',
            gap: user?.role === 'director' ? '1rem' : '0'
          }}>
            {getFilteredImports().length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>Không có hồ sơ nào trong mục này.</p>
            ) : (
              getFilteredImports().map(imp => {
                const isAwaitingInspection = imp.status === 'Chờ kiểm nhập' || imp.status === 'Pending';
                const isPassedInspection = imp.status === 'Đạt kiểm nhập' || imp.status === 'Thiếu hàng' || imp.status === 'Chờ kiểm nghiệm';
                const isImported = imp.status === 'Đã nhập kho' || imp.status === 'Đã kiểm' || imp.status === 'Approved' || imp.status === 'Shortage';

                const receiptTotal = imp.details?.reduce((sum, d) => sum + ((d.batch?.importPrice || 0) * d.quantity), 0) || 0;

                let hasDocs = false;
                try {
                  const parsedDocs = JSON.parse(imp.documentsJson || '[]');
                  hasDocs = parsedDocs.length > 0;
                } catch (e) {
                  hasDocs = false;
                }

                return (
                  <div key={imp.importID} style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '10px',
                    padding: '0.8rem',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontWeight: '800', color: 'var(--color-primary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {imp.importCode || `PNK-${imp.importID}`}
                          {getStatusBadge(imp.status)}
                          {hasDocs && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                fetch(`/api/import/${imp.importID}`)
                                  .then(res => {
                                    if (!res.ok) throw new Error("Không thể tải hồ sơ chi tiết phiếu");
                                    return res.json();
                                  })
                                  .then(fullImp => {
                                    setActiveReceiptForDossier(fullImp);
                                    setActiveDossierIndex(0);
                                  })
                                  .catch(err => alert("Lỗi: " + err.message));
                              }}
                              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.1rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                              title="Click để xem nhanh hồ sơ chứng từ đã lưu"
                            >
                              <FileCheck size={10} /> Hồ sơ
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.76rem', fontWeight: '500', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                          {imp.supplier?.supplierName}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        {receiptTotal.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    {/* Visual GSP timeline */}
                    {renderCardTimeline(imp.status)}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                      <div><strong style={{ color: 'var(--text-dim)' }}>Hóa đơn:</strong> {imp.invoiceNumber || 'N/A'}</div>
                      <div><strong style={{ color: 'var(--text-dim)' }}>Hợp đồng:</strong> {imp.contractNumber || 'N/A'}</div>
                      <div><strong style={{ color: 'var(--text-dim)' }}>Người kiểm 1:</strong> {imp.createdBy || 'N/A'}</div>
                      <div><strong style={{ color: 'var(--text-dim)' }}>Người kiểm 2:</strong> {imp.secondInspector || 'N/A'}</div>
                    </div>

                    {imp.anomalyDescription && (
                      <div style={{ fontSize: '0.72rem', color: '#ef4444', fontStyle: 'italic', background: 'rgba(239, 68, 68, 0.03)', borderLeft: '2px solid #ef4444', padding: '0.2rem 0.4rem', borderRadius: '0 4px 4px 0' }}>
                        Sự cố: {imp.anomalyDescription}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      <span>{new Date(imp.importDate).toLocaleString('vi-VN')}</span>

                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {hasDocs && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', height: '26px', display: 'flex', alignItems: 'center', gap: '0.2rem', borderColor: '#10b981', color: '#10b981', background: 'rgba(16, 185, 129, 0.04)' }}
                            onClick={() => {
                              fetch(`/api/import/${imp.importID}`)
                                .then(res => {
                                  if (!res.ok) throw new Error("Không thể tải hồ sơ chi tiết phiếu");
                                  return res.json();
                                })
                                .then(fullImp => {
                                  setActiveReceiptForDossier(fullImp);
                                  setActiveDossierIndex(0);
                                })
                                .catch(err => alert("Lỗi: " + err.message));
                            }}
                            title="Xem lại toàn bộ hồ sơ chứng từ, hợp đồng, hóa đơn và ảnh chụp thực tế đã tải lên"
                          >
                            <Eye size={12} /> Xem hồ sơ
                          </button>
                        )}
                        {isAwaitingInspection && user?.role === 'pharmacist' && (
                          <button
                            type="button"
                            className="btn-premium"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', height: '26px', background: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: '600' }}
                            onClick={() => {
                              fetch(`/api/import/${imp.importID}`)
                                .then(res => {
                                  if (!res.ok) throw new Error("Không thể tải hồ sơ chi tiết phiếu");
                                  return res.json();
                                })
                                .then(fullImp => handleStartInspection(fullImp))
                                .catch(err => alert("Lỗi: " + err.message));
                            }}
                            title="Bắt đầu kiểm đếm số lượng và cảm quan thuốc thực tế tại kho GSP"
                          >
                            <FileEdit size={12} /> Kiểm thực tế
                          </button>
                        )}

                        {isAwaitingInspection && user?.role === 'pharmacist' && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', height: '26px', display: 'flex', alignItems: 'center', gap: '0.2rem', borderColor: '#eab308', color: '#eab308', background: 'rgba(234, 179, 8, 0.04)' }}
                            onClick={() => {
                              fetch(`/api/import/${imp.importID}`)
                                .then(res => {
                                  if (!res.ok) throw new Error("Không thể tải hồ sơ chi tiết phiếu");
                                  return res.json();
                                })
                                .then(fullImp => handleStartEdit(fullImp))
                                .catch(err => alert("Lỗi: " + err.message));
                            }}
                            title="Điều chỉnh thông tin phiếu nhập khi chưa ký duyệt"
                          >
                            <FileEdit size={12} /> Điều chỉnh
                          </button>
                        )}
                        {isPassedInspection && imp.status !== 'Từ chối' && user?.role === 'director' && (
                          <button
                            type="button"
                            className="btn-premium"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', height: '26px', background: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: '600' }}
                            onClick={() => handleApproveImport(imp.importID)}
                            title="Phê duyệt thực nhập kho chẵn và cộng tồn kho hệ thống"
                          >
                            <Check size={12} /> Duyệt thực nhập
                          </button>
                        )}
                        {isPassedInspection && imp.status !== 'Từ chối' && user?.role === 'pharmacist' && (
                          <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.5rem', border: '1px dashed rgba(245, 158, 11, 0.3)', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.03)', height: '26px' }}>
                            <RefreshCw size={12} className="spin" /> Chờ Ban lãnh đạo duyệt
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', height: '26px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                          onClick={() => {
                            fetch(`/api/import/${imp.importID}`)
                              .then(res => {
                                if (!res.ok) throw new Error("Không thể tải hồ sơ chi tiết phiếu");
                                return res.json();
                              })
                              .then(fullImp => setActiveReceiptForPrint(fullImp))
                              .catch(err => alert("Lỗi: " + err.message));
                          }}
                          title="Xem / In biên bản kiểm nhập"
                        >
                          <Printer size={12} /> In biên bản
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* PRINT MODAL (BIÊN BẢN KIỂM NHẬP CHUYÊN NGHIỆP SOP) */}
      {activeReceiptForPrint && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', background: '#fff', color: '#000', padding: '2rem 2.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <button
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setActiveReceiptForPrint(null)}
            >
              <X size={24} />
            </button>

            {/* Printable Area */}
            <div id="printable-invoice">
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>
                <div>
                  <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.95rem', fontWeight: 'bold' }}>BỆNH VIỆN TRUNG ƯƠNG</h4>
                  <h5 style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#444', fontWeight: '500' }}>KHOA DƯỢC - VẬT TƯ Y TẾ</h5>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>Địa chỉ: Số 12 Tràng Thi, Hoàn Kiếm, Hà Nội</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase' }}>BIÊN BẢN KIỂM NHẬP THUỐC / VẬT TƯ</h4>
                  <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.82rem', color: '#333', fontWeight: '600' }}>Số phiếu nhập: {activeReceiptForPrint.importCode}</p>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: '#666' }}>Trạng thái: <strong>{activeReceiptForPrint.status}</strong></p>
                </div>
              </div>

              {/* Thông tin chung bộ chứng từ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', fontSize: '0.82rem', marginBottom: '1rem', lineHeight: '1.4' }}>
                <div>
                  <p style={{ margin: '0.25rem 0' }}><strong>Đơn vị giao hàng (NCC):</strong> {activeReceiptForPrint.supplier?.supplierName}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Điện thoại liên hệ:</strong> {activeReceiptForPrint.supplier?.phone || '-'}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Địa chỉ nhà cung cấp:</strong> {activeReceiptForPrint.supplier?.address || '-'}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Ngày thực hiện kiểm nhận:</strong> {new Date(activeReceiptForPrint.importDate).toLocaleString('vi-VN')}</p>
                </div>
                <div>
                  <p style={{ margin: '0.25rem 0' }}><strong>Số hợp đồng thầu/mua bán:</strong> {activeReceiptForPrint.contractNumber || 'N/A'}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Số hóa đơn GTGT (VAT):</strong> {activeReceiptForPrint.invoiceNumber || 'N/A'} {activeReceiptForPrint.invoiceDate && `(Ngày: ${new Date(activeReceiptForPrint.invoiceDate).toLocaleDateString('vi-VN')})`}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Số phiếu xuất kho (NCC):</strong> {activeReceiptForPrint.deliveryNoteNumber || 'N/A'}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Cán bộ kiểm nhận (Dược sĩ 1):</strong> {activeReceiptForPrint.createdBy || 'N/A'}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Dược sĩ cùng kiểm (Dược sĩ 2):</strong> {activeReceiptForPrint.secondInspector || 'N/A'}</p>
                </div>
              </div>

              {/* Anomaly warning section if exists */}
              {activeReceiptForPrint.anomalyDescription && (
                <div style={{ padding: '0.6rem 0.8rem', background: '#fff1f2', border: '1px solid #fda4af', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem', color: '#9f1239', lineHeight: '1.4' }}>
                  <strong>CẢNH BÁO BẤT THƯỜNG / SỰ CỐ GHI NHẬN:</strong> {activeReceiptForPrint.anomalyDescription}
                </div>
              )}

              {activeReceiptForPrint.notes && (
                <div style={{ padding: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem', fontStyle: 'italic' }}>
                  <strong>Ghi chú kiểm duyệt cảm quan:</strong> {activeReceiptForPrint.notes}
                </div>
              )}

              {/* Table of items */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #000' }}>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', width: '35px' }}>STT</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'left' }}>Tên thuốc / hóa chất / vật tư</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', width: '75px' }}>Số lô</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', width: '85px' }}>Ngày SX</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', width: '85px' }}>Hạn dùng</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center', width: '45px' }}>ĐVT</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', width: '55px' }}>SL</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', width: '80px' }}>Đơn giá</th>
                    <th style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', width: '95px' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReceiptForPrint.details && activeReceiptForPrint.details.length > 0 ? (
                    activeReceiptForPrint.details.map((d, index) => {
                      const price = d.batch?.importPrice || 0;
                      const total = price * d.quantity;
                      return (
                        <tr key={d.importDetailID} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>{index + 1}</td>
                          <td style={{ border: '1px solid #ddd', padding: '6px' }}>
                            <div><strong>{d.batch?.medicine?.medicineName}</strong></div>
                            <div style={{ fontSize: '0.72rem', color: '#555' }}>Mã số: {d.batch?.medicine?.medicineCode} | Hoạt chất: {d.batch?.medicine?.genericName || '-'}</div>
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>{d.batch?.batchNumber}</td>
                          <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                            {d.batch?.productionDate ? new Date(d.batch.productionDate).toLocaleDateString('vi-VN') : '-'}
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>
                            {new Date(d.batch?.expiryDate).toLocaleDateString('vi-VN')}
                          </td>
                          <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'center' }}>{d.batch?.medicine?.unit}</td>
                          <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>{d.quantity}</td>
                          <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right' }}>{price.toLocaleString('vi-VN')} đ</td>
                          <td style={{ border: '1px solid #ddd', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{total.toLocaleString('vi-VN')} đ</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                        Hồ sơ tiếp nhận giấy tờ. Chưa có chi tiết kiểm nhận thuốc thực tế.
                      </td>
                    </tr>
                  )}
                  <tr style={{ background: '#fafafa', fontWeight: 'bold' }}>
                    <td colSpan="8" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Tổng giá trị kiểm nhập:</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right', color: '#0d9488', fontSize: '0.85rem' }}>
                      {activeReceiptForPrint.details?.reduce((sum, d) => sum + ((d.batch?.importPrice || 0) * d.quantity), 0).toLocaleString('vi-VN') || 0} đ
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures block (4-column complete legal sign-off) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', textAlign: 'center', fontSize: '0.8rem', marginTop: '1.5rem', lineHeight: '1.35' }}>
                <div>
                  <p style={{ margin: 0 }}><strong>Đại diện bên giao hàng</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký tay trên hệ thống)</p>
                  {activeReceiptForPrint.deliveryPersonSignature ? (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <img src={activeReceiptForPrint.deliveryPersonSignature} alt="Chữ ký Người giao" style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0', color: '#888', fontSize: '0.7rem' }}>- Chưa ký -</div>
                  )}
                  <p style={{ fontWeight: 'bold' }}>Người giao hàng</p>
                </div>
                <div>
                  <p style={{ margin: 0 }}><strong>Cán bộ kiểm nhận (Thủ kho)</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký tay trên hệ thống)</p>
                  {activeReceiptForPrint.digitalSignature ? (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <img src={activeReceiptForPrint.digitalSignature} alt="Chữ ký Thủ kho" style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0', color: '#888', fontSize: '0.7rem' }}>- Chưa ký -</div>
                  )}
                  <p style={{ fontWeight: 'bold' }}>{activeReceiptForPrint.createdBy}</p>
                </div>
                <div>
                  <p style={{ margin: 0 }}><strong>Dược sĩ cùng kiểm</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký tay trên hệ thống)</p>
                  {activeReceiptForPrint.secondInspectorSignature ? (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <img src={activeReceiptForPrint.secondInspectorSignature} alt="Chữ ký Dược sĩ 2" style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0', color: '#888', fontSize: '0.7rem' }}>- Chưa ký -</div>
                  )}
                  <p style={{ fontWeight: 'bold' }}>{activeReceiptForPrint.secondInspector || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: 0 }}><strong>Đại diện ban lãnh đạo</strong></p>
                  <p style={{ margin: '0.1rem 0 0 0', color: '#555', fontStyle: 'italic' }}>(Ký tay trên hệ thống)</p>
                  {activeReceiptForPrint.approverSignature ? (
                    <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <img src={activeReceiptForPrint.approverSignature} alt="Chữ ký Ban lãnh đạo" style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain' }} />
                    </div>
                  ) : activeReceiptForPrint.status === 'Đã nhập kho' ? (
                    <div style={{ height: '55px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <span style={{ border: '2px solid #10b981', color: '#10b981', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 'bold', textTransform: 'uppercase', transform: 'rotate(-5deg)' }}>ĐÃ DUYỆT NHẬP</span>
                    </div>
                  ) : activeReceiptForPrint.status === 'Từ chối' ? (
                    <div style={{ height: '55px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <span style={{ border: '2px solid #ef4444', color: '#ef4444', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 'bold', textTransform: 'uppercase', transform: 'rotate(-5deg)' }}>TỪ CHỐI LÔ</span>
                    </div>
                  ) : (
                    <div style={{ height: '55px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                      <span style={{ border: '1px dashed #94a3b8', color: '#94a3b8', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.66rem' }}>CHỜ DUYỆT</span>
                    </div>
                  )}
                  <p style={{ fontWeight: 'bold' }}>
                    {activeReceiptForPrint.status === 'Đã nhập kho' || activeReceiptForPrint.status === 'Đã kiểm' || activeReceiptForPrint.status === 'Approved'
                      ? 'PGS.TS. Lê Minh Dược'
                      : activeReceiptForPrint.status === 'Từ chối'
                        ? 'PGS.TS. Lê Minh Dược'
                        : 'Ban Giám Đốc'}
                  </p>
                </div>
              </div>

              {/* Printable Attachments / Sensory Images Section */}
              {(() => {
                let docs = [];
                try {
                  docs = JSON.parse(activeReceiptForPrint.documentsJson || '[]');
                } catch (e) {
                  docs = [];
                }
                if (docs.length === 0) return null;

                return (
                  <div style={{ marginTop: '2.5rem', borderTop: '2px solid #333', paddingTop: '1.2rem', pageBreakBefore: 'always' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '1rem', color: '#333' }}>
                      Phần Phụ Lục: Hồ sơ chứng từ & Hình ảnh cảm quan kiểm nhận đính kèm
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      {docs.map((doc, dIdx) => {
                        const isImage = doc.base64 && (doc.base64.startsWith('data:image') || doc.base64.startsWith('http'));
                        return (
                          <div key={dIdx} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.6rem', background: '#f8fafc' }}>
                            <div style={{ fontSize: '0.74rem', fontWeight: '700', color: '#334155', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '70%' }}>{doc.name}</span>
                              <span style={{ color: '#0d9488', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                                {doc.type === 'invoice' && 'Hóa đơn thầu'}
                                {doc.type === 'coa_coo' && 'COA/COO'}
                                {doc.type === 'temp_log' && 'Nhiệt độ vận chuyển'}
                                {doc.type === 'delivery_record' && 'Biên bản giao hàng'}
                                {doc.type === 'delivery_slip' && 'Phiếu xuất kho (NCC)'}
                                {doc.type === 'contract' && 'Hợp đồng mua bán/thầu'}
                                {doc.type === 'sensory' && 'Ảnh cảm quan'}
                                {doc.type === 'anomaly_report' && 'Biên bản bất thường'}
                              </span>
                            </div>
                            {isImage ? (
                              <img src={doc.base64} alt={doc.name} style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', borderRadius: '4px' }} />
                            ) : (
                              <div style={{ height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', background: '#f1f5f9', borderRadius: '4px' }}>
                                <FileText size={40} color="#94a3b8" />
                                <span style={{ fontSize: '0.74rem', marginTop: '0.5rem', fontWeight: '500' }}>Tài liệu đính kèm (PDF/Tệp tin)</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <button className="btn-secondary" style={{ background: '#f3f4f6', color: '#1f2937', borderColor: '#d1d5db', height: '36px', padding: '0 1rem', fontSize: '0.82rem' }} onClick={() => setActiveReceiptForPrint(null)}>
                Đóng cửa sổ
              </button>
              <button
                className="btn-premium"
                style={{ height: '36px', padding: '0 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => {
                  const printContents = document.getElementById('printable-invoice').innerHTML;
                  const originalContents = document.body.innerHTML;
                  document.body.innerHTML = printContents;
                  window.print();
                  document.body.innerHTML = originalContents;
                  window.location.reload();
                }}
              >
                <Printer size={14} /> In biên bản (A4)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SUPPLIER MODAL */}
      {showSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <button
              style={{ position: 'absolute', top: '1rem', right: '1rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setShowSupplierModal(false)}
            >
              <X size={20} />
            </button>
            <h3 style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontSize: '1.05rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Building2 size={18} color="var(--color-primary)" /> Thêm nhà cung cấp mới
            </h3>
            <form onSubmit={handleCreateSupplier}>
              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label className="form-label">Tên nhà cung cấp / Công ty bán (*)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: Công ty Dược phẩm Minh Dân"
                  value={newSupplierName}
                  onChange={e => setNewSupplierName(e.target.value)}
                  style={{ height: '36px', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label className="form-label">Số điện thoại</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: 024xxxxxxxx"
                  value={newSupplierPhone}
                  onChange={e => setNewSupplierPhone(e.target.value)}
                  style={{ height: '36px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                <label className="form-label">Địa chỉ</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: Hà Nội, Việt Nam"
                  value={newSupplierAddress}
                  onChange={e => setNewSupplierAddress(e.target.value)}
                  style={{ height: '36px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label className="form-label">Số hợp đồng mua bán thầu cố định (*)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: HĐ-025/2026"
                  value={newSupplierContractNumber}
                  onChange={e => setNewSupplierContractNumber(e.target.value)}
                  style={{ height: '36px', fontSize: '0.85rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ height: '34px', padding: '0 0.8rem', fontSize: '0.8rem' }} onClick={() => setShowSupplierModal(false)}>Hủy bỏ</button>
                <button type="submit" className="btn-premium" style={{ height: '34px', padding: '0 0.8rem', fontSize: '0.8rem' }}>Lưu thông tin</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIGITAL SIGNATURE MODAL (MULTI-SIGNATURE) */}
      {showSignatureModal && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '500px', padding: '1.5rem', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <button
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888', zIndex: 10 }}
              onClick={() => setShowSignatureModal(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PenTool size={20} color="var(--color-secondary)" /> {signatureTarget?.action === 'approve' ? 'Phê Duyệt Nhập Kho' : 'Ký Biên Bản Kiểm Nhận Điện Tử'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {signatureTarget?.action === 'approve'
                ? 'Vui lòng vẽ chữ ký tay của Ban lãnh đạo để phê duyệt nhập kho chẵn thực tế.'
                : 'Vui lòng vẽ chữ ký tay trực tiếp lên các bảng bên dưới để hoàn tất thủ tục pháp lý.'}
            </p>

            {(() => {
              if (signatureTarget?.action === 'approve') {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Chữ ký Ban Lãnh Đạo (Xác nhận duyệt nhập kho) <span style={{ color: '#ef4444' }}>*</span></span>
                        <button type="button" className="btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', height: '22px', display: 'flex', alignItems: 'center', gap: '0.15rem' }} onClick={() => clearCanvas(canvasRef4)}>
                          <Eraser size={10} /> Xóa
                        </button>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', overflow: 'hidden', height: '120px', position: 'relative' }}>
                        <canvas ref={canvasRef4} width="440" height="120" style={{ background: '#ffffff', cursor: 'crosshair', touchAction: 'none', width: '100%', height: '100%' }} />
                      </div>
                    </div>
                  </div>
                );
              }

              const { saveAsDraft } = signatureTarget || {};
              const needSig1 = !saveAsDraft;
              const needSig2 = !saveAsDraft;
              const needSig3 = !saveAsDraft;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>

                  {/* Pad 1: Thủ kho */}
                  {needSig1 && (
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>1. Chữ ký Thủ kho (Người tiếp nhận) <span style={{ color: '#ef4444' }}>*</span></span>
                        <button type="button" className="btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', height: '22px', display: 'flex', alignItems: 'center', gap: '0.15rem' }} onClick={() => clearCanvas(canvasRef1)}>
                          <Eraser size={10} /> Xóa
                        </button>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', overflow: 'hidden', height: '120px', position: 'relative' }}>
                        <canvas ref={canvasRef1} width="440" height="120" style={{ background: '#ffffff', cursor: 'crosshair', touchAction: 'none', width: '100%', height: '100%' }} />
                      </div>
                    </div>
                  )}

                  {/* Pad 2: Người giao hàng */}
                  {needSig2 && (
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>2. Chữ ký Người giao hàng (Đại diện NCC) <span style={{ color: '#ef4444' }}>*</span></span>
                        <button type="button" className="btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', height: '22px', display: 'flex', alignItems: 'center', gap: '0.15rem' }} onClick={() => clearCanvas(canvasRef2)}>
                          <Eraser size={10} /> Xóa
                        </button>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', overflow: 'hidden', height: '120px', position: 'relative' }}>
                        <canvas ref={canvasRef2} width="440" height="120" style={{ background: '#ffffff', cursor: 'crosshair', touchAction: 'none', width: '100%', height: '100%' }} />
                      </div>
                    </div>
                  )}

                  {/* Pad 3: Dược sĩ cùng kiểm */}
                  {needSig3 && (
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: '700', marginBottom: '0.35rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{needSig1 ? '3.' : '1.'} Chữ ký Dược sĩ cùng kiểm (Cán bộ đối chiếu 2) <span style={{ color: '#ef4444' }}>*</span></span>
                        <button type="button" className="btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', height: '22px', display: 'flex', alignItems: 'center', gap: '0.15rem' }} onClick={() => clearCanvas(canvasRef3)}>
                          <Eraser size={10} /> Xóa
                        </button>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', overflow: 'hidden', height: '120px', position: 'relative' }}>
                        <canvas ref={canvasRef3} width="440" height="120" style={{ background: '#ffffff', cursor: 'crosshair', touchAction: 'none', width: '100%', height: '100%' }} />
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', height: '34px' }} onClick={() => setShowSignatureModal(false)}>Hủy</button>
              <button
                type="button"
                className="btn-premium"
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 1rem', fontSize: '0.8rem', height: '34px' }}
                onClick={handleConfirmSignature}
              >
                <ThumbsUp size={14} /> {signatureTarget?.action === 'approve' ? 'Xác nhận duyệt nhập' : 'Xác nhận & Lưu phiếu'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DOSSIER VIEWER MODAL (XEM LẠI HỒ SƠ CHỨNG TỪ & ẢNH CẢM QUAN) */}
      {activeReceiptForDossier && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '900px', width: '90%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <button
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
              onClick={() => setActiveReceiptForDossier(null)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
              <Eye size={20} color="var(--color-secondary)" /> Xem Lại Hồ Sơ Chứng Từ: {activeReceiptForDossier.importCode}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
              Danh sách tài liệu pháp lý thầu, hóa đơn VAT, biên bản bàn giao và hình ảnh kiểm nhận cảm quan thực tế đã lưu trữ.
            </p>

            {(() => {
              let docs = [];
              try {
                docs = JSON.parse(activeReceiptForDossier.documentsJson || '[]');
              } catch (e) {
                docs = [];
              }

              const hasHistory = activeReceiptForDossier.editHistoryJson && activeReceiptForDossier.editHistoryJson !== "[]";
              if (docs.length === 0 && !hasHistory) {
                return <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Không có tài liệu nào đính kèm trong hồ sơ này.</p>;
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem', minHeight: '400px' }}>
                  {/* Left panel: Document tabs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRight: '1px solid var(--border-glass)', paddingRight: '1rem', overflowY: 'auto', maxHeight: '480px' }}>
                    {docs.length > 0 && <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-dim)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Danh mục tài liệu</div>}
                    {docs.map((doc, idx) => (
                      <button
                        key={idx}
                        className="btn-secondary"
                        style={{
                          textAlign: 'left',
                          fontSize: '0.78rem',
                          padding: '0.6rem 0.8rem',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                          background: activeDossierIndex === idx ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                          color: activeDossierIndex === idx ? '#3b82f6' : 'var(--text-main)',
                          borderColor: activeDossierIndex === idx ? '#3b82f6' : 'var(--border-glass)',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          width: '100%'
                        }}
                        onClick={() => setActiveDossierIndex(idx)}
                      >
                        <span style={{ fontWeight: '700', fontSize: '0.7rem', color: activeDossierIndex === idx ? '#3b82f6' : '#0d9488' }}>
                          {doc.type === 'invoice' && 'Hóa đơn thầu (VAT)'}
                          {doc.type === 'coa_coo' && 'Hồ sơ COA/COO'}
                          {doc.type === 'temp_log' && 'Log nhiệt độ bảo quản'}
                          {doc.type === 'delivery_record' && 'Biên bản giao hàng'}
                          {doc.type === 'delivery_slip' && 'Phiếu xuất kho (NCC)'}
                          {doc.type === 'contract' && 'Hợp đồng mua bán/thầu'}
                          {doc.type === 'sensory' && 'Ảnh chụp cảm quan'}
                          {doc.type === 'anomaly_report' && 'Biên bản sự cố'}
                        </span>
                        <span style={{ fontSize: '0.74rem', opacity: 0.8 }}>{doc.name}</span>
                      </button>
                    ))}

                    {/* Special Edit History Button if history exists */}
                    {hasHistory && (
                      <button
                        className="btn-secondary"
                        style={{
                          textAlign: 'left',
                          fontSize: '0.78rem',
                          padding: '0.6rem 0.8rem',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                          background: activeDossierIndex === 'history' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.02)',
                          color: activeDossierIndex === 'history' ? '#f59e0b' : 'var(--text-main)',
                          borderColor: activeDossierIndex === 'history' ? '#f59e0b' : 'var(--border-glass)',
                          marginTop: docs.length > 0 ? '1rem' : '0rem',
                          width: '100%'
                        }}
                        onClick={() => setActiveDossierIndex('history')}
                      >
                        <span style={{ fontWeight: '700', fontSize: '0.7rem', color: '#f59e0b' }}>
                          NHẬT KÝ ĐIỀU CHỈNH
                        </span>
                        <span style={{ fontSize: '0.74rem', opacity: 0.8 }}>Xem lịch sử thay đổi</span>
                      </button>
                    )}
                  </div>

                  {/* Right panel: Active document viewer or Edit History */}
                  {activeDossierIndex === 'history' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                      <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#f59e0b' }}>Nhật Ký Điều Chỉnh Phiếu Nhập</h4>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Danh sách chi tiết các lần thay đổi thông tin hồ sơ và thuốc kiểm nhận.
                        </span>
                      </div>

                      <div style={{
                        flexGrow: 1,
                        background: 'rgba(0,0,0,0.15)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '8px',
                        padding: '1.25rem',
                        maxHeight: '450px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}>
                        {(() => {
                          let history = [];
                          try {
                            history = JSON.parse(activeReceiptForDossier.editHistoryJson || '[]');
                          } catch(e) {
                            history = [];
                          }

                          if (history.length === 0) {
                            return <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>Chưa ghi nhận lịch sử điều chỉnh nào.</div>;
                          }

                          return history.map((entry, hIdx) => (
                            <div key={hIdx} style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--border-glass)',
                              borderRadius: '6px',
                              padding: '0.75rem 1rem',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border-glass)', paddingBottom: '0.4rem', marginBottom: '0.5rem', fontSize: '0.74rem' }}>
                                <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>Cán bộ: {entry.ActionBy}</span>
                                <span style={{ color: 'var(--text-muted)' }}>{entry.Timestamp}</span>
                              </div>
                              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.76rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {entry.Details?.map((detail, dIdx) => (
                                  <li key={dIdx} style={{ lineHeight: '1.4' }}>{detail}</li>
                                ))}
                              </ul>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  ) : (() => {
                    const activeDoc = docs[activeDossierIndex] || docs[0];
                    if (!activeDoc) {
                      if (hasHistory) {
                        setTimeout(() => setActiveDossierIndex('history'), 0);
                        return null;
                      }
                      return null;
                    }
                    const isImage = activeDoc.base64 && (activeDoc.base64.startsWith('data:image') || activeDoc.base64.startsWith('http'));

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700' }}>{activeDoc.name}</h4>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              Loại tài liệu: <strong>
                                {activeDoc.type === 'invoice' && 'Hóa đơn thầu (VAT)'}
                                {activeDoc.type === 'coa_coo' && 'COA/COO chất lượng'}
                                {activeDoc.type === 'temp_log' && 'Log nhiệt độ bảo quản'}
                                {activeDoc.type === 'delivery_record' && 'Biên bản giao nhận hàng'}
                                {activeDoc.type === 'delivery_slip' && 'Phiếu xuất kho của NCC'}
                                {activeDoc.type === 'contract' && 'Hợp đồng mua bán/thầu'}
                                {activeDoc.type === 'sensory' && 'Ảnh chụp cảm quan thuốc thực tế'}
                                {activeDoc.type === 'anomaly_report' && 'Biên bản sự cố bất thường'}
                              </strong>
                            </span>
                          </div>
                          <a
                            href={activeDoc.base64}
                            download={activeDoc.name}
                            className="btn-premium"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', height: '30px' }}
                          >
                            <Download size={12} /> Tải tệp tin
                          </a>
                        </div>

                        <div style={{
                          flexGrow: 1,
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          padding: '1rem',
                          minHeight: '350px',
                          maxHeight: '450px',
                          overflow: 'auto'
                        }}>
                          {isImage ? (
                            <img
                              src={activeDoc.base64}
                              alt={activeDoc.name}
                              style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                            />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                              <FileText size={64} color="var(--text-dim)" />
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ margin: 0, fontWeight: '700', fontSize: '0.85rem' }}>Định dạng tệp tin PDF / Văn bản</p>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.74rem' }}>Hệ thống không hỗ trợ xem trước trực tiếp định dạng PDF lớn trong khung.</p>
                              </div>
                              <a
                                href={activeDoc.base64}
                                download={activeDoc.name}
                                className="btn-secondary"
                                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <Download size={14} /> Tải về máy để xem
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <button className="btn-secondary" style={{ height: '36px', padding: '0 1.25rem', fontSize: '0.82rem' }} onClick={() => setActiveReceiptForDossier(null)}>
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
