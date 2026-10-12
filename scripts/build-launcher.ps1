# Build do launcher resuMe: um .exe por OS, sem console, sem deps em runtime.
# Windows: powershell -ExecutionPolicy Bypass -File .\scripts\build-launcher.ps1
# macOS/Linux: pyinstaller --noconsole --onefile --name resuMe launcher/resume_launcher.py
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$py = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }
$ico = (Resolve-Path (Join-Path $root "scripts\resume-setup.ico")).Path
& $py -m PyInstaller --noconsole --onefile --name resuMe `
  --icon $ico `
  --distpath (Join-Path $root "dist") `
  --workpath (Join-Path $root "build\launcher") `
  --specpath (Join-Path $root "build\launcher") `
  -y (Join-Path $root "launcher\resume_launcher.py")
Write-Host "dist\resuMe.exe pronto." -ForegroundColor Green
