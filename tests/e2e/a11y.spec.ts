import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, existsSync } from 'node:fs';

/** Toutes les pages du sitemap généré, ou la page d'accueil seule si le sitemap n'existe pas encore. */
function pageUrls(): string[] {
  const sitemap = 'dist/sitemap-0.xml';
  if (!existsSync(sitemap)) return ['/'];
  const xml = readFileSync(sitemap, 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

for (const url of pageUrls()) {
  test(`accessibilité WCAG 2.2 AA : ${url}`, async ({ page }) => {
    await page.goto(url);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
