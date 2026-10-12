# Design do resuMe: sistema de marca e produto

## Essência da marca
O resuMe é um editor de candidaturas, não um site de promessas: monograma Me em preto sobre amarelo, modernismo suíço com grade simples e duas cores. Nada de gradientes decorativos ou vidro: borda de 2px, sombra dura e texto direto.

## Logotipo e uso
O svg atual é um retângulo amarelo de cantos arredondados com o texto Me em Helvetica/Arial bold preto (ui/public/logo.svg:1, ui/public/logo.svg:5). Fundo amarelo com traço e letra pretos; sobre foto, usar versão com contorno preto de 2px. Tamanho mínimo sugerido: 16px de altura em UI, 32px em impresso — não há constante de tamanho mínimo no código, tratar como guia. Não fazer: trocar a ordem das cores, aplicar sombra suave ou blur, esticar o svg, usar outra família no monograma, colocar o Me sobre amarelo diferente do token da superfície. Pendência conhecida: o README descreve um monograma geométrico construído (M monolinear mais e de um andar sobre preto); o svg em disco não segue essa construção. Uma das duas descrições precisa virar a canônica.

## Paleta
Preto #000000 e amarelo #ffff00 no app (ui/src/index.css:63, ui/src/index.css:70); o site e o logo usam #ffe800 (site/landing.css:5, ui/public/logo.svg:2). Neutros de suporte: branco, #f1f1f1 desabilitado, #9a9a9a placeholder, #777777 texto desabilitado, bordas #1a1a1a e #e5e5e5 (ui/src/index.css:162, ui/src/index.css:167, ui/src/index.css:126, ui/src/index.css:142). Regra de duas cores: superfícies só alternam entre branco, preto e amarelo; sem gradientes como preenchimento — exceção única é a seta do select, desenhada com linear-gradient (ui/src/index.css:175).

## Tipografia
Instrument Serif só em títulos editoriais via .font-editorial (ui/src/index.css:56); Inter em todo o resto, inclusive botões e inputs que herdam a fonte (ui/src/index.css:47, ui/src/index.css:52). Mono real só para código e TeX: --font-mono é pilha ui-monospace (ui/src/index.css:30), usada no editor de código (ui/src/components/studio/StudioWorkspace.tsx:623). Arquivos locais: ui/public/fonts/inter-wght.woff2, instrument-regular.woff2 e instrument-italic.woff2, com licenças OFL ao lado. O site usa as mesmas duas famílias locais (site/landing.css:15, site/landing.css:20): zero CDN, zero Google Fonts, o teste trava isso (site/test/landing.test.mjs:82).

## Componentes
Classes canônicas em ui/src/index.css: .brutal-card com radius 14px e sombra 4px (ui/src/index.css:66); .brutal-yellow-card com radius 18px e sombra 8px (ui/src/index.css:73); .brutal-btn e .brutal-btn-yellow com radius 10px, sombra 3px e uppercase (ui/src/index.css:80, ui/src/index.css:103); .brutal-input com radius 10px e foco com sombra amarela (ui/src/index.css:146, ui/src/index.css:158); .brutal-tag é pill 999px com uppercase e tracking (ui/src/index.css:186). Tokens: --radius-soft 14px e --radius-pill 999px (ui/src/index.css:31). Sombras sempre duras, sem blur: 3px em botões e inputs, 4px em cards, 8px em destaque. Botões sempre uppercase bold; tags sempre uppercase 10px.

## Voz e tom
PT-BR direto, sem dev-speak: falar o que aconteceu e o próximo passo. Mensagens reais do código: Captura só funciona dentro da extensão (ui/src/chrome.ts:25); Recarregue a página da vaga (F5) e tente de novo (ui/src/chrome.ts:34); Não deu para selecionar o painel (ui/src/chrome.ts:36); Não achei a vaga sozinho (ui/src/chrome.ts:50); Falha na captura (ui/src/chrome.ts:77); Não consegui ler esse currículo (ui/src/components/onboarding/OnboardingWizard.tsx:86); Não salvei o perfil (ui/src/components/onboarding/OnboardingWizard.tsx:224); Perfil mestre não encontrado. Complete o onboarding primeiro (backend/app/api/routes.py:257). Evitar: código de erro cru, sigla de infra (sidecar, FastAPI, SQLite) no texto visível — o teste do site proíbe esses termos na landing (site/test/landing.test.mjs:77).

## Iconografia
Padrão lucide-react em toda a UI (ui/package.json:16), com imports por componente (ui/src/components/studio/StudioWorkspace.tsx:9, ui/src/SidePanelApp.tsx:7). Criar ícone próprio só quando: não existir equivalente Lucide, o símbolo for específico do produto (marca Me), ou o traço 2px puro falhar em tamanho pequeno. Manter traço consistente com borda 2px do sistema.

## Evolução
O que mudou: de quadrado total para radius 14px em cards, 10px em botões e inputs, pill 999px em tags (ui/src/index.css:31, ui/src/index.css:69, ui/src/index.css:84, ui/src/index.css:191). O teste E2E trava a mudança com o comentário Design menos quadrado e a afirmação de raio maior que zero (ui/e2e/sidepanel.spec.ts:39, ui/e2e/sidepanel.spec.ts:44). Pendência conhecida: amarelo diverge entre #ffff00 no app e #ffe800 no site e logo; unificar exige decidir qual valor sobrevive.
