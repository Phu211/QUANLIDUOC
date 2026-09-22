import ExcelJS from 'exceljs/dist/exceljs.min.js';

/**
 * Helper xuất báo cáo Excel (.xlsx) chuẩn thẩm mỹ Y Tế / Bệnh Viện
 * Được định dạng chuyên nghiệp với Header, Màu sắc, Kẻ viền, Tự động chỉnh độ rộng cột,
 * Căn lề số/chữ/ngày tháng, Phân màu trạng thái, Dòng tổng cộng và Khung chữ ký hành chính.
 */

// Bảng màu y tế chuyên nghiệp
const PALETTE = {
  headerFill: '1E3A8A',       // Xanh dương y tế đậm (Navy Blue)
  headerText: 'FFFFFF',       // Chữ trắng
  titleBg: '1E40AF',          // Tiêu đề chính
  zebraLight: 'F8FAFC',       // Màu xen kẽ dòng lẻ (Slate 50)
  zebraWhite: 'FFFFFF',       // Dòng chẵn
  borderColor: 'CBD5E1',      // Viền mỏng (Slate 300)
  totalBg: 'F1F5F9',          // Nền dòng tổng cộng
  textMain: '0F172A',         // Màu chữ nội dung chính
  textMuted: '475569',        // Màu chữ phụ
  
  // Màu trạng thái (Badges)
  statusSuccessBg: 'DCFCE7',  // Xanh lá nhạt
  statusSuccessText: '166534',
  statusWarningBg: 'FEF3C7',  // Vàng cam nhạt
  statusWarningText: '92400E',
  statusDangerBg: 'FEE2E2',   // Đỏ nhạt
  statusDangerText: '991B1B',
  statusInfoBg: 'E0F2FE',     // Xanh biển nhạt
  statusInfoText: '075985',
};

// Viền chuẩn cho ô dữ liệu
const thinBorder = {
  top: { style: 'thin', color: { argb: 'FF' + PALETTE.borderColor } },
  left: { style: 'thin', color: { argb: 'FF' + PALETTE.borderColor } },
  bottom: { style: 'thin', color: { argb: 'FF' + PALETTE.borderColor } },
  right: { style: 'thin', color: { argb: 'FF' + PALETTE.borderColor } }
};

// Viền cho dòng tổng cộng (kế toán chuẩn: gạch đơn trên, gạch đôi dưới)
const totalBorder = {
  top: { style: 'thin', color: { argb: 'FF334155' } },
  left: { style: 'thin', color: { argb: 'FF' + PALETTE.borderColor } },
  bottom: { style: 'double', color: { argb: 'FF334155' } },
  right: { style: 'thin', color: { argb: 'FF' + PALETTE.borderColor } }
};

/**
 * Nhận diện trạng thái để tô màu ô phù hợp
 */
function getStatusStyle(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim().toLowerCase();
  
  // Trạng thái tích cực
  if (s.includes('đã bù') || s.includes('đã duyệt') || s.includes('hoàn thành') || s.includes('an toàn') || s.includes('bình thường') || s.includes('đã nhận')) {
    return { bg: PALETTE.statusSuccessBg, text: PALETTE.statusSuccessText };
  }
  // Trạng thái cảnh báo / chờ
  if (s.includes('chưa bù') || s.includes('chờ duyệt') || s.includes('chờ') || s.includes('sắp hết hạn') || s.includes('cận hạn') || s.includes('cảnh báo') || s.includes('dưới mức')) {
    return { bg: PALETTE.statusWarningBg, text: PALETTE.statusWarningText };
  }
  // Trạng thái lỗi / nguy hiểm
  if (s.includes('từ chối') || s.includes('hết hạn') || s.includes('nguy cấp') || s.includes('thu hồi') || s.includes('đình chỉ') || s.includes('cách ly') || s.includes('hư hỏng') || s.includes('tiêu hủy')) {
    return { bg: PALETTE.statusDangerBg, text: PALETTE.statusDangerText };
  }
  return null;
}

/**
 * Kiểm tra xem một chuỗi có phải là số tiền / số lượng hay không
 */
function isNumeric(val) {
  if (typeof val === 'number') return true;
  if (typeof val !== 'string') return false;
  return !isNaN(val) && !isNaN(parseFloat(val)) && isFinite(val);
}

/**
 * Hàm xuất Excel chung hỗ trợ đa dạng cấu hình
 * 
 * @param {Object} config
 * @param {string} config.fileName - Tên file tải về (không cần .xlsx)
 * @param {string} [config.sheetName='Báo cáo'] - Tên sheet
 * @param {string} [config.hospitalName='BỆNH VIỆN ĐA KHOA - HỆ THỐNG QUẢN LÝ DƯỢC'] - Tên đơn vị
 * @param {string} [config.departmentName=''] - Khoa phòng / Tủ trực
 * @param {string} [config.reportTitle='BÁO CÁO CHI TIẾT'] - Tiêu đề báo cáo
 * @param {string} [config.subtitle=''] - Tiêu đề phụ hoặc ghi chú thời gian
 * @param {string} [config.creator=''] - Tên người xuất / tạo báo cáo
 * @param {Array<string>} config.headers - Danh sách tiêu đề các cột
 * @param {Array<Array<any>>} config.rows - Danh sách các dòng dữ liệu
 * @param {boolean} [config.includeIndex=true] - Tự động thêm cột STT ở đầu bảng
 * @param {Array<number>} [config.summaryColumnIndexes=[]] - Các chỉ số cột cần tính tổng (tính theo bảng dữ liệu có STT)
 * @param {boolean} [config.showSignatures=true] - Hiển thị khung chữ ký chuẩn bệnh viện
 */
export async function exportExcelReport({
  fileName = 'Bao_cao_duoc',
  sheetName = 'Báo cáo',
  hospitalName = 'BỆNH VIỆN ĐA KHOA - HỆ THỐNG QUẢN LÝ DƯỢC',
  departmentName = '',
  reportTitle = 'BÁO CÁO CHI TIẾT',
  subtitle = '',
  creator = '',
  headers = [],
  rows = [],
  includeIndex = true,
  summaryColumnIndexes = [],
  showSignatures = true
}) {
  if (!headers || headers.length === 0) {
    throw new Error('Cần cung cấp danh sách headers cho báo cáo.');
  }

  // Chuẩn bị dữ liệu và cột
  const finalHeaders = includeIndex ? ['STT', ...headers] : [...headers];
  const finalRows = rows.map((row, idx) => {
    return includeIndex ? [idx + 1, ...row] : [...row];
  });

  const totalCols = finalHeaders.length;
  const lastColLetter = getColumnLetter(totalCols);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = creator || 'Hệ Thống Quản Lý Dược Bệnh Viện';
  workbook.lastModifiedBy = creator || 'Hệ Thống Dược';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: totalCols > 6 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });

  // 1. DÒNG THÔNG TIN CƠ QUAN / ĐƠN VỊ
  const r1 = worksheet.addRow([hospitalName.toUpperCase()]);
  r1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF' + PALETTE.headerFill } };
  r1.height = 18;

  const deptText = departmentName ? `Khoa / Đơn vị: ${departmentName}` : 'Bộ phận Quản lý Dược & Tủ trực lâm sàng';
  const r2 = worksheet.addRow([deptText]);
  r2.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF' + PALETTE.textMuted } };
  r2.height = 16;

  // Dòng trống
  worksheet.addRow([]);

  // 2. DÒNG TIÊU ĐỀ BÁO CÁO (MERGED & HIGHLIGHTED)
  const titleRowIndex = worksheet.lastRow.number + 1;
  const titleRow = worksheet.addRow([reportTitle.toUpperCase()]);
  titleRow.height = 32;
  titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF' + PALETTE.headerText } };
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

  // Merge tiêu đề qua toàn bộ số cột
  worksheet.mergeCells(`A${titleRowIndex}:${lastColLetter}${titleRowIndex}`);
  const titleCell = worksheet.getCell(`A${titleRowIndex}`);
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF' + PALETTE.titleBg }
  };

  // 3. DÒNG THÔNG TIN THỜI GIAN & NGƯỜI LẬP
  const now = new Date();
  const timeString = `${now.toLocaleTimeString('vi-VN')} ngày ${now.toLocaleDateString('vi-VN')}`;
  const metaText = subtitle 
    ? `${subtitle} | Xuất lúc: ${timeString}${creator ? ` | Người lập: ${creator}` : ''}`
    : `Thời gian xuất báo cáo: ${timeString}${creator ? ` | Người lập: ${creator}` : ''}`;
  
  const metaRowIndex = worksheet.lastRow.number + 1;
  const metaRow = worksheet.addRow([metaText]);
  metaRow.height = 20;
  metaRow.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF' + PALETTE.textMuted } };
  metaRow.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.mergeCells(`A${metaRowIndex}:${lastColLetter}${metaRowIndex}`);

  // Dòng trống cách ly trước bảng
  worksheet.addRow([]);

  // 4. TIÊU ĐỀ CỘT BẢNG (TABLE HEADERS)
  const tableHeaderRowIndex = worksheet.lastRow.number + 1;
  const headerRow = worksheet.addRow(finalHeaders);
  headerRow.height = 28;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF' + PALETTE.headerText } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF' + PALETTE.headerFill }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  // 5. CÁC DÒNG DỮ LIỆU
  const dataStartRow = tableHeaderRowIndex + 1;
  finalRows.forEach((rowValues, rIdx) => {
    const dataRow = worksheet.addRow(rowValues);
    dataRow.height = 22;
    const isOdd = rIdx % 2 === 1;

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colHeader = finalHeaders[colNumber - 1] || '';
      const val = cell.value;
      
      // Font cơ bản
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF' + PALETTE.textMain } };
      cell.border = thinBorder;

      // Nền so le (Zebra striping)
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF' + (isOdd ? PALETTE.zebraLight : PALETTE.zebraWhite) }
      };

      // Căn lề & định dạng theo loại cột
      const headerLower = colHeader.toLowerCase();

      // Cột STT
      if (colHeader === 'STT') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      // Cột ngày tháng / thời gian
      else if (headerLower.includes('ngày') || headerLower.includes('thời gian') || headerLower.includes('hạn dùng') || headerLower.includes('hsd')) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      // Cột mã / số lô / mã phiếu
      else if (headerLower.includes('mã') || headerLower.includes('số lô') || headerLower.includes('lô')) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      }
      // Cột trạng thái
      else if (headerLower.includes('trạng thái') || headerLower.includes('kết quả') || headerLower.includes('đánh giá')) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        const statusStyle = getStatusStyle(String(val));
        if (statusStyle) {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF' + statusStyle.text } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF' + statusStyle.bg }
          };
        }
      }
      // Cột số lượng / đơn giá / tiền
      else if (headerLower.includes('số lượng') || headerLower.includes('tồn') || headerLower.includes('giá') || headerLower.includes('thành tiền') || isNumeric(val)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof val === 'number') {
          if (headerLower.includes('giá') || headerLower.includes('tiền')) {
            cell.numFmt = '#,##0 "₫"';
          } else {
            cell.numFmt = '#,##0';
          }
        }
      }
      // Cột văn bản thông thường (Tên thuốc, Tên bệnh nhân,...)
      else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  const dataEndRow = worksheet.lastRow.number;

  // 6. DÒNG TỔNG CỘNG (NẾU CÓ DỮ LIỆU)
  if (finalRows.length > 0) {
    const summaryRowValues = new Array(totalCols).fill('');
    summaryRowValues[0] = 'TỔNG CỘNG / TỔNG SỐ LƯỢT: ' + finalRows.length;

    // Tự động tìm các cột số lượng hoặc số tiền để tính tổng nếu chưa cấu hình
    const targetSumCols = summaryColumnIndexes.length > 0
      ? summaryColumnIndexes
      : finalHeaders
          .map((h, idx) => {
            const hl = h.toLowerCase();
            if (hl.includes('số lượng') || hl.includes('tổng tồn') || hl.includes('tồn tủ') || hl.includes('tồn kho') || hl.includes('thành tiền')) {
              return idx + 1;
            }
            return null;
          })
          .filter(Boolean);

    targetSumCols.forEach(colIdx => {
      const colLetter = getColumnLetter(colIdx);
      summaryRowValues[colIdx - 1] = {
        formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${dataEndRow})`
      };
    });

    const sumRow = worksheet.addRow(summaryRowValues);
    sumRow.height = 25;

    sumRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF' + PALETTE.headerFill } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF' + PALETTE.totalBg }
      };
      cell.border = totalBorder;

      if (colNumber === 1) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (targetSumCols.includes(colNumber)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  }

  // 7. KHUNG CHỮ KÝ HÀNH CHÍNH BỆNH VIỆN
  if (showSignatures) {
    // Dòng cách ly
    worksheet.addRow([]);
    worksheet.addRow([]);

    // Dòng ngày tháng ký
    const dateText = `..., Ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
    const dateSignRow = worksheet.addRow(new Array(totalCols).fill(''));
    dateSignRow.height = 20;
    
    // Gán vào cột cuối
    const lastCell = dateSignRow.getCell(totalCols);
    lastCell.value = dateText;
    lastCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF' + PALETTE.textMuted } };
    lastCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 3 vị trí ký chuẩn: Người lập - Điều dưỡng trưởng khoa - Lãnh đạo Khoa Dược
    const titleSignRow = worksheet.addRow(new Array(totalCols).fill(''));
    titleSignRow.height = 22;

    const subSignRow = worksheet.addRow(new Array(totalCols).fill(''));
    subSignRow.height = 18;

    // Phân bổ 3 cột ký
    const colLeft = 2 <= totalCols ? 2 : 1;
    const colMid = Math.max(colLeft + 1, Math.floor(totalCols / 2));
    const colRight = totalCols;

    titleSignRow.getCell(colLeft).value = 'NGƯỜI LẬP BÁO CÁO';
    subSignRow.getCell(colLeft).value = '(Ký và ghi rõ họ tên)';

    if (colMid !== colLeft && colMid !== colRight) {
      titleSignRow.getCell(colMid).value = 'ĐIỀU DƯỠNG TRƯỞNG KHOA';
      subSignRow.getCell(colMid).value = '(Ký và ghi rõ họ tên)';
    }

    titleSignRow.getCell(colRight).value = 'TRƯỞNG KHOA DƯỢC';
    subSignRow.getCell(colRight).value = '(Ký, ghi rõ họ tên & đóng dấu)';

    [colLeft, colMid, colRight].forEach(colIdx => {
      if (colIdx <= totalCols) {
        const tCell = titleSignRow.getCell(colIdx);
        tCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        tCell.alignment = { horizontal: 'center', vertical: 'middle' };

        const sCell = subSignRow.getCell(colIdx);
        sCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
        sCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    // Khoảng trống ký tên (4 dòng)
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow([]);

    // Dòng họ tên người lập nếu có
    if (creator) {
      const nameRow = worksheet.addRow(new Array(totalCols).fill(''));
      nameRow.height = 20;
      const creatorCell = nameRow.getCell(colLeft);
      creatorCell.value = creator;
      creatorCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      creatorCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // 8. TỰ ĐỘNG ĐIỀU CHỈNH ĐỘ RỘNG CỘT (AUTO-FIT COLUMN WIDTHS)
  worksheet.columns.forEach((column, colIdx) => {
    let maxLength = 0;
    const headerTitle = finalHeaders[colIdx] || '';
    maxLength = Math.max(maxLength, headerTitle.length);

    column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
      // Bỏ qua dòng tiêu đề chính và dòng meta khi tính độ rộng
      if (rowNumber === titleRowIndex || rowNumber === metaRowIndex || rowNumber < tableHeaderRowIndex) {
        return;
      }
      const cellVal = cell.value;
      if (cellVal !== null && cellVal !== undefined) {
        const strVal = typeof cellVal === 'object' && cellVal.formula ? '123,456' : String(cellVal);
        maxLength = Math.max(maxLength, strVal.length);
      }
    });

    // Đệm thêm độ rộng cho đẹp, tối thiểu 11, tối đa 42
    column.width = Math.min(Math.max(maxLength + 4, 11), 42);
  });

  // 9. XUẤT FILE VÀ KÍCH HOẠT TẢI VỀ
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  link.download = cleanFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Hàm hỗ trợ đổi chỉ số cột số (1-based) thành chữ cái (ví dụ: 1 -> A, 27 -> AA)
 */
function getColumnLetter(colIndex) {
  let temp;
  let letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp - 1) / 26);
  }
  return letter;
}

/**
 * Hàm xuất Excel tương thích nhanh cho các trang dùng định dạng (data, headers, filename)
 * @param {Array<Object>|Array<Array<any>>} data - Dữ liệu dạng danh sách object hoặc mảng 2 chiều
 * @param {Array<string>} headers - Danh sách tên cột
 * @param {string} filename - Tên file xuất
 * @param {Object} [metaOptions] - Tùy chọn thông tin báo cáo
 */
export async function exportDataToExcel(data, headers, filename = 'Bao_cao', metaOptions = {}) {
  if (!data || !data.length) {
    alert("Không có dữ liệu để xuất báo cáo!");
    return;
  }

  let rows = [];
  if (Array.isArray(data[0])) {
    rows = data;
  } else {
    rows = data.map(item => headers.map(h => (item[h] !== undefined ? item[h] : '')));
  }

  const title = metaOptions.title || filename.replace(/_/g, ' ').toUpperCase();

  await exportExcelReport({
    fileName: filename,
    sheetName: metaOptions.sheetName || 'Báo cáo',
    departmentName: metaOptions.departmentName || '',
    reportTitle: title,
    subtitle: metaOptions.subtitle || `Tổng cộng: ${data.length} bản ghi`,
    creator: metaOptions.creator || 'Cán bộ Y tế',
    headers,
    rows,
    includeIndex: metaOptions.includeIndex !== undefined ? metaOptions.includeIndex : true,
    showSignatures: metaOptions.showSignatures !== undefined ? metaOptions.showSignatures : true
  });
}
