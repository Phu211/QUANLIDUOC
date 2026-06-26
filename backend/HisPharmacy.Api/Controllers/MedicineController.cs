using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class MedicineController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly IHubContext<PharmacyHub> _hubContext;

    public MedicineController(HisDbContext context, IHubContext<PharmacyHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetMedicines()
    {
        var list = await _context.Medicines
            .OrderBy(m => m.MedicineCode)
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetMedicineById(int id)
    {
        var medicine = await _context.Medicines.FindAsync(id);
        if (medicine == null) return NotFound();
        return Ok(medicine);
    }

    [HttpPost]
    public async Task<IActionResult> CreateMedicine([FromBody] Medicine medicine)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Giám đốc mới có quyền thêm thuốc vào danh mục." });

        if (medicine == null)
            return BadRequest(new { Error = "Dữ liệu không hợp lệ." });

        if (string.IsNullOrWhiteSpace(medicine.MedicineCode))
            return BadRequest(new { Error = "Mã thuốc không được để trống." });

        if (string.IsNullOrWhiteSpace(medicine.MedicineName))
            return BadRequest(new { Error = "Tên thuốc không được để trống." });

        if (string.IsNullOrWhiteSpace(medicine.Unit))
            return BadRequest(new { Error = "Đơn vị tính không được để trống." });

        // Check if Code already exists
        var codeExists = await _context.Medicines.AnyAsync(m => m.MedicineCode.ToLower() == medicine.MedicineCode.ToLower());
        if (codeExists)
            return BadRequest(new { Error = $"Mã thuốc '{medicine.MedicineCode}' đã tồn tại trong hệ thống." });

        _context.Medicines.Add(medicine);
        await _context.SaveChangesAsync();

        // Broadcast real-time updates to all connected users
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");

        return Ok(medicine);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateMedicine(int id, [FromBody] Medicine updated)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Giám đốc mới có quyền chỉnh sửa danh mục thuốc." });

        if (updated == null)
            return BadRequest(new { Error = "Dữ liệu không hợp lệ." });

        var medicine = await _context.Medicines.FindAsync(id);
        if (medicine == null) return NotFound();

        if (string.IsNullOrWhiteSpace(updated.MedicineCode))
            return BadRequest(new { Error = "Mã thuốc không được để trống." });

        if (string.IsNullOrWhiteSpace(updated.MedicineName))
            return BadRequest(new { Error = "Tên thuốc không được để trống." });

        if (string.IsNullOrWhiteSpace(updated.Unit))
            return BadRequest(new { Error = "Đơn vị tính không được để trống." });

        // Check if Code exists on another medicine
        var codeExists = await _context.Medicines.AnyAsync(m => m.MedicineID != id && m.MedicineCode.ToLower() == updated.MedicineCode.ToLower());
        if (codeExists)
            return BadRequest(new { Error = $"Mã thuốc '{updated.MedicineCode}' đã được sử dụng bởi thuốc khác." });

        // Update properties
        medicine.MedicineCode = updated.MedicineCode;
        medicine.MedicineName = updated.MedicineName;
        medicine.GenericName = updated.GenericName;
        medicine.Specification = updated.Specification;
        medicine.Manufacturer = updated.Manufacturer;
        medicine.Unit = updated.Unit;
        medicine.MinInventory = updated.MinInventory;
        medicine.MedicineGroup = updated.MedicineGroup;

        await _context.SaveChangesAsync();

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");

        return Ok(medicine);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteMedicine(int id)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Giám đốc mới có quyền xóa thuốc khỏi danh mục." });

        var medicine = await _context.Medicines.FindAsync(id);
        if (medicine == null) return NotFound();

        // Check foreign key constraint with Batches table
        var hasBatches = await _context.Batches.AnyAsync(b => b.MedicineID == id);
        if (hasBatches)
        {
            return BadRequest(new { Error = "Không thể xóa thuốc này vì đã có lô thuốc nhập kho liên quan trong hệ thống. Vui lòng giữ lại để bảo đảm lịch sử số liệu." });
        }

        _context.Medicines.Remove(medicine);
        await _context.SaveChangesAsync();

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");

        return Ok(new { Message = "Xóa danh mục thuốc thành công." });
    }
}
