// resuMe landing contracts. Run: node --test site/test/landing.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../landing.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const js = readFileSync(new URL('../landing.js', import.meta.url), 'utf8');

function section(id, nextId) {
  return html.split(`id="${id}"`)[1].split(`id="${nextId}"`)[0];
}

test('pt-BR + meta viewport + title resuMe', () => {
  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /<title>resuMe/);
});

test('CTA único aponta para o setup .exe do release 1.2', () => {
  assert.match(html, /releases\/download\/v1\.2\.0\/resuMe-1\.2\.0-setup\.exe/);
  assert.ok((html.match(/install-cta/g) || []).length >= 2);
  assert.doesNotMatch(html, /windows-x64\.zip/, 'zip portátil removido');
});

test('dialog howto in-page', () => {
  assert.match(html, /<dialog id="howto"/);
  assert.match(js, /showModal/);
});

test('sem labels e sem flavor text de topo', () => {
  assert.doesNotMatch(html, /class="label"/, 'labels removidos');
  assert.doesNotMatch(html, /extensão chrome · grátis · sem conta/i);
  assert.doesNotMatch(html, /captura · revisão · pdf/i);
});

test('hero sem vídeo e sem demo', () => {
  assert.doesNotMatch(html, /<video/i);
  assert.doesNotMatch(html, /demo\.mp4/);
  assert.doesNotMatch(html, /demo-frame/);
  assert.ok(!existsSync(new URL('../assets/demo.mp4', import.meta.url)), 'demo.mp4 apagado');
});

test('h1 dinâmico com frases que trocam', () => {
  assert.match(html, /id="hero-rot"/);
  assert.match(js, /PHRASES/);
  assert.match(js, /rot-phrase/);
  assert.match(js, /setInterval/);
  assert.match(js, /pronto/);
  assert.match(js, /processo seletivo/);
});

test('scroll hijack seção a seção', () => {
  assert.match(js, /addEventListener\('wheel'/);
  assert.match(js, /function goTo/);
  assert.match(js, /data-section/);
  assert.match(css, /\.dots\s*\{/);
  assert.match(css, /\.dot\s*\{/);
  assert.match(html, /id="dots"/);
});

test('temas escuro/claro por seção', () => {
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /data-theme="light"/);
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /body\[data-theme="dark"\] header\.site/);
});

test('texto caindo em [data-split]', () => {
  assert.match(css, /\[data-split\] \.word/);
  assert.match(js, /splitWords/);
  assert.match(html, /data-split/);
});

test('seção de download traz pacote e requisitos', () => {
  const dl = section('baixar', 'privacidade');
  assert.match(dl, /resuMe-1\.2\.0-setup\.exe/);
  assert.match(dl, /Windows 10\/11/);
  assert.match(dl, /Google Chrome/);
  assert.match(dl, /5 minutos/);
  assert.match(dl, /PDF, Word ou texto/);
  assert.match(dl, /LaTeX/);
  assert.match(dl, /ATS/);
  assert.match(dl, /Ollama/);
  assert.match(dl, /aberto/);
});

test('workflow com passos e dicas de uso', () => {
  assert.match(html, /id="como-usar"/);
  const steps = (html.match(/class="flow-step[ "]/g) || []).length;
  assert.ok(steps >= 4, `esperava >=4 passos, achei ${steps}`);
  assert.match(html, /class="tips[ "]/);
  assert.match(html, /Capture o painel da vaga/);
});

test('manifesto e seção do empreendedor digital', () => {
  assert.match(html, /processo seletivo/i);
  assert.match(html, /cinco anos de experiência/i);

  const zr = section('ze-ruela', 'como-usar');
  assert.match(zr, /empreendedor digital/);
  assert.match(zr, /zé ruela/);
  assert.match(zr, /dar balão no capitalismo/i);
  assert.match(zr, /Pelo amor de Deus/i);
  assert.match(zr, /código aberto/i);
});

test('escrita no scroll e troca de texto no hover', () => {
  assert.match(html, /data-write/);
  assert.match(js, /paintWrite/);
  assert.match(css, /\[data-write\] \.w/);
  assert.match(html, /class="swap"/);
  assert.match(css, /\.swap-b/);
  assert.doesNotMatch(html, /data-hover=/, 'tooltip removido');
});

test('sem a linha v1.2 · Windows 10/11 · Google Chrome', () => {
  assert.doesNotMatch(html, /v1\.2 · Windows 10\/11 · Google Chrome/);
});

test('FAQ usa details/summary', () => {
  assert.match(html, /<details/);
  assert.match(html, /<summary/);
  assert.ok((html.match(/<details/g) || []).length >= 5);
});

test('seções existem e todo link interno #tem alvo', () => {
  for (const id of ['top', 'manifesto', 'ze-ruela', 'como-usar', 'baixar', 'privacidade', 'faq', 'final']) {
    assert.match(html, new RegExp(`id="${id}"`), `seção #${id} ausente`);
  }
  const anchors = [...html.matchAll(/href="#([\w-]+)"/g)].map((m) => m[1]);
  for (const a of anchors) {
    assert.match(html, new RegExp(`id="${a}"`), `âncora #${a} sem alvo`);
  }
  assert.ok(anchors.length >= 2);
});

test('zero Google Fonts; Switzer local', () => {
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  assert.doesNotMatch(html, /api\.fontshare\.com/);
  assert.match(html, /switzer\.woff2/);
});

test('sem linguagem defensiva', () => {
  for (const bad of [/sem inventar/i, /não mentimos?/i, /não garantimos/i, /não promete/i,
    /não cria experiência/i, /\bhonesto\b/i, /\bconfiável\b/i, /\bseguro\b/i]) {
    assert.doesNotMatch(html, bad, 'defensivo: ' + bad);
  }
});

test('sem clichês de landing page', () => {
  for (const bad of [/revolucione/i, /turrine?/i, /alavanque/i, /solução completa/i, /poderoso/i]) {
    assert.doesNotMatch(html, bad, 'clichê: ' + bad);
  }
});

test('sem jargão técnico nem prova social fabricada', () => {
  assert.doesNotMatch(html, /native host|sidecar|FastAPI|SQLite/i);
  assert.doesNotMatch(html, /\d+[\d.]*\s*(mil|k usuários|usuários ativos|downloads)/i);
});

test('botões com estados visíveis e foco acessível', () => {
  assert.match(css, /\.btn:hover/);
  assert.match(css, /\.btn:active/);
  assert.match(css, /:focus-visible/);
});

test('respeita prefers-reduced-motion e tem barra sticky mobile', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.sticky-bar/);
  assert.match(css, /\.ticker-track/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /\.progress/);
});

test('sem overflow horizontal', () => {
  assert.match(css, /overflow-x:\s*clip/);
});

test('assets existem no disco; poster segue para o og:image', () => {
  for (const f of ['../assets/demo-poster.jpg', '../landing.css', '../landing.js', '../fonts/switzer.woff2']) {
    assert.ok(existsSync(new URL(f, import.meta.url)), f + ' missing');
  }
});