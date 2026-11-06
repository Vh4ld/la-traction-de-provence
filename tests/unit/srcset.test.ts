import { describe, expect, test } from 'vitest';
import { largestCandidate } from '../../src/lib/srcset';

describe('largestCandidate', () => {
  test('renvoie l’adresse de la plus grande largeur, quel que soit l’ordre', () => {
    expect(largestCandidate('/_astro/a_1.webp 640w, /_astro/a_2.webp 1628w, /_astro/a_3.webp 320w')).toBe('/_astro/a_2.webp');
  });
  test('vide ou sans descripteur de largeur : rien', () => {
    expect(largestCandidate('')).toBeUndefined();
    expect(largestCandidate(undefined)).toBeUndefined();
    expect(largestCandidate('/a.webp 1x, /b.webp 2x')).toBeUndefined();
  });
});
