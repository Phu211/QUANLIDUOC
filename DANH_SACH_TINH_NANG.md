# TÀI LIỆU ĐẶC TẢ TOÀN BỘ TÍNH NĂNG DỰ ÁN
## HỆ THỐNG QUẢN LÝ DƯỢC BỆNH VIỆN ĐA KHOA (HIS - PHARMACY)

---

## 📌 I. TỔNG QUAN HỆ THỐNG & KIẾN TRÚC KỸ THUẬT

* **Tên phân hệ:** Phân hệ Quản lý Dược Bệnh viện (HIS - Pharmacy Management System).
* **Mô hình kiến trúc:** Client - Server tách biệt (Decoupled Full-Stack Architecture).
* **Backend:**
  * **Framework:** ASP.NET Core (.NET Web API).
  * **Cơ sở dữ liệu:** Microsoft SQL Server Express với Entity Framework Core.
  * **Giao tiếp thời gian thực:** Microsoft SignalR WebSocket Hub (`/pharmacyHub`) đồng bộ dữ liệu tức thời giữa các máy trạm.
  * **Xử lý nền:** Background Hosted Service (`ExpiryScannerJob`) quét hạn dùng định kỳ.
* **Frontend:**
  * **Framework:** React 18, Vite.
  * **Bộ icon:** Lucide React.
  * **Giao diện:** Thiết kế giao diện y tế chuyên sâu (Clinical Contrast), hỗ trợ Chuyển đổi Giao diện Tối/Sáng (Light/Dark Mode), Menu bên thu gọn/mở rộng linh hoạt.
  * **Chữ ký điện tử:** Tích hợp Canvas vẽ chữ ký số điện tử (Digital Signature Pad) xuất chuỗi mã hóa Base64 lưu trữ trực tiếp vào cơ sở dữ liệu.
* **Trí tuệ nhân tạo & Thuật toán thông minh:**
  * **Google Gemini 3.5 Flash Multimodal:** Nhận diện hóa đơn PDF/ảnh tự động bằng AI Vision (OCR) và Trợ lý ảo Dược lâm sàng thông minh (Chatbot NLP).
  * **Thuật toán FEFO (First Expired, First Out):** Tự động bóc tách lô có hạn dùng gần nhất còn hạn để xuất cấp phát và kê đơn.
  * **Thuật toán ADC (Average Daily Consumption):** Tính tốc độ tiêu thụ bình quân ngày trong 90 ngày của từng khoa và toàn viện.
  * **Chỉ số DaysOfSupply:** Dự báo số ngày tồn kho khả dụng để phát hiện nguy cơ hết hạn thuốc.

---

## 👥 II. HỆ THỐNG PHÂN QUYỀN NGƯỜI DÙNG (ROLE-BASED ACCESS CONTROL - RBAC)

Hệ thống thiết lập 6 nhóm vai trò chuyên biệt với quyền hạn và phạm vi dữ liệu phân cấp nghiêm ngặt:

| Mã vai trò | Tên vai trò | Phạm vi trách nhiệm chính |
| :--- | :--- | :--- |
| `director` | **Ban Giám Đốc Bệnh viện** | Toàn quyền giám sát vĩ mô toàn viện; Phê duyệt kiểm kê kho, duyệt nhập kho, duyệt thanh lý/tiêu hủy, duyệt đề xuất mua sắm và quyết định thu hồi thuốc. |
| `pharmacist` | **Thủ kho Dược (Kho chẵn)** | Quản lý nhập kho từ Nhà cung cấp, cấp phát thuốc/vật tư theo nguyên tắc FEFO, điều phối luân chuyển nội bộ, theo dõi số lô, hạn dùng toàn viện. |
| `dispensary` | **Dược sĩ Kho lẻ / Quầy Dược Ngoại Trú** | Quản lý kho lẻ của khoa; Quét mã vạch đơn thuốc ngoại trú, cấp phát theo đơn, in phiếu dặn dò sử dụng thuốc, quản lý dự trù lĩnh và hoàn trả về kho chẵn. |
| `head` | **Bác sĩ Trưởng khoa lâm sàng** | Quản lý và giám sát cơ số tủ trực cấp cứu/nội trú của khoa phòng; Phê duyệt các phiếu dự trù lĩnh thuốc của khoa; Ủy quyền duyệt cho Điều dưỡng trưởng. |
| `head_nurse` | **Điều dưỡng trưởng khoa** | Lập phiếu dự trù lĩnh thuốc khoa; Lập biên bản kiểm kê tủ trực khoa; Lập phiếu hoàn trả thuốc thừa về kho chẵn; Ký duyệt theo ủy quyền của Trưởng khoa. |
| `nurse` | **Điều dưỡng lâm sàng (Ca trực)** | Xuất thuốc từ tủ trực cấp phát cho người bệnh (ghi nhận mã bệnh nhân, số lượng, thời gian); Kiểm tra tồn tủ trực trong ca trực cấp cứu. |

---

## 🏥 III. DANH MỤC 14 PHÂN HỆ TÍNH NĂNG CHÍNH

### 1. Bảng điều khiển trung tâm (Dashboard & Analytics)
* **Chỉ số KPI thời gian thực:** Thống kê tổng số mặt hàng thuốc, số phiếu dự trù chờ duyệt, số lô cận hạn (ngưỡng 30/60/90 ngày), số lô hết hạn, và số mặt hàng dưới ngưỡng an toàn (*Low-stock*).
* **Biểu đồ Nhập - Xuất - Tồn:** Trực quan hóa dòng luân chuyển dược phẩm theo Ngày, Tuần, Tháng, Quý, Năm.
* **Cơ cấu danh mục:** Biểu đồ phân bổ tỷ trọng theo nhóm dược lý (Kháng sinh, Giảm đau, Tim mạch, Dịch truyền...).
* **Phân quyền hiển thị:** Cho phép Ban Giám Đốc theo dõi vĩ mô toàn viện hoặc lọc chi tiết theo từng khoa lâm sàng riêng biệt.

---

### 2. Quản lý Danh mục Thuốc & Vật tư y tế (Medicine Management)
* **Quản lý thông tin chuẩn hóa:** Quản lý Mã thuốc viện (`MedicineCode`), Tên biệt dược, Tên gốc/hoạt chất (`GenericName`), Quy cách đóng gói, Hãng sản xuất, Đơn vị tính (viên, vỉ, lọ, chai...).
* **Định mức an toàn:** Cấu hình ngưỡng tồn kho tối thiểu (`MinInventory`) để tự động kích hoạt cảnh báo thiếu hàng.
* **Phân loại nhóm thuốc:** Kháng sinh, Giảm đau hạ sốt, Kháng viêm, Thuốc tim mạch, Vitamin & Khoáng chất, Vật tư tiêu hao...
* **Tác vụ danh mục:** Thêm mới, chỉnh sửa, xóa, tìm kiếm nhanh và chức năng nhập dữ liệu hàng loạt (*Bulk Import*).

---

### 3. Nhập kho chẵn & Biên bản kiểm nhập (Import Receipts & Inspection)
* **Quy chuẩn kiểm nhập:** Lập biên bản kiểm nhập dược phẩm từ Nhà cung cấp theo đúng biểu mẫu y tế.
* **Quản lý hợp đồng & hóa đơn:** Quản lý số hợp đồng thầu cố định, số hóa đơn GTGT, số phiếu giao nhận hàng.
* **Tích hợp AI OCR Vision:**
  * Quét ảnh chụp hoặc file PDF hóa đơn nhà cung cấp bằng **Google Gemini Vision**.
  * Tự động trích xuất: Tên thuốc, số lô, hạn dùng, số lượng, đơn giá và đối chiếu tự động với danh mục thuốc bệnh viện.
* **Kiểm soát tay ba & 4 chữ ký số:** Ký số điện tử giữa **Thủ kho Dược**, **Dược sĩ cùng kiểm tra**, **Người giao hàng**, và **Ban Giám Đốc duyệt**.
* **Đính kèm tài liệu số hóa:** Tải lên và lưu trữ ảnh/PDF hóa đơn GTGT, phiếu xuất kho NCC, phiếu kiểm nghiệm COA/COO.
* **Tự động cập nhật kho:** Database Trigger tự động kích hoạt cộng dồn tồn kho theo lô vào Kho chẵn (`InventoryStocks`) khi phiếu được duyệt.

---

### 4. Cấp phát thuốc & Vật tư khoa lâm sàng (Requisitions & Internal Transfers)
* **Phân loại phiếu dự trù:** Lập phiếu dự trù thuốc thường quy (*Regular*) hoặc phiếu lĩnh bù cơ số tủ trực (*CabinetRefill*).
* **Quy trình duyệt 2 cấp phân quyền:**
  * *Bước 1:* Điều dưỡng lập phiếu và ký số đề nghị.
  * *Bước 2:* Bác sĩ Trưởng khoa xem xét và ký duyệt.
  * *Bước 3:* Dược sĩ/Thủ kho xuất cấp phát thuốc.
* **Cơ chế Ủy quyền duyệt (Delegation Mode):** Trưởng khoa có thể kích hoạt chế độ ủy quyền để Điều dưỡng trưởng ký duyệt thay trong ca trực khẩn cấp.
* **Thuật toán cấp phát FEFO tự động:** Tự động bóc tách và ưu tiên chọn các lô có hạn dùng gần nhất còn hạn để xuất kho.
* **Tùy biến thực cấp:** Thủ kho có thể điều chỉnh số lượng thực cấp nếu kho chẵn thiếu hàng cục bộ.
* **Sinh phiếu điều chuyển nội bộ:** Tự động tạo bản ghi `InternalTransfer` ghi nhận lịch sử chuyển giao giữa Kho chẵn và Khoa phòng.

---

### 5. Quản lý Tủ trực Khoa lâm sàng (Cabinet Management)
* **Quản lý tồn kho tủ trực:** Theo dõi tồn kho thực tế tại tủ trực các khoa (Cấp cứu, Khám bệnh, Nội tổng hợp, Đông y, Xét nghiệm...).
* **Xuất tủ trực cho bệnh nhân:** Ghi nhận mã bệnh nhân, họ tên bệnh nhân, số lượng thuốc sử dụng, ngày giờ và điều dưỡng thực hiện.
* **Khóa tủ trực thông minh (Audit Lock):** Tự động khóa toàn bộ giao dịch xuất tủ trực khi khoa đang tiến hành kiểm kê để chống gian lận/sai lệch số liệu.
* **Bù tủ trực tự động:** Hệ thống tự động gom các lượt xuất tủ trực chưa bù (`IsRefilled = 0`) để sinh sẵn phiếu xin cấp phát bù cơ số về Kho Dược.

---

### 6. Cấp phát thuốc Ngoại trú & Quét đơn thuốc (Outpatient Dispensing)
* **Phân hệ dành riêng cho Dược sĩ kho lẻ / Quầy Dược Ngoại Trú:**
* **Quét mã vạch (Barcode Scanner):** Quét mã vạch đơn thuốc hoặc tìm kiếm bằng Mã bệnh nhân, Họ tên, Số thẻ BHYT.
* **Ghép lô FEFO thông minh:** Tự động chọn lô thuốc từ kho lẻ của quầy theo nguyên tắc ưu tiên hạn dùng gần nhất.
* **Tính toán tài chính BHYT:** Tự động tính Tổng tiền đơn, Mức bảo hiểm chi trả (80%, 100%), và Số tiền bệnh nhân cùng chi trả (*Co-pay*).
* **Cấp phát & Lưu vết:** Trừ tồn kho lẻ theo thời gian thực, lưu chữ ký số Dược sĩ phát thuốc.
* **In toa hướng dẫn sử dụng:** In phiếu dặn dò chi tiết liều dùng Sáng - Trưa - Chiều - Tối, uống trước/sau khi ăn cho bệnh nhân.

---

### 7. Quản lý Hoàn trả thuốc thừa (Returns Management)
* **Lập phiếu hoàn trả:** Khoa lâm sàng / Kho lẻ lập phiếu trả lại thuốc thừa về Kho chẵn (do bệnh nhân xuất viện, đổi phác đồ, giảm cơ số).
* **Kiểm tra hợp lệ tồn kho:** Chặn không cho phép hoàn trả vượt quá số lượng thực tế đang có trong tủ trực.
* **Phê duyệt hoàn trả:** Thủ kho hoặc Ban Giám Đốc ký duyệt.
* **Đồng bộ tồn kho:** Trừ tồn tủ trực khoa phòng và cộng hoàn lại đúng số lô ban đầu vào Kho chẵn chính.

---

### 8. Cảnh báo & Đề xuất mua sắm đặt hàng (Restock Management)
* **Quét thiếu hụt tự động:** Phát hiện tức thì các mặt hàng có tổng tồn toàn viện (Kho chẵn + Tủ trực các khoa) nhỏ hơn `MinInventory`.
* **Công thức gợi ý số lượng mua:** Tự động tính toán:
  $$\text{Số lượng gợi ý} = (\text{MinInventory} \times 3) - \text{Tồn hiện tại}$$
* **Lập phiếu dự trù mua sắm:** Tổng hợp danh sách gửi các Nhà cung cấp kèm đơn giá dự kiến.
* **Ký duyệt Lãnh đạo:** Dược sĩ lập phiếu, Ban Giám Đốc ký số phê duyệt đề xuất.

---

### 9. Cảnh báo & Điều chuyển cận date thông minh (Short-Dated Clearance)
* **Thuật toán ADC (Average Daily Consumption):** Phân tích tốc độ sử dụng thuốc trung bình mỗi ngày của từng khoa và toàn viện trong 90 ngày gần nhất.
* **Chỉ số DaysOfSupply:** Dự báo số ngày tồn kho sẽ tiêu thụ hết dựa trên tốc độ tiêu thụ thực tế.
* **Đánh giá mức độ rủi ro:** Phân cấp 4 cấp độ: *Nguy cấp (High), Trung bình (Medium), Thấp (Low), Đã hết hạn (Expired)*.
* **Đề xuất Heuristic tự động:**
  * **Ghép đôi điều chuyển:** Đề xuất chuyển từ khoa tồn đọng sang khoa có tốc độ sử dụng cao, hoặc chuyển về Quầy Dược Ngoại Trú để giải phóng nhanh.
  * **Đổi trả NCC:** Đề xuất liên hệ Nhà cung cấp để đổi lô mới.
  * **Thanh lý tiêu hủy:** Cảnh báo nếu thuốc không còn khả năng giải phóng trước hạn dùng.
* **Sinh phiếu điều chuyển tức thì:** Cho phép tạo nhanh phiếu điều chuyển nội bộ có chữ ký số xác nhận.

---

### 10. Thu hồi & Cách ly lô thuốc khẩn cấp (Medicine Recall & Quarantine)
* **Lệnh thu hồi khẩn cấp:** Ban hành quyết định thu hồi lô thuốc không đạt tiêu chuẩn chất lượng hoặc theo công văn Cục Quản lý Dược.
* **Cách ly toàn viện:** Chuyển trạng thái lô sang `Cách ly` -> Lập tức khóa lô thuốc trên toàn bộ hệ thống, ngăn chặn tuyệt đối việc xuất kho, kê đơn hay sử dụng tại các khoa.
* **Tính năng Truy vết luân chuyển (Traceability):**
  * Tra cứu tức thời lô thuốc này đã được chuyển đến những khoa nào, tủ trực nào.
  * Truy vết danh sách bệnh nhân và đơn thuốc đã tiếp nhận lô thuốc này để cảnh báo theo dõi phản ứng bất lợi (ADR).
* **Xử lý sau thu hồi:** Tự động chuyển giao sang luồng Đổi trả Nhà cung cấp hoặc lập Hội đồng tiêu hủy.

---

### 11. Kiểm kê Kho & Tủ trực (Inventory Audit)
* **Phạm vi kiểm kê:** Hỗ trợ kiểm kê định kỳ hoặc đột xuất cho Kho chẵn (*MainStore*) hoặc Tủ trực từng khoa (*Cabinet*).
* **Hội đồng kiểm kê:** Thành lập hội đồng gồm Trưởng ban, Thư ký, Dược sĩ, Kế toán.
* **Đối chiếu sổ sách vs Thực tế:** Nhập số lượng đếm thực tế -> Hệ thống tự tính chênh lệch Thừa / Thiếu, Giá trị chênh lệch và lý do (hỏng, vỡ, nhầm lẫn).
* **Ký số hội đồng:** Đầy đủ chữ ký số điện tử của các thành viên tham gia kiểm kê.
* **Cân đối tồn kho tự động (Stock Adjustment Log):** Sau khi Giám đốc phê duyệt, hệ thống tự động điều chỉnh số liệu tồn kho sổ sách khớp với thực tế và lưu vết nhật ký kiểm toán.

---

### 12. Thanh lý & Tiêu hủy thuốc (Liquidation & Destruction)
* **Quản lý danh sách hư hao:** Tập hợp các mặt hàng vỡ, hỏng mốc, hết hạn dùng, hoặc lô thu hồi cần loại bỏ.
* **Hội đồng thanh lý:** Lập biên bản đề xuất thanh lý có chữ ký của Dược sĩ và Ban Giám Đốc.
* **Tiêu hủy an toàn:** Ghi nhận hình thức tiêu hủy (chôn lấp, đốt lò nhiệt độ cao...), trừ hoàn toàn tồn kho và đánh dấu trạng thái lô là `Tiêu hủy`.

---

### 13. Báo cáo Nhập - Xuất - Tồn chuyên sâu (Inventory Tracking)
* **Báo cáo luân chuyển:** Thống kê chi tiết Đầu kỳ, Nhập trong kỳ, Xuất trong kỳ và Tồn cuối kỳ cho từng loại thuốc.
* **Bóc tách vị trí:** Xem rõ số lượng đang nằm tại Kho chẵn chính hay tại Tủ trực khoa lâm sàng nào.
* **Quản lý theo Số Lô & Hạn Dùng:** Hiển thị chi tiết từng lô thuốc, ngày sản xuất, hạn sử dụng, giá nhập và nguồn gốc nhập.
* **Bộ lọc đa tiêu chí:** Lọc theo nhóm thuốc, thuốc cạn date, thuốc thiếu hụt, tìm kiếm từ khóa, hỗ trợ xuất Excel và in ấn.

---

### 14. Trợ lý Dược lâm sàng AI Chatbot (Pharmacy AI Assistant)
* **Công nghệ tích hợp:** Sử dụng mô hình **Google Gemini 3.5 Flash** kết hợp NLP Engine quản lý kho dược.
* **Cá nhân hóa theo vai trò người dùng (Contextual RBAC):**
  * *Ban Giám Đốc:* Cung cấp báo cáo điều hành vĩ mô, cảnh báo rủi ro tài chính do thuốc cận date.
  * *Bác sĩ Trưởng khoa:* Giám sát cơ số tủ trực khoa, kiểm tra phiếu lĩnh thuốc chờ duyệt.
  * *Điều dưỡng:* Kiểm tra tồn tủ trực ca trực, phát hiện thuốc sắp hết hạn để trả kho, tra cứu tồn kho chẵn để dự trù.
  * *Dược sĩ:* Truy vết luân chuyển thuốc, quản lý lô, kiểm soát FEFO, kiểm tra định mức tối thiểu.
* **Thẻ giao diện tương tác trực quan (Interactive Data Cards):** Tự động render bảng tồn kho (`stock_table`), danh sách cận date (`expiry_list`), danh sách phiếu lĩnh (`requisition_list`), lịch sử luân chuyển (`movement_history`), tồn tủ trực (`cabinet_table`), báo cáo tóm tắt (`executive_summary`).
* **Quy chuẩn an toàn y tế:** Tự động phát hiện và chặn các câu hỏi yêu cầu kê đơn, chỉ định điều trị y khoa để tuân thủ quy định hành nghề y dược.

---

## ⚡ IV. TÍNH NĂNG NỀN TẢNG BỔ TRỢ (CROSS-CUTTING CONCERNS)

1. **Đồng bộ thời gian thực (Real-time SignalR WebSocket):**
   * Tự động phát tín hiệu và cập nhật dữ liệu tức thì giữa các máy trạm (khi thủ kho duyệt nhập -> màn hình Dashboard và Tồn kho tự reload; khi điều dưỡng xuất tủ trực -> kho lẻ tự cập nhật mà không cần F5).
2. **Ký số điện tử (Digital Signature Pad):**
   * Tích hợp khung vẽ ký tay điện tử trên Canvas HTML5 và mã hóa Base64 lưu trữ trực tiếp vào cơ sở dữ liệu cho mọi biên bản và phiếu giao dịch.
3. **Quản lý giao diện Đa chế độ (Light / Dark Theme):**
   * Tối ưu độ tương phản y tế, hỗ trợ ca trực đêm của nhân viên y tế.
4. **Sidebar thu gọn / mở rộng thông minh (Collapsible Sidebar):**
   * Tối ưu không gian làm việc trên màn hình máy tính bệnh viện.
5. **Bộ dữ liệu mẫu chuẩn hóa & Đăng nhập nhanh (Quick Login):**
   * Tích hợp sẵn danh sách tài khoản demo đại diện cho các khoa phòng và vai trò (Ban Giám Đốc, Thủ kho chẵn, Dược sĩ kho lẻ, Trưởng khoa, Điều dưỡng trưởng, Điều dưỡng ca trực) phục vụ kiểm thử và báo cáo bảo vệ đồ án.

---

## 🌟 V. CÁC TÍNH NĂNG NÂNG CẤP CHUYÊN SÂU & NỀN TẢNG KIỂM TOÁN DƯỢC (TỐI ƯU CHO BÁO CÁO THỰC TẬP TỐT NGHIỆP)

Hệ thống đã được bổ sung và hoàn thiện 6 module nghiệp vụ quan trọng theo đúng các tiêu chuẩn y tế của Bộ Y Tế (Thông tư 20/2017/TT-BYT, Chuẩn HIS bệnh viện hạng I) và các tiêu chí kiến trúc phần mềm nâng cao:

### 1. Cơ Chế Chữ Ký Số Toàn Vẹn Dữ Liệu (Digital Signature Integrity with SHA-256)
* **Vấn đề giải quyết:** Canvas vẽ tay xuất chuỗi Base64 chỉ là file ảnh. Nếu có ai đó can thiệp trực tiếp vào database hoặc sửa API để thay đổi số lượng, chữ ký vẫn còn nguyên và không có giá trị pháp lý.
* **Kiến trúc triển khai:**
  * Khi người dùng ký duyệt phiếu (Phiếu nhập kho, Phiếu xuất cấp phát, Phiếu kiểm kê, Biên bản hư hao), hệ thống tổng hợp chuỗi dữ liệu chuẩn hóa (Canonical Document String) gồm: *Loại chứng từ + Mã phiếu + Danh sách thuốc, số lô, số lượng, đơn giá + Người ký + Thời điểm ký*.
  * Sử dụng thuật toán băm mật mã học **SHA-256** tạo ra mã băm chuẩn `DocumentHash`.
  * Lưu trữ đồng thời cả ảnh chữ ký `SignatureBase64` và mã hash `DocumentHash` vào cơ sở dữ liệu.
  * Khi truy vấn hiển thị phiếu, API backend tự động tính toán lại mã hash theo dữ liệu hiện hành và so sánh với `DocumentHash` đã lưu:
    * Khớp: Hiển thị huy hiệu xanh **"✓ Chứng thư chữ ký số toàn vẹn (SHA-256 Verified)"**.
    * Sai lệch (do dữ liệu trong DB bị chỉnh sửa sau khi ký): Bật cờ cảnh báo đỏ **"⚠ CẢNH BÁO: Dữ liệu đã bị can thiệp sau khi ký duyệt! (Integrity Violation)"**.

### 2. Phân Loại Thuốc & Kiểm Soát Nghiêm Ngặt FEFO (Drug Classification & Strict Control)
* **Vấn đề giải quyết:** Tránh tình trạng đối xử mọi loại thuốc như nhau khi chạy thuật toán FEFO và cấp phát.
* **Kiến trúc triển khai:**
  * Bổ sung trường `DrugClassification` vào bảng thuốc với 3 nhóm chính:
    1. **Thuốc thường (`Regular`)**: Cấp phát và luân chuyển theo quy trình chuẩn.
    2. **Thuốc kháng sinh kiểm soát đặc biệt (`SpecialAntibiotic`)**: Yêu cầu theo dõi chặt chẽ hạn dùng và lô thầu.
    3. **Thuốc hướng thần / gây nghiện (`NarcoticPsychotropic`)**: Tuân thủ quy định Thông tư 20/2017/TT-BYT.
  * **Cơ chế kiểm soát đặc thù cho Thuốc hướng thần / gây nghiện:**
    * Bắt buộc quy trình xác thực kép 2 người (Dược sĩ xuất kho + Điều dưỡng nhận đồng kiểm đối soát từng viên theo số lô và hạn dùng).
    * Cấm tuyệt đối hành động cấp phát bù tự động (`CabinetRefill`) vào tủ trực lâm sàng nếu không có mã và hồ sơ bệnh nhân chỉ định đích danh.

### 3. Cơ Chế Xóa Mềm (Soft Delete) & Khôi Phục Danh Mục Thuốc
* **Vấn đề giải quyết:** Tuyệt đối không được Hard Delete thuốc trong hệ thống HIS bệnh viện vì sẽ làm phá hủy khóa ngoại và dữ liệu giao dịch trong quá khứ.
* **Kiến trúc triển khai:**
  * Thêm thuộc tính `IsDeleted` (boolean) và `DeletedAt` (datetime) vào thực thể `Medicine`.
  * Thiết lập **Global Query Filter** trong EF Core: `modelBuilder.Entity<Medicine>().HasQueryFilter(m => !m.IsDeleted)`. Mọi câu truy vấn thông thường trong toàn hệ thống tự động lọc bỏ các thuốc đã xóa mềm mà không cần sửa từng query.
  * Thao tác "Xóa" thuốc chuyển thành cập nhật `IsDeleted = true` và `DeletedAt = DateTime.Now`.
  * Xây dựng Tab **"Thùng rác danh mục (Xóa mềm)"** trong trang Quản lý thuốc cho phép xem danh sách thuốc đã ẩn và nút **"Khôi phục" (Restore)** để đưa thuốc trở lại hoạt động bình thường.

### 4. Biên Bản Ghi Nhận Hư Hao / Vỡ Hỏng Đột Xuất Tại Tủ Trực (Breakage & Damage Report)
* **Vấn đề giải quyết:** Xử lý các sự cố phát sinh hàng ngày tại khoa lâm sàng (y tá làm rơi vỡ lọ thuốc tiêm, ống dung dịch kết tủa, biến tính do nhiệt độ) mà không phải chờ đến đợt kiểm kê định kỳ cuối tháng.
* **Kiến trúc triển khai:**
  * Cho phép Điều dưỡng lập nhanh phiếu **"Báo cáo Đổ vỡ / Hư hao"** trực tiếp tại màn hình Quản lý tủ trực:
    * Chọn thuốc, số lô hiện có trong tủ, số lượng vỡ hỏng.
    * Phân loại lý do: *Rơi vỡ vật lý, Thuốc kết tủa/đục màu, Hỏng do quá nhiệt độ, Nứt vỡ ống tiêm trong quá trình vận chuyển*.
    * Đính kèm ảnh chụp hiện trường hư hại thực tế (qua tải ảnh hoặc chụp camera).
    * Ký tên điện tử xác nhận của người phát hiện/làm vỡ.
  * Bác sĩ Trưởng khoa / Điều dưỡng trưởng ký duyệt xác nhận bằng chữ ký số Canvas.
  * Hệ thống tự động:
    * Trừ trực tiếp số lượng tồn trong kho tủ trực khoa phòng.
    * Ghi vào sổ giao dịch tủ trực với loại giao dịch `Biên bản vỡ hỏng`.
    * Kết chuyển vào chi phí hao hụt của khoa, không bị tính là thất thoát sai lệch khi kiểm kê cuối kỳ.
    * Băm chuỗi SHA-256 bảo vệ toàn vẹn biên bản hư hao.

### 5. Khóa Sổ Kỳ Dược Cuối Tháng (Monthly Accounting Period Lock)
* **Vấn đề giải quyết:** Nghiệp vụ cốt lõi của khoa Dược bệnh viện; báo cáo Nhập - Xuất - Tồn chỉ có giá trị pháp lý khi số liệu tháng đó đã được "chốt sổ".
* **Kiến trúc triển khai:**
  * Bảng `AccountingPeriods` quản lý trạng thái từng tháng/năm kế toán dược.
  * Phân quyền thực hiện: Chỉ **Ban Giám Đốc** hoặc **Trưởng khoa Dược** mới có nút "Khóa Sổ Kỳ Này".
  * Thao tác khóa sổ kích hoạt:
    * Chốt và lưu trữ vĩnh viễn số lượng tồn cuối kỳ, tổng giá trị tồn kho (VNĐ), tổng giá trị nhập trong kỳ và tổng giá trị hư hao/thanh lý.
    * Kết chuyển số dư tồn cuối kỳ làm số dư đầu kỳ của tháng tiếp theo.
    * Kích hoạt lớp phòng thủ cấp hệ thống qua hàm chặn `EnsurePeriodNotLockedAsync`: Chặn hoàn toàn tất cả các thao tác Thêm, Sửa, Xóa, Phê duyệt hoặc Nhận hàng có ngày giao dịch thuộc tháng đã khóa sổ.
  * Thẩm quyền mở khóa (`Unlock`): Chỉ có tài khoản **Ban Giám Đốc** mới được quyền mở khóa kèm nhật ký giải trình.

### 6. Nhật Ký Kiểm Toán Tự Động Toàn Hệ Thống (System Audit Trail via EF Core Interceptor)
* **Vấn đề giải quyết:** Đáp ứng tiêu chuẩn kiểm toán hệ thống thông tin y tế bệnh viện, ghi nhận tự động mọi biến động dữ liệu nhạy cảm mà không phụ thuộc vào code thủ công tại từng Controller.
* **Kiến trúc triển khai:**
  * Bảng `AuditLogs` với cấu trúc: `Id, TableName, Action (INSERT/UPDATE/DELETE), KeyValues, OldValues, NewValues, ChangedColumns, Username, CreatedAt, IpAddress`.
  * Triển khai `AuditSaveChangesInterceptor` kế thừa `SaveChangesInterceptor` trong EF Core:
    * Tự động bắt giữ trạng thái các thực thể trước và sau khi `SaveChangesAsync()`.
    * Ghi log chi tiết cho các bảng nhạy cảm: `InventoryStocks`, `DepartmentStocks`, `Medicines`, `Batches`, `MedicineRequisitions`, `ImportReceipts`, `BreakageReports`, `AccountingPeriods`.
    * Tự động trích xuất thông tin người dùng thực hiện qua `IHttpContextAccessor`.
  * **Giao diện Tra cứu & So sánh Biến động (Audit Trail UI):**
    * Bộ lọc đa chiều: theo Bảng dữ liệu, Hành động, Tên người dùng, Khoảng thời gian.
    * Công cụ **So Sánh Biến Động (Diff Inspector)**: Hiển thị bảng đối chiếu trực quan từng trường dữ liệu trước (Old Value) và sau (New Value) với mã màu phân biệt rõ ràng.

### 7. Cổng Bệnh Nhân Tra Cứu Hướng Dẫn Sử Dụng & Báo Cáo Tác Dụng Phụ (Patient QR Portal & ADR Reporting System)
* **Vấn đề giải quyết:** Tăng tính xã hội, ứng dụng thực tế và an toàn người bệnh. Bệnh nhân sau khi nhận thuốc ngoại trú thường quên liều, nhầm lẫn viên thuốc hoặc không biết cách liên hệ khi bị dị ứng/tác dụng phụ bất thường (ADR).
* **Kiến trúc triển khai:**
  * **Mã QR định danh trên Toa thuốc A4:**
    * Tích hợp component `QRCodeSVG` trên phiếu xuất cấp phát thuốc ngoại trú (Phân hệ 6).
    * Mã QR mã hóa trực tiếp đường dẫn: `${window.location.origin}/?portal=1&code=${prescriptionCode}`.
  * **Trang Tra cứu Công khai (Public Landing Page):**
    * Không yêu cầu đăng nhập tài khoản bệnh viện, tải cực nhanh và tối ưu 100% cho màn hình di động/smartphone khi quét camera.
    * Cơ chế che tên bảo mật quyền riêng tư y tế (`Lê M*** Tuấn`) với nút bật/tắt hiển thị tên đầy đủ.
    * **Lịch uống thuốc 4 buổi trực quan:** Phân bổ chi tiết số lượng uống theo Sáng ☀️ / Trưa 🌤️ / Chiều ⛅ / Tối 🌙 và chỉ dẫn thời điểm (trước ăn 30p, sau ăn no).
    * **Nhận diện viên thuốc (Pill Visual Identifier):** Thẻ nhận dạng từng loại thuốc gồm hình dạng (viên nang con nhộng, viên nén bao phim, gói bột), màu sắc (trắng ngà, tím hồng, đỏ vàng), phân nhóm và lưu ý an toàn.
    * **Khuyến cáo kiêng khem tương tác thuốc:** Nhắc nhở bệnh nhân tránh dùng chung với nước trà đậm, cà phê, sữa, nước ép bưởi chùm, rượu bia và duy trì uống đủ nước lọc.
    * **Tổng đài khẩn cấp:** Cung cấp thông tin hotline Quầy Dược và cấp cứu 115 khi gặp phản ứng nặng.
  * **Biểu mẫu Báo cáo Tác dụng phụ (ADR Form) & Đồng bộ thời gian thực:**
    * Bệnh nhân chọn thuốc nghi ngờ, tick chọn nhanh triệu chứng (Nổi mề đay, khó thở, buồn nôn, đau bụng, chóng mặt...) và mức độ phản ứng.
    * Gửi phản ánh trực tiếp về cơ sở dữ liệu bệnh viện (`PatientAdrReports`) và phát tín hiệu SignalR thời gian thực `ReceiveAdrNotification` đến các trạm Dược sĩ đang trực.
    * **Phân hệ Quầy Dược Ngoại Trú (Tab 4):** Dược sĩ lâm sàng nhận thông báo tức thời, xem chi tiết phản ánh, gọi điện tư vấn và ghi nhận hướng dẫn xử lý chuyên môn.

