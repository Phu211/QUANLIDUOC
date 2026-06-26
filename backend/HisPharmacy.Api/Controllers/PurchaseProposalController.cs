using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class PurchaseProposalController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public PurchaseProposalController(HisDbContext context, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    [HttpGet("low-stock")]
    public async Task<IActionResult> GetLowStockAlerts()
    {
        var medicines = await _context.Medicines.ToListAsync();
        var result = new List<object>();

        foreach (var med in medicines)
        {
            var mainQty = await _context.InventoryStocks
                .Where(s => s.Batch!.MedicineID == med.MedicineID)
                .SumAsync(s => s.CurrentQuantity);

            var deptQty = await _context.DepartmentStocks
                .Where(s => s.Batch!.MedicineID == med.MedicineID)
                .SumAsync(s => s.CurrentQuantity);

            int totalQty = mainQty + deptQty;

            if (totalQty < med.MinInventory)
            {
                // Formula: SuggestedQuantity = MinInventory * 3 - TotalQty
                int suggested = (med.MinInventory * 3) - totalQty;
                if (suggested < 0) suggested = 0;

                result.Add(new
                {
                    med.MedicineID,
                    med.MedicineCode,
                    med.MedicineName,
                    med.GenericName,
                    med.Specification,
                    med.Manufacturer,
                    med.Unit,
                    med.MinInventory,
                    TotalQty = totalQty,
                    MainQty = mainQty,
                    CabinetQty = deptQty,
                    SuggestedQuantity = suggested
                });
            }
        }

        return Ok(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAllProposals()
    {
        var list = await _context.PurchaseProposals
            .Include(p => p.Supplier)
            .Include(p => p.Details)
            .OrderByDescending(p => p.ProposalDate)
            .Select(p => new
            {
                p.ProposalID,
                p.SupplierID,
                SupplierName = p.Supplier != null ? p.Supplier.SupplierName : "Nhiều nhà cung cấp / Chưa chọn",
                p.ProposalDate,
                p.Status,
                p.Reason,
                p.CreatedBy,
                p.ApprovedBy,
                p.DigitalSignature,
                ItemsCount = p.Details.Count
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetProposalDetail(int id)
    {
        var proposal = await _context.PurchaseProposals
            .Include(p => p.Supplier)
            .Include(p => p.Details)!.ThenInclude(d => d.Medicine)
            .FirstOrDefaultAsync(p => p.ProposalID == id);

        if (proposal == null) return NotFound();

        return Ok(proposal);
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateProposal([FromBody] CreateProposalRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Thủ kho Dược mới được tạo phiếu đề xuất mua thuốc." });

        if (request == null || request.Items == null || !request.Items.Any())
            return BadRequest(new { Error = "Thông tin đề xuất không hợp lệ." });

        var proposal = new PurchaseProposal
        {
            SupplierID = request.SupplierID > 0 ? request.SupplierID : null,
            Reason = request.Reason,
            CreatedBy = request.CreatedBy,
            Status = "Draft",
            ProposalDate = DateTime.Now,
            ProposerSignature = request.ProposerSignature
        };

        foreach (var item in request.Items)
        {
            proposal.Details.Add(new PurchaseProposalDetail
            {
                MedicineID = item.MedicineID,
                CurrentQuantity = item.CurrentQuantity,
                MinInventory = item.MinInventory,
                SuggestedQuantity = item.SuggestedQuantity
            });
        }

        _context.PurchaseProposals.Add(proposal);
        await _context.SaveChangesAsync();

        var result = await _context.PurchaseProposals
            .Include(p => p.Supplier)
            .FirstOrDefaultAsync(p => p.ProposalID == proposal.ProposalID);

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Proposals");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

        return Ok(result);
    }

    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveProposal(int id, [FromBody] ApproveProposalRequest request)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Giám đốc / Trưởng khoa mới có quyền duyệt phiếu đề xuất." });

        var proposal = await _context.PurchaseProposals.FindAsync(id);
        if (proposal == null) return NotFound();

        if (proposal.Status != "Draft")
            return BadRequest(new { Error = "Phiếu đề xuất này đã được xử lý từ trước." });

        if (string.IsNullOrWhiteSpace(request.DigitalSignature))
            return BadRequest(new { Error = "Bắt buộc phải ký nhận online để hoàn tất duyệt phiếu." });

        proposal.Status = "Approved";
        proposal.ApprovedBy = string.IsNullOrWhiteSpace(request.ApprovedBy) ? "PGS.TS. Lê Minh Dược" : request.ApprovedBy;
        proposal.DigitalSignature = request.DigitalSignature;

        await _context.SaveChangesAsync();

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Proposals");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

        return Ok(new { Message = "Phê duyệt và ký nhận phiếu đề xuất mua thuốc thành công!", Status = "Approved" });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProposal(int id)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối." });

        var proposal = await _context.PurchaseProposals.FindAsync(id);
        if (proposal == null) return NotFound();

        if (proposal.Status != "Draft" && userRole != "director")
            return BadRequest(new { Error = "Chỉ được phép xóa phiếu đề xuất ở trạng thái nháp (Draft)." });

        _context.PurchaseProposals.Remove(proposal);
        await _context.SaveChangesAsync();

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Proposals");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Dashboard");

        return Ok(new { Message = "Đã xóa phiếu đề xuất thành công." });
    }
}

public class CreateProposalRequest
{
    public int? SupplierID { get; set; }
    public string? Reason { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string? ProposerSignature { get; set; }
    public List<CreateProposalItem> Items { get; set; } = new();
}

public class CreateProposalItem
{
    public int MedicineID { get; set; }
    public int CurrentQuantity { get; set; }
    public int MinInventory { get; set; }
    public int SuggestedQuantity { get; set; }
}

public class ApproveProposalRequest
{
    public string ApprovedBy { get; set; } = string.Empty;
    public string DigitalSignature { get; set; } = string.Empty; // Base64 string of signature canvas drawing
}
