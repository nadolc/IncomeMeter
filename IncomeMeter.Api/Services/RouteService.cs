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
            WorkTypeId = routeDto.WorkTypeId,
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
            EstimatedIncome = routeDto.EstimatedIncome ?? 0,
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
            WorkTypeId = routeDto.WorkTypeId,
            StartMile = routeDto.StartMile,
            Status = "in_progress",
            ActualStartTime = DateTime.UtcNow,
            ScheduleStart = DateTime.UtcNow,
            ScheduleEnd = DateTime.UtcNow.AddHours(8), // Default 8-hour duration
            EstimatedIncome = routeDto.EstimatedIncome ?? 0,
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

    public async Task<Models.Route?> UpdateRouteAsync(string id, UpdateRouteDto routeDto, string userId)
    {
        var filter = Builders<Models.Route>.Filter.And(
            Builders<Models.Route>.Filter.Eq(r => r.Id, id),
            Builders<Models.Route>.Filter.Eq(r => r.UserId, userId)
        );

        // Build update definition
        var updateBuilder = Builders<Models.Route>.Update;
        var updates = new List<UpdateDefinition<Models.Route>>();

        if (!string.IsNullOrEmpty(routeDto.WorkType))
            updates.Add(updateBuilder.Set(r => r.WorkType, routeDto.WorkType));

        if (routeDto.WorkTypeId != null)
            updates.Add(updateBuilder.Set(r => r.WorkTypeId, routeDto.WorkTypeId));

        if (routeDto.ScheduleStart.HasValue)
            updates.Add(updateBuilder.Set(r => r.ScheduleStart, routeDto.ScheduleStart.Value));

        if (routeDto.ScheduleEnd.HasValue)
            updates.Add(updateBuilder.Set(r => r.ScheduleEnd, routeDto.ScheduleEnd.Value));

        if (routeDto.ActualStartTime.HasValue)
            updates.Add(updateBuilder.Set(r => r.ActualStartTime, routeDto.ActualStartTime.Value));

        if (routeDto.ActualEndTime.HasValue)
            updates.Add(updateBuilder.Set(r => r.ActualEndTime, routeDto.ActualEndTime.Value));

        if (routeDto.Incomes != null)
        {
            var incomes = routeDto.Incomes.Select(dto => new IncomeItem 
            { 
                Source = dto.Source, 
                Amount = dto.Amount 
            }).ToList();
            updates.Add(updateBuilder.Set(r => r.Incomes, incomes));
            updates.Add(updateBuilder.Set(r => r.TotalIncome, routeDto.Incomes.Sum(i => i.Amount)));
        }

        if (routeDto.EstimatedIncome.HasValue)
            updates.Add(updateBuilder.Set(r => r.EstimatedIncome, routeDto.EstimatedIncome.Value));

        if (routeDto.StartMile.HasValue)
            updates.Add(updateBuilder.Set(r => r.StartMile, routeDto.StartMile.Value));

        if (routeDto.EndMile.HasValue)
            updates.Add(updateBuilder.Set(r => r.EndMile, routeDto.EndMile.Value));

        if (!string.IsNullOrEmpty(routeDto.Status))
            updates.Add(updateBuilder.Set(r => r.Status, routeDto.Status));

        if (updates.Count == 0)
        {
            // No changes to make
            return await GetRouteByIdAsync(id, userId);
        }

        // Calculate distance if both start and end miles are provided
        if (routeDto.StartMile.HasValue && routeDto.EndMile.HasValue)
        {
            var distance = Math.Abs(routeDto.EndMile.Value - routeDto.StartMile.Value);
            updates.Add(updateBuilder.Set(r => r.Distance, distance));
        }

        updates.Add(updateBuilder.Set(r => r.UpdatedAt, DateTime.UtcNow));

        var combinedUpdate = updateBuilder.Combine(updates);
        var result = await _routes.FindOneAndUpdateAsync(filter, combinedUpdate,
            new FindOneAndUpdateOptions<Models.Route> { ReturnDocument = ReturnDocument.After });
        
        return result;
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

    public async Task<List<Models.Route>> GetRoutesByStatusAsync(string userId, string status)
    {
        return await _routes.Find(r => r.UserId == userId && r.Status == status)
            .SortByDescending(r => r.ScheduleStart)
            .ToListAsync();
    }

    public async Task<List<Models.Route>> GetRoutesByDateRangeAsync(string userId, DateTime startDate, DateTime endDate)
    {
        return await _routes.Find(r => r.UserId == userId && 
                                     r.ScheduleStart >= startDate && 
                                     r.ScheduleStart <= endDate)
            .SortByDescending(r => r.ScheduleStart)
            .ToListAsync();
    }
}