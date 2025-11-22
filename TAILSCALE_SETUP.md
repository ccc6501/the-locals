# Tailscale Configuration for ChatOps Remote Access

## Current Setup

- **Device**: home-hub (DESKTOP-U3ILOR2)
- **Tailscale IP**: 100.88.23.90
- **DNS Name**: home-hub.taimen-godzilla.ts.net
- **Tailnet**: taimen-godzilla.ts.net

## Services Running

- **Backend**: Port 8000 (FastAPI)
- **Frontend**: Port 5173 (Vite/React)

## Current Access Methods

### 1. Local Access (on this PC)

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:8000>

### 2. Tailnet Access (from iPhone/iPad on same tailnet)

- Frontend: <http://100.88.23.90:5173>
- Backend: <http://100.88.23.90:8000>
- Or using Magic DNS:
  - Frontend: <http://home-hub.taimen-godzilla.ts.net:5173>
  - Backend: <http://home-hub.taimen-godzilla.ts.net:8000>

### 3. Public Internet Access (via Funnel - HTTPS)

- Currently configured: <https://home-hub.taimen-godzilla.ts.net>
- Proxies to: <http://127.0.0.1:8000> (backend only)

## Setup Instructions for iPhone Access

### Option A: Direct Tailnet Access (Recommended for Private Use)

Your iPhone is already connected to the tailnet as "chance" (100.112.252.35).

**On iPhone Safari, navigate to:**

```
http://100.88.23.90:5173
```

Or:

```
http://home-hub.taimen-godzilla.ts.net:5173
```

The frontend will automatically detect it's being accessed remotely and connect to the backend at the same host:8000.

### Option B: Configure Funnel for Public Internet Access

If you want to access without Tailscale running on your iPhone:

#### Serve Frontend via Tailscale Funnel

```powershell
# Expose frontend on HTTPS with path /app
tailscale funnel --bg --https=443 --set-path=/app http://localhost:5173

# This will make it accessible at:
# https://home-hub.taimen-godzilla.ts.net/app
```

#### Serve Backend API (already configured)

```powershell
# Backend is already exposed at root
# https://home-hub.taimen-godzilla.ts.net/
```

## Troubleshooting

### Issue: "Cannot connect to backend"

**Check if services are running:**

```powershell
netstat -ano | findstr "8000 5173" | findstr LISTENING
```

**Restart services:**

```powershell
cd "C:\Users\Chance\Desktop\The Local Build"
.\start_all.ps1
```

### Issue: "404 on chat endpoints"

**Test backend directly:**

```powershell
curl.exe http://localhost:8000/chat/rooms
curl.exe http://localhost:8000/chat/rooms/general/messages
```

**Test via Tailscale IP:**

```powershell
curl.exe http://100.88.23.90:8000/chat/rooms
```

### Issue: "Tailscale connection slow"

Your devices are connecting via DERP relay (Miami). This is slower but still works.

**To improve performance:**

1. Ensure UPnP is enabled on router
2. Configure port forwarding for Tailscale (UDP port 41641)
3. Check firewall rules

**Check connection status:**

```powershell
tailscale status
tailscale netcheck
```

### Issue: "Windows Firewall blocking"

**Allow ports through firewall:**

```powershell
New-NetFirewallRule -DisplayName "ChatOps Backend" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
New-NetFirewallRule -DisplayName "ChatOps Frontend" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
```

## Current Configuration Summary

✅ **Working:**

- Backend accessible locally and via Tailscale
- Frontend accessible locally and via Tailscale
- Chat rooms and messages working
- Funnel exposing backend via HTTPS

❌ **Not Yet Configured:**

- Frontend via Funnel (for non-Tailscale access)
- Direct peer-to-peer connection (currently using relay)

## Next Steps

1. **Test iPhone access** at <http://100.88.23.90:5173>
2. **Optional: Set up frontend Funnel** if you need public internet access
3. **Optional: Improve connection** by configuring router port forwarding

## Useful Commands

```powershell
# Check Tailscale status
tailscale status

# Check serve/funnel configuration
tailscale serve status
tailscale funnel status

# Reset serve configuration
tailscale serve reset

# View Tailscale logs
tailscale debug daemon-logs

# Check network connectivity
tailscale netcheck
```
