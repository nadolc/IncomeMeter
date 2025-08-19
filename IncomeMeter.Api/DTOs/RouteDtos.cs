using System.ComponentModel.DataAnnotations;

namespace IncomeMeter.Api.DTOs;

// DTO for creating a new route from scratch
public class CreateRouteDto
{
    [Required]
    public string WorkType { get; set; } = null!;
    public string? WorkTypeId { get; set; }
    [Required]
    public DateTime ScheduleStart { get; set; }
    [Required]
    public DateTime ScheduleEnd { get; set; }
    public List<IncomeItemDto> Incomes { get; set; } = new();
    public double? StartMile { get; set; }
    public decimal? EstimatedIncome { get; set; }
    public string? Description { get; set; }
}

// DTO for updating a route
public class UpdateRouteDto
{
    public string? WorkType { get; set; }
    public string? WorkTypeId { get; set; }
    public DateTime? ScheduleStart { get; set; }
    public DateTime? ScheduleEnd { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public List<IncomeItemDto>? Incomes { get; set; }
    public decimal? EstimatedIncome { get; set; }
    public double? StartMile { get; set; }
    public double? EndMile { get; set; }
    public string? Status { get; set; }
}

// DTO for starting a route "on-the-fly"
public class StartRouteDto
{
    [Required]
    public string WorkType { get; set; } = null!;
    public string? WorkTypeId { get; set; }
    [Required]
    public double StartMile { get; set; }
    public decimal? EstimatedIncome { get; set; }
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

// Response DTO for route details
public class RouteResponseDto
{
    public string? Id { get; set; }
    public string UserId { get; set; } = null!;
    public string? WorkType { get; set; }
    public string? WorkTypeId { get; set; }
    public string Status { get; set; } = "scheduled";
    public DateTime ScheduleStart { get; set; }
    public DateTime ScheduleEnd { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public List<IncomeItemDto> Incomes { get; set; } = new();
    public decimal TotalIncome { get; set; }
    public decimal EstimatedIncome { get; set; }
    public double Distance { get; set; }
    public double? StartMile { get; set; }
    public double? EndMile { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class IncomeItemDto
{
    [Required]
    public string Source { get; set; } = null!;
    [Range(0, double.MaxValue)]
    public decimal Amount { get; set; }
}