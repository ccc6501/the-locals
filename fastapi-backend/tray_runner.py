"""System Tray Runner for The Local backend (Windows)
Starts uvicorn server headlessly and provides tray menu actions:
 - Open UI (frontend) / Docs
 - Restart Backend
 - Stop & Exit

Usage (development):
  python tray_runner.py

Optional: Package with PyInstaller for true background app:
  pyinstaller --noconfirm --onefile --windowed tray_runner.py

This script assumes fastapi-backend is current working directory.
"""
import threading
import subprocess
import sys
import time
import webbrowser
import os
import signal
import socket
import shutil
from pathlib import Path
from urllib import request as urlrequest
from datetime import datetime

try:
    import pystray
    from pystray import MenuItem as Item
    from PIL import Image, ImageDraw
    import psutil
except ImportError:
    print("Missing dependencies. Install with: pip install pystray Pillow psutil")
    sys.exit(1)

PORT_CANDIDATES = [8000, 8001]
# Allow overriding via BACKEND_PORTS env (comma separated)
_env_ports = os.getenv("BACKEND_PORTS")
if _env_ports:
    parsed = []
    for part in _env_ports.split(','):
        part = part.strip()
        if not part:
            continue
        try:
            val = int(part)
            if 1 <= val <= 65535:
                parsed.append(val)
        except ValueError:
            pass
    if parsed:
        PORT_CANDIDATES = parsed

CURRENT_PORT = None
PROCESS = None
FRONTEND_PROCESS = None
PROCESS_LOCK = threading.Lock()
ICON = None  # pystray icon reference
STATUS = "starting"  # starting|ok|error|restarting

LOG_FILE = Path("backend_tray.log")
LOG_MAX_BYTES = int(os.getenv("TRAY_LOG_MAX_BYTES", str(2 * 1024 * 1024)))  # 2MB default
LAST_ROTATION_ATTEMPT = 0  # Timestamp to avoid rotation spam
LAST_BACKEND_RESTART = 0  # Timestamp to avoid rapid restart loops

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")  # Can override for dev port changes
BACKEND_DOCS_TEMPLATE = "http://localhost:{port}/docs"

STOP_REQUESTED = False


def create_icon(size=64, state="starting"):
    """Generate an icon whose color reflects backend status."""
    colors = {
        "starting": ("#0f172a", "#f59e0b"),  # dark bg, amber
        "restarting": ("#0f172a", "#f59e0b"),
        "ok": ("#0f172a", "#10b981"),        # green
        "error": ("#0f172a", "#dc2626"),     # red
    }
    color_bg, color_fg = colors.get(state, ("#0f172a", "#6366f1"))
    img = Image.new("RGBA", (size, size), color_bg)
    d = ImageDraw.Draw(img)
    # Border & letters
    d.rectangle([size*0.1, size*0.1, size*0.9, size*0.9], outline=color_fg, width=3)
    d.line([(size*0.22, size*0.25), (size*0.22, size*0.75)], fill=color_fg, width=5)
    d.line([(size*0.22, size*0.25), (size*0.48, size*0.25)], fill=color_fg, width=5)
    d.line([(size*0.55, size*0.25), (size*0.55, size*0.75)], fill=color_fg, width=5)
    d.line([(size*0.55, size*0.75), (size*0.82, size*0.75)], fill=color_fg, width=5)
    # Small status badge (circle) bottom-right
    badge_color = color_fg
    d.ellipse([size*0.70, size*0.70, size*0.88, size*0.88], fill=badge_color, outline=color_bg)
    return img


def update_icon(state: str):
    global ICON, STATUS
    STATUS = state
    if ICON:
        ICON.icon = create_icon(state=state)


def pick_port():
    """Return first available port from PORT_CANDIDATES."""
    for p in PORT_CANDIDATES:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("0.0.0.0", p))
            except OSError:
                continue
            return p
    raise RuntimeError("No available port in candidates: " + ",".join(map(str, PORT_CANDIDATES)))


def stop_existing_backend_processes():
    """Cleanly terminate existing FastAPI backend processes for this project.
    
    Uses psutil to find processes matching:
    - cmdline contains 'uvicorn' and 'main:app'
    - OR working directory equals fastapi-backend path
    
    Attempts graceful terminate() first, then kill() if needed.
    """
    backend_dir = str(Path(__file__).parent.resolve())
    killed_pids = []
    
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'cwd']):
            try:
                cmdline = proc.info.get('cmdline') or []
                cwd = proc.info.get('cwd') or ''
                
                # Check if this is our FastAPI backend
                is_backend = False
                if cmdline:
                    cmdline_str = ' '.join(cmdline).lower()
                    if 'uvicorn' in cmdline_str and 'main:app' in cmdline_str:
                        is_backend = True
                
                # Or check working directory
                if cwd and Path(cwd).resolve() == Path(backend_dir):
                    if any('uvicorn' in str(c).lower() for c in cmdline):
                        is_backend = True
                
                if is_backend:
                    pid = proc.info['pid']
                    print(f"[tray] Found existing backend process (PID {pid}), terminating...")
                    
                    # Try graceful termination
                    proc.terminate()
                    try:
                        proc.wait(timeout=5)
                        killed_pids.append(pid)
                        print(f"[tray] Backend process {pid} terminated gracefully")
                    except psutil.TimeoutExpired:
                        # Force kill if still alive
                        print(f"[tray] Backend process {pid} didn't terminate, killing...")
                        proc.kill()
                        proc.wait(timeout=2)
                        killed_pids.append(pid)
                        print(f"[tray] Backend process {pid} killed")
                        
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                # Process might have ended or we don't have permission - skip it
                continue
                
    except Exception as e:
        print(f"[tray] Warning during backend process cleanup: {e}")
    
    if killed_pids:
        print(f"[tray] Cleaned up {len(killed_pids)} existing backend process(es)")
    
    return killed_pids


def stop_existing_frontend_processes():
    """Cleanly terminate existing Vite dev server processes for this project.
    
    Uses psutil to find processes matching:
    - cmdline contains 'npm' and 'run' and 'dev'
    - AND working directory equals admin-panel-frontend path
    
    Attempts graceful terminate() first, then kill() if needed.
    """
    frontend_dir = str(Path(__file__).parent.parent / "admin-panel-frontend")
    frontend_dir = str(Path(frontend_dir).resolve())
    killed_pids = []
    
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'cwd']):
            try:
                cmdline = proc.info.get('cmdline') or []
                cwd = proc.info.get('cwd') or ''
                
                # Check if this is our Vite dev server
                is_frontend = False
                if cmdline and cwd:
                    cmdline_str = ' '.join(cmdline).lower()
                    # Match npm run dev AND correct working directory
                    if 'npm' in cmdline_str and 'run' in cmdline_str and 'dev' in cmdline_str:
                        if Path(cwd).resolve() == Path(frontend_dir):
                            is_frontend = True
                    # Also catch node processes running vite from the frontend directory
                    elif 'node' in cmdline_str and 'vite' in cmdline_str:
                        if Path(cwd).resolve() == Path(frontend_dir):
                            is_frontend = True
                
                if is_frontend:
                    pid = proc.info['pid']
                    print(f"[tray] Found existing frontend process (PID {pid}), terminating...")
                    
                    # Try graceful termination
                    proc.terminate()
                    try:
                        proc.wait(timeout=5)
                        killed_pids.append(pid)
                        print(f"[tray] Frontend process {pid} terminated gracefully")
                    except psutil.TimeoutExpired:
                        # Force kill if still alive
                        print(f"[tray] Frontend process {pid} didn't terminate, killing...")
                        proc.kill()
                        proc.wait(timeout=2)
                        killed_pids.append(pid)
                        print(f"[tray] Frontend process {pid} killed")
                        
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                # Process might have ended or we don't have permission - skip it
                continue
                
    except Exception as e:
        print(f"[tray] Warning during frontend process cleanup: {e}")
    
    if killed_pids:
        print(f"[tray] Cleaned up {len(killed_pids)} existing frontend process(es)")
    
    return killed_pids


def is_process_running(name: str) -> bool:
    """Check if a process with the given name is running"""
    for p in psutil.process_iter(["name"]):
        if p.info["name"] and name.lower() in p.info["name"].lower():
            return True
    return False


def ensure_ollama_running():
    """Ensure Ollama is running, start it if not"""
    if is_process_running("ollama"):
        print("[tray] Ollama already running")
        return

    try:
        subprocess.Popen(
            ["ollama", "serve"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        )
        print("[tray] Started Ollama")
    except Exception as e:
        print(f"[tray] Failed to start Ollama: {e}")


def ensure_tailscale_running():
    """Ensure Tailscale is running and connected, start it if not"""
    if is_process_running("tailscaled") or is_process_running("tailscale"):
        print("[tray] Tailscale already running")
        return

    try:
        # Try standard Tailscale installation path on Windows
        tailscale_path = r"C:\Program Files\Tailscale\tailscale.exe"
        if os.path.exists(tailscale_path):
            subprocess.Popen(
                [tailscale_path, "up"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            )
            print("[tray] Started Tailscale")
        else:
            # Try just 'tailscale' if in PATH
            subprocess.Popen(
                ["tailscale", "up"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            )
            print("[tray] Started Tailscale")
    except Exception as e:
        print(f"[tray] Failed to start Tailscale: {e}")


def start_backend_process():
    """Start the FastAPI backend using the canonical command from start_all.ps1.
    
    Canonical command: python -m uvicorn main:app --host 0.0.0.0 --port {PORT}
    Working directory: fastapi-backend/
    
    Uses subprocess.Popen with no visible window on Windows.
    """
    global PROCESS, CURRENT_PORT
    with PROCESS_LOCK:
        if PROCESS and PROCESS.poll() is None:
            print("[tray] Backend already running, skipping start")
            return  # already running
        
        # Clean up any existing backend processes before starting
        stop_existing_backend_processes()
        
        CURRENT_PORT = pick_port()
        
        # Canonical command from start_all.ps1:
        # python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
        backend_cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(CURRENT_PORT),
            "--reload",
        ]
        
        print(f"[tray] Starting backend on port {CURRENT_PORT}...")
        update_icon("starting")
        
        # Working directory is fastapi-backend (where this script lives)
        backend_dir = Path(__file__).parent
        
        # Hide console window on Windows
        creationflags = 0
        startupinfo = None
        if os.name == "nt":
            # Use CREATE_NO_WINDOW to prevent console window
            if hasattr(subprocess, "CREATE_NO_WINDOW"):
                creationflags = subprocess.CREATE_NO_WINDOW
            else:
                # Fallback for older Python versions
                creationflags = 0x08000000  # CREATE_NO_WINDOW value
            
            # Additional startup info to hide window
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = 0  # SW_HIDE
        
        try:
            PROCESS = subprocess.Popen(
                backend_cmd,
                cwd=str(backend_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=False,
                creationflags=creationflags,
                startupinfo=startupinfo
            )
            print(f"[tray] Backend started (PID {PROCESS.pid})")
            threading.Thread(target=stream_logs, daemon=True).start()
        except Exception as e:
            print(f"[tray] Failed to start backend: {e}")
            PROCESS = None
            update_icon("error")


# Deprecated: Use start_backend_process() instead
def start_backend():
    """Legacy wrapper - calls start_backend_process()"""
    start_backend_process()


def rotate_log_if_needed(path: Path):
    """Rotate log file if it exceeds size limit.
    
    Note: On Windows, this may fail with WinError 32 if the file is currently
    open by stream_logs(). We handle this gracefully by backing off and
    retrying only after a cooldown period (5 minutes).
    """
    global LAST_ROTATION_ATTEMPT
    
    if not (path.exists() and path.stat().st_size > LOG_MAX_BYTES):
        return
    
    # Back off: Only attempt rotation every 5 minutes to avoid spam
    now = time.time()
    if now - LAST_ROTATION_ATTEMPT < 300:  # 5 minutes
        return
    
    LAST_ROTATION_ATTEMPT = now
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    rotated = path.with_name(f"{path.stem}.{ts}.log")
    
    try:
        path.rename(rotated)
        print(f"[tray] log rotated -> {rotated.name}")
    except OSError as e:
        # WinError 32: File is in use (stream_logs has it open)
        if hasattr(e, 'winerror') and e.winerror == 32:
            print("[tray] log rotation skipped: log file is in use")
        else:
            print(f"[tray] log rotation failed: {e}")


def stream_logs():
    """Pipe minimal backend output to a rolling file with rotation."""
    if not PROCESS:
        return
    with LOG_FILE.open("a", encoding="utf-8") as f:
        stdout = PROCESS.stdout
        if not stdout:
            return
        for line in stdout:
            rotate_log_if_needed(LOG_FILE)
            f.write(line)
            if STOP_REQUESTED:
                break


def start_frontend_process():
    """Start the Vite dev server using the canonical command from start_all.ps1.
    
    Canonical command: npm run dev
    Working directory: admin-panel-frontend/
    
    Uses subprocess.Popen with no visible window on Windows.
    """
    global FRONTEND_PROCESS
    
    # Clean up any existing frontend processes before starting
    stop_existing_frontend_processes()
    
    # Frontend directory is one level up from backend, then into admin-panel-frontend
    frontend_dir = Path(__file__).parent.parent / "admin-panel-frontend"
    if not frontend_dir.exists():
        print(f"[tray] Frontend directory not found: {frontend_dir}")
        return
    
    # Resolve npm path to avoid WinError 2 (file not found)
    npm_path = shutil.which("npm")
    if not npm_path:
        print("[tray] npm not found in PATH; cannot start frontend")
        print("[tray] Please ensure Node.js is installed and npm is in your PATH")
        return
    
    # Canonical command from start_all.ps1:
    # npm run dev
    npm_cmd = [npm_path, "run", "dev"]
    
    print(f"[tray] Starting frontend dev server in {frontend_dir}...")
    
    # Hide console window on Windows
    creationflags = 0
    startupinfo = None
    if os.name == "nt":
        # Use CREATE_NO_WINDOW to prevent console window
        if hasattr(subprocess, "CREATE_NO_WINDOW"):
            creationflags = subprocess.CREATE_NO_WINDOW
        else:
            # Fallback for older Python versions
            creationflags = 0x08000000  # CREATE_NO_WINDOW value
        
        # Additional startup info to hide window
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = 0  # SW_HIDE
    
    try:
        FRONTEND_PROCESS = subprocess.Popen(
            npm_cmd,
            cwd=str(frontend_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=False,
            creationflags=creationflags,
            startupinfo=startupinfo
        )
        print(f"[tray] Frontend started (PID {FRONTEND_PROCESS.pid})")
    except (FileNotFoundError, OSError) as e:
        print(f"[tray] Failed to start frontend: {e}")
        FRONTEND_PROCESS = None


# Deprecated: Use start_frontend_process() instead
def start_frontend():
    """Legacy wrapper - calls start_frontend_process()"""
    start_frontend_process()


def stop_frontend():
    """Stop the frontend dev server."""
    global FRONTEND_PROCESS
    
    if FRONTEND_PROCESS and FRONTEND_PROCESS.poll() is None:
        print("[tray] Stopping frontend...")
        try:
            FRONTEND_PROCESS.terminate()
            # Wait for graceful shutdown
            for _ in range(30):
                if FRONTEND_PROCESS.poll() is not None:
                    break
                time.sleep(0.1)
            # Force kill if still alive
            if FRONTEND_PROCESS.poll() is None:
                FRONTEND_PROCESS.kill()
            print("[tray] Frontend stopped")
        except Exception as e:
            print(f"[tray] Error stopping frontend: {e}")
    
    FRONTEND_PROCESS = None


def stop_backend():
    global PROCESS
    with PROCESS_LOCK:
        if PROCESS and PROCESS.poll() is None:
            print("[tray] stopping backend...")
            try:
                if os.name == "nt":
                    PROCESS.send_signal(signal.CTRL_BREAK_EVENT)
                PROCESS.terminate()
                # Fallback kill after timeout
                for _ in range(30):
                    if PROCESS.poll() is not None:
                        break
                    time.sleep(0.1)
                if PROCESS.poll() is None:
                    PROCESS.kill()
            except Exception as e:
                print(f"[tray] error terminating: {e}")
        PROCESS = None
        update_icon("error" if not STOP_REQUESTED else STATUS)


def restart_backend(icon, item):  # pystray callback signature
    """Restart both backend and frontend servers.
    
    This is a manual restart triggered by the user via tray menu.
    No backoff needed since it's an explicit user action.
    """
    print("[tray] User requested restart...")
    update_icon("restarting")
    stop_frontend()
    stop_backend()
    # Use the new canonical process functions
    start_backend_process()
    start_frontend_process()


def open_ui(icon, item):
    webbrowser.open(FRONTEND_URL)


def open_docs(icon, item):
    port = CURRENT_PORT or PORT_CANDIDATES[0]
    webbrowser.open(BACKEND_DOCS_TEMPLATE.format(port=port))


def exit_app(icon, item):
    global STOP_REQUESTED
    STOP_REQUESTED = True
    stop_frontend()
    stop_backend()
    icon.stop()


def build_menu():
    return (
        Item("Open UI", open_ui),
        Item("Open API Docs", open_docs),
        Item("Restart Backend + Frontend", restart_backend),
        Item("Stop & Exit", exit_app)
    )


def wait_for_server(port: int, timeout: float = 15.0) -> bool:
    """Poll /docs endpoint until available or timeout."""
    start_time = time.time()
    url = BACKEND_DOCS_TEMPLATE.format(port=port)
    while time.time() - start_time < timeout:
        try:
            with urlrequest.urlopen(url, timeout=2) as resp:
                if resp.status < 500:
                    update_icon("ok")
                    return True
        except Exception:
            time.sleep(0.5)
    return False


def watchdog():
    """Restart backend automatically if it dies unexpectedly.
    
    Implements backoff to avoid rapid restart loops:
    - Only restarts if backend has been down for at least 30 seconds
    - Only one restart attempt per 60 seconds
    """
    global LAST_BACKEND_RESTART
    
    while not STOP_REQUESTED:
        time.sleep(10)  # Check every 10 seconds (not too aggressive)
        
        with PROCESS_LOCK:
            backend_running = PROCESS and PROCESS.poll() is None
        
        if not backend_running and not STOP_REQUESTED:
            # Backend is down - check if we should restart
            now = time.time()
            
            # Enforce 60-second cooldown between restart attempts
            if now - LAST_BACKEND_RESTART < 60:
                # Too soon since last restart, skip
                continue
            
            print("[tray] Backend process not running; attempting auto-restart...")
            print(f"[tray] Last restart was {int(now - LAST_BACKEND_RESTART)}s ago")
            LAST_BACKEND_RESTART = now
            
            update_icon("restarting")
            start_backend_process()
            
            # Wait for health check
            port = CURRENT_PORT or PORT_CANDIDATES[0]
            if not wait_for_server(int(port)):
                print("[tray] Backend restart failed health check")
                update_icon("error")
            else:
                print("[tray] Backend restarted successfully")


def main():
    """Main entry point for tray runner.
    
    Uses the same canonical commands as start_all.ps1:
    - Backend: python -m uvicorn main:app --host 0.0.0.0 --port {PORT}
    - Frontend: npm run dev
    
    Both processes started with no visible windows (CREATE_NO_WINDOW).
    """
    # Basic argparse (manual) for --nogui mode to allow CI / automated checks
    nogui = any(arg.lower() == "--nogui" for arg in sys.argv[1:])
    here = Path(__file__).parent
    os.chdir(here)
    
    print("[tray] Starting The Local - Backend + Frontend")
    print(f"[tray] Working directory: {here}")
    
    # Ensure Ollama and Tailscale are running before starting backend
    ensure_tailscale_running()
    ensure_ollama_running()
    
    # Start backend first, then frontend using canonical process functions
    start_backend_process()
    start_frontend_process()

    if nogui:
        port = CURRENT_PORT or PORT_CANDIDATES[0]
        ok = wait_for_server(int(port))
        if ok:
            print(f"[tray] backend responsive on port {port} (nogui mode). Shutting down.")
            stop_frontend()
            stop_backend()
            sys.exit(0)
        else:
            print(f"[tray] backend failed to respond on port {port} within timeout.")
            stop_frontend()
            stop_backend()
            sys.exit(1)

    # Wait for initial backend health check
    port = CURRENT_PORT or PORT_CANDIDATES[0]
    threading.Thread(target=lambda: wait_for_server(int(port)), daemon=True).start()

    icon = pystray.Icon(
        "the_local_backend",
        create_icon(state=STATUS),
        title="The Local - Backend + Frontend",
        menu=pystray.Menu(*build_menu())
    )
    global ICON
    ICON = icon
    print(f"[tray] Backend running on port {CURRENT_PORT}, Frontend on 5173")
    print(f"[tray] Tray icon active - right-click for menu")
    print(f"[tray] Open UI: http://localhost:5173")
    print(f"[tray] API Docs: http://localhost:{CURRENT_PORT}/docs")
    
    # Start watchdog thread for auto-restart (with backoff)
    threading.Thread(target=watchdog, daemon=True).start()
    icon.run()  # blocks until exit


if __name__ == "__main__":
    main()
