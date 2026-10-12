"""resuMe native messaging host — portátil e auto-configurável.

Chrome lança este executável via stdin/stdout (protocolo native messaging).
Garante que o backend FastAPI local está rodando na porta configurada,
subindo-o de forma detached se necessário.

Portabilidade: resolve Python e backend_dir automaticamente a partir do
diretório do próprio executável — sem depender de caminhos absolutos no
resume-host.json. O arquivo de config é gerado automaticamente na primeira
execução se ainda não existir.

Protocol: 4-byte little-endian length prefix + UTF-8 JSON on stdin/stdout.
Nunca escreva nada além disso no stdout.
"""
from __future__ import annotations

import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import time
from pathlib import Path

if getattr(sys, "frozen", False):
    # Rodando como .exe gerado pelo PyInstaller
    HERE = Path(sys.executable).resolve().parent
else:
    HERE = Path(__file__).resolve().parent

CONFIG_PATH = HERE / "resume-host.json"
PORT_DEFAULT = 8322


# ---------------------------------------------------------------------------
# Protocolo native messaging
# ---------------------------------------------------------------------------

def read_message() -> dict:
    raw_len = sys.stdin.buffer.read(4)
    if len(raw_len) < 4:
        return {}
    (length,) = struct.unpack("<I", raw_len)
    data = sys.stdin.buffer.read(length)
    try:
        return json.loads(data.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def write_message(payload: dict) -> None:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
    sys.stdout.buffer.flush()


# ---------------------------------------------------------------------------
# Detecção de paths (portabilidade)
# ---------------------------------------------------------------------------

def _find_python() -> str | None:
    """Resolve o interpretador Python na ordem:
    1. python-embedded/ ao lado do .exe (release zip)
    2. venv de desenvolvimento ../backend/.venv/Scripts/python.exe
    3. python do PATH do sistema
    """
    root = HERE.parent  # autojob-ext/

    candidates = [
        root / "python-embedded" / "python.exe",
        root / "backend" / ".venv" / "Scripts" / "python.exe",
    ]
    for c in candidates:
        if c.exists():
            return str(c)

    # Tenta python do sistema
    import shutil
    sys_py = shutil.which("python") or shutil.which("python3")
    return sys_py


def _find_backend_dir() -> str | None:
    root = HERE.parent  # autojob-ext/
    candidate = root / "backend"
    return str(candidate) if candidate.exists() else None


def _auto_config() -> dict:
    """Gera configuração portátil sem precisar do resume-host.json."""
    python = _find_python()
    backend_dir = _find_backend_dir()
    return {
        "python": python,
        "backend_dir": backend_dir,
        "port": PORT_DEFAULT,
        "log": str(Path(backend_dir) / "data" / "resume-backend.log") if backend_dir else None,
        "startup_timeout": 15,
    }


def load_config() -> dict:
    """Carrega resume-host.json; se ausente ou inválido, usa auto-config portátil."""
    try:
        raw = json.loads(CONFIG_PATH.read_text(encoding="utf-8-sig"))
        if isinstance(raw, dict) and raw.get("backend_dir") and raw.get("python"):
            # Valida que os paths ainda existem (resist a movimentação de pasta)
            if Path(raw["python"]).exists() and Path(raw["backend_dir"]).exists():
                return raw
    except (OSError, json.JSONDecodeError):
        pass
    # Config inválida ou ausente: usa detecção automática
    return _auto_config()


def save_config_if_missing(cfg: dict) -> None:
    """Persiste o config gerado automaticamente para instalações futuras."""
    if CONFIG_PATH.exists():
        return
    try:
        CONFIG_PATH.write_text(
            json.dumps(cfg, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
    except OSError:
        pass  # read-only filesystem — não é crítico


# ---------------------------------------------------------------------------
# Controle do backend
# ---------------------------------------------------------------------------

def port_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.4):
            return True
    except OSError:
        return False


def ensure_backend(cfg: dict) -> dict:
    port = int(cfg.get("port") or PORT_DEFAULT)
    if port_open(port):
        return {"running": True, "spawned": False}

    # Single-flight: duas chamadas juntas (startup + wake do SW) viam a
    # porta fechada e subiam dois motores. Quem pega o lock sobe o backend
    # e o segura até a porta abrir; quem perde espera a porta, nunca sobe
    # outro. Lock com validade para não travar após crash.
    lock_path = Path(backend_lock_path(port))
    if not _acquire_lock(lock_path):
        if _wait_port(port, timeout=25.0):
            return {"running": True, "spawned": False}
        _drop_stale_lock(lock_path)
        return ensure_backend(cfg)
    try:
        return _spawn_backend(cfg, port)
    finally:
        try:
            lock_path.unlink()
        except OSError:
            pass


def _acquire_lock(lock_path: Path) -> bool:
    try:
        fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        return True
    except FileExistsError:
        return False


def _drop_stale_lock(lock_path: Path) -> None:
    try:
        if time.time() - lock_path.stat().st_mtime > 60:
            lock_path.unlink()
    except OSError:
        pass


def _wait_port(port: int, timeout: float) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_open(port):
            return True
        time.sleep(0.5)
    return port_open(port)


def backend_lock_path(port: int) -> str:
    return str(Path(tempfile.gettempdir()) / f"resume-backend-{port}.lock")


def _spawn_backend(cfg: dict, port: int) -> dict:

    python = cfg.get("python")
    backend_dir = cfg.get("backend_dir")

    if not python or not backend_dir:
        return {
            "running": False,
            "error": (
                "Python ou backend não encontrado. "
                "Rode instalar.ps1 uma vez para registrar o motor."
            ),
        }

    if not Path(python).exists():
        return {"running": False, "error": f"Python não encontrado em: {python}"}
    if not Path(backend_dir).exists():
        return {"running": False, "error": f"Backend não encontrado em: {backend_dir}"}

    log_path = Path(cfg.get("log") or (Path(backend_dir) / "data" / "resume-backend.log"))
    log_path.parent.mkdir(parents=True, exist_ok=True)

    env = dict(os.environ)
    env["RESUME_PORT"] = str(port)

    # Sem janela de console: o backend roda invisível. Prefere pythonw.exe
    # (mesma pasta do python configurado) e cai para python.exe com a flag
    # de criação sem janela.
    exe = Path(python)
    nowindow = exe.with_name("pythonw.exe")
    if nowindow.exists():
        exe = nowindow
    flags = 0
    if os.name == "nt":
        flags = (subprocess.DETACHED_PROCESS
                 | subprocess.CREATE_NEW_PROCESS_GROUP
                 | getattr(subprocess, "CREATE_NO_WINDOW", 0))

    with open(log_path, "a", encoding="utf-8") as log:
        subprocess.Popen(
            [str(exe), "run.py"],
            cwd=backend_dir,
            creationflags=flags,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=log,
            env=env,
        )

    deadline = time.time() + float(cfg.get("startup_timeout") or 15)
    while time.time() < deadline:
        if port_open(port):
            return {"running": True, "spawned": True}
        time.sleep(0.4)

    return {"running": False, "spawned": True, "error": "O motor não respondeu a tempo."}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    msg = read_message()
    if not msg:
        # Lançado diretamente (duplo clique) — sem stdin do Chrome.
        # Tenta subir o backend de qualquer forma e sai silenciosamente.
        cfg = load_config()
        save_config_if_missing(cfg)
        ensure_backend(cfg)
        return

    if msg.get("action") != "ensure-backend":
        write_message({"running": False, "error": "Acao desconhecida."})
        return

    try:
        cfg = load_config()
        save_config_if_missing(cfg)
        write_message(ensure_backend(cfg))
    except Exception as exc:  # never crash silently: Chrome shows nothing
        write_message({"running": False, "error": str(exc)})


if __name__ == "__main__":
    main()
