import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'extension', 'assets');
if (!existsSync(dir)) process.exit(0);
for (const file of readdirSync(dir)) {
  if (file.endsWith('.js') || file.endsWith('.css')) {
    unlinkSync(join(dir, file));
  }
}