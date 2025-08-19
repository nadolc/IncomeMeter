using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace IncomeMeter.Api.Models;

public class WorkTypeConfig
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    [BsonRequired]
    public string UserId { get; set; } = string.Empty;

    [BsonRequired]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public List<IncomeSourceTemplate> IncomeSourceTemplates { get; set; } = new();

    public bool IsActive { get; set; } = true;

    // Phase 1: Default work types support
    public bool IsDefault { get; set; } = false; // Auto-assign to new users
    public WorkTypeScope Scope { get; set; } = WorkTypeScope.Individual;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class IncomeSourceTemplate
{
    [BsonRequired]
    public string Name { get; set; } = string.Empty;

    public string? Category { get; set; }

    public decimal? DefaultAmount { get; set; }

    public bool IsRequired { get; set; } = false;

    public string? Description { get; set; }

    public int DisplayOrder { get; set; } = 0;
}

public enum WorkTypeScope
{
    Individual = 0,    // User-created
    Organization = 1,  // Organization-wide (future)
    System = 2         // System defaults
}