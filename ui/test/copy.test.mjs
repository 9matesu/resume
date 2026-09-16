// resuMe copy contracts (humanizer pass). Run from ui/test: node --test copy.test.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') || p.endsWith('.ts') ? [p] : [];
  });
}
const all = walk(SRC).map((f) => readFileSync(f, 'utf8')).join('\n');
// string literals only (single-quoted), ignore code arrows etc.
const strings = [...all.matchAll(/'([^'\n]{8,})'/g)].map((m) => m[1]);

test('zero confirmacao "com sucesso"/"bem-sucedida" na UI', () => {
  for (const s of strings) {
    assert.doesNotMatch(s, /com sucesso|bem-sucedid/, 'string: ' + s);
  }
});
test('zero seta como prosa em string de status', () => {
  for (const s of strings) {
    assert.doesNotMatch(s, /[^=\u00bb]\u2192/, 'string: ' + s);
  }
});
test('acentuacao PT-BR consistente nas strings visiveis', () => {
  for (const bad of ['configuracoes', 'historico', 'extensao', 'selecao', 'pagina', 'paineis', 'disponivel', 'pre-visualizacao']) {
    assert.ok(
      !strings.some((s) => new RegExp('\\b' + bad + '\\b').test(s)),
      'sem acento: ' + bad
    );
  }
});
