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

    [BsonElement("workType")]
    public string? WorkType { get; set; }
    
    [BsonElement("status")]
    public string Status { get; set; } = "scheduled";
    
    [BsonElement("scheduleStart")]
    public DateTime ScheduleStart { get; set; }
    
    [BsonElement("scheduleEnd")]
    public DateTime ScheduleEnd { get; set; }
    
    [BsonElement("actualStartTime")]
    public DateTime? ActualStartTime { get; set; }
    
    [BsonElement("actualEndTime")]
    public DateTime? ActualEndTime { get; set; }
    
    [BsonElement("incomes")]
    public List<IncomeItem> Incomes { get; set; } = new();
    
    [BsonElement("totalIncome")]
    public decimal TotalIncome { get; set; }
    
    [BsonElement("estimatedIncome")]
    public decimal EstimatedIncome { get; set; }
    
    [BsonElement("distance")]
    public double Distance { get; set; }
    
    [BsonElement("startMile")]
    public double? StartMile { get; set; }
    
    [BsonElement("endMile")]
    public double? EndMile { get; set; }

    [BsonElement("createTS")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("amendTS")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class IncomeItem
{
    [BsonElement("source")]
    public string Source { get; set; } = null!;
    
    [BsonElement("amount")]
    public decimal Amount { get; set; }
}