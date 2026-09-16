using Azure;
using Azure.AI.DocumentIntelligence;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
using IncomeMeter.Api.Models;
using Microsoft.Extensions.Options;

namespace IncomeMeter.Api.Services;

public class OcrSettings
{
    public bool Enabled { get; set; }
    /// <summary>Azure AI Document Intelligence endpoint, e.g. https://my-resource.cognitiveservices.azure.com/</summary>
    public string? Endpoint { get; set; }
    public string? ApiKey { get; set; }
    public string ModelId { get; set; } = "prebuilt-receipt";
    /// <summary>Only fields at or above this confidence are returned.</summary>
    public float MinConfidence { get; set; } = 0.5f;
}

public interface IReceiptOcrService
{
    bool IsEnabled { get; }
    /// <summary>Extract merchant / date / total from a receipt image or PDF. Returns null when nothing usable was found.</summary>
    Task<AttachmentOcr?> AnalyseAsync(Stream content, string contentType, CancellationToken ct = default);
}

/// <summary>Used when OCR is not configured – uploads work exactly as before, just without pre-filled fields.</summary>
public class NoOpReceiptOcrService : IReceiptOcrService
{
    public bool IsEnabled => false;
    public Task<AttachmentOcr?> AnalyseAsync(Stream content, string contentType, CancellationToken ct = default) =>
        Task.FromResult<AttachmentOcr?>(null);
}

/// <summary>Azure AI Document Intelligence "prebuilt-receipt" model.</summary>
public class AzureReceiptOcrService : IReceiptOcrService
{
    private static readonly HashSet<string> Supported = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/bmp", "image/tiff", "image/heif", "image/heic", "image/webp", "application/pdf"
    };

    private readonly DocumentIntelligenceClient _client;
    private readonly OcrSettings _settings;
    private readonly ILogger<AzureReceiptOcrService> _logger;

    public AzureReceiptOcrService(IOptions<OcrSettings> settings, ILogger<AzureReceiptOcrService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
        if (string.IsNullOrWhiteSpace(_settings.Endpoint) || string.IsNullOrWhiteSpace(_settings.ApiKey))
            throw new InvalidOperationException("Ocr:Endpoint and Ocr:ApiKey are required when Ocr:Enabled is true");
        _client = new DocumentIntelligenceClient(new Uri(_settings.Endpoint), new AzureKeyCredential(_settings.ApiKey));
    }

    public bool IsEnabled => true;

    // Document Intelligence F0 rejects files over 4 MB, and receipts read fine at ~2000px. Shrinking also
    // cuts upload time and the per-page cost. PDFs and undecodable formats are sent as-is.
    private const long MaxDirectBytes = 3 * 1024 * 1024;
    private const int MaxSide = 2000;

    private static async Task<BinaryData> PrepareForOcrAsync(Stream content, string contentType, CancellationToken ct)
    {
        var length = content.CanSeek ? content.Length : long.MaxValue;
        if (!contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return await BinaryData.FromStreamAsync(content, ct);
        try
        {
            using var image = await Image.LoadAsync(content, ct);
            var tooBig = length > MaxDirectBytes || image.Width > MaxSide || image.Height > MaxSide;
            if (!tooBig && image.Metadata.ExifProfile == null)
            {
                if (content.CanSeek) content.Position = 0;
                return await BinaryData.FromStreamAsync(content, ct);
            }
            image.Mutate(x => x.AutoOrient().Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(MaxSide, MaxSide) }));
            await using var ms = new MemoryStream();
            await image.SaveAsync(ms, new JpegEncoder { Quality = 82 }, ct);
            return BinaryData.FromBytes(ms.ToArray());
        }
        catch
        {
            if (content.CanSeek) content.Position = 0;
            return await BinaryData.FromStreamAsync(content, ct);
        }
    }

    public async Task<AttachmentOcr?> AnalyseAsync(Stream content, string contentType, CancellationToken ct = default)
    {
        if (!Supported.Contains(contentType)) return null;

        var pos = content.CanSeek ? content.Position : 0;
        try
        {
            if (content.CanSeek) content.Position = 0;
            var payload = await PrepareForOcrAsync(content, contentType, ct);
            var options = new AnalyzeDocumentOptions(_settings.ModelId, payload);
            var operation = await _client.AnalyzeDocumentAsync(WaitUntil.Completed, options, ct);
            var analysis = operation.Value;

            // Regex pass over the raw text first: it understands UK dd/MM dates, litres, £/litre and the
            // dashboard trip screen, none of which the receipt model returns as fields.
            var result = ReceiptTextParser.Parse(analysis.Content)
                         ?? new AttachmentOcr { RawText = analysis.Content is { Length: > 8000 } c ? c[..8000] : analysis.Content };
            float best = result.Confidence;
            _logger.LogInformation("OCR parsed kind={Kind} date={Date} total={Total} litres={Litres} odometer={Odometer} textLength={Len}",
                result.Kind ?? "unknown", result.Date, result.Total, result.Litres, result.OdometerMiles, analysis.Content?.Length ?? 0);

            var doc = analysis.Documents.FirstOrDefault();
            if (doc == null || result.Kind == ReceiptTextParser.KindDashboard)
                return result.Kind == null ? null : result;

            if (doc.Fields.TryGetValue("MerchantName", out var merchant) && merchant.Confidence >= _settings.MinConfidence && merchant.FieldType == DocumentFieldType.String)
            {
                result.Merchant = merchant.ValueString;
                best = Math.Max(best, merchant.Confidence ?? 0);
            }
            // Only fall back to the model's date when the receipt text had no dd/MM/yyyy HH:mm line.
            if (result.Date == null && doc.Fields.TryGetValue("TransactionDate", out var date) && date.Confidence >= _settings.MinConfidence && date.FieldType == DocumentFieldType.Date && date.ValueDate.HasValue)
            {
                var d = date.ValueDate.Value;
                if (doc.Fields.TryGetValue("TransactionTime", out var time) && time.FieldType == DocumentFieldType.Time && time.ValueTime.HasValue)
                    d = d.Date + time.ValueTime.Value;
                result.Date = DateTime.SpecifyKind(d.DateTime, DateTimeKind.Unspecified);
                best = Math.Max(best, date.Confidence ?? 0);
            }
            if (result.Total == null && doc.Fields.TryGetValue("Total", out var total) && total.Confidence >= _settings.MinConfidence && total.FieldType == DocumentFieldType.Currency && total.ValueCurrency != null)
            {
                result.Total = (decimal)total.ValueCurrency.Amount;
                result.Currency = total.ValueCurrency.CurrencyCode;
                best = Math.Max(best, total.Confidence ?? 0);
            }
            result.Confidence = best;
            result.Kind ??= ReceiptTextParser.KindReceipt;

            // Return even an empty result when there is text, so the client can show what the OCR saw.
            return result.Merchant == null && result.Date == null && result.Total == null && result.Litres == null && string.IsNullOrWhiteSpace(result.RawText) ? null : result;
        }
        catch (Exception ex)
        {
            // OCR is best-effort: never fail an upload because of it.
            _logger.LogWarning(ex, "Receipt OCR failed");
            return null;
        }
        finally
        {
            if (content.CanSeek) content.Position = pos;
        }
    }
}
