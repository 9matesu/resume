# ADR-005: nome canônico CV<Nome>-<Área>.pdf ASCII-safe

## Status
Aceita.

## Contexto
Download, histórico e sidepanel geravam nomes divergentes, com acentos que quebravam em filesystems e ATS.

## Decisão
Formato único CV<PrimeiroNome>-<Área>.pdf: NFKD/NFD sem diacríticos, apenas A-Za-z0-9 e hífen, área limitada a 60 caracteres, fallback para empresa e depois para Vaga; header Content-Disposition restrito a ASCII imprimível.

## Consequências
Mesmo nome no Python e no TypeScript exige manter as duas implementações sincronizadas; nomes perdem acentos por desenho (Seguranca em vez de Segurança).

## Arquivos
- backend/app/services/latex/filenames.py:18 (_ascii), backend/app/services/latex/filenames.py:47 (cv_filename), backend/app/services/latex/filenames.py:56 (content_disposition)
- ui/src/cvFilename.ts:4 (ascii), ui/src/cvFilename.ts:8 (cvFilename), ui/src/cvFilename.ts:18 (montagem final)
