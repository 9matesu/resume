"""Windows tray icon for resuMe. Standard library only (ctypes).

No console, no dependencies. macOS and Linux do not import this module.
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
from pathlib import Path

user32 = ctypes.windll.user32
shell32 = ctypes.windll.shell32
kernel32 = ctypes.windll.kernel32

WM_APP = 0x8000
WM_TRAY = WM_APP + 1
WM_COMMAND = 0x0111
WM_RBUTTONUP = 0x0205
WM_LBUTTONUP = 0x0202
WM_DESTROY = 0x0002
NIM_ADD = 0x0
NIM_DELETE = 0x2
NIM_MODIFY = 0x1
NIF_MESSAGE = 0x1
NIF_ICON = 0x2
NIF_TIP = 0x4
NIF_INFO = 0x10
NIIF_INFO = 0x1
MF_STRING = 0x0
TPM_RETURNCMD = 0x100
IDI_APPLICATION = 32512
IMAGE_ICON = 1
LR_LOADFROMFILE = 0x10
ID_OPEN = 1001
ID_STATUS = 1002
ID_QUIT = 1003

_hwnd = None
_should_stop = False


class NOTIFYICONDATAW(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("hWnd", wintypes.HWND),
        ("uID", wintypes.UINT),
        ("uFlags", wintypes.UINT),
        ("uCallbackMessage", wintypes.UINT),
        ("hIcon", wintypes.HICON),
        ("szTip", wintypes.WCHAR * 128),
        ("dwState", wintypes.DWORD),
        ("dwStateMask", wintypes.DWORD),
        ("szInfo", wintypes.WCHAR * 256),
        ("uTimeoutOrVersion", wintypes.UINT),
        ("szInfoTitle", wintypes.WCHAR * 64),
        ("dwInfoFlags", wintypes.DWORD),
        ("guidItem", ctypes.c_byte * 16),
        ("hBalloonIcon", wintypes.HICON),
    ]


WNDPROC = ctypes.WINFUNCTYPE(
    ctypes.c_int64, ctypes.c_void_p, ctypes.c_uint,
    ctypes.c_uint64, ctypes.c_int64)


def _setup_prototypes() -> None:
    HWND = ctypes.c_void_p
    UINT = ctypes.c_uint
    WPARAM = ctypes.c_uint64
    LPARAM = ctypes.c_int64
    LRESULT = ctypes.c_int64
    DWORD = ctypes.c_uint32
    user32.RegisterClassW.argtypes = [ctypes.POINTER(WNDCLASSW)]
    user32.RegisterClassW.restype = ctypes.c_ushort
    user32.CreateWindowExW.argtypes = [
        DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR, DWORD,
        ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
        HWND, wintypes.HMENU, wintypes.HINSTANCE, wintypes.LPVOID]
    user32.CreateWindowExW.restype = HWND
    user32.DefWindowProcW.argtypes = [HWND, UINT, WPARAM, LPARAM]
    user32.DefWindowProcW.restype = LRESULT
    user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), HWND, UINT, UINT]
    user32.GetMessageW.restype = ctypes.c_int
    user32.TranslateMessage.argtypes = [ctypes.POINTER(wintypes.MSG)]
    user32.TranslateMessage.restype = ctypes.c_int
    user32.DispatchMessageW.argtypes = [ctypes.POINTER(wintypes.MSG)]
    user32.DispatchMessageW.restype = LRESULT
    user32.PostMessageW.argtypes = [HWND, UINT, WPARAM, LPARAM]
    user32.PostMessageW.restype = ctypes.c_int
    user32.PostQuitMessage.argtypes = [ctypes.c_int]
    user32.DestroyWindow.argtypes = [HWND]
    user32.SetForegroundWindow.argtypes = [HWND]
    user32.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
    user32.CreatePopupMenu.restype = wintypes.HMENU
    user32.AppendMenuW.argtypes = [wintypes.HMENU, UINT, ctypes.c_uint64, wintypes.LPCWSTR]
    user32.TrackPopupMenu.argtypes = [wintypes.HMENU, UINT, ctypes.c_int,
                                      ctypes.c_int, ctypes.c_int, HWND,
                                      ctypes.c_void_p]
    user32.DestroyMenu.argtypes = [wintypes.HMENU]
    user32.LoadImageW.argtypes = [wintypes.HINSTANCE, wintypes.LPCWSTR,
                                  UINT, ctypes.c_int, ctypes.c_int, UINT]
    user32.LoadImageW.restype = wintypes.HICON
    user32.LoadIconW.argtypes = [wintypes.HINSTANCE, ctypes.c_void_p]
    user32.LoadIconW.restype = wintypes.HICON
    user32.MessageBoxW.argtypes = [HWND, wintypes.LPCWSTR, wintypes.LPCWSTR, UINT]
    kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
    kernel32.GetModuleHandleW.restype = wintypes.HINSTANCE
    shell32.Shell_NotifyIconW.argtypes = [DWORD, ctypes.c_void_p]
    shell32.Shell_NotifyIconW.restype = ctypes.c_int


class WNDCLASSW(ctypes.Structure):
    _fields_ = [
        ("style", wintypes.UINT),
        ("lpfnWndProc", WNDPROC),
        ("cbClsExtra", ctypes.c_int),
        ("cbWndExtra", ctypes.c_int),
        ("hInstance", wintypes.HINSTANCE),
        ("hIcon", wintypes.HICON),
        ("hCursor", wintypes.HCURSOR),
        ("hbrBackground", wintypes.HBRUSH),
        ("lpszMenuName", wintypes.LPCWSTR),
        ("lpszClassName", wintypes.LPCWSTR),
    ]

_callbacks: dict = {}


def _wnd_proc(hwnd, msg, wparam, lparam):
    if msg == WM_TRAY:
        event = lparam & 0xFFFF
        if event == WM_RBUTTONUP:
            _show_menu(hwnd)
        elif event == WM_LBUTTONUP:
            cb = _callbacks.get("open")
            if cb:
                cb()
        return 0
    if msg == WM_COMMAND:
        wid = wparam & 0xFFFF
        if wid == ID_OPEN and _callbacks.get("open"):
            _callbacks["open"]()
        elif wid == ID_STATUS and _callbacks.get("status"):
            ok = bool(_callbacks["status"]())
            user32.MessageBoxW(
                None,
                "Motor respondendo em 127.0.0.1:8322." if ok
                else "Motor fora do ar. Feche e abra de novo.",
                "resuMe", 0x40)
        elif wid == ID_QUIT:
            _remove_icon(hwnd)
            user32.DestroyWindow(hwnd)
        return 0
    if msg == WM_DESTROY:
        user32.PostQuitMessage(0)
        return 0
    return user32.DefWindowProcW(hwnd, msg, wparam, lparam)


_wnd_proc_fn = WNDPROC(_wnd_proc)


def _show_menu(hwnd) -> None:
    menu = user32.CreatePopupMenu()
    user32.AppendMenuW(menu, MF_STRING, ID_OPEN, "Abrir no Chrome")
    user32.AppendMenuW(menu, MF_STRING, ID_STATUS, "Ver status")
    user32.AppendMenuW(menu, MF_STRING, ID_QUIT, "Sair")
    pos = wintypes.POINT()
    user32.GetCursorPos(ctypes.byref(pos))
    user32.SetForegroundWindow(hwnd)
    user32.TrackPopupMenu(menu, TPM_RETURNCMD, pos.x, pos.y, 0, hwnd, None)
    user32.PostMessageW(hwnd, 0, 0, 0)
    user32.DestroyMenu(menu)


def _remove_icon(hwnd) -> None:
    nid = NOTIFYICONDATAW()
    nid.cbSize = ctypes.sizeof(nid)
    nid.hWnd = hwnd
    nid.uID = 1
    shell32.Shell_NotifyIconW(NIM_DELETE, ctypes.byref(nid))


def request_stop() -> None:
    global _should_stop
    _should_stop = True
    if _hwnd:
        user32.PostMessageW(_hwnd, WM_DESTROY, 0, 0)


def run_tray(*, tooltip: str, icon_path: Path | None,
             on_open, on_status, on_quit) -> None:
    """Block on the message loop until Sair or request_stop."""
    global _hwnd
    _callbacks.update(open=on_open, status=on_status)

    hinst = kernel32.GetModuleHandleW(None)
    cls_name = "resuMeTray"

    wc = WNDCLASSW()
    wc.lpfnWndProc = _wnd_proc_fn
    wc.hInstance = hinst
    wc.lpszClassName = cls_name
    user32.RegisterClassW(ctypes.byref(wc))
    hwnd = user32.CreateWindowExW(
        0, cls_name, cls_name, 0, 0, 0, 0, 0, None, None, hinst, None)
    _hwnd = hwnd

    if icon_path is not None:
        hicon = user32.LoadImageW(None, str(icon_path), IMAGE_ICON,
                                  16, 16, LR_LOADFROMFILE)
    else:
        hicon = None
    if not hicon:
        hicon = user32.LoadIconW(None, ctypes.c_void_p(IDI_APPLICATION))

    nid = NOTIFYICONDATAW()
    nid.cbSize = ctypes.sizeof(nid)
    nid.hWnd = hwnd
    nid.uID = 1
    nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_INFO
    nid.uCallbackMessage = WM_TRAY
    nid.hIcon = hicon
    nid.szTip = tooltip[:127]
    nid.szInfo = "Motor pronto. Clique para abrir no Chrome."[:255]
    nid.szInfoTitle = "resuMe"[:63]
    nid.dwInfoFlags = NIIF_INFO
    shell32.Shell_NotifyIconW(NIM_ADD, ctypes.byref(nid))

    msg = wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))
        if _should_stop:
            break
    _remove_icon(hwnd)
    user32.DestroyWindow(hwnd)
    try:
        on_quit()
    except Exception:
        pass


_setup_prototypes()
