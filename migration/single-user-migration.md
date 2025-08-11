# Single-User to Multi-User Migration Strategy

## Current Google OAuth Setup
From your AuthController.cs, you're already extracting:
- `googleId` - Google's unique identifier for the user
- `email` - User's email address  
- `displayName` - User's display name

## User ID Strategy

### Option 1: Use Google ID directly (Recommended)
- **userId = Google ID** (e.g., "108765432109876543210")
- This is what your current code already uses for `user.GoogleId`
- Unique, permanent, and directly tied to Google OAuth

### Option 2: Use your database user ID
- **userId = Your generated user ID** (e.g., ObjectId from your User collection)
- This is what your code uses for `user.Id`
- More flexible if you support multiple auth providers later

## Migration Script Modifications

Since your current data has NO userId fields, you need to:

1. **Choose a default userId for existing data**
2. **Add userId to all existing documents**
3. **Set up proper partition keys**