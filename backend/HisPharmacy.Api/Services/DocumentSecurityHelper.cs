using System.Security.Cryptography;
using System.Text;
using HisPharmacy.Api.Data;

namespace HisPharmacy.Api.Services;

public static class DocumentSecurityHelper
{
    public static string ComputeSha256(string rawData)
    {
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(rawData);
        var hashBytes = sha256.ComputeHash(bytes);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }

    public static string BuildCanonicalString(ImportReceipt receipt)
    {
        var sb = new StringBuilder();
        sb.Append($"IMPORT|{receipt.ImportID}|{receipt.ImportCode?.Trim()}|{receipt.SupplierID}|{receipt.InvoiceNumber?.Trim()}|{receipt.ImportDate:yyyy-MM-ddTHH:mm:ss}|");
        if (receipt.Details != null && receipt.Details.Any())
        {
            var orderedDetails = receipt.Details.OrderBy(d => d.BatchID).ToList();
            sb.Append(string.Join(";", orderedDetails.Select(d => $"{d.BatchID}:{d.Quantity}:{d.ActualImportPrice ?? d.ContractPrice ?? 0:F2}")));
        }
        sb.Append($"|{receipt.ApproverName ?? receipt.CreatedBy ?? "Unknown"}");
        return sb.ToString();
    }

    public static string BuildCanonicalString(MedicineRequisition req)
    {
        var sb = new StringBuilder();
        sb.Append($"REQ|{req.RequisitionID}|{req.DepartmentID}|{req.RequisitionType?.Trim()}|{req.RequisitionDate:yyyy-MM-ddTHH:mm:ss}|");
        if (req.Details != null && req.Details.Any())
        {
            var orderedDetails = req.Details.OrderBy(d => d.MedicineID).ToList();
            sb.Append(string.Join(";", orderedDetails.Select(d => $"{d.MedicineID}:{d.RequestedQuantity}:{d.DispensedQuantity ?? 0}")));
        }
        sb.Append($"|{req.ApproverName ?? req.ProposerName ?? "Unknown"}");
        return sb.ToString();
    }

    public static string BuildCanonicalString(InventoryAudit audit)
    {
        var sb = new StringBuilder();
        sb.Append($"AUDIT|{audit.AuditID}|{audit.AuditCode?.Trim()}|{audit.LocationType?.Trim()}|{audit.DepartmentID}|{audit.AuditDate:yyyy-MM-ddTHH:mm:ss}|");
        if (audit.Details != null && audit.Details.Any())
        {
            var orderedDetails = audit.Details.OrderBy(d => d.BatchID).ToList();
            sb.Append(string.Join(";", orderedDetails.Select(d => $"{d.BatchID}:{d.SystemQuantity}:{d.ActualQuantity}:{d.Discrepancy}")));
        }
        sb.Append($"|{audit.DirectorSignedBy ?? audit.CheckerSignedBy ?? audit.CreatedBy ?? "Unknown"}");
        return sb.ToString();
    }

    public static string BuildCanonicalString(BreakageReport report)
    {
        var sb = new StringBuilder();
        sb.Append($"BREAKAGE|{report.ReportID}|{report.ReportCode?.Trim()}|{report.DepartmentID}|{report.ReportDate:yyyy-MM-ddTHH:mm:ss}|");
        if (report.Details != null && report.Details.Any())
        {
            var orderedDetails = report.Details.OrderBy(d => d.BatchID).ToList();
            sb.Append(string.Join(";", orderedDetails.Select(d => $"{d.BatchID}:{d.DamagedQuantity}:{d.TotalLossAmount:F2}")));
        }
        sb.Append($"|{report.ApproverName ?? report.ReportedBy ?? "Unknown"}");
        return sb.ToString();
    }

    public static bool VerifyIntegrity(string? storedHash, string currentCanonicalData)
    {
        if (string.IsNullOrWhiteSpace(storedHash)) return false;
        var computed = ComputeSha256(currentCanonicalData);
        return string.Equals(storedHash.Trim(), computed.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
