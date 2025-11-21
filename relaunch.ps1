# relaunch.ps1
# One-click launcher for The Local Build
# - Starts FastAPI backend in its own window
# - Starts Vite/React frontend in its own window
# - Opens browser to the correct port

$ErrorActionPreference = "Stop"

Write-Host "=== The Local launcher starting ===" -ForegroundColor Cyan

# Resolve paths based on where this script lives (handles spaces in folder names)
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $Root "admin-panel-frontend"
$backendPath  = Join-Path $Root "fastapi-backend"

Write-Host "Root folder: $Root" -ForegroundColor DarkGray
Write-Host "Frontend:   $frontendPath" -ForegroundColor DarkGray
Write-Host "Backend:    $backendPath" -ForegroundColor DarkGray

# ---------- Start backend ----------
if (Test-Path $backendPath) {
    $backendCommand = @"
Write-Host 'Starting FastAPI backend...' -ForegroundColor Cyan
if (-not (Test-Path '.venv')) {
    Write-Host 'Creating virtual environment (.venv)...' -ForegroundColor Yellow
    python -m venv .venv
}
Write-Host 'Activating virtual environment...' -ForegroundColor Yellow
. .\.venv\Scripts\Activate.ps1

if (Test-Path 'requirements.txt') {
    Write-Host 'Installing backend requirements (if needed)...' -ForegroundColor Yellow
    pip install -r requirements.txt
}

Write-Host 'Launching uvicorn (FastAPI)...' -ForegroundColor Cyan
uvicorn main:app --reload
"@

    Start-Process powershell `
        -WorkingDirectory $backendPath `
        -WindowStyle Minimized `
        -ArgumentList "-ExecutionPolicy Bypass -NoExit -Command $backendCommand"
}
else {
    Write-Host "WARNING: Backend folder not found at $backendPath" -ForegroundColor Yellow
}

# ---------- Start frontend ----------
if (Test-Path $frontendPath) {
    $frontendCommand = @"
Write-Host 'Starting frontend (Vite/React)...' -ForegroundColor Cyan
if (-not (Test-Path 'package.json')) {
    Write-Host 'ERROR: package.json not found in $frontendPath' -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}

if (-not (Test-Path 'node_modules')) {
    Write-Host 'Installing npm packages (this may take a moment)...' -ForegroundColor Yellow
    npm install
}

Write-Host 'Launching Vite dev server on http://localhost:5173 ...' -ForegroundColor Cyan
npm run dev -- --port 5173
"@

    Start-Process powershell `
        -WorkingDirectory $frontendPath `
        -WindowStyle Minimized `
        -ArgumentList "-ExecutionPolicy Bypass -NoExit -Command $frontendCommand"
}
else {
    Write-Host "WARNING: Frontend folder not found at $frontendPath" -ForegroundColor Yellow
}

# ---------- Open browser ----------
Write-Host "Waiting for frontend to boot..." -ForegroundColor Cyan
Start-Sleep -Seconds 6

$frontendUrl = "http://localhost:5173"
Write-Host "Opening $frontendUrl" -ForegroundColor Green
Start-Process $frontendUrl

Write-Host "=== Launcher done. Backend + frontend are running in separate windows. ===" -ForegroundColor Green
