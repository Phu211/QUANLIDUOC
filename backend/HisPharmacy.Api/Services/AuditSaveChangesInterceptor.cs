using System.Text.Json;
using HisPharmacy.Api.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace HisPharmacy.Api.Services;

public class AuditSaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private static readonly HashSet<string> SensitiveTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "InventoryStocks",
        "DepartmentStocks",
        "MedicineRequisitions",
        "MedicineRequisitionDetails",
        "ImportReceipts",
        "ImportReceiptDetails",
        "Medicines",
        "Batches",
        "BreakageReports",
        "BreakageReportDetails",
        "AccountingPeriods",
        "InternalTransfers"
    };

    public AuditSaveChangesInterceptor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is null)
            return await base.SavingChangesAsync(eventData, result, cancellationToken);

        var auditEntries = OnBeforeSaveChanges(eventData.Context);
        if (auditEntries.Any())
        {
            // Add audit logs to current context
            var auditDbSet = eventData.Context.Set<AuditLog>();
            foreach (var entry in auditEntries)
            {
                auditDbSet.Add(entry.ToAuditLog());
            }
        }

        return await base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private List<AuditEntry> OnBeforeSaveChanges(DbContext context)
    {
        context.ChangeTracker.DetectChanges();
        var auditEntries = new List<AuditEntry>();

        var httpContext = _httpContextAccessor.HttpContext;
        var username = httpContext?.Request.Headers["X-User-FullName"].ToString();
        if (string.IsNullOrEmpty(username))
        {
            username = httpContext?.User?.Identity?.Name ?? "Hệ thống";
        }
        else
        {
            username = System.Net.WebUtility.UrlDecode(username);
        }

        var role = httpContext?.Request.Headers["X-User-Role"].ToString() ?? "System";
        var ip = httpContext?.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.Entity is AuditLog || entry.State == EntityState.Detached || entry.State == EntityState.Unchanged)
                continue;

            var tableName = entry.Metadata.GetTableName() ?? entry.Metadata.ClrType.Name;
            if (!SensitiveTables.Contains(tableName))
                continue;

            var auditEntry = new AuditEntry(entry)
            {
                TableName = tableName,
                Username = username,
                UserRole = role,
                IPAddress = ip
            };

            foreach (var property in entry.Properties)
            {
                string propertyName = property.Metadata.Name;

                // Skip temporary generated keys or binary/large base64 blobs
                if (property.Metadata.ClrType == typeof(byte[]) || 
                    propertyName.EndsWith("Signature") || 
                    propertyName.EndsWith("DocumentsJson") || 
                    propertyName.EndsWith("DamageImage"))
                {
                    continue;
                }

                if (property.Metadata.IsPrimaryKey())
                {
                    auditEntry.KeyValues[propertyName] = property.CurrentValue ?? 0;
                    continue;
                }

                switch (entry.State)
                {
                    case EntityState.Added:
                        auditEntry.Action = "INSERT";
                        auditEntry.NewValues[propertyName] = property.CurrentValue ?? "";
                        break;

                    case EntityState.Deleted:
                        auditEntry.Action = "DELETE";
                        auditEntry.OldValues[propertyName] = property.OriginalValue ?? "";
                        break;

                    case EntityState.Modified:
                        if (property.IsModified)
                        {
                            auditEntry.Action = "UPDATE";
                            auditEntry.ChangedColumns.Add(propertyName);
                            auditEntry.OldValues[propertyName] = property.OriginalValue ?? "";
                            auditEntry.NewValues[propertyName] = property.CurrentValue ?? "";
                        }
                        break;
                }
            }

            if (!string.IsNullOrEmpty(auditEntry.Action))
            {
                auditEntries.Add(auditEntry);
            }
        }

        return auditEntries;
    }
}

public class AuditEntry
{
    public AuditEntry(EntityEntry entry)
    {
        Entry = entry;
    }

    public EntityEntry Entry { get; }
    public string TableName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string UserRole { get; set; } = string.Empty;
    public string IPAddress { get; set; } = string.Empty;
    public Dictionary<string, object> KeyValues { get; } = new();
    public Dictionary<string, object> OldValues { get; } = new();
    public Dictionary<string, object> NewValues { get; } = new();
    public List<string> ChangedColumns { get; } = new();

    public AuditLog ToAuditLog()
    {
        var oldJson = OldValues.Count > 0 ? JsonSerializer.Serialize(OldValues) : null;
        var newJson = NewValues.Count > 0 ? JsonSerializer.Serialize(NewValues) : null;
        return new AuditLog
        {
            TableName = TableName,
            EntityName = string.IsNullOrEmpty(TableName) ? "System" : TableName,
            Action = Action,
            KeyValues = KeyValues.Count > 0 ? JsonSerializer.Serialize(KeyValues) : null,
            OldValues = oldJson,
            BeforeData = oldJson,
            NewValues = newJson,
            AfterData = newJson,
            ChangedColumns = ChangedColumns.Count > 0 ? string.Join(", ", ChangedColumns) : null,
            Username = Username,
            UserRole = UserRole,
            IPAddress = IPAddress,
            CreatedAt = DateTime.Now
        };
    }
}
