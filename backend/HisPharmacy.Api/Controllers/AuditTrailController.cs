using HisPharmacy.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/audit-trail")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AuditTrailController : ControllerBase
{
    private readonly HisDbContext _context;

    public AuditTrailController(HisDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] string? tableName,
        [FromQuery] string? action,
        [FromQuery] string? username,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int? departmentId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        var userDeptHeader = Request.Headers["X-User-DepartmentID"].ToString();
        int.TryParse(userDeptHeader, out int userDeptId);

        var allowedRoles = new[] { "pharmacist", "director", "admin", "head", "head_nurse" };
        if (!allowedRoles.Contains(userRole))
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Lãnh đạo khoa, Thủ kho Dược hoặc Ban Giám Đốc mới có quyền tra cứu Nhật ký hoạt động." });

        if (page < 1) page = 1;
        if (pageSize < 10) pageSize = 10;
        if (pageSize > 200) pageSize = 200;

        var query = _context.AuditLogs.AsQueryable();

        // 1. Phân quyền và phạm vi dữ liệu theo khoa:
        // - Trưởng khoa lâm sàng (head) và Điều dưỡng trưởng (head_nurse) CHỈ được xem nhật ký của khoa mình
        if (userRole == "head" || userRole == "head_nurse")
        {
            int targetDept = userDeptId;
            if (targetDept <= 0 && departmentId.HasValue) targetDept = departmentId.Value;
            if (targetDept <= 0)
            {
                var userFull = System.Net.WebUtility.UrlDecode(Request.Headers["X-User-FullName"].ToString());
                var u = await _context.Users.FirstOrDefaultAsync(x => x.FullName == userFull);
                if (u != null && u.DepartmentID.HasValue) targetDept = u.DepartmentID.Value;
            }

            if (targetDept > 0)
            {
                query = query.Where(l => l.DepartmentID == targetDept);
            }
            else
            {
                return Ok(new
                {
                    TotalRecords = 0,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = 0,
                    Data = Array.Empty<object>()
                });
            }
        }
        else
        {
            // - Ban Giám Đốc (director) và Thủ kho Dược (pharmacist) có thể lọc theo khoa tùy chọn hoặc xem toàn viện
            if (departmentId.HasValue && departmentId.Value > 0)
            {
                query = query.Where(l => l.DepartmentID == departmentId.Value);
            }
        }

        if (!string.IsNullOrWhiteSpace(tableName) && tableName != "all")
        {
            query = query.Where(l => l.TableName == tableName || l.EntityName == tableName);
        }

        if (!string.IsNullOrWhiteSpace(action) && action != "all")
        {
            query = query.Where(l => l.Action == action);
        }

        if (!string.IsNullOrWhiteSpace(username))
        {
            query = query.Where(l => l.Username != null && l.Username.Contains(username));
        }

        if (fromDate.HasValue)
        {
            query = query.Where(l => l.CreatedAt >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            var endOfDay = toDate.Value.Date.AddDays(1).AddTicks(-1);
            query = query.Where(l => l.CreatedAt <= endOfDay);
        }

        var totalRecords = await query.CountAsync();

        // Lấy danh mục khoa để gắn tên khoa thân thiện vào log
        var deptDict = await _context.Departments
            .ToDictionaryAsync(d => d.DepartmentID, d => d.DepartmentName);

        var rawLogs = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var logs = rawLogs.Select(l => new
        {
            l.LogID,
            l.DepartmentID,
            DepartmentName = l.DepartmentID.HasValue && deptDict.ContainsKey(l.DepartmentID.Value) ? deptDict[l.DepartmentID.Value] : null,
            l.TableName,
            l.Action,
            l.KeyValues,
            l.OldValues,
            l.NewValues,
            l.ChangedColumns,
            l.Username,
            l.UserRole,
            l.IPAddress,
            l.CreatedAt,
            l.EntityName,
            l.EntityID,
            l.BeforeData,
            l.AfterData,
            l.Device
        });

        return Ok(new
        {
            TotalRecords = totalRecords,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalRecords / (double)pageSize),
            Data = logs
        });
    }

    [HttpGet("tables")]
    public async Task<IActionResult> GetDistinctTables()
    {
        var tables = await _context.AuditLogs
            .Select(l => l.TableName ?? l.EntityName)
            .Where(t => t != null && t != "")
            .Distinct()
            .ToListAsync();

        return Ok(tables);
    }

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments()
    {
        var depts = await _context.Departments
            .OrderBy(d => d.DepartmentID)
            .Select(d => new { d.DepartmentID, d.DepartmentName })
            .ToListAsync();

        return Ok(depts);
    }
}
