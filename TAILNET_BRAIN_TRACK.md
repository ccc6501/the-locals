# Tailnet Brain Track - Separate Work (2025-11-20)

## Overview

This document tracks the **separate Tailnet AIVA hub work** created today that lives in `D:\Tailnet\` and is **not yet part of this Git repository**.

## Location

```
D:\Tailnet\
├── setup_tailnet_cloud_layout.ps1
├── setup_aiva_hub.ps1
└── cloud_storage_sandbox\
    └── shared\
        └── apps\
            └── aiva\
                ├── knowledge\
                ├── context\
                ├── scripts\helpers\
                ├── prompts\
                └── telemetry\
```

## What Was Built

### 1. Cloud Storage Layout (`setup_tailnet_cloud_layout.ps1`)

Creates the Tailnet cloud drive structure:

- `incoming/` - Inbound files from other devices
- `shared/` - Main collaboration space
  - `public/`, `private/`, `users/`, `apps/`
- `archive/` - Long-term storage
- `shortcuts_inbox/`, `shortcuts_outbox/` - iOS Shortcuts integration
- `tmp/`, `logs/`, `_meta/`

### 2. AIVA Hub Structure (`setup_aiva_hub.ps1`)

Creates under `cloud_storage_sandbox/shared/apps/aiva/`:

**Knowledge Base:**

- `knowledge/raw_docs/` - Tailscale documentation, CLI cheatsheets
- `knowledge/playbooks/` - Troubleshooting playbooks
- `knowledge/processed/`, `knowledge/indexes/` - Future RAG/embeddings

**Context Data:**

- `context/users/chance/profile.json` - User profile
- `context/devices/*.json` - Device metadata (pc-hub, laptop-dev)
- `context/tailnet_map.json` - Tailnet topology

**AI System:**

- `prompts/system/tailnet_operator.txt` - System prompt for Tailnet Operator AI
- `prompts/tools/` - Tool schemas

**Scripts:**

- `scripts/helpers/tailnet_refresh.py` - Syncs `tailscale status --json` → context files
- `scripts/helpers/tailnet_context_loader.py` - Loads full context for AI
- `scripts/helpers/tailnet_diagnose.py` - Health check diagnostics

**Telemetry & Reports:**

- `telemetry/tailscale_status/`, `telemetry/health_checks/`
- `reports/incidents/`, `reports/daily/`

## Key Scripts

### tailnet_refresh.py

```powershell
cd D:\Tailnet\cloud_storage_sandbox\shared\apps\aiva\scripts\helpers
python .\tailnet_refresh.py
```

**What it does:**

- Calls `tailscale status --json`
- Writes `context/devices/<hostname>.json` for each node
- Writes `context/tailnet_map.json` with network summary
- Adds `generated_at` timestamp (UTC)

**Example output:**

```
[OK] wrote device file: ...\devices\home-hub-1.json
[OK] wrote device file: ...\devices\Chances-iPad.json
[OK] wrote tailnet_map.json
```

### tailnet_context_loader.py

```powershell
python .\tailnet_context_loader.py
```

**What it does:**

- Aggregates:
  - User profile (chance)
  - Device contexts
  - Tailnet map
  - Knowledge docs & playbooks
- Prints preview of what AI would receive

### tailnet_diagnose.py

```powershell
python .\tailnet_diagnose.py
```

**What it does:**

- Reads tailscale status + AIVA context
- Checks for:
  - Missing expected-online devices → CRITICAL
  - Intermittent connections → WARNING
  - Self-node health
- Outputs: `Overall status: ok` or lists issues

## Integration Plan

### Phase 1: FastAPI Endpoints (Next Step)

Create backend router exposing these scripts:

```python
# fastapi-backend/routers/brain.py

@router.get("/brain/network-status")
async def get_network_status():
    """Wraps tailnet_diagnose.py"""
    return {"status": "ok", "issues": []}

@router.get("/brain/context")
async def get_context_preview():
    """Wraps tailnet_context_loader.py"""
    return {"user": {...}, "devices": [...], "tailnet": {...}}

@router.post("/brain/refresh")
async def refresh_tailnet_data():
    """Wraps tailnet_refresh.py"""
    return {"updated": "2025-11-20T12:00:00Z"}
```

### Phase 2: UI Integration

Add to admin panel:

- Network status card: "Tailnet: ✅ OK / ⚠️ Degraded / 🔴 Critical"
- Context viewer: Browse devices, users, docs
- Manual refresh button

### Phase 3: AI Chat Integration

- `/brain/chat` endpoint
- Load context via `tailnet_context_loader.py`
- Send to OpenAI/Ollama with system prompt
- Stream responses

## Current Status

✅ Scripts working and tested  
✅ Context files generating correctly  
✅ Diagnostics reporting accurately  
⏳ Not yet in Git (separate D:\ drive location)  
⏳ Backend endpoints not created  
⏳ UI not integrated  

## Next Actions

1. **Copy to Git repo** (optional):

   ```powershell
   # Option A: Add to this repo
   mkdir "C:\Users\Chance\Desktop\The Local Build\tailnet-brain"
   cp -r D:\Tailnet\* "C:\Users\Chance\Desktop\The Local Build\tailnet-brain\"
   
   # Option B: Create separate repo
   cd D:\Tailnet
   git init
   git remote add origin git@github.com:ccc6501/tailnet-brain.git
   ```

2. **Create FastAPI router** (`fastapi-backend/routers/brain.py`)

3. **Add UI components** for network status display

4. **Schedule background refresh** (cron/Task Scheduler to run `tailnet_refresh.py`)

## Testing Workflow

Before committing, verify:

```powershell
cd D:\Tailnet\cloud_storage_sandbox\shared\apps\aiva\scripts\helpers

# 1. Refresh Tailnet data
python tailnet_refresh.py
# Expect: [OK] messages for each device

# 2. Check diagnostics
python tailnet_diagnose.py
# Expect: Overall status: ok

# 3. Preview context
python tailnet_context_loader.py
# Expect: User profile, devices, tailnet map displayed
```

## Related Work Today

### Legacy Build Fixes (C:\Users\Chance\Desktop\locl-backup1)

- ✅ Fixed `relaunch.ps1` (ASCII-only, process cleanup)
- ✅ Backend starts on `0.0.0.0:8000`
- ✅ Frontend starts on port 5173
- ✅ Health check before opening browser

### Current Workspace Fixes (this repo)

- ✅ `vite.config.js`: Added `host: '0.0.0.0'` for Tailscale
- ✅ `requirements.txt`: Added `hypercorn==0.18.0`
- ✅ `index.html`: Added debug error handling
- ✅ Committed to `feature/tailnet-network-fixes` branch

---

**Author:** GitHub Copilot + Chance  
**Date:** November 20, 2025  
**Purpose:** Document separate Tailnet brain track work for future integration
