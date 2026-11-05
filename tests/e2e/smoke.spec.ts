import { test, expect } from '@playwright/test';

test('la page d’accueil répond en français avec le nom du club', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page).toHaveTitle(/La Traction de Provence/);
});
