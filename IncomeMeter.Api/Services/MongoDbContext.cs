using IncomeMeter.Api.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace IncomeMeter.Api.Services;

public class MongoDbContext
{
    // Define properties for all your collections
    /*public IMongoCollection<User> Users { get; }
    public IMongoCollection<IncomeMeter.Api.Models.Route> Routes { get; }
    public IMongoCollection<Location> Locations { get; }
    public IMongoCollection<Transaction> Transactions { get; }
    public IMongoCollection<WorkTypeConfig> WorkTypeConfigs { get; }*/
    public virtual IMongoCollection<User> Users { get; }
    public virtual IMongoCollection<IncomeMeter.Api.Models.Route> Routes { get; }
    public virtual IMongoCollection<Location> Locations { get; }
    public virtual IMongoCollection<Transaction> Transactions { get; }
    public virtual IMongoCollection<WorkTypeConfig> WorkTypeConfigs { get; }
    public virtual IMongoCollection<Attachment> Attachments { get; }
    public virtual IMongoCollection<Expense> Expenses { get; }
    public virtual IMongoCollection<OdometerReading> OdometerReadings { get; }
    public virtual IMongoCollection<Vehicle> Vehicles { get; }

    public MongoDbContext(IOptions<DatabaseSettings> dbSettings)
    {
        var settings = dbSettings.Value;
        var client = new MongoClient(settings.ConnectionString);
        var database = client.GetDatabase(settings.DatabaseName);

        // Initialize all collection properties
        Users = database.GetCollection<User>(settings.UsersCollectionName);
        Routes = database.GetCollection<IncomeMeter.Api.Models.Route>(settings.RoutesCollectionName);
        Locations = database.GetCollection<Location>(settings.LocationsCollectionName);
        Transactions = database.GetCollection<Transaction>(settings.TransactionsCollectionName);
        WorkTypeConfigs = database.GetCollection<WorkTypeConfig>("workTypeConfigs");
        Attachments = database.GetCollection<Attachment>("attachments");
        Expenses = database.GetCollection<Expense>("expenses");
        OdometerReadings = database.GetCollection<OdometerReading>("odometerReadings");
        Vehicles = database.GetCollection<Vehicle>("vehicles");
    }
}