# How to Get Your Google User ID

## Method 1: From Your Current MongoDB User Table

If you already have users in your MongoDB:

```bash
# Connect to MongoDB and query users collection
db.users.find({}, {googleId: 1, email: 1, displayName: 1})
```

## Method 2: Login Through Your App and Check Browser

1. Run your application locally
2. Login with Google OAuth
3. Open browser Developer Tools (F12)
4. In Network tab, look for the auth callback request
5. Check the JWT token payload or response data

## Method 3: Add Logging to Your AuthController

Temporarily add logging to see the Google ID:

```csharp
[HttpGet("google-callback")]
public async Task<IActionResult> GoogleCallback()
{
    var result = await HttpContext.AuthenticateAsync();
    
    var googleId = result.Principal!.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    var email = result.Principal!.FindFirst(ClaimTypes.Email)?.Value;
    
    // TEMPORARY: Log the Google ID for migration
    Console.WriteLine($"🔍 Google ID: {googleId}");
    Console.WriteLine($"📧 Email: {email}");
    
    // ... rest of your existing code
}
```

## Method 4: Direct Google API Call

```csharp
// Add this temporary endpoint to get your Google ID
[HttpGet("debug/google-info")]
[Authorize(AuthenticationSchemes = "Bearer")]
public IActionResult GetGoogleInfo()
{
    var googleId = User.FindFirst("google_id")?.Value;
    var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    var email = User.FindFirst(ClaimTypes.Email)?.Value;
    
    return Ok(new {
        GoogleId = googleId,
        UserId = userId,
        Email = email
    });
}
```

## What the Google ID Looks Like

Google IDs are typically:
- **Format**: Long numeric string (21 digits)
- **Example**: `108765432109876543210`
- **Unique**: Never changes for a user
- **Stable**: Same across all Google services

## Alternative: Use Email as User ID

If you prefer using email:

```csharp
// In migration script, use email instead
private static readonly string DefaultUserId = "your-email@gmail.com";
```

**Pros of Email:**
- ✅ Human readable
- ✅ Easy to identify
- ✅ Works well for single user

**Cons of Email:**
- ❌ Can change (rare but possible)
- ❌ Less secure (publicly visible)
- ❌ Longer string (affects performance slightly)

## Recommended Migration Strategy

1. **Get your Google ID** using one of the methods above
2. **Update the migration script** with your Google ID
3. **Test with small dataset** first
4. **Run full migration** 
5. **Update your API** to properly handle userId in queries

Example after getting Google ID:

```csharp
// In Program.cs, replace this line:
private static readonly string DefaultUserId = "YOUR_GOOGLE_USER_ID_HERE";

// With your actual Google ID:
private static readonly string DefaultUserId = "108765432109876543210";
```