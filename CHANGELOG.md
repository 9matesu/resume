# Changelog

## [1.1.0] — 2026-09-14

### Added

- **Motor inicia sozinho ao carregar o Chrome** — manifest agora declara
  `nativeMessaging` (antes `sendNativeMessage` falhava silenciosamente) e o
  service worker chama `ensure-backend` em `onStartup`/`onInstalled`/wake-up.
- **Instalador `resuMe-<v>-setup.exe`** (Inno Setup, gratuito): motor +
  registro do host + Chrome aberto na página certa com o caminho da extensão
  na área de transferência. Restam 2 cliques dentro do navegador (limitação
  do Chrome fora da Store). Landing com CTA único **"Instalar extensão"**.
- **Edições do Estúdio persistem**: `PUT /api/resumes/{id}` grava LaTeX e
  recompila o PDF do próprio registro (acabou o `preview_*` descartável).
- **Histórico navegável**: cada linha abre no Estúdio (`GET /api/resumes/{id}`)
  e pode ser removida (`DELETE`, apaga linha + PDF).
- `instalar.ps1` no zip portável (equivale ao .exe).

### Removed

- `POST /api/adapt-job` e `POST /api/compile` (zero callers — o caminho único
  é adapt-text → PUT/estúdio).
- Nav numerado ("1. Captura") e a linha "texto capturado: ~Nk chars".

### Changed

- Botão do Estúdio: "Salvar e Atualizar PDF" (antes "Recompilar" não salvava
  nada); erros inline no lugar de `alert()`.
- Tela "Motor offline" sem dev-speak (hint do PowerShell agora em "Para técnicos").

## [1.0.0] — 2026-09-08

Primeiro release oficial — e rename de **AutoJob Studio** para **resuMe**.

### Breaking (0.x → 1.0)

- Renomeado: `AutoJob Studio` → `resuMe`. A ID da extensão é a mesma
  (manifest `key` pinada), mas o **native messaging host foi renomeado**
  (`com.autojob.host` → `com.resume.host`): reexecute
  `native-host\install-host.ps1` após atualizar.
- Protocolo interno da captura renomeado (`autojob-capture-*` →
  `resume-capture-*`) — extensão e páginas buildadas devem vir do mesmo build.
- Variável de ambiente `AUTOJOB_DATA_DIR` → `RESUME_DATA_DIR`; banco
  `autojob.db` → `resume.db` (renomeie o arquivo para preservar seu perfil).

### Changed

- **Tipografia**: duas famílias apenas — Instrument Serif (títulos) +
  Schibsted Grotesk (interface), embutidas localmente como woff2 OFL.
  Removidos os links ao Google Fonts (extensão 100% offline).
- **Div chooser**: um único `Esc` encerra a captura de qualquer estado
  (antes era preciso dois na prévia).
- **Prévia de captura editável**: o texto capturado vira um textarea —
  corrija a extração suja da página antes de enviar; `Enter` captura o texto
  editado.
- Card de resultado agora declara o provedor de IA usado na adaptação
  ("adaptação gerada por X · revise antes de enviar").
- Logomarca "Me" (monograma modernista preto/amarelo) + ícones da extensão.
- Títulos hierárquicos em serifa; pesos e espaçamentos revisados no painel,
  no Estúdio e no Arquivo.

### Added

- `scripts\package-release.ps1`: pacote portável Windows
  (`resuMe-1.0.0-windows-x64.zip`) com Python embutido (3.14.7),
  dependências pré-instaladas e Tectonic 0.17.0 — sem instalador.
- Página de download estática (`site/`) com Switzer via CDN da Fontshare
  (permitido no site próprio).
- Documentação: `docs\INSTALACAO.md` (usuário final), `docs\PRIVACIDADE.md`.
- Testes de contrato do chooser (`extension\test\chooser.test.mjs`,
  `node --test`) e guarda anti-500 de má configuração no backend.

## [0.1.0] — anterior a este release

- Marcações "AutoJob Studio" originais (onboarding, captura DOM, templates
  editorial/devcelio, 11 provedores de IA, histórico SQLite, native host).
