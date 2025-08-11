# Check existing users in MongoDB
param(
    [Parameter(Mandatory=$true)]
    [string]$MongoConnectionString,
    
    [Parameter(Mandatory=$true)]
    [string]$DatabaseName
)

Write-Host "Checking existing users in MongoDB..." -ForegroundColor Green

# Export users collection to see what's there
$outputFile = "existing-users.json"
$mongoExportCmd = "mongoexport --uri `"$MongoConnectionString/$DatabaseName`" --collection users --out `"$outputFile`""

Write-Host "Running: $mongoExportCmd" -ForegroundColor Yellow
Invoke-Expression $mongoExportCmd

if (Test-Path $outputFile) {
    Write-Host "`nExisting users:" -ForegroundColor Green
    $users = Get-Content $outputFile | ConvertFrom-Json
    
    if ($users) {
        foreach ($user in $users) {
            Write-Host "===================" -ForegroundColor Cyan
            Write-Host "User ID: $($user._id)" -ForegroundColor White
            Write-Host "Google ID: $($user.googleId)" -ForegroundColor Yellow
            Write-Host "Email: $($user.email)" -ForegroundColor White
            Write-Host "Name: $($user.displayName)" -ForegroundColor White
            Write-Host "===================" -ForegroundColor Cyan
        }
        
        # If there's only one user, suggest using it
        if ($users.Count -eq 1) {
            Write-Host "`n🎯 RECOMMENDED FOR MIGRATION:" -ForegroundColor Green
            if ($users.googleId) {
                Write-Host "Use Google ID: $($users.googleId)" -ForegroundColor Yellow
            } else {
                Write-Host "Use Email: $($users.email)" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "No users found in the database." -ForegroundColor Red
    }
    
    # Cleanup
    Remove-Item $outputFile -Force
} else {
    Write-Host "Failed to export users collection." -ForegroundColor Red
}

# Usage example:
# .\check-existing-users.ps1 -MongoConnectionString "mongodb://username:password@server:27017" -DatabaseName "your-database"