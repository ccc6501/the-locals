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
        $backendLog = Join-Path $root 'backend.log'
        if ($Silent) {
            $style = 'Hidden'
            $noExit = ''
            $redir = " *>& '$backendLog'"
        } else {
            $style = 'Normal'
            $noExit = '-NoExit'
            $redir = ''
        }
        $cmd = "cd '$backendPath'; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload$redir"
        if ($Silent) {
            Start-Process powershell -ArgumentList @('-Command', $cmd) -WindowStyle $style
        } else {
            Start-Process powershell -ArgumentList @('-NoExit','-Command', $cmd) -WindowStyle $style
        }
    }
    else {
        $envCmd = ""
        if ($Ports) { $envCmd += "$env:BACKEND_PORTS='$Ports';" }
        if ($LogMaxBytes -gt 0) { $envCmd += "$env:TRAY_LOG_MAX_BYTES=$LogMaxBytes;" }
        Ok "Starting backend (tray runner)..."
        if ($DryRun) { return }
        $backendLog = Join-Path $root 'backend.log'
        if ($Silent) {
            $style = 'Hidden'
            $noExit = ''
            $redir = " *>& '$backendLog'"
        } else {
            $style = 'Normal'
            $noExit = '-NoExit'
            $redir = ''
        }
        $cmd = "cd '$backendPath'; $envCmd python tray_runner.py$redir"
        if ($Silent) {
            Start-Process powershell -ArgumentList @('-Command', $cmd) -WindowStyle $style
        } else {
            Start-Process powershell -ArgumentList @('-NoExit','-Command', $cmd) -WindowStyle $style
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
    $frontendLog = Join-Path $root 'frontend.log'
    if ($Silent) {
        $style = 'Hidden'
        $noExit = ''
        $redir = " *>& '$frontendLog'"
    } else {
        $style = 'Normal'
        $noExit = '-NoExit'
        $redir = ''
    }
    $cmd = "cd '$frontendPath'; npm run dev$redir"
    if ($Silent) {
        Start-Process powershell -ArgumentList @('-Command', $cmd) -WindowStyle $style
    } else {
        Start-Process powershell -ArgumentList @('-NoExit','-Command', $cmd) -WindowStyle $style
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
    Ok "Done. Silent mode enabled. Logs: $(Join-Path $root 'backend.log'), $(Join-Path $root 'frontend.log')"
} else {
    Ok "Done. Monitor tray icon and PowerShell windows for logs."
}
