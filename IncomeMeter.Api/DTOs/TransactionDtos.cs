using System.ComponentModel.DataAnnotations;
using IncomeMeter.Api.Models; // Assuming Location model is in here

namespace IncomeMeter.Api.DTOs;

public class CreateTransactionDto
{
    [Required]
    [Range(0.01, double.MaxValue)]
    public decimal Amount { get; set; }

    [Required]
    public string Type { get; set; } = null!; // "income" or "expense"

    [Required]
    public string Category { get; set; } = null!;

    [Required]
    public string Merchant { get; set; } = null!;

    [Required]
    [StringLength(3, MinimumLength = 3)]
    public string Currency { get; set; } = null!;

    [Required]
    public string PaymentMethod { get; set; } = null!;

    public LocationDto? Location { get; set; }

    public string? Notes { get; set; }

    [Required]
    public string DeviceName { get; set; } = null!;

    [Required]
    public DateTime Date { get; set; }
}