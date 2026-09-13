using IncomeMeter.Api.DTOs;
using IncomeMeter.Api.Models;
using MongoDB.Driver;

namespace IncomeMeter.Api.Services;

public interface IVehicleService
{
    Task<List<Vehicle>> GetVehiclesAsync(string userId, bool includeInactive = false);
    Task<Vehicle?> GetVehicleByIdAsync(string id, string userId);
    Task<Vehicle> CreateVehicleAsync(CreateVehicleDto dto, string userId);
    Task<Vehicle?> UpdateVehicleAsync(string id, UpdateVehicleDto dto, string userId);
    Task<bool> DeleteVehicleAsync(string id, string userId);
}

public class VehicleService : IVehicleService
{
    private static readonly string[] FinanceTypes = { "cash", "hp", "lease", "none" };

    private readonly IMongoCollection<Vehicle> _vehicles;

    public VehicleService(MongoDbContext context)
    {
        _vehicles = context.Vehicles;
    }

    public async Task<List<Vehicle>> GetVehiclesAsync(string userId, bool includeInactive = false)
    {
        var fb = Builders<Vehicle>.Filter;
        var filter = fb.Eq(v => v.UserId, userId);
        if (!includeInactive) filter &= fb.Eq(v => v.IsActive, true);
        return await _vehicles.Find(filter).SortByDescending(v => v.CreatedAt).ToListAsync();
    }

    public async Task<Vehicle?> GetVehicleByIdAsync(string id, string userId) =>
        await _vehicles.Find(v => v.Id == id && v.UserId == userId).FirstOrDefaultAsync();

    public async Task<Vehicle> CreateVehicleAsync(CreateVehicleDto dto, string userId)
    {
        Validate(dto.VehicleType, dto.ClaimMethod, dto.FinanceType);

        var vehicle = new Vehicle
        {
            UserId = userId,
            Registration = NormaliseRegistration(dto.Registration),
            Make = dto.Make?.Trim(),
            Model = dto.Model?.Trim(),
            VehicleType = dto.VehicleType,
            FuelType = dto.FuelType,
            Co2GPerKm = dto.Co2GPerKm,
            PurchaseDate = dto.PurchaseDate,
            PurchasePrice = dto.PurchasePrice,
            IsNew = dto.IsNew,
            FinanceType = dto.FinanceType,
            ClaimMethod = dto.ClaimMethod,
            ClaimMethodLockedFromTaxYear = dto.ClaimMethodLockedFromTaxYear,
            CapitalAllowancePoolBroughtForward = dto.CapitalAllowancePoolBroughtForward,
            PoolBroughtForwardTaxYear = dto.PoolBroughtForwardTaxYear,
            Notes = dto.Notes,
            IsActive = true
        };

        await _vehicles.InsertOneAsync(vehicle);
        return vehicle;
    }

    public async Task<Vehicle?> UpdateVehicleAsync(string id, UpdateVehicleDto dto, string userId)
    {
        var existing = await GetVehicleByIdAsync(id, userId);
        if (existing == null) return null;

        Validate(dto.VehicleType ?? existing.VehicleType, dto.ClaimMethod ?? existing.ClaimMethod, dto.FinanceType ?? existing.FinanceType);

        // HMRC: once the flat-rate method has been used for a vehicle in a filed return it cannot be changed for that vehicle.
        if (dto.ClaimMethod != null && dto.ClaimMethod != existing.ClaimMethod
            && existing.ClaimMethod == ClaimMethods.Mileage && existing.ClaimMethodLockedFromTaxYear.HasValue)
        {
            throw new ArgumentException(
                $"This vehicle has used the flat-rate mileage method since tax year {existing.ClaimMethodLockedFromTaxYear}/{(existing.ClaimMethodLockedFromTaxYear + 1) % 100:00}. " +
                "HMRC does not allow switching to actual costs for the same vehicle.");
        }

        if (dto.Registration != null) existing.Registration = NormaliseRegistration(dto.Registration);
        if (dto.Make != null) existing.Make = dto.Make.Trim();
        if (dto.Model != null) existing.Model = dto.Model.Trim();
        if (dto.VehicleType != null) existing.VehicleType = dto.VehicleType;
        if (dto.FuelType != null) existing.FuelType = dto.FuelType;
        if (dto.Co2GPerKm.HasValue) existing.Co2GPerKm = dto.Co2GPerKm;
        if (dto.PurchaseDate.HasValue) existing.PurchaseDate = dto.PurchaseDate;
        if (dto.PurchasePrice.HasValue) existing.PurchasePrice = dto.PurchasePrice;
        if (dto.IsNew.HasValue) existing.IsNew = dto.IsNew.Value;
        if (dto.FinanceType != null) existing.FinanceType = dto.FinanceType;
        if (dto.ClaimMethod != null) existing.ClaimMethod = dto.ClaimMethod;
        if (dto.ClaimMethodLockedFromTaxYear.HasValue) existing.ClaimMethodLockedFromTaxYear = dto.ClaimMethodLockedFromTaxYear;
        if (dto.CapitalAllowancePoolBroughtForward.HasValue) existing.CapitalAllowancePoolBroughtForward = dto.CapitalAllowancePoolBroughtForward;
        if (dto.PoolBroughtForwardTaxYear.HasValue) existing.PoolBroughtForwardTaxYear = dto.PoolBroughtForwardTaxYear;
        if (dto.IsActive.HasValue) existing.IsActive = dto.IsActive.Value;
        if (dto.Notes != null) existing.Notes = dto.Notes;
        existing.UpdatedAt = DateTime.UtcNow;

        await _vehicles.ReplaceOneAsync(v => v.Id == id && v.UserId == userId, existing);
        return existing;
    }

    public async Task<bool> DeleteVehicleAsync(string id, string userId)
    {
        var result = await _vehicles.DeleteOneAsync(v => v.Id == id && v.UserId == userId);
        return result.DeletedCount > 0;
    }

    private static void Validate(string vehicleType, string claimMethod, string financeType)
    {
        if (!VehicleTypes.All.Contains(vehicleType)) throw new ArgumentException($"Invalid vehicleType: {vehicleType}");
        if (!ClaimMethods.All.Contains(claimMethod)) throw new ArgumentException($"Invalid claimMethod: {claimMethod}");
        if (!FinanceTypes.Contains(financeType)) throw new ArgumentException($"Invalid financeType: {financeType}");
    }

    private static string NormaliseRegistration(string reg) =>
        new string(reg.Where(c => !char.IsWhiteSpace(c)).ToArray()).ToUpperInvariant();
}
