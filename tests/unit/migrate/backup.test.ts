import { describe, expect, test } from 'vitest';
import { buildIndex, findLocal } from '../../../scripts/migrate/backup';

const root = '/sauvegarde/IMG';
const index = buildIndex(root, [
  '/sauvegarde/IMG/pdf/ac4606.pdf',
  '/sauvegarde/IMG/arton53.jpg',
  '/sauvegarde/IMG/jpg/2012-lozere.jpg',
  '/sauvegarde/IMG/jpg/doublon.jpg',
  '/sauvegarde/IMG/png/doublon.jpg',
]);

describe('findLocal', () => {
  test('ignore la casse : IMG/pdf/AC4606.pdf → ac4606.pdf', () => {
    expect(findLocal(index, 'IMG/pdf/AC4606.pdf')).toBe('/sauvegarde/IMG/pdf/ac4606.pdf');
  });

  test('retrouve l’original d’un logo d’article', () => {
    expect(findLocal(index, 'local/cache-vignettes/L387xH388/arton53-d3405.jpg')).toBe('/sauvegarde/IMG/arton53.jpg');
  });

  test('retrouve l’original d’une vignette par sa clé SPIP', () => {
    expect(findLocal(index, 'local/cache-vignettes/L250xH141/2012-lozerejb471-5a52a.jpg')).toBe('/sauvegarde/IMG/jpg/2012-lozere.jpg');
  });

  test('cherche par nom si le dossier diffère', () => {
    expect(findLocal(index, 'IMG/2012-lozere.jpg')).toBe('/sauvegarde/IMG/jpg/2012-lozere.jpg');
  });

  test('refuse une correspondance ambiguë', () => {
    expect(findLocal(index, 'IMG/autre/doublon.jpg')).toBeNull();
  });

  test('null si absent', () => {
    expect(findLocal(index, 'IMG/pdf/inconnu.pdf')).toBeNull();
  });
});

describe('findLocal : copies « distant » de SPIP', () => {
  const idx = buildIndex(root, [
    '/sauvegarde/IMG/jpg/graissage-traction.jpg',
    '/sauvegarde/IMG/distant/jpg/graissage-tra7bf.jpg',
    '/sauvegarde/IMG/jpg/porte-bagages.jpg',
    '/sauvegarde/IMG/jpg/porte-bagages-2.jpg',
    '/sauvegarde/IMG/distant/jpg/porte-bagage89c0.jpg',
    '/sauvegarde/IMG/distant/jpg/porte-bagagea371.jpg',
  ]);

  test('préfère l’original quand il est le seul hors de distant/', () => {
    expect(findLocal(idx, 'local/cache-vignettes/L500xH361/graissage-tra7bf-e5e89.jpg')).toBe('/sauvegarde/IMG/jpg/graissage-traction.jpg');
  });

  test('sinon prend la copie distant/ portant exactement le nom de la vignette', () => {
    expect(findLocal(idx, 'local/cache-vignettes/L1115xH199/porte-bagagea371-1fdc1.jpg')).toBe('/sauvegarde/IMG/distant/jpg/porte-bagagea371.jpg');
  });
});

