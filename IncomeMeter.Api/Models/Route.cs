using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace IncomeMeter.Api.Models;

public class Route
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = null!;

    public string WorkType { get; set; } = null!;
    public string Status { get; set; } = "scheduled"; // "completed", "in_progress", etc.
    public DateTime ScheduleStart { get; set; }
    public DateTime ScheduleEnd { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public string? Description { get; set; }
    public List<IncomeItem> Incomes { get; set; } = new();
    public decimal TotalIncome { get; set; }
    public double? StartMile { get; set; }
    public double? EndMile { get; set; }

    [BsonElement("createTS")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("amendTS")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class IncomeItem
{
    public string Source { get; set; } = null!;
    public decimal Amount { get; set; }
}