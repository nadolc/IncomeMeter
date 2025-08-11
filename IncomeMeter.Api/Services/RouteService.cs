using MongoDB.Driver;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

public class RouteService : IRouteService
{
    private readonly IMongoCollection<IncomeMeter.Api.Models.Route> _routes;

    public RouteService(MongoDbContext context)
    {
        _routes = context.Routes;// Initialize the routes collection from the context
    }

    public async Task<List<IncomeMeter.Api.Models.Route>> GetRoutesByUserIdAsync(string userId) =>
        await _routes.Find(r => r.UserId == userId)
            .SortByDescending(r => r.ScheduleStart)
            .ToListAsync();

    public async Task<IncomeMeter.Api.Models.Route?> GetRouteByIdAsync(string id, string userId) =>
        await _routes.Find(r => r.Id == id && r.UserId == userId).FirstOrDefaultAsync();

    public async Task<IncomeMeter.Api.Models.Route> CreateRouteAsync(CreateRouteDto routeDto, string userId)
    {
        var route = new IncomeMeter.Api.Models.Route
        {
            UserId = userId,
            WorkType = routeDto.WorkType,
            ScheduleStart = routeDto.ScheduleStart,
            ScheduleEnd = routeDto.ScheduleEnd,
            StartMile = routeDto.StartMile,
            Status = "scheduled",
            Incomes = routeDto.Incomes.Select(dto => new IncomeItem 
            { 
                Source = dto.Source, 
                Amount = dto.Amount 
            }).ToList(),
            TotalIncome = routeDto.Incomes.Sum(i => i.Amount),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await _routes.InsertOneAsync(route);
        return route;
    }

    public async Task<IncomeMeter.Api.Models.Route?> StartRouteAsync(StartRouteDto routeDto, string userId)
    {
        var newRoute = new IncomeMeter.Api.Models.Route
        {
            UserId = userId,
            WorkType = routeDto.WorkType,
            StartMile = routeDto.StartMile,
            Status = "in_progress",
            ActualStartTime = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await _routes.InsertOneAsync(newRoute);
        return newRoute;
    }

    public async Task<Models.Route?> EndRouteAsync(EndRouteDto routeDto, string userId)
    {
        var filter = Builders<Models.Route>.Filter.And(
            Builders<Models.Route>.Filter.Eq(r => r.Id, routeDto.Id),
            Builders<Models.Route>.Filter.Eq(r => r.UserId, userId)
        );

        var update = Builders<Models.Route>.Update
            .Set(r => r.EndMile, routeDto.EndMile)
            .Set(r => r.ActualEndTime, DateTime.UtcNow)
            .Set(r => r.Status, "completed")
            .Set(r => r.Incomes, routeDto.Incomes.Select(dto => new IncomeItem 
            { 
                Source = dto.Source, 
                Amount = dto.Amount 
            }).ToList())
            .Set(r => r.TotalIncome, routeDto.Incomes.Sum(i => i.Amount))
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        var result = await _routes.FindOneAndUpdateAsync(filter, update, 
            new FindOneAndUpdateOptions<Models.Route> { ReturnDocument = ReturnDocument.After });

        if (result != null && result.StartMile.HasValue && result.EndMile.HasValue)
        {
            var distance = Math.Abs(result.EndMile.Value - result.StartMile.Value);
            var distanceUpdate = Builders<Models.Route>.Update.Set(r => r.Distance, distance);
            await _routes.UpdateOneAsync(filter, distanceUpdate);
            result.Distance = distance;
        }

        return result;
    }

    public async Task<Models.Route?> UpdateRouteAsync(string id, Models.Route updatedRoute, string userId)
    {
        var filter = Builders<Models.Route>.Filter.And(
            Builders<Models.Route>.Filter.Eq(r => r.Id, id),
            Builders<Models.Route>.Filter.Eq(r => r.UserId, userId)
        );

        updatedRoute.UpdatedAt = DateTime.UtcNow;
        var result = await _routes.ReplaceOneAsync(filter, updatedRoute);
        
        return result.ModifiedCount > 0 ? updatedRoute : null;
    }

    public async Task<bool> DeleteRouteAsync(string id, string userId)
    {
        var filter = Builders<Models.Route>.Filter.And(
            Builders<Models.Route>.Filter.Eq(r => r.Id, id),
            Builders<Models.Route>.Filter.Eq(r => r.UserId, userId)
        );

        var result = await _routes.DeleteOneAsync(filter);
        return result.DeletedCount > 0;
    }

    // ... Implementations for End, Update, Delete ...
}