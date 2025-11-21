# restart_backend.ps1
# Quickly restart the FastAPI backend (uvicorn).

$ErrorActionPreference = "Stop"

Write-Host "=== Restarting FastAPI backend ===" -ForegroundColor Cyan

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $ScriptDir "fastapi-backend"

if (!(Test-Path $backendDir)) {
    Write-Host "ERROR: fastapi-backend directory not found at $backendDir" -ForegroundColor Red
    exit 1
}

# Kill existing uvicorn processes
Write-Host "Stopping existing uvicorn processes (if any)..." -ForegroundColor Yellow
Get-Process -Name "uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

# Start new backend window
$backendCommand = @"
cd "$backendDir"
Write-Host "Backend working dir: $(Get-Location)" -ForegroundColor DarkGray

if (Test-Path ".\venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtualenv..." -ForegroundColor DarkGray
    . .\venv\Scripts\Activate.ps1
}

Write-Host "Running: uvicorn main:app --host 0.0.0.0 --port 8088 --reload" -ForegroundColor DarkGray
uvicorn main:app --host 0.0.0.0 --port 8088 --reload
"@

$backendArgs = @(
    "-NoExit",
    "-Command",
    $backendCommand
)

Start-Process -FilePath "powershell" -ArgumentList $backendArgs `
    -WindowStyle Minimized

Write-Host "Backend restart requested - new server window launched." -ForegroundColor Green
