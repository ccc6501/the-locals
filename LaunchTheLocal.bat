@echo off
REM Launch The Local using pythonw (no console window)
REM Adjust the paths below if your Python installation is different

cd /d "%~dp0fastapi-backend"

REM Try to use pythonw from virtual environment
if exist ".venv\Scripts\pythonw.exe" (
    start "" ".venv\Scripts\pythonw.exe" "tray_runner.py"
    exit
)

REM Fallback: try global pythonw
where pythonw >nul 2>&1
if %errorlevel% == 0 (
    start "" pythonw "tray_runner.py"
    exit
)

REM If no pythonw found, show error
echo ERROR: pythonw.exe not found
echo Please ensure Python is installed or activate your virtual environment
pause
