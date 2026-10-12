# AGENTS.md — resuMe

Instruções permanentes para agentes que mexem neste repo. Leia antes de qualquer mudança.

## Mapa rápido

- `extension/content.js`: captura da vaga (auto via `autoExtract`, manual via seleção, envio único em `postAdapt`).
- `extension/background.js`: atalho `Alt+Shift+A`, auto-start do motor.
- `ui/src`: painel lateral (`SidePanelApp`), Estúdio (`StudioWorkspace`), `chrome.ts` (ponte com a extensão), `services/api.ts` (cliente HTTP), `cvFilename.ts` (nome do PDF no front).
- `backend/app/api/routes.py`: pipeline `_run_adapt_pipeline` mais refine em `_refine_keywords`; PDF em `GET /resumes/{id}/pdf`.
- `backend/app/services/ai/`: `gateway.py` (provedores), `vision.py` (extração IA mais `heuristic_extract`), `prompts.py` (regras anti-invenção).
- `backend/app/services/latex/`: `engine.py` (`generate`, `compile_pdf` com gate de validação), `filenames.py` (nome canônico), `validation.py` (gate, sempre via `compile_pdf`).
- `backend/app/models/`: `job.py`, `profile.py`. Banco em `backend/app/db.py` (SQLite WAL).
- Docs vivas em `docs/`: `atlas/` (mapa verificado do código), `requisitos.md`, `casos-de-uso.md`, `adr/`, `design.md`.

## Regras de arquitetura

1. Um só caminho de envio da captura: `postAdapt` no content script, `_run_adapt_pipeline` no backend. Não crie segundo caminho.
2. Nome de CV tem duas implementações que devem continuar idênticas: `filenames.py:cv_filename` e `ui/src/cvFilename.ts:cvFilename`. Mudou uma, mude a outra e rode os dois testes.
3. Validação de PDF mora em `compile_pdf` (vale para captura e Estúdio). Não valide em outro lugar.
4. Fallback heurístico nunca chama rede e nunca inventa. Erro de IA vira 400 com mensagem simples, nunca 500.
5. UI fala com o motor só via `ui/src/services/api.ts`. Nada de fetch direto em componente.
6. Overlay da captura usa `UI_FONT` única e cantos arredondados. Tokens visuais moram em `ui/src/index.css`.
7. Nenhum arquivo passa de 1000 linhas sem decompor antes. `OnboardingWizard.tsx` está em 948: mexer ali exige extrair antes.
8. Código morto não fica: ou liga no pipeline ou apaga.

## Comandos

- Backend: `cd backend; .\.venv\Scripts\python.exe -m pytest tests/ -q -p no:cacheprovider` (conftest isola o banco em tempdir).
- Estáticos: `node --test extension/test/chooser.test.mjs extension/test/sw-contract.test.mjs`, `node --test ui/test/copy.test.mjs`, `node --test site/test/landing.test.mjs`.
- Tipos e build: `cd ui; npx tsc --noEmit; npm run build` (build joga em `extension/`).
- E2E: `cd ui; npx playwright test` (screenshots em `ui/e2e/screenshots/`).

## Voz

PT-BR direto, sem jargão na UI. Headings em sentence case, sem emojis. Erros dizem o que aconteceu e o próximo passo. Prosa de docs passa pelo skill humanizer.
