# resuMe

Um currículo para cada vaga. O resuMe lê a vaga aberta no seu navegador, reescreve seu currículo para ela e entrega o PDF. Você revisa cada linha antes de enviar.

Funciona com LinkedIn, Gupy, Indeed, Greenhouse e qualquer página com texto. O motor roda no seu PC. Sem conta, sem servidor nosso.

Página com download: [matesu.me/resume](https://matesu.me/resume).

## Instalar

Leva uns 5 minutos. Sem terminal, sem permissão de administrador.

1. Baixe o `resuMe-1.2.0-setup.exe` na [página de releases](https://github.com/9matesu/resume/releases) e abra. Se preferir, use o zip portátil da mesma página.
2. O instalador registra o motor e abre o Chrome na página de extensões, com o caminho copiado.
3. No Chrome, ative o modo do desenvolvedor, clique em carregar sem compactação e cole o caminho (Ctrl+V).

Na primeira abertura, envie seu currículo uma vez (PDF, Word ou texto). O resuMe monta seu perfil mestre a partir dele.

## Usar

1. Abra uma vaga no navegador e clique no ícone do resuMe.
2. Clique em Capturar Vaga. O programa lê a página sozinho; se não achar o texto, você aponta com o mouse.
3. Confira a prévia, edite se precisar e confirme. `Esc` cancela a qualquer momento.
4. Baixe o PDF (`CVMateus-Seguranca-da-Informacao.pdf`) ou abra no Estúdio para refinar.

O atalho `Alt+Shift+A` captura direto da aba ativa. Para o dia a dia, abra `dist\resuMe.exe` (ou compile com `.\scripts\build-launcher.ps1`): ele sobe o motor escondido, mostra só o ícone na bandeja e abre o Chrome com a extensão. Segunda execução não abre nada novo. Sair pelo menu da bandeja (ou `resuMe.exe --quit`) para tudo. Sem terminal, sem auto-start no Windows, sem dependências em runtime.

## O que o resuMe não faz

A IA reorganiza os fatos do seu perfil com a ênfase da vaga. Ela não inventa empresa, data ou habilidade. O que falta de verdade aparece listado como lacuna, para você decidir.

## Privacidade

Perfil, histórico e PDFs ficam no SQLite local. Seus dados só saem da máquina para o provedor de IA que você configurar. Com Ollama local, nada sai. Detalhes em [docs/PRIVACIDADE.md](docs/PRIVACIDADE.md).

## Documentação

Mapa do código em [docs/atlas/index.md](docs/atlas/index.md), com diagramas verificados contra o fonte. Requisitos em [docs/requisitos.md](docs/requisitos.md), casos de uso em [docs/casos-de-uso.md](docs/casos-de-uso.md), decisões em [docs/adr](docs/adr) e o sistema de marca em [docs/design.md](docs/design.md). Arquitetura da extensão, permissões e solução de problemas em [docs/EXTENSAO.md](docs/EXTENSAO.md). Instalação passo a passo em [docs/INSTALACAO.md](docs/INSTALACAO.md).

## Desenvolvimento

```powershell
# 1. Motor local (cria venv e instala deps na primeira vez)
.\start-backend.ps1

# 2. Interface da extensão
cd ui
npm install
npm run build

# 3. Chrome: chrome://extensions, modo do desenvolvedor,
#    carregar sem compactação, pasta extension/
```

Testes: `pytest` no `backend/`, `node --test` nos pacotes `extension/test`, `ui/test` e `site/test`, E2E com screenshots em `cd ui; npm run test:e2e`. Empacotar release: `powershell -ExecutionPolicy Bypass -File .\scripts\package-release.ps1`.

## Identidade visual

Títulos em Instrument Serif, interface em Inter, ambas OFL e embutidas (`ui/public/fonts/`), nada de CDN na extensão nem no site. Logo: monograma Me sobre preto, traço amarelo.
