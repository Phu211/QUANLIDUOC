using HisPharmacy.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly HisDbContext _context;

    public AuthController(HisDbContext context)
    {
        _context = context;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (request == null)
            return BadRequest(new { Error = "Thông tin đăng nhập không hợp lệ." });

        if (string.IsNullOrWhiteSpace(request.Username))
            return BadRequest(new { Error = "Tên đăng nhập không được để trống." });

        if (string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { Error = "Mật khẩu không được để trống." });

        // Query user from database and include Department navigation if it exists
        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.Trim().ToLower() && u.Password == request.Password);

        if (user == null)
            return BadRequest(new { Error = "Tên đăng nhập hoặc mật khẩu không chính xác." });

        // Return user details without password
        return Ok(new
        {
            user.UserID,
            user.Username,
            user.FullName,
            user.Role,
            user.DepartmentID,
            DepartmentName = user.Department?.DepartmentName
        });
    }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
