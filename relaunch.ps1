#!/usr/bin/env pwsh
# Relaunch FastAPI Backend Server
# Usage: ./relaunch.ps1

Write-Host "=== FastAPI Backend Relaunch Tool ===" -ForegroundColor Cyan

# Stop any running backend processes
Write-Host "`nStopping existing backend processes..." -ForegroundColor Yellow
$procs = Get-CimInstance Win32_Process | Where-Object { 
    $_.CommandLine -like '*fastapi-backend*main.py*' -or
    $_.CommandLine -like '*uvicorn*main:app*' -or
    ($_.Name -eq 'python.exe' -and $_.CommandLine -like '*main.py*')
}

$stopped = 0
foreach ($p in $procs) {
    try {
        $cmdLine = $p.CommandLine
        if ($cmdLine -like '*fastapi-backend*' -or $cmdLine -like '*uvicorn*') {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Stopped PID $($p.ProcessId)" -ForegroundColor Green
            $stopped++
        }
    } catch {
        Write-Host "  ! Could not stop PID $($p.ProcessId)" -ForegroundColor Red
    }
}

if ($stopped -eq 0) {
    Write-Host "  No existing processes found" -ForegroundColor Gray
}

# Wait for cleanup
Start-Sleep -Seconds 1

# Start backend
Write-Host "`nStarting backend server..." -ForegroundColor Yellow
$pythonPath = "C:/Users/Chance/AppData/Local/Programs/Python/Python312/python.exe"
$mainPath = "c:\Users\Chance\Downloads\fastapi-backend\main.py"

try {
    Start-Process -FilePath $pythonPath -ArgumentList $mainPath -WindowStyle Hidden -WorkingDirectory "c:\Users\Chance\Downloads\fastapi-backend"
    Write-Host "  ✓ Backend process started" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to start backend: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Wait for server to initialize
Write-Host "`nWaiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Verify health endpoint
Write-Host "`nChecking health endpoint..." -ForegroundColor Yellow
$maxRetries = 5
$retryCount = 0
$healthy = $false

while ($retryCount -lt $maxRetries -and -not $healthy) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 2
        if ($response.StatusCode -eq 200) {
            $content = $response.Content | ConvertFrom-Json
            Write-Host "  ✓ Server is healthy: $($content.status)" -ForegroundColor Green
            $healthy = $true
        }
    } catch {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Host "  ⟳ Retry $retryCount/$maxRetries..." -ForegroundColor Gray
            Start-Sleep -Seconds 1
        }
    }
}

if (-not $healthy) {
    Write-Host "  ✗ Health check failed after $maxRetries attempts" -ForegroundColor Red
    Write-Host "  The server may still be starting. Check logs manually." -ForegroundColor Yellow
} else {
    Write-Host "`n=== Backend is running ===" -ForegroundColor Cyan
    Write-Host "  API: http://127.0.0.1:8000/api" -ForegroundColor White
    Write-Host "  Tailscale: http://home-hub:8000/api" -ForegroundColor White
    Write-Host "  Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
}
