using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace IncomeMeter.Api.Controllers;

[ApiController]
[Route("api/tax-report")]
[Authorize(AuthenticationSchemes = "Bearer")]
public class TaxReportController : ControllerBase
{
    private readonly ITaxYearReportService _reports;
    private readonly TaxRulesSettings _rules;

    public TaxReportController(ITaxYearReportService reports, IOptions<TaxRulesSettings> rules)
    {
        _reports = reports;
        _rules = rules.Value;
    }

    /// <summary>The HMRC rates the report is using, so the UI can display them.</summary>
    [HttpGet("rules")]
    public IActionResult GetRules() => Ok(_rules);

    /// <summary>Tax year (start year) that today falls in.</summary>
    [HttpGet("current-tax-year")]
    public IActionResult GetCurrentTaxYear() => Ok(new { taxYear = _reports.TaxYearFor(DateTime.UtcNow) });

    /// <param name="taxYear">Start year, e.g. 2025 for 2025/26.</param>
    /// <param name="vehicleId">Optional – defaults to the first active vehicle.</param>
    /// <param name="businessUsePercent">Optional override when odometer readings are incomplete.</param>
    [HttpGet("{taxYear:int}")]
    public async Task<IActionResult> GetReport(int taxYear, [FromQuery] string? vehicleId, [FromQuery] double? businessUsePercent)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });
        if (taxYear < 2000 || taxYear > 2100) return BadRequest(new { error = "taxYear must be the start year, e.g. 2025" });
        if (businessUsePercent is < 0 or > 100) return BadRequest(new { error = "businessUsePercent must be between 0 and 100" });

        try
        {
            return Ok(await _reports.BuildReportAsync(userId, taxYear, vehicleId, businessUsePercent));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{taxYear:int}/csv")]
    public async Task<IActionResult> GetReportCsv(int taxYear, [FromQuery] string? vehicleId, [FromQuery] double? businessUsePercent)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        try
        {
            var report = await _reports.BuildReportAsync(userId, taxYear, vehicleId, businessUsePercent);
            var bytes = System.Text.Encoding.UTF8.GetPreamble().Concat(System.Text.Encoding.UTF8.GetBytes(_reports.ToCsv(report))).ToArray();
            return File(bytes, "text/csv", $"tax-year-{taxYear}-{(taxYear + 1) % 100:00}-report.csv");
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>ZIP bundle: summary CSV, expense + odometer indexes, and every receipt/odometer photo for the year (your 5-year record).</summary>
    [HttpGet("{taxYear:int}/receipts.zip")]
    public async Task<IActionResult> GetReceiptsZip(int taxYear, [FromQuery] string? vehicleId, CancellationToken ct)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        try
        {
            var bytes = await _reports.BuildReceiptsZipAsync(userId, taxYear, vehicleId, ct);
            return File(bytes, "application/zip", $"tax-year-{taxYear}-{(taxYear + 1) % 100:00}-receipts.zip");
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
