using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using HisPharmacy.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class ImportController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly StockService _stockService;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public ImportController(HisDbContext context, StockService stockService, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _stockService = stockService;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetImports()
    {
        var imports = await _context.ImportReceipts
            .Select(i => new
            {
                i.ImportID,
                i.ImportCode,
                i.ContractNumber,
                i.InvoiceNumber,
                i.SupplierID,
                i.ImportDate,
                i.CreatedBy,
                i.Notes,
                i.Status,
                i.InvoiceDate,
                i.DeliveryNoteNumber,
                i.SecondInspector,
                i.AnomalyDescription,
                i.EditHistoryJson,
                // Return a lightweight dummy JSON array if documents exist to avoid loading megabytes of base64
                DocumentsJson = i.DocumentsJson != null && i.DocumentsJson != "" ? "[\"has_files\"]" : "[]",
                Supplier = i.Supplier,
                Details = i.Details.Select(d => new
                {
                    d.ImportDetailID,
                    d.ImportID,
                    d.BatchID,
                    d.Quantity,
                    Batch = d.Batch != null ? new
                    {
                        d.Batch.BatchID,
                        d.Batch.MedicineID,
                        d.Batch.BatchNumber,
                        d.Batch.ProductionDate,
                        d.Batch.ExpiryDate,
                        d.Batch.ImportPrice,
                        d.Batch.QuantityOriginal,
                        Medicine = d.Batch.Medicine
                    } : null
                })
            })
            .OrderByDescending(i => i.ImportDate)
            .ToListAsync();

        return Ok(imports);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetImport(int id)
    {
        var import = await _context.ImportReceipts
            .Where(i => i.ImportID == id)
            .Select(i => new
            {
                i.ImportID,
                i.ImportCode,
                i.ContractNumber,
                i.InvoiceNumber,
                i.SupplierID,
                i.ImportDate,
                i.CreatedBy,
                i.Notes,
                i.Status,
                i.InvoiceDate,
                i.DeliveryNoteNumber,
                i.SecondInspector,
                i.AnomalyDescription,
                i.DocumentsJson,
                i.DigitalSignature,
                i.SecondInspectorSignature,
                i.DeliveryPersonSignature,
                i.DeliveryPersonName,
                i.ApproverSignature,
                i.EditHistoryJson,
                Supplier = i.Supplier,
                Details = i.Details.Select(d => new
                {
                    d.ImportDetailID,
                    d.ImportID,
                    d.BatchID,
                    d.Quantity,
                    Batch = d.Batch != null ? new
                    {
                        d.Batch.BatchID,
                        d.Batch.MedicineID,
                        d.Batch.BatchNumber,
                        d.Batch.ProductionDate,
                        d.Batch.ExpiryDate,
                        d.Batch.ImportPrice,
                        d.Batch.QuantityOriginal,
                        Medicine = d.Batch.Medicine
                    } : null
                })
            })
            .FirstOrDefaultAsync();

        if (import == null)
            return NotFound(new { Error = "Không tìm thấy phiếu nhập kho." });

        return Ok(import);
    }

    [HttpPost("migrate-cloudinary")]
    public async Task<IActionResult> MigrateToCloudinary()
    {
        var imports = await _context.ImportReceipts.ToListAsync();
        var migratedRecords = 0;
        var migratedFiles = 0;
        var failedFiles = 0;

        using var httpClient = new HttpClient();

        foreach (var import in imports)
        {
            if (string.IsNullOrEmpty(import.DocumentsJson)) continue;

            try
            {
                var node = System.Text.Json.Nodes.JsonNode.Parse(import.DocumentsJson);
                if (node is System.Text.Json.Nodes.JsonArray array)
                {
                    bool isUpdated = false;

                    foreach (var item in array)
                    {
                        if (item is System.Text.Json.Nodes.JsonObject obj)
                        {
                            if (obj.TryGetPropertyValue("base64", out var base64Val) && base64Val != null)
                            {
                                var base64Str = base64Val.ToString();
                                // Kiểm tra xem có phải chuỗi Base64 chưa được migrate hay không
                                if (base64Str.StartsWith("data:image") || (base64Str.Length > 1000 && !base64Str.StartsWith("http")))
                                {
                                    try
                                    {
                                        // Upload lên Cloudinary của người dùng
                                        using var content = new MultipartFormDataContent();
                                        content.Add(new StringContent(base64Str), "file");
                                        content.Add(new StringContent("his_preset"), "upload_preset");

                                        var response = await httpClient.PostAsync("https://api.cloudinary.com/v1_1/drxeoxtok/image/upload", content);
                                        if (response.IsSuccessStatusCode)
                                        {
                                            var responseString = await response.Content.ReadAsStringAsync();
                                            var responseJson = System.Text.Json.JsonDocument.Parse(responseString);
                                            if (responseJson.RootElement.TryGetProperty("secure_url", out var secureUrlProp))
                                            {
                                                var cloudinaryUrl = secureUrlProp.GetString();
                                                obj["base64"] = cloudinaryUrl;
                                                obj["url"] = cloudinaryUrl;
                                                isUpdated = true;
                                                migratedFiles++;
                                            }
                                        }
                                        else
                                        {
                                            var responseString = await response.Content.ReadAsStringAsync();
                                            Console.WriteLine($"[Cloudinary Migration] Upload failed for {import.ImportCode}: {responseString}");
                                            failedFiles++;
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        Console.WriteLine($"[Cloudinary Migration] Error uploading file for {import.ImportCode}: {ex.Message}");
                                        failedFiles++;
                                    }
                                }
                            }
                        }
                    }

                    if (isUpdated)
                    {
                        import.DocumentsJson = node.ToJsonString();
                        _context.Entry(import).State = EntityState.Modified;
                        migratedRecords++;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Cloudinary Migration] Error parsing/updating JSON for {import.ImportCode}: {ex.Message}");
            }
        }

        if (migratedRecords > 0)
        {
            await _context.SaveChangesAsync();
        }

        return Ok(new
        {
            Message = "Quá trình di chuyển ảnh sang Cloudinary hoàn tất.",
            TotalRecordsUpdated = migratedRecords,
            TotalFilesMigrated = migratedFiles,
            TotalFilesFailed = failedFiles
        });
    }

    private string? StripBase64FromDocuments(string? json)
    {
        if (string.IsNullOrEmpty(json)) return json;
        try
        {
            var node = System.Text.Json.Nodes.JsonNode.Parse(json);
            if (node is System.Text.Json.Nodes.JsonArray array)
            {
                foreach (var item in array)
                {
                    if (item is System.Text.Json.Nodes.JsonObject obj)
                    {
                        obj.Remove("base64");
                    }
                }
                return node.ToJsonString();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StripBase64] Error parsing JSON: {ex.Message}");
        }
        return json;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateImport([FromBody] CreateImportRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director" && userRole != "pharmacist_admin")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược mới có quyền thực hiện nhập kho." });

        if (request == null || (request.Status != "Chờ kiểm nhập" && !request.Items.Any()))
            return BadRequest(new { Error = "Thông tin nhập kho không hợp lệ. Phiếu kiểm nhập thực tế phải chứa ít nhất một mặt hàng." });

        try
        {
            var import = await _stockService.CreateImportAsync(
                request.SupplierID, 
                request.ContractNumber, 
                request.InvoiceNumber, 
                request.CreatedBy, 
                request.Notes, 
                request.Status, 
                request.InvoiceDate,
                request.DeliveryNoteNumber,
                request.SecondInspector,
                request.AnomalyDescription,
                request.DocumentsJson,
                request.DigitalSignature,
                request.SecondInspectorSignature,
                request.DeliveryPersonSignature,
                request.Items,
                request.DeliveryPersonName,
                userRole);
            
            // Fetch populated import object to return
            var result = await _context.ImportReceipts
                .Include(i => i.Supplier)
                .Include(i => i.Details)!.ThenInclude(d => d.Batch)!.ThenInclude(b => b!.Medicine)
                .FirstOrDefaultAsync(i => i.ImportID == import.ImportID);

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveImport(int id, [FromBody] ApproveImportRequest? request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "director" && userRole != "pharmacist")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ trưởng hoặc Ban giám đốc mới có quyền duyệt nhập kho." });

        try
        {
            // Lấy chi tiết phiếu nhập để kiểm tra loại nhập thường hay nhập đặc biệt
            var import = await _context.ImportReceipts
                .Include(i => i.Details)
                    .ThenInclude(d => d.Batch)
                        .ThenInclude(b => b!.Medicine)
                .FirstOrDefaultAsync(i => i.ImportID == id);

            if (import == null) 
                return NotFound(new { Error = "Không tìm thấy phiếu nhập kho." });

            // Kiểm tra xem có chứa thuốc hướng thần/gây nghiện (High/Critical) hay không
            bool isSpecialMedicine = import.Details.Any(d => 
                d.Batch?.Medicine?.PriorityLevel == "High" || 
                d.Batch?.Medicine?.PriorityLevel == "Critical"
            );

            // Kiểm tra xem giá trị hóa đơn có lớn hay không (> 100,000,000đ)
            double totalValue = import.Details.Sum(d => 
                (double)(d.Quantity * (d.Batch?.ImportPrice ?? 0))
            );
            bool isHighValue = totalValue > 100000000;

            bool isSpecialImport = isSpecialMedicine || isHighValue;

            if (isSpecialImport && userRole != "director")
            {
                string reason = isSpecialMedicine 
                    ? "Phiếu nhập có chứa thuốc đặc biệt (hướng thần/gây nghiện)." 
                    : $"Phiếu nhập có giá trị lớn ({totalValue:N0}đ > 100.000.000đ).";
                return BadRequest(new { Error = $"Quyền truy cập bị từ chối. {reason} Chỉ Ban Giám Đốc mới được quyền phê duyệt phiếu nhập đặc biệt này." });
            }

            var userFullName = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
            if (string.IsNullOrEmpty(userFullName)) userFullName = userRole == "director" ? "Ban Giám Đốc" : "Dược sĩ trưởng";

            await _stockService.ApproveImportReceiptAsync(id, request?.ApproverSignature, userFullName);

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = isSpecialImport 
                ? "Ban Giám Đốc phê duyệt phiếu nhập kho đặc biệt thành công, đã cộng tồn kho." 
                : "Phê duyệt phiếu nhập kho thành công, đã cộng tồn kho." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpGet("suppliers")]
    public async Task<IActionResult> GetSuppliers()
    {
        var suppliers = await _context.Suppliers.ToListAsync();
        return Ok(suppliers);
    }

    [HttpPost("suppliers/create")]
    public async Task<IActionResult> CreateSupplier([FromBody] Supplier supplier)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược mới có quyền thêm nhà cung cấp." });

        if (supplier == null || string.IsNullOrWhiteSpace(supplier.SupplierName))
            return BadRequest(new { Error = "Tên nhà cung cấp không được để trống." });

        _context.Suppliers.Add(supplier);
        await _context.SaveChangesAsync();

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");

        return Ok(supplier);
    }

    [HttpGet("medicines")]
    public async Task<IActionResult> GetMedicines([FromQuery] int? supplierId)
    {
        if (supplierId.HasValue)
        {
            var today = DateTime.Today.Date;
            var medicines = await _context.SupplierMedicines
                .Where(sm => sm.SupplierID == supplierId.Value 
                          && sm.IsActive 
                          && sm.StartDate <= today 
                          && sm.EndDate >= today)
                .Join(_context.Medicines,
                    sm => sm.MedicineID,
                    m => m.MedicineID,
                    (sm, m) => new {
                        m.MedicineID,
                        m.MedicineCode,
                        m.MedicineName,
                        m.GenericName,
                        m.Specification,
                        m.Manufacturer,
                        m.Unit,
                        m.MinInventory,
                        m.MedicineGroup,
                        ContractPrice = sm.ContractPrice,
                        ContractNumber = sm.ContractNumber,
                        ContractQuantity = sm.ContractQuantity,
                        ImportedQuantity = sm.ImportedQuantity,
                        StartDate = sm.StartDate,
                        EndDate = sm.EndDate,
                        IsActive = sm.IsActive,
                        Status = sm.Status
                    })
                .ToListAsync();

            var medicineIds = medicines.Select(m => m.MedicineID).ToList();
            var stocks = await _context.InventoryStocks
                .Where(s => medicineIds.Contains(s.Batch!.MedicineID))
                .GroupBy(s => s.Batch!.MedicineID)
                .Select(g => new {
                    MedicineID = g.Key,
                    CurrentStock = g.Sum(s => s.CurrentQuantity)
                })
                .ToListAsync();

            var stockDict = stocks.ToDictionary(s => s.MedicineID, s => s.CurrentStock);

            var result = medicines.Select(m => new {
                m.MedicineID,
                m.MedicineCode,
                m.MedicineName,
                m.GenericName,
                m.Specification,
                m.Manufacturer,
                m.Unit,
                m.MinInventory,
                m.MedicineGroup,
                m.ContractPrice,
                m.ContractNumber,
                m.ContractQuantity,
                m.ImportedQuantity,
                m.StartDate,
                m.EndDate,
                m.IsActive,
                m.Status,
                CurrentStock = stockDict.TryGetValue(m.MedicineID, out var stockQty) ? stockQty : 0
            }).ToList();

            return Ok(result);
        }
        else
        {
            var medicines = await _context.Medicines.ToListAsync();
            var stocks = await _context.InventoryStocks
                .GroupBy(s => s.Batch!.MedicineID)
                .Select(g => new {
                    MedicineID = g.Key,
                    CurrentStock = g.Sum(s => s.CurrentQuantity)
                })
                .ToListAsync();

            var stockDict = stocks.ToDictionary(s => s.MedicineID, s => s.CurrentStock);

            var result = medicines.Select(m => new {
                m.MedicineID,
                m.MedicineCode,
                m.MedicineName,
                m.GenericName,
                m.Specification,
                m.Manufacturer,
                m.Unit,
                m.MinInventory,
                m.MedicineGroup,
                CurrentStock = stockDict.TryGetValue(m.MedicineID, out var stockQty) ? stockQty : 0
            }).ToList();

            return Ok(result);
        }
    }

    [HttpPost("{id}/complete-inspection")]
    public async Task<IActionResult> CompleteInspection(int id, [FromBody] CompleteInspectionRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director" && userRole != "pharmacist_admin")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược mới có quyền thực hiện kiểm nhận." });

        if (request == null || !request.Items.Any())
            return BadRequest(new { Error = "Thông tin kiểm nhận không hợp lệ." });

        try
        {
            var import = await _stockService.CompleteInspectionAsync(
                id,
                request.SecondInspector,
                request.AnomalyDescription,
                request.Status,
                request.DocumentsJson,
                request.DigitalSignature,
                request.SecondInspectorSignature,
                request.DeliveryPersonSignature,
                request.Items,
                request.DeliveryPersonName,
                userRole);

            var result = await _context.ImportReceipts
                .Include(i => i.Supplier)
                .Include(i => i.Details)!.ThenInclude(d => d.Batch)!.ThenInclude(b => b!.Medicine)
                .FirstOrDefaultAsync(i => i.ImportID == import.ImportID);

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }

    [HttpPut("{id}/update")]
    public async Task<IActionResult> UpdateImport(int id, [FromBody] CreateImportRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director" && userRole != "pharmacist_admin")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ mới có quyền điều chỉnh phiếu." });

        if (request == null)
            return BadRequest(new { Error = "Thông tin điều chỉnh không hợp lệ." });

        try
        {
            var dto = new UpdateImportRequestDto
            {
                SupplierID = request.SupplierID,
                ContractNumber = request.ContractNumber,
                InvoiceNumber = request.InvoiceNumber,
                CreatedBy = request.CreatedBy,
                Notes = request.Notes,
                Status = request.Status,
                InvoiceDate = request.InvoiceDate,
                DeliveryNoteNumber = request.DeliveryNoteNumber,
                SecondInspector = request.SecondInspector,
                AnomalyDescription = request.AnomalyDescription,
                DocumentsJson = request.DocumentsJson,
                DigitalSignature = request.DigitalSignature,
                SecondInspectorSignature = request.SecondInspectorSignature,
                DeliveryPersonSignature = request.DeliveryPersonSignature,
                DeliveryPersonName = request.DeliveryPersonName,
                Items = request.Items,
                UserRole = userRole
            };

            var result = await _stockService.UpdateImportReceiptAsync(id, dto);

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { Error = ex.Message });
        }
    }
}

public class CreateImportRequest
{
    public int SupplierID { get; set; }
    public string? ContractNumber { get; set; }
    public string? InvoiceNumber { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string Status { get; set; } = "Đã kiểm";
    public DateTime? InvoiceDate { get; set; }
    public string? DeliveryNoteNumber { get; set; }
    public string? SecondInspector { get; set; }
    public string? AnomalyDescription { get; set; }
    public string? DocumentsJson { get; set; }
    public string? DigitalSignature { get; set; }
    public string? SecondInspectorSignature { get; set; }
    public string? DeliveryPersonSignature { get; set; }
    public string? DeliveryPersonName { get; set; }
    public List<ImportItemDto> Items { get; set; } = new();
}

public class CompleteInspectionRequest
{
    public string? SecondInspector { get; set; }
    public string? AnomalyDescription { get; set; }
    public string? Status { get; set; }
    public string? DocumentsJson { get; set; }
    public string? DigitalSignature { get; set; }
    public string? SecondInspectorSignature { get; set; }
    public string? DeliveryPersonSignature { get; set; }
    public string? DeliveryPersonName { get; set; }
    public List<ImportItemDto> Items { get; set; } = new();
}

public class ApproveImportRequest
{
    public string? ApproverSignature { get; set; }
}
