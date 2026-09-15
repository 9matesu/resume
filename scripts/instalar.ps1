# Registra o native host + abre o Chrome com o caminho da extensao copiado.
# Uso: duplo clique (ou roda do proprio instalador .exe; aqui e o fallback zip).
$ErrorActionPreference = "Stop"
& (Join-Path $PSScriptRoot "native-host\install-host.ps1")
$extPath = Join-Path $PSScriptRoot "extension"
Set-Clipboard -Value $extPath
Write-Host "Caminho da extensao copiado: $extPath" -ForegroundColor Green
Start-Process chrome.exe "chrome://extensions"
Write-Host "No Chrome: ative Modo do desenvolvedor -> 'Carregar sem compactacao' e cole o caminho." -ForegroundColor Cyan
