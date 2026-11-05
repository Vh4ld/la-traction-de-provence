import { describe, expect, test } from 'vitest';
import { pageRoute } from '../../src/lib/pages';

describe('pageRoute', () => {
  test('une page de rubrique donne /<rubrique>/<page>/', () => {
    expect(pageRoute('src/content/pages/vie-du-club/qui-sommes-nous.md')).toEqual({
      section: 'vie-du-club',
      slug: 'qui-sommes-nous',
      url: '/vie-du-club/qui-sommes-nous/',
    });
  });

  test('index.md est la page de présentation de la rubrique', () => {
    expect(pageRoute('src/content/pages/mains-sales/index.md')).toEqual({
      section: 'mains-sales',
      slug: undefined,
      url: '/mains-sales/',
    });
  });

  test('refuse un fichier hors d’une rubrique', () => {
    expect(() => pageRoute('src/content/pages/orpheline.md')).toThrow();
  });
});
