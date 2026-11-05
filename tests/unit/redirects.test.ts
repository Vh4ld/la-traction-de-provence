import { describe, expect, test } from 'vitest';
import { buildRedirectMaps } from '../../scripts/gen-redirects';

const pages = [
  { url: '/vie-du-club/qui-sommes-nous/', legacyIds: [53], legacyRubriques: [] },
  { url: '/vie-du-club/les-tractionnettes/', legacyIds: [], legacyRubriques: [5] },
  { url: '/mains-sales/', legacyIds: [76], legacyRubriques: [] },
];

describe('buildRedirectMaps', () => {
  test('une ligne nginx par ancien article et par ancienne rubrique', () => {
    const maps = buildRedirectMaps(pages, []);
    expect(maps.articles).toContain('53 /vie-du-club/qui-sommes-nous/;');
    expect(maps.articles).toContain('76 /mains-sales/;');
    expect(maps.rubriques).toContain('5 /vie-du-club/les-tractionnettes/;');
  });

  test('refuse un ancien numéro attribué à deux pages', () => {
    expect(() => buildRedirectMaps([...pages, { url: '/autre/', legacyIds: [53], legacyRubriques: [] }], [])).toThrow(/53/);
  });

  test('PDF : ancienne adresse IMG/pdf, quelle que soit la casse, vers /documents/', () => {
    const maps = buildRedirectMaps([], ['ac4606.pdf', 'eclate_caburateur_solex_32_b.p.i.c.pdf']);
    expect(maps.pdfs).toContain('~*^/IMG/pdf/ac4606\\.pdf$ /documents/ac4606.pdf;');
    expect(maps.pdfs).toContain('~*^/IMG/pdf/eclate_caburateur_solex_32_b\\.p\\.i\\.c\\.pdf$ /documents/eclate_caburateur_solex_32_b.p.i.c.pdf;');
  });
});
