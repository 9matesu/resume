# ADR-002: sidecar FastAPI local com auto-start via native messaging

## Status
Aceita.

## Contexto
A extensão precisa de LaTeX, SQLite e chaves de IA sem expor segredos ao front e sem exigir que o usuário abra terminal.

## Decisão
Rodar FastAPI local em 127.0.0.1:8322 via backend/run.py; o host de native messaging garante o backend sob demanda (ensure-backend) e a extensão dispara o auto-start no registro, install e startup do service worker.

## Consequências
Uso offline após setup; o instalador precisa registrar o host com o caminho absoluto do Python; porta fixa simplifica CORS mas conflita se 8322 estiver ocupada.

## Arquivos
- backend/run.py:7 (RESUME_PORT 8322), native-host/host_main.py:33 (PORT_DEFAULT), native-host/host_main.py:142 (ensure_backend)
- extension/background.js:39 (ensureBackend), extension/background.js:41 (sendNativeMessage), ui/src/chrome.ts:1 (BACKEND)
