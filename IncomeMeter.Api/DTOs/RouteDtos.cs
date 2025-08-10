using System.ComponentModel.DataAnnotations;

namespace IncomeMeter.Api.DTOs;

// DTO for creating a new route from scratch
public class CreateRouteDto
{
    [Required]
    public string WorkType { get; set; } = null!;
    [Required]
    public DateTime ScheduleStart { get; set; }
    [Required]
    public DateTime ScheduleEnd { get; set; }
    [Required]
    public List<IncomeItemDto> Incomes { get; set; } = new();
    public double? StartMile { get; set; }
    public string? Description { get; set; }
}

// DTO for starting a route "on-the-fly"
public class StartRouteDto
{
    [Required]
    public string WorkType { get; set; } = null!;
    [Required]
    public double StartMile { get; set; }
}

// DTO for ending a route
public class EndRouteDto
{
    [Required]
    public string Id { get; set; } = null!;
    [Required]
    public double EndMile { get; set; }
    [Required]
    public List<IncomeItemDto> Incomes { get; set; } = new();
}

public class IncomeItemDto
{
    [Required]
    public string Source { get; set; } = null!;
    [Range(0, double.MaxValue)]
    public decimal Amount { get; set; }
}