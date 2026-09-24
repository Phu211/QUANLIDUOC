# HIS - PHARMACY MANAGEMENT SYSTEM
## Phân Hệ Quản Lý Dược Bệnh Viện Đa Khoa

Dự án Hệ thống Quản lý Dược Bệnh viện (HIS - Pharmacy) là giải pháp quản lý toàn diện luân chuyển thuốc và vật tư y tế trong bệnh viện từ Kho chẵn chính (Main Store), Kho lẻ/Quầy dược ngoại trú (Dispensary) đến Tủ trực cấp cứu tại các Khoa lâm sàng (Cabinet).

---

## 🛠️ Ngăn xếp Công nghệ (Tech Stack)
* **Backend:** ASP.NET Core Web API, Entity Framework Core, SQL Server Express, Microsoft SignalR.
* **Frontend:** React, Vite, Lucide Icons, Vanilla CSS (Dark/Light mode).
* **AI & Xử lý thông minh:** Google Gemini 3.5 Flash Multimodal (OCR Hóa đơn & Trợ lý ảo Chatbot), Thuật toán FEFO, ADC, DaysOfSupply.

---

## 🚀 Hướng dẫn Chạy Dự án

### 1. Khởi chạy Backend (.NET API)
```bash
cd backend/HisPharmacy.Api
dotnet run
```
* API Server sẽ chạy tại: `http://localhost:5000` (hoặc cổng cấu hình trong `launchSettings.json`).
* SignalR Hub: `/pharmacyHub`.

### 2. Khởi chạy Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
* Ứng dụng Web sẽ chạy tại: `http://localhost:5173`.
