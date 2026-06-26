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
