@echo off
REM Batch launcher for start_all.ps1 with argument passthrough
SETLOCAL ENABLEDELAYEDEXPANSION
set SCRIPT_DIR=%~dp0
set PS_SCRIPT=%SCRIPT_DIR%start_all.ps1

REM Ensure PowerShell executable
where powershell >nul 2>&1
if errorlevel 1 (
  echo PowerShell not found in PATH.
  exit /b 1
)

REM Forward all args to PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*

if errorlevel 0 (
  echo.
  echo [OK] start_all.ps1 executed.
) else (
  echo.
  echo [ERROR] start_all.ps1 failed with exit code %errorlevel%.
)
ENDLOCAL
