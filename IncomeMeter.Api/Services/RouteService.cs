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
        await _routes.Find(r => r.UserId == userId).ToListAsync();

    public async Task<IncomeMeter.Api.Models.Route?> GetRouteByIdAsync(string id, string userId) =>
        await _routes.Find(r => r.Id == id && r.UserId == userId).FirstOrDefaultAsync();

    public async Task<IncomeMeter.Api.Models.Route> CreateRouteAsync(CreateRouteDto routeDto, string userId)
    {
        var route = new IncomeMeter.Api.Models.Route { /* Map DTO to model */ };
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

    public Task<Models.Route?> EndRouteAsync(EndRouteDto routeDto, string userId)
    {
        throw new NotImplementedException();
    }

    public Task<Models.Route?> UpdateRouteAsync(string id, Models.Route updatedRoute, string userId)
    {
        throw new NotImplementedException();
    }

    public Task<bool> DeleteRouteAsync(string id, string userId)
    {
        throw new NotImplementedException();
    }

    // ... Implementations for End, Update, Delete ...
}