import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { pickSnapshot } from '../../../scripts/migrate/cdx';
import { isArchivePlaceholder } from '../../../scripts/migrate/fetch';
import { extractArticle, toMarkdown } from '../../../scripts/migrate/extract';
import { sniffType, spipKey, validateMedia, vignetteToOriginal } from '../../../scripts/migrate/assets';

const fx = (name: string) => `tests/fixtures/wayback/${name}`;
const read = (name: string) => readFileSync(fx(name), 'utf8');

describe('pickSnapshot', () => {
  const rows = [
    { timestamp: '20171018005338', status: '200' },
    { timestamp: '20230208071048', status: '200' },
    { timestamp: '20230601000000', status: '503' },
    { timestamp: '20240620055454', status: '200' },
  ];

  test('prend la plus récente capture valide avant la compromission (juillet 2023)', () => {
    expect(pickSnapshot(rows)).toBe('20230208071048');
  });

  test('renvoie null si toutes les captures sont postérieures', () => {
    expect(pickSnapshot([{ timestamp: '20240620055454', status: '200' }])).toBeNull();
  });
});

describe('isArchivePlaceholder', () => {
  test('reconnaît la page « Temporarily Offline »', () => {
    expect(isArchivePlaceholder(read('offline.html'))).toBe(true);
  });

  test('ne confond pas un vrai article', () => {
    expect(isArchivePlaceholder(read('article-53.html'))).toBe(false);
  });
});

describe('extractArticle', () => {
  test('extrait titre, texte et logo de l’article 53', () => {
    const a = extractArticle(read('article-53.html'));
    expect(a.title).toBe('Qui sommes nous ?');
    expect(a.html).toContain('Il était une fois en 1975');
    expect(a.logo).toBe('local/cache-vignettes/L387xH388/arton53-d3405.jpg');
    expect(a.flags).toEqual([]);
  });

  test('retire le contenu injecté et le signale', () => {
    const a = extractArticle(read('spam-injected.html'));
    expect(a.html).not.toMatch(/<script/i);
    expect(a.html).not.toMatch(/casino|viagra|spam-seo/i);
    expect(a.html).not.toMatch(/onerror/i);
    expect(a.html).toContain('Il était une fois en 1975');
    expect(a.flags.length).toBeGreaterThanOrEqual(2);
  });

  test('liste les PDF référencés (article 56, Électricité)', () => {
    const a = extractArticle(read('article-56.html'));
    expect(a.pdfs).toContain('IMG/pdf/remplacement-dynamo.pdf');
    expect(a.pdfs.length).toBeGreaterThanOrEqual(20);
  });
});

describe('toMarkdown', () => {
  test('titres ATX et gras', () => {
    expect(toMarkdown('<h3>T</h3><p>a <strong>b</strong></p>')).toBe('### T\n\na **b**');
  });

  test('réécrit les liens PDF vers /documents/', () => {
    expect(toMarkdown('<p><a href="IMG/pdf/manuel-bord.pdf">Manuel</a></p>')).toBe('[Manuel](/documents/manuel-bord.pdf)');
  });
});

describe('sniffType', () => {
  test('détecte le vrai type d’après le contenu', () => {
    expect(sniffType(readFileSync(fx('fake.pdf')))).toBe('html');
    expect(sniffType(readFileSync(fx('real.pdf')))).toBe('pdf');
    expect(sniffType(readFileSync(fx('real.jpg')))).toBe('jpeg');
  });
});

describe('validateMedia', () => {
  test('refuse un « PDF » qui est du HTML', async () => {
    expect((await validateMedia(fx('fake.pdf'))).ok).toBe(false);
  });

  test('accepte un PDF simple', async () => {
    expect((await validateMedia(fx('real.pdf'))).ok).toBe(true);
  });

  test('accepte un PDF qui s’ouvre simplement à une page', async () => {
    expect((await validateMedia(fx('pdf-dest.pdf'))).ok).toBe(true);
  });

  test('refuse un PDF avec JavaScript', async () => {
    expect((await validateMedia(fx('pdf-js.pdf'))).ok).toBe(false);
  });

  test('refuse un PDF qui lance un programme', async () => {
    expect((await validateMedia(fx('pdf-launch.pdf'))).ok).toBe(false);
  });

  test('refuse une image contenant du PHP', async () => {
    expect((await validateMedia(fx('jpeg-php.jpg'))).ok).toBe(false);
  });
});

describe('vignetteToOriginal', () => {
  test('logo d’article : arton53-d3405.jpg → IMG/arton53.jpg', () => {
    expect(vignetteToOriginal('local/cache-vignettes/L387xH388/arton53-d3405.jpg?1472495778')).toEqual({
      exact: 'arton53.jpg',
    });
  });

  test('autre vignette : renvoie la clé SPIP (12 premiers caractères de nom + extension + « docid »)', () => {
    expect(vignetteToOriginal('local/cache-vignettes/L250xH141/2012-lozerejb471-5a52a.jpg')).toEqual({ key: '2012-lozerej' });
    expect(vignetteToOriginal('local/cache-vignettes/L443xH336/almanachjpgd4ec2-9cd1f.jpg')).toEqual({ key: 'almanachjpgd' });
  });

  test('la clé calculée depuis le fichier d’origine correspond', () => {
    expect(spipKey('2012-lozere.jpg')).toBe('2012-lozerej');
    expect(spipKey('almanach.jpg')).toBe('almanachjpgd');
    expect(spipKey('2006.jpg')).toBe('2006jpgdocid');
  });
});
