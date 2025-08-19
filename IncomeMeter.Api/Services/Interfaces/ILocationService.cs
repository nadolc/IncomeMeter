using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

public interface ILocationService
{
    Task<List<Location>> GetLocationsByRouteIdAsync(string routeId, string userId);
    Task<Location?> GetLocationByIdAsync(string id, string userId);
    Task<Location?> AddLocationAsync(CreateLocationDto locationDto, string userId);
    Task<Location?> AddLocationFromIOSAsync(CreateLocationIOSDto locationDto, string userId);
    Task<Location?> UpdateLocationAsync(string id, UpdateLocationDto locationDto, string userId);
    Task<bool> DeleteLocationAsync(string id, string userId);
    Task<bool> DeleteLocationsByRouteIdAsync(string routeId, string userId);
}