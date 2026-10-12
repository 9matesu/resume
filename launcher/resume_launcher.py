"""resuMe launcher: single-instance, hidden backend, tray icon, no console.

Cross-platform layout: core here uses only the standard library.
Windows tray lives in tray_win32.py; other platforms run headless and
stop with `resuMe --quit`. Build one file per OS with PyInstaller:

    pyinstaller --noconsole --onefile --name resuMe launcher/resume_launcher.py
"""
from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

BACKEND_PORT = int(os.environ.get("RESUME_PORT", "8322"))
LOCK_PORT = BACKEND_PORT + 1  # loopback socket = instance lock + quit channel
HEALTH_URL = f"http://127.0.0.1:{BACKEND_PORT}/api/health"


def repo_root() -> Path:
    if getattr(sys, "frozen", False):
        here = Path(sys.executable).resolve().parent
    else:
        here = Path(__file__).resolve().parent.parent
    # O exe mora em dist/; o projeto mora um nível acima. Procura a raiz
    # que contém backend/run.py, começando pelo próprio diretório.
    node = here
    for _ in range(3):
        if (node / "backend" / "run.py").exists():
            return node
        if (node / "extension" / "manifest.json").exists():
            return node
        node = node.parent
    return here


def log_path() -> Path:
    p = repo_root() / "backend" / "data" / "resume-backend.log"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def health_ok(timeout: float = 2.0) -> bool:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def find_backend_cmd() -> list[str] | None:
    """Python that runs the backend without opening a console window."""
    root = repo_root()
    candidates = [
        root / "backend" / ".venv" / "Scripts" / "pythonw.exe",
        root / "python-embedded" / "pythonw.exe",
        root / "backend" / ".venv" / "Scripts" / "python.exe",
        root / "python-embedded" / "python.exe",
    ]
    for exe in candidates:
        if exe.exists():
            return [str(exe), str(root / "backend" / "run.py")]
    bundled = root / "ResumeEngine.exe"
    if bundled.exists():
        return [str(bundled)]
    return None


def spawn_backend() -> subprocess.Popen | None:
    cmd = find_backend_cmd()
    if not cmd:
        return None
    kwargs: dict = {
        "cwd": str(repo_root() / "backend"),
        "stdin": subprocess.DEVNULL,
    }
    if os.name == "nt":
        kwargs["creationflags"] = (
            subprocess.DETACHED_PROCESS
            | subprocess.CREATE_NEW_PROCESS_GROUP
            | getattr(subprocess, "CREATE_NO_WINDOW", 0)
        )
        kwargs["stdout"] = open(log_path(), "a", encoding="utf-8")
        kwargs["stderr"] = subprocess.STDOUT
    else:
        kwargs["stdout"] = open(log_path(), "a", encoding="utf-8")
        kwargs["stderr"] = subprocess.STDOUT
        kwargs["start_new_session"] = True
    return subprocess.Popen(cmd, **kwargs)


def ensure_backend(timeout: float = 15.0) -> tuple[bool, subprocess.Popen | None]:
    if health_ok():
        return True, None
    proc = spawn_backend()
    if proc is None:
        return False, None
    deadline = time.time() + timeout
    while time.time() < deadline:
        if health_ok(timeout=1.0):
            return True, proc
        if proc.poll() is not None:
            return False, None  # died on startup; log has the traceback
        time.sleep(0.5)
    return health_ok(timeout=1.0), proc


def chrome_cmd(extension_dir: Path) -> list[str] | None:
    profile = _chrome_profile()
    profile.mkdir(parents=True, exist_ok=True)
    ext = f"--load-extension={extension_dir}"
    if os.name == "nt":
        for p in (
            Path(os.environ.get("ProgramFiles", "")) / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("ProgramFiles(x86)", "")) / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("LocalAppData", "")) / "Google/Chrome/Application/chrome.exe",
        ):
            if p.exists():
                return [str(p), f"--user-data-dir={profile}", ext]
        return None
    for name in ("google-chrome", "chromium", "chromium-browser"):
        exe = shutil.which(name)
        if exe:
            if sys.platform == "darwin":
                return ["open", "-a", "Google Chrome", "--args",
                        f"--user-data-dir={profile}", ext]
            return [exe, f"--user-data-dir={profile}", ext]
    return None


def _chrome_profile() -> Path:
    if os.name == "nt":
        base = Path(os.environ.get("LocalAppData", str(Path.home())))
    elif sys.platform == "darwin":
        base = Path.home() / "Library/Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", str(Path.home() / ".config")))
    return base / "resuMe" / "chrome-profile"


def open_chrome() -> bool:
    cmd = chrome_cmd(repo_root() / "extension")
    if not cmd:
        return False
    kwargs: dict = {}
    if os.name == "nt":
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    else:
        kwargs["start_new_session"] = True
    subprocess.Popen(cmd, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
                     **kwargs)
    return True


def try_quit_running() -> bool:
    """Ask a running instance to stop. True when someone listened."""
    try:
        s = socket.create_connection(("127.0.0.1", LOCK_PORT), timeout=2)
    except OSError:
        return False
    try:
        s.sendall(b"QUIT\n")
    finally:
        s.close()
    return True


def main() -> int:
    ap = argparse.ArgumentParser(prog="resuMe", description="resuMe launcher")
    ap.add_argument("--no-chrome", action="store_true")
    ap.add_argument("--quit", action="store_true",
                    help="stop the running instance and exit")
    ap.add_argument("--port", type=int, default=BACKEND_PORT)
    args = ap.parse_args()

    if args.quit:
        print("stopped" if try_quit_running() else "not running")
        return 0

    lock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    # Sem SO_REUSEADDR de propósito: no Windows ele permite dois binds na
    # mesma porta e a segunda instância passaria. O bind exclusivo é o lock.
    try:
        lock.bind(("127.0.0.1", LOCK_PORT))
    except OSError:
        return 0  # another instance owns the tray; silent exit
    lock.listen(1)
    lock.settimeout(0.5)

    import threading
    stop = threading.Event()
    backend_proc: list = []

    def serve_quit() -> None:
        while not stop.is_set():
            try:
                conn, _ = lock.accept()
            except socket.timeout:
                continue
            with conn:
                try:
                    if conn.recv(16).strip() == b"QUIT":
                        stop.set()
                        _stop_tray()
                except OSError:
                    pass

    def _stop_tray() -> None:
        if os.name == "nt":
            import tray_win32
            tray_win32.request_stop()
        else:
            stop.set()

    ok, spawned = ensure_backend()
    if spawned is not None:
        backend_proc.append(spawned)
    if not args.no_chrome:
        open_chrome()

    if os.name == "nt":
        import tray_win32
        threading.Thread(target=serve_quit, daemon=True).start()
        tray_win32.run_tray(
            tooltip="resuMe — motor local" if ok else "resuMe — motor fora do ar",
            icon_path=_icon_file(),
            on_open=open_chrome,
            on_status=lambda: health_ok(),
            on_quit=stop.set,
        )
    else:
        threading.Thread(target=serve_quit, daemon=True).start()
        stop.wait()

    for p in backend_proc:
        try:
            p.terminate()
        except Exception:
            pass
    return 0


def _icon_file() -> Path | None:
    for cand in (repo_root() / "scripts" / "resume-setup.ico",
                 repo_root() / "resume.ico"):
        if cand.exists():
            return cand
    return None


if __name__ == "__main__":
    sys.exit(main())
