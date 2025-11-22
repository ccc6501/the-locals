# Start both backend and frontend for ChatOps
Write-Host "=== Starting ChatOps Backend & Frontend ===" -ForegroundColor Cyan

# Kill any existing processes
Write-Host "Cleaning up old processes..." -ForegroundColor Yellow
Get-Process python, node, uvicorn -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start Backend on port 8000
Write-Host "Starting backend on port 8000..." -ForegroundColor Green
$backendPath = Join-Path $PSScriptRoot "fastapi-backend"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$backendPath'; Write-Host 'Backend running on http://0.0.0.0:8000' -ForegroundColor Green; python main.py"
) -WindowStyle Normal

Start-Sleep -Seconds 3

# Start Frontend on port 5173
Write-Host "Starting frontend on port 5173..." -ForegroundColor Green
$frontendPath = Join-Path $PSScriptRoot "admin-panel-frontend"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$frontendPath'; Write-Host 'Frontend starting...' -ForegroundColor Green; npm run original"
) -WindowStyle Normal

Write-Host ""
Write-Host "=== Services Starting ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "LOCAL ACCESS:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "TAILSCALE ACCESS (iPhone/iPad):" -ForegroundColor Yellow
Write-Host "  Frontend: http://100.88.23.90:5173" -ForegroundColor Cyan
Write-Host "            http://home-hub.taimen-godzilla.ts.net:5173" -ForegroundColor Cyan
Write-Host "  Backend:  http://100.88.23.90:8000" -ForegroundColor Cyan
Write-Host "            http://home-hub.taimen-godzilla.ts.net:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "PUBLIC (HTTPS via Funnel):" -ForegroundColor Yellow
Write-Host "  Backend:  https://home-hub.taimen-godzilla.ts.net" -ForegroundColor Green
Write-Host ""
Write-Host "Check the new windows for status!" -ForegroundColor Yellow
