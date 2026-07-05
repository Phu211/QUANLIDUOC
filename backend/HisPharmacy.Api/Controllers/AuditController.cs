using HisPharmacy.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace HisPharmacy.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuditController : ControllerBase
    {
        private readonly HisDbContext _context;

        public AuditController(HisDbContext context)
        {
            _context = context;
        }

        // 1. Lấy danh sách phiếu kiểm kê
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var userRole = Request.Headers["X-User-Role"].ToString();
            var deptIdStr = Request.Headers["X-User-DepartmentID"].ToString();

            IQueryable<InventoryAudit> query = _context.InventoryAudits
                .Include(a => a.Department)
                .Include(a => a.Details)
                    .ThenInclude(d => d.Batch)
                        .ThenInclude(b => b!.Medicine);

            // Phân quyền truy cập: khoa nào chỉ xem được của khoa đó
            if (userRole != "pharmacist" && userRole != "director")
            {
                if (int.TryParse(deptIdStr, out int deptId))
                {
                    query = query.Where(a => a.LocationType == "Cabinet" && a.DepartmentID == deptId);
                }
                else
                {
                    return Ok(new List<InventoryAudit>());
                }
            }

            var audits = await query
                .OrderByDescending(a => a.AuditDate)
                .ToListAsync();

            return Ok(audits);
        }

        // 2. Lấy chi tiết 1 phiếu kiểm kê
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var userRole = Request.Headers["X-User-Role"].ToString();
            var deptIdStr = Request.Headers["X-User-DepartmentID"].ToString();

            var audit = await _context.InventoryAudits
                .Include(a => a.Department)
                .Include(a => a.Details)
                    .ThenInclude(d => d.Batch)
                        .ThenInclude(b => b!.Medicine)
                .FirstOrDefaultAsync(a => a.AuditID == id);

            if (audit == null)
            {
                return NotFound(new { message = "Không tìm thấy phiếu kiểm kê" });
            }

            // Phân quyền truy cập chi tiết phiếu
            if (userRole != "pharmacist" && userRole != "director")
            {
                if (!int.TryParse(deptIdStr, out int deptId) || audit.LocationType != "Cabinet" || audit.DepartmentID != deptId)
                {
                    return StatusCode(403, new { message = "Quyền truy cập bị từ chối. Bạn chỉ được xem phiếu kiểm kê thuộc khoa của mình." });
                }
            }

            return Ok(audit);
        }

        // 3. Lấy nhật ký điều chỉnh tồn kho
        [HttpGet("logs")]
        public async Task<IActionResult> GetAdjustmentLogs()
        {
            var userRole = Request.Headers["X-User-Role"].ToString();
            var deptIdStr = Request.Headers["X-User-DepartmentID"].ToString();

            IQueryable<StockAdjustmentLog> query = _context.StockAdjustmentLogs
                .Include(l => l.Batch)
                    .ThenInclude(b => b!.Medicine);

            // Phân quyền truy cập nhật ký điều chỉnh
            if (userRole != "pharmacist" && userRole != "director")
            {
                if (int.TryParse(deptIdStr, out int deptId))
                {
                    query = query.Where(l => l.LocationType == "Cabinet" && l.DepartmentID == deptId);
                }
                else
                {
                    return Ok(new List<StockAdjustmentLog>());
                }
            }

            var logs = await query
                .OrderByDescending(l => l.AdjustmentDate)
                .ToListAsync();

            return Ok(logs);
        }

        // 4. Kiểm tra khóa kiểm kê
        [HttpGet("check-lock")]
        public async Task<IActionResult> CheckLock([FromQuery] string locationType, [FromQuery] int? departmentId)
        {
            var userRole = Request.Headers["X-User-Role"].ToString();
            var deptIdStr = Request.Headers["X-User-DepartmentID"].ToString();

            if (userRole != "pharmacist" && userRole != "director")
            {
                if (locationType != "Cabinet" || !int.TryParse(deptIdStr, out int deptId) || departmentId != deptId)
                {
                    return StatusCode(403, new { message = "Quyền truy cập bị từ chối. Bạn chỉ có quyền kiểm tra trạng thái khóa tủ trực thuộc khoa của mình." });
                }
            }

            var activeAudit = await _context.InventoryAudits
                .Where(a => a.LocationType == locationType &&
                            (locationType == "MainStore" || a.DepartmentID == departmentId) &&
                            (a.Status == "Nháp" || a.Status == "Chờ xác nhận" || a.Status == "Có chênh lệch"))
                .FirstOrDefaultAsync();

            if (activeAudit != null)
            {
                return Ok(new
                {
                    isLocked = true,
                    auditCode = activeAudit.AuditCode,
                    createdBy = activeAudit.CreatedBy,
                    status = activeAudit.Status
                });
            }

            return Ok(new { isLocked = false });
        }

        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] CreateAuditRequest request)
        {
            var userRole = Request.Headers["X-User-Role"].ToString();
            var deptIdStr = Request.Headers["X-User-DepartmentID"].ToString();

            if (userRole != "pharmacist" && userRole != "director")
            {
                if (!int.TryParse(deptIdStr, out int deptId) || request.LocationType != "Cabinet" || request.DepartmentId != deptId)
                {
                    return StatusCode(403, new { message = "Quyền truy cập bị từ chối. Bạn không có quyền khởi tạo phiếu kiểm kê cho khoa phòng khác." });
                }
            }

            // Kiểm tra xem kho có đang bị khóa bởi phiếu khác không
            var isLocked = await _context.InventoryAudits
                .AnyAsync(a => a.LocationType == request.LocationType &&
                               (request.LocationType == "MainStore" || a.DepartmentID == request.DepartmentId) &&
                               (a.Status == "Nháp" || a.Status == "Chờ xác nhận" || a.Status == "Có chênh lệch"));

            if (isLocked)
            {
                return BadRequest(new { message = "Kho/tủ trực này đang có phiếu kiểm kê chưa hoàn tất, hệ thống đã khóa các giao dịch xuất nhập." });
            }

            // Tạo mã phiếu kiểm kê KK-YYYYMMDD-XXXX
            var dateStr = DateTime.Now.ToString("yyyyMMdd");
            var countToday = await _context.InventoryAudits
                .CountAsync(a => a.AuditCode.StartsWith($"KK-{dateStr}"));
            var code = $"KK-{dateStr}-{(countToday + 1).ToString("D4")}";

            var audit = new InventoryAudit
            {
                AuditCode = code,
                LocationType = request.LocationType,
                DepartmentID = request.DepartmentId,
                AuditDate = DateTime.Now,
                CreatedBy = request.CreatedBy,
                AuditType = request.AuditType,
                Status = "Nháp",
                Notes = request.Notes,
                DiscrepancyThresholdExceeded = false
            };

            // Dòng thời gian khởi tạo
            var timeline = new List<TimelineEvent>
            {
                new TimelineEvent
                {
                    Time = DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
                    Activity = $"Khởi tạo phiếu kiểm kê {code} ({request.AuditType})",
                    User = request.CreatedBy
                }
            };
            audit.TimelineJson = JsonSerializer.Serialize(timeline);

            // Snapshot số tồn hiện tại từ InventoryStocks hoặc DepartmentStocks
            if (request.LocationType == "MainStore")
            {
                var stocks = await _context.InventoryStocks
                    .Include(s => s.Batch)
                        .ThenInclude(b => b!.Medicine)
                    .Where(s => s.CurrentQuantity > 0)
                    .ToListAsync();

                foreach (var stock in stocks)
                {
                    audit.Details.Add(new InventoryAuditDetail
                    {
                        BatchID = stock.BatchID,
                        SystemQuantity = stock.CurrentQuantity,
                        ActualQuantity = stock.CurrentQuantity, // Mặc định khớp
                        Discrepancy = 0,
                        Reason = null
                    });
                }
            }
            else // Cabinet
            {
                if (request.DepartmentId == null)
                {
                    return BadRequest(new { message = "Cần truyền DepartmentID khi kiểm kê tủ trực khoa lâm sàng." });
                }

                var stocks = await _context.DepartmentStocks
                    .Include(s => s.Batch)
                        .ThenInclude(b => b!.Medicine)
                    .Where(s => s.DepartmentID == request.DepartmentId && s.CurrentQuantity > 0)
                    .ToListAsync();

                foreach (var stock in stocks)
                {
                    audit.Details.Add(new InventoryAuditDetail
                    {
                        BatchID = stock.BatchID,
                        SystemQuantity = stock.CurrentQuantity,
                        ActualQuantity = stock.CurrentQuantity,
                        Discrepancy = 0,
                        Reason = null
                    });
                }
            }

            _context.InventoryAudits.Add(audit);
            await _context.SaveChangesAsync();

            return Ok(audit);
        }

        // 6. Cập nhật số lượng kiểm đếm thực tế (Khi đang ở trạng thái Nháp)
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateAuditRequest request)
        {
            var userRole = Request.Headers["X-User-Role"].ToString();
            var deptIdStr = Request.Headers["X-User-DepartmentID"].ToString();

            var audit = await _context.InventoryAudits
                .Include(a => a.Details)
                .FirstOrDefaultAsync(a => a.AuditID == id);

            if (audit == null)
            {
                return NotFound(new { message = "Không tìm thấy phiếu kiểm kê" });
            }

            if (userRole != "pharmacist" && userRole != "director")
            {
                if (!int.TryParse(deptIdStr, out int deptId) || audit.LocationType != "Cabinet" || audit.DepartmentID != deptId)
                {
                    return StatusCode(403, new { message = "Quyền truy cập bị từ chối. Bạn chỉ có quyền cập nhật dữ liệu kiểm kê thuộc khoa của mình." });
                }
            }

            if (audit.Status != "Nháp")
            {
                return BadRequest(new { message = "Chỉ cho phép cập nhật số lượng khi phiếu ở trạng thái Nháp." });
            }

            audit.Notes = request.Notes;
            audit.AuditType = request.AuditType;

            // Cập nhật chi tiết
            foreach (var detailReq in request.Details)
            {
                var detail = audit.Details.FirstOrDefault(d => d.AuditDetailID == detailReq.AuditDetailID);
                if (detail != null)
                {
                    detail.ActualQuantity = detailReq.ActualQuantity;
                    detail.Discrepancy = detailReq.ActualQuantity - detail.SystemQuantity;
                    detail.Reason = detail.Discrepancy != 0 ? detailReq.Reason : null;
                }
            }

            // Cập nhật dòng thời gian
            var timeline = JsonSerializer.Deserialize<List<TimelineEvent>>(audit.TimelineJson ?? "[]") ?? new List<TimelineEvent>();
            timeline.Add(new TimelineEvent
            {
                Time = DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
                Activity = "Cập nhật dữ liệu kiểm đếm thực tế và lý do chênh lệch",
                User = audit.CreatedBy
            });
            audit.TimelineJson = JsonSerializer.Serialize(timeline);

            await _context.SaveChangesAsync();
            return Ok(audit);
        }

        // 7. Xác nhận đối chiếu (Checker ký duyệt)
        [HttpPost("{id}/confirm")]
        public async Task<IActionResult> Confirm(int id, [FromBody] SignatureRequest request)
        {
            var userRole = Request.Headers["X-User-Role"].ToString();
            var deptIdStr = Request.Headers["X-User-DepartmentID"].ToString();

            var audit = await _context.InventoryAudits
                .Include(a => a.Details)
                    .ThenInclude(d => d.Batch)
                        .ThenInclude(b => b!.Medicine)
                .FirstOrDefaultAsync(a => a.AuditID == id);

            if (audit == null)
            {
                return NotFound(new { message = "Không tìm thấy phiếu kiểm kê" });
            }

            if (userRole != "pharmacist" && userRole != "director")
            {
                if (!int.TryParse(deptIdStr, out int deptId) || audit.LocationType != "Cabinet" || audit.DepartmentID != deptId)
                {
                    return StatusCode(403, new { message = "Quyền truy cập bị từ chối. Bạn chỉ có quyền ký xác nhận đối chiếu thuộc khoa của mình." });
                }
            }

            if (audit.Status != "Nháp")
            {
                return BadRequest(new { message = "Phiếu kiểm kê đã được xác nhận hoặc hủy." });
            }

            // Ghi nhận chữ ký
            audit.CheckerSignature = request.Signature;
            audit.CheckerSignedBy = request.SignedBy;
            audit.CheckerSignedAt = DateTime.Now;

            // Kiểm tra chênh lệch lớn (>20%, hoặc thuốc High/Critical bị lệch)
            bool thresholdExceeded = false;
            foreach (var detail in audit.Details)
            {
                if (detail.Discrepancy != 0)
                {
                    var priority = detail.Batch?.Medicine?.PriorityLevel ?? "Low";
                    
                    // Nếu là thuốc hướng thần (High) hoặc gây nghiện (Critical) bị lệch -> Tính là lệch lớn
                    if (priority == "High" || priority == "Critical")
                    {
                        thresholdExceeded = true;
                    }
                    else
                    {
                        double percent = Math.Abs(detail.Discrepancy) / (double)detail.SystemQuantity;
                        if (percent > 0.20 || Math.Abs(detail.Discrepancy) > 50)
                        {
                            thresholdExceeded = true;
                        }
                    }
                }
            }

            audit.DiscrepancyThresholdExceeded = thresholdExceeded;

            if (thresholdExceeded)
            {
                audit.Status = "Có chênh lệch"; // Chờ BGĐ duyệt chênh lệch lớn
            }
            else
            {
                audit.Status = "Đã xác nhận"; // Sẵn sàng để điều chỉnh tồn
            }

            // Cập nhật dòng thời gian
            var timeline = JsonSerializer.Deserialize<List<TimelineEvent>>(audit.TimelineJson ?? "[]") ?? new List<TimelineEvent>();
            timeline.Add(new TimelineEvent
            {
                Time = DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
                Activity = thresholdExceeded 
                    ? $"Ký xác nhận kiểm kê bởi {request.SignedBy}. Phát hiện chênh lệch lớn hoặc thuốc ưu tiên cao, chờ Ban Giám Đốc phê duyệt."
                    : $"Ký xác nhận kiểm kê bởi {request.SignedBy}. Số liệu chênh lệch trong hạn mức cho phép.",
                User = request.SignedBy
            });
            audit.TimelineJson = JsonSerializer.Serialize(timeline);

            await _context.SaveChangesAsync();
            return Ok(audit);
        }

        // 8. Lãnh đạo phê duyệt chênh lệch lớn (Giám đốc ký duyệt)
        [HttpPost("{id}/approve")]
        public async Task<IActionResult> Approve(int id, [FromBody] SignatureRequest request)
        {
            var audit = await _context.InventoryAudits
                .FirstOrDefaultAsync(a => a.AuditID == id);

            if (audit == null)
            {
                return NotFound(new { message = "Không tìm thấy phiếu kiểm kê" });
            }

            if (audit.Status != "Có chênh lệch")
            {
                return BadRequest(new { message = "Phiếu kiểm kê không ở trạng thái Chờ duyệt chênh lệch." });
            }

            audit.DirectorSignature = request.Signature;
            audit.DirectorSignedBy = request.SignedBy;
            audit.DirectorSignedAt = DateTime.Now;
            audit.Status = "Đã xác nhận"; // Đã được duyệt chênh lệch, sẵn sàng điều chỉnh tồn kho

            // Cập nhật dòng thời gian
            var timeline = JsonSerializer.Deserialize<List<TimelineEvent>>(audit.TimelineJson ?? "[]") ?? new List<TimelineEvent>();
            timeline.Add(new TimelineEvent
            {
                Time = DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
                Activity = $"Ban Giám Đốc phê duyệt chênh lệch kiểm kê và ký số bởi {request.SignedBy}",
                User = request.SignedBy
            });
            audit.TimelineJson = JsonSerializer.Serialize(timeline);

            await _context.SaveChangesAsync();
            return Ok(audit);
        }

        // 9. Hủy phiếu kiểm kê
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] CancelRequest request)
        {
            var userRole = Request.Headers["X-User-Role"].ToString();
            var deptIdStr = Request.Headers["X-User-DepartmentID"].ToString();

            var audit = await _context.InventoryAudits
                .FirstOrDefaultAsync(a => a.AuditID == id);

            if (audit == null)
            {
                return NotFound(new { message = "Không tìm thấy phiếu kiểm kê" });
            }

            if (userRole != "pharmacist" && userRole != "director")
            {
                if (!int.TryParse(deptIdStr, out int deptId) || audit.LocationType != "Cabinet" || audit.DepartmentID != deptId)
                {
                    return StatusCode(403, new { message = "Quyền truy cập bị từ chối. Bạn chỉ có quyền hủy phiếu kiểm kê thuộc khoa của mình." });
                }
            }

            if (audit.Status == "Đã điều chỉnh" || audit.Status == "Đã hủy")
            {
                return BadRequest(new { message = "Không thể hủy phiếu kiểm kê đã hoàn tất điều chỉnh tồn kho hoặc đã hủy trước đó." });
            }

            audit.Status = "Đã hủy";

            // Cập nhật dòng thời gian
            var timeline = JsonSerializer.Deserialize<List<TimelineEvent>>(audit.TimelineJson ?? "[]") ?? new List<TimelineEvent>();
            timeline.Add(new TimelineEvent
            {
                Time = DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
                Activity = $"Hủy phiếu kiểm kê. Lý do: {request.Reason}",
                User = request.CancelledBy
            });
            audit.TimelineJson = JsonSerializer.Serialize(timeline);

            await _context.SaveChangesAsync();
            return Ok(audit);
        }

        // 10. Thực hiện điều chỉnh tồn kho vật lý (Transaction an toàn)
        [HttpPost("{id}/adjust")]
        public async Task<IActionResult> Adjust(int id, [FromBody] AdjustRequest request)
        {
            var userRole = Request.Headers["X-User-Role"].ToString();
            var deptIdStr = Request.Headers["X-User-DepartmentID"].ToString();

            var audit = await _context.InventoryAudits
                .Include(a => a.Details)
                    .ThenInclude(d => d.Batch)
                        .ThenInclude(b => b!.Medicine)
                .FirstOrDefaultAsync(a => a.AuditID == id);

            if (audit == null)
            {
                return NotFound(new { message = "Không tìm thấy phiếu kiểm kê" });
            }

            if (userRole != "pharmacist" && userRole != "director")
            {
                if (!int.TryParse(deptIdStr, out int deptId) || audit.LocationType != "Cabinet" || audit.DepartmentID != deptId)
                {
                    return StatusCode(403, new { message = "Quyền truy cập bị từ chối. Bạn chỉ có quyền thực hiện cân đối kho thuộc khoa của mình." });
                }
            }

            if (audit.Status != "Đã xác nhận")
            {
                return BadRequest(new { message = "Phiếu kiểm kê phải được xác nhận và duyệt chênh lệch trước khi điều chỉnh tồn kho." });
            }

            // Khởi động Transaction
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    foreach (var detail in audit.Details)
                    {
                        // Ghi log nhật ký điều chỉnh tồn kho cho dù chênh lệch bằng 0 (lưu dấu vết kiểm toán)
                        var log = new StockAdjustmentLog
                        {
                            AuditID = audit.AuditID,
                            BatchID = detail.BatchID,
                            LocationType = audit.LocationType,
                            DepartmentID = audit.DepartmentID,
                            OldQuantity = detail.SystemQuantity,
                            NewQuantity = detail.ActualQuantity,
                            Discrepancy = detail.Discrepancy,
                            AdjustedBy = request.AdjustedBy,
                            AdjustmentDate = DateTime.Now,
                            Reason = detail.Reason ?? "Kiểm kê đối soát trùng khớp"
                        };
                        _context.StockAdjustmentLogs.Add(log);

                        // Chỉ cập nhật tồn kho vật lý nếu thực sự có lệch
                        if (detail.Discrepancy != 0)
                        {
                            if (audit.LocationType == "MainStore")
                            {
                                var stock = await _context.InventoryStocks
                                    .FirstOrDefaultAsync(s => s.BatchID == detail.BatchID);
                                if (stock != null)
                                {
                                    stock.CurrentQuantity = detail.ActualQuantity;
                                }
                            }
                            else // Cabinet
                            {
                                var stock = await _context.DepartmentStocks
                                    .FirstOrDefaultAsync(s => s.BatchID == detail.BatchID && s.DepartmentID == audit.DepartmentID);
                                if (stock != null)
                                {
                                    stock.CurrentQuantity = detail.ActualQuantity;
                                }
                            }
                        }
                    }

                    audit.Status = "Đã điều chỉnh";

                    // Cập nhật dòng thời gian
                    var timeline = JsonSerializer.Deserialize<List<TimelineEvent>>(audit.TimelineJson ?? "[]") ?? new List<TimelineEvent>();
                    timeline.Add(new TimelineEvent
                    {
                        Time = DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
                        Activity = "Cân đối và cập nhật số liệu tồn kho vật lý thành công. Khóa phiếu vĩnh viễn.",
                        User = request.AdjustedBy
                    });
                    audit.TimelineJson = JsonSerializer.Serialize(timeline);

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return Ok(audit);
                }
                catch (Exception)
                {
                    await transaction.RollbackAsync();
                    return StatusCode(500, new { message = "Lỗi trong quá trình cập nhật cơ sở dữ liệu. Toàn bộ thao tác đã được khôi phục." });
                }
            }
        }
    }

    // Requests DTOs
    public class CreateAuditRequest
    {
        public string LocationType { get; set; } = "MainStore";
        public int? DepartmentId { get; set; }
        public string CreatedBy { get; set; } = string.Empty;
        public string AuditType { get; set; } = "Định kỳ";
        public string? Notes { get; set; }
    }

    public class UpdateAuditRequest
    {
        public string AuditType { get; set; } = "Định kỳ";
        public string? Notes { get; set; }
        public List<DetailUpdateRequest> Details { get; set; } = new();
    }

    public class DetailUpdateRequest
    {
        public int AuditDetailID { get; set; }
        public int ActualQuantity { get; set; }
        public string? Reason { get; set; }
    }

    public class SignatureRequest
    {
        public string Signature { get; set; } = string.Empty;
        public string SignedBy { get; set; } = string.Empty;
    }

    public class CancelRequest
    {
        public string Reason { get; set; } = string.Empty;
        public string CancelledBy { get; set; } = string.Empty;
    }

    public class AdjustRequest
    {
        public string AdjustedBy { get; set; } = string.Empty;
    }

    public class TimelineEvent
    {
        public string Time { get; set; } = string.Empty;
        public string Activity { get; set; } = string.Empty;
        public string User { get; set; } = string.Empty;
    }
}
