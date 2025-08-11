# MongoDB Queries to Find User Information

## Connect to MongoDB
```bash
# If using local MongoDB
mongo

# If using MongoDB with authentication
mongo "mongodb://username:password@server:27017/database"

# If using MongoDB Atlas
mongo "mongodb+srv://username:password@cluster.mongodb.net/database"
```

## Check Users Collection
```javascript
// Switch to your database
use your-database-name

// Check if users collection exists
show collections

// Find all users
db.users.find().pretty()

// Find users with specific fields only
db.users.find({}, {googleId: 1, email: 1, displayName: 1, _id: 1}).pretty()

// Count total users
db.users.count()
```

## Sample Output
```javascript
{
    "_id": ObjectId("507f1f77bcf86cd799439011"),
    "googleId": "108765432109876543210",
    "email": "user@gmail.com", 
    "displayName": "John Doe",
    "createdAt": ISODate("2024-01-10T10:30:00Z")
}
```

## If No Users Collection Exists
If there's no users collection, you have two options:

### Option 1: Create a default user ID
```csharp
// Use a default identifier in your migration
private static readonly string DefaultUserId = "default-user-123";
```

### Option 2: Use your email as user ID
```csharp
// Use your Google account email
private static readonly string DefaultUserId = "your-email@gmail.com";
```