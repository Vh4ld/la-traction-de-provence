import { describe, expect, test } from 'vitest';
import { slugify } from '../../src/lib/slug';

describe('slugify', () => {
  test('retire les accents', () => {
    expect(slugify('Électricité')).toBe('electricite');
  });

  test('remplace apostrophe typographique et espaces par des tirets', () => {
    expect(slugify('Publicités d’époque')).toBe('publicites-d-epoque');
  });

  test('gère chiffres et « à »', () => {
    expect(slugify('De 34 à 57')).toBe('de-34-a-57');
  });

  test('supprime les tirets en début et fin', () => {
    expect(slugify('  Qui sommes nous ? ')).toBe('qui-sommes-nous');
  });
});
