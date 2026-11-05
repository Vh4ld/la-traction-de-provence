import { test, expect } from '@playwright/test';

test.describe('bandeau photo', () => {
  test('six photos, chacune avec un texte alternatif', async ({ page }) => {
    await page.goto('/');
    const carousel = page.locator('[aria-roledescription="carrousel"]');
    const slides = carousel.locator('[aria-roledescription="diapositive"]');
    await expect(slides).toHaveCount(6);
    for (const img of await carousel.locator('img').all()) {
      expect((await img.getAttribute('alt'))?.trim().length).toBeGreaterThan(10);
    }
  });

  test('les boutons Suivant / Précédent changent la photo affichée', async ({ page }) => {
    await page.goto('/');
    const status = page.locator('[data-banner-status]');
    await expect(status).toHaveText('Photo 1 sur 6');
    await page.getByRole('button', { name: 'Photo suivante' }).click();
    await expect(status).toHaveText('Photo 2 sur 6');
    await page.getByRole('button', { name: 'Photo précédente' }).click();
    await expect(status).toHaveText('Photo 1 sur 6');
  });

  test.describe('mouvement réduit', () => {
    test.use({ reducedMotion: 'reduce' });

    test('pas de défilement automatique', async ({ page }) => {
      await page.clock.install();
      await page.goto('/');
      await page.clock.runFor(20_000);
      await expect(page.locator('[data-banner-status]')).toHaveText('Photo 1 sur 6');
    });
  });

  test('défilement automatique sinon, mis en pause au survol', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.clock.runFor(6_500);
    await expect(page.locator('[data-banner-status]')).toHaveText('Photo 2 sur 6');
    await page.locator('[aria-roledescription="carrousel"]').hover();
    await page.clock.runFor(20_000);
    await expect(page.locator('[data-banner-status]')).toHaveText('Photo 2 sur 6');
  });
});

test.describe('prochains événements', () => {
  test('la rubrique existe et masque les événements passés côté navigateur', async ({ page }) => {
    // Dans un an, tout événement publié aujourd'hui est terminé.
    await page.clock.setFixedTime(new Date(Date.now() + 366 * 24 * 3600 * 1000));
    await page.goto('/');
    const section = page.getByRole('region', { name: 'Prochains événements' });
    await expect(section).toBeVisible();
    await expect(section.locator('[data-event-end]:visible')).toHaveCount(0);
    await expect(section.getByText('Aucun événement prévu pour le moment.')).toBeVisible();
  });
});
