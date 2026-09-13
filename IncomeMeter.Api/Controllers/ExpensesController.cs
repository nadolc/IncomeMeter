using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = "Bearer")]
public class ExpensesController : ControllerBase
{
    private readonly IExpenseService _expenseService;

    public ExpensesController(IExpenseService expenseService)
    {
        _expenseService = expenseService;
    }

    [HttpGet("categories")]
    [AllowAnonymous]
    public IActionResult GetCategories() => Ok(ExpenseCategories.All);

    [HttpGet]
    public async Task<IActionResult> GetExpenses([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? category)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var expenses = await _expenseService.GetExpensesAsync(userId, from, to, category);
        return Ok(expenses);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetExpense(string id)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var expense = await _expenseService.GetExpenseByIdAsync(id, userId);
        return expense == null ? NotFound() : Ok(expense);
    }

    [HttpPost]
    public async Task<IActionResult> CreateExpense([FromBody] CreateExpenseDto dto)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var expense = await _expenseService.CreateExpenseAsync(dto, userId);
            return CreatedAtAction(nameof(GetExpense), new { id = expense.Id }, expense);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Create many expenses and/or odometer readings in one request (the "save all" of the bulk receipt import).
    /// Items are processed independently; the response reports success/failure per item.
    /// </summary>
    [HttpPost("batch")]
    public async Task<IActionResult> BatchImport([FromBody] BatchImportRequestDto request)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await _expenseService.BatchImportAsync(request, userId);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateExpense(string id, [FromBody] UpdateExpenseDto dto)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var expense = await _expenseService.UpdateExpenseAsync(id, dto, userId);
            return expense == null ? NotFound() : Ok(expense);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteExpense(string id)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var deleted = await _expenseService.DeleteExpenseAsync(id, userId);
        return deleted ? NoContent() : NotFound();
    }

    // ---------- Odometer readings ----------

    [HttpGet("odometer")]
    public async Task<IActionResult> GetOdometerReadings([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var readings = await _expenseService.GetOdometerReadingsAsync(userId, from, to);
        return Ok(readings);
    }

    [HttpPost("odometer")]
    public async Task<IActionResult> CreateOdometerReading([FromBody] CreateOdometerReadingDto dto)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });
        if (!ModelState.IsValid) return BadRequest(ModelState);

        try
        {
            var reading = await _expenseService.CreateOdometerReadingAsync(dto, userId);
            return Ok(reading);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("odometer/{id}")]
    public async Task<IActionResult> DeleteOdometerReading(string id)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        var deleted = await _expenseService.DeleteOdometerReadingAsync(id, userId);
        return deleted ? NoContent() : NotFound();
    }
}
