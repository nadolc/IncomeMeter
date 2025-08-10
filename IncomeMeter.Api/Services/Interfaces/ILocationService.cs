using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

public interface ILocationService
{
    Task<List<Location>> GetLocationsByRouteIdAsync(string routeId, string userId);
    Task<Location?> AddLocationAsync(CreateLocationDto locationDto, string userId);
}