# ADR-001: captura via DOM em vez de screenshot

## Status
Aceita.

## Contexto
A captura roda em qualquer página de vaga, incluindo conteúdo logado. Enviar imagem exigiria pipeline de visão pago e exporia dados visuais desnecessários.

## Decisão
Extrair texto via DOM no content script (seletores conhecidos mais pontuação de blocos mais texto do melhor candidato, limitado a 30000 caracteres) e enviar apenas texto ao backend. Nenhum screenshot sai do navegador.

## Consequências
Menos custo e menos superfície de privacidade; sites com renderização atípica dependem do ajuste de seletores e do fallback manual por seleção.

## Arquivos
- extension/content.js:47 (scoreCandidate), extension/content.js:94 (slice 30000), extension/content.js:124 (innerText)
- backend/app/services/ai/vision.py:1 (texto bruto da extensão), backend/app/services/ai/vision.py:106 (extract_job_from_text)
