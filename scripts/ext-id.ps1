# Deriva o ID canônico da extensão da "key" fixada no manifest (fonte única).
$m = Get-Content "$PSScriptRoot\..\extension\manifest.json" -Raw | ConvertFrom-Json
$der = [Convert]::FromBase64String($m.key)
$hex = -join ([Security.Cryptography.SHA256]::Create().ComputeHash($der) | ForEach-Object { $_.ToString("x2") })
$letters = "abcdefghijklmnop"
$id = -join ($hex.Substring(0,32).ToCharArray() | ForEach-Object { $letters[[Convert]::ToInt32($_.ToString(),16)] })
Write-Host "chrome-extension://$id/"
