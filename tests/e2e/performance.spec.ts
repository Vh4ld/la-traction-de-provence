import { test, expect } from '@playwright/test';

test('la police du titre est préchargée, et c’est bien le fichier utilisé par la feuille de style', async ({ page, request }) => {
  await page.goto('/');
  const preload = page.locator('head link[rel="preload"][as="font"]');
  await expect(preload).toHaveCount(1);
  await expect(preload).toHaveAttribute('type', 'font/woff2');
  // Sans crossorigin, le navigateur ignore le préchargement et télécharge la police deux fois.
  await expect(preload).toHaveAttribute('crossorigin', '');
  const href = (await preload.getAttribute('href'))!;
  const css = await page.evaluate(async () => {
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')];
    return (await Promise.all(links.map((l) => fetch(l.href).then((r) => r.text())))).join('\n');
  });
  expect(css).toContain(href);
  expect((await request.get(href)).status()).toBe(200);
});

test.describe('images responsives', () => {
  test('les vignettes de galerie chargent une version réduite sur ordinateur', async ({ page }) => {
    await page.goto('/vie-du-club/notracanou/');
    const img = page.locator('main .gallery img').first();
    await expect(img).toHaveAttribute('sizes', /12\.5rem/);
    const { current, largest } = await img.evaluate(async (el: HTMLImageElement) => {
      await el.decode();
      const candidates = el.srcset.split(',').map((c) => c.trim().split(/\s+/));
      const best = candidates.sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0][0];
      return { current: new URL(el.currentSrc).pathname, largest: new URL(best, location.href).pathname };
    });
    expect(current).not.toBe(largest);
  });

  test('la visionneuse affiche l’original, pas la vignette réduite', async ({ page }) => {
    await page.goto('/vie-du-club/notracanou/');
    const thumb = page.locator('main .gallery img').first();
    const largest = await thumb.evaluate((el: HTMLImageElement) =>
      el.srcset.split(',').map((c) => c.trim().split(/\s+/)).sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0][0],
    );
    await page.locator('main .gallery .zoom').first().click();
    await expect(page.locator('dialog.lightbox[open] img')).toHaveAttribute('src', largest);
  });
});
