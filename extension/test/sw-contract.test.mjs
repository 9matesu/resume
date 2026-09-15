// resuMe SW/manifest contracts. Run from extension/test: node --test sw-contract.test.mjs
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert';
const sw = readFileSync(new URL('../background.js', import.meta.url), 'utf8');
const man = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('manifest pede nativeMessaging (sendNativeMessage falha sem isso)', () => {
  assert.ok(man.permissions.includes('nativeMessaging'));
});
test('SW garante backend no onInstalled e onStartup (fire-and-forget)', () => {
  assert.match(sw, /chrome\.runtime\.onInstalled\.addListener/);
  assert.match(sw, /chrome\.runtime\.onStartup\.addListener/);
  assert.match(sw, /sendNativeMessage\(\s*["']com\.resume\.host["']/);
});
