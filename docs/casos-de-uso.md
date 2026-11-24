# Casos de uso do resuMe

Ator principal: candidato em busca de vaga.
Ator secundário: motor FastAPI local na porta 8322.
Telas: painel lateral, Estúdio, histórico, configurações, assistente de onboarding.

## UC-01 onboarding do perfil mestre

Atores: candidato, motor local.
Pré-condições: backend responde em GET /api/health. Nenhum perfil ativo salvo.

Fluxo principal:
1. Candidato abre o painel lateral e vê o assistente de onboarding.
2. Candidato importa PDF ou DOCX ou preenche nome, contato, resumo, experiência e skills.
3. Tela chama POST /api/parse-resume ou edita campos em ui/src/components/onboarding/OnboardingWizard.tsx.
4. Candidato confirma e tela chama POST /api/profile com profile, name, email e phone.
5. Backend salva via backend/app/models/profile.py e retorna candidato ativo.

Fluxos alternativos e exceções:
- Arquivo ilegível: importação retorna texto vazio e a tela mantém os campos manuais.
- Perfil já existe: GET /api/profile retorna has_profile true e a tela oferece editar ou excluir via DELETE /api/profile.

Pós-condições: GET /api/profile retorna has_profile true. Captura e adaptação ficam liberadas.

## UC-02 captura automática da vaga

Atores: candidato, content script, motor local.
Pré-condições: perfil mestre salvo. Aba ativa com página de vaga. Extensão carregada.

Fluxo principal:
1. Candidato clica em captura automática no painel em ui/src/SidePanelApp.tsx.
2. Painel chama ui/src/chrome.ts que envia resume-capture-auto para a aba ativa.
3. Content script em extension/content.js lê DOM e texto estruturado sem clique.
4. Script chama POST /api/adapt-text com job_text, page_title, page_url e structured.
5. Backend extrai, adapta, compila e retorna job mais adaptation com pdf_url.
6. Painel mostra match_score, keywords e botão abrir Estúdio.

Fluxos alternativos e exceções:
- Confiança baixa: retorna Não achei a vaga sozinho — use a seleção manual. e a tela sugere modo manual.
- Motor parado: content script tenta 2 vezes e reporta Não foi possível conectar ao resuMe. Recarregue a extensão.
- Sem perfil: backend responde 400 com Perfil mestre não encontrado. Complete o onboarding primeiro.

Pós-condições: vaga estruturada salva no histórico. PDF pronto para baixar.

## UC-03 seleção manual com prévia editável

Atores: candidato, content script, motor local.
Pré-condições: perfil mestre salvo. Captura automática fraca ou página com login wall.

Fluxo principal:
1. Candidato clica em seleção manual no painel em ui/src/SidePanelApp.tsx.
2. Ui/src/chrome.ts envia resume-capture-start e a página entra em modo select.
3. Candidato passa o mouse, vê destaque e confirma com Enter ou clique.
4. Content script em extension/content.js recorta o texto do painel e lê blocos estruturados.
5. Script chama POST /api/adapt-text com mode manual.
6. Painel mostra resultado igual ao automático com prévia para ajuste.

Fluxos alternativos e exceções:
- Texto menor que 80 caracteres: mostra O texto selecionado é muito curto para extrair a vaga.
- Backend devolve 400: mostra Texto curto demais para extrair a vaga. e mantém o modo select.
- Usuário cancela com Escape: script envia resume-capture-cancel e limpa o destaque.

Pós-condições: mesmo resultado da captura automática, com origem manual registrada.

## UC-04 adaptar sem chave com heurística

Atores: candidato, motor local sem chave IA.
Pré-condições: perfil mestre salvo. Nenhuma chave configurada em /api/settings.

Fluxo principal:
1. Candidato captura por via automática ou manual e a tela chama POST /api/adapt-text.
2. Backend chama backend/app/services/ai/vision.py que detecta ausência de chave.
3. Heurística extrai título, empresa, local, requisitos e keywords por regex.
4. Backend monta tailored_profile por mescla com o mestre em backend/app/api/routes.py.
5. Backend roda 2 passes de keywords e compila LaTeX em backend/app/services/latex/engine.py.
6. Painel mostra CV gerado com honest_gaps para requisitos sem evidência.

Fluxos alternativos e exceções:
- Texto menor que 80 caracteres: backend responde 400 com Texto curto demais para extrair a vaga.
- IA configurada mas com erro: backend retorna 400 com a mensagem do provedor e a tela exibe o detalhe.
- Falha de compilação sem compilador: backend responde que No LaTeX compiler found e orienta instalar Tectonic.

Pós-condições: histórico contém item gerado por heurística. PDF abre no Estúdio.

## UC-05 refinar no Estúdio

Atores: candidato, Estúdio React.
Pré-condições: adaptação existe em localStorage resume_studio. Backend com o resume salvo.

Fluxo principal:
1. Candidato clica em abrir Estúdio no painel e o app abre studio.html via ui/src/chrome.ts.
2. Ui/src/StudioApp.tsx carrega payload e renderiza ui/src/components/studio/StudioWorkspace.tsx.
3. Candidato edita resumo, bullets, skills ou código tex direto na aba LaTeX.
4. Candidato clica recompilar e a tela chama PUT /api/resumes/{id} com profile ou tex_code.
5. Backend recompila e retorna tex mais pdf_url novos.
6. Estúdio atualiza iframe com timestamp e mostra confirmação salva.

Fluxos alternativos e exceções:
- Sem payload: Estúdio mostra Nenhum resultado carregado e orienta capturar no painel.
- Erro de save: tela mostra Não salvou. com a mensagem do backend e mantém o PDF anterior.
- Polish de bullet sem chave: POST /api/polish-bullet retorna 400 e o bullet original permanece.

Pós-condições: mesmo id de resume com tex e PDF atualizados. Histórico reflete a edição.

## UC-06 baixar com nome padrão

Atores: candidato, navegador.
Pré-condições: adaptação compilada com pdf_url e pdf_filename.

Fluxo principal:
1. Candidato clica baixar PDF no painel em ui/src/SidePanelApp.tsx ou no Estúdio.
2. Tela usa ui/src/cvFilename.ts como fallback e prefere pdf_filename do backend.
3. Backend serve GET /api/resumes/{id}/pdf com content-disposition de backend/app/services/latex/filenames.py.
4. Navegador salva arquivo como CVMateus-Seguranca-da-Informacao.pdf.

Fluxos alternativos e exceções:
- Nome do candidato vazio: gera CV-Area.pdf com área da vaga ou empresa.
- Título com acento: normaliza para ASCII seguro para ATS e filesystem.
- PDF ausente no disco: endpoint retorna 404 e a tela mantém o botão para recompilar.

Pós-condições: arquivo local com nome canônico pronto para anexar na candidatura.

## UC-07 gerenciar histórico

Atores: candidato, motor local.
Pré-condições: ao menos uma adaptação salva. Backend responde em GET /api/history.

Fluxo principal:
1. Candidato abre aba arquivo no painel e vê ui/src/components/history/ApplicationHistory.tsx.
2. Tela chama GET /api/history e lista até 50 itens com título, empresa e data.
3. Candidato baixa PDF por item com download e pdf_filename.
4. Candidato exclui item e a tela chama DELETE /api/resumes/{id}.
5. Lista atualiza sem recarregar a página.

Fluxos alternativos e exceções:
- Histórico vazio: tela mostra estado vazio e sugere capturar uma vaga.
- Falha de load: console registra history load failed e a tela mantém lista vazia.
- Item sem pdf_path: campo pdf_filename cai para string vazia e o download usa fallback local.

Pós-condições: lista reflete apenas itens ativos. Excluídos não aparecem em GET /api/history.

## UC-08 trocar provedor IA

Atores: candidato, motor local, provedor externo opcional.
Pré-condições: backend responde em GET /api/settings. Catálogo com 12 provedores disponível.

Fluxo principal:
1. Candidato abre configurações em ui/src/components/settings/SettingsPanel.tsx.
2. Tela carrega GET /api/settings com ai_provider, ai_model e key_providers.
3. Candidato escolhe provedor do catálogo de backend/app/services/ai/gateway.py.
4. Candidato cola chave do provedor e clica testar via POST /api/settings/test.
5. Candidato salva com PUT ou POST /api/settings com ai_provider, ai_model, ai_api_key e provider_for_key.
6. Backend guarda chave por provedor via backend/app/config.py sem expor em GET.

Fluxos alternativos e exceções:
- Chave inválida: teste retorna 400 com mensagem do provedor e nada é salvo.
- Provedor local Ollama: dispensa chave e permite custom_base para URL local.
- Modelo vazio: tela detecta modelos via POST /api/models e pede escolha explícita.

Pós-condições: próxima adaptação usa o novo provedor. Chave antiga do outro provedor permanece guardada.

## W-01 editar no documento maximizado

Atores: candidato, workspace React, PDF.js.
Pré-condições: adaptação aberta no Estúdio com pdf_url e tex_code.

Fluxo principal:
1. Workspace abre direto no documento, com a barra única de 48 px e sem painéis laterais fixos.
2. PdfViewer renderiza cada página e divide o texto em palavras; cada palavra vira uma área clicável ligada a um campo.
3. Cabeçalhos de seção e palavras sem match exato herdam o campo da linha ou da seção: nenhuma palavra fica inerte.
4. Candidato clica em qualquer palavra: uma textarea abre no lugar, com o valor do campo inteiro.
5. Enter ou blur aplica; Esc cancela. O campo é reescrito no trecho certo do .tex (nada de código LaTeX visível).
6. Workspace salva perfil e tex, backend recompila e a página recarrega com cache-buster.
7. HUD inferior mostra o nome do campo e o atalho; o flash confirma o ponto editado.

Fluxos alternativos e exceções:
- Palavra sem campo: herda o campo da linha anterior; se ainda assim não houver, abre o primeiro campo da seção.
- Texto com escape LaTeX: o valor é escapado antes de entrar no .tex.
- Falha de compile: status muda para "Não salvou" e o PDF anterior permanece.
- Compilador MiKTeX: roda sem janela de console (CREATE_NO_WINDOW + SW_HIDE), sem spam na tela.

Pós-condições: mesmo resume_id com tex_code e PDF atualizados; versão nova na lista.

## W-02 reordenar e ocultar seções

Atores: candidato, folha Estrutura, template Jinja.
Pré-condições: perfil carregado no workspace.

Fluxo principal:
1. Candidato abre Estrutura na barra; a folha sobrepõe o documento sem empurrá-lo.
2. Arrasta uma seção para mudar a ordem, ou usa as setas por teclado.
3. Arrasta um item dentro de uma seção para reordenar experiências, skills etc.
4. Clica no olho para esconder uma seção do PDF sem apagar seu conteúdo.
5. Workspace grava profile.layout.sections; autosave recompila.
6. Template editorial percorre ns.order e só emite seções visíveis.

Fluxos alternativos e exceções:
- Seção vazia: continua na lista, sem itens para expandir.
- Arraste cancelado: nada muda; o destaque de destino some.
- Restaurar versão: volta o perfil da versão escolhida.

Pós-condições: PDF sai na ordem escolhida; esconder e mostrar é reversível.

## W-03 entender as métricas

Atores: candidato, folha Métricas, motor local.
Pré-condições: adaptação com match_score e keywords/requirements da vaga.

Fluxo principal:
1. Candidato clica no chip ATS na barra; a folha abre com quatro métricas.
2. Cada métrica mostra valor, fonte (medido/estimado) e o que o número significa.
3. Palavras da vaga faltando aparecem com "tenho" e "não".
4. "tenho" adiciona a palavra a skills, salva e a cobertura é recalculada no backend.
5. "não" dispensa a palavra só na sessão.
6. Em "Seu alvo", candidato escolhe momento, tom e área; vira localStorage por resume.

Fluxos alternativos e exceções:
- Sem keywords na vaga: painel diz que a cobertura aparecerá na próxima captura.
- IA indisponível na captura: Aderência aparece como estimado e o texto explica a heurística.
- Palavra já em Habilidades: aviso em vez de duplicata.

Pós-condições: cobertura ATS reflete o perfil atual; alvo fica disponível para o chat.

## W-04 ajustar com IA sem perder o controle

Atores: candidato, folha Chat, backend /api/resumes/{id}/chat.
Pré-condições: perfil carregado e "Seu alvo" opcionalmente preenchido.

Fluxo principal:
1. Candidato abre o chat na barra ou com ⌘K.
2. Escreve o pedido; o contexto do alvo entra como prefixo, marcado como não-editable.
3. Três passos de progresso aparecem enquanto a IA responde.
4. A resposta entra no currículo, o autosave recompila e o PDF muda atrás da folha.
5. Cada resposta traz chips do que mudou, diff colapsável e "Desfazer".
6. Candidato desfaz se não gostar; o perfil anterior volta.

Fluxos alternativos e exceções:
- Sem chave: backend devolve erro legível; nenhuma mudança entra.
- Resposta sem alteração: diff não aparece.
- Mensagem vazia: botão Enviar fica desativado.

Pós-condições: mudança aplicada e auditável; desfazer restaura o estado anterior.

## W-05 trocar de candidatura

Atores: candidato, folha Candidaturas.
Pré-condições: ao menos uma adaptação no histórico.

Fluxo principal:
1. Candidato abre Candidaturas na barra.
2. Lista com busca por vaga ou empresa e botão de capturar nova vaga.
3. Selecionar item carrega detail, perfil, tex e PDF daquela vaga.
4. A folha fecha e o documento permanece maximizado no mesmo lugar.

Fluxos alternativos e exceções:
- Mesmo item: folha só fecha, sem recarregar.
- Falha de load: aviso e nada é sobrescrito.
- Em 390 px: backdrop fecha a folha ao toque fora.

Pós-condições: workspace mostra a candidatura escolhida, sem salvar a anterior por cima.
