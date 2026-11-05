import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { nav } from '../../src/data/nav';

const sitemapUrls = () =>
  [...readFileSync('dist/sitemap-0.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

test('le plan du site contient toutes les entrées du menu, et pas la page 404', () => {
  const urls = sitemapUrls();
  for (const item of nav.flatMap((i) => [i, ...(i.children ?? [])])) expect(urls, item.href).toContain(item.href);
  expect(urls.some((u) => u.includes('404'))).toBe(false);
});

test('robots.txt indique le plan du site', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('Sitemap: https://la-traction-de-provence.fr/sitemap-index.xml');
});

test('chaque page a un titre unique et une description de 50 à 160 caractères', async ({ page }) => {
  const titles = new Map<string, string>();
  for (const url of sitemapUrls()) {
    await page.goto(url);
    const title = await page.title();
    expect(titles.get(title), `titre en double : ${url} et ${titles.get(title)}`).toBeUndefined();
    titles.set(title, url);
    const description = (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    expect(description.length, `${url} : « ${description} »`).toBeGreaterThanOrEqual(50);
    expect(description.length, `${url} : « ${description} »`).toBeLessThanOrEqual(160);
  }
});

test('accueil : données structurées de l’association et image de partage', async ({ page, request }) => {
  await page.goto('/');
  const json = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}');
  expect(json['@type']).toBe('NGO');
  expect(json.name).toBe('La Traction de Provence');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  const res = await request.get(new URL(og!).pathname);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/');
});

test('icône du site propre au club', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="icon"]').first().getAttribute('href');
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  // Icône tirée du logo du club (PNG), pas l'icône par défaut d'Astro (SVG).
  expect(res.headers()['content-type']).toContain('image/png');
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('/apple-touch-icon.png');
});

test('mentions légales : éditeur, directeur de la publication, hébergeur', async ({ page }) => {
  await page.goto('/infos/mentions-legales/');
  const main = page.locator('main');
  await expect(main).toContainText('directeur de la publication', { ignoreCase: true });
  await expect(main).toContainText('OVH');
  await expect(main).toContainText('Roubaix');
  await expect(main).toContainText('Les Pennes-Mirabeau');
  await expect(main).toContainText('cookie', { ignoreCase: true });
});

test('page 404 : en français, non indexée, avec retour à l’accueil', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('introuvable');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('main').getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/');
});
