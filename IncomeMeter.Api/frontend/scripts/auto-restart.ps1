# Auto-restart frontend when new pages are added
param(
    [string]$WatchPath = "src/components/Pages",
    [int]$RestartDelay = 3000
)

$frontendPath = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)
Set-Location $frontendPath

Write-Host "🔍 Watching for new pages in: $WatchPath" -ForegroundColor Green
Write-Host "🔄 Will restart dev server when new .tsx files are added" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop watching" -ForegroundColor Gray

# Start the dev server in background
$devServerJob = Start-Job -ScriptBlock {
    Set-Location $using:frontendPath
    npm run dev
}

Write-Host "📱 Dev server started (Job ID: $($devServerJob.Id))" -ForegroundColor Cyan

# File system watcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = Join-Path $frontendPath $WatchPath
$watcher.Filter = "*.tsx"
$watcher.EnableRaisingEvents = $true
$watcher.IncludeSubdirectories = $true

# Event handler for new files
$action = {
    $path = $Event.SourceEventArgs.FullPath
    $changeType = $Event.SourceEventArgs.ChangeType
    $fileName = Split-Path -Leaf $path
    
    if ($changeType -eq 'Created' -and $fileName -match '\.tsx$') {
        Write-Host "`n🆕 New page detected: $fileName" -ForegroundColor Yellow
        Write-Host "🔄 Restarting dev server in $($using:RestartDelay/1000) seconds..." -ForegroundColor Cyan
        
        Start-Sleep -Milliseconds $using:RestartDelay
        
        # Stop current dev server
        if ($using:devServerJob -and $using:devServerJob.State -eq 'Running') {
            Stop-Job $using:devServerJob -Force
            Remove-Job $using:devServerJob -Force
        }
        
        # Kill any remaining node processes
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { 
            $_.CommandLine -like "*vite*" 
        } | Stop-Process -Force -ErrorAction SilentlyContinue
        
        Start-Sleep -Seconds 2
        
        # Restart dev server
        $using:devServerJob = Start-Job -ScriptBlock {
            Set-Location $using:frontendPath
            npm run dev:force
        }
        
        Write-Host "✅ Dev server restarted (Job ID: $($using:devServerJob.Id))" -ForegroundColor Green
    }
}

# Register event handler
Register-ObjectEvent -InputObject $watcher -EventName "Created" -Action $action

try {
    # Keep script running
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Check if dev server job is still running
        if ($devServerJob -and $devServerJob.State -ne 'Running') {
            Write-Host "⚠️  Dev server stopped unexpectedly" -ForegroundColor Red
            break
        }
    }
}
finally {
    # Cleanup
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    
    if ($devServerJob) {
        Stop-Job $devServerJob -Force -ErrorAction SilentlyContinue
        Remove-Job $devServerJob -Force -ErrorAction SilentlyContinue
    }
    
    Write-Host "`n🛑 File watcher stopped" -ForegroundColor Red
}

# Usage:
# .\scripts\auto-restart.ps1                                    # Watch src/components/Pages
# .\scripts\auto-restart.ps1 -WatchPath "src/components"        # Watch different folder
# .\scripts\auto-restart.ps1 -RestartDelay 5000                # 5 second delay before restart