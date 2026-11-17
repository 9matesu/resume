# Changelog

## [unreleased]

### Estúdio e design

- Novo workspace único em três regiões: navegação compacta, documento A4 e
  inspetor contextual. Substitui a separação Captura/Arquivo/Estúdio.
- Edição direta no documento: clique no texto, edite na prévia e veja o
  resultado imediatamente. O documento estruturado é a fonte; o PDF é a
  exportação.
- Seções reordenáveis por arrastar; paginação A4 visual com navegação
  entre páginas e indicador `1 / N`.
- Experiências, formações e habilidades também podem ser reordenadas por
  arraste no documento.
- Quebras de página agora respeitam limites de seção, sem cortar uma
  seção no meio quando ela cabe inteira na próxima página.
- Inspetor acompanha a seleção: título da seção, visibilidade, ordem,
  campos de experiência/formação/habilidades e versões anteriores.
- Salvamento automático com estado discreto (salvando/salvo/erro).
- Inspetor com formatação por seção: alinhamento, tamanho e peso do texto.
- Template LaTeX passou a usar sans-serif para alinhar com a prévia HTML.
- Histórico local de versões por candidatura, com restaurar.
- O Estúdio abre como janela separada; o painel lateral fica como launcher.
- A prévia do PDF usa `?inline=1`; o download só acontece no botão.
- Nova aba Chat: peça mudanças em linguagem natural e a IA aplica na
  versão atual, sem inventar fatos.
- O chat agora mostra as mudanças e pede Aplicar/Descartar; não aplica
  mais sozinho.
- Novo editor LaTeX com CodeMirror: números de linha, highlight semântico,
  busca, undo/redo e barra de status. Carregado sob demanda.
- A captura manual “Selecionar painel da vaga” fica sempre visível.
- O botão “Capturar Vaga” agora abre direto o modo de seleção por clique.
- O overlay da vaga usa Switzer, borda 1px e sombras suaves.
- Superfície mais macOS: bordas 1px, sombras suaves, radius maior,
  amarelo unificado em `#ffe800` e tipografia Switzer.
- Mais respiro: paddings maiores no painel, Estúdio, chat e cards.
- A extensão injeta o content script nas abas já abertas ao instalar ou
  atualizar, evitando F5 manual.
- Dependências de produção sem vulnerabilidades conhecidas (`npm audit`).

### Produção

- Chave de API nunca vaza entre provedores: sem fallback global, a chave e
  salva e lida por `api_key:<provedor>`. A chave global legada e apagada.
- Backend com CORS restrito a `chrome-extension://`; a captura passou a
  chamar o backend pelo service worker, sem abrir a API para toda pagina.
- `/api/parse-resume-path` removido e upload limitado a 10 MB.
- `Baixar PDF` do painel agora clica no anchor real; antes so mostrava toast.
- Captura por `Alt+Shift+A` com o painel fechado salva o resultado no
  `storage.local` e o painel consome ao abrir.
- Onboarding nao cria mais experiencia fake; o formulario comeca vazio.
- Nome do CV com a mesma regra no backend e na UI (caixa preservada,
  primeiro nome truncado em 30).
- Regra de idioma voltou ao prompt de adaptacao.
- Chrome 137+ recebe `--enable-unsafe-extension-debugging` junto do
  `--load-extension`; `install-host.ps1` nao recompila no cliente.
- Build de release usa venv temporario para o launcher; instalador cria
  atalhos; bundles antigos nao viajam mais no pacote; `logo-ai.png` e o
  preload do video sairam.
- Remover o curriculo base pede confirmacao e o rotulo passou a ser
  "Remover curriculo base".
- Sem chave ou IA fora, o pipeline compila o perfil mestre com
  `honest_gaps` em vez de devolver 400/500.
- Resposta inesperada da IA vira 400, nao 500.
- Estudio revalida pelo detalhe do registro, nao pelo historico de 50.
- Modelo do provedor: probe so no clique explicito, limitado a 5.
- Template devcelio agora mostra telefone e portfolio no cabecalho.
- Painel mostra cobertura ATS e lacunas honestas.
- Design system: tokens de texto/cor/sombra, menos valores crus, labels
  associados e codigo morto `components/arc` removido. O check do
  design.how caiu de 477 para 6 apontamentos (58 excecoes documentadas
  no allowlist do index.css).
- Extensao sem avisos de preload: `modulePreload` desligado no Vite e
  preloads de fonte removidos do painel/Estudio.
- O build nao apaga mais os bundles gerados. A limpeza acontece antes
  (`prebuild`), senao o painel ficava em “Carregando o resuMe…”.
- Paginas da extensao sem `crossorigin` nos tags gerados e com uma
  mensagem de carregamento enquanto o React substitui a raiz.

### Movimento e feedback

- Nada mais de `scale` em texto, nem curva com overshoot: uma curva só
  (`--ease`), durações por token, transição só de transform/opacity.
- Sombra dura dos botões virou pseudo-elemento, então o `:active` não
  força repaint. `transition: all` saiu.
- `prefers-reduced-motion` na extensão (antes só no site) e preload das
  fontes nas duas páginas, sem troca no primeiro paint.
- Primitivas novas: `ActionButton` (4 estados com texto real), `Toast`
  (pilha in place com `role="status"`), `Stage` e `Skeleton`.
- Um botão por ação: captura automática com escape manual sob demanda,
  Estúdio com "Salvar e baixar PDF" que decide sozinho se precisa
  compilar, apagar no histórico vira "Tem certeza?" com 3s de timeout.
- Site sem `scroll-snap-stop: always` e com transição explícita no botão.

### Fontes e comunicação

- Só duas famílias: Instrument Serif nos títulos, Switzer em todo o resto.
  Switzer e Instrument são locais; zero CDN.
- Duas famílias, nada mais. Onde o design pedia "mono", agora é Switzer.
  Regra global `* { font-family: inherit }` trava a uniformidade; só o
  editor de código usa `--font-code` (pilha do sistema).
- E2E novo: todo texto visível renderiza em Switzer ou Instrument Serif
  (`ui/e2e/sidepanel.spec.ts`), falha se qualquer terceira família entrar.
- O header “resuMe” e a pill Online/Offline saíram do painel.
- Playwright na porta 5179 (a 5173 é do goongrid nesta máquina).

### Revisão de arquitetura

- Gate de PDF ligado: `compile_pdf` valida todo PDF (tamanho, header,
  páginas, nome do candidato). Vale para captura e Estúdio.
- `postAdapt` único no content script; `_refine_keywords` e `_clamp_score`
  extraídos no pipeline, sem mudar comportamento.
- `conftest.py` com `init_db`: a suite passa em qualquer ordem.
- `AGENTS.md` na raiz com mapa, regras e comandos.
- `docs/arquitetura-revisao.md` mais `docs/revisao-arquitetura.pdf`.

### Added

- **Captura automática da vaga**: o botão "Capturar Vaga" lê a página
  sozinho (seletores por site — LinkedIn, Gupy, Indeed, Greenhouse…,
  JSON-LD `JobPosting` + pontuação de blocos); se não achar com
  confiança, cai para a seleção manual. `POST /api/adapt-text` aceita
  `structured` + `mode`.
- **Fallback heurístico sem IA**: sem chave ou com a IA fora do ar, a
  extração usa regex determinístico (título/empresa/local/requisitos)
  e ainda gera o CV em vez de falhar.
- **Nome padrão de CV**: `CVMateus-Seguranca-da-Informacao.pdf`
  (`CV<PrimeiroNome>-<Área>.pdf`, ASCII-safe) no disco, no header de
  download e nos 3 botões de baixar (painel, Estúdio, Arquivo).
- **Launcher `dist\resuMe.exe`**: sem terminal, sem segunda instância,
  sem auto-start. Sobe o motor escondido, mostra só o ícone na bandeja
  (abrir, status, sair) e abre o Chrome com a extensão. Código em
  `launcher/` só com stdlib; build por OS via `scripts/build-launcher.ps1`.
- **E2E Playwright com screenshots** (`ui/e2e/`, `npm run test:e2e`):
  painel e Estúdio mockados — raio de borda, fonte uniforme, overflow
  mobile e nome do CV. Já pegou e corrigiu 1 overflow de 58px no
  Estúdio mobile.

### Changed

- **Design menos quadrado**: `--resume-radius` (14px cards/inputs,
  10px botões, pill tags) e overlay da captura arredondado.
- **Fontes uniformes**: Schibsted Grotesk em toda a UI e no overlay
  da captura; `--font-mono` agora é mono real (só código LaTeX).

## [1.2.0] — 2026-09-16

### Added

- **Chaves de API por provedor**: salvar uma chave por provedor (Gemini,
  OpenAI, Groq…) fica guardada no SQLite local; trocar de provedor no
  dropdown já recupera a chave dele. Quem tem chave salva aparece marcado no
  seletor. Nada de valor vaza em respostas HTTP — só nomes.
- **Pipeline ATS de duas passadas**: a adaptação agora espelha a terminologia
  exata da vaga (sem inventar), lista `honest_gaps`, e roda um segundo passe
  caçando as keywords que ficaram de fora. O card do painel mostra a
  cobertura (X/Y keywords) e o que ficou de fora.

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
