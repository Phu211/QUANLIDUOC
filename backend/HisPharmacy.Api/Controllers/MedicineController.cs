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

        // Check if Code already exists in active medicines
        var codeExists = await _context.Medicines.AnyAsync(m => m.MedicineCode.ToLower() == medicine.MedicineCode.ToLower());
        if (codeExists)
            return BadRequest(new { Error = $"Mã thuốc '{medicine.MedicineCode}' đã tồn tại trong danh mục hoạt động." });

        if (string.IsNullOrWhiteSpace(medicine.DrugClassification))
        {
            medicine.DrugClassification = "Regular";
        }

        medicine.IsDeleted = false;
        medicine.DeletedAt = null;

        _context.Medicines.Add(medicine);
        await _context.SaveChangesAsync();

        // Broadcast real-time updates to all connected users
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");

        return Ok(medicine);
    }

    [HttpPost("bulk")]
    public async Task<IActionResult> BulkCreateMedicines([FromBody] List<Medicine> medicines)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Giám đốc mới có quyền thêm thuốc vào danh mục." });

        if (medicines == null || !medicines.Any())
            return BadRequest(new { Error = "Dữ liệu danh sách thuốc không hợp lệ." });

        var codesToAdd = medicines.Select(m => m.MedicineCode.Trim().ToLower()).ToList();
        var namesToAdd = medicines.Select(m => m.MedicineName.Trim().ToLower()).ToList();
        
        // Find existing codes
        var existingCodes = await _context.Medicines
            .Where(m => codesToAdd.Contains(m.MedicineCode.ToLower()))
            .Select(m => m.MedicineCode.ToLower())
            .ToListAsync();

        // Find existing names to prevent duplicate name registrations
        var existingNames = await _context.Medicines
            .Where(m => namesToAdd.Contains(m.MedicineName.ToLower()))
            .Select(m => m.MedicineName.ToLower())
            .ToListAsync();

        var newMedicines = new List<Medicine>();
        var skippedCount = 0;

        foreach (var med in medicines)
        {
            if (string.IsNullOrWhiteSpace(med.MedicineCode) || string.IsNullOrWhiteSpace(med.MedicineName) || string.IsNullOrWhiteSpace(med.Unit))
            {
                return BadRequest(new { Error = $"Dữ liệu dòng thuốc/vật tư '{med.MedicineName}' thiếu thông tin bắt buộc (Mã, Tên hoặc Đơn vị tính)." });
            }

            var cleanCode = med.MedicineCode.Trim().ToLower();
            var cleanName = med.MedicineName.Trim().ToLower();

            // Skip if code or name already exists in database
            if (existingCodes.Contains(cleanCode) || existingNames.Contains(cleanName))
            {
                skippedCount++;
                continue;
            }

            // Skip if duplicate exists in the new list to be added
            if (newMedicines.Any(n => n.MedicineCode.ToLower() == cleanCode || n.MedicineName.ToLower() == cleanName))
            {
                skippedCount++;
                continue;
            }

            newMedicines.Add(new Medicine
            {
                MedicineCode = med.MedicineCode.Trim(),
                MedicineName = med.MedicineName.Trim(),
                GenericName = med.GenericName?.Trim(),
                Specification = med.Specification?.Trim(),
                Manufacturer = med.Manufacturer?.Trim(),
                Unit = med.Unit.Trim(),
                MinInventory = med.MinInventory <= 0 ? 10 : med.MinInventory,
                MedicineGroup = string.IsNullOrWhiteSpace(med.MedicineGroup) ? "Dược phẩm khác" : med.MedicineGroup.Trim(),
                DrugClassification = string.IsNullOrWhiteSpace(med.DrugClassification) ? "Regular" : med.DrugClassification.Trim(),
                IsDeleted = false,
                DeletedAt = null
            });
        }

        if (newMedicines.Any())
        {
            _context.Medicines.AddRange(newMedicines);
            await _context.SaveChangesAsync();
        }

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");

        var message = $"Nhập danh mục thành công. Đã thêm {newMedicines.Count} mục mới";
        if (skippedCount > 0)
        {
            message += $", bỏ qua {skippedCount} mục trùng lặp đã tồn tại trên hệ thống.";
        }
        else
        {
            message += ".";
        }

        return Ok(new { Message = message, ImportedCount = newMedicines.Count, SkippedCount = skippedCount });
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

        // Check if Code exists on another active medicine
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
        if (!string.IsNullOrWhiteSpace(updated.DrugClassification))
        {
            medicine.DrugClassification = updated.DrugClassification;
        }

        await _context.SaveChangesAsync();

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");

        return Ok(medicine);
    }

    // Soft Delete: Hide medicine from active lists while preserving historical transactions
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteMedicine(int id)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Ban Giám Đốc mới có thẩm quyền xóa thuốc khỏi danh mục bệnh viện." });

        var medicine = await _context.Medicines.FindAsync(id);
        if (medicine == null) return NotFound(new { Error = "Không tìm thấy thuốc cần xóa." });

        // Execute Soft Delete
        medicine.IsDeleted = true;
        medicine.DeletedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");

        return Ok(new { Message = $"Đã xóa mềm thuốc '{medicine.MedicineName}' ({medicine.MedicineCode}). Dữ liệu giao dịch lịch sử vẫn được bảo toàn toàn vẹn." });
    }

    // Get list of soft-deleted medicines in Trash
    [HttpGet("trash")]
    public async Task<IActionResult> GetTrash()
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Ban Giám Đốc mới có quyền xem thùng rác danh mục thuốc." });

        var trash = await _context.Medicines
            .IgnoreQueryFilters()
            .Where(m => m.IsDeleted)
            .OrderByDescending(m => m.DeletedAt)
            .ToListAsync();

        return Ok(trash);
    }

    // Restore a soft-deleted medicine back to active catalog
    [HttpPost("{id}/restore")]
    public async Task<IActionResult> RestoreMedicine(int id)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "director")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Ban Giám Đốc mới có quyền khôi phục thuốc vào danh mục." });

        var medicine = await _context.Medicines
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(m => m.MedicineID == id && m.IsDeleted);

        if (medicine == null)
            return NotFound(new { Error = "Không tìm thấy thuốc trong thùng rác hoặc thuốc đã ở trạng thái hoạt động." });

        // Check if code conflicts with another active medicine
        var codeConflict = await _context.Medicines.AnyAsync(m => m.MedicineCode.ToLower() == medicine.MedicineCode.ToLower());
        if (codeConflict)
            return BadRequest(new { Error = $"Không thể khôi phục vì mã '{medicine.MedicineCode}' hiện đang được sử dụng bởi một thuốc khác đang hoạt động." });

        medicine.IsDeleted = false;
        medicine.DeletedAt = null;

        await _context.SaveChangesAsync();

        // Broadcast real-time updates
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Inventory");
        await _hubContext.Clients.All.SendAsync("NotifyUpdate", "Imports");

        return Ok(new { Message = $"Đã khôi phục thành công thuốc '{medicine.MedicineName}' ({medicine.MedicineCode}) vào danh mục hoạt động.", Medicine = medicine });
    }
}
