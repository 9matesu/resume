# Design do resuMe: sistema de marca e produto

## Essência da marca
O resuMe é um editor de candidaturas, não um site de promessas: monograma Me em preto sobre amarelo, modernismo suíço com grade simples e duas cores. Nada de gradientes decorativos ou vidro. A superfície é calma, com borda de 1px, sombra suave e texto direto.

## Logotipo e uso
O svg atual é um retângulo amarelo de cantos arredondados com o texto Me em Helvetica/Arial bold preto. Fundo amarelo com traço e letra pretos; sobre foto, usar versão com contorno preto. Tamanho mínimo sugerido: 16px de altura em UI, 32px em impresso. Não fazer: trocar a ordem das cores, aplicar sombra suave ou blur, esticar o svg, usar outra família no monograma, colocar o Me sobre amarelo diferente do token da superfície.

## Paleta
Preto `#000000` e amarelo `#ffe800` no app e no site. Neutros de suporte: branco, `#f5f5f5` (superfície), `#999999` (placeholder), `#666666` (texto secundário), `#e3e3e3` (linha). Regra de duas cores: superfícies alternam entre branco, preto e amarelo; sem gradientes como preenchimento.

## Tipografia
Switzer em toda a interface, inclusive botões e inputs. Instrument Serif só em títulos editoriais via `.font-editorial`. Mono real só para código e TeX: `--font-mono` é pilha `ui-monospace`, usada no editor de código. Arquivos locais: `ui/public/fonts/switzer.woff2`, `instrument-regular.woff2` e `instrument-italic.woff2`, com licenças ao lado. O site usa as mesmas famílias locais. Zero CDN, zero Google Fonts. A fonte do PDF é escolhida em Ajustes → Documento: Latin Modern (padrão), Helvetica, Times, Charter, Linux Libertine ou TeX Gyre Heros.

## Componentes
- `.brutal-card`: superfície branca, borda 1px, radius 12, sombra suave.
- `.brutal-yellow-card`: superfície amarela pálida, borda 1px, radius 14.
- `.brutal-btn` / `.brutal-btn-yellow`: radius 9, borda 1px, sombra suave, peso 600, sem uppercase.
- `.brutal-input`: radius 9, borda 1px, foco com anel amarelo 4px.
- `.brutal-tag`: pill de 999px, fundo cinza pálido, peso 600, sem uppercase.
- `shadow-mac`: sombra padrão para superfícies flutuantes.

## Voz e tom
PT-BR direto, sem dev-speak: falar o que aconteceu e o próximo passo. Headings em sentence case, sem emojis. Erros dizem o que aconteceu e o próximo passo.

## Iconografia
Padrão lucide-react em toda a UI, com imports por componente. Criar ícone próprio só quando não existir equivalente Lucide, o símbolo for específico do produto ou o traço 2px puro falhar em tamanho pequeno.

## Evolução
O design saiu do brutalismo duro (bordas 2px, sombras deslocadas, uppercase) para uma superfície macOS: bordas 1px, sombras suaves, radius maior, tipografia Switzer e amarelo unificado em `#ffe800`. O Estúdio virou um modal em tela cheia com opção de abrir em janela separada, e ganhou uma aba de chat com IA.