import { test, expect } from '@playwright/test';

const NOTICE = 'Contenu © La Traction de Provence et ses auteurs, tous droits réservés.';

test.describe('menu (bureau)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('clavier : Entrée ouvre « Les mains sales », Échap referme et rend le focus', async ({ page }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Les mains sales' });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('link', { name: 'Électricité' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
    await expect(page.getByRole('link', { name: 'Électricité' })).toBeHidden();
  });

  test('ouvrir un sous-menu referme les autres', async ({ page }) => {
    await page.goto('/');
    const vie = page.getByRole('button', { name: 'Vie du Club' });
    const mains = page.getByRole('button', { name: 'Les mains sales' });
    await vie.click();
    await mains.click();
    await expect(vie).toHaveAttribute('aria-expanded', 'false');
    await expect(mains).toHaveAttribute('aria-expanded', 'true');
  });

  test('le lien d’évitement est le premier élément focalisable et vise #contenu', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.locator(':focus');
    await expect(skip).toHaveText('Aller au contenu');
    await expect(skip).toHaveAttribute('href', '#contenu');
    await expect(page.locator('main#contenu')).toHaveCount(1);
  });

  test('le pied de page affiche la mention de droits sur le contenu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer')).toContainText(NOTICE);
  });
});

test.describe('menu (écran tactile)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

  test('un appui sur « Vie du Club » ouvre son sous-menu', async ({ page }) => {
    await page.goto('/');
    const vie = page.getByRole('button', { name: 'Vie du Club' });
    await vie.tap();
    await expect(vie).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: 'Nous rejoindre' })).toBeVisible();
  });
});

test.describe('menu (mobile sans JavaScript)', () => {
  test.use({ viewport: { width: 375, height: 740 }, javaScriptEnabled: false, hasTouch: true });

  test('le menu mobile s’ouvre et mène à « Nous rejoindre »', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Menu', { exact: true }).click();
    const link = page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: 'Nous rejoindre' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/vie-du-club\/nous-rejoindre\/$/);
  });
});
