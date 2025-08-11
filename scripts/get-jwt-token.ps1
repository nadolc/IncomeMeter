# PowerShell script to help extract JWT token from browser
param(
    [string]$ApiUrl = "http://localhost:7079",
    [string]$FrontendUrl = "http://localhost:5173"
)

Write-Host "🔑 JWT Token Extraction Helper" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

Write-Host "`n📱 Step 1: Login Process" -ForegroundColor Yellow
Write-Host "1. Navigate to: $FrontendUrl" -ForegroundColor White
Write-Host "2. Login with Google OAuth" -ForegroundColor White
Write-Host "3. Open Browser DevTools (F12)" -ForegroundColor White

Write-Host "`n🔍 Step 2: Find Token (Choose one method)" -ForegroundColor Yellow

Write-Host "`n   Method A - Console:" -ForegroundColor Cyan
Write-Host "   Type: localStorage.getItem('accessToken')" -ForegroundColor White

Write-Host "`n   Method B - Application Tab:" -ForegroundColor Cyan
Write-Host "   Go to: Application → Local Storage → $FrontendUrl" -ForegroundColor White
Write-Host "   Look for: accessToken, token, jwt, authToken" -ForegroundColor White

Write-Host "`n   Method C - Network Tab:" -ForegroundColor Cyan
Write-Host "   Look for: auth-callback request" -ForegroundColor White
Write-Host "   Check: Response or URL parameters" -ForegroundColor White

Write-Host "`n🧪 Step 3: Test Token" -ForegroundColor Yellow
Write-Host "Once you have the token, test it with:" -ForegroundColor White
Write-Host "curl -H `"Authorization: Bearer YOUR_TOKEN`" $ApiUrl/api/auth/debug/user-info" -ForegroundColor Gray

Write-Host "`n💡 Alternative: Check the debug widget" -ForegroundColor Yellow
Write-Host "Look for the yellow debug panel in bottom-right corner of your app" -ForegroundColor White

Write-Host "`n📝 Token Format:" -ForegroundColor Yellow
Write-Host "- JWT tokens are long strings with dots (.) separating 3 parts" -ForegroundColor White
Write-Host "- Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" -ForegroundColor Gray

Read-Host "`nPress Enter to continue..."