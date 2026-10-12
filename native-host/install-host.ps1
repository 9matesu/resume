# Registra o resuMe native messaging host para Chrome/Edge.
# Uso: powershell -ExecutionPolicy Bypass -File .\native-host\install-host.ps1
# Pode ser rodado de qualquer pasta; os paths sao derivados do proprio script.
$ErrorActionPreference = "Stop"
$root       = Split-Path -Parent $PSScriptRoot
$nativeDir  = Join-Path $root "native-host"
$backendDir = Join-Path $root "backend"
$hostExe    = Join-Path $nativeDir "ResumeHost.exe"

# ── [1/5] Python ──────────────────────────────────────────────────────────
# Ordem: python-embedded (release portable) > venv dev > sistema
$pythonExe = Join-Path $root "python-embedded\python.exe"
if (-not (Test-Path $pythonExe)) { $pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe" }
if (-not (Test-Path $pythonExe)) {
    $pyCmd = Get-Command python -ErrorAction SilentlyContinue
    if (-not $pyCmd) {
        Write-Host "[1/5] ERRO: Python nao encontrado. Instale Python 3.11+ ou use o zip portable." -ForegroundColor Red
        exit 1
    }
    $pythonExe = $pyCmd.Source
    Write-Host "[1/5] Usando Python do sistema: $pythonExe" -ForegroundColor Yellow

    # Instala deps do backend se ainda nao instaladas
    if (-not (Test-Path (Join-Path $backendDir ".venv"))) {
        Write-Host "      Criando venv do backend..." -ForegroundColor Yellow
        & $pythonExe -m venv (Join-Path $backendDir ".venv")
        $pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"
        & $pythonExe -m pip install -q -r (Join-Path $backendDir "requirements.txt")
    }
} else {
    Write-Host "[1/5] Python encontrado: $pythonExe" -ForegroundColor Green
}

# ── [2/5] ResumeHost.exe ──────────────────────────────────────────────────
$hostSrc    = Join-Path $nativeDir "host_main.py"
$needBuild  = $false
if (-not (Test-Path $hostExe)) {
    $needBuild = $true
} else {
    # Reconstroi se o fonte for mais novo que o exe
    $exeTime = (Get-Item $hostExe).LastWriteTime
    $srcTime = (Get-Item $hostSrc).LastWriteTime
    if ($srcTime -gt $exeTime) { $needBuild = $true }
}

if ($needBuild) {
    Write-Host "[2/5] Buildando ResumeHost.exe (pyinstaller)..." -ForegroundColor Yellow
    & $pythonExe -m pip install -q pyinstaller --no-warn-script-location
    & $pythonExe -m PyInstaller --onefile --noconsole --name ResumeHost `
        --distpath $nativeDir --workpath (Join-Path $nativeDir "build") `
        --specpath (Join-Path $nativeDir "build") -y $hostSrc
    if (-not (Test-Path $hostExe)) { throw "ResumeHost.exe nao foi gerado." }
    Write-Host "[2/5] ResumeHost.exe gerado." -ForegroundColor Green
} else {
    Write-Host "[2/5] ResumeHost.exe ja esta atualizado." -ForegroundColor Green
}

# ── [3/5] Config de caminhos (resume-host.json) ───────────────────────────
$logPath = Join-Path $backendDir "data\resume-backend.log"
$config = [ordered]@{
    python          = $pythonExe
    backend_dir     = $backendDir
    port            = 8322
    log             = $logPath
    startup_timeout = 15
}
$configPath = Join-Path $nativeDir "resume-host.json"
$config | ConvertTo-Json | ForEach-Object {
    [System.IO.File]::WriteAllText($configPath, $_, (New-Object System.Text.UTF8Encoding($false)))
}
Write-Host "[3/5] resume-host.json escrito." -ForegroundColor Green

# ── [4/5] Manifesto do host + calcula Extension ID ────────────────────────
$manifest = Get-Content (Join-Path $root "extension\manifest.json") -Raw | ConvertFrom-Json
$pubDer   = [Convert]::FromBase64String($manifest.key)
$sha      = [System.Security.Cryptography.SHA256]::Create().ComputeHash($pubDer)
$hex      = ($sha | ForEach-Object { $_.ToString("x2") }) -join ""
$letters  = "abcdefghijklmnop"
$extId    = -join ($hex.Substring(0, 32).ToCharArray() | ForEach-Object { $letters[[Convert]::ToInt32($_.ToString(), 16)] })

$hostManifest = [ordered]@{
    name            = "com.resume.host"
    description     = "Garante que o motor local do resuMe esteja rodando"
    path            = $hostExe
    type            = "stdio"
    allowed_origins = @("chrome-extension://$extId/")
}
$hostManifestPath = Join-Path $nativeDir "com.resume.host.json"
$hostManifest | ConvertTo-Json | ForEach-Object {
    [System.IO.File]::WriteAllText($hostManifestPath, $_, (New-Object System.Text.UTF8Encoding($false)))
}
Write-Host "[4/5] Manifesto do host escrito. Extension ID: $extId" -ForegroundColor Green

# ── [5/5] Registro no Windows (Chrome + Edge) ─────────────────────────────
$regPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.resume.host",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.resume.host"
)
foreach ($regPath in $regPaths) {
    if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
    Set-ItemProperty -Path $regPath -Name "(Default)" -Value $hostManifestPath
}
Write-Host "[5/5] Registro criado para Chrome e Edge." -ForegroundColor Green

Write-Host ""
Write-Host "Concluido." -ForegroundColor Cyan
Write-Host "Carregue a pasta 'extension\' sem compactar no Chrome (chrome://extensions -> Modo desenvolvedor -> Carregar sem compactacao)." -ForegroundColor Cyan
Write-Host "O motor iniciara automaticamente ao abrir a extensao." -ForegroundColor Cyan
