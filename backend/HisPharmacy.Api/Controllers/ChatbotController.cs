using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using HisPharmacy.Api.Data;
using HisPharmacy.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class ChatbotController : ControllerBase
{
    private readonly HisDbContext _context;
    private readonly GeminiAiService _geminiService;

    public ChatbotController(HisDbContext context, GeminiAiService geminiService)
    {
        _context = context;
        _geminiService = geminiService;
    }

    public class ChatQueryRequest
    {
        public string Message { get; set; } = string.Empty;
        public string? UserRole { get; set; }
        public string? UserName { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
    }

    public class ChatQueryResponse
    {
        public string ReplyText { get; set; } = string.Empty;
        public string Intent { get; set; } = "GENERAL";
        public string? CardType { get; set; } // 'stock_table', 'expiry_list', 'requisition_list', 'movement_history', 'cabinet_table', 'executive_summary'
        public object? CardData { get; set; }
        public List<string> QuickReplies { get; set; } = new();
        public bool IsRealAi { get; set; } = true;
        public string AiEngine { get; set; } = "Google Gemini 3.5 Flash";
        public string UserRole { get; set; } = string.Empty;
    }

    [HttpPost("query")]
    public async Task<IActionResult> Query([FromBody] ChatQueryRequest req)
    {
        var rawMsg = req.Message?.Trim() ?? string.Empty;
        var lowerMsg = rawMsg.ToLower();
        var normMsg = RemoveDiacritics(lowerMsg);

        // 1. XÁC ĐỊNH DANH TÍNH & PHÂN QUYỀN TÀI KHOẢN (RBAC)
        var role = (req.UserRole ?? "pharmacist").ToLower();
        var userName = req.UserName ?? "Cán bộ Y tế";
        int? userDeptId = req.DepartmentId;
        string userDeptName = req.DepartmentName ?? string.Empty;

        // Nếu thông tin khoa chưa có, tự động tra cứu từ DB User
        if (!string.IsNullOrEmpty(req.UserName))
        {
            var dbUser = await _context.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.Username.ToLower() == req.UserName.ToLower() || u.FullName.ToLower() == req.UserName.ToLower());

            if (dbUser != null)
            {
                role = dbUser.Role.ToLower();
                userDeptId = dbUser.DepartmentID;
                if (dbUser.Department != null) userDeptName = dbUser.Department.DepartmentName;
            }
        }

        var response = new ChatQueryResponse
        {
            IsRealAi = _geminiService.IsConfigured,
            AiEngine = _geminiService.IsConfigured ? "Google Gemini 3.5 Flash (Live AI)" : "Rule-based Warehouse NLP",
            UserRole = role
        };

        // System prompt tùy biến chặt chẽ theo vai trò của tài khoản
        string roleContextPrompt = role switch
        {
            "director" => $@"Bạn là Trợ Lý Quản Trị Kho Vận & Điều Hành Dược Phẩm cấp Ban Giám Đốc Bệnh viện.
Người dùng hiện tại: Giám đốc bệnh viện ({userName}).
Trọng tâm trả lời: Báo cáo vĩ mô toàn viện, tổng quan tồn kho, rủi ro tài chính do thuốc cận date/hết hạn, tình hình điều phối giữa các khoa lâm sàng.",

            "head" => $@"Bạn là Trợ Lý Quản Trị Dược Khoa Lâm Sàng dành cho Bác sĩ Trưởng khoa.
Người dùng hiện tại: Trưởng khoa {userDeptName} ({userName}).
Trọng tâm trả lời: Định mức cơ số tủ trực khoa {userDeptName}, giám sát các phiếu lĩnh thuốc của khoa, cảnh báo thuốc thiếu hụt hoặc cận hạn trong tủ trực khoa.",

            "nurse" or "head_nurse" => $@"Bạn là Trợ Lý Tủ Trực & Cấp Phát Dược Khoa Lâm Sàng dành cho Điều dưỡng ca trực.
Người dùng hiện tại: Điều dưỡng khoa {userDeptName} ({userName}).
Trọng tâm trả lời: Số lượng tồn thực tế trong tủ trực ca trực khoa {userDeptName}, phát hiện thuốc sắp hết hạn trong tủ trực để kịp hoàn trả kho chẵn, kiểm tra tồn kho chẵn để dự trù lĩnh thuốc.",

            _ => $@"Bạn là Trợ Lý Quản Trị Kho Chẵn & Luân Chuyển Dược Phẩm Bệnh Viện dành cho Thủ kho/Dược sĩ.
Người dùng hiện tại: Dược sĩ/Thủ kho ({userName}).
Trọng tâm trả lời: Toàn quyền kiểm soát số lô, hạn dùng toàn viện, truy vết luân chuyển thuốc A đi đâu, kiểm soát FEFO và điều phối cấp phát."
        };

        string warehouseAiSystemPrompt = $@"{roleContextPrompt}

NGUYÊN TẮC BẮT BUỘC:
1. BẠN CHỈ PHỤC VỤ QUẢN LÝ KHO DƯỢC VÀ VẬN HÀNH LUÂN CHUYỂN THUỐC NỘI BỘ.
2. TUYỆT ĐỐI KHÔNG CHỈ ĐỊNH ĐIỀU TRỊ, KHÔNG KÊ ĐƠN, KHÔNG HƯỚNG DẪN CHỮA BỆNH, KHÔNG THAY THẾ BÁC SĨ.
3. VĂN PHONG VÀ CÁCH DIỄN ĐẠT (CỰC KỲ QUAN TRỌNG):
   - Trả lời tự nhiên, lịch sự, chuẩn mực và thực tế như một đồng nghiệp hoặc dược sĩ quản lý kho bình thường đang trao đổi công việc.
   - HẠN CHẾ TỐI ĐA VIỆC CHÈN ICON HOẶC EMOJI. Tuyệt đối không chèn các icon trang trí (như các biểu tượng cảm xúc, cờ hiệu, hộp quà, xe tải, loa báo động...) ở đầu dòng, tiêu đề hoặc xen kẽ giữa các câu. Trình bày bằng câu chữ rõ ràng, dùng gạch đầu dòng hoặc bảng số liệu nghiêm túc.
4. Phù hợp tuyệt đối với quyền hạn của tài khoản ({role}) đang đăng nhập.";

        // 2. CHẶN VÀ TỪ CHỐI CHỈ ĐỊNH ĐIỀU TRỊ (ÁP DỤNG CHO MỌI TÀI KHOẢN)
        if (normMsg.Contains("uong thuoc gi") || normMsg.Contains("chua benh") || normMsg.Contains("dieu tri benh") || 
            normMsg.Contains("ke don") || normMsg.Contains("bi benh") || normMsg.Contains("uong lieu") ||
            normMsg.Contains("chua khoi") || normMsg.Contains("phac do chua") || normMsg.Contains("bi dau uong") ||
            normMsg.Contains("bi sot uong") || normMsg.Contains("chua tri"))
        {
            response.Intent = "TREATMENT_BLOCKED";
            response.ReplyText = "**Lưu ý về phạm vi nghiệp vụ kho:**\n\nHệ thống chỉ phục vụ tra cứu số liệu vận hành kho dược bệnh viện:\n- Tồn kho thực tế theo từng số lô và hạn dùng.\n- Lịch sử luân chuyển và cấp phát thuốc giữa các khoa phòng.\n- Cảnh báo hạn dùng và danh mục thuốc cận date trong kho.\n\nHệ thống không hỗ trợ chỉ định điều trị hay kê đơn y khoa. Các quyết định khám chữa bệnh và chỉ định thuốc cho người bệnh phải do Bác sĩ điều trị quyết định.";
            
            response.QuickReplies = role switch
            {
                "director" => new List<string> { "Báo cáo tổng quan tồn kho toàn viện", "Lô thuốc nào hết hạn trong kho?", "Paracetamol được chuyển đi đâu?" },
                "nurse" or "head_nurse" => new List<string> { $"Kiểm tra cơ số tủ trực {userDeptName}", $"Thuốc nào trong tủ trực {userDeptName} sắp hết hạn?", "Kho Chẵn còn Paracetamol không?" },
                "head" => new List<string> { $"Cơ số tủ trực {userDeptName} hiện tại", $"Phiếu lĩnh thuốc của {userDeptName} chờ duyệt", "Tồn kho Paracetamol ở Kho Chẵn" },
                _ => new List<string> { "Có những lô thuốc nào hết hạn trong kho?", "Thuốc Paracetamol được chuyển đi đâu?", "Tồn kho Paracetamol 500mg hiện tại" }
            };
            return Ok(response);
        }

        // 3. GIẢI ĐÁP QUYỀN HẠN: TRƯỞNG KHOA CÓ THỂ TRA CỨU DỮ LIỆU KHO CHẴN KHÔNG?
        if ((normMsg.Contains("truong khoa") || normMsg.Contains("bac si") || normMsg.Contains("dieu duong") || normMsg.Contains("co the tra cuu") || normMsg.Contains("co duoc tra cuu") || normMsg.Contains("quyen tra cuu")) &&
            (normMsg.Contains("tra cuu") || normMsg.Contains("xem") || normMsg.Contains("kiem tra") || normMsg.Contains("thong tin")) &&
            (normMsg.Contains("kho chan") || normMsg.Contains("kho tong") || normMsg.Contains("kho duoc")))
        {
            response.Intent = "PERMISSION_INQUIRY";
            response.ReplyText = @"**Có, Bác sĩ Trưởng khoa hoàn toàn có thể tra cứu dữ liệu tồn kho tại Kho Chẵn thông qua Chatbot.**

Mục đích nghiệp vụ và quyền hạn cụ thể:
1. Đánh giá khả năng cung ứng trước khi duyệt dự trù: Trưởng khoa được phép kiểm tra lượng tồn thực tế của từng mặt hàng tại Kho Chẵn (còn bao nhiêu, số lô nào, hạn sử dụng đến bao giờ) để quyết định duyệt phiếu lĩnh thuốc thường quy hoặc bù cơ số tủ trực cho khoa mình.
2. Chủ động trong phác đồ điều trị: Trong trường hợp Kho Chẵn hết hàng hoặc chạm ngưỡng an toàn tối thiểu, Trưởng khoa sẽ kịp thời nắm thông tin để chỉ đạo bác sĩ trong khoa sử dụng thuốc thay thế cùng hoạt chất hoặc phối hợp với Dược lâm sàng.
3. Nguyên tắc bảo mật và phân quyền:
   - Dữ liệu Kho Chẵn được cấp quyền xem (Read-only) phục vụ tác nghiệp chuyên môn y tế.
   - Trưởng khoa không có quyền chỉnh sửa, nhập xuất hay can thiệp số liệu của Kho Chẵn (thao tác này thuộc trách nhiệm của Thủ kho Dược).
   - Trưởng khoa chỉ quản trị cơ số tủ trực và phiếu lĩnh của khoa mình, không xem cơ số nội bộ của các khoa lâm sàng khác.

Các câu hỏi Trưởng khoa có thể hỏi trực tiếp Chatbot:
- 'Kho Chẵn hiện còn Paracetamol 500mg không?'
- 'Tồn kho Augmentin tại Kho Chẵn còn bao nhiêu?'
- 'Kiểm tra tồn kho các loại dịch truyền ở Kho Chẵn'";

            response.QuickReplies = new List<string>
            {
                "Kho Chẵn hiện còn Paracetamol 500mg không?",
                $"Cơ số tủ trực khoa {userDeptName} hiện tại",
                $"Phiếu lĩnh thuốc của khoa {userDeptName} chờ duyệt"
            };
            return Ok(response);
        }

        // 4. CHÀO HỎI PHÂN THEO QUYỀN TÀI KHOẢN
        if (string.IsNullOrEmpty(rawMsg) || normMsg == "xin chao" || normMsg == "chao" || normMsg == "hello" || normMsg == "hi" || normMsg == "tro giup" || normMsg == "ban la ai")
        {
            response.Intent = "GREETING";
            if (role == "director")
            {
                response.ReplyText = $"Kính chào {userName} (Ban Giám Đốc Bệnh viện).\n\nTôi là Trợ lý Quản trị Kho Dược và Điều hành Dược phẩm. Tôi có thể hỗ trợ các báo cáo số liệu điều hành cho Ban Giám Đốc:\n- Báo cáo tổng quan quy mô tồn kho và tỷ lệ dự trữ toàn viện.\n- Cảnh báo các lô thuốc cận date hoặc hết hạn cần xử lý.\n- Theo dõi luân chuyển và phân phối thuốc giữa Kho Chẵn và các khoa lâm sàng.";
                response.QuickReplies = new List<string>
                {
                    "Báo cáo tổng quan tồn kho toàn viện",
                    "Có những lô thuốc nào hết hạn trong kho?",
                    "Thuốc Paracetamol được chuyển đi những khoa nào?",
                    "Tình hình thuốc cận date toàn viện"
                };
            }
            else if (role == "nurse" || role == "head_nurse")
            {
                response.ReplyText = $"Chào {userName} (Điều dưỡng {userDeptName}).\n\nTôi hỗ trợ tra cứu số liệu dược và tủ trực phục vụ ca trực của khoa {userDeptName}:\n- Kiểm tra cơ số thuốc hiện có trong tủ trực cấp cứu.\n- Rà soát các mặt hàng trong tủ trực sắp hết hạn để kịp thời làm thủ tục đổi trả.\n- Tra cứu tồn kho Kho Chẵn để phục vụ dự trù lĩnh thuốc.\n- Theo dõi tiến độ các phiếu lĩnh bù cơ số của khoa.";
                response.QuickReplies = new List<string>
                {
                    $"Kiểm tra cơ số tủ trực {userDeptName}",
                    $"Thuốc nào trong tủ trực {userDeptName} sắp hết hạn?",
                    "Kho Chẵn hiện còn Paracetamol 500mg không?",
                    "Tiến độ phiếu lĩnh thuốc của khoa"
                };
            }
            else if (role == "head")
            {
                response.ReplyText = $"Kính chào {userName} (Trưởng khoa {userDeptName}).\n\nTôi hỗ trợ theo dõi công tác dược nội bộ của khoa {userDeptName}:\n- Giám sát định mức cơ số tủ trực cấp cứu của khoa.\n- Theo dõi các phiếu dự trù lĩnh thuốc đang chờ duyệt.\n- Kiểm tra tồn kho tại Kho Chẵn để đánh giá khả năng cung ứng.\n- Xem lịch sử các đợt nhận thuốc cấp phát từ Kho Dược.";
                response.QuickReplies = new List<string>
                {
                    $"Cơ số tủ trực khoa {userDeptName}",
                    $"Phiếu lĩnh thuốc của khoa {userDeptName} chờ duyệt",
                    "Kiểm tra tồn kho Paracetamol ở Kho Chẵn",
                    $"Thuốc nào trong tủ trực {userDeptName} sắp hết hạn?"
                };
            }
            else
            {
                // Pharmacist / Thủ kho
                response.ReplyText = $"Chào {userName} (Dược sĩ / Thủ kho Dược).\n\nTôi hỗ trợ tra cứu số liệu vận hành kho vận dược phẩm:\n- Quản lý hạn dùng toàn viện, rà soát các lô cận date và quá hạn theo nguyên tắc FEFO.\n- Truy vết lịch sử luân chuyển và điều chuyển thuốc giữa các khoa.\n- Kiểm soát xuất nhập tồn và đối chiếu định mức an toàn tối thiểu.\n- Theo dõi và điều phối cấp phát cho các phiếu lĩnh thuốc.";
                response.QuickReplies = new List<string>
                {
                    "Có những lô thuốc nào hết hạn trong kho?",
                    "Thuốc Paracetamol được chuyển đi đâu?",
                    "Mặt hàng nào đang dưới định mức an toàn tối thiểu?",
                    "Cơ số tủ trực khoa Cấp Cứu hiện có gì?"
                };
            }
            return Ok(response);
        }

        // 4. BÁO CÁO VĨ MÔ DÀNH CHO BAN GIÁM ĐỐC (EXECUTIVE REPORT)
        if (role == "director" && (normMsg.Contains("bao cao tong quan") || normMsg.Contains("vi mo") || normMsg.Contains("tinh hinh ton kho toan vien") || normMsg.Contains("toan vien")))
        {
            var totalMedsCount = await _context.Medicines.CountAsync();
            var totalBatchesCount = await _context.Batches.CountAsync();
            var today = DateTime.Now;
            var expiredCount = await _context.Batches.CountAsync(b => b.ExpiryDate < today);
            var nearDateCount = await _context.Batches.CountAsync(b => b.ExpiryDate >= today && b.ExpiryDate <= today.AddDays(90));
            var pendingReqsCount = await _context.MedicineRequisitions.CountAsync(r => r.Status == "Pending" || r.Status == "PendingHead");
            var deptsWithCabinets = await _context.DepartmentStocks.Select(ds => ds.DepartmentID).Distinct().CountAsync();

            response.Intent = "EXECUTIVE_REPORT";
            response.CardType = "executive_summary";
            response.CardData = new
            {
                TotalMedicines = totalMedsCount,
                TotalBatches = totalBatchesCount,
                ExpiredBatches = expiredCount,
                NearDateBatches = nearDateCount,
                PendingRequisitions = pendingReqsCount,
                ActiveCabinets = deptsWithCabinets
            };

            var prompt = $@"Báo cáo quản trị gửi Giám đốc bệnh viện ({userName}):
- Tổng danh mục thuốc đang quản lý: {totalMedsCount} mặt hàng.
- Tổng số lô dược phẩm: {totalBatchesCount} lô.
- Lô thuốc đã hết hạn: {expiredCount} lô (cần phê duyệt thanh lý/tiêu hủy).
- Lô thuốc cận date dưới 90 ngày: {nearDateCount} lô (cần chỉ đạo luân chuyển).
- Phiếu lĩnh thuốc đang chờ duyệt: {pendingReqsCount} phiếu.
- Số khoa lâm sàng đang vận hành tủ trực: {deptsWithCabinets} khoa.
Hãy viết một bản tóm tắt điều hành mang tính chuyên môn cao, khách quan và thực tế cho Giám đốc. Tuyệt đối không dùng icon hay emoji.";

            var geminiSummary = await _geminiService.GenerateTextAsync(prompt, warehouseAiSystemPrompt);
            response.ReplyText = !string.IsNullOrWhiteSpace(geminiSummary)
                ? geminiSummary
                : $"**Báo cáo điều hành tổng quan - Ban Giám Đốc Bệnh viện:**\n- Toàn viện đang quản lý {totalMedsCount} mặt hàng thuốc với tổng cộng {totalBatchesCount} lô.\n- Hiện có {expiredCount} lô đã hết hạn và {nearDateCount} lô cận date dưới 90 ngày cần chỉ đạo xử lý.\n- {pendingReqsCount} phiếu lĩnh đang chờ xét duyệt cấp phát.";

            response.QuickReplies = new List<string>
            {
                "Chi tiết các lô thuốc đã hết hạn cần phê duyệt thanh lý",
                "Thuốc Paracetamol được chuyển đi những khoa nào?",
                "Khoa nào đang tồn nhiều thuốc cận date nhất?"
            };
            return Ok(response);
        }

        // 5. TRA CỨU LUÂN CHUYỂN: THUỐC A ĐƯỢC CHUYỂN ĐI ĐÂU?
        if (normMsg.Contains("chuyen di dau") || normMsg.Contains("di dau") || normMsg.Contains("chuyen den") || 
            normMsg.Contains("xuat cho ai") || normMsg.Contains("cap phat cho ai") || normMsg.Contains("khoa nao nhan") ||
            normMsg.Contains("lich su xuat") || normMsg.Contains("lich su chuyen") || normMsg.Contains("luan chuyen") ||
            normMsg.Contains("o khoa nao") || normMsg.Contains("khoa nao co") || normMsg.Contains("chuyen di") ||
            normMsg.Contains("xuat di"))
        {
            var allMedsList = await _context.Medicines.AsNoTracking().ToListAsync();
            var targetMed = allMedsList.FirstOrDefault(m =>
                normMsg.Contains(RemoveDiacritics(m.MedicineName.ToLower())) ||
                (!string.IsNullOrEmpty(m.MedicineCode) && normMsg.Contains(m.MedicineCode.ToLower())) ||
                (!string.IsNullOrEmpty(m.GenericName) && normMsg.Contains(RemoveDiacritics(m.GenericName.ToLower())))
            ) ?? allMedsList.FirstOrDefault();

            if (targetMed != null)
            {
                var reqsQuery = _context.MedicineRequisitions
                    .Include(r => r.Department)
                    .Include(r => r.Details)
                    .Where(r => r.Details.Any(d => d.MedicineID == targetMed.MedicineID));

                if ((role == "nurse" || role == "head" || role == "head_nurse") && userDeptId.HasValue)
                {
                    reqsQuery = reqsQuery.Where(r => r.DepartmentID == userDeptId.Value);
                }

                var reqsWithMed = await reqsQuery
                    .OrderByDescending(r => r.RequisitionDate)
                    .Take(8)
                    .ToListAsync();

                var transfers = reqsWithMed.Select(r =>
                {
                    var d = r.Details.First(x => x.MedicineID == targetMed.MedicineID);
                    return new
                    {
                        DepartmentName = r.Department != null ? r.Department.DepartmentName : "Khoa lâm sàng",
                        Date = r.RequisitionDate.ToString("dd/MM/yyyy HH:mm"),
                        RequestedQuantity = d.RequestedQuantity,
                        DispensedQuantity = d.DispensedQuantity ?? d.RequestedQuantity,
                        Status = r.Status,
                        ReceiverName = r.ReceiverName ?? "Điều dưỡng khoa",
                        RequisitionType = r.RequisitionType == "CabinetRefill" ? "Bù cơ số tủ trực" : "Lĩnh thường quy"
                    };
                }).ToList();

                var cabinetQuery = _context.DepartmentStocks
                    .Include(ds => ds.Department)
                    .Include(ds => ds.Batch)
                    .Where(ds => ds.Batch != null && ds.Batch.MedicineID == targetMed.MedicineID && ds.CurrentQuantity > 0);

                if ((role == "nurse" || role == "head" || role == "head_nurse") && userDeptId.HasValue)
                {
                    cabinetQuery = cabinetQuery.Where(ds => ds.DepartmentID == userDeptId.Value);
                }

                var cabinetHoldings = await cabinetQuery
                    .Select(ds => new
                    {
                        DepartmentName = ds.Department != null ? ds.Department.DepartmentName : "Khoa",
                        BatchNumber = ds.Batch != null ? ds.Batch.BatchNumber : "N/A",
                        Quantity = ds.CurrentQuantity
                    })
                    .ToListAsync();

                response.Intent = "MEDICINE_MOVEMENT";
                response.CardType = "movement_history";
                response.CardData = new
                {
                    MedicineName = targetMed.MedicineName,
                    MedicineCode = targetMed.MedicineCode,
                    Unit = targetMed.Unit,
                    CurrentLocations = cabinetHoldings,
                    Transfers = transfers
                };

                var prompt = $@"Báo cáo luân chuyển mặt hàng {targetMed.MedicineName} ({targetMed.MedicineCode}) cho cán bộ {userName} ({role}):
- Vị trí hiện tại trong tủ trực:
{(cabinetHoldings.Any() ? string.Join("\n", cabinetHoldings.Select(c => $"- Khoa: {c.DepartmentName}, Lô: {c.BatchNumber}, Số lượng: {c.Quantity} {targetMed.Unit}")) : "Hiện không lưu trong tủ trực")}
- Lịch sử xuất cấp phát:
{(transfers.Any() ? string.Join("\n", transfers.Take(5).Select(t => $"- Ngày {t.Date}: Xuất {t.DispensedQuantity} {targetMed.Unit} đến '{t.DepartmentName}', Người nhận: {t.ReceiverName}")) : "Chưa có lần xuất cấp phát gần đây")}

Hãy trả lời tự nhiên, rõ ràng và mạch lạc như đồng nghiệp trao đổi chuyên môn. Tuyệt đối không dùng icon hay emoji.";

                var aiSummary = await _geminiService.GenerateTextAsync(prompt, warehouseAiSystemPrompt);
                response.ReplyText = !string.IsNullOrWhiteSpace(aiSummary)
                    ? aiSummary
                    : $"**Lịch sử luân chuyển mặt hàng: {targetMed.MedicineName}**\n- Hiện thuốc đang có tại {cabinetHoldings.Count} tủ trực khoa phòng.\n- Đã thực hiện {transfers.Count} đợt xuất cấp phát gần đây từ Kho Chẵn.";

                response.QuickReplies = new List<string>
                {
                    $"Tồn kho {targetMed.MedicineName} tại Kho Chẵn",
                    "Có những lô thuốc nào hết hạn trong kho?",
                    "Cơ số tủ trực khoa Cấp Cứu"
                };
                return Ok(response);
            }
        }

        // 6. CẢNH BÁO HẠN DÙNG (PHÂN BIỆT RÕ THEO VAI TRÒ)
        if (normMsg.Contains("het han") || normMsg.Contains("qua han") || normMsg.Contains("can date") || 
            normMsg.Contains("han dung") || normMsg.Contains("sap het han") || normMsg.Contains("hu hong") || normMsg.Contains("bi hong"))
        {
            int daysThreshold = 90;
            if (normMsg.Contains("30 ngay")) daysThreshold = 30;
            else if (normMsg.Contains("60 ngay")) daysThreshold = 60;
            else if (normMsg.Contains("180 ngay") || normMsg.Contains("6 thang")) daysThreshold = 180;

            var thresholdDate = DateTime.Now.AddDays(daysThreshold);
            var today = DateTime.Now;

            // NẾU LÀ ĐIỀU DƯỠNG: CHỈ QUÉT THUỐC TRONG TỦ TRỰC KHOA MÌNH
            if ((role == "nurse" || role == "head_nurse") && userDeptId.HasValue)
            {
                var deptExpiring = await _context.DepartmentStocks
                    .Include(ds => ds.Batch)
                        .ThenInclude(b => b!.Medicine)
                    .Where(ds => ds.DepartmentID == userDeptId.Value && ds.CurrentQuantity > 0 && ds.Batch!.ExpiryDate <= thresholdDate)
                    .OrderBy(ds => ds.Batch!.ExpiryDate)
                    .Take(8)
                    .Select(ds => new
                    {
                        BatchID = ds.BatchID,
                        BatchNumber = ds.Batch!.BatchNumber,
                        MedicineName = ds.Batch.Medicine != null ? ds.Batch.Medicine.MedicineName : "N/A",
                        MedicineCode = ds.Batch.Medicine != null ? ds.Batch.Medicine.MedicineCode : "N/A",
                        ExpiryDate = ds.Batch.ExpiryDate,
                        DaysRemaining = (ds.Batch.ExpiryDate - today).Days,
                        IsExpired = ds.Batch.ExpiryDate < today,
                        Unit = ds.Batch.Medicine != null ? ds.Batch.Medicine.Unit : "đơn vị",
                        MainStock = 0,
                        DeptStock = ds.CurrentQuantity
                    })
                    .ToListAsync();

                response.Intent = "EXPIRY_ALERT_DEPT";
                response.CardType = "expiry_list";
                response.CardData = deptExpiring;

                var prompt = $@"Báo cáo hạn dùng tủ trực riêng cho Điều dưỡng khoa {userDeptName} ({userName}):
Có {deptExpiring.Count} lô thuốc trong tủ trực khoa sắp hết hạn dưới {daysThreshold} ngày:
{string.Join("\n", deptExpiring.Select(b => $"- Thuốc: {b.MedicineName} (Lô: {b.BatchNumber}), HSD: {b.ExpiryDate:dd/MM/yyyy}, Tồn tủ: {b.DeptStock} {b.Unit} ({(b.IsExpired ? "Đã hết hạn" : $"Còn {b.DaysRemaining} ngày")})"))}

Hướng dẫn Điều dưỡng xử lý: Không cấp phát thuốc quá hạn cho bệnh nhân, lập phiếu trả thuốc cận date về Kho Chẵn để đổi thuốc mới. Tuyệt đối không dùng icon hay emoji.";

                var aiReport = await _geminiService.GenerateTextAsync(prompt, warehouseAiSystemPrompt);
                response.ReplyText = !string.IsNullOrWhiteSpace(aiReport)
                    ? aiReport
                    : $"**Báo cáo hạn dùng tủ trực khoa {userDeptName}:** Hiện có {deptExpiring.Count} lô thuốc cận hạn trong tủ trực. Điều dưỡng vui lòng lập phiếu hoàn trả về Kho Chẵn để đổi thuốc mới.";

                response.QuickReplies = new List<string>
                {
                    $"Kiểm tra toàn bộ cơ số tủ trực {userDeptName}",
                    "Lập phiếu trả thuốc về Kho Chẵn",
                    "Tra cứu tồn kho Paracetamol ở Kho Chẵn"
                };
                return Ok(response);
            }

            // DÀNH CHO THỦ KHO & GIÁM ĐỐC: QUÉT TOÀN BỘ VIỆN
            var expiringBatches = await _context.Batches
                .Include(b => b.Medicine)
                .Where(b => b.ExpiryDate <= thresholdDate)
                .OrderBy(b => b.ExpiryDate)
                .Take(12)
                .Select(b => new
                {
                    b.BatchID,
                    b.BatchNumber,
                    MedicineName = b.Medicine != null ? b.Medicine.MedicineName : "N/A",
                    MedicineCode = b.Medicine != null ? b.Medicine.MedicineCode : "N/A",
                    b.ExpiryDate,
                    DaysRemaining = (b.ExpiryDate - today).Days,
                    IsExpired = b.ExpiryDate < today,
                    Unit = b.Medicine != null ? b.Medicine.Unit : "đơn vị",
                    MainStock = _context.InventoryStocks.Where(s => s.BatchID == b.BatchID).Sum(s => (int?)s.CurrentQuantity) ?? 0,
                    DeptStock = _context.DepartmentStocks.Where(s => s.BatchID == b.BatchID).Sum(s => (int?)s.CurrentQuantity) ?? 0
                })
                .ToListAsync();

            response.Intent = "EXPIRY_ALERT_ALL";
            response.CardType = "expiry_list";
            response.CardData = expiringBatches;

            var expiredTotal = expiringBatches.Count(b => b.IsExpired);
            var nearDateTotal = expiringBatches.Count(b => !b.IsExpired);

            var promptAll = $@"Báo cáo kiểm kê hạn dùng toàn viện gửi {userName} ({role}):
- Lô đã quá hạn: {expiredTotal} lô
- Lô cận date ({daysThreshold} ngày): {nearDateTotal} lô
Chi tiết các lô:
{string.Join("\n", expiringBatches.Take(6).Select(b => $"- Thuốc {b.MedicineName} (Lô: {b.BatchNumber}), HSD: {b.ExpiryDate:dd/MM/yyyy}, Kho chẵn: {b.MainStock}, Tủ trực: {b.DeptStock} (Trạng thái: {(b.IsExpired ? "Đã hết hạn" : $"Còn {b.DaysRemaining} ngày")})"))}

Hãy tóm tắt hướng xử lý: Niêm phong cách ly thuốc quá hạn và ưu tiên xuất kho theo FEFO cho lô cận date. Tuyệt đối không dùng icon hay emoji.";

            var aiReportAll = await _geminiService.GenerateTextAsync(promptAll, warehouseAiSystemPrompt);
            response.ReplyText = !string.IsNullOrWhiteSpace(aiReportAll)
                ? aiReportAll
                : $"**Báo cáo hạn dùng kho dược toàn viện:** Ghi nhận {expiredTotal} lô đã quá hạn và {nearDateTotal} lô cận date dưới {daysThreshold} ngày. Cần tiến hành niêm phong cách ly các lô hết hạn và ưu tiên xuất kho theo nguyên tắc FEFO.";

            response.QuickReplies = new List<string>
            {
                "Lọc các lô đã hết hạn cần tiêu hủy",
                "Thuốc Paracetamol được chuyển đi đâu?",
                "Nguyên tắc xuất kho FEFO là gì?"
            };
            return Ok(response);
        }

        // 7. TRA CỨU CƠ SỐ TỦ TRỰC KHOA LÂM SÀNG
        if (normMsg.Contains("tu truc") || normMsg.Contains("co so") || normMsg.Contains("cap cuu") || normMsg.Contains("khoa noi"))
        {
            var depts = await _context.Departments.AsNoTracking().ToListAsync();
            Department? targetDept = null;

            targetDept = depts.FirstOrDefault(d => normMsg.Contains(RemoveDiacritics(d.DepartmentName.ToLower())));

            if (targetDept == null)
            {
                if ((role == "nurse" || role == "head" || role == "head_nurse") && userDeptId.HasValue)
                {
                    targetDept = depts.FirstOrDefault(d => d.DepartmentID == userDeptId.Value);
                }
                else
                {
                    targetDept = depts.FirstOrDefault(d => d.DepartmentName.ToLower().Contains("cấp cứu")) ?? depts.FirstOrDefault();
                }
            }

            if (targetDept != null)
            {
                var stocks = await _context.DepartmentStocks
                    .Include(ds => ds.Batch)
                        .ThenInclude(b => b!.Medicine)
                    .Where(ds => ds.DepartmentID == targetDept.DepartmentID && ds.CurrentQuantity > 0)
                    .Take(15)
                    .Select(ds => new
                    {
                        MedicineName = ds.Batch != null && ds.Batch.Medicine != null ? ds.Batch.Medicine.MedicineName : "N/A",
                        BatchNumber = ds.Batch != null ? ds.Batch.BatchNumber : "N/A",
                        ExpiryDate = ds.Batch != null ? ds.Batch.ExpiryDate.ToString("yyyy-MM-dd") : "",
                        Quantity = ds.CurrentQuantity,
                        Unit = ds.Batch != null && ds.Batch.Medicine != null ? ds.Batch.Medicine.Unit : "đơn vị"
                    })
                    .ToListAsync();

                response.Intent = "CABINET_STOCK";
                response.CardType = "cabinet_table";
                response.CardData = new
                {
                    DepartmentName = targetDept.DepartmentName,
                    Items = stocks
                };

                var prompt = $@"Báo cáo cơ số thuốc trong tủ trực {targetDept.DepartmentName} (hiện có {stocks.Count} mặt hàng lưu trữ) cho {userName} ({role}):
{string.Join("\n", stocks.Select((s, i) => $"{i + 1}. {s.MedicineName} - Lô: {s.BatchNumber} - HSD: {s.ExpiryDate} - Số lượng: {s.Quantity} {s.Unit}"))}

Yêu cầu trình bày:
- Trả lời tự nhiên, rõ ràng, gãy gọn như người bình thường hoặc đồng nghiệp y tế trao đổi công việc.
- TUYỆT ĐỐI KHÔNG CHÈN BẤT KỲ ICON HOẶC EMOJI NÀO trong câu trả lời.
- Liệt kê cụ thể danh mục các thuốc hiện có, số lượng tồn và số lô để đối chiếu ca trực.
- Đưa ra nhận xét khách quan về tình trạng cơ số dự phòng (thuốc nào còn nhiều, thuốc nào sắp hết cần dự trù, thuốc kiểm soát đặc biệt).";

                var aiDetailText = await _geminiService.GenerateTextAsync(prompt, warehouseAiSystemPrompt);

                if (!string.IsNullOrWhiteSpace(aiDetailText))
                {
                    response.ReplyText = aiDetailText;
                }
                else
                {
                    var sb = new StringBuilder();
                    sb.AppendLine($"**Cơ số Tủ Trực Khoa: {targetDept.DepartmentName}**");
                    sb.AppendLine($"Hiện tại tủ trực khoa đang lưu trữ {stocks.Count} mặt hàng thuốc dự phòng cấp cứu:");
                    foreach (var s in stocks)
                    {
                        sb.AppendLine($"- {s.MedicineName}: {s.Quantity:N0} {s.Unit} (Lô: {s.BatchNumber}, HSD: {s.ExpiryDate})");
                    }
                    sb.AppendLine("\nĐiều dưỡng vui lòng đối chiếu bảng số liệu chi tiết bên dưới khi bàn giao ca trực.");
                    response.ReplyText = sb.ToString();
                }

                response.QuickReplies = new List<string>
                {
                    $"Thuốc nào trong tủ trực {targetDept.DepartmentName} sắp hết hạn?",
                    "Kho Chẵn hiện còn Paracetamol 500mg không?",
                    "Lập phiếu lĩnh bù cơ số"
                };
                return Ok(response);
            }
        }

        // 8. THEO DÕI TIẾN ĐỘ PHIẾU LĨNH THUỐC
        if (normMsg.Contains("phieu linh") || normMsg.Contains("yeu cau") || normMsg.Contains("tien do") || normMsg.Contains("cho duyet"))
        {
            var reqsQuery = _context.MedicineRequisitions
                .Include(r => r.Department)
                .AsQueryable();

            if ((role == "nurse" || role == "head" || role == "head_nurse") && userDeptId.HasValue)
            {
                reqsQuery = reqsQuery.Where(r => r.DepartmentID == userDeptId.Value);
            }

            var reqs = await reqsQuery
                .OrderByDescending(r => r.RequisitionDate)
                .Take(5)
                .Select(r => new
                {
                    r.RequisitionID,
                    RequisitionCode = $"PL-{r.RequisitionID:D5}",
                    DepartmentName = r.Department != null ? r.Department.DepartmentName : "Khoa lâm sàng",
                    r.Status,
                    Priority = r.RequisitionType == "CabinetRefill" ? "Tủ trực" : "Thường quy",
                    CreatedAt = r.RequisitionDate.ToString("dd/MM/yyyy HH:mm")
                })
                .ToListAsync();

            response.Intent = "REQUISITION_TRACK";
            response.CardType = "requisition_list";
            response.CardData = reqs;

            var sbReq = new StringBuilder();
            sbReq.AppendLine($"**Tiến độ các phiếu lĩnh dược phẩm {((role == "nurse" || role == "head") ? $"khoa {userDeptName}" : "toàn viện")}:**");
            sbReq.AppendLine($"Ghi nhận {reqs.Count} phiếu lĩnh trên hệ thống:");
            foreach (var r in reqs)
            {
                sbReq.AppendLine($"- Mã phiếu {r.RequisitionCode} ({r.DepartmentName}): Trạng thái {r.Status}, Loại: {r.Priority}, Thời gian: {r.CreatedAt}");
            }
            response.ReplyText = sbReq.ToString();

            response.QuickReplies = new List<string>
            {
                "Có những lô thuốc nào hết hạn trong kho?",
                "Thuốc Paracetamol được chuyển đi đâu?",
                "Kiểm tra tồn kho tổng thể"
            };
            return Ok(response);
        }

        // 9. TRA CỨU TỒN KHO THỰC TẾ THEO TÊN THUỐC
        var allMeds = await _context.Medicines.AsNoTracking().ToListAsync();
        var matchedMedicine = allMeds.FirstOrDefault(m =>
            normMsg.Contains(RemoveDiacritics(m.MedicineName.ToLower())) ||
            (!string.IsNullOrEmpty(m.MedicineCode) && normMsg.Contains(m.MedicineCode.ToLower())) ||
            (!string.IsNullOrEmpty(m.GenericName) && normMsg.Contains(RemoveDiacritics(m.GenericName.ToLower())))
        );

        if (matchedMedicine != null)
        {
            var batches = await _context.Batches
                .Where(b => b.MedicineID == matchedMedicine.MedicineID)
                .ToListAsync();

            var batchIds = batches.Select(b => b.BatchID).ToList();

            var totalMainStock = await _context.InventoryStocks
                .Where(s => batchIds.Contains(s.BatchID))
                .SumAsync(s => (int?)s.CurrentQuantity) ?? 0;

            var totalDeptStock = await _context.DepartmentStocks
                .Where(s => batchIds.Contains(s.BatchID))
                .SumAsync(s => (int?)s.CurrentQuantity) ?? 0;

            var batchDetails = batches.Select(b => new
            {
                b.BatchNumber,
                ExpiryDate = b.ExpiryDate.ToString("yyyy-MM-dd"),
                Stock = _context.InventoryStocks.FirstOrDefault(s => s.BatchID == b.BatchID)?.CurrentQuantity ?? 0
            }).ToList();

            response.Intent = "MEDICINE_STOCK";
            response.CardType = "stock_table";
            response.CardData = new
            {
                MedicineName = matchedMedicine.MedicineName,
                MedicineCode = matchedMedicine.MedicineCode,
                Unit = matchedMedicine.Unit,
                Batches = batchDetails
            };

            var prompt = $@"Báo cáo tồn kho thuốc: {matchedMedicine.MedicineName} ({matchedMedicine.MedicineCode}) cho cán bộ {userName} ({role}):
- Tồn Kho Chẵn: {totalMainStock} {matchedMedicine.Unit}
- Tồn Tủ Trực các khoa: {totalDeptStock} {matchedMedicine.Unit}
- Định mức an toàn tối thiểu: {matchedMedicine.MinInventory} {matchedMedicine.Unit}
Hãy đưa ra tóm tắt quản trị kho tự nhiên, rõ ràng, thực tế. Tuyệt đối không dùng icon hay emoji.";

            var geminiReply = await _geminiService.GenerateTextAsync(prompt, warehouseAiSystemPrompt);
            response.ReplyText = !string.IsNullOrWhiteSpace(geminiReply)
                ? geminiReply
                : $"Kết quả tồn kho cho thuốc **{matchedMedicine.MedicineName}** ({matchedMedicine.MedicineCode}):\n- Tồn tại Kho Chẵn: `{totalMainStock:N0}` {matchedMedicine.Unit}\n- Tồn tại Tủ Trực các khoa: `{totalDeptStock:N0}` {matchedMedicine.Unit}\n- Tổng tồn toàn viện: **`{(totalMainStock + totalDeptStock):N0}` {matchedMedicine.Unit}**\n- Định mức an toàn tối thiểu: `{matchedMedicine.MinInventory}` {matchedMedicine.Unit}";

            response.QuickReplies = new List<string>
            {
                $"{matchedMedicine.MedicineName} được chuyển đi đâu?",
                "Có những lô thuốc nào hết hạn trong kho?",
                "Tủ trực khoa Cấp Cứu hiện có gì?"
            };
            return Ok(response);
        }

        // 10. MẶC ĐỊNH THEO QUYỀN HẠN
        var defaultTotalMeds = await _context.Medicines.CountAsync();
        response.Intent = "GENERAL_WAREHOUSE_INFO";
        response.ReplyText = $"Tôi là Trợ lý Quản trị Kho Dược phục vụ tài khoản **{userName}** ({role}).\nHiện hệ thống đang quản lý {defaultTotalMeds} mặt hàng dược phẩm.\n\nBạn có thể hỏi:\n- Danh sách các lô thuốc hết hạn trong kho\n- {((role == "nurse" || role == "head") ? $"Cơ số thuốc hiện có tại tủ trực {userDeptName}" : "Cơ số thuốc tại tủ trực khoa Cấp Cứu")}\n- Lịch sử chuyển thuốc [Tên thuốc] đi đâu\n- Tồn kho [Tên thuốc] tại Kho Chẵn";

        response.QuickReplies = role switch
        {
            "director" => new List<string> { "Báo cáo tổng quan tồn kho toàn viện", "Có những lô thuốc nào hết hạn trong kho?", "Thuốc Paracetamol được chuyển đi đâu?" },
            "nurse" or "head_nurse" => new List<string> { $"Kiểm tra cơ số tủ trực {userDeptName}", $"Thuốc nào trong tủ trực {userDeptName} sắp hết hạn?", "Kho Chẵn còn Paracetamol không?" },
            "head" => new List<string> { $"Cơ số tủ trực {userDeptName} hiện tại", $"Phiếu lĩnh thuốc của {userDeptName} chờ duyệt", "Tồn kho Paracetamol ở Kho Chẵn" },
            _ => new List<string> { "Có những lô thuốc nào hết hạn trong kho?", "Thuốc Paracetamol được chuyển đi đâu?", "Tồn kho Paracetamol 500mg hiện tại" }
        };

        return Ok(response);
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
