# resuMe launcher leve — sem pip install, sem venv, sem build.
# Só: (1) garante o motor rodando, (2) abre o Chrome com a extensão.
# Uso: duplo-clique em Abrir-resuMe.bat (ou este .ps1).
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot
$port = 8322
$extDir = Join-Path $root "extension"

function Test-Health {
  try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2 -ErrorAction Stop
    return $r.status -eq "ok"
  } catch { return $false }
}

if (Test-Health) {
  Write-Host "[resuMe] motor já rodando (:8322)." -ForegroundColor Green
} else {
  # Ordem leve: exe do release > ResumeHost (registry) > python embutido > erro guiado.
  $engine = Join-Path $root "ResumeEngine.exe"
  if (-not (Test-Path $engine)) { $engine = Join-Path $root "backend\bin\ResumeEngine.exe" }
  $started = $false
  if (Test-Path $engine) {
    Write-Host "[resuMe] iniciando $engine ..." -ForegroundColor Yellow
    Start-Process -FilePath $engine -WorkingDirectory (Split-Path $engine) | Out-Null
    $started = $true
  } else {
    $emb = Join-Path $root "python-embedded\python.exe"
    $app = Join-Path $root "backend\run.py"
    if ((Test-Path $emb) -and (Test-Path $app)) {
      Write-Host "[resuMe] iniciando motor embutido ..." -ForegroundColor Yellow
      Start-Process -FilePath $emb -ArgumentList "`"$app`"" -WorkingDirectory (Join-Path $root "backend") -WindowStyle Hidden | Out-Null
      $started = $true
    }
  }
  if (-not $started) {
    Write-Host "[resuMe] ERRO: motor não encontrado." -ForegroundColor Red
    Write-Host "  Rode uma vez: powershell -ExecutionPolicy Bypass -File .\scripts\package-release.ps1" -ForegroundColor Yellow
    Write-Host "  ou dev: .\\start-backend.ps1  (esse sim instala deps, só para dev)." -ForegroundColor Yellow
  } else {
    for ($i = 0; $i -lt 25 -and -not (Test-Health); $i++) { Start-Sleep -Milliseconds 500 }
    if (Test-Health) { Write-Host "[resuMe] motor online." -ForegroundColor Green }
    else { Write-Host "[resuMe] motor ainda iniciando — o painel tenta sozinho." -ForegroundColor Yellow }
  }
}

# Chrome com a extensão carregada (sem instalar nada).
$chrome = @(
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:LocalAppData}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  Write-Host "[resuMe] Chrome não achado; abrindo studio no navegador padrão..." -ForegroundColor Yellow
  Start-Process "http://127.0.0.1:$port/output" | Out-Null
  exit 0
}
$profile = Join-Path $env:LOCALAPPDATA "resuMe\chrome-profile"
New-Item -ItemType Directory -Force -Path $profile | Out-Null
Write-Host "[resuMe] abrindo Chrome ..." -ForegroundColor Green
Start-Process -FilePath $chrome -ArgumentList "--user-data-dir=`"$profile`"","--load-extension=`"$extDir`"","chrome://extensions" | Out-Null
