# Fix for "Tailnet/AI Not Connecting" Issue

## Problem

- Home hub UI showing Tailnet and AI as "WAIT" (yellow) instead of "online" (green)
- Tray icon showing yellow (starting) instead of green (ok)
- Frontend may have cached old API base URL

## Solution

### Step 1: Clear Browser Cache

**Open Chrome on home hub PC:**

1. Press `F12` to open DevTools
2. Click the **Console** tab
3. Paste this command and press Enter:

```javascript
localStorage.clear();
window.location.reload(true);
```

OR

1. Press `Ctrl+Shift+Delete`
2. Select "Cached images and files"
3. Select "All time"
4. Click "Clear data"
5. Press `Ctrl+Shift+R` to hard refresh

### Step 2: Wait for Tray Icon

The tray icon polls the backend `/docs` endpoint every few seconds. It should turn **green** within 15-30 seconds if the backend is healthy.

**Current Status:**

- Backend is running on port 8000 ✅
- Backend is responding to API calls ✅
- `/docs` endpoint is accessible ✅
- Tray just needs time to verify and update

### Step 3: Verify Backend Connectivity

Open this URL in Chrome: `http://localhost:8000/docs`

You should see the FastAPI interactive documentation page.

### Step 4: Test Frontend

1. Go to: `http://localhost:5173`
2. The app should load
3. Tailnet status should show **"online"** (green)
4. AI status should show **"ok"** (green)

## What Was Fixed

1. **ActiveUsers.jsx** - Now uses `window.location.hostname:8000` instead of hardcoded `localhost:8000`
2. **useCurrentUser.js** - Calls backend directly instead of through Vite proxy
3. **ChatOpsConsoleStable.jsx** - Uses current user's initials instead of hardcoded 'CC'
4. **pickApiBase()** - Should auto-detect the right backend URL

## If Still Not Working

Run this in PowerShell:

```powershell
# Restart everything cleanly
taskkill /F /IM python.exe /T 2>$null
taskkill /F /IM pythonw.exe /T 2>$null  
taskkill /F /IM node.exe /T 2>$null
Start-Sleep -Seconds 3
cd "C:\Users\Chance\Desktop\The Local Build"
.\LaunchTheLocal.bat
```

Wait 30 seconds, then refresh browser with `Ctrl+Shift+R`.
