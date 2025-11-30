# 🚀 Launch The Local (No Console Window)

This patch fixes:
- ✅ Frontend startup (WinError 2) - now resolves npm path correctly
- ✅ Log rotation spam (WinError 32) - implements 5-minute backoff
- ✅ Provides launchers to hide the PowerShell window

---

## 🔧 What Was Fixed

### 1. Frontend Launch (WinError 2)
**Problem**: `subprocess.Popen` couldn't find `npm` because it wasn't in the resolved PATH.

**Solution**: 
- Added `import shutil` to imports
- Use `shutil.which("npm")` to resolve full path to npm executable
- Added early return with clear error if npm not found
- Better exception handling for `FileNotFoundError` and `OSError`

**Code changes in `start_frontend()`**:
```python
# Resolve npm path to avoid WinError 2 (file not found)
npm_path = shutil.which("npm")
if not npm_path:
    print("[tray] npm not found in PATH; cannot start frontend")
    return

npm_cmd = [npm_path, "run", "dev"]
```

### 2. Log Rotation (WinError 32)
**Problem**: Log file was being renamed while `stream_logs()` had it open, causing "file is in use" errors that spammed the console.

**Solution**:
- Added `LAST_ROTATION_ATTEMPT` global variable to track rotation attempts
- Implemented 5-minute backoff between rotation attempts
- Special handling for WinError 32 (file in use) - logs once, doesn't spam
- Other errors still logged for visibility

**Code changes in `rotate_log_if_needed()`**:
```python
# Back off: Only attempt rotation every 5 minutes to avoid spam
now = time.time()
if now - LAST_ROTATION_ATTEMPT < 300:  # 5 minutes
    return

LAST_ROTATION_ATTEMPT = now
```

---

## 🎯 How to Launch Without Console Window

### Option 1: VBS Launcher (Recommended)
**Double-click**: `LaunchTheLocal.vbs`

This launcher:
- Uses `pythonw.exe` from your virtual environment
- Runs completely hidden (no console)
- Starts tray icon automatically

**Note**: You may need to adjust the path in `LaunchTheLocal.vbs` if your virtual environment is in a different location.

### Option 2: Batch File Launcher
**Double-click**: `LaunchTheLocal.bat`

This launcher:
- Tries `.venv\Scripts\pythonw.exe` first
- Falls back to global `pythonw` if venv not found
- Shows error message if pythonw not available

### Option 3: Create a Shortcut
1. Right-click desktop → New → Shortcut
2. Enter target:
   ```
   "C:\Users\Chance\Desktop\The Local Build\fastapi-backend\.venv\Scripts\pythonw.exe" "C:\Users\Chance\Desktop\The Local Build\fastapi-backend\tray_runner.py"
   ```
3. Name it "The Local"
4. (Optional) Change icon: Right-click → Properties → Change Icon

---

## 🧪 Testing Instructions

### 1. Clean Start (One-Time Setup)
Kill any existing processes:
```powershell
Get-Process python,node -ErrorAction SilentlyContinue | Stop-Process -Force
```

Or simply reboot to ensure clean slate.

### 2. Launch Using VBS/BAT
- **Double-click** `LaunchTheLocal.vbs` or `LaunchTheLocal.bat`
- **NO PowerShell window should appear**
- Wait 5-10 seconds for tray icon to appear

### 3. Verify Processes in Task Manager
Open Task Manager → Details tab:
- ✅ Should see exactly **1 python.exe** (backend - uvicorn)
- ✅ Should see **1 node.exe** (frontend - Vite dev server)
- ✅ Should see **1 pythonw.exe** (tray runner - hidden)

### 4. Test Functionality
Open browser and verify:
- http://localhost:8000/api/health → Returns 200 OK
- http://localhost:5173 → Frontend loads
- Cloud storage tab works (browse/upload/download)
- Chat works (OpenAI key priority fix applied)

### 5. Test Restart
- Right-click tray icon → "Restart Backend + Frontend"
- Old processes should be killed
- New processes should start (still no console windows)
- Health check passes again

### 6. Test Stop & Exit
- Right-click tray icon → "Stop & Exit"
- All processes should terminate cleanly
- Tray icon disappears

---

## 📋 Summary of All Files Changed

### Modified:
- `fastapi-backend/tray_runner.py`
  - Added `import shutil` 
  - Fixed `start_frontend()` to resolve npm path
  - Fixed `rotate_log_if_needed()` with backoff mechanism
  - Added `LAST_ROTATION_ATTEMPT` global variable

### Created:
- `LaunchTheLocal.vbs` - VBScript launcher (no console)
- `LaunchTheLocal.bat` - Batch file launcher (fallback)
- `LAUNCHER_SETUP.md` - This file

---

## ⚠️ Troubleshooting

### "npm not found in PATH"
**Solution**: Make sure Node.js is installed and npm is in your PATH
```powershell
npm --version  # Should show version number
```

### "pythonw.exe not found"
**Solution**: Adjust paths in launcher files to match your Python installation:
- Check: `C:\Users\Chance\Desktop\The Local Build\fastapi-backend\.venv\Scripts\pythonw.exe`
- Or use global Python: `where pythonw`

### Frontend doesn't start
**Solution**: 
1. Check npm is installed: `npm --version`
2. Check frontend directory exists: `admin-panel-frontend\`
3. Check package.json has `dev` script
4. Try manual start: `cd admin-panel-frontend; npm run dev`

### Log rotation still shows WinError 32
**Solution**: This is now expected and handled gracefully:
- Message appears once: "[tray] log rotation skipped: log file is in use"
- Won't attempt again for 5 minutes
- Log will rotate on next backend restart when file is closed

---

## 🎉 Next Steps

1. ✅ Test the launchers
2. ✅ Verify no console windows appear
3. ✅ Commit changes:
   ```powershell
   git add fastapi-backend/tray_runner.py
   git add LaunchTheLocal.vbs LaunchTheLocal.bat LAUNCHER_SETUP.md
   git commit -m "patch: fix frontend launch (WinError 2) and log rotation (WinError 32)"
   ```
4. ✅ Create desktop shortcut for easy access
5. ✅ Consider adding launcher to Windows startup for auto-start on login

---

**Status**: ✅ READY TO TEST
