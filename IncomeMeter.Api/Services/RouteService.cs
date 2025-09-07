using MongoDB.Driver;
using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services.Interfaces;

namespace IncomeMeter.Api.Services;

public class RouteService : IRouteService
{
    private readonly IMongoCollection<IncomeMeter.Api.Models.Route> _routes;
    private readonly ITimezoneService _timezoneService;
    private readonly IUserService _userService;

    public RouteService(MongoDbContext context, ITimezoneService timezoneService, IUserService userService)
    {
        _routes = context.Routes;// Initialize the routes collection from the context
        _timezoneService = timezoneService;
        _userService = userService;
    }

    public async Task<List<IncomeMeter.Api.Models.Route>> GetRoutesByUserIdAsync(string userId) =>
        await _routes.Find(r => r.UserId == userId)
            .SortByDescending(r => r.ScheduleStart)
            .ToListAsync();

    public async Task<IncomeMeter.Api.Models.Route?> GetRouteByIdAsync(string id, string userId) =>
        await _routes.Find(r => r.Id == id && r.UserId == userId).FirstOrDefaultAsync();

    public async Task<IncomeMeter.Api.Models.Route> CreateRouteAsync(CreateRouteDto routeDto, string userId)
    {
        // Get user's timezone for proper conversion
        var user = await _userService.GetUserByIdAsync(userId);
        var userTimezone = user?.Settings?.TimeZone ?? "UTC";

        // Convert schedule times from user timezone to UTC
        var utcScheduleStart = _timezoneService.ConvertToUtc(routeDto.ScheduleStart, userTimezone);
        var utcScheduleEnd = _timezoneService.ConvertToUtc(routeDto.ScheduleEnd, userTimezone);
        
        // Convert actual times if provided
        var utcActualStartTime = routeDto.ActualStartTime.HasValue 
            ? _timezoneService.ConvertToUtc(routeDto.ActualStartTime.Value, userTimezone) 
            : (DateTime?)null;
        var utcActualEndTime = routeDto.ActualEndTime.HasValue 
            ? _timezoneService.ConvertToUtc(routeDto.ActualEndTime.Value, userTimezone) 
            : (DateTime?)null;

        var route = new IncomeMeter.Api.Models.Route
        {
            UserId = userId,
            WorkType = routeDto.WorkType,
            WorkTypeId = routeDto.WorkTypeId,
            ScheduleStart = utcScheduleStart,
            ScheduleEnd = utcScheduleEnd,
            ActualStartTime = utcActualStartTime,
            ActualEndTime = utcActualEndTime,
            StartMile = routeDto.StartMile,
            EndMile = routeDto.EndMile,
            Status = (routeDto.Status == null ? "scheduled" : routeDto.Status),
            Incomes = routeDto.Incomes.Select(dto => new IncomeItem 
            { 
                Source = dto.Source, 
                Amount = dto.Amount 
            }).ToList(),
            TotalIncome = routeDto.Incomes.Sum(i => i.Amount),
            Distance = ((routeDto.StartMile.HasValue && routeDto.EndMile.HasValue) ? Math.Abs(routeDto.EndMile.Value - routeDto.StartMile.Value): 0),
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

    public async Task<Models.Route?> EndRouteFromIOSAsync(EndRouteIOSDto routeDto, string userId)
    {
        // First, get the current route to validate and get actualStartTime
        var currentRoute = await GetRouteByIdAsync(routeDto.RouteId, userId);
        if (currentRoute == null)
        {
            return null; // Route not found or user doesn't have access
        }

        // Validate endMile against startMile
        if (currentRoute.StartMile.HasValue && routeDto.EndMile < currentRoute.StartMile.Value)
        {
            throw new InvalidOperationException("End mileage cannot be less than start mileage");
        }

        // Convert iOS income format to standard format
        var incomeItems = routeDto.ConvertToIncomeItems();
        var totalIncome = incomeItems.Sum(i => i.Amount);

        // Parse schedule period and combine with actual start time (timezone-aware)
        var actualStartTime = currentRoute.ActualStartTime ?? DateTime.UtcNow;
        var (scheduleStart, scheduleEnd) = await ParseSchedulePeriodByUserIdAsync(routeDto.SchedulePeriod, actualStartTime, userId);

        // Use provided actualEndTime or current time
        var actualEndTime = routeDto.ActualEndTime ?? DateTime.UtcNow;

        var filter = Builders<Models.Route>.Filter.And(
            Builders<Models.Route>.Filter.Eq(r => r.Id, routeDto.RouteId),
            Builders<Models.Route>.Filter.Eq(r => r.UserId, userId)
        );

        var update = Builders<Models.Route>.Update
            .Set(r => r.EndMile, routeDto.EndMile)
            .Set(r => r.ActualEndTime, actualEndTime)
            .Set(r => r.Status, "completed")
            .Set(r => r.ScheduleStart, scheduleStart)
            .Set(r => r.ScheduleEnd, scheduleEnd)
            .Set(r => r.Incomes, incomeItems.Select(dto => new IncomeItem 
            { 
                Source = dto.Source, 
                Amount = dto.Amount 
            }).ToList())
            .Set(r => r.TotalIncome, totalIncome)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        var result = await _routes.FindOneAndUpdateAsync(filter, update, 
            new FindOneAndUpdateOptions<Models.Route> { ReturnDocument = ReturnDocument.After });

        // Calculate distance if both start and end miles are available
        if (result != null && result.StartMile.HasValue && result.EndMile.HasValue)
        {
            var distance = Math.Abs(result.EndMile.Value - result.StartMile.Value);
            var distanceUpdate = Builders<Models.Route>.Update.Set(r => r.Distance, distance);
            await _routes.UpdateOneAsync(filter, distanceUpdate);
            result.Distance = distance;
        }

        return result;
    }

    private (DateTime scheduleStart, DateTime scheduleEnd) ParseSchedulePeriod(string schedulePeriod, DateTime baseDate)
    {
        var parts = schedulePeriod.Split('-');
        if (parts.Length != 2)
        {
            throw new ArgumentException("Schedule period must be in format 'HHMM-HHMM'");
        }

        var startTimeStr = parts[0].Trim();
        var endTimeStr = parts[1].Trim();

        if (startTimeStr.Length != 4 || endTimeStr.Length != 4)
        {
            throw new ArgumentException("Time parts must be 4 digits (HHMM)");
        }

        // Parse start time
        if (!int.TryParse(startTimeStr.Substring(0, 2), out int startHour) ||
            !int.TryParse(startTimeStr.Substring(2, 2), out int startMinute) ||
            startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59)
        {
            throw new ArgumentException("Invalid start time in schedule period");
        }

        // Parse end time
        if (!int.TryParse(endTimeStr.Substring(0, 2), out int endHour) ||
            !int.TryParse(endTimeStr.Substring(2, 2), out int endMinute) ||
            endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59)
        {
            throw new ArgumentException("Invalid end time in schedule period");
        }

        // Combine date from baseDate with parsed times
        var scheduleStart = new DateTime(baseDate.Year, baseDate.Month, baseDate.Day, startHour, startMinute, 0, DateTimeKind.Utc);
        var scheduleEnd = new DateTime(baseDate.Year, baseDate.Month, baseDate.Day, endHour, endMinute, 0, DateTimeKind.Utc);

        // Handle case where end time is next day (e.g., 2300-0100)
        if (scheduleEnd <= scheduleStart)
        {
            scheduleEnd = scheduleEnd.AddDays(1);
        }

        return (scheduleStart, scheduleEnd);
    }

    /// <summary>
    /// Timezone-aware schedule period parsing that converts user local time to UTC (by User ID lookup)
    /// </summary>
    private async Task<(DateTime scheduleStart, DateTime scheduleEnd)> ParseSchedulePeriodByUserIdAsync(string schedulePeriod, DateTime baseDate, string userId)
    {
        // Get user's timezone preference
        var user = await _userService.GetUserByIdAsync(userId);
        var userTimezone = user?.Settings?.TimeZone ?? "UTC";

        return await ParseSchedulePeriodWithTimezoneAsync(schedulePeriod, baseDate, userTimezone);
    }

    /// <summary>
    /// Timezone-aware schedule period parsing that converts local time to UTC (with direct timezone parameter)
    /// </summary>
    private async Task<(DateTime scheduleStart, DateTime scheduleEnd)> ParseSchedulePeriodWithTimezoneAsync(string schedulePeriod, DateTime baseDate, string userTimezone)
    {
        var parts = schedulePeriod.Split('-');
        if (parts.Length != 2)
        {
            throw new ArgumentException("Schedule period must be in format 'HHMM-HHMM'");
        }

        var startTimeStr = parts[0].Trim();
        var endTimeStr = parts[1].Trim();

        if (startTimeStr.Length != 4 || endTimeStr.Length != 4)
        {
            throw new ArgumentException("Time parts must be 4 digits (HHMM)");
        }

        // Parse start time
        if (!int.TryParse(startTimeStr.Substring(0, 2), out int startHour) ||
            !int.TryParse(startTimeStr.Substring(2, 2), out int startMinute) ||
            startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59)
        {
            throw new ArgumentException("Invalid start time in schedule period");
        }

        // Parse end time
        if (!int.TryParse(endTimeStr.Substring(0, 2), out int endHour) ||
            !int.TryParse(endTimeStr.Substring(2, 2), out int endMinute) ||
            endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59)
        {
            throw new ArgumentException("Invalid end time in schedule period");
        }

        // Create local DateTime objects (in user's timezone)
        var localScheduleStart = new DateTime(baseDate.Year, baseDate.Month, baseDate.Day, startHour, startMinute, 0, DateTimeKind.Unspecified);
        var localScheduleEnd = new DateTime(baseDate.Year, baseDate.Month, baseDate.Day, endHour, endMinute, 0, DateTimeKind.Unspecified);

        // Handle case where end time is next day (e.g., 2300-0100)
        if (localScheduleEnd <= localScheduleStart)
        {
            localScheduleEnd = localScheduleEnd.AddDays(1);
        }

        // Convert from user's timezone to UTC for storage
        var utcScheduleStart = _timezoneService.ConvertToUtc(localScheduleStart, userTimezone);
        var utcScheduleEnd = _timezoneService.ConvertToUtc(localScheduleEnd, userTimezone);

        return (utcScheduleStart, utcScheduleEnd);
    }

    /// <summary>
    /// Converts route DateTime fields from UTC to user's local timezone for display
    /// </summary>
    public async Task<Models.Route> ConvertRouteTimesToUserTimezoneAsync(Models.Route route, string userId)
    {
        try
        {
            var user = await _userService.GetUserByIdAsync(userId);
            var userTimezone = user?.Settings?.TimeZone ?? "UTC";

            if (userTimezone == "UTC")
                return route; // No conversion needed

            // Create a copy to avoid modifying the original
            var localRoute = new Models.Route
            {
                Id = route.Id,
                UserId = route.UserId,
                WorkType = route.WorkType,
                WorkTypeId = route.WorkTypeId,
                Status = route.Status,
                ScheduleStart = _timezoneService.ConvertFromUtc(route.ScheduleStart, userTimezone),
                ScheduleEnd = _timezoneService.ConvertFromUtc(route.ScheduleEnd, userTimezone),
                ActualStartTime = route.ActualStartTime.HasValue ? _timezoneService.ConvertFromUtc(route.ActualStartTime.Value, userTimezone) : null,
                ActualEndTime = route.ActualEndTime.HasValue ? _timezoneService.ConvertFromUtc(route.ActualEndTime.Value, userTimezone) : null,
                Incomes = route.Incomes,
                TotalIncome = route.TotalIncome,
                EstimatedIncome = route.EstimatedIncome,
                Distance = route.Distance,
                StartMile = route.StartMile,
                EndMile = route.EndMile,
                CreatedAt = route.CreatedAt, // Keep UTC for audit purposes
                UpdatedAt = route.UpdatedAt   // Keep UTC for audit purposes
            };

            return localRoute;
        }
        catch (Exception)
        {
            // If timezone conversion fails, return original route
            return route;
        }
    }

    /// <summary>
    /// Converts multiple routes from UTC to user's local timezone for display
    /// </summary>
    public async Task<List<Models.Route>> ConvertRoutesTimesToUserTimezoneAsync(List<Models.Route> routes, string userId)
    {
        var convertedRoutes = new List<Models.Route>();
        foreach (var route in routes)
        {
            var convertedRoute = await ConvertRouteTimesToUserTimezoneAsync(route, userId);
            convertedRoutes.Add(convertedRoute);
        }
        return convertedRoutes;
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
        // Ensure date-only comparison by setting time components
        var startOfStartDate = startDate.Date; // 00:00:00.000
        var endOfEndDate = endDate.Date.AddDays(1).AddTicks(-1); // 23:59:59.999 of endDate
        
        return await _routes.Find(r => r.UserId == userId && 
                                     r.ScheduleStart >= startOfStartDate && 
                                     r.ScheduleStart <= endOfEndDate)
            .SortByDescending(r => r.ScheduleStart)
            .ToListAsync();
    }
}