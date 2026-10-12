# ADR-004: adaptação em 2 passes com honest_gaps e regra anti-invenção

## Status
Aceita.

## Contexto
O modelo tende a inflar match e a inventar tecnologias para cobrir keywords do anúncio, o que gera currículo falso.

## Decisão
Passe 1 adapta com SYSTEM_RULES (usar só fatos de CANDIDATE DATA, listar o que falta em honest_gaps); passe 2 tenta cobrir keywords ATS ausentes e só aceita o refinamento se reduzir o conjunto faltante; keyword sem lastro volta para honest_gaps.

## Consequências
Menos keywords aplicadas, mais confiança; o front precisa exibir honest_gaps em vez de esconder; custo de 2 chamadas quando há keywords faltantes.

## Arquivos
- backend/app/services/ai/prompts.py:22 (proibição de inventar), backend/app/services/ai/prompts.py:35 (honest_gaps), backend/app/services/ai/prompts.py:230 (KEYWORD_REFINE_SUFFIX)
- backend/app/api/routes.py:253 (_run_adapt_pipeline), backend/app/api/routes.py:283 (passe 2), backend/app/api/routes.py:281 (honest_gaps)
