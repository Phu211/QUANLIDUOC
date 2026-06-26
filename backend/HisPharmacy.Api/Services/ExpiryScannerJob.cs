using HisPharmacy.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Services;

public class ExpiryScannerJob : BackgroundService
{
    private readonly IServiceProvider _services;

    public ExpiryScannerJob(IServiceProvider services)
    {
        _services = services;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using (var scope = _services.CreateScope())
                {
                    var context = scope.ServiceProvider.GetRequiredService<HisDbContext>();
                    var today = DateTime.Today;

                    // Scan Main Store (InventoryStocks) for expired items
                    var expiredMainStocks = await context.InventoryStocks
                        .Include(s => s.Batch)
                        .Where(s => s.Batch!.ExpiryDate <= today && s.CurrentQuantity > 0)
                        .ToListAsync(stoppingToken);

                    // Scan Department Cabinets (DepartmentStocks) for expired items
                    var expiredDeptStocks = await context.DepartmentStocks
                        .Include(s => s.Batch)
                        .Where(s => s.Batch!.ExpiryDate <= today && s.CurrentQuantity > 0)
                        .ToListAsync(stoppingToken);

                    if (expiredMainStocks.Any() || expiredDeptStocks.Any())
                    {
                        var liqReceipt = new LiquidationReceipt
                        {
                            Reason = "Hệ thống tự động gom hàng hết hạn từ tác vụ quét định kỳ",
                            LiquidationDate = DateTime.Now
                        };
                        context.LiquidationReceipts.Add(liqReceipt);

                        foreach (var item in expiredMainStocks)
                        {
                            liqReceipt.Details.Add(new LiquidationReceiptDetail
                            {
                                BatchID = item.BatchID,
                                Quantity = item.CurrentQuantity
                            });
                            item.CurrentQuantity = 0; // Freeze main store stock
                        }

                        foreach (var item in expiredDeptStocks)
                        {
                            liqReceipt.Details.Add(new LiquidationReceiptDetail
                            {
                                BatchID = item.BatchID,
                                Quantity = item.CurrentQuantity
                            });
                            item.CurrentQuantity = 0; // Freeze cabinet stock
                        }

                        await context.SaveChangesAsync(stoppingToken);
                    }
                }
            }
            catch (Exception ex)
            {
                // In production, log this exception
                Console.WriteLine($"Error scanning expired items: {ex.Message}");
            }

            // Runs once every 24 hours
            await Task.Delay(TimeSpan.FromDays(1), stoppingToken);
        }
    }
}
