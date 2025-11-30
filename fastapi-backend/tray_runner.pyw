"""
Silent launcher for tray_runner.py
This .pyw file runs without showing a console window.
"""
import subprocess
import sys
from pathlib import Path

# Get the directory where this script is located
script_dir = Path(__file__).parent

# Path to the actual tray_runner.py
tray_runner = script_dir / "tray_runner.py"

# Launch tray_runner.py using pythonw (no console)
# Use sys.executable to ensure we use the same Python interpreter
pythonw = Path(sys.executable).parent / "pythonw.exe"

if pythonw.exists():
    # Launch with pythonw (no console window)
    subprocess.Popen([str(pythonw), str(tray_runner)], cwd=str(script_dir))
else:
    # Fallback: use regular python if pythonw not found
    subprocess.Popen([sys.executable, str(tray_runner)], cwd=str(script_dir))
