using IncomeMeter.Api.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace IncomeMeter.Api.Services;

public class MongoDbContext
{
    // Define properties for all your collections
    public IMongoCollection<User> Users { get; }
    public IMongoCollection<IncomeMeter.Api.Models.Route> Routes { get; }
    public IMongoCollection<Location> Locations { get; }
    public IMongoCollection<Transaction> Transactions { get; }

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
    }
}