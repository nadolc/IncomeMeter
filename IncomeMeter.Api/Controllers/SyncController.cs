using System.Linq.Expressions;
using System.Text.Json;
using IncomeMeter.Api.Models;
using IncomeMeter.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;

namespace IncomeMeter.Api.Controllers;

/// <summary>
/// Two-way sync for the offline-first Expo app. The app creates records with ObjectId-shaped ids, so a
/// record keeps the same id on both sides. One call pushes the device's pending changes and returns
/// everything changed on the server since the device last synced (last write wins on UpdatedAt).
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(AuthenticationSchemes = "Bearer")]
public class SyncController : ControllerBase
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly MongoDbContext _db;
    private readonly ILogger<SyncController> _logger;

    public SyncController(MongoDbContext db, ILogger<SyncController> logger)
    {
        _db = db;
        _logger = logger;
    }

    public class SyncRequest
    {
        /// <summary>Server time returned by the previous sync; null for a full download.</summary>
        public DateTime? Since { get; set; }
        public Dictionary<string, List<JsonElement>> Changes { get; set; } = new();
        public Dictionary<string, List<string>> Deletions { get; set; } = new();
        public List<JsonElement> Locations { get; set; } = new();
    }

    [HttpPost]
    public async Task<IActionResult> Sync([FromBody] SyncRequest request, CancellationToken ct)
    {
        var userId = this.CurrentUserId();
        if (userId == null) return Unauthorized(new { error = "Unauthorized" });

        // Taken before any write so changes made during this call are picked up next time.
        var serverTime = DateTime.UtcNow;
        var accepted = new Dictionary<string, List<string>>();
        var rejected = new Dictionary<string, List<string>>();

        // ---- push ----
        await Push("routes", _db.Routes, request, userId, id => r => r.Id == id, r => r.Id, r => r.UserId, (r, u) => r.UserId = u, r => r.UpdatedAt, accepted, rejected, ct);
        await Push("vehicles", _db.Vehicles, request, userId, id => v => v.Id == id, v => v.Id, v => v.UserId, (v, u) => v.UserId = u, v => v.UpdatedAt, accepted, rejected, ct);
        await Push("expenses", _db.Expenses, request, userId, id => e => e.Id == id, e => e.Id, e => e.UserId, (e, u) => e.UserId = u, e => e.UpdatedAt, accepted, rejected, ct);
        await Push("odometerReadings", _db.OdometerReadings, request, userId, id => o => o.Id == id, o => o.Id, o => o.UserId, (o, u) => o.UserId = u, o => o.UpdatedAt, accepted, rejected, ct);
        await Push("workTypes", _db.WorkTypeConfigs, request, userId, id => w => w.Id == id, w => w.Id, w => w.UserId, (w, u) => w.UserId = u, w => w.UpdatedAt, accepted, rejected, ct);

        await Delete("routes", _db.Routes, request, userId, ids => r => ids.Contains(r.Id!) && r.UserId == userId, accepted, ct);
        await Delete("vehicles", _db.Vehicles, request, userId, ids => v => ids.Contains(v.Id!) && v.UserId == userId, accepted, ct);
        await Delete("expenses", _db.Expenses, request, userId, ids => e => ids.Contains(e.Id!) && e.UserId == userId, accepted, ct);
        await Delete("odometerReadings", _db.OdometerReadings, request, userId, ids => o => ids.Contains(o.Id!) && o.UserId == userId, accepted, ct);
        await Delete("workTypes", _db.WorkTypeConfigs, request, userId, ids => w => ids.Contains(w.Id) && w.UserId == userId, accepted, ct);
        if (request.Deletions.TryGetValue("routes", out var deletedRoutes) && deletedRoutes.Count > 0)
        {
            var valid = deletedRoutes.Where(id => ObjectId.TryParse(id, out _)).ToList();
            await _db.Locations.DeleteManyAsync(l => valid.Contains(l.RouteId) && l.UserId == userId, ct);
        }

        var locationIds = await PushLocations(request.Locations, userId, ct);

        // ---- pull ----
        var since = request.Since ?? DateTime.MinValue;
        var response = new
        {
            serverTime,
            accepted,
            rejected,
            acceptedLocations = locationIds,
            changes = new
            {
                routes = await _db.Routes.Find(r => r.UserId == userId && r.UpdatedAt > since).ToListAsync(ct),
                vehicles = await _db.Vehicles.Find(v => v.UserId == userId && v.UpdatedAt > since).ToListAsync(ct),
                expenses = await _db.Expenses.Find(e => e.UserId == userId && e.UpdatedAt > since).ToListAsync(ct),
                odometerReadings = await _db.OdometerReadings.Find(o => o.UserId == userId && o.UpdatedAt > since).ToListAsync(ct),
                workTypes = await _db.WorkTypeConfigs.Find(w => w.UserId == userId && w.UpdatedAt > since).ToListAsync(ct),
                attachments = (await _db.Attachments.Find(a => a.UserId == userId && a.UploadedAt > since).ToListAsync(ct))
                    .Select(a => new { a.Id, a.FileName, a.ContentType, a.SizeBytes, a.TakenAt, a.Ocr, a.UploadedAt })
            },
            // Every id the server holds, so the device can drop records deleted on the web.
            ids = new
            {
                routes = await _db.Routes.Find(r => r.UserId == userId).Project(r => r.Id).ToListAsync(ct),
                vehicles = await _db.Vehicles.Find(v => v.UserId == userId).Project(v => v.Id).ToListAsync(ct),
                expenses = await _db.Expenses.Find(e => e.UserId == userId).Project(e => e.Id).ToListAsync(ct),
                odometerReadings = await _db.OdometerReadings.Find(o => o.UserId == userId).Project(o => o.Id).ToListAsync(ct),
                workTypes = await _db.WorkTypeConfigs.Find(w => w.UserId == userId).Project(w => w.Id).ToListAsync(ct)
            }
        };

        _logger.LogInformation("Sync for user {UserId}: pushed {Pushed} records, {Locations} locations",
            userId[..Math.Min(8, userId.Length)] + "***", accepted.Values.Sum(v => v.Count), locationIds.Count);
        return Ok(response);
    }

    private async Task Push<T>(
        string name, IMongoCollection<T> collection, SyncRequest request, string userId,
        Func<string, Expression<Func<T, bool>>> byId, Func<T, string?> getId, Func<T, string> getUser, Action<T, string> setUser,
        Func<T, DateTime> getUpdated, Dictionary<string, List<string>> accepted, Dictionary<string, List<string>> rejected, CancellationToken ct)
    {
        if (!request.Changes.TryGetValue(name, out var items) || items.Count == 0) return;
        var ok = accepted[name] = new List<string>();
        var bad = rejected[name] = new List<string>();

        foreach (var item in items)
        {
            T? doc;
            try { doc = item.Deserialize<T>(Json); }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Sync: could not read a {Collection} record", name);
                continue;
            }
            var id = doc == null ? null : getId(doc);
            if (doc == null || id == null || !ObjectId.TryParse(id, out _))
            {
                if (id != null) bad.Add(id);
                continue;
            }

            var existing = await collection.Find(byId(id)).FirstOrDefaultAsync(ct);
            if (existing != null && getUser(existing) != userId)
            {
                bad.Add(id);          // id belongs to someone else – never overwrite
                continue;
            }
            if (existing != null && getUpdated(existing) > getUpdated(doc))
            {
                ok.Add(id);           // server copy is newer; the device receives it in the pull below
                continue;
            }

            setUser(doc, userId);
            await collection.ReplaceOneAsync(byId(id), doc, new ReplaceOptions { IsUpsert = true }, ct);
            ok.Add(id);
        }
    }

    private static async Task Delete<T>(
        string name, IMongoCollection<T> collection, SyncRequest request, string userId,
        Func<List<string>, Expression<Func<T, bool>>> filter, Dictionary<string, List<string>> accepted, CancellationToken ct)
    {
        if (!request.Deletions.TryGetValue(name, out var ids) || ids.Count == 0) return;
        var valid = ids.Where(id => ObjectId.TryParse(id, out _)).ToList();
        if (valid.Count > 0) await collection.DeleteManyAsync(filter(valid), ct);
        if (!accepted.TryGetValue(name, out var list)) accepted[name] = list = new List<string>();
        list.AddRange(ids);   // report invalid ids as done too, so the device stops retrying them
    }

    private async Task<List<string>> PushLocations(List<JsonElement> items, string userId, CancellationToken ct)
    {
        var done = new List<string>();
        foreach (var item in items)
        {
            Location? loc;
            try { loc = item.Deserialize<Location>(Json); }
            catch (JsonException) { continue; }
            if (loc?.Id == null || !ObjectId.TryParse(loc.Id, out _) || !ObjectId.TryParse(loc.RouteId, out _)) continue;

            var existing = await _db.Locations.Find(l => l.Id == loc.Id).FirstOrDefaultAsync(ct);
            if (existing == null)
            {
                loc.UserId = userId;
                await _db.Locations.InsertOneAsync(loc, cancellationToken: ct);
            }
            if (existing == null || existing.UserId == userId) done.Add(loc.Id);
        }
        return done;
    }
}
