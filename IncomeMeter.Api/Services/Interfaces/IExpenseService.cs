using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

public interface IExpenseService
{
    Task<List<Expense>> GetExpensesAsync(string userId, DateTime? from = null, DateTime? to = null, string? category = null);
    Task<Expense?> GetExpenseByIdAsync(string id, string userId);
    Task<Expense> CreateExpenseAsync(CreateExpenseDto dto, string userId);
    Task<Expense?> UpdateExpenseAsync(string id, UpdateExpenseDto dto, string userId);
    Task<bool> DeleteExpenseAsync(string id, string userId);

    Task<List<OdometerReading>> GetOdometerReadingsAsync(string userId, DateTime? from = null, DateTime? to = null);
    Task<OdometerReading> CreateOdometerReadingAsync(CreateOdometerReadingDto dto, string userId);
    Task<bool> DeleteOdometerReadingAsync(string id, string userId);

    /// <summary>Create many expenses / odometer readings in one go (bulk receipt import).</summary>
    Task<BatchImportResultDto> BatchImportAsync(BatchImportRequestDto request, string userId);
}
