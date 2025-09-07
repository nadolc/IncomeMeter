using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = "Bearer")]
public class TransactionsController : ControllerBase
{
    private readonly ITransactionService _transactionService;

    public TransactionsController(ITransactionService transactionService)
    {
        _transactionService = transactionService;
    }

    private User GetCurrentUser() => (User)HttpContext.Items["User"]!;

    [HttpGet]
    public async Task<IActionResult> GetTransactions()
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized(new { error = "Unauthorized" });

        var transactions = await _transactionService.GetTransactionsByUserIdAsync(user.Id!);
        return Ok(transactions);
    }

    [HttpPost]
    public async Task<IActionResult> CreateTransaction([FromBody] CreateTransactionDto dto)
    {
        var user = GetCurrentUser();
        if (user == null) return Unauthorized(new { error = "Unauthorized" });

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var newTransaction = await _transactionService.CreateTransactionAsync(dto, user.Id!);
        return CreatedAtAction(nameof(GetTransactions), newTransaction);
    }
}