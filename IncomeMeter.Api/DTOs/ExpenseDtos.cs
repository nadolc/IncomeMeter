using System.ComponentModel.DataAnnotations;

namespace IncomeMeter.Api.DTOs;

// ---------- Attachments ----------

public class AttachmentUploadResultDto
{
    public string? AttachmentId { get; set; }
    public string FileName { get; set; } = null!;
    public string? ContentType { get; set; }
    public long SizeBytes { get; set; }
    public string? Sha256 { get; set; }
    public DateTime? TakenAt { get; set; }
    /// <summary>"exif" | "filename" | null</summary>
    public string? DateSource { get; set; }
    /// <summary>True if a file with the same hash was already uploaded by this user. AttachmentId then points at the existing one.</summary>
    public bool IsDuplicate { get; set; }
    public string? Error { get; set; }
    /// <summary>Merchant / date / total read from the receipt when OCR is enabled.</summary>
    public AttachmentOcrDto? Ocr { get; set; }
}

public class AttachmentOcrDto
{
    public string? Merchant { get; set; }
    public DateTime? Date { get; set; }
    public decimal? Total { get; set; }
    public string? Currency { get; set; }
    public float Confidence { get; set; }
}

public class AttachmentDto
{
    public string Id { get; set; } = null!;
    public string FileName { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public long SizeBytes { get; set; }
    public DateTime? TakenAt { get; set; }
    public string? DateSource { get; set; }
    public DateTime UploadedAt { get; set; }
}

// ---------- Expenses ----------

public class FuelDetailsDto
{
    [Range(0, 10000)]
    public double? Litres { get; set; }
    [Range(0, 10_000_000)]
    public double? OdometerMiles { get; set; }
}

public class CreateExpenseDto
{
    public string? VehicleId { get; set; }

    [Required]
    public string Category { get; set; } = null!;

    [Required]
    public DateTime Date { get; set; }

    [Range(0, 1_000_000)]
    public decimal Amount { get; set; }

    public string Currency { get; set; } = "GBP";
    public string? Merchant { get; set; }
    public string? Notes { get; set; }
    public FuelDetailsDto? Fuel { get; set; }
    public List<string> AttachmentIds { get; set; } = new();
    public bool IsFullyBusiness { get; set; }

    /// <summary>"exif" | "filename" | "manual"</summary>
    public string DateSource { get; set; } = "manual";
}

public class UpdateExpenseDto
{
    public string? VehicleId { get; set; }
    public string? Category { get; set; }
    public DateTime? Date { get; set; }
    [Range(0, 1_000_000)]
    public decimal? Amount { get; set; }
    public string? Currency { get; set; }
    public string? Merchant { get; set; }
    public string? Notes { get; set; }
    public FuelDetailsDto? Fuel { get; set; }
    public List<string>? AttachmentIds { get; set; }
    public bool? IsFullyBusiness { get; set; }
    public string? Status { get; set; }
    public string? DateSource { get; set; }
}

// ---------- Odometer ----------

public class CreateOdometerReadingDto
{
    public string? VehicleId { get; set; }

    [Required]
    public DateTime Date { get; set; }

    [Range(0, 10_000_000)]
    public double Miles { get; set; }

    /// <summary>"fuelStop" | "taxYearStart" | "taxYearEnd" | "manual"</summary>
    public string Source { get; set; } = "manual";
    public string? PhotoAttachmentId { get; set; }
    public string DateSource { get; set; } = "manual";
    public string? Notes { get; set; }
}

// ---------- Batch import ----------

/// <summary>
/// One row of the bulk-receipt review screen. Each row becomes either an Expense or an OdometerReading.
/// </summary>
public class BatchImportItemDto
{
    /// <summary>"expense" | "odometer"</summary>
    [Required]
    public string Kind { get; set; } = "expense";

    public CreateExpenseDto? Expense { get; set; }
    public CreateOdometerReadingDto? Odometer { get; set; }
}

public class BatchImportRequestDto
{
    [Required]
    [MinLength(1)]
    public List<BatchImportItemDto> Items { get; set; } = new();
}

public class BatchImportResultDto
{
    public int Created { get; set; }
    public int Failed { get; set; }
    public List<BatchImportItemResultDto> Results { get; set; } = new();
}

public class BatchImportItemResultDto
{
    public int Index { get; set; }
    public string Kind { get; set; } = null!;
    public string? Id { get; set; }
    public string? Error { get; set; }
}
