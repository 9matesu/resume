# Requisitos do resuMe

Extensão Chrome MV3 com motor FastAPI local em 127.0.0.1:8322.
UI em React com painel lateral e Estúdio.
Compilação LaTeX com Tectonic ou pdflatex.

## Requisitos funcionais

| ID | Descrição | Código | Critério de aceite observável |
|----|-----------|--------|-------------------------------|
| RF-01 | Salva o perfil mestre no onboarding via assistente em etapas. Vale para importação de PDF, DOCX ou preenchimento manual. | ui/src/components/onboarding/OnboardingWizard.tsx:214 | POST /api/profile retorna 200 e GET /api/profile retorna has_profile true com o nome digitado. |
| RF-02 | Captura a vaga automaticamente a partir do DOM sem clique do usuário. Usa fallback para seleção manual quando a confiança é baixa. | extension/content.js:493 | Clicar em captura automática no painel chama resume-capture-auto e retorna JSON da vaga ou sugere seleção manual. |
| RF-03 | Permite seleção manual do painel da vaga com destaque visual e envio do texto recortado. Bloqueia texto menor que 80 caracteres. | extension/content.js:331 | Ativar resume-capture-start entra em modo select, Enter confirma e POST /api/adapt-text recebe job_text com mode manual. |
| RF-04 | Extrai a vaga com IA quando há chave e usa heurística determinística sem chave ou em falha da IA. Nunca inventa empresa ou requisitos. | backend/app/services/ai/vision.py:31 | Com chave vazia, POST /api/adapt-text ainda retorna job com title, company e requirements extraídos por regex. |
| RF-05 | Adapta o currículo em 2 passes contra a vaga e lista lacunas honestas em honest_gaps. O segundo passe só caça keywords ATS ausentes. | backend/app/api/routes.py:283 | Resposta de /api/adapt-text contém tailored_profile, match_score 0 a 100, applied_keywords e honest_gaps com até 10 itens. |
| RF-06 | Compila LaTeX para PDF em diretório isolado com 2 tentativas. Prefere Tectonic empacotado, senão usa pdflatex do sistema. | backend/app/services/latex/engine.py:245 | Cada adaptação retorna tex_code e pdf_url válido. GET /api/resumes/{id}/pdf baixa PDF com mais de 0 bytes. |
| RF-07 | Gera nome canônico ASCII para o PDF no padrão CVPrimeiroNome-Area.pdf. Exibe o mesmo nome no painel, no Estúdio e no histórico. | backend/app/services/latex/filenames.py:47 | Vaga Segurança da Informação com candidato Mateus gera CVMateus-Seguranca-da-Informacao.pdf no header content-disposition. |
| RF-08 | Lista o histórico das últimas 50 adaptações com download e exclusão por item. Mostra título, empresa, data e nome do PDF. | backend/app/api/routes.py:402 | GET /api/history lista itens criados. DELETE /api/resumes/{id} remove o item da lista. |
| RF-09 | Edita o currículo no Estúdio nas abas visual e LaTeX e recompila in-place sem criar novo registro. Atualiza o PDF na mesma URL. | ui/src/components/studio/StudioWorkspace.tsx:86 | Editar summary ou tex_code e clicar recompilar chama PUT /api/resumes/{id} e o iframe do PDF recarrega com timestamp novo. |
| RF-10 | Configura provedor IA, modelo, chave por provedor e URL base. Testa a chave antes de salvar e guarda chaves por provedor. | backend/app/services/ai/gateway.py:336 | Trocar ai_provider em /api/settings e salvar api_key com provider_for_key mantém chaves separadas por provedor no catálogo. |
| RF-11 | Inicia motor e Chrome com perfil isolado por script leve sem pip install nem build. Reusa o motor se a porta já responde. | Abrir-resuMe.ps1:1 | Duplo clique abre chrome com --load-extension e GET http://127.0.0.1:8322/api/health retorna ok sem instalar dependências. |
| RF-12 | Cobre painel e Estúdio com testes Playwright e screenshots por cenário. Valida nome do PDF, layout 400px e ausência de overflow. | ui/e2e/sidepanel.spec.ts:37 | npx playwright test passa e gera e2e/screenshots/sidepanel-capture.png, studio-loaded.png e studio-mobile.png. |

## Requisitos não funcionais

- RNF-01: Privacidade local-first. Perfil e histórico ficam no SQLite local. Chave de API vive só na memória do servidor.
- RNF-02: Operação parcial sem rede de IA. Heurística gera vaga e CV compilável sem chave ou com queda do provedor.
- RNF-03: Captura responde em poucos segundos. Falha transitória tenta 2 vezes com intervalo de 800 ms antes de reportar erro.
- RNF-04: Compilação LaTeX tolera falha transitória. Erro transitório marca transient true e repete uma vez antes de falhar.
- RNF-05: Portabilidade Windows e Chrome. Manifest exige Chrome 114. Host resolve python e backend_dir sem caminho absoluto.
- RNF-06: Acessibilidade no painel de 400px. Sem overflow horizontal. Alvos de clique visíveis em viewport estreito.
- RNF-07: Launcher sem dependências. Script usa apenas binário existente ou python embutido. Não roda pip install nem venv.
- RNF-08: Documentação viva junto ao código. Cada RF cita path:line conferido por grep. Matriz abaixo liga requisito a caso de uso.

## Matriz de rastreabilidade

- RF-01 onboarding do perfil mestre -> UC-01
- RF-02 captura automática -> UC-02
- RF-03 seleção manual com prévia -> UC-03
- RF-04 extração IA com fallback heurístico -> UC-02, UC-03, UC-04
- RF-05 adaptação em 2 passes com honest_gaps -> UC-04
- RF-06 compilação LaTeX -> UC-04, UC-05
- RF-07 nome canônico do PDF -> UC-06
- RF-08 histórico de candidaturas -> UC-07
- RF-09 edição no Estúdio com recompile -> UC-05
- RF-10 configurações multi-provedor -> UC-08
- RF-11 launcher leve -> UC-02, UC-04
- RF-12 E2E com screenshots -> todos os UC de regressão
