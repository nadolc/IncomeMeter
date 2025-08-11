# API Updates for Multi-User Support

After migration, you'll need to update your API methods to include userId filtering.

## Example Service Updates

### Before (Single User)
```csharp
public async Task<List<Route>> GetRoutesAsync()
{
    return await _routes.Find(r => true).ToListAsync();
}

public async Task<List<Transaction>> GetTransactionsAsync()
{
    return await _transactions.Find(t => true).ToListAsync();
}
```

### After (Multi-User)
```csharp
public async Task<List<Route>> GetRoutesAsync(string userId)
{
    return await _routes.Find(r => r.UserId == userId).ToListAsync();
}

public async Task<List<Transaction>> GetTransactionsAsync(string userId)
{
    return await _transactions.Find(t => t.UserId == userId).ToListAsync();
}
```

## Updated Controller Methods

### Before (Single User)
```csharp
[HttpGet("routes")]
public async Task<IActionResult> GetRoutes()
{
    var routes = await _routeService.GetRoutesAsync();
    return Ok(routes);
}
```

### After (Multi-User)
```csharp
[HttpGet("routes")]
[Authorize(AuthenticationSchemes = "Bearer")]
public async Task<IActionResult> GetRoutes()
{
    // Get user ID from JWT token
    var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    if (string.IsNullOrEmpty(userId))
    {
        return Unauthorized();
    }
    
    var routes = await _routeService.GetRoutesAsync(userId);
    return Ok(routes);
}
```

## Data Models Updates

Update your models to include UserId:

```csharp
public class Route
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty; // ADD THIS
    public string Name { get; set; } = string.Empty;
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public decimal EstimatedIncome { get; set; }
    public double Distance { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Transaction
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty; // ADD THIS
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public DateTime Date { get; set; }
}
```

## Cosmos DB Queries

With partition keys set up properly:

```csharp
// Efficient - uses partition key
public async Task<List<Route>> GetUserRoutesAsync(string userId)
{
    var query = new QueryDefinition(
        "SELECT * FROM c WHERE c.userId = @userId")
        .WithParameter("@userId", userId);
        
    var results = new List<Route>();
    var iterator = _container.GetItemQueryIterator<Route>(
        query, 
        requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });
        
    while (iterator.HasMoreResults)
    {
        var response = await iterator.ReadNextAsync();
        results.AddRange(response);
    }
    
    return results;
}
```