import { test, expect } from '@playwright/test';
import { nav } from '../../src/data/nav';

const allLinks = nav.flatMap((item) => [item, ...(item.children ?? [])]);

test('chaque entrée du menu mène à une page existante', async ({ request }) => {
  for (const { href } of allLinks) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
  }
});

test.describe('page d’article', () => {
  test('fil d’Ariane vers la rubrique et titre de la page', async ({ page }) => {
    await page.goto('/mains-sales/electricite/');
    const crumbs = page.getByRole('navigation', { name: 'Fil d’Ariane' });
    await expect(crumbs.getByRole('link', { name: 'Les mains sales' })).toHaveAttribute('href', '/mains-sales/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Électricité');
  });

  test('les liens PDF indiquent le format et la taille, et les fichiers existent', async ({ page, request }) => {
    await page.goto('/mains-sales/electricite/');
    const links = page.locator('main a.doc-link');
    expect(await links.count()).toBeGreaterThanOrEqual(20);
    await expect(links.first()).toContainText(/PDF, [\d,]+ (Ko|Mo)/);
    for (const href of await links.evaluateAll((as) => as.slice(0, 5).map((a) => a.getAttribute('href')!))) {
      const res = await request.get(href);
      expect(res.status(), href).toBe(200);
      expect(res.headers()['content-type']).toContain('application/pdf');
    }
  });
});

test.describe('galerie et visionneuse', () => {
  test('une suite de photos forme une galerie', async ({ page }) => {
    await page.goto('/vie-du-club/notracanou/');
    expect(await page.locator('main .gallery img').count()).toBeGreaterThanOrEqual(40);
  });

  test('clic : agrandit, flèches pour naviguer, Échap referme et rend le focus', async ({ page }) => {
    await page.goto('/vie-du-club/notracanou/');
    const thumbs = page.locator('main .gallery .zoom');
    const firstAlt = await thumbs.nth(0).locator('img').getAttribute('alt');
    const secondAlt = await thumbs.nth(1).locator('img').getAttribute('alt');

    await thumbs.nth(0).click();
    const dialog = page.locator('dialog.lightbox[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img')).toHaveAttribute('alt', firstAlt!);
    await expect(dialog.locator('figcaption')).toHaveText(firstAlt!);

    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('img')).toHaveAttribute('alt', secondAlt!);
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.locator('img')).toHaveAttribute('alt', firstAlt!);

    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.lightbox[open]')).toHaveCount(0);
    await expect(thumbs.nth(0)).toBeFocused();
  });

  test('les vignettes sont des boutons nommés, utilisables au clavier', async ({ page }) => {
    await page.goto('/vie-du-club/notracanou/');
    const first = page.locator('main .gallery .zoom').first();
    await expect(first).toHaveAttribute('aria-label', /^Agrandir : Traction/);
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog.lightbox[open]')).toBeVisible();
  });

  test('une image qui mène à un PDF reste un lien, sans visionneuse', async ({ page }) => {
    await page.goto('/mains-sales/outils/');
    const link = page.locator('main a[href$=".pdf"]:has(img)').first();
    await expect(link).toBeVisible();
    await expect(link.locator('.zoom')).toHaveCount(0);
  });
});

test.describe('photo du mois', () => {
  test('la dernière photo est mise en avant, les autres classées par année', async ({ page }) => {
    await page.goto('/photo-du-mois/');
    await expect(page.getByRole('heading', { level: 2, name: 'Janvier 2025' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '2024' })).toBeVisible();
    expect(await page.locator('main .gallery img').count()).toBe(102);
  });
});

test.describe('adresses électroniques', () => {
  for (const url of ['/vie-du-club/nous-contacter/', '/infos/mentions-legales/']) {
    test(`masquées dans le code source mais cliquables : ${url}`, async ({ page, request }) => {
      const html = await (await request.get(url)).text();
      expect(html).not.toMatch(/[a-z0-9.]+@[a-z0-9-]+\.(com|fr)/i);
      await page.goto(url);
      const link = page.locator('main a[href^="mailto:"]').first();
      await expect(link).toHaveText('latractiondeprovence@gmail.com');
    });
  }
});
