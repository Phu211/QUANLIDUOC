using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using HisPharmacy.Api.Data;
using HisPharmacy.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class OcrController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly GeminiAiService _geminiService;

    public OcrController(HisDbContext context, GeminiAiService geminiService)
    {
        _context = context;
        _geminiService = geminiService;
    }

    public class OcrParseRequest
    {
        public string? ImageBase64 { get; set; }
        public string? FileBase64 { get; set; }
        public string? MimeType { get; set; }
        public string? FileName { get; set; }
        public string? RawText { get; set; }
    }

    public class OcrItemResult
    {
        public int? MedicineID { get; set; }
        public string MedicineCode { get; set; } = string.Empty;
        public string MedicineName { get; set; } = string.Empty;
        public string MatchedMedicineName { get; set; } = string.Empty;
        public string GenericName { get; set; } = string.Empty;
        public string BatchNumber { get; set; } = string.Empty;
        public string ExpiryDate { get; set; } = string.Empty; // YYYY-MM-DD
        public string Unit { get; set; } = "viên";
        public decimal ImportPrice { get; set; }
        public int Quantity { get; set; }
        public decimal TotalAmount => ImportPrice * Quantity;
        public decimal? ContractPrice { get; set; }
        public int? RemainingContractQty { get; set; }
        public bool IsMatched { get; set; }
        public double Confidence { get; set; } = 0.95;
        public string? Warning { get; set; }
    }

    public class OcrParseResponse
    {
        public bool Success { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public string InvoiceSymbol { get; set; } = string.Empty;
        public string InvoiceDate { get; set; } = string.Empty; // YYYY-MM-DD
        public string DeliveryNoteNumber { get; set; } = string.Empty;
        public int? SupplierID { get; set; }
        public string SupplierName { get; set; } = string.Empty;
        public string TaxCode { get; set; } = string.Empty;
        public double OverallConfidence { get; set; } = 0.95;
        public decimal TotalInvoiceAmount { get; set; }
        public List<OcrItemResult> Items { get; set; } = new();
        public string ExtractedRawText { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string AiEngine { get; set; } = "Smart OCR Vision Engine";
    }

    [HttpPost("parse-invoice")]
    public async Task<IActionResult> ParseInvoice([FromBody] OcrParseRequest req)
    {
        var base64Content = !string.IsNullOrEmpty(req.FileBase64) ? req.FileBase64 : req.ImageBase64;
        if (string.IsNullOrWhiteSpace(base64Content))
        {
            return BadRequest(new OcrParseResponse
            {
                Success = false,
                Message = "Vui lòng chọn hoặc dán ảnh / tệp PDF hóa đơn để bóc tách thực tế."
            });
        }

        if (!_geminiService.IsConfigured)
        {
            return BadRequest(new OcrParseResponse
            {
                Success = false,
                Message = "Dịch vụ bóc tách OCR chưa được cấu hình khóa kết nối trên máy chủ."
            });
        }

        var dbMedicines = await _context.Medicines.AsNoTracking().ToListAsync();
        var dbSuppliers = await _context.Suppliers.AsNoTracking().ToListAsync();
        var dbContractItems = await _context.SupplierMedicines.AsNoTracking().ToListAsync();

        var response = new OcrParseResponse { Success = false };

        try
        {
            var cleanB64 = base64Content;
            var mimeType = req.MimeType ?? "image/jpeg";

            if (cleanB64.Contains(","))
            {
                var splitted = cleanB64.Split(',');
                var headerPart = splitted[0].ToLower();
                if (headerPart.Contains("image/png")) mimeType = "image/png";
                else if (headerPart.Contains("application/pdf")) mimeType = "application/pdf";
                else if (headerPart.Contains("image/webp")) mimeType = "image/webp";
                else if (headerPart.Contains("image/jpeg") || headerPart.Contains("image/jpg")) mimeType = "image/jpeg";
                cleanB64 = splitted[1];
            }

            var fileBytes = Convert.FromBase64String(cleanB64);
            if (fileBytes.Length == 0)
            {
                return BadRequest(new OcrParseResponse
                {
                    Success = false,
                    Message = "Dữ liệu tệp ảnh/PDF tải lên bị trống."
                });
            }

            var prompt = @"Bạn là chuyên gia thị giác máy tính OCR xử lý hóa đơn điện tử GTGT và chứng từ xuất kho dược phẩm bệnh viện tại Việt Nam.
Hãy phân tích toàn bộ tài liệu hình ảnh/PDF này và trích xuất thông tin theo cấu trúc JSON chuẩn RFC 8259:
{
  ""invoiceNumber"": ""Số hóa đơn (VD: 00012345, 08941)"",
  ""invoiceSymbol"": ""Ký hiệu mẫu hóa đơn (VD: 1C26TDH, 1K26MTP)"",
  ""invoiceDate"": ""Ngày lập hóa đơn chuẩn YYYY-MM-DD (VD: 2026-08-15)"",
  ""deliveryNoteNumber"": ""Số biên bản giao hàng / Số phiếu xuất kho / Số hợp đồng nếu có (VD: BBGH-0826, PXK-9921)"",
  ""supplierName"": ""Tên công ty bán / Nhà cung cấp dược phẩm"",
  ""taxCode"": ""Mã số thuế của công ty bán (MST)"",
  ""buyerName"": ""Tên đơn vị mua / Bệnh viện"",
  ""items"": [
    {
      ""medicineName"": ""Tên biệt dược hoặc hoạt chất (kèm hàm lượng/nồng độ nếu có, VD: Paracetamol 500mg, Augmentin 1g)"",
      ""batchNumber"": ""Số lô sản xuất (VD: LOT-2026A, 082601)"",
      ""expiryDate"": ""Hạn sử dụng chuẩn YYYY-MM-DD (Nếu hóa đơn ghi dạng MM/YYYY hoặc MM/YY thì lấy ngày 28 của tháng đó; nếu ghi dd/MM/yyyy thì chuẩn hóa về YYYY-MM-DD)"",
      ""unit"": ""Đơn vị tính (VD: viên, hộp, lọ, ống, chai, vỉ, gói...)"",
      ""quantity"": 100,
      ""importPrice"": 15000,
      ""totalAmount"": 1500000
    }
  ],
  ""summaryText"": ""Tóm tắt ngắn gọn các thông tin đọc được""
}

YÊU CẦU BẮT BUỘC:
1. KHÔNG TỰ BỊA ĐẶT THÔNG TIN. Chỉ trích xuất đúng các dòng dữ liệu nhìn thấy rõ trên hóa đơn.
2. Nếu không tìm thấy trường nào thì để chuỗi rỗng """" hoặc 0.
3. Trả về DUY NHẤT một chuỗi JSON hợp lệ chuẩn RFC 8259, không thêm bất kỳ văn bản giải thích nào.";

            var visionJsonRaw = await _geminiService.AnalyzeDocumentAsync(fileBytes, mimeType, prompt);

            if (string.IsNullOrWhiteSpace(visionJsonRaw))
            {
                return Ok(new OcrParseResponse
                {
                    Success = false,
                    Message = "Mô hình Gemini Vision AI không phản hồi hoặc tài liệu không thể đọc được."
                });
            }

            var cleanJson = GeminiAiService.CleanJsonFromMarkdown(visionJsonRaw);
            using var doc = JsonDocument.Parse(cleanJson);
            var root = doc.RootElement;

            if (root.TryGetProperty("invoiceNumber", out var inv)) response.InvoiceNumber = inv.GetString()?.Trim() ?? "";
            if (root.TryGetProperty("invoiceSymbol", out var sym)) response.InvoiceSymbol = sym.GetString()?.Trim() ?? "";
            if (root.TryGetProperty("invoiceDate", out var invDate))
            {
                var dStr = invDate.GetString()?.Trim() ?? "";
                response.InvoiceDate = NormalizeDateString(dStr);
            }
            if (root.TryGetProperty("deliveryNoteNumber", out var bb)) response.DeliveryNoteNumber = bb.GetString()?.Trim() ?? "";
            if (root.TryGetProperty("supplierName", out var sup)) response.SupplierName = sup.GetString()?.Trim() ?? "";
            if (root.TryGetProperty("taxCode", out var mst)) response.TaxCode = CleanTaxCode(mst.GetString() ?? "");
            if (root.TryGetProperty("summaryText", out var smm)) response.ExtractedRawText = smm.GetString()?.Trim() ?? "";

            if (root.TryGetProperty("items", out var itemsElem) && itemsElem.ValueKind == JsonValueKind.Array)
            {
                foreach (var it in itemsElem.EnumerateArray())
                {
                    var medName = it.TryGetProperty("medicineName", out var mn) ? mn.GetString()?.Trim() ?? "" : "";
                    var batchNo = it.TryGetProperty("batchNumber", out var bn) ? bn.GetString()?.Trim() ?? "" : "";
                    var expDate = it.TryGetProperty("expiryDate", out var exp) ? exp.GetString()?.Trim() ?? "" : "";
                    var unitStr = it.TryGetProperty("unit", out var un) ? un.GetString()?.Trim() ?? "viên" : "viên";
                    
                    decimal price = 0m;
                    if (it.TryGetProperty("importPrice", out var pr))
                    {
                        if (pr.ValueKind == JsonValueKind.Number) price = pr.GetDecimal();
                        else if (decimal.TryParse(pr.GetString(), out var parsedPr)) price = parsedPr;
                    }

                    int qty = 1;
                    if (it.TryGetProperty("quantity", out var q))
                    {
                        if (q.ValueKind == JsonValueKind.Number) qty = q.GetInt32();
                        else if (int.TryParse(q.GetString(), out var parsedQty)) qty = parsedQty;
                    }

                    if (!string.IsNullOrEmpty(medName))
                    {
                        response.Items.Add(new OcrItemResult
                        {
                            MedicineName = medName,
                            BatchNumber = !string.IsNullOrEmpty(batchNo) ? batchNo : "N/A",
                            ExpiryDate = NormalizeDateString(expDate),
                            Unit = !string.IsNullOrEmpty(unitStr) ? unitStr : "viên",
                            ImportPrice = price,
                            Quantity = Math.Max(1, qty),
                            Confidence = 0.95
                        });
                    }
                }
            }

            if (!response.Items.Any())
            {
                return Ok(new OcrParseResponse
                {
                    Success = false,
                    Message = "Không phát hiện bảng danh mục mặt hàng dược phẩm nào trên tài liệu tải lên. Vui lòng kiểm tra lại chất lượng hoặc góc chụp của hóa đơn."
                });
            }

            // 2. ĐỐI CHIẾU NHÀ CUNG CẤP VỚI CSDL
            Supplier? matchedSupplier = null;

            if (!string.IsNullOrEmpty(response.SupplierName))
            {
                var normSupName = RemoveDiacritics(response.SupplierName.ToLower());
                matchedSupplier = dbSuppliers.FirstOrDefault(s =>
                {
                    var normDb = RemoveDiacritics(s.SupplierName.ToLower());
                    return normDb.Contains(normSupName) || normSupName.Contains(normDb);
                });
            }

            if (matchedSupplier != null)
            {
                response.SupplierID = matchedSupplier.SupplierID;
                response.SupplierName = matchedSupplier.SupplierName;
            }

            // 3. ĐỐI CHIẾU DƯỢC PHẨM VỚI DANH MỤC THUỐC BỆNH VIỆN & GIÁ THẦU
            foreach (var item in response.Items)
            {
                var normItemName = RemoveDiacritics(item.MedicineName.ToLower());

                var matchedMed = dbMedicines.FirstOrDefault(m =>
                {
                    var normMedName = RemoveDiacritics(m.MedicineName.ToLower());
                    if (normMedName == normItemName || normMedName.Contains(normItemName) || normItemName.Contains(normMedName))
                        return true;

                    if (!string.IsNullOrEmpty(m.MedicineCode) && normItemName.Contains(m.MedicineCode.ToLower()))
                        return true;

                    if (!string.IsNullOrEmpty(m.GenericName))
                    {
                        var normGen = RemoveDiacritics(m.GenericName.ToLower());
                        if (normItemName.Contains(normGen) || normGen.Contains(normItemName))
                            return true;
                    }

                    return false;
                });

                if (matchedMed != null)
                {
                    item.MedicineID = matchedMed.MedicineID;
                    item.MedicineCode = matchedMed.MedicineCode;
                    item.MatchedMedicineName = matchedMed.MedicineName;
                    item.GenericName = matchedMed.GenericName ?? string.Empty;
                    item.Unit = matchedMed.Unit;
                    item.IsMatched = true;

                    if (response.SupplierID.HasValue)
                    {
                        var contract = dbContractItems.FirstOrDefault(c =>
                            c.SupplierID == response.SupplierID.Value &&
                            c.MedicineID == matchedMed.MedicineID);

                        if (contract != null)
                        {
                            item.ContractPrice = contract.ContractPrice;
                            item.RemainingContractQty = Math.Max(0, (contract.ContractQuantity ?? 999999) - contract.ImportedQuantity);

                            if (item.ImportPrice > 0 && item.ImportPrice != contract.ContractPrice)
                            {
                                item.Warning = $"Giá HĐ ({item.ImportPrice:N0} đ) lệch giá trúng thầu ({contract.ContractPrice:N0} đ).";
                            }
                        }
                    }
                }
                else
                {
                    item.IsMatched = false;
                    item.Warning = "Tên biệt dược chưa tự động khớp với danh mục kho. Vui lòng chọn thuốc tương ứng.";
                }
            }

            response.Success = true;
            response.OverallConfidence = 0.98;
            response.TotalInvoiceAmount = response.Items.Sum(i => i.TotalAmount);
            response.Message = $"Trích xuất thành công {response.Items.Count} mặt hàng từ hóa đơn thông qua Gemini Multimodal Vision AI.";

            return Ok(response);
        }
        catch (Exception ex)
        {
            return Ok(new OcrParseResponse
            {
                Success = false,
                Message = $"Lỗi xử lý tài liệu OCR: {ex.Message}"
            });
        }
    }

    private static string CleanTaxCode(string taxCode)
    {
        if (string.IsNullOrWhiteSpace(taxCode)) return string.Empty;
        return Regex.Replace(taxCode, @"[^\d]", "");
    }

    private static string NormalizeDateString(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return DateTime.Now.ToString("yyyy-MM-dd");

        // YYYY-MM-DD
        if (Regex.IsMatch(raw, @"^\d{4}-\d{2}-\d{2}$")) return raw;

        // DD/MM/YYYY or DD-MM-YYYY
        var dmyMatch = Regex.Match(raw, @"^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$");
        if (dmyMatch.Success)
        {
            var d = int.Parse(dmyMatch.Groups[1].Value);
            var m = int.Parse(dmyMatch.Groups[2].Value);
            var y = int.Parse(dmyMatch.Groups[3].Value);
            return $"{y:D4}-{m:D2}-{d:D2}";
        }

        // MM/YYYY
        var myMatch = Regex.Match(raw, @"^(\d{1,2})[\/\-\.](\d{4})$");
        if (myMatch.Success)
        {
            var m = int.Parse(myMatch.Groups[1].Value);
            var y = int.Parse(myMatch.Groups[2].Value);
            var daysInMonth = DateTime.DaysInMonth(y, m);
            return $"{y:D4}-{m:D2}-{daysInMonth:D2}";
        }

        if (DateTime.TryParse(raw, out var parsed))
        {
            return parsed.ToString("yyyy-MM-dd");
        }

        return DateTime.Now.ToString("yyyy-MM-dd");
    }

    private static string RemoveDiacritics(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var normalizedString = text.Normalize(NormalizationForm.FormD);
        var stringBuilder = new StringBuilder();
        foreach (var c in normalizedString)
        {
            var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
            if (unicodeCategory != UnicodeCategory.NonSpacingMark)
            {
                stringBuilder.Append(c);
            }
        }
        return stringBuilder.ToString().Normalize(NormalizationForm.FormC).Replace("đ", "d").Replace("Đ", "D");
    }
}
