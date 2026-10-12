# ADR-006: fallback heurístico de extração sem chave de IA

## Status
Aceita.

## Contexto
Sem chave de IA ou com outage do provedor, a captura falhava com 400/500 e o usuário ficava sem CV.

## Decisão
heuristic_extract determinístico (título, empresa, local, requisitos, keywords) como fallback: usado quando get_provider lança AIError, quando o chat falha, e para preencher campos vazios da resposta da IA.

## Consequências
Extração mais pobre mas sempre utilizável; o pipeline compila CV mesmo offline de IA; regras de regex precisam de manutenção por idioma (pt/en).

## Arquivos
- backend/app/services/ai/vision.py:31 (heuristic_extract), backend/app/services/ai/vision.py:32 (sem rede, sem invenção)
- backend/app/services/ai/vision.py:106 (extract_job_from_text), backend/app/services/ai/vision.py:110 (fallback sem chave), backend/app/services/ai/vision.py:122 (preenchimento de lacunas)
