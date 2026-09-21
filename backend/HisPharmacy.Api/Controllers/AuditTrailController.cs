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
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var userRole = Request.Headers["X-User-Role"].ToString();
        if (userRole != "pharmacist" && userRole != "director" && userRole != "admin")
            return BadRequest(new { Error = "Quyền truy cập bị từ chối. Chỉ Dược sĩ hoặc Ban Giám Đốc mới có quyền tra cứu Nhật ký kiểm toán hệ thống." });

        if (page < 1) page = 1;
        if (pageSize < 10) pageSize = 10;
        if (pageSize > 200) pageSize = 200;

        var query = _context.AuditLogs.AsQueryable();

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

        var logs = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

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
            .Select(l => l.TableName)
            .Where(t => t != null && t != "")
            .Distinct()
            .ToListAsync();

        return Ok(tables);
    }
}
