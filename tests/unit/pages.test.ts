import { describe, expect, test } from 'vitest';
import { pageRoute, sectionChildren } from '../../src/lib/pages';

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

describe('sectionChildren', () => {
  const e = (path: string, title: string, order: number) => ({ filePath: `src/content/pages/${path}`, data: { title, order } });
  const entries = [
    e('de-34-a-57/index.md', 'De 34 à 57', 0),
    e('de-34-a-57/jouets.md', 'Jouets', 5),
    e('de-34-a-57/antivols.md', 'Les antivols', 13),
    e('de-34-a-57/accessoires.md', 'Accessoires', 4),
    e('mains-sales/outils.md', 'Outils', 1),
  ];

  test('pages de la rubrique triées par ordre, sans la page de présentation', () => {
    expect(sectionChildren(entries, 'de-34-a-57')).toEqual([
      { title: 'Accessoires', url: '/de-34-a-57/accessoires/' },
      { title: 'Jouets', url: '/de-34-a-57/jouets/' },
      { title: 'Les antivols', url: '/de-34-a-57/antivols/' },
    ]);
  });
});
