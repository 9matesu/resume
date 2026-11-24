# Pesquisa de casos de uso e métricas de sucesso do resuMe

Este documento registra a pesquisa que levou ao workspace 2.0, os casos de uso
que a tela precisa atender e as métricas usadas para decidir se a mudança
funcionou. Cada métrica tem fórmula, alvo e onde é instrumentada. Nada depende
de serviço externo: a telemetria é local, opcional e anônima.

## 1. O que a pesquisa mostrou

Três fontes orientaram o desenho:

1. **Observação do fluxo anterior no Estúdio** (`ui/e2e/screenshots/studio-*.png`):
   o PDF, a lista de candidaturas, o inspetor e o chat dividiam a largura. Em
   1280 px o documento tinha menos de 45% da tela; em 390 px os painéis
   empilhavam e o usuário perdia o lugar onde estava.
2. **Padrão de uso de quem edita currículo**: a edição acontece em ciclos curtos
   ("muda isto", "vê o PDF", "muda aquilo"). Cada troca de aba ou modal é um
   custo. O tempo entre a intenção e a edição precisa ser baixo.
3. **Desconfiança com números de IA**: candidatos não sabem o que "82% de match"
   significa. Sem a conta aberta, o número vira ruído. Daí a exigência de
   métricas explicadas com fonte ("medido" ou "estimado") e limites claros.

Daí vêm as decisões de produto: documento maximizado, folhas laterais
sobrepostas (sem reflow), edição no lugar do PDF, chat com aplicação imediata e
desfazer, métricas com explicação e "Seu alvo" em três perguntas.

## 2. Casos de uso do workspace

### W-01 editar no documento

O candidato clica numa linha do PDF e edita o texto no lugar. Enter aplica, Esc
cancela. O autosave recompila e o PDF recarrega sem sair da página. Cobre o
campo personalizado que o `pdf.js` consegue mapear para o perfil.

- Código: `ui/src/components/workspace/PdfViewer.tsx`, `Workspace.tsx`
- Critério: clique abre o campo certo; salvar muda o `.tex` e o PDF na mesma URL.

### W-02 reordenar e ocultar seções

Na folha Estrutura, o candidato arrasta seções para mudar a ordem no PDF,
arrasta itens dentro de uma seção e usa o olho para esconder uma seção sem
apagar o perfil. Botões de seta dão o mesmo resultado por teclado.

- Código: `ui/src/components/workspace/StructurePanel.tsx`, `layout.ts`,
  `backend/app/templates/editorial/resume.tex.j2`
- Critério: ordem e visibilidade gravadas em `profile.layout.sections` e
  respeitadas pelo template.

### W-03 entender as métricas

Na folha Métricas, cada número traz fonte e explicação. Palavras da vaga que
faltam têm resposta de um clique ("tenho" adiciona à skills e recompila; "não"
dispensa localmente). "Seu alvo" registra momento, tom e área para o chat.

- Código: `ui/src/components/workspace/MetricsPanel.tsx`, `layout.ts`
- Critério: a cobertura ATS é recalculada no backend a cada salvamento
  (`_ats_snapshot` em `routes.py`), não repete a foto da captura.

### W-04 ajustar com IA sem perder o controle

O candidato escreve o que quer mudar. A resposta entra no currículo na hora, o
autosave recompila e cada mensagem tem "Desfazer" e diff colapsável. Atalho
⌘K abre o chat. O contexto de "Seu alvo" vai como prefixo, sem virar texto do
currículo.

- Código: `ui/src/components/studio/ChatPanel.tsx`, `Workspace.tsx`
- Critério: uma mensagem gera uma mudança aplicada; desfazer restaura o perfil
  anterior.

### W-05 trocar de candidatura sem perder o lugar

A folha Candidaturas lista o histórico. Trocar de item carrega o PDF e o perfil
daquela vaga; a folha fecha e o documento permanece maximizado.

- Código: `ui/src/components/workspace/HistorySheet.tsx`, `Workspace.tsx`
- Critério: troca sem duplicar registro, sem salvar o perfil antigo por cima.

## 3. Métricas de sucesso

As métricas abaixo são instrumentáveis com os recursos já presentes: eventos do
Playwright em E2E, `performance.now()` no cliente e registros do backend. O
objetivo é medir a experiência, não o candidato.

### M-01 tempo até a primeira edição

- **Pergunta**: depois de abrir o workspace, quanto tempo até o primeiro clique
  que abre um campo?
- **Fórmula**: `t = timestamp(first ws-hit click) - timestamp(mount Workspace)`
  em milissegundos.
- **Alvo**: mediana ≤ 5 s em teste conduzido; p75 ≤ 12 s.
- **Instrumentação**: `performance.mark('ws-mount')` no efeito de montagem e
  `performance.mark('ws-first-edit')` no `openField` do `PdfViewer`. Enviar a
  diferença como evento local `ws_time_to_first_edit`.
- **Por que importa**: se o usuário demora para achar onde clicar, a edição no
  lugar falhou mesmo com o recurso implementado.

### M-02 taxa de edição no documento

- **Pergunta**: das edições feitas, quantas passam pelo PDF em vez das abas
  TeX/Campos?
- **Fórmula**: `cliques_em_ws_hit / (cliques_em_ws_hit + trocas_para_latex + trocas_para_campos)`.
- **Alvo**: ≥ 60% dos usuários que editam usam o documento ao menos uma vez.
- **Instrumentação**: contadores por `view` no `CommandBar.onViewChange` e no
  `PdfViewer.openField`, agregados por sessão.
- **Por que importa**: mostra se o documento maximizado virou o caminho principal.

### M-03 cliques por mudança concluída

- **Pergunta**: quantos cliques entre a intenção ("quero mudar isto") e o
  salvamento?
- **Fórmula**: `cliques_ate_save / numero_de_mudancas_aplicadas`.
- **Alvo**: mediana ≤ 3 cliques (clique no campo, edição, Enter). No chat,
  ≤ 3 cliques (abrir chat, escrever, enviar).
- **Instrumentação**: sequência de eventos de ponteiro no `CommandBar`, nas
  folhas e no `PdfViewer`, correlacionada ao `PUT /api/resumes/{id}`.
- **Por que importa**: "menos cliques" foi pedido explícito; medir evita
  regressão silenciosa quando um painel volta a virar modal.

### M-04 cobertura ATS pós-edição

- **Pergunta**: a cobertura sobe depois que o usuário responde ao grill?
- **Fórmula**: `delta = cobertura_apos_tenho - cobertura_antes_tenho`, onde
  cobertura vem de `_ats_snapshot` no `PUT`.
- **Alvo**: +1 palavra-chave por confirmação "tenho"; delta ≥ 0 em 100% dos
  casos (nunca cai).
- **Instrumentação**: `ats.covered.length` antes e depois em
  `saveResumeEdit`; o E2E de métricas já verifica a queda na lista de faltantes.
- **Por que importa**: fecha o ciclo "pergunta → confirma → currículo melhora".

### M-05 compreensão das métricas

- **Pergunta**: o usuário entende o que os números significam?
- **Fórmula**: `acertos / participantes` numa pergunta de compreensão após 30 s
  na folha Métricas: "O que significa 80% de aderência?" (resposta correta:
  leitura da vaga pela IA, não chance de contratação).
- **Alvo**: ≥ 80% de acertos em 10 participantes.
- **Instrumentação**: teste de usabilidade conduzido; registrar acertos por
  participante. Não é telemetria automática.
- **Por que importa**: o pedido foi "métricas confiáveis e explicadas". Número
  que ninguém entende é ruído.

### M-06 taxa de desfazer no chat

- **Pergunta**: as mudanças da IA são aceitas na primeira tentativa?
- **Fórmula**: `1 - (desfazer / mensagens_aplicadas)`.
- **Alvo**: ≥ 70% de mudanças mantidas; se ficar abaixo, revisar o prompt.
- **Instrumentação**: clique em "Desfazer" no `ChatPanel` e contagem de
  mensagens com `applied: true` na sessão.
- **Por que importa**: mostra se o contexto do alvo e as regras anti-invenção
  estão funcionando, sem pedir nota ao usuário.

### M-07 ausência de overflow e de erro de console

- **Pergunta**: a tela cabe e não quebra em 1280×800 e 390×844?
- **Fórmula**: `scrollWidth - clientWidth ≤ 1 px` e `erros_console == 0` nos
  dois viewports.
- **Alvo**: 100% dos cenários de E2E.
- **Instrumentação**: asserções já presentes em `ui/e2e/studio.spec.ts`
  (testes "abre com documento" e "390px").
- **Por que importa**: "tudo cabe em uma tela" é requisito observável, não
  preferência estética.

### M-08 latência de feedback do autosave

- **Pergunta**: depois de editar, o usuário vê "Salvo" em quanto tempo?
- **Fórmula**: `t = timestamp(status saved) - timestamp(ultima tecla)`.
- **Alvo**: p75 ≤ 2,5 s com compilação local; indicador "Salvando…" aparece em
  < 100 ms.
- **Instrumentação**: `performance.now()` no `queueSave` e no `setSaveStatus`
  do `Workspace`; contagem de transições `saving → saved`.
- **Por que importa**: sem feedback imediato, o usuário clica de novo e cria
  versões duplicadas.

## 4. Como coletar sem quebrar a privacidade

- Eventos ficam em memória por sessão; o candidato não é identificado.
- Nada é enviado a servidor externo. O resuMe roda local na porta 8322.
- "Seu alvo" fica em `localStorage` com chave por resume e nunca entra no PDF.
  O prefixo enviado ao chat é explícito: "contexto meu (não escreva isso no
  currículo)".
- As perguntas de compreensão (M-05) são conduzidas, não injetadas na interface.

## 5. Matriz de rastreabilidade

| Case | Código | Métrica |
|------|--------|---------|
| W-01 editar no documento | `PdfViewer.tsx`, `Workspace.tsx` | M-01, M-02, M-03 |
| W-02 reordenar/ocultar | `StructurePanel.tsx`, `layout.ts`, template Jinja | M-03 |
| W-03 entender métricas | `MetricsPanel.tsx`, `layout.ts`, `_ats_snapshot` | M-04, M-05, M-07 |
| W-04 ajustar com IA | `ChatPanel.tsx`, `Workspace.tsx` | M-06, M-03 |
| W-05 trocar candidatura | `HistorySheet.tsx`, `Workspace.tsx` | M-03, M-08 |
