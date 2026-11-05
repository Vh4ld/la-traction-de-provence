import { describe, expect, test } from 'vitest';
import { resolveShortLinks, rewriteArticleLinks } from '../../../scripts/migrate/links';

const urls = new Map([
  [91, '/de-34-a-57/boites-4-vitesses/'],
  [53, '/vie-du-club/qui-sommes-nous/'],
]);

describe('rewriteArticleLinks', () => {
  test('remplace les liens SPIP par les nouvelles adresses', () => {
    const r = rewriteArticleLinks('Voir [les boîtes](http://s631887927.onlinehome.fr/spip.php?page=article&id_article=91).', urls);
    expect(r.markdown).toBe('Voir [les boîtes](/de-34-a-57/boites-4-vitesses/).');
    expect(r.unresolved).toEqual([]);
  });

  test('gère la forme courte spip.php?article53', () => {
    expect(rewriteArticleLinks('[Qui](spip.php?article53)', urls).markdown).toBe('[Qui](/vie-du-club/qui-sommes-nous/)');
  });

  test('un article non récupéré devient du texte simple et est signalé', () => {
    const r = rewriteArticleLinks('- [Démonter une batterie](http://s631887927.onlinehome.fr/spip.php?page=article&id_article=103)', urls);
    expect(r.markdown).toBe('- Démonter une batterie');
    expect(r.unresolved).toEqual([103]);
  });

  test('ne touche pas aux autres liens', () => {
    const md = '[PDF](/documents/a.pdf) et [Citroën](https://www.citroen.fr/)';
    expect(rewriteArticleLinks(md, urls).markdown).toBe(md);
  });
});

describe('resolveShortLinks', () => {
  const resolve = async (u: string) =>
    ({ 'https://goo.gl/photos/abc': 'https://photos.google.com/share/AF1', 'https://goo.gl/xyz': 'https://casino.example/' })[u] ?? null;

  test('remplace un lien goo.gl par l’album Google Photos final', async () => {
    expect(await resolveShortLinks('[Album](https://goo.gl/photos/abc)', resolve)).toBe('[Album](https://photos.google.com/share/AF1)');
  });

  test('un lien court vers un domaine non autorisé devient du texte', async () => {
    expect(await resolveShortLinks('[Album](https://goo.gl/xyz)', resolve)).toBe('Album');
  });

  test('un lien court mort devient du texte', async () => {
    expect(await resolveShortLinks('[Album](https://goo.gl/mort)', resolve)).toBe('Album');
  });
});
