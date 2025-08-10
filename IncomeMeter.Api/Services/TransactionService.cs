using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Services;
using MongoDB.Driver;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

public class TransactionService : ITransactionService
{
    private readonly IMongoCollection<Transaction> _transactions;

    public TransactionService(MongoDbContext context)
    {
        _transactions = context.Transactions;
    }

    public async Task<List<Transaction>> GetTransactionsByUserIdAsync(string userId) =>
        await _transactions.Find(t => t.UserId == userId).ToListAsync();

    public async Task<Transaction> CreateTransactionAsync(CreateTransactionDto dto, string userId)
    {
        var transaction = new Transaction
        {
            UserId = userId,
            Amount = dto.Amount,
            Type = dto.Type,
            Category = dto.Category,
            Merchant = dto.Merchant,
            Currency = dto.Currency,
            Date = dto.Date,
            CreatedAt = DateTime.UtcNow
            // Map other properties from DTO...
        };

        await _transactions.InsertOneAsync(transaction);
        return transaction;
    }
}