import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'));
const release = parse(readFileSync('.github/workflows/release.yml', 'utf8'));

describe('workflows GitHub Actions', () => {
  // ci.yml est aussi appelé par release.yml : sa concurrence s'applique alors avec la branche de l'appelant.
  // Sans le nom du workflow dans le groupe, la CI d'un envoi sur main annulerait les vérifications de la publication.
  test('le groupe de concurrence de la CI distingue la CI directe de la CI appelée par la publication', () => {
    expect(ci.concurrency.group).toContain('${{ github.workflow }}');
  });

  test('la publication manuelle ne part en production que depuis main', () => {
    expect(release.jobs.publish.if).toBe("github.ref == 'refs/heads/main'");
  });
});
