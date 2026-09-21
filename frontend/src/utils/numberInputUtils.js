/**
 * ==========================================================================
 * NUMBER INPUT UTILITIES FOR HIS - PHARMACY
 * Tiện ích chuẩn hóa và khóa chặt nhập số nguyên cho toàn bộ hệ thống
 * ==========================================================================
 */

/**
 * Ngăn chặn người dùng gõ các phím không phải chữ số (bao gồm e, E, +, -, ., dấu phẩy, chữ cái).
 * Chỉ cho phép phím số 0-9 và các phím điều hướng hệ thống (Backspace, Delete, Tab, Arrow...).
 */
export const handleIntegerKeyDown = (e) => {
  if (
    ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
    e.ctrlKey || e.metaKey
  ) {
    return;
  }
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
};

/**
 * Làm sạch chuỗi đầu vào, chỉ giữ lại các chữ số 0-9.
 * @param {string|number} value Giá trị cần làm sạch
 * @param {boolean} allowZero Cho phép số 0 (ví dụ kiểm kê thực tế hoặc tồn tối thiểu = 0)
 * @returns {string} Chuỗi chỉ chứa số nguyên
 */
export const sanitizeInteger = (value, allowZero = false) => {
  if (value === null || value === undefined) return '';
  const digits = String(value).replace(/\D/g, '');
  if (allowZero) {
    return digits.length > 1 && digits.startsWith('0') ? String(parseInt(digits, 10)) : digits;
  }
  return digits.replace(/^0+/, '');
};

/**
 * Xử lý sự kiện dán dữ liệu (Paste) chỉ lấy chữ số nguyên
 */
export const handleIntegerPaste = (e, callback, allowZero = false) => {
  e.preventDefault();
  const pasteText = e.clipboardData ? e.clipboardData.getData('text') : '';
  const cleaned = sanitizeInteger(pasteText, allowZero);
  if (callback) {
    callback(cleaned);
  }
};
