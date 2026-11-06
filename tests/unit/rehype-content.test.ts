import { describe, expect, test } from 'vitest';
import type { Element, ElementContent, Root } from 'hast';
import { formatSize, rehypeContent, GALLERY_SIZES, GALLERY_WIDTHS, PROSE_SIZES, PROSE_WIDTHS } from '../../src/lib/rehype-content';

describe('formatSize', () => {
  test('en Ko sous 1 Mo, arrondi', () => {
    expect(formatSize(180_859)).toBe('177 Ko');
  });
  test('en Mo avec une décimale et une virgule', () => {
    expect(formatSize(1_169_639)).toBe('1,1 Mo');
    expect(formatSize(21_000_000)).toBe('20 Mo');
  });
});

describe('images responsives', () => {
  const img = (src: string): Element => ({ type: 'element', tagName: 'img', properties: { src, alt: '' }, children: [] });
  const paragraph = (...children: ElementContent[]): Element => ({ type: 'element', tagName: 'p', properties: {}, children });
  const run = (...children: Element[]) => {
    const tree: Root = { type: 'root', children };
    rehypeContent()(tree);
    return tree;
  };

  test('une image de galerie a des tailles réduites adaptées à la vignette', () => {
    const [a, b] = [img('a.jpg'), img('b.jpg')];
    run(paragraph(a, { type: 'text', value: '\n' }, b));
    for (const el of [a, b]) {
      expect(el.properties.sizes).toBe(GALLERY_SIZES);
      expect(el.properties.widths).toEqual(GALLERY_WIDTHS);
    }
  });

  test('une image seule dans le texte suit la largeur de lecture', () => {
    const a = img('a.jpg');
    run(paragraph(a));
    expect(a.properties.sizes).toBe(PROSE_SIZES);
    expect(a.properties.widths).toEqual(PROSE_WIDTHS);
  });

  test('l’original reste toujours disponible (visionneuse sans perte)', () => {
    // Astro retire les largeurs supérieures à l'original et ajoute alors l'original lui-même.
    for (const widths of [GALLERY_WIDTHS, PROSE_WIDTHS]) {
      expect(Math.max(...widths)).toBeGreaterThanOrEqual(10_000);
    }
  });
});
