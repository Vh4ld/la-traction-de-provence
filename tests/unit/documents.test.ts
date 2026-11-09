import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'public/documents';
const pdfs = readdirSync(dir).filter((f) => f.endsWith('.pdf'));

// Les PDF publiés ne doivent contenir ni chemin local (file:///C:/Users/…),
// ni lien vers un domaine abandonné qui pourrait être racheté (postimg.org).
describe('PDF publiés', () => {
  test.each(pdfs)('%s : aucun lien local ni domaine abandonné', (f) => {
    const text = readFileSync(join(dir, f)).toString('latin1');
    expect(text).not.toMatch(/file:\/\/\//i);
    expect(text).not.toMatch(/postimg\.org/i);
  });
});
