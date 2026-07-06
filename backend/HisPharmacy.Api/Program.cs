using HisPharmacy.Api.Data;
using HisPharmacy.Api.Hubs;
using HisPharmacy.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

// Add API Controllers and JSON serializers with global no-cache filter to prevent stale browser caches
builder.Services.AddControllers(options =>
{
    options.Filters.Add(new Microsoft.AspNetCore.Mvc.ResponseCacheAttribute
    {
        NoStore = true,
        Location = Microsoft.AspNetCore.Mvc.ResponseCacheLocation.None
    });
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

// Configure EF Core DbContext to connect to SQL Server Express
builder.Services.AddDbContext<HisDbContext>(options =>
    options.UseSqlServer("Server=.\\SQLEXPRESS;Database=HisPharmacyDB;Trusted_Connection=True;TrustServerCertificate=True;"));

// Add SignalR Support for Real-Time Synchronization
builder.Services.AddSignalR();

// Dependecy Injection registrations
builder.Services.AddScoped<StockService>();
builder.Services.AddScoped<CabinetService>();

// Register Expiry Scanning Background Job
builder.Services.AddHostedService<ExpiryScannerJob>();

// CORS Setup Policy for Vite Frontend
builder.Services.AddCors(options => {
    options.AddPolicy("AllowFrontend", policy => {
        policy.WithOrigins("http://localhost:5173") // Vite Standard URL
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR WebSockets over CORS
    });
});

var app = builder.Build();

// Run database schema updates on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HisDbContext>();
    try
    {
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('MedicineRequisitions') AND name = 'ProposerName') ALTER TABLE MedicineRequisitions ADD ProposerName NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('MedicineRequisitions') AND name = 'ApproverName') ALTER TABLE MedicineRequisitions ADD ApproverName NVARCHAR(250) NULL;");
        
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RecallLogs') AND name = 'Status') ALTER TABLE RecallLogs ADD Status NVARCHAR(50) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RecallLogs') AND name = 'ApprovedBy') ALTER TABLE RecallLogs ADD ApprovedBy NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('RecallLogs') AND name = 'ApproverSignature') ALTER TABLE RecallLogs ADD ApproverSignature NVARCHAR(MAX) NULL;");
        db.Database.ExecuteSqlRaw("UPDATE RecallLogs SET Status = 'Approved' WHERE Status IS NULL;");
        
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ReturnReceipts') AND name = 'ApproverName') ALTER TABLE ReturnReceipts ADD ApproverName NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ReturnReceipts') AND name = 'ProposerName') ALTER TABLE ReturnReceipts ADD ProposerName NVARCHAR(250) NULL;");
        db.Database.ExecuteSqlRaw("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('ImportReceipts') AND name = 'DeliveryPersonName') ALTER TABLE ImportReceipts ADD DeliveryPersonName NVARCHAR(250) NULL;");
        
        // Data patches for historical return receipts
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ProposerName = N'Điều dưỡng trưởng Trần Trung Nam' WHERE DepartmentID = 1 AND (ProposerName IS NULL OR ProposerName = N'ĐDT. Tạ Thị Hồng');");
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ProposerName = N'Điều dưỡng trưởng Trần Vỹ Khang' WHERE DepartmentID = 2 AND (ProposerName IS NULL OR ProposerName = N'ĐDT. Phan Thị Cẩm Tú');");
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ProposerName = N'Điều dưỡng trưởng Trần Thanh Phương' WHERE DepartmentID = 3 AND (ProposerName IS NULL OR ProposerName = N'ĐDT. Nguyễn Thị Mai');");
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ProposerName = N'Điều dưỡng trưởng Nguyễn Trần Gia Khang' WHERE DepartmentID = 4 AND (ProposerName IS NULL OR ProposerName = N'ĐDT. Lê Thị Ngọc');");
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ProposerName = N'Điều dưỡng trưởng Nguyễn Thái Bình Dương' WHERE DepartmentID = 5 AND (ProposerName IS NULL OR ProposerName = N'ĐDT. Phạm Hoàng Yến');");
        db.Database.ExecuteSqlRaw("UPDATE ReturnReceipts SET ApproverName = N'DS. Hà Lâm Đình Phú' WHERE ApproverSignature IS NOT NULL AND ApproverName IS NULL;");
    }
    catch (Exception ex)
    {
        Console.WriteLine("Error verifying/adding columns: " + ex.Message);
    }
}

app.UseCors("AllowFrontend");

// In development/production, serve endpoints without requiring HTTPS redirect locally for easier integration
app.UseAuthorization();
app.MapControllers();

// Map real-time pharmacy SignalR Hub
app.MapHub<PharmacyHub>("/pharmacyHub");

if (app.Environment.IsDevelopment())
{
    var frontendPath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "..", "frontend"));
    if (Directory.Exists(frontendPath))
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = "/c npm run dev",
                WorkingDirectory = frontendPath,
                UseShellExecute = true,
                CreateNoWindow = false
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Vite Automatic Startup] Failed: {ex.Message}");
        }
    }
}

app.Run();
