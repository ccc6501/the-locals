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
from pathlib import Path
from urllib import request as urlrequest
from datetime import datetime

try:
    import pystray
    from pystray import MenuItem as Item
    from PIL import Image, ImageDraw
except ImportError:
    print("Missing dependencies. Install with: pip install pystray Pillow")
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
PROCESS_LOCK = threading.Lock()
ICON = None  # pystray icon reference
STATUS = "starting"  # starting|ok|error|restarting

LOG_FILE = Path("backend_tray.log")
LOG_MAX_BYTES = int(os.getenv("TRAY_LOG_MAX_BYTES", str(2 * 1024 * 1024)))  # 2MB default

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


def start_backend():
    global PROCESS, CURRENT_PORT
    with PROCESS_LOCK:
        if PROCESS and PROCESS.poll() is None:
            return  # already running
        CURRENT_PORT = pick_port()
        backend_cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(CURRENT_PORT),
        ]
        print(f"[tray] starting backend on port {CURRENT_PORT}...")
        update_icon("starting")
        # Use creationflags to hide window if packaged
        creationflags = 0
        if os.name == "nt":
            creationflags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
        PROCESS = subprocess.Popen(
            backend_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            creationflags=creationflags
        )

        threading.Thread(target=stream_logs, daemon=True).start()


def rotate_log_if_needed(path: Path):
    if path.exists() and path.stat().st_size > LOG_MAX_BYTES:
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        rotated = path.with_name(f"{path.stem}.{ts}.log")
        try:
            path.rename(rotated)
            print(f"[tray] log rotated -> {rotated.name}")
        except Exception as e:
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
    update_icon("restarting")
    stop_backend()
    start_backend()


def open_ui(icon, item):
    webbrowser.open(FRONTEND_URL)


def open_docs(icon, item):
    port = CURRENT_PORT or PORT_CANDIDATES[0]
    webbrowser.open(BACKEND_DOCS_TEMPLATE.format(port=port))


def exit_app(icon, item):
    global STOP_REQUESTED
    STOP_REQUESTED = True
    stop_backend()
    icon.stop()


def build_menu():
    return (
        Item("Open UI", open_ui),
        Item("Open API Docs", open_docs),
        Item("Restart Backend", restart_backend),
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
    """Restart backend automatically if it dies unexpectedly."""
    while not STOP_REQUESTED:
        time.sleep(3)
        with PROCESS_LOCK:
            if PROCESS and PROCESS.poll() is None:
                continue
        if not STOP_REQUESTED:
            print("[tray] backend process not running; auto-restart...")
            update_icon("restarting")
            start_backend()
            # Wait for health; if fail mark error
            port = CURRENT_PORT or PORT_CANDIDATES[0]
            if not wait_for_server(int(port)):
                update_icon("error")


def main():
    # Basic argparse (manual) for --nogui mode to allow CI / automated checks
    nogui = any(arg.lower() == "--nogui" for arg in sys.argv[1:])
    here = Path(__file__).parent
    os.chdir(here)
    start_backend()

    if nogui:
        port = CURRENT_PORT or PORT_CANDIDATES[0]
        ok = wait_for_server(int(port))
        if ok:
            print(f"[tray] backend responsive on port {port} (nogui mode). Shutting down.")
            stop_backend()
            sys.exit(0)
        else:
            print(f"[tray] backend failed to respond on port {port} within timeout.")
            stop_backend()
            sys.exit(1)

    icon = pystray.Icon(
        "the_local_backend",
        create_icon(state=STATUS),
        title="The Local Backend",
        menu=pystray.Menu(*build_menu())
    )
    global ICON
    ICON = icon
    print(f"[tray] Backend running on port {CURRENT_PORT}. Tray icon active.")
    # Start watchdog thread for auto-restart
    threading.Thread(target=watchdog, daemon=True).start()
    icon.run()  # blocks until exit


if __name__ == "__main__":
    main()
