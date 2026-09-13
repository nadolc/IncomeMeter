using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using MongoDB.Driver;

namespace IncomeMeter.Api.Services;

public class ExpenseService : IExpenseService
{
    private static readonly string[] OdometerSources = { "fuelStop", "taxYearStart", "taxYearEnd", "manual" };
    private static readonly string[] DateSources = { "exif", "filename", "manual" };

    private readonly IMongoCollection<Expense> _expenses;
    private readonly IMongoCollection<OdometerReading> _odometer;
    private readonly IAttachmentService _attachments;
    private readonly ILogger<ExpenseService> _logger;

    public ExpenseService(MongoDbContext context, IAttachmentService attachments, ILogger<ExpenseService> logger)
    {
        _expenses = context.Expenses;
        _odometer = context.OdometerReadings;
        _attachments = attachments;
        _logger = logger;
    }

    // ---------- Expenses ----------

    public async Task<List<Expense>> GetExpensesAsync(string userId, DateTime? from = null, DateTime? to = null, string? category = null)
    {
        var fb = Builders<Expense>.Filter;
        var filter = fb.Eq(e => e.UserId, userId);
        if (from.HasValue) filter &= fb.Gte(e => e.Date, from.Value);
        if (to.HasValue) filter &= fb.Lte(e => e.Date, to.Value);
        if (!string.IsNullOrWhiteSpace(category)) filter &= fb.Eq(e => e.Category, category);

        return await _expenses.Find(filter).SortByDescending(e => e.Date).ToListAsync();
    }

    public async Task<Expense?> GetExpenseByIdAsync(string id, string userId) =>
        await _expenses.Find(e => e.Id == id && e.UserId == userId).FirstOrDefaultAsync();

    public async Task<Expense> CreateExpenseAsync(CreateExpenseDto dto, string userId)
    {
        var expense = await BuildExpenseAsync(dto, userId);
        await _expenses.InsertOneAsync(expense);
        return expense;
    }

    public async Task<Expense?> UpdateExpenseAsync(string id, UpdateExpenseDto dto, string userId)
    {
        var existing = await GetExpenseByIdAsync(id, userId);
        if (existing == null) return null;

        if (dto.Category != null)
        {
            if (!ExpenseCategories.IsValid(dto.Category)) throw new ArgumentException($"Invalid category: {dto.Category}");
            existing.Category = dto.Category;
        }
        if (dto.Date.HasValue) existing.Date = dto.Date.Value;
        if (dto.Amount.HasValue) existing.Amount = dto.Amount.Value;
        if (dto.Currency != null) existing.Currency = dto.Currency;
        if (dto.Merchant != null) existing.Merchant = dto.Merchant;
        if (dto.Notes != null) existing.Notes = dto.Notes;
        if (dto.VehicleId != null) existing.VehicleId = dto.VehicleId;
        if (dto.IsFullyBusiness.HasValue) existing.IsFullyBusiness = dto.IsFullyBusiness.Value;
        if (dto.Fuel != null) existing.Fuel = new FuelDetails { Litres = dto.Fuel.Litres, OdometerMiles = dto.Fuel.OdometerMiles };
        if (dto.Status != null)
        {
            if (dto.Status != ExpenseStatus.Draft && dto.Status != ExpenseStatus.Confirmed) throw new ArgumentException($"Invalid status: {dto.Status}");
            existing.Status = dto.Status;
        }
        if (dto.DateSource != null)
        {
            if (!DateSources.Contains(dto.DateSource)) throw new ArgumentException($"Invalid dateSource: {dto.DateSource}");
            existing.DateSource = dto.DateSource;
        }
        if (dto.AttachmentIds != null)
        {
            await EnsureAttachmentsOwnedAsync(dto.AttachmentIds, userId);
            existing.AttachmentIds = dto.AttachmentIds.Distinct().ToList();
        }
        existing.UpdatedAt = DateTime.UtcNow;

        await _expenses.ReplaceOneAsync(e => e.Id == id && e.UserId == userId, existing);
        return existing;
    }

    public async Task<bool> DeleteExpenseAsync(string id, string userId)
    {
        var result = await _expenses.DeleteOneAsync(e => e.Id == id && e.UserId == userId);
        return result.DeletedCount > 0;
    }

    // ---------- Odometer ----------

    public async Task<List<OdometerReading>> GetOdometerReadingsAsync(string userId, DateTime? from = null, DateTime? to = null)
    {
        var fb = Builders<OdometerReading>.Filter;
        var filter = fb.Eq(o => o.UserId, userId);
        if (from.HasValue) filter &= fb.Gte(o => o.Date, from.Value);
        if (to.HasValue) filter &= fb.Lte(o => o.Date, to.Value);
        return await _odometer.Find(filter).SortByDescending(o => o.Date).ToListAsync();
    }

    public async Task<OdometerReading> CreateOdometerReadingAsync(CreateOdometerReadingDto dto, string userId)
    {
        var reading = await BuildOdometerAsync(dto, userId);
        await _odometer.InsertOneAsync(reading);
        return reading;
    }

    public async Task<bool> DeleteOdometerReadingAsync(string id, string userId)
    {
        var result = await _odometer.DeleteOneAsync(o => o.Id == id && o.UserId == userId);
        return result.DeletedCount > 0;
    }

    // ---------- Batch import ----------

    public async Task<BatchImportResultDto> BatchImportAsync(BatchImportRequestDto request, string userId)
    {
        var result = new BatchImportResultDto();

        // Validate ownership of every referenced attachment once, up front.
        var allAttachmentIds = request.Items
            .SelectMany<BatchImportItemDto, string>(i =>
            {
                if (i.Kind == "odometer")
                    return i.Odometer?.PhotoAttachmentId is { } pid ? new[] { pid } : Array.Empty<string>();
                return i.Expense?.AttachmentIds ?? new List<string>();
            })
            .Distinct()
            .ToList();
        var owned = (await _attachments.GetByIdsAsync(allAttachmentIds, userId)).Select(a => a.Id!).ToHashSet();

        for (var index = 0; index < request.Items.Count; index++)
        {
            var item = request.Items[index];
            var itemResult = new BatchImportItemResultDto { Index = index, Kind = item.Kind };

            try
            {
                if (item.Kind == "odometer")
                {
                    if (item.Odometer == null) throw new ArgumentException("odometer payload is required");
                    if (item.Odometer.PhotoAttachmentId != null && !owned.Contains(item.Odometer.PhotoAttachmentId))
                        throw new ArgumentException("Attachment not found");

                    var reading = await BuildOdometerAsync(item.Odometer, userId, skipAttachmentCheck: true);
                    await _odometer.InsertOneAsync(reading);
                    itemResult.Id = reading.Id;
                }
                else if (item.Kind == "expense")
                {
                    if (item.Expense == null) throw new ArgumentException("expense payload is required");
                    if (item.Expense.AttachmentIds.Any(id => !owned.Contains(id)))
                        throw new ArgumentException("One or more attachments not found");

                    var expense = await BuildExpenseAsync(item.Expense, userId, skipAttachmentCheck: true);
                    await _expenses.InsertOneAsync(expense);
                    itemResult.Id = expense.Id;
                }
                else
                {
                    throw new ArgumentException($"Unknown kind: {item.Kind}");
                }

                result.Created++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Batch import item {Index} failed for user {UserId}", index, userId[..Math.Min(8, userId.Length)] + "***");
                itemResult.Error = ex.Message;
                result.Failed++;
            }

            result.Results.Add(itemResult);
        }

        return result;
    }

    // ---------- helpers ----------

    private async Task<Expense> BuildExpenseAsync(CreateExpenseDto dto, string userId, bool skipAttachmentCheck = false)
    {
        if (!ExpenseCategories.IsValid(dto.Category)) throw new ArgumentException($"Invalid category: {dto.Category}");
        if (!DateSources.Contains(dto.DateSource)) throw new ArgumentException($"Invalid dateSource: {dto.DateSource}");
        if (dto.Amount < 0) throw new ArgumentException("Amount cannot be negative");

        var attachmentIds = dto.AttachmentIds.Distinct().ToList();
        if (!skipAttachmentCheck) await EnsureAttachmentsOwnedAsync(attachmentIds, userId);

        return new Expense
        {
            UserId = userId,
            VehicleId = dto.VehicleId,
            Category = dto.Category,
            Date = dto.Date,
            Amount = dto.Amount,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "GBP" : dto.Currency,
            Merchant = dto.Merchant,
            Notes = dto.Notes,
            Fuel = dto.Fuel == null ? null : new FuelDetails { Litres = dto.Fuel.Litres, OdometerMiles = dto.Fuel.OdometerMiles },
            AttachmentIds = attachmentIds,
            IsFullyBusiness = dto.IsFullyBusiness,
            Status = ExpenseStatus.Confirmed,
            DateSource = dto.DateSource,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private async Task<OdometerReading> BuildOdometerAsync(CreateOdometerReadingDto dto, string userId, bool skipAttachmentCheck = false)
    {
        if (!OdometerSources.Contains(dto.Source)) throw new ArgumentException($"Invalid source: {dto.Source}");
        if (!DateSources.Contains(dto.DateSource)) throw new ArgumentException($"Invalid dateSource: {dto.DateSource}");
        if (dto.Miles < 0) throw new ArgumentException("Miles cannot be negative");

        if (!skipAttachmentCheck && dto.PhotoAttachmentId != null)
            await EnsureAttachmentsOwnedAsync(new[] { dto.PhotoAttachmentId }, userId);

        return new OdometerReading
        {
            UserId = userId,
            VehicleId = dto.VehicleId,
            Date = dto.Date,
            Miles = dto.Miles,
            Source = dto.Source,
            PhotoAttachmentId = dto.PhotoAttachmentId,
            DateSource = dto.DateSource,
            Notes = dto.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private async Task EnsureAttachmentsOwnedAsync(IEnumerable<string> ids, string userId)
    {
        var idList = ids.Distinct().ToList();
        if (idList.Count == 0) return;
        var owned = await _attachments.GetByIdsAsync(idList, userId);
        if (owned.Count != idList.Count) throw new ArgumentException("One or more attachments not found");
    }
}
