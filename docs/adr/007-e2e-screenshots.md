# ADR-007: Playwright E2E com screenshots como qualidade de UI

## Status
Aceita.

## Contexto
Regressões visuais (raio zerado, overflow horizontal, download com nome errado) passavam sem teste unitário perceber.

## Decisão
E2E Playwright com mocks de /api/health, /api/profile e /api/adapt-text; cada spec salva screenshots em ui/e2e/screenshots e afirma raio maior que zero, fonte do corpo, overflow de no máximo 1px e layout mobile 390px; projeto único chromium com viewport 400x800 de sidepanel.

## Consequências
Screenshots viram artefato de revisão; testes dependem de mocks estáveis e do servidor vite na porta 5173; falhas de pixel precisam de triagem manual.

## Arquivos
- ui/e2e/sidepanel.spec.ts:32 (spec captura), ui/e2e/sidepanel.spec.ts:37 (screenshot), ui/e2e/sidepanel.spec.ts:44 (raio maior que zero)
- ui/e2e/studio.spec.ts:18 (spec editor), ui/e2e/studio.spec.ts:25 (screenshot), ui/playwright.config.ts:4 (testDir), ui/playwright.config.ts:23 (projects chromium)
