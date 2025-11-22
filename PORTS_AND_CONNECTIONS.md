# ChatOps Ports & Connections Reference

## Quick Reference

| Service | Port | Local URL | Tailscale URL |
|---------|------|-----------|---------------|
| **Backend API** | 8000 | <http://localhost:8000> | <http://100.88.23.90:8000> |
| **Frontend** | 5173 | <http://localhost:5173> | <http://100.88.23.90:5173> |
| **Ollama** | 11434 | <http://localhost:11434> | N/A (local only) |

## Backend (FastAPI)

### Port Configuration

- **Port**: 8000
- **Host**: 0.0.0.0 (all interfaces)
- **Protocol**: HTTP
- **Started by**: `python main.py` or `uvicorn main:app --host 0.0.0.0 --port 8000`

### How It Works

```python
# fastapi-backend/main.py
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Accessible From

- ✅ Localhost: <http://localhost:8000>
- ✅ LAN: <http://192.168.x.x:8000> (your local network)
- ✅ Tailscale: <http://100.88.23.90:8000>
- ✅ Magic DNS: <http://home-hub.taimen-godzilla.ts.net:8000>
- ✅ Funnel (HTTPS): <https://home-hub.taimen-godzilla.ts.net>

### Key Endpoints

```
# Health & Status
GET  /                        # Root (returns version info)
GET  /api/health              # Health check
GET  /docs                    # Swagger/OpenAPI docs

# Group Chat
GET  /chat/rooms              # List all rooms
GET  /chat/rooms/{id}/messages?since_id={n}&limit={n}
POST /chat/rooms/{id}/messages

# AI Chat
POST /api/chat/chat           # Send message, get AI response

# System
GET  /api/system/tailscale/summary
POST /api/connections/tailscale/test

# Connections
GET  /api/connections         # Get all connection configs
```

## Frontend (React + Vite)

### Port Configuration

- **Port**: 5173 (default), 5180 (dev script), 5181 (fallback)
- **Host**: 0.0.0.0 (all interfaces)
- **Protocol**: HTTP
- **Started by**: `npm run original` or `npm run dev`

### Scripts (package.json)

```json
{
  "scripts": {
    "dev": "vite --port 5180",
    "original": "vite --port 5173",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### How It Works

Frontend is a static Single Page Application (SPA) that:

1. Loads in browser at <http://localhost:5173>
2. Auto-detects which backend to connect to based on hostname
3. Makes fetch() calls to backend API

### Backend Auto-Detection

```javascript
// admin-panel-frontend/src/ChatOpsConsole.jsx
const getApiBase = () => {
    const hostname = window.location.hostname;
    // If accessed remotely, use same hostname for API
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `http://${hostname}:8000`;
    }
    return "http://localhost:8000";
};

const API_BASE = getApiBase();
```

**Examples**:

- Access at `http://localhost:5173` → connects to `http://localhost:8000`
- Access at `http://100.88.23.90:5173` → connects to `http://100.88.23.90:8000`
- Access at `http://home-hub.taimen-godzilla.ts.net:5173` → connects to `http://home-hub.taimen-godzilla.ts.net:8000`

### Accessible From

- ✅ Localhost: <http://localhost:5173>
- ✅ LAN: <http://192.168.x.x:5173>
- ✅ Tailscale: <http://100.88.23.90:5173>
- ✅ Magic DNS: <http://home-hub.taimen-godzilla.ts.net:5173>

## Ollama (AI Model Server)

### Port Configuration

- **Port**: 11434 (default)
- **Host**: localhost (127.0.0.1 only)
- **Protocol**: HTTP
- **Started by**: `ollama serve` (or runs as service)

### Why localhost-only?

Ollama binds to localhost by default for security. Only processes on the same machine can access it.

### How Frontend Connects

Frontend → Backend → Ollama

```
[Browser/Phone]
    ↓ http://100.88.23.90:5173
[Frontend (Vite)]
    ↓ http://100.88.23.90:8000/api/chat/chat
[Backend (FastAPI)]
    ↓ http://localhost:11434
[Ollama]
```

### Ollama Endpoint Used

```python
# Backend makes request to Ollama
POST http://localhost:11434/api/generate
POST http://localhost:11434/api/chat
GET  http://localhost:11434/api/tags  # List models
```

## Connection Flow

### Local Access (Same PC)

```
You @ Computer
    ↓ http://localhost:5173
    Frontend loads
    ↓ fetch(http://localhost:8000/chat/rooms)
    Backend responds
```

### Remote Access (iPhone via Tailscale)

```
You @ iPhone (Tailscale connected)
    ↓ http://100.88.23.90:5173
    Frontend loads
    ↓ fetch(http://100.88.23.90:8000/chat/rooms)
    Backend responds
    ↓ (if using Ollama)
    Backend → http://localhost:11434
    Ollama responds → Backend → Frontend → iPhone
```

### Public Access (via Funnel)

```
Anyone on Internet
    ↓ https://home-hub.taimen-godzilla.ts.net
    Tailscale Funnel (HTTPS)
    ↓ proxies to
    Backend @ http://localhost:8000
```

## Firewall & Network

### Windows Firewall

Both ports automatically allowed when apps start (Windows prompts).

To manually allow:

```powershell
New-NetFirewallRule -DisplayName "ChatOps Backend" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
New-NetFirewallRule -DisplayName "ChatOps Frontend" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
```

### Port Conflicts

If port already in use:

```powershell
# Find what's using port 8000
netstat -ano | findstr :8000

# Kill process by PID
Stop-Process -Id <PID> -Force

# Or restart via script
.\start_all.ps1
```

### Verify Ports Are Listening

```powershell
netstat -ano | findstr "8000 5173" | findstr LISTENING
```

Expected output:

```
TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING       12345
TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       67890
```

## Tailscale Configuration

### Device Info

- **Name**: home-hub
- **Hostname**: DESKTOP-U3ILOR2
- **Tailscale IP**: 100.88.23.90
- **Magic DNS**: home-hub.taimen-godzilla.ts.net
- **Tailnet**: taimen-godzilla.ts.net

### Funnel (Public HTTPS)

Current configuration:

```
https://home-hub.taimen-godzilla.ts.net → http://localhost:8000
```

View status:

```powershell
tailscale funnel status
tailscale serve status
```

### Other Devices on Tailnet

- **chance** (iPhone): 100.112.252.35
- **ipad**: 100.126.159.45
- **ipad-air-gen-4**: 100.116.248.38
- **home-hub-1** (Linux): 100.96.169.36

## Testing Connections

### Test Backend Health

```powershell
# Local
curl.exe http://localhost:8000/api/health

# Tailscale
curl.exe http://100.88.23.90:8000/api/health

# Expected: {"status":"healthy"}
```

### Test Frontend

```powershell
# Local
curl.exe -I http://localhost:5173/

# Tailscale
curl.exe -I http://100.88.23.90:5173/

# Expected: HTTP/1.1 200 OK
```

### Test Chat API

```powershell
# Get rooms
curl.exe http://localhost:8000/chat/rooms

# Get messages
curl.exe "http://localhost:8000/chat/rooms/general/messages"
```

### Test Ollama (from backend host)

```powershell
# List models
curl.exe http://localhost:11434/api/tags

# Test generation
curl.exe http://localhost:11434/api/generate -X POST -H "Content-Type: application/json" -d '{"model":"glm4:latest","prompt":"Hi"}'
```

## Troubleshooting

### "Cannot connect to backend"

**Check 1**: Is backend running?

```powershell
netstat -ano | findstr :8000
```

**Check 2**: Test health endpoint

```powershell
curl.exe http://localhost:8000/api/health
```

**Fix**: Restart backend

```powershell
.\start_all.ps1
```

### "404 on chat endpoints"

**Check**: Backend routes are registered

```powershell
curl.exe http://localhost:8000/docs
# Visit in browser to see all available endpoints
```

### "Ollama not responding"

**Check 1**: Is Ollama running?

```powershell
Get-Process ollama
```

**Check 2**: Is it listening on 11434?

```powershell
netstat -ano | findstr :11434
```

**Check 3**: Test directly

```powershell
curl.exe http://localhost:11434/api/tags
```

**Fix**: Start Ollama

```powershell
ollama serve
```

### "Can't access from iPhone"

**Check 1**: Is Tailscale connected on iPhone?

- Open Tailscale app
- Verify connected to taimen-godzilla.ts.net

**Check 2**: Can you ping the server?

```powershell
# On PC
tailscale status
# Look for iPhone device (chance)
```

**Check 3**: Are services bound to 0.0.0.0?

```powershell
netstat -ano | findstr :8000
# Should show 0.0.0.0:8000, not 127.0.0.1:8000
```

**Fix**: Restart with correct host binding

```powershell
# Backend must use --host 0.0.0.0
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## CORS (Cross-Origin Resource Sharing)

### Backend CORS Configuration

```python
# fastapi-backend/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Why allow all?**

- Frontend can be accessed from multiple hostnames (localhost, Tailscale IP, Magic DNS)
- Simpler for development and Tailnet usage
- Funnel adds additional security layer when needed

**For production**, you might want:

```python
allow_origins=[
    "http://localhost:5173",
    "http://100.88.23.90:5173",
    "http://home-hub.taimen-godzilla.ts.net:5173"
]
```

## Summary

### Ports Summary

- **8000**: Backend API (FastAPI)
- **5173**: Frontend (Vite dev server)
- **11434**: Ollama AI models

### Connection Pattern

```
Frontend (Port 5173)
    ↓ HTTP requests
Backend (Port 8000)
    ↓ HTTP requests (when using Ollama)
Ollama (Port 11434)
```

### Access Methods

1. **Local**: <http://localhost:{port}>
2. **Tailscale IP**: <http://100.88.23.90:{port}>
3. **Magic DNS**: <http://home-hub.taimen-godzilla.ts.net:{port}>
4. **Funnel**: <https://home-hub.taimen-godzilla.ts.net> (backend only)

### Auto-Detection Magic

Frontend automatically detects how it was accessed and connects to backend on the same hostname. No manual configuration needed!

---

**Last Updated**: November 22, 2025
