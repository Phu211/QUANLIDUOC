import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  FileSearch, 
  History, 
  User, 
  Clock, 
  ArrowRight, 
  Filter, 
  X, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  Layers,
  Eye,
  AlertCircle,
  Download,
  Calendar,
  Search,
  CheckCircle2,
  Tag,
  Pill,
  Package,
  FileText,
  Trash2,
  Lock,
  Unlock,
  Check,
  Edit3,
  Sparkles,
  Info,
  Laptop,
  Building,
  SlidersHorizontal,
  ArrowLeftRight
} from 'lucide-react';

// Từ điển ánh xạ bảng dữ liệu sang nghiệp vụ bệnh viện thân thiện
export const TABLE_MAP = {
  AccountingPeriods: { label: 'Kỳ Kế Toán Dược', icon: Calendar, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  Medicines: { label: 'Danh Mục Biệt Dược', icon: Pill, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  Batches: { label: 'Lô Hạn Dùng Thuốc', icon: Layers, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  InventoryStocks: { label: 'Kho Thuốc Chẵn Viện', icon: Database, color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)' },
  DepartmentStocks: { label: 'Tủ Trực Khoa Lâm Sàng', icon: Package, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  MedicineRequisitions: { label: 'Phiếu Lĩnh Thuốc', icon: FileText, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  MedicineRequisition: { label: 'Phiếu Lĩnh Thuốc', icon: FileText, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  MedicineRequisitionDetails: { label: 'Chi Tiết Xuất Kho Thuốc', icon: FileText, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  ImportReceipts: { label: 'Phiếu Nhập Kho Viện', icon: Download, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  ImportReceiptDetails: { label: 'Chi Tiết Nhập Kho', icon: Download, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  BreakageReports: { label: 'Biên Bản Hư Hao Vỡ Hỏng', icon: AlertCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  BreakageReportDetails: { label: 'Chi Tiết Hư Hao', icon: AlertCircle, color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' },
  InternalTransfers: { label: 'Điều Chuyển Kho Nội Bộ', icon: ArrowRight, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  ReturnReceipts: { label: 'Phiếu Hoàn Trả Kho', icon: RefreshCw, color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' },
  LiquidationReceipts: { label: 'Phiếu Thanh Lý Thuốc', icon: Trash2, color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
  RecallLogs: { label: 'Thu Hồi Lô Thuốc Khẩn Cấp', icon: ShieldCheck, color: '#b91c1c', bg: 'rgba(185, 28, 28, 0.1)' }
};

// Từ điển chức danh vai trò
export const ROLE_MAP = {
  pharmacist: 'Thủ kho Kho Chẵn',
  director: 'Ban Giám Đốc',
  admin: 'Quản trị viên hệ thống',
  head: 'BS. Trưởng khoa',
  head_nurse: 'Điều dưỡng trưởng',
  nurse: 'Điều dưỡng viên',
  dispensary: 'Dược sĩ cấp phát đơn',
  doctor: 'Bác sĩ điều trị',
  warehouse: 'Thủ kho Dược',
  auditor: 'Kiểm toán viên'
};

// Từ điển tên cột / thuộc tính dữ liệu
export const COLUMN_MAP = {
  IsLocked: 'Trạng thái khóa sổ',
  IsDeleted: 'Đánh dấu xóa (Thùng rác)',
  DeletedAt: 'Thời điểm xóa',
  Notes: 'Ghi chú / Lý do',
  ClosingStockCount: 'Tổng số lượng tồn chốt',
  ClosingStockValue: 'Tổng giá trị tồn chốt (VNĐ)',
  TotalImportValue: 'Tổng giá trị nhập (VNĐ)',
  TotalExportValue: 'Tổng giá trị xuất (VNĐ)',
  TotalLossValue: 'Giá trị hư hao / mất (VNĐ)',
  PeriodMonth: 'Tháng kế toán',
  PeriodYear: 'Năm kế toán',
  PeriodName: 'Tên kỳ khóa sổ',
  LockedBy: 'Người khóa sổ',
  LockedAt: 'Thời điểm khóa sổ',
  MedicineName: 'Tên biệt dược',
  MedicineCode: 'Mã định danh thuốc',
  ActiveIngredient: 'Hoạt chất chính',
  DosageForm: 'Dạng bào chế',
  Strength: 'Hàm lượng',
  Unit: 'Đơn vị tính',
  Quantity: 'Số lượng',
  CurrentQuantity: 'Số lượng tồn khả dụng',
  ReservedQuantity: 'Số lượng chờ cấp (giữ chỗ)',
  DispensedQuantity: 'Số lượng thực xuất',
  RequestedQuantity: 'Số lượng khoa yêu cầu',
  Status: 'Trạng thái xử lý',
  BatchNumber: 'Số lô sản xuất',
  ExpiryDate: 'Hạn sử dụng',
  ManufactureDate: 'Ngày sản xuất',
  PurchasePrice: 'Đơn giá nhập',
  SellingPrice: 'Đơn giá xuất bán',
  DepartmentName: 'Khoa phòng sử dụng',
  DepartmentID: 'Mã khoa phòng',
  CreatedAt: 'Thời điểm tạo',
  UpdatedAt: 'Thời điểm cập nhật',
  CreatedBy: 'Người khởi tạo',
  UpdatedBy: 'Người cập nhật',
  Reason: 'Lý do thực hiện',
  TotalAmount: 'Tổng số tiền (VNĐ)',
  ReceiptCode: 'Mã số phiếu',
  RequisitionCode: 'Mã phiếu lĩnh'
};

export default function AuditTrailPage({ user }) {
  const isClinical = user?.role === 'head' || user?.role === 'head_nurse';
  const [logs, setLogs] = useState([]);
  const [tables, setTables] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Chế độ hiển thị: true = Thân thiện cho Bác sĩ & Quản lý, false = Kỹ thuật DBA
  const [isFriendlyMode, setIsFriendlyMode] = useState(true);

  // Filter states
  const [selectedDept, setSelectedDept] = useState(isClinical ? String(user?.departmentID || '') : 'all');
  const [selectedTable, setSelectedTable] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [searchUser, setSearchUser] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Selected row for diff inspection
  const [inspectLog, setInspectLog] = useState(null);

  // Horizontal Scroll Drag State & Handlers
  const tableContainerRef = React.useRef(null);
  const [scrollPercent, setScrollPercent] = useState(0);
  const isMouseDownRef = React.useRef(false);
  const startXRef = React.useRef(0);
  const scrollLeftRef = React.useRef(0);

  const checkScrollability = () => {
    if (!tableContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tableContainerRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollPercent((scrollLeft / maxScroll) * 100);
    } else {
      setScrollPercent(0);
    }
  };

  const handleTableScroll = () => {
    checkScrollability();
  };

  const handleRangeScroll = (e) => {
    const val = Number(e.target.value);
    setScrollPercent(val);
    if (tableContainerRef.current) {
      const { scrollWidth, clientWidth } = tableContainerRef.current;
      const maxScroll = scrollWidth - clientWidth;
      tableContainerRef.current.scrollLeft = (val / 100) * maxScroll;
    }
  };

  const scrollByAmount = (amount) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const scrollToPosition = (pos) => {
    if (tableContainerRef.current) {
      const { scrollWidth, clientWidth } = tableContainerRef.current;
      tableContainerRef.current.scrollTo({ 
        left: pos === 'end' ? scrollWidth - clientWidth : 0, 
        behavior: 'smooth' 
      });
    }
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a') || e.target.closest('select')) return;
    isMouseDownRef.current = true;
    startXRef.current = e.pageX - (tableContainerRef.current?.offsetLeft || 0);
    scrollLeftRef.current = tableContainerRef.current?.scrollLeft || 0;
    if (tableContainerRef.current) {
      tableContainerRef.current.style.cursor = 'grabbing';
      tableContainerRef.current.style.userSelect = 'none';
    }
  };

  const handleMouseMove = (e) => {
    if (!isMouseDownRef.current || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - (tableContainerRef.current.offsetLeft || 0);
    const walk = (x - startXRef.current) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    if (isMouseDownRef.current && tableContainerRef.current) {
      isMouseDownRef.current = false;
      tableContainerRef.current.style.cursor = 'grab';
      tableContainerRef.current.style.removeProperty('user-select');
    }
  };

  useEffect(() => {
    fetchDistinctTables();
    if (!isClinical) {
      fetchDepartments();
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, selectedTable, selectedAction, selectedDept]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/audit-trail/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDistinctTables = async () => {
    try {
      const res = await fetch('/api/audit-trail/tables', {
        headers: {
          'X-User-Role': user?.role || ''
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTables(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedTable && selectedTable !== 'all') params.append('tableName', selectedTable);
      if (selectedAction && selectedAction !== 'all') params.append('action', selectedAction);
      if (searchUser.trim()) params.append('username', searchUser.trim());
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      if (isClinical) {
        if (user?.departmentID) params.append('departmentId', user.departmentID);
      } else if (selectedDept && selectedDept !== 'all') {
        params.append('departmentId', selectedDept);
      }

      params.append('page', page);
      params.append('pageSize', pageSize);

      const res = await fetch(`/api/audit-trail?${params.toString()}`, {
        headers: {
          'X-User-Role': user?.role || '',
          'X-User-FullName': encodeURIComponent(user?.fullName || ''),
          'X-User-DepartmentID': user?.departmentID ? String(user.departmentID) : ''
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.Error || 'Không thể tải nhật ký kiểm toán.');
      }

      const result = await res.json();
      setLogs(result.data || []);
      setTotalPages(result.totalPages || 1);
      setTotalRecords(result.totalRecords || 0);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e) => {
    e?.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilter = () => {
    setSelectedTable('all');
    setSelectedAction('all');
    setSearchUser('');
    setFromDate('');
    setToDate('');
    if (!isClinical) {
      setSelectedDept('all');
    }
    setPage(1);
    fetchLogs();
  };

  const parseJson = (str) => {
    if (!str) return null;
    if (typeof str === 'object') return str;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  // 1. Phân loại và hiển thị Hành Động thông minh (Smart Action)
  const getSmartAction = (log) => {
    const table = log.tableName || log.entityName || '';
    const act = log.action;
    const newObj = parseJson(log.newValues || log.afterData);
    const oldObj = parseJson(log.oldValues || log.beforeData);
    const changed = log.changedColumns || '';

    // Hành động tủ trực & y lệnh khoa lâm sàng
    if (act === 'CABINET_EXPORT') {
      return { 
        label: 'Xuất tủ trực bệnh nhân', 
        color: '#ec4899', 
        bg: 'rgba(236, 72, 153, 0.12)', 
        icon: Pill, 
        raw: act 
      };
    }
    if (act === 'REFILL_REQUISITION') {
      return { 
        label: 'Đề xuất bù cơ số tủ', 
        color: '#8b5cf6', 
        bg: 'rgba(139, 92, 246, 0.12)', 
        icon: Package, 
        raw: act 
      };
    }
    if (act === 'CREATE_REQUISITION') {
      return { 
        label: 'Lập phiếu lĩnh bù', 
        color: '#0ea5e9', 
        bg: 'rgba(14, 165, 233, 0.12)', 
        icon: FileText, 
        raw: act 
      };
    }
    if (act === 'HEAD_APPROVE_REQUISITION') {
      return { 
        label: 'Trưởng khoa duyệt lĩnh', 
        color: '#059669', 
        bg: 'rgba(5, 150, 105, 0.12)', 
        icon: CheckCircle2, 
        raw: act 
      };
    }
    if (act === 'APPROVE_REQUISITION') {
      return { 
        label: 'Xuất kho phiếu lĩnh', 
        color: '#10b981', 
        bg: 'rgba(16, 185, 129, 0.12)', 
        icon: Check, 
        raw: act 
      };
    }
    if (act && act.startsWith('CONFIRM_RECEIPT')) {
      return { 
        label: 'Bàn giao nhận thuốc', 
        color: '#059669', 
        bg: 'rgba(5, 150, 105, 0.12)', 
        icon: CheckCircle2, 
        raw: act 
      };
    }
    if (act === 'CREATE_BREAKAGE') {
      return { 
        label: 'Báo vỡ hỏng tủ trực', 
        color: '#ef4444', 
        bg: 'rgba(239, 68, 68, 0.12)', 
        icon: AlertCircle, 
        raw: act 
      };
    }
    if (act === 'APPROVE_BREAKAGE') {
      return { 
        label: 'Duyệt trừ hao hụt', 
        color: '#dc2626', 
        bg: 'rgba(220, 38, 38, 0.12)', 
        icon: Trash2, 
        raw: act 
      };
    }
    if (act === 'CREATE_RETURN') {
      return { 
        label: 'Lập phiếu hoàn trả', 
        color: '#f59e0b', 
        bg: 'rgba(245, 158, 11, 0.12)', 
        icon: RefreshCw, 
        raw: act 
      };
    }
    if (act === 'LEADER_APPROVE_RETURN') {
      return { 
        label: 'Lãnh đạo duyệt trả', 
        color: '#059669', 
        bg: 'rgba(5, 150, 105, 0.12)', 
        icon: CheckCircle2, 
        raw: act 
      };
    }
    if (act === 'PHARMACIST_APPROVE_RETURN') {
      return { 
        label: 'Kho Dược nhận lại', 
        color: '#10b981', 
        bg: 'rgba(16, 185, 129, 0.12)', 
        icon: Check, 
        raw: act 
      };
    }

    // Khóa sổ kỳ
    if (table === 'AccountingPeriods') {
      if (act === 'INSERT') {
        return { 
          label: 'Khởi tạo & Khóa kỳ', 
          color: '#059669', 
          bg: 'rgba(5, 150, 105, 0.12)', 
          icon: Sparkles,
          raw: 'INSERT'
        };
      }
      if (act === 'UPDATE') {
        if (newObj?.IsLocked === true) {
          return { 
            label: 'Khóa sổ kỳ', 
            color: '#dc2626', 
            bg: 'rgba(220, 38, 38, 0.12)', 
            icon: Lock,
            raw: 'UPDATE'
          };
        }
        if (newObj?.IsLocked === false) {
          return { 
            label: 'Mở khóa sổ', 
            color: '#2563eb', 
            bg: 'rgba(37, 99, 235, 0.12)', 
            icon: Unlock,
            raw: 'UPDATE'
          };
        }
      }
    }

    // Danh mục thuốc
    if (table === 'Medicines') {
      if (act === 'UPDATE') {
        if (newObj?.IsDeleted === true) {
          return { 
            label: 'Chuyển Thùng rác', 
            color: '#d97706', 
            bg: 'rgba(217, 119, 6, 0.12)', 
            icon: Trash2,
            raw: 'UPDATE'
          };
        }
        if (newObj?.IsDeleted === false && oldObj?.IsDeleted === true) {
          return { 
            label: 'Khôi phục thuốc', 
            color: '#059669', 
            bg: 'rgba(5, 150, 105, 0.12)', 
            icon: RefreshCw,
            raw: 'UPDATE'
          };
        }
      }
      if (act === 'INSERT') {
        return { 
          label: 'Thêm biệt dược', 
          color: '#059669', 
          bg: 'rgba(5, 150, 105, 0.12)', 
          icon: Sparkles,
          raw: 'INSERT'
        };
      }
      if (act === 'DELETE') {
        return { 
          label: 'Xóa vĩnh viễn', 
          color: '#dc2626', 
          bg: 'rgba(220, 38, 38, 0.12)', 
          icon: Trash2,
          raw: 'DELETE'
        };
      }
    }

    // Chi tiết phiếu lĩnh thuốc
    if (table === 'MedicineRequisitionDetails' && newObj?.DispensedQuantity !== undefined) {
      return { 
        label: 'Số lượng thực xuất', 
        color: '#7c3aed', 
        bg: 'rgba(124, 58, 237, 0.12)', 
        icon: Check,
        raw: 'UPDATE'
      };
    }

    // Lô thuốc
    if (table === 'Batches' && newObj?.Status && oldObj?.Status && newObj.Status !== oldObj.Status) {
      return { 
        label: 'Đổi trạng thái lô', 
        color: '#d97706', 
        bg: 'rgba(217, 119, 6, 0.12)', 
        icon: RefreshCw,
        raw: 'UPDATE'
      };
    }

    // Fallback chuẩn
    switch (act) {
      case 'INSERT':
        return { 
          label: 'Thêm mới hồ sơ', 
          color: '#059669', 
          bg: 'rgba(5, 150, 105, 0.12)', 
          icon: Sparkles,
          raw: 'INSERT'
        };
      case 'UPDATE':
        return { 
          label: 'Chỉnh sửa dữ liệu', 
          color: '#d97706', 
          bg: 'rgba(217, 119, 6, 0.12)', 
          icon: Edit3,
          raw: 'UPDATE'
        };
      case 'DELETE':
        return { 
          label: 'Xóa dữ liệu', 
          color: '#dc2626', 
          bg: 'rgba(220, 38, 38, 0.12)', 
          icon: Trash2,
          raw: 'DELETE'
        };
      default:
        return { 
          label: act, 
          color: '#2563eb', 
          bg: 'rgba(37, 99, 235, 0.12)', 
          icon: Info,
          raw: act
        };
    }
  };

  // 2. Chuyển đổi Khóa chính / ID kỹ thuật sang Tên Đối Tượng dễ hiểu
  const formatTargetObject = (log) => {
    const table = log.tableName || log.entityName || '';
    const keyObj = parseJson(log.keyValues);
    const newObj = parseJson(log.newValues || log.afterData);
    const oldObj = parseJson(log.oldValues || log.beforeData);

    if (table === 'AccountingPeriods') {
      const month = newObj?.PeriodMonth || oldObj?.PeriodMonth;
      const year = newObj?.PeriodYear || oldObj?.PeriodYear;
      if (month && year) {
        return `Kỳ Dược Tháng ${month < 10 ? '0' + month : month}/${year}`;
      }
      const pid = keyObj?.PeriodID || log.entityID;
      if (pid && pid > 0) return `Kỳ Dược #${pid}`;
      return 'Kỳ Kế Toán Dược Mới';
    }

    if (table === 'Medicines') {
      const name = newObj?.MedicineName || oldObj?.MedicineName;
      const id = keyObj?.MedicineID || log.entityID;
      if (name) return `Thuốc: ${name}`;
      if (id) return `Biệt dược mã #${id}`;
      return 'Hồ sơ thuốc';
    }

    if (table === 'Batches') {
      const bNum = newObj?.BatchNumber || oldObj?.BatchNumber;
      const id = keyObj?.BatchID || log.entityID;
      if (bNum) return `Lô sản xuất ${bNum}`;
      if (id) return `Lô thuốc mã #${id}`;
      return 'Lô thuốc';
    }

    if (table === 'MedicineRequisitions' || table === 'MedicineRequisition') {
      const id = keyObj?.RequisitionID || log.entityID;
      return id ? `Phiếu lĩnh #${id}` : 'Phiếu lĩnh thuốc';
    }

    if (table === 'MedicineRequisitionDetails') {
      const id = keyObj?.RequisitionDetailID || log.entityID;
      return id ? `Khoản lĩnh thuốc #${id}` : 'Chi tiết phiếu lĩnh';
    }

    if (table === 'InventoryStocks') {
      const id = keyObj?.StockID || log.entityID;
      return id ? `Kho chẵn (Vị trí #${id})` : 'Kho chẵn viện';
    }

    if (table === 'DepartmentStocks') {
      const id = keyObj?.DepartmentStockID || log.entityID;
      return id ? `Tủ trực (Vị trí #${id})` : 'Tồn tủ trực';
    }

    if (table === 'ImportReceipts') {
      const id = keyObj?.ReceiptID || log.entityID;
      return id ? `Phiếu nhập #${id}` : 'Phiếu nhập kho';
    }

    if (table === 'BreakageReports') {
      const id = keyObj?.ReportID || log.entityID;
      return id ? `Biên bản vỡ hỏng #${id}` : 'Biên bản hư hao';
    }

    // Fallback nếu có JSON key-value
    if (keyObj && typeof keyObj === 'object') {
      const entries = Object.entries(keyObj);
      if (entries.length > 0) {
        const [k, v] = entries[0];
        if (typeof v === 'number' && v < 0) return 'Bản ghi mới (Đang tạo)';
        return `${COLUMN_MAP[k] || k}: #${v}`;
      }
    }

    return log.keyValues || (log.entityID ? `#${log.entityID}` : 'Hồ sơ hệ thống');
  };

  // 3. Diễn giải nghiệp vụ thực tế bằng tiếng Việt (Plain Vietnamese Business Narrative)
  const getBusinessNarrative = (log) => {
    // Nếu AfterData là mô tả văn bản trực tiếp
    if (log.afterData && typeof log.afterData === 'string' && !log.afterData.trim().startsWith('{')) {
      const deptPrefix = log.departmentName ? `[${log.departmentName}] ` : '';
      return `${deptPrefix}${log.afterData}`;
    }

    const table = log.tableName || log.entityName || '';
    const act = log.action;
    const newObj = parseJson(log.newValues || log.afterData);
    const oldObj = parseJson(log.oldValues || log.beforeData);
    const changed = log.changedColumns || '';

    // Kỳ Dược
    if (table === 'AccountingPeriods') {
      const month = newObj?.PeriodMonth || oldObj?.PeriodMonth;
      const year = newObj?.PeriodYear || oldObj?.PeriodYear;
      const periodLabel = month && year ? `Tháng ${month < 10 ? '0' + month : month}/${year}` : '';

      if (act === 'INSERT') {
        const stockVal = newObj?.ClosingStockValue != null 
          ? ` (Chốt tồn: ${Number(newObj.ClosingStockValue).toLocaleString('vi-VN')} đ)` 
          : '';
        return `Khởi tạo và hoàn tất khóa sổ kỳ Dược ${periodLabel}${stockVal}`;
      }
      if (act === 'UPDATE') {
        if (newObj?.IsLocked === true && oldObj?.IsLocked === false) {
          return `Khóa sổ kỳ Dược ${periodLabel} (Chốt số liệu và đóng giao dịch)`;
        }
        if (newObj?.IsLocked === false && oldObj?.IsLocked === true) {
          return `Ban Giám Đốc phê duyệt mở khóa kỳ Dược ${periodLabel} để điều chỉnh xuất nhập`;
        }
        if (changed.includes('Notes')) {
          return `Cập nhật ghi chú kỳ Dược: "${newObj?.Notes || ''}"`;
        }
        return `Cập nhật thông tin kỳ Dược ${periodLabel}`;
      }
    }

    // Danh mục thuốc
    if (table === 'Medicines') {
      const medName = newObj?.MedicineName || oldObj?.MedicineName || `mã #${log.entityID || ''}`;
      if (act === 'INSERT') {
        return `Thêm mới biệt dược "${medName}" vào danh mục phục vụ bệnh viện`;
      }
      if (act === 'UPDATE') {
        if (newObj?.IsDeleted === true) {
          return `Đưa thuốc "${medName}" vào Thùng rác (bảo lưu lịch sử cấp phát)`;
        }
        if (newObj?.IsDeleted === false && oldObj?.IsDeleted === true) {
          return `Khôi phục thuốc "${medName}" trở lại hoạt động bình thường`;
        }
        return `Cập nhật thông tin hồ sơ biệt dược "${medName}"`;
      }
      if (act === 'DELETE') {
        return `Xóa vĩnh viễn thuốc "${medName}" khỏi cơ sở dữ liệu`;
      }
    }

    // Lô thuốc
    if (table === 'Batches') {
      const bNum = newObj?.BatchNumber || oldObj?.BatchNumber || '';
      if (newObj?.Status && oldObj?.Status && newObj.Status !== oldObj.Status) {
        return `Đổi trạng thái lô ${bNum ? `"${bNum}"` : ''} từ "${oldObj.Status}" sang "${newObj.Status}"`;
      }
      if (act === 'INSERT') return `Nhập bổ sung lô thuốc mới ${bNum ? `(Số lô: ${bNum})` : ''}`;
      return `Cập nhật hạn dùng / số liệu lô thuốc ${bNum ? `(Số lô: ${bNum})` : ''}`;
    }

    // Phiếu lĩnh thuốc
    if (table === 'MedicineRequisitions' || table === 'MedicineRequisition') {
      if (act === 'INSERT') return 'Khoa phòng gửi phiếu lĩnh thuốc mới lên kho Dược';
      if (newObj?.Status === 'Approved') return 'Thủ kho Kho Chẵn duyệt xuất kho giao thuốc theo phiếu lĩnh';
      if (newObj?.Status === 'Completed') return 'Khoa đã xác nhận nhận đủ thuốc từ kho Dược';
      return 'Cập nhật trạng thái / tiến độ xuất kho phiếu lĩnh';
    }

    // Chi tiết lĩnh thuốc
    if (table === 'MedicineRequisitionDetails') {
      if (newObj?.DispensedQuantity !== undefined && newObj?.DispensedQuantity !== oldObj?.DispensedQuantity) {
        return `Thực xuất ${newObj.DispensedQuantity} đơn vị thuốc cho khoa phòng`;
      }
      return 'Điều chỉnh danh mục / số lượng thuốc trong phiếu lĩnh';
    }

    // Tồn kho chẵn
    if (table === 'InventoryStocks') {
      if (newObj?.CurrentQuantity !== undefined) {
        const diff = (newObj.CurrentQuantity || 0) - (oldObj?.CurrentQuantity || 0);
        const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
        return `Biến động tồn kho chẵn: Tồn khả dụng hiện tại ${newObj.CurrentQuantity} (${diffStr})`;
      }
      return 'Cập nhật số liệu lưu trữ kho chẵn viện';
    }

    // Tồn tủ trực khoa
    if (table === 'DepartmentStocks') {
      return 'Biến động số lượng thuốc tại tủ trực cấp cứu / khoa lâm sàng';
    }

    // Phiếu nhập kho
    if (table === 'ImportReceipts') {
      if (act === 'INSERT') return 'Lập phiếu nhập kho thuốc mới từ nhà cung cấp';
      return 'Cập nhật thông tin phiếu nhập kho viện';
    }

    // Biên bản vỡ hỏng
    if (table === 'BreakageReports') {
      if (act === 'INSERT') return 'Lập biên bản xử lý thuốc hư hao / vỡ hỏng / cận hạn';
      return 'Cập nhật biên bản kiểm kê hư hao thuốc';
    }

    // Fallback chung
    if (act === 'INSERT') return 'Tạo mới bản ghi trong hệ thống bệnh viện';
    if (act === 'UPDATE') return 'Cập nhật thay đổi dữ liệu hồ sơ';
    if (act === 'DELETE') return 'Xóa bản ghi khỏi hệ thống';
    return 'Ghi nhận biến động dữ liệu';
  };

  // 4. Format giá trị trong modal Diff đối chiếu
  const formatFieldValue = (key, val) => {
    if (val === null || val === undefined || val === '') {
      return <span style={{ opacity: 0.5, fontStyle: 'italic' }}>(Trống / Chưa có)</span>;
    }

    // Boolean
    if (val === true || val === 'true') {
      if (key === 'IsLocked') {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#dc2626', fontWeight: 700, background: 'rgba(220, 38, 38, 0.1)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
            <Lock size={13} /> ĐÃ KHÓA SỔ
          </span>
        );
      }
      if (key === 'IsDeleted') {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#d97706', fontWeight: 700, background: 'rgba(217, 119, 6, 0.1)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
            <Trash2 size={13} /> ĐÃ XÓA (THÙNG RÁC)
          </span>
        );
      }
      return (
        <span style={{ color: '#059669', fontWeight: 700, background: 'rgba(5, 150, 105, 0.1)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
          Có / Kích hoạt
        </span>
      );
    }

    if (val === false || val === 'false') {
      if (key === 'IsLocked') {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#2563eb', fontWeight: 700, background: 'rgba(37, 99, 235, 0.1)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
            <Unlock size={13} /> ĐANG MỞ KHÓA
          </span>
        );
      }
      if (key === 'IsDeleted') {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#059669', fontWeight: 700, background: 'rgba(5, 150, 105, 0.1)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
            <Check size={13} /> ĐANG HOẠT ĐỘNG
          </span>
        );
      }
      return (
        <span style={{ color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
          Không / Tắt
        </span>
      );
    }

    // Tiền tệ VNĐ
    const currencyKeys = ['ClosingStockValue', 'TotalImportValue', 'TotalExportValue', 'TotalLossValue', 'PurchasePrice', 'SellingPrice', 'TotalAmount'];
    if (currencyKeys.includes(key) && !isNaN(val)) {
      return (
        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
          {Number(val).toLocaleString('vi-VN')} đ
        </span>
      );
    }

    // Số lượng
    const qtyKeys = ['ClosingStockCount', 'CurrentQuantity', 'ReservedQuantity', 'DispensedQuantity', 'RequestedQuantity', 'Quantity'];
    if (qtyKeys.includes(key) && !isNaN(val)) {
      return (
        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
          {Number(val).toLocaleString('vi-VN')}
        </span>
      );
    }

    // Chuỗi ngày ISO
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-main)' }}>
              <Calendar size={13} style={{ opacity: 0.6 }} />
              {d.toLocaleString('vi-VN')}
            </span>
          );
        }
      } catch {}
    }

    return String(val);
  };

  const renderDiffViewer = (log) => {
    if (!log) return null;
    const oldObj = parseJson(log.oldValues || log.beforeData);
    const newObj = parseJson(log.newValues || log.afterData);

    const isOldJson = typeof oldObj === 'object' && oldObj !== null;
    const isNewJson = typeof newObj === 'object' && newObj !== null;

    if (!isOldJson && !isNewJson) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', color: '#dc2626', fontSize: '0.85rem' }}>Dữ Liệu Ban Đầu (Trước Thay Đổi)</h5>
            <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{log.oldValues || '(Không có)'}</pre>
          </div>
          <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', color: '#059669', fontSize: '0.85rem' }}>Dữ Liệu Mới Sau Khi Thực Hiện</h5>
            <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{log.newValues || '(Không có)'}</pre>
          </div>
        </div>
      );
    }

    const allKeys = Array.from(new Set([
      ...(isOldJson ? Object.keys(oldObj) : []),
      ...(isNewJson ? Object.keys(newObj) : [])
    ]));

    return (
      <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--table-header-bg)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '0.85rem 1rem', width: '30%' }}>Thông Tin / Hạng Mục</th>
              <th style={{ padding: '0.85rem 1rem', width: '35%', color: '#dc2626' }}>Giá Trị Ban Đầu (Trước Đó)</th>
              <th style={{ padding: '0.85rem 1rem', width: '35%', color: '#059669' }}>Giá Trị Mới (Sau Thay Đổi)</th>
            </tr>
          </thead>
          <tbody>
            {allKeys.map(k => {
              const oldVal = isOldJson ? oldObj[k] : undefined;
              const newVal = isNewJson ? newObj[k] : undefined;
              const isDifferent = String(oldVal ?? '') !== String(newVal ?? '');

              return (
                <tr key={k} style={{ 
                  borderBottom: '1px solid var(--border-color)', 
                  background: isDifferent ? 'rgba(245, 158, 11, 0.05)' : 'transparent' 
                }}>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)' }}>
                    <div style={{ fontWeight: 600 }}>
                      {COLUMN_MAP[k] || k}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                      {k}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: isDifferent ? '#dc2626' : 'var(--text-muted)' }}>
                    {formatFieldValue(k, oldVal)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: isDifferent ? '#059669' : 'var(--text-muted)' }}>
                    {formatFieldValue(k, newVal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="page-container fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="header-title-container">
          <div className="title-icon-badge" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: '#ffffff', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)' }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
              {isClinical 
                ? `Nhật Ký Hoạt Động - ${user?.departmentName || 'Khoa Lâm Sàng'}` 
                : 'Nhật Ký Hoạt Động & Kiểm Toán Tự Động (Audit Trail)'}
            </h1>
            <p className="page-subtitle" style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              {isClinical
                ? `Theo dõi chi tiết lịch sử y lệnh, ký duyệt phiếu lĩnh, xuất cấp tủ trực và luân chuyển thuốc của ${user?.departmentName || 'khoa'}.`
                : 'Theo dõi và đối soát tự động toàn bộ mọi thao tác xuất - nhập - khóa sổ - sửa xóa dữ liệu của nhân viên y tế theo thời gian thực.'}
            </p>
          </div>
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Mode Switch Button */}
          <button
            onClick={() => setIsFriendlyMode(!isFriendlyMode)}
            className="btn-secondary"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              padding: '0.55rem 1rem',
              background: isFriendlyMode ? 'rgba(5, 150, 105, 0.08)' : 'rgba(59, 130, 246, 0.08)',
              borderColor: isFriendlyMode ? 'rgba(5, 150, 105, 0.3)' : 'rgba(59, 130, 246, 0.3)',
              color: isFriendlyMode ? '#059669' : '#2563eb',
              fontWeight: 700,
              fontSize: '0.84rem'
            }}
            title="Bấm để đổi giữa chế độ Dễ hiểu cho Bác sĩ/Quản lý và Chế độ Kỹ thuật DBA"
          >
            {isFriendlyMode ? <CheckCircle2 size={16} /> : <Laptop size={16} />}
            <span>{isFriendlyMode ? 'Chế độ Dễ Hiểu (Người Ngoài Ngành)' : 'Chế độ Kỹ Thuật (DBA / IT)'}</span>
          </button>

          <button 
            onClick={fetchLogs} 
            disabled={loading}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1rem' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ 
          padding: '0.9rem 1.25rem', 
          background: 'rgba(239, 68, 68, 0.1)', 
          borderLeft: '4px solid #ef4444', 
          borderRadius: '8px', 
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#ef4444',
          fontSize: '0.92rem'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tổng Sự Kiện Đã Ghi Nhận</span>
            <History size={18} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
            {totalRecords.toLocaleString()} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>lượt thao tác</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Mọi biến động xuất, nhập, điều chỉnh, khóa sổ
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phân Hệ Giám Sát</span>
            <Database size={18} style={{ color: '#10b981' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
            {tables.length || 8} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>phân hệ</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Kỳ Dược, Kho chẵn, Tủ trực, Phiếu lĩnh, Thuốc, Lô
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cơ Chế Bắt Vết</span>
            <Layers size={18} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#8b5cf6' }}>
            Tự Động 100%
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Bắt vết ngầm tức thì ngay khi nhấn Lưu
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tính Toàn Vẹn & Pháp Lý</span>
            <CheckCircle2 size={18} style={{ color: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7' }}>
            Niêm Phong Điện Tử
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Không thể sửa đổi hoặc xóa nhật ký
          </div>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="card" style={{ 
        background: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        borderRadius: '12px', 
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <form onSubmit={handleFilterSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto', gap: '0.85rem', alignItems: 'flex-end' }}>
            {/* Bộ lọc Khoa Phòng */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                Khoa phòng:
              </label>
              {!isClinical ? (
                <select 
                  value={selectedDept} 
                  onChange={e => { setSelectedDept(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                >
                  <option value="all">-- Toàn viện (Tất cả khoa) --</option>
                  {departments.map(d => (
                    <option key={d.departmentID} value={d.departmentID}>
                      {d.departmentName}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  background: 'rgba(59, 130, 246, 0.08)',
                  color: 'var(--color-primary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  height: '38px',
                  boxSizing: 'border-box'
                }}>
                  <Building size={14} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.departmentName || 'Khoa của bạn'}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                {isFriendlyMode ? 'Phân hệ nghiệp vụ:' : 'Bảng cơ sở dữ liệu:'}
              </label>
              <select 
                value={selectedTable} 
                onChange={e => { setSelectedTable(e.target.value); setPage(1); }}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
              >
                <option value="all">-- Tất cả phân hệ --</option>
                <option value="AccountingPeriods">Kỳ Kế Toán Dược (AccountingPeriods)</option>
                <option value="Medicines">Danh Mục Biệt Dược (Medicines)</option>
                <option value="Batches">Lô Hạn Dùng Thuốc (Batches)</option>
                <option value="InventoryStocks">Kho Thuốc Chẵn Viện (InventoryStocks)</option>
                <option value="DepartmentStocks">Tủ Trực Khoa Lâm Sàng (DepartmentStocks)</option>
                <option value="MedicineRequisitions">Phiếu Lĩnh Thuốc (MedicineRequisitions)</option>
                <option value="MedicineRequisitionDetails">Chi Tiết Xuất Kho Thuốc (MedicineRequisitionDetails)</option>
                <option value="ImportReceipts">Phiếu Nhập Kho Viện (ImportReceipts)</option>
                <option value="BreakageReports">Biên Bản Vỡ Hỏng / Hư Hao (BreakageReports)</option>
                <option value="InternalTransfers">Điều Chuyển Kho Nội Bộ (InternalTransfers)</option>
                <option value="ReturnReceipts">Phiếu Hoàn Trả Kho (ReturnReceipts)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                {isFriendlyMode ? 'Loại hành động:' : 'SQL Action:'}
              </label>
              <select 
                value={selectedAction} 
                onChange={e => { setSelectedAction(e.target.value); setPage(1); }}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
              >
                <option value="all">-- Tất cả hành động --</option>
                <option value="INSERT">Khởi tạo / Thêm mới (INSERT)</option>
                <option value="UPDATE">Chỉnh sửa / Cập nhật (UPDATE)</option>
                <option value="DELETE">Xóa bỏ dữ liệu (DELETE)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>Người thực hiện:</label>
              <input 
                type="text" 
                placeholder="Tên hoặc tài khoản..." 
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>Từ ngày:</label>
              <input 
                type="date" 
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>Đến ngày:</label>
              <input 
                type="date" 
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                type="submit" 
                className="btn-primary"
                style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', height: '38px' }}
              >
                <Search size={15} />
                <span>Tìm kiếm</span>
              </button>
              <button 
                type="button" 
                onClick={handleResetFilter}
                className="btn-secondary"
                style={{ padding: '0.55rem 0.85rem', fontSize: '0.85rem', height: '38px' }}
                title="Xóa bộ lọc"
              >
                Đặt lại
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} style={{ color: 'var(--color-primary)' }} />
              {isFriendlyMode ? 'Dòng Thời Gian Các Hoạt Động Của Nhân Viên Y Tế' : 'Dòng Thời Gian Các Sự Kiện Hệ Thống (Audit Timeline)'}
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {isFriendlyMode 
                ? 'Hiển thị diễn giải nghiệp vụ dễ hiểu. Nhấp "Đối chiếu" để xem so sánh dữ liệu Cũ - Mới.'
                : 'Xem mã nguồn cơ sở dữ liệu EF Core, Table Names, Action Verbs và Primary Keys.'}
            </p>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Hiển thị {logs.length} / {totalRecords} bản ghi
          </span>
        </div>

        {/* THANH KÉO CUỘN NGANG (HORIZONTAL SCROLL DRAG CONTROLLER) */}
        <div style={{
          padding: '0.65rem 1.25rem',
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primary)', fontWeight: '700', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            <SlidersHorizontal size={15} />
            <span>Thanh kéo ngang:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              onClick={() => scrollToPosition('start')}
              disabled={scrollPercent <= 1}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                cursor: scrollPercent <= 1 ? 'not-allowed' : 'pointer',
                opacity: scrollPercent <= 1 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Về đầu trang bảng (Cột bên trái)"
            >
              « Đầu bảng
            </button>
            <button
              onClick={() => scrollByAmount(-220)}
              disabled={scrollPercent <= 1}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                cursor: scrollPercent <= 1 ? 'not-allowed' : 'pointer',
                opacity: scrollPercent <= 1 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Cuộn sang trái 220px"
            >
              ‹ Sang trái
            </button>
          </div>

          {/* Interactive Range Track */}
          <div style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <input
              type="range"
              min="0"
              max="100"
              value={scrollPercent}
              onChange={handleRangeScroll}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '6px',
                cursor: 'ew-resize',
                accentColor: 'var(--color-primary)',
                background: `linear-gradient(to right, var(--color-primary) ${scrollPercent}%, var(--border-color) ${scrollPercent}%)`
              }}
              title="Kéo con trượt này sang trái hoặc sang phải để xem hết tất cả các cột"
            />
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              fontFamily: 'monospace',
              padding: '0.15rem 0.45rem',
              borderRadius: '5px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--color-primary)',
              minWidth: '45px',
              textAlign: 'center'
            }}>
              {Math.round(scrollPercent)}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              onClick={() => scrollByAmount(220)}
              disabled={scrollPercent >= 99}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                cursor: scrollPercent >= 99 ? 'not-allowed' : 'pointer',
                opacity: scrollPercent >= 99 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Cuộn sang phải 220px"
            >
              Sang phải ›
            </button>
            <button
              onClick={() => scrollToPosition('end')}
              disabled={scrollPercent >= 99}
              style={{
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-main)',
                cursor: scrollPercent >= 99 ? 'not-allowed' : 'pointer',
                opacity: scrollPercent >= 99 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Đến cuối bảng (Cột Đối Chiếu bên phải cùng)"
            >
              Cuối bảng »
            </button>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: scrollPercent >= 95 ? '#10b981' : '#f59e0b' }} />
            <span>{scrollPercent >= 95 ? 'Đã xem hết bên phải (Đối chiếu)' : 'Có thể giữ chuột kéo bảng hoặc kéo thanh trượt'}</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={30} className="spin" style={{ margin: 'auto', marginBottom: '0.75rem', color: 'var(--color-primary)' }} />
            <div>Đang truy vấn dữ liệu kiểm toán...</div>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileSearch size={48} style={{ opacity: 0.35, marginBottom: '0.75rem', strokeWidth: 1.5 }} />
            <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-main)' }}>Không tìm thấy bản ghi kiểm toán phù hợp</div>
            <p style={{ maxWidth: '460px', margin: '0.5rem auto 0 auto', fontSize: '0.85rem' }}>
              Hãy thử thay đổi tiêu chí lọc bảng dữ liệu, người thao tác hoặc khoảng thời gian.
            </p>
          </div>
        ) : (
          <div 
            ref={tableContainerRef}
            className="table-responsive" 
            onScroll={handleTableScroll}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
          >
            <table className="custom-table" style={{ width: '100%', minWidth: '1380px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '0.75rem 0.85rem', width: '60px' }}>Mã Vết</th>
                  <th style={{ padding: '0.75rem 0.85rem', width: '140px', minWidth: '130px' }}>Thời Gian</th>
                  <th style={{ padding: '0.75rem 0.85rem', width: '150px', minWidth: '140px' }}>Khoa Phòng</th>
                  <th style={{ padding: '0.75rem 0.85rem', width: '160px', minWidth: '150px' }}>Người Thực Hiện</th>
                  <th style={{ padding: '0.75rem 0.85rem', width: '160px', minWidth: '150px' }}>
                    {isFriendlyMode ? 'Phân Hệ Nghiệp Vụ' : 'Bảng Dữ Liệu'}
                  </th>
                  <th style={{ padding: '0.75rem 0.85rem', minWidth: '220px' }}>
                    {isFriendlyMode ? 'Hoạt Động Thực Tế' : 'Diễn Giải Nghiệp Vụ'}
                  </th>
                  <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', width: '120px', minWidth: '120px' }}>Hành Động</th>
                  <th style={{ padding: '0.75rem 0.85rem', width: '150px', minWidth: '140px' }}>
                    {isFriendlyMode ? 'Đối Tượng Tác Động' : 'Khóa Chính (Key)'}
                  </th>
                  <th style={{ padding: '0.75rem 0.85rem', width: '150px', minWidth: '140px' }}>
                    {isFriendlyMode ? 'Nội Dung Thay Đổi' : 'Cột Thay Đổi'}
                  </th>
                  <th className="sticky-action-col" style={{ padding: '0.75rem 0.85rem', textAlign: 'center', width: '100px', minWidth: '100px' }}>Đối Chiếu</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const smartAction = getSmartAction(log);
                  const tableMeta = TABLE_MAP[log.tableName || log.entityName] || { 
                    label: log.tableName || log.entityName || 'Hệ Thống', 
                    icon: Database, 
                    color: 'var(--color-primary)', 
                    bg: 'rgba(59, 130, 246, 0.1)' 
                  };
                  const TableIcon = tableMeta.icon;
                  const ActionIcon = smartAction.icon;

                  return (
                    <tr key={log.logID} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                      {/* Mã Vết */}
                      <td style={{ padding: '0.75rem 0.85rem', fontFamily: 'monospace', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                        #{log.logID}
                      </td>

                      {/* Thời Gian */}
                      <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.82rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {new Date(log.createdAt).toLocaleDateString('vi-VN')}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.78rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={11} style={{ opacity: 0.6 }} />
                          {new Date(log.createdAt).toLocaleTimeString('vi-VN')}
                        </div>
                      </td>

                      {/* Khoa Phòng */}
                      <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.82rem' }}>
                        {log.departmentName ? (
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: '#2563eb',
                            background: 'rgba(37, 99, 235, 0.08)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(37, 99, 235, 0.2)'
                          }}>
                            <Building size={12} />
                            {log.departmentName}
                          </span>
                        ) : (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: 'var(--text-muted)',
                            fontStyle: 'italic',
                            background: 'var(--bg-primary)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)'
                          }}>
                            {log.tableName === 'InventoryStocks' ? 'Kho Dược Chính' : 'Toàn Viện'}
                          </span>
                        )}
                      </td>

                      {/* Người Thực Hiện & Vai Trò */}
                      <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-main)' }}>
                          <User size={14} style={{ color: 'var(--color-primary)' }} />
                          {log.username || 'Hệ thống'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span style={{ 
                            fontSize: '0.72rem', 
                            background: 'rgba(59, 130, 246, 0.08)', 
                            color: 'var(--color-primary)', 
                            padding: '0.1rem 0.4rem', 
                            borderRadius: '4px',
                            fontWeight: 600 
                          }}>
                            {ROLE_MAP[log.userRole] || log.userRole || 'Nhân viên'}
                          </span>
                          {log.ipAddress && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              • {log.ipAddress}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Phân Hệ Nghiệp Vụ */}
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        {isFriendlyMode ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.35rem', 
                              fontSize: '0.82rem', 
                              background: tableMeta.bg, 
                              color: tableMeta.color,
                              padding: '0.25rem 0.6rem', 
                              borderRadius: '6px',
                              fontWeight: 700,
                              width: 'fit-content'
                            }}>
                              <TableIcon size={13} />
                              {tableMeta.label}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', paddingLeft: '4px' }}>
                              {log.tableName || log.entityName}
                            </span>
                          </div>
                        ) : (
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.35rem', 
                            fontFamily: 'monospace', 
                            fontSize: '0.82rem', 
                            background: 'var(--bg-primary)', 
                            padding: '0.2rem 0.55rem', 
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)',
                            fontWeight: 600
                          }}>
                            <Database size={12} style={{ color: 'var(--color-primary)' }} />
                            {log.tableName || log.entityName || 'General'}
                          </span>
                        )}
                      </td>

                      {/* Hoạt Động Thực Tế */}
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', lineHeight: '1.45', fontSize: '0.86rem' }}>
                          {getBusinessNarrative(log)}
                        </div>
                      </td>

                      {/* Hành Động */}
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                        {isFriendlyMode ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <span style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: smartAction.bg, 
                              color: smartAction.color, 
                              padding: '0.25rem 0.65rem', 
                              borderRadius: '12px', 
                              fontSize: '0.76rem', 
                              fontWeight: 700,
                              border: `1px solid ${smartAction.color}33`,
                              whiteSpace: 'nowrap'
                            }}>
                              <ActionIcon size={12} />
                              {smartAction.label}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {log.action}
                            </span>
                          </div>
                        ) : (
                          <span style={{ 
                            background: smartAction.bg, 
                            color: smartAction.color, 
                            padding: '0.2rem 0.55rem', 
                            borderRadius: '12px', 
                            fontSize: '0.74rem', 
                            fontWeight: 700,
                            border: `1px solid ${smartAction.color}33`
                          }}>
                            {log.action}
                          </span>
                        )}
                      </td>

                      {/* Đối Tượng Tác Động / Khóa Chính */}
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        {isFriendlyMode ? (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem' }}>
                              {formatTargetObject(log)}
                            </div>
                            {log.keyValues && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                                {log.keyValues.length > 25 ? `${log.keyValues.slice(0, 25)}...` : log.keyValues}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {log.keyValues || (log.entityID ? `ID: ${log.entityID}` : '---')}
                          </span>
                        )}
                      </td>

                      {/* Nội Dung Thay Đổi / Cột Thay Đổi */}
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        {log.changedColumns ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxWidth: '200px' }}>
                            {log.changedColumns.split(',').map((c, i) => {
                              const trimmed = c.trim();
                              return (
                                <span 
                                  key={i} 
                                  title={isFriendlyMode ? `Tên trường CSDL: ${trimmed}` : ''}
                                  style={{ 
                                    background: 'var(--bg-primary)', 
                                    padding: '0.15rem 0.45rem', 
                                    borderRadius: '4px', 
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.75rem', 
                                    fontWeight: isFriendlyMode ? 600 : 400,
                                    color: 'var(--text-main)'
                                  }}
                                >
                                  {isFriendlyMode ? (COLUMN_MAP[trimmed] || trimmed) : trimmed}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                            {isFriendlyMode ? 'Khởi tạo toàn bộ thông tin' : 'Tất cả trường'}
                          </span>
                        )}
                      </td>

                      {/* Chi Tiết Diff */}
                      <td className="sticky-action-col" style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button 
                          onClick={() => setInspectLog(log)}
                          className="btn-secondary"
                          style={{ padding: '0.38rem 0.7rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                          title="Xem bảng so sánh chi tiết giá trị Cũ và Mới"
                        >
                          <Eye size={13} />
                          <span>Đối chiếu</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Table Bottom Control Bar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '0.6rem 1rem', 
          background: 'var(--bg-secondary)', 
          borderTop: '1px solid var(--border-color)', 
          fontSize: '0.8rem', 
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeftRight size={14} style={{ color: 'var(--color-primary)' }} />
            <span>Kéo thanh trượt hoặc giữ chuột rê trên bảng để duyệt các cột thông tin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button 
              onClick={() => scrollToPosition(0)}
              className="btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              title="Về đầu bảng (bên trái)"
            >
              « Đầu Bảng
            </button>
            <button 
              onClick={() => scrollByAmount(-250)}
              className="btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              title="Cuộn sang trái"
            >
              ‹ Sang Trái
            </button>
            <span style={{ padding: '0 0.35rem', fontWeight: 600, color: 'var(--color-primary)' }}>
              {scrollPercent}%
            </span>
            <button 
              onClick={() => scrollByAmount(250)}
              className="btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              title="Cuộn sang phải"
            >
              Sang Phải ›
            </button>
            <button 
              onClick={() => scrollToPosition(99999)}
              className="btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              title="Đến cột Thao Tác / Đối Chiếu cuối cùng"
            >
              Đối Chiếu »
            </button>
          </div>
        </div>

        {/* Pagination Bar */}
        <div style={{ 
          padding: '1rem 1.5rem', 
          borderTop: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'var(--bg-card)'
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Trang <strong>{page}</strong> / <strong>{totalPages || 1}</strong> (Tổng cộng <strong>{totalRecords}</strong> bản ghi)
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <ChevronLeft size={15} />
              <span>Trang trước</span>
            </button>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>Trang sau</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Diff Inspector Modal */}
      {inspectLog && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '880px', width: '95%', padding: '1.75rem', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Eye size={22} style={{ color: 'var(--color-primary)' }} />
                  Đối Chiếu Thay Đổi Dữ Liệu Chi Tiết
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Bản ghi kiểm toán #{inspectLog.logID} • Phân hệ: <strong>{TABLE_MAP[inspectLog.tableName || inspectLog.entityName]?.label || inspectLog.tableName}</strong>
                </p>
              </div>
              <button 
                onClick={() => setInspectLog(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ padding: '1rem 0', flex: 1, overflowY: 'auto' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Khoa phòng liên quan</div>
                  <strong style={{ color: '#2563eb' }}>{inspectLog.departmentName || 'Kho Dược Chính / Toàn Viện'}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Người thực hiện</div>
                  <strong>{inspectLog.username || 'Hệ thống'}</strong> ({ROLE_MAP[inspectLog.userRole] || inspectLog.userRole || 'Nhân viên'})
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Thời điểm ghi nhận</div>
                  <strong>{new Date(inspectLog.createdAt).toLocaleString('vi-VN')}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Đối tượng tác động</div>
                  <strong style={{ color: 'var(--color-primary)' }}>{formatTargetObject(inspectLog)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Địa chỉ IP thao tác</div>
                  <span style={{ fontFamily: 'monospace' }}>{inspectLog.ipAddress || '127.0.0.1'}</span>
                </div>
              </div>

              {/* Business narrative callout */}
              <div style={{ 
                background: 'rgba(59, 130, 246, 0.08)', 
                border: '1px solid rgba(59, 130, 246, 0.25)', 
                borderRadius: '8px', 
                padding: '0.85rem 1rem', 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <Sparkles size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <div style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                  <strong>Nghiệp vụ thực tế: </strong> 
                  {getBusinessNarrative(inspectLog)}
                </div>
              </div>

              {renderDiffViewer(inspectLog)}
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setInspectLog(null)}
                className="btn-secondary"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Đóng đối chiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
