# GUID to ObjectId Migration Guide

## Overview
This migration addresses the change from GUID format user IDs to MongoDB ObjectId format for better performance and MongoDB compliance.

## Problem
- Previous implementation generated GUID format user IDs: `e3533329-951a-4448-9997-e0b4182abf7b`
- MongoDB ObjectId expects 24-digit hex format: `507f1f77bcf86cd799439011`
- Route queries fail when GUID format is stored but ObjectId format is expected

## Solution Applied

### 1. Fixed InMemoryUserService (Development)
**Before:**
```csharp
Id = Guid.NewGuid().ToString() // Generates GUID format
```

**After:**
```csharp
Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString() // Generates ObjectId format
```

### 2. Switched to MongoDB UserService
**Changed Program.cs to use MongoDB UserService in development:**
```csharp
// Before: InMemoryUserService (generated GUIDs)
builder.Services.AddSingleton<IUserService, InMemoryUserService>();

// After: MongoDB UserService (proper ObjectIds)
builder.Services.AddScoped<IUserService, UserService>();
```

### 3. Model Verification
All models properly configured with ObjectId representation:
- ✅ User.Id - `[BsonRepresentation(BsonType.ObjectId)]`
- ✅ Route.UserId - `[BsonRepresentation(BsonType.ObjectId)]`
- ✅ Transaction.UserId - `[BsonRepresentation(BsonType.ObjectId)]`

## Migration Script (If Needed)

If existing users have GUID format IDs, run this MongoDB migration:

```javascript
// Connect to MongoDB
use incomemeter;

// Find users with GUID format IDs (longer than 24 chars)
db.users.find({_id: {$regex: /^.{25,}$/}}).forEach(function(user) {
    // Generate new ObjectId
    var newId = ObjectId();
    var oldId = user._id;
    
    // Create new user document with ObjectId
    user._id = newId;
    db.users.insert(user);
    
    // Update all related collections
    db.routes.updateMany({userId: oldId}, {$set: {userId: newId.str}});
    db.transactions.updateMany({userId: oldId}, {$set: {userId: newId.str}});
    
    // Remove old user document
    db.users.deleteOne({_id: oldId});
    
    print("Migrated user " + oldId + " to " + newId);
});
```

## Testing
1. **OAuth Login**: Should create users with proper ObjectId format
2. **Route Operations**: Should work without format exceptions
3. **JWT Claims**: ClaimTypes.NameIdentifier contains ObjectId string

## Performance Benefits
- **Index Size**: 66% smaller (12 bytes vs 36 bytes)
- **Query Speed**: Native BSON type optimization
- **Memory Usage**: Reduced memory footprint
- **Built-in Ordering**: ObjectIds have timestamp ordering