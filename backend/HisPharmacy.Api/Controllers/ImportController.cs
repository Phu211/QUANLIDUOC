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
            .Include(i => i.Supplier)
            .Include(i => i.Details)!.ThenInclude(d => d.Batch)!.ThenInclude(b => b!.Medicine)
            .FirstOrDefaultAsync(i => i.ImportID == id);

        if (import == null)
            return NotFound(new { Error = "Không tìm thấy phiếu nhập kho." });

        return Ok(import);
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
        if (userRole != "pharmacist")
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
                request.Items);
            
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
        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Ban lãnh đạo mới có quyền duyệt nhập kho." });

        try
        {
            await _stockService.ApproveImportReceiptAsync(id, request?.ApproverSignature);

            // Broadcast real-time updates
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
            await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

            return Ok(new { Message = "Phê duyệt phiếu nhập kho thành công, đã cộng tồn kho." });
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
    public async Task<IActionResult> GetMedicines()
    {
        var medicines = await _context.Medicines.ToListAsync();
        return Ok(medicines);
    }

    [HttpPost("{id}/complete-inspection")]
    public async Task<IActionResult> CompleteInspection(int id, [FromBody] CompleteInspectionRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist")
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
                request.Items);

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
    public List<ImportItemDto> Items { get; set; } = new();
}

public class ApproveImportRequest
{
    public string? ApproverSignature { get; set; }
}
