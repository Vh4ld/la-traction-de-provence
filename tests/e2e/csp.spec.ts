import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const htmlFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  );

// La CSP n'autorise que 'self' : aucun script exécutable ni style en ligne.
test('aucun script ni style en ligne dans les pages générées', () => {
  for (const file of htmlFiles('dist')) {
    const html = readFileSync(file, 'utf8');
    expect(html, file).not.toMatch(/\sstyle="/);
    expect(html, file).not.toMatch(/<style[\s>]/);
    for (const [tag] of html.matchAll(/<script\b[^>]*>(?!<\/script>)/g)) {
      expect(/type="application\/ld\+json"/.test(tag) || /\ssrc="/.test(tag), `${file} : ${tag}`).toBe(true);
    }
    expect(html, file).not.toMatch(/\son[a-z]+="/);
  }
});
