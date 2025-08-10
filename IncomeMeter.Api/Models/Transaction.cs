using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace IncomeMeter.Api.Models
{

    // Transaction.cs
    public class Transaction
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonRepresentation(BsonType.ObjectId)]
        public string UserId { get; set; } = null!;

        public decimal Amount { get; set; }
        public string Type { get; set; } = null!; // "income" or "expense"
        public string Category { get; set; } = null!;
        public string Merchant { get; set; } = null!;
        public string Currency { get; set; } = "GBP";
        public DateTime Date { get; set; }

        [BsonElement("timestampLogged")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}