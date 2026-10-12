# ADR-003: PDFs via LaTeX Tectonic com fallback pdflatex

## Status
Aceita.

## Contexto
O PDF precisa ter qualidade ATS e compilar no Windows sem exigir TeX Live completo do usuário.

## Decisão
Ordem de compilador: tectonic.exe empacotado, depois tectonic no PATH, depois pdflatex; pdflatex roda 2 passes; qualquer compilação tem 2 tentativas com pausa de 1.5 s, e timeout vira erro transitório.

## Consequências
Primeira execução pode baixar o Tectonic; lock do MiKTeX ou antivírus transitório não derruba a adaptação; logs de erro retornam apenas a cauda para não vazar o .tex inteiro.

## Arquivos
- backend/app/services/latex/engine.py:214 (find_compiler), backend/app/services/latex/engine.py:269 (2 tentativas)
- backend/app/services/latex/engine.py:273 (ramo tectonic), backend/app/services/latex/engine.py:282 (pdflatex 2 passes), backend/app/services/latex/engine.py:302 (timeout transitório)
