using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

public interface ITransactionService
{
    Task<List<Transaction>> GetTransactionsByUserIdAsync(string userId);
    Task<Transaction> CreateTransactionAsync(CreateTransactionDto transactionDto, string userId);
}