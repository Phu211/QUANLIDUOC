using HisPharmacy.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HisPharmacy.Api.Services;

public static class AccountingPeriodHelper
{
    public static async Task<bool> IsPeriodLockedAsync(HisDbContext context, DateTime date)
    {
        return await context.AccountingPeriods
            .AnyAsync(p => p.PeriodMonth == date.Month && p.PeriodYear == date.Year && p.IsLocked);
    }

    public static async Task EnsurePeriodNotLockedAsync(HisDbContext context, DateTime date)
    {
        var isLocked = await IsPeriodLockedAsync(context, date);
        if (isLocked)
        {
            throw new InvalidOperationException($"Kỳ dược tháng {date.Month}/{date.Year} đã được Ban Giám Đốc khóa sổ kế toán. Hệ thống chặn mọi thao tác Thêm/Sửa/Xóa/Duyệt giao dịch thuộc kỳ này.");
        }
    }
}
