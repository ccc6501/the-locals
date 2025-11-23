# the-locals

Tailscale-enabled local admin panel with FastAPI backend and React (Vite) frontend.

## Overview

Components:

- `fastapi-backend/` – API (auth, chat, system metrics, tailscale controls).
- `admin-panel-frontend/` – React admin & ChatOps UI.
- `tray_runner.py` – Windows tray launcher for headless backend.
- `start_all.ps1` – Convenience script to launch both services.

## Prerequisites

- Python 3.11+
- Node.js 18+
- PowerShell (Windows)

## Quick Start

Clone/open the project, then run:

```powershell
./start_all.ps1
```

This launches the backend via tray runner (auto port fallback) and the frontend dev server (Vite).

Windows Explorer double-click option:

Use `start_all.bat` for a one-click launch (it wraps `start_all.ps1`). You can also create a shortcut in the Startup folder if you want it to auto-run on login.

Batch usage (same arguments pass through to PowerShell):

```bat
start_all.bat -Ports "8000,8001" -LogMaxBytes 2097152
```

If the backend falls back to an alternate port (e.g. 8001), the frontend now probes ports automatically (8000,8001,8002) via `pickApiBase` logic in `ChatOpsConsoleStable.jsx`. You can force a manual override by setting `localStorage.setItem('theLocal.apiBaseOverride', 'http://localhost:8001');` in the browser console.

## start_all.ps1 Usage

```powershell
./start_all.ps1                # Tray backend + frontend dev
./start_all.ps1 -Uvicorn       # Use uvicorn reload instead of tray
./start_all.ps1 -BackendOnly   # Just backend
./start_all.ps1 -FrontendOnly  # Just frontend
./start_all.ps1 -Ports "8000,8001,8002" -LogMaxBytes 3145728  # Custom tray env
./start_all.ps1 -NoCleanup     # Skip killing existing processes
./start_all.ps1 -DryRun        # Show planned actions only
```

Environment parameters passed to tray:

- `-Ports` sets `BACKEND_PORTS` (fallback order)
- `-LogMaxBytes` sets `TRAY_LOG_MAX_BYTES` (log rotation threshold for `backend_tray.log`)

## Tray Runner

Direct usage:

```powershell
cd fastapi-backend
python tray_runner.py
```

Icon color meanings:

- Amber: starting / restarting
- Green: healthy
- Red: error / stopped

Use tray menu to open API docs or restart backend.

## Frontend Direct

```powershell
cd admin-panel-frontend
npm install
npm run dev
```

## Notes

- If port 8000 is busy, tray runner chooses next candidate (e.g., 8001).
- Adjust API base in frontend if not using relative paths and port changes.
- Logs rotate when exceeding `TRAY_LOG_MAX_BYTES` (default 2MB).

## License

Internal project – no public license specified.
