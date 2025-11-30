@echo off
REM Launch The Local using python (tray runner)
REM This matches the working start_all.ps1 approach

cd /d "%~dp0fastapi-backend"

REM Try to use python from virtual environment
if exist ".venv\Scripts\python.exe" (
    start "" /min ".venv\Scripts\python.exe" "tray_runner.py"
    exit
)

REM Fallback: try global python
where python >nul 2>&1
if %errorlevel% == 0 (
    start "" /min python "tray_runner.py"
    exit
)

REM If no python found, show error
echo ERROR: python.exe not found
echo Please ensure Python is installed or activate your virtual environment
pause
