<#
Start-All Script for The Local

Features:
 - Cleans existing python/node/uvicorn processes (optional).
 - Starts backend via tray runner (recommended) OR raw uvicorn.
 - Auto-installs frontend dependencies if node_modules missing.
 - Provides parameters for customization.

Parameters:
 -NoCleanup          Skip killing existing processes.
 -Uvicorn            Use uvicorn reload instead of tray_runner.
 -BackendOnly        Start only backend.
 -FrontendOnly       Start only frontend.
 -Ports "8000,8001"   Override BACKEND_PORTS env for tray runner.
 -LogMaxBytes 2097152 Set TRAY_LOG_MAX_BYTES env.
 -DryRun             Show actions without executing.

Examples:
  ./start_all.ps1
  ./start_all.ps1 -Uvicorn
  ./start_all.ps1 -Ports "8000,8001,8002" -LogMaxBytes 3145728
  ./start_all.ps1 -BackendOnly -Uvicorn
  ./start_all.ps1 -DryRun
#>

param(
    [switch]$NoCleanup,
    [switch]$Uvicorn,
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [string]$Ports,
    [int]$LogMaxBytes = 0,
    [switch]$Silent,
    [switch]$DryRun
)

function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Ok($msg) { Write-Host $msg -ForegroundColor Green }
function Err($msg) { Write-Host $msg -ForegroundColor Red }

Info "=== Launching The Local Environment ==="

$root = $PSScriptRoot
$backendPath = Join-Path $root 'fastapi-backend'
$frontendPath = Join-Path $root 'admin-panel-frontend'

function Cleanup {
    if ($NoCleanup) { Warn "Skipping cleanup."; return }
    Warn "Cleaning up existing python/node/uvicorn processes..."
    if ($DryRun) { return }
    Get-Process python, node, uvicorn -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

function Start-Backend {
    if ($FrontendOnly) { return }
    if ($Uvicorn) {
        Ok "Starting backend (uvicorn reload on port 8000)..."
        if ($DryRun) { return }
        $backendOut = Join-Path $root 'backend.out.log'
        $backendErr = Join-Path $root 'backend.err.log'
        if ($Silent) {
            $python = (Get-Command python).Source
            Start-Process -FilePath $python -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8000 --reload" -WorkingDirectory $backendPath -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr
        }
        else {
            Start-Process powershell -ArgumentList @('-NoExit', '-Command', "cd '$backendPath'; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload") -WindowStyle Normal
        }
    }
    else {
        $envCmd = ""
        if ($Ports) { $envCmd += "$env:BACKEND_PORTS='$Ports';" }
        if ($LogMaxBytes -gt 0) { $envCmd += "$env:TRAY_LOG_MAX_BYTES=$LogMaxBytes;" }
        Ok "Starting backend (tray runner)..."
        if ($DryRun) { return }
        $backendOut = Join-Path $root 'backend.out.log'
        $backendErr = Join-Path $root 'backend.err.log'
        if ($Silent) {
            $python = (Get-Command python).Source
            # apply env overrides in current session before spawn
            if ($Ports) { $env:BACKEND_PORTS = $Ports }
            if ($LogMaxBytes -gt 0) { $env:TRAY_LOG_MAX_BYTES = $LogMaxBytes }
            Start-Process -FilePath $python -ArgumentList "tray_runner.py" -WorkingDirectory $backendPath -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr
        }
        else {
            Start-Process powershell -ArgumentList @('-NoExit', '-Command', "cd '$backendPath'; $envCmd python tray_runner.py") -WindowStyle Normal
        }
    }
}

function Ensure-Frontend-Deps {
    if ($BackendOnly) { return }
    if (!(Test-Path (Join-Path $frontendPath 'package.json'))) { Err "package.json not found in frontend."; return }
    $modules = Join-Path $frontendPath 'node_modules'
    if (!(Test-Path $modules)) {
        Ok "Installing frontend dependencies (npm install)..."
        if ($DryRun) { return }
        Push-Location $frontendPath
        npm install
        Pop-Location
    }
}

function Start-Frontend {
    if ($BackendOnly) { return }
    Ok "Starting frontend (Vite dev server on port 5173)..."
    if ($DryRun) { return }
    $frontendOut = Join-Path $root 'frontend.out.log'
    $frontendErr = Join-Path $root 'frontend.err.log'
    if ($Silent) {
        $npm = (Get-Command npm).Source
        Start-Process -FilePath $npm -ArgumentList "run dev" -WorkingDirectory $frontendPath -WindowStyle Hidden -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr
    }
    else {
        Start-Process powershell -ArgumentList @('-NoExit', '-Command', "cd '$frontendPath'; npm run dev") -WindowStyle Normal
    }
}

Cleanup
Ensure-Frontend-Deps
Start-Backend
Start-Frontend

Write-Host ""; Info "=== Launch Requests ==="; Write-Host ""
if (-not $FrontendOnly) { Write-Host "Backend Docs:  http://localhost:8000/docs (or chosen fallback)" -ForegroundColor White }
if (-not $BackendOnly) { Write-Host "Frontend UI:   http://localhost:5173" -ForegroundColor White }
Warn "If tray runner chooses a different port (e.g. 8001), update frontend API base or rely on relative proxy." 
Write-Host ""
if ($Silent) {
    Ok "Done. Silent mode enabled. Logs: backend.out.log/backend.err.log & frontend.out.log/frontend.err.log"
}
else {
    Ok "Done. Monitor tray icon and PowerShell windows for logs."
}
