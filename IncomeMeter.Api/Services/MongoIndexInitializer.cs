using IncomeMeter.Api.Models;
using MongoDB.Driver;
using Route = IncomeMeter.Api.Models.Route;

namespace IncomeMeter.Api.Services;

/// <summary>
/// Creates the indexes every query in the app relies on. Runs once at startup in the background;
/// CreateMany is idempotent so redeploys are safe. Without these, every user-scoped query is a
/// full collection scan (very visible on Cosmos DB for MongoDB).
/// </summary>
public class MongoIndexInitializer : IHostedService
{
    private readonly MongoDbContext _db;
    private readonly ILogger<MongoIndexInitializer> _logger;

    public MongoIndexInitializer(MongoDbContext db, ILogger<MongoIndexInitializer> logger)
    {
        _db = db;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        // Don't block app start on the database.
        _ = Task.Run(() => CreateAsync(CancellationToken.None), CancellationToken.None);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task CreateAsync(CancellationToken ct)
    {
        var opts = new CreateIndexOptions { Background = true };
        try
        {
            await _db.Routes.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<Route>(Builders<Route>.IndexKeys.Ascending(r => r.UserId).Descending(r => r.ScheduleStart), opts),
                new CreateIndexModel<Route>(Builders<Route>.IndexKeys.Ascending(r => r.UserId).Ascending(r => r.Status), opts),
                new CreateIndexModel<Route>(Builders<Route>.IndexKeys.Ascending(r => r.UserId).Ascending(r => r.VehicleId), opts),
            }, ct);

            await _db.Expenses.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<Expense>(Builders<Expense>.IndexKeys.Ascending(e => e.UserId).Descending(e => e.Date), opts),
                new CreateIndexModel<Expense>(Builders<Expense>.IndexKeys.Ascending(e => e.UserId).Ascending(e => e.VehicleId), opts),
            }, ct);

            await _db.OdometerReadings.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<OdometerReading>(Builders<OdometerReading>.IndexKeys.Ascending(o => o.UserId).Descending(o => o.Date), opts),
            }, ct);

            await _db.Attachments.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<Attachment>(Builders<Attachment>.IndexKeys.Ascending(a => a.UserId).Ascending(a => a.Sha256), opts),
            }, ct);

            await _db.Vehicles.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<Vehicle>(Builders<Vehicle>.IndexKeys.Ascending(v => v.UserId), opts),
            }, ct);

            await _db.Locations.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<Location>(Builders<Location>.IndexKeys.Ascending(l => l.UserId).Ascending(l => l.RouteId), opts),
            }, ct);

            await _db.WorkTypeConfigs.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<WorkTypeConfig>(Builders<WorkTypeConfig>.IndexKeys.Ascending(w => w.UserId), opts),
            }, ct);

            await _db.Transactions.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<Transaction>(Builders<Transaction>.IndexKeys.Ascending(t => t.UserId).Descending(t => t.Date), opts),
            }, ct);

            await _db.Users.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<User>(Builders<User>.IndexKeys.Ascending(u => u.GoogleId), opts),
                new CreateIndexModel<User>(Builders<User>.IndexKeys.Ascending(u => u.Email), opts),
            }, ct);

            _logger.LogInformation("MongoDB indexes ensured");
        }
        catch (Exception ex)
        {
            // Index creation failing must never take the app down; queries still work, just slower.
            _logger.LogWarning(ex, "Could not create MongoDB indexes");
        }
    }
}
