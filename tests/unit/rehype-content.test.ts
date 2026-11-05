import { describe, expect, test } from 'vitest';
import { formatSize } from '../../src/lib/rehype-content';

describe('formatSize', () => {
  test('en Ko sous 1 Mo, arrondi', () => {
    expect(formatSize(180_859)).toBe('177 Ko');
  });
  test('en Mo avec une décimale et une virgule', () => {
    expect(formatSize(1_169_639)).toBe('1,1 Mo');
    expect(formatSize(21_000_000)).toBe('20 Mo');
  });
});
