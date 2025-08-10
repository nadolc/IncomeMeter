using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;

namespace IncomeMeter.Api.Services;

public interface IRouteService
{
    Task<List<IncomeMeter.Api.Models.Route>> GetRoutesByUserIdAsync(string userId);
    Task<IncomeMeter.Api.Models.Route?> GetRouteByIdAsync(string id, string userId);
    Task<IncomeMeter.Api.Models.Route> CreateRouteAsync(CreateRouteDto routeDto, string userId);
    Task<IncomeMeter.Api.Models.Route?> StartRouteAsync(StartRouteDto routeDto, string userId);
    Task<IncomeMeter.Api.Models.Route?> EndRouteAsync(EndRouteDto routeDto, string userId);
    Task<IncomeMeter.Api.Models.Route?> UpdateRouteAsync(string id, IncomeMeter.Api.Models.Route updatedRoute, string userId);
    Task<bool> DeleteRouteAsync(string id, string userId);
}