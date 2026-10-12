# Revisão de arquitetura: simplificar e robustecer

Data: 2026-10-12. Método: revisão de qualidade estrutural (skill thermo-nuclear-code-quality-review do cursor-team-kit). Critério: comportamento preservado, menos peças móveis, falhas virando erro claro em vez de dado ruim.

## O que estava errado

1. Gate de PDF morto. `validation.py` existia e ninguém chamava. PDF quebrado ou minúsculo chegava ao usuário sem ninguém notar.
2. Envio duplicado na captura. `finish` e o ramo automático repetiam o mesmo POST com retry, cerca de 30 linhas iguais em dois lugares. Mudança num lugar não valia no outro.
3. Pipeline inchado. `_run_adapt_pipeline` misturava adaptação, segundo passe ATS e persistência num bloco só, com score calculado em dois pontos.
4. Bateria quebrada em isolamento. `test_models.py` sozinho falhava com `no such table: settings`, porque só `test_api.py` criava as tabelas via lifespan.
5. Reexport sem uso. `ui/src/components/arc/lib/motion-tokens.ts` só repassa `../motion-tokens`, sem importar nada novo. Mantido por enquanto (veja item 4 do que não mudou).

## O que mudou

- `compile_pdf` agora recebe `candidate_name` e roda `validate_pdf` em todo PDF que gera. Vale para captura e Estúdio, porque os dois passam por ele. PDF pequeno demais, header inválido, contagem de páginas fora de 1 a 6 ou nome trocado viram `LatexError` com mensagem direta.
- `postAdapt` único em `extension/content.js`. Manual e automático chamam o mesmo retry. Apagadas as 30 linhas duplicadas.
- `_refine_keywords` extraído em `backend/app/api/routes.py`, com `_clamp_score` para o score 0 a 100 num lugar só. O pipeline lê adaptação, refino, compilação e persistência em sequência curta.
- `conftest.py` chama `db.init_db()` no banco temporário. A suite inteira passa em qualquer ordem: 63 passed.
- Testes acompanharam o gate: fake de PDF com tamanho realista, fake de compile com o novo parâmetro, 2 testes novos do gate, tex de teste com conteúdo renderizado.
- `AGENTS.md` na raiz: mapa, 8 regras de arquitetura e comandos. É o que o agente lê antes de mexer.

## O que não mudou, de propósito

1. Duas implementações do nome de CV (Python e TypeScript). Unificar exigiria gerar o nome num lugar só e quebrar o download offline do front. Regra 2 do AGENTS.md manda manter as duas sincronizadas, com teste dos dois lados.
2. `OnboardingWizard.tsx` com 948 linhas. Está abaixo do teto de 1000 e é um formulário linear. Regra 7 trava qualquer crescimento sem extrair antes.
3. `ui/src/components/arc/` sem imports. É trabalho em andamento de outra sessão; apagar seria adivinhar intenção alheia.
4. Poll de health a cada 5 segundos e TreeWalker limitado. Baratos e limitados por teto, sem motivo para otimizar.

## Regras que valem daqui em diante

Estão no AGENTS.md e repetidas aqui de forma curta: um só caminho de envio por lado; validação só em `compile_pdf`; heurística sem rede e sem invenção; front fala HTTP só via `services/api.ts`; UI_FONT única no overlay; teto de 1000 linhas; código morto sai ou liga no pipeline.

## Como verificar

- `cd backend; .\.venv\Scripts\python.exe -m pytest tests/ -q -p no:cacheprovider`: 63 passed.
- `node --test extension/test/chooser.test.mjs extension/test/sw-contract.test.mjs ui/test/copy.test.mjs site/test/landing.test.mjs`: 27 passed.
- `cd ui; npx playwright test`: 4 passed, screenshots em `ui/e2e/screenshots/`.
- Gate do PDF: `test_validate_pdf_rejects_small_file` e `test_validate_pdf_rejects_wrong_name` em `backend/tests/test_filenames_fallback.py`.
