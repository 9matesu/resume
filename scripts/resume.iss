; resuMe  -  instalador Windows (Inno Setup 6, gratuito).
; Chamado por scripts/package-release.ps1 com /DAppVersion /DStageDir /DOutputDir.
[Setup]
AppName=resuMe
AppVersion={#AppVersion}
AppPublisher=matesu
DefaultDirName={localappdata}\resuMe
DisableProgramGroupPage=yes
DisableWelcomePage=yes
OutputDir={#OutputDir}
OutputBaseFilename=resuMe-{#AppVersion}-setup
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=lowest
SetupIconFile={#SourcePath}resume-setup.ico

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
; 1. registra o native host (auto-start do motor)  -  silencioso, espera acabar
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\native-host\install-host.ps1"""; \
  StatusMsg: "Registrando o motor local..."; Flags: runhidden waituntilterminated
; 2. copia o caminho da pasta extension para a area de transferencia
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -Command ""Set-Clipboard -Value '{app}\extension'"""; \
  Flags: runhidden
; 3. abre o Chrome na pagina de extensoes (o usuario so cola o caminho)
Filename: "powershell.exe"; \
  Parameters: "-NoProfile -Command ""Start-Process chrome -ArgumentList 'chrome://extensions'"""; \
  Description: "Abrir o Chrome na pagina de extensoes (caminho ja copiado)"; \
  Flags: postinstall nowait skipifsilent

[Code]
// Chrome so instala extensao "unpacked" via pagina de extensoes (a plataforma
// nao expoe API de instalacao remota p/ fora da Store). O instalador faz tudo
// o que pode: motor + host registrados, pagina aberta, caminho na area de
// transferencia. Restam 2 cliques do usuario, dentro do navegador.
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssDone then
    Log('resuMe instalado em ' + ExpandConstant('{app}'));
end;
