import { describe, expect, test } from 'vitest';
import { z } from 'astro/zod';
import { evenementSchema, pageSchema } from '../../src/lib/schemas';

// En test, l'helper image() d'Astro est remplacé par une simple chaîne.
const fakeImage = () => z.string();

describe('evenementSchema', () => {
  test('refuse une fin antérieure au début', () => {
    const r = evenementSchema.safeParse({ title: 'x', start: '2026-06-23', end: '2026-06-21' });
    expect(r.success).toBe(false);
  });

  test('accepte un événement sur plusieurs jours', () => {
    const r = evenementSchema.safeParse({ title: 'Le bouchon de la N9', start: '2026-06-21', end: '2026-06-23' });
    expect(r.success).toBe(true);
  });

  test('accepte un lien https', () => {
    const r = evenementSchema.safeParse({ title: 'x', start: '2026-06-21', link: 'https://example.org/rallye' });
    expect(r.success).toBe(true);
  });

  test.each(['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'http://example.org/', 'ftp://example.org/'])(
    'refuse le lien %s',
    (link) => {
      const r = evenementSchema.safeParse({ title: 'x', start: '2026-06-21', link });
      expect(r.success).toBe(false);
    },
  );
});


describe('pageSchema', () => {
  const base = { title: 'Qui sommes-nous ?', section: 'vie-du-club', order: 1, description: 'Présentation du club.' };

  test('refuse la section « forum »', () => {
    const r = pageSchema(fakeImage).safeParse({ ...base, section: 'forum' });
    expect(r.success).toBe(false);
  });

  test('legacyIds vaut [] par défaut', () => {
    const r = pageSchema(fakeImage).parse(base);
    expect(r.legacyIds).toEqual([]);
    expect(r.legacyRubriques).toEqual([]);
  });
});

