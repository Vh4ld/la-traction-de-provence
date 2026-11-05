# Refonte du site La Traction de Provence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild la-traction-de-provence.fr as a secure Astro static site with the original club identity, content recovered from clean Wayback snapshots, deployed via GHCR + Watchtower behind Nginx Proxy Manager.

**Architecture:** Astro builds Markdown content collections into static HTML. A multi-stage Dockerfile serves `dist/` with nginx-unprivileged, plus a generated SPIP→new-URL redirect map. GitHub Actions checks every branch and publishes the image from `main`. A one-off Node migration script turns archived SPIP pages into reviewed Markdown.

**Tech Stack:** Astro (latest stable), TypeScript, zod (via `astro:content`), Vitest, Playwright + `@axe-core/playwright`, linkinator, cheerio + turndown (migration only), `@fontsource/*` fonts, Docker `nginxinc/nginx-unprivileged:alpine`, GitHub Actions, GHCR.

**Spec:** `docs/superpowers/specs/2026-11-05-refonte-site-design.md`

## Global Constraints

- All work is committed to the `test` branch and pushed. Never commit to or push `main`. The owner merges.
- Commit messages in French, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Node ≥ 22 (`"engines": {"node": ">=22"}`), npm lockfile committed, CI uses `npm ci`.
- Site language `fr`. All visible copy in French.
- Palette: background `#1F1F1F`, header band `#5C5A5A`, navy `#07286D`, gold `#FAC608`, gold-2 `#F4C418`, tint `#D3DBEE`.
- No forum, no comments, no contact form, no analytics, no third-party requests at runtime (fonts self-hosted), no cookies.
- No inline executable `<script>`: Astro configured with `vite.build.assetsInlineLimit: 0` and `build.inlineStylesheets: 'never'`, so the CSP `script-src 'self'` holds. JSON-LD (`type="application/ld+json"`) is allowed.
- Wayback content: only snapshots with timestamp `< 20250201000000`. Downloaded files are untrusted: read and copy only, never execute; run Node scripts that parse them from the repo, never from the download folder.
- Container: listens on `8080`, runs non-root, `read_only`, network `proxy-net` (external), container name `traction_site`, no host port.
- Image: `ghcr.io/vh4ld/la-traction-de-provence`, tags `latest` and `sha-<short sha>`.
- WCAG 2.2 AA; axe zero violations on every built page; Lighthouse ≥ 95 in all four categories on `/` and one article page.
- Footer on every page: "Contenu © La Traction de Provence et ses auteurs, tous droits réservés." + link to Mentions légales.

## Review Focus

1. **Stale events:** the site is built once, so an event that has passed stays on the homepage until the next build. Expected: past events are hidden for the visitor anyway. Pinned by a client-side hide of `[data-event-end]` older than today (Task 4) and its e2e test.
2. **In-progress multi-day events:** an event running "du 21 au 23 juin", viewed on the 22nd, must still show. Expected: filter on `end ?? start` ≥ today, in `Europe/Paris`. Unit-tested in Task 4.
3. **Wayback placeholder pages:** the archive returns "Temporarily Offline" / "Time-out" HTML, sometimes with status 200, and the hacked site served spam HTML at `.pdf`/`.jpg` paths. Expected: these are never saved as content or assets. Pinned by MIME-sniffing tests and placeholder detection in Task 5.
4. **Legacy URLs with extra parameters:** `spip.php?article53&lang=fr`, `spip.php?page=article&id_article=53&var_mode=calcul`, `spip.php?id_article=53`. Expected: same 301 as the clean URL. Pinned in Task 9's redirect tests.
5. **Touch and no-JS navigation:** hover-only dropdowns are unusable on phones and keyboards. Expected: every submenu opens by tap, Enter/Space and Escape closes it, and the mobile menu works with JS disabled. Pinned in Task 3's e2e tests.

---

## File structure

```
astro.config.mjs                 site URL, sitemap, inline limits
src/content.config.ts            collections: pages, evenements, sorties, documents
src/data/nav.ts                  menu tree (single source for Nav + sitemap order)
src/lib/events.ts                upcomingEvents()
src/lib/slug.ts                  slugify()
src/styles/tokens.css            palette, type scale, spacing
src/styles/global.css            base, typography, utilities
src/layouts/BaseLayout.astro     <head>, skip link, Header, Nav, Footer, SEO
src/layouts/ArticleLayout.astro  title, cover, prose
src/components/{Header,Nav,Footer,Banner,EventList,Gallery,DocList,Seo}.astro
src/scripts/{nav,banner,lightbox,events}.ts
src/pages/index.astro, [section]/index.astro, [section]/[slug].astro,
  almanach/…, 404.astro, mentions-legales.astro (from content), robots.txt.ts
scripts/migrate/{cdx,fetch,extract,assets,report,run}.ts   migration
scripts/gen-redirects.ts         content legacyIds → deploy/redirects.map
deploy/nginx.conf, deploy/docker-compose.yml
Dockerfile, .dockerignore
.github/workflows/{ci,release}.yml
tests/unit/*.test.ts (Vitest), tests/e2e/*.spec.ts (Playwright), tests/fixtures/
```

---

### Task 1: Project scaffold, tooling and CI

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `src/pages/index.astro` (placeholder), `tests/e2e/smoke.spec.ts`, `tests/e2e/a11y.spec.ts`, `.github/workflows/ci.yml`, `.nvmrc` (`22`)

**Interfaces:**
- Produces npm scripts: `dev`, `build` (`astro check && astro build`), `preview`, `test:unit` (`vitest run`), `test:e2e` (`playwright test`, webServer = `astro preview --port 4321`), `test:links` (`linkinator dist --recurse --skip "^https?://"`: linkinator serves `dist/` itself and checks internal links only), `test` (unit + build + links + e2e).
- `tests/e2e/a11y.spec.ts` reads `dist/sitemap-0.xml` (from Task 8; until then a fixed list `['/']`) and runs axe on each URL. Later tasks only add pages; they don't edit this test.

- [ ] **Step 1:** Scaffold with `npm create astro@latest . -- --template minimal --typescript strict --no-git --install`. Add `@astrojs/sitemap`, `vitest`, `@playwright/test`, `@axe-core/playwright`, `linkinator` as dev deps. Run `npx playwright install --with-deps chromium`.
- [ ] **Step 2:** In `astro.config.mjs`: `site: 'https://la-traction-de-provence.fr'`, `trailingSlash: 'always'`, `build.format: 'directory'`, `build.inlineStylesheets: 'never'`, `vite.build.assetsInlineLimit: 0`, sitemap integration.
- [ ] **Step 3:** Write `smoke.spec.ts`: `/` returns 200, `html[lang="fr"]`, `<title>` contains "La Traction de Provence". Write `a11y.spec.ts`: axe `withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa'])` → `violations` equals `[]`.
- [ ] **Step 4:** Run `npm run test:e2e`. Expected: smoke FAIL (placeholder has no `lang`/title).
- [ ] **Step 5:** Make the placeholder page pass (lang, title, one `<main><h1>`).
- [ ] **Step 6:** Run `npm test`. Expected: all PASS.
- [ ] **Step 7:** `ci.yml`: on push (all branches) and PR; ubuntu, Node 22, `npm ci`, playwright chromium, `npm test`; upload Playwright report on failure.
- [ ] **Step 8:** Commit `"Met en place Astro, les tests et l'intégration continue"`, push, confirm the CI run on `test` is green with `gh run list --branch test --limit 1` (or check on GitHub if `gh` is unavailable).

### Task 2: Content collections

**Files:**
- Create: `src/content.config.ts`, `src/lib/slug.ts`, `tests/unit/slug.test.ts`, `tests/unit/content-schema.test.ts`, one sample entry per collection under `src/content/`

**Interfaces:**
- Produces (exported from `src/content.config.ts`, schemas also exported for tests):
  - `sections = ['vie-du-club','almanach','routracs','photo-du-mois','mains-sales','de-34-a-57','infos'] as const`
  - `pages`: `{ title: string; section: Section; order: number; description: string; legacyIds: number[] (default []); legacyRubriques: number[] (default []); cover?: image() }`, loader `glob('**/*.md', base 'src/content/pages')`, entry id = slug.
  - `evenements`: `{ title: string; start: Date; end?: Date; place?: string; link?: string (url) }` with refinement `end >= start`.
  - `sorties`: `{ title: string; year: number (2000–2100); date?: Date; place?: string; cover: image(); gallery: { src: image(); alt: string }[] (default []) }`.
  - `documents` (YAML file loader, `src/content/documents/*.yaml`): `{ category: string; items: { title: string; file: string (starts with '/documents/', ends with '.pdf'); thumb?: string; sizeKb?: number }[] }`.
  - `slugify(input: string): string`: lowercase, strips accents (NFD), non-alphanumerics → `-`, trims `-`.

- [ ] **Step 1:** Tests: `slugify('Électricité')==='electricite'`, `slugify("Publicités d’époque")==='publicites-d-epoque'`, `slugify('De 34 à 57')==='de-34-a-57'`. Schema tests: `evenementSchema.safeParse({title:'x', start:'2026-06-23', end:'2026-06-21'}).success === false`; a documents item with `file: 'IMG/pdf/a.pdf'` fails; a page with section `'forum'` fails.
- [ ] **Step 2:** Run `npm run test:unit`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement the schemas and `slugify`, plus sample entries.
- [ ] **Step 4:** Run `npm run test:unit && npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit `"Ajoute les collections de contenu et leurs schémas"`.

### Task 3: Layout, identity and navigation

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/data/nav.ts`, `src/layouts/BaseLayout.astro`, `src/components/{Header,Nav,Footer,Seo}.astro`, `src/scripts/nav.ts`, `src/assets/brand/logo.(svg|png)`, `tests/e2e/nav.spec.ts`
- Modify: `src/pages/index.astro` (use BaseLayout)

**Interfaces:**
- Consumes: `sections` (Task 2).
- Produces:
  - `type NavItem = { label: string; href: string; children?: NavItem[] }`; `export const nav: NavItem[]` mirroring the spec §4 menu table (labels exactly as in the old menu, hrefs `/<section>/` and `/<section>/<slug>/`).
  - `<BaseLayout title description image? noindex?>` with a `<slot/>` in `<main id="contenu">`.
  - `<Seo>` emits title (`"<page> · La Traction de Provence"`, homepage just `"La Traction de Provence"`), description, canonical, Open Graph, and JSON-LD `NGO`.

- [ ] **Step 1:** Extract the logo from the archived `header-blue.png` (fetch into the scratchpad, crop the left ~240 px, export a transparent PNG at 2× via `sharp`). Commit only the cropped logo. Pick the title font by rendering "LA TRACTION DE PROVENCE" in `@fontsource/limelight` and `@fontsource/poiret-one` next to the original banner and keeping the closer match. Body font: system UI stack.
- [ ] **Step 2:** `nav.spec.ts` tests (desktop 1280 and mobile 375 viewports):
  - Tab to "Les mains sales" button → Enter → `aria-expanded="true"` and the "Électricité" link is visible → Escape → `aria-expanded="false"` and focus returns to the button.
  - Tap (`page.tap`) on "Vie du Club" opens its submenu.
  - Mobile with `javaScriptEnabled: false`: open the `<details>` menu and reach "Nous rejoindre".
  - The skip link is the first focusable element and targets `#contenu`.
  - The footer contains the exact content notice from Global Constraints.
- [ ] **Step 3:** Run `npx playwright test nav`. Expected: FAIL.
- [ ] **Step 4:** Build Header (logo + h1-styled title in gold, slate band; `<a href="/">`), Nav (disclosure buttons, progressive enhancement: without JS the mobile menu is a `<details>`, and desktop submenus open with `:focus-within` and hover), Footer (notice, Mentions légales, Contact, membership PDF link). The contact email is written as HTML entities in both the `mailto:` href and the text, never as plain text in the source. Also and tokens with `prefers-color-scheme: light` overrides (navy on cream).
- [ ] **Step 5:** Run `npm test`. Expected: PASS, including axe (contrast of gold on navy and gold on `#5C5A5A` must pass AA; darken the band locally if axe flags it).
- [ ] **Step 6:** Commit `"Ajoute la mise en page, l'identité visuelle et le menu"`.

### Task 4: Homepage: banner and events

**Files:**
- Create: `src/lib/events.ts`, `tests/unit/events.test.ts`, `src/components/{Banner,EventList}.astro`, `src/scripts/{banner,events}.ts`, `src/assets/banner/1-6.jpg`, `tests/e2e/home.spec.ts`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `evenements` collection (Task 2), BaseLayout (Task 3).
- Produces: `upcomingEvents(events: {start: Date; end?: Date}[], now: Date, days = 30): same[]`, sorted by start, keeping those with `(end ?? start) >= startOfDay(now, 'Europe/Paris')` and `start <= now + days`.

- [ ] **Step 1:** Unit tests, with `now = 2026-06-22T10:00+02:00`: event 21–23 June kept; event 20 June (no end) dropped; event 21 July kept, 23 July dropped (30 days); event at `2026-06-22T00:00` kept; results sorted by start.
- [ ] **Step 2:** Run `npm run test:unit`. Expected: FAIL.
- [ ] **Step 3:** Implement `upcomingEvents` (use `Intl.DateTimeFormat` with `timeZone: 'Europe/Paris'` for day boundaries; no date library).
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** e2e `home.spec.ts`: the banner has 6 slides, each `img` with non-empty `alt`; with `reducedMotion: 'reduce'` the active slide is unchanged after 8 s; an `EventList` item whose `data-event-end` is yesterday (use `page.clock.setFixedTime` after build) is hidden; the empty state "Aucun événement prévu pour le moment." shows when nothing is upcoming.
- [ ] **Step 6:** Download the 6 banner photos (`squelettes/toto/1-6.jpg`, latest snapshot < cutoff) into `src/assets/banner/` after the MIME check from Task 5 (or `file` if Task 5 isn't done yet). Build Banner (scroll-snap, `<Image>` with `widths=[640,1024,1440]`, `formats avif/webp`, auto-advance every 6 s, paused on hover/focus/reduced-motion, prev/next buttons, `aria-roledescription="carousel"`) and EventList (`<time datetime>`, `data-event-end`; `events.ts` hides passed items at load).
- [ ] **Step 7:** Run `npm test`. Expected: PASS.
- [ ] **Step 8:** Commit `"Ajoute la page d'accueil : bandeau photo et prochains événements"`.

### Task 5: Migration script

**Files:**
- Create: `scripts/migrate/{cdx,fetch,extract,assets,report,run}.ts`, `tests/unit/migrate/*.test.ts`, `tests/fixtures/wayback/{article-53.html,offline.html,spam-injected.html,fake.pdf,real.pdf}`
- Add dev deps: `cheerio`, `turndown`, `tsx`

**Interfaces:**
- Produces:
  - `pickSnapshot(rows: {timestamp: string; status: string}[], cutoff = '20250201000000'): string | null`: latest `status==='200'` with `timestamp < cutoff`.
  - `fetchWayback(timestamp: string, url: string, opts?: {retries=5, baseDelayMs=3000}): Promise<Buffer>`: uses the `${ts}id_/` raw form, exponential backoff, throws `ArchiveUnavailableError` when the body is a placeholder.
  - `isArchivePlaceholder(body: string): boolean`: true for "Temporarily Offline", "Time-out", "Wayback Machine has not archived".
  - `extractArticle(html: string): { title: string; html: string; images: string[]; pdfs: string[]; flags: string[] }`: picks the SPIP Party article body; removes `script, style, iframe, object, embed, form, [style*="display:none"], [hidden]`, `on*` attributes and links to hosts outside an allowlist (`la-traction-de-provence.fr`, `s631887927.onlinehome.fr`, `web.archive.org`, `citroen.com`, `wikipedia.org`); each removed external link or hidden block adds a `flags` entry.
  - `toMarkdown(html: string): string` (turndown, ATX headings, `-` bullets).
  - `sniffType(buf: Buffer): 'pdf'|'jpeg'|'png'|'gif'|'webp'|'html'|'unknown'` (magic bytes).
  - `run.ts` CLI: `npx tsx scripts/migrate/run.ts --out scripts/.cache/migrate`. Reads the URL list from spec §4 (article ids and `rubrique 5`, plus 74, 91, 98, 100, 104, 109 and `article60`). Writes `pages/*.md` with draft frontmatter (`legacyIds`, `section` guessed from the nav), `assets/`, `documents/`, and `report.json` (`{ id, snapshot, title, flags[], missingAssets[] }[]`).

- [ ] **Step 1:** Fixtures: save a real archived article page (id 53, < cutoff) as `article-53.html`; hand-craft `spam-injected.html` (article-53 plus a hidden div of casino links and an injected `<script>`); `offline.html` from the archive's offline page; `fake.pdf` = HTML bytes; `real.pdf` = a minimal valid PDF.
- [ ] **Step 2:** Tests:
  - `pickSnapshot` returns `'20240620055454'` from rows that include a `20250909…` row and a `503`.
  - `pickSnapshot` returns `null` when all rows are ≥ cutoff.
  - `isArchivePlaceholder(offline)` is true and false for article-53.
  - `extractArticle(spam)` output contains no `<script`, no "casino" and ≥ 1 flag; its title is "Qui sommes nous ?".
  - `sniffType(fake.pdf)==='html'`, `sniffType(real.pdf)==='pdf'`.
  - `toMarkdown('<h3>T</h3><p>a <strong>b</strong></p>')` equals `'### T\n\na **b**'`.
- [ ] **Step 3:** Run `npm run test:unit`. Expected: FAIL.
- [ ] **Step 4:** Implement the modules. Assets are saved only if `sniffType` matches the extension; mismatches go to `missingAssets` with reason.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6:** Commit `"Ajoute le script de récupération du contenu depuis Wayback Machine"`.

### Task 6: Run the migration and import the content (review gate)

**Files:**
- Create: `src/content/pages/<section>/*.md`, `src/content/sorties/*.md`, `src/content/documents/*.yaml`, `src/content/evenements/*.md`, `src/assets/content/**`, `public/documents/*.pdf`, `docs/migration-report.md`

**Interfaces:**
- Consumes: Task 5 CLI and Task 2 schemas.

- [ ] **Step 1:** Run `npx tsx scripts/migrate/run.ts --out scripts/.cache/migrate`. Re-run until every id has a snapshot or is listed as missing; the archive is flaky.
- [ ] **Step 2:** Review every page by hand: read the Markdown and every `flags` entry, remove anything not clearly club content, fix the structure (headings, lists, image alt text in French). Almanach/Routracs entries become `sorties`, PDF lists become `documents` YAML, and the last known events become `evenements`.
- [ ] **Step 3:** Measure: `du -sh public/documents src/assets/content`. If the total is > 300 MB, run `git lfs install && git lfs track "public/documents/*.pdf"`, commit `.gitattributes`, and set `lfs: true` in the checkout of both workflows.
- [ ] **Step 4:** Write `docs/migration-report.md` (French): table of page / snapshot date / status / what the owner should proofread, and the list of missing assets.
- [ ] **Step 5:** Run `npm run build`. Expected: PASS (schemas validate every entry).
- [ ] **Step 6:** Commit `"Importe le contenu récupéré du site d'origine"` and push. **Stop and ask the owner to proofread** `docs/migration-report.md` before continuing, then apply their corrections in a follow-up commit.

### Task 7: Content pages, galleries and document lists

**Files:**
- Create: `src/layouts/ArticleLayout.astro`, `src/pages/[section]/index.astro`, `src/pages/[section]/[slug].astro`, `src/pages/almanach/index.astro`, `src/pages/almanach/[year].astro`, `src/components/{Gallery,DocList}.astro`, `src/scripts/lightbox.ts`, `tests/e2e/content.spec.ts`

**Interfaces:**
- Consumes: collections (Task 2), `nav` and BaseLayout (Task 3).
- Produces routes `/<section>/` (lists child pages, ordered by `order`) and `/<section>/<slug>/`, `/almanach/<year>/`. `<Gallery images={{src, alt}[]}>`, `<DocList category items>`.

- [ ] **Step 1:** e2e tests: every `nav` href returns 200 (iterate `nav`). On `/mains-sales/electricite/`, each document card links to a `/documents/*.pdf` that returns 200 with `content-type: application/pdf` and shows its size. Clicking the first gallery thumbnail opens a `dialog[open]` whose image `alt` equals the thumbnail's; Escape closes it and focus returns to the thumbnail; arrow keys move to the next and previous image.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the routes and components (`<dialog>` lightbox, thumbnails via `<Image widths=[320,640]>`, full-size image loaded on open; the doc card shows the `sizeKb` computed at build if missing).
- [ ] **Step 4:** Run `npm test`. Expected: PASS (axe covers every new page via the sitemap).
- [ ] **Step 5:** Commit `"Ajoute les pages de contenu, galeries et listes de documents"`.

### Task 8: SEO, 404 and legal

**Files:**
- Create: `src/pages/404.astro`, `src/pages/robots.txt.ts`, `public/favicon.svg`, `public/og-default.jpg`, `tests/e2e/seo.spec.ts`
- Modify: `src/components/Seo.astro`, `tests/e2e/a11y.spec.ts` (switch to the sitemap URL list)

- [ ] **Step 1:** Tests: `/sitemap-index.xml` lists every nav URL and not `/404/`; `/robots.txt` contains `Sitemap: https://la-traction-de-provence.fr/sitemap-index.xml`; every page has a unique `<title>` and a `meta[name=description]` of 50–160 chars; the homepage JSON-LD parses with `@type` `NGO` and `name` "La Traction de Provence"; `/mentions-legales/` mentions "OVH" and "directeur de la publication".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Put the Mentions légales host block (OVH SAS, 2 rue Kellermann, 59100 Roubaix) in the page; leave the publication director's name as recovered from article 60 and add it to the owner's proofreading list.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `"Ajoute le référencement, la page 404 et les mentions légales"`.

### Task 9: Container, Nginx and redirects

**Files:**
- Create: `scripts/gen-redirects.ts`, `tests/unit/redirects.test.ts`, `deploy/nginx.conf`, `Dockerfile`, `.dockerignore`, `tests/container/check.sh`
- Modify: `.github/workflows/ci.yml` (add a `container` job)

**Interfaces:**
- Consumes: `pages` entries' `legacyIds`/`legacyRubriques` (Task 2) and the PDF file list in `public/documents/`.
- Produces: `buildRedirectMap(pages: {url: string; legacyIds: number[]; legacyRubriques: number[]}[]): string`, nginx `map` bodies for `$legacy_article` and `$legacy_rubrique`, written to `deploy/redirects.map` by `npm run gen:redirects` (also run in the Docker build stage). It throws if one legacy id maps to two URLs.

- [ ] **Step 1:** Unit tests: two pages sharing id 53 → throws; output contains `53 /vie-du-club/qui-sommes-nous/;`.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Run. Expected: PASS.
- [ ] **Step 3:** `nginx.conf`:
  - listen 8080, `root /usr/share/nginx/html`, `absolute_redirect off`, `server_tokens off`
  - `location = /spip.php`: resolve the article id from `$arg_id_article` or from `$args` matching `^article(\d+)`; rubrique from `$arg_id_rubrique`; return 301 to the mapped URL, else 301 to `/`
  - `location ^~ /IMG/pdf/` → 301 `/documents/$1`
  - security headers (`always`): CSP `default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy camera=(), microphone=(), geolocation=()`, `X-Frame-Options DENY`
  - caching per spec §3; `gzip_static on`; `error_page 404 /404.html`
  - `/healthz` returns 200
- [ ] **Step 4:** `Dockerfile`: stage `build` `node:22-alpine` (`npm ci`, `npm run gen:redirects`, `npx astro build`; checks run in CI, not here); stage `nginxinc/nginx-unprivileged:alpine` copies `dist/`, `nginx.conf` and `redirects.map`; `HEALTHCHECK` with `wget -qO- http://127.0.0.1:8080/healthz`; OCI label `org.opencontainers.image.source=https://github.com/Vh4ld/la-traction-de-provence`.
- [ ] **Step 5:** `tests/container/check.sh <base-url>` asserts with curl:
  - `/` 200 with the CSP header
  - `/spip.php?page=article&id_article=53`, `/spip.php?article53&lang=fr` and `/spip.php?page=article&id_article=53&var_mode=calcul` → 301 to the same URL
  - `/spip.php?page=rubrique&id_rubrique=5` → 301 to the Tractionnettes page
  - `/spip.php?article99999` → 301 `/`
  - `/IMG/pdf/manuel-bord.pdf` → 301 `/documents/manuel-bord.pdf`
  - `/nope/` 404 with the custom page
  - `/healthz` 200
- [ ] **Step 6:** CI `container` job: `docker build`, then `docker run -d --read-only --tmpfs /tmp --cap-drop ALL -p 8080:8080`, then `check.sh http://localhost:8080`. Push and confirm the job is green; Docker isn't installed locally.
- [ ] **Step 7:** Commit `"Ajoute l'image Docker, la configuration Nginx et les redirections SPIP"`.

### Task 10: Release workflow, compose file and deployment docs

**Files:**
- Create: `.github/workflows/release.yml`, `deploy/docker-compose.yml`
- Modify: `README.md` (Déploiement, Bascule, Retour arrière, Modifier le contenu sections in French)

- [ ] **Step 1:** `release.yml`: triggers `push` to `main`, `schedule: '0 4 * * 1'` (weekly, Monday 04:00 UTC), `workflow_dispatch`; `permissions: contents: read, packages: write`; runs `npm test` and the container check, then `docker/login-action` with `GITHUB_TOKEN` and `docker/build-push-action` with tags `latest` and `sha-${{ github.sha }}` shortened to 7 characters (via `docker/metadata-action` `type=sha`).
- [ ] **Step 2:** `deploy/docker-compose.yml`: service `traction_site`, `image: ghcr.io/vh4ld/la-traction-de-provence:latest`, `container_name: traction_site`, `restart: unless-stopped`, `read_only: true`, `tmpfs: [/tmp]`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, label `com.centurylinklabs.watchtower.enable=true`, network `proxy-net` external, no `ports`.
- [ ] **Step 3:** Validate: `npx --yes @action-validator/cli .github/workflows/release.yml` and the compose schema with `npx --yes yaml-lint deploy/docker-compose.yml`. Expected: no errors.
- [ ] **Step 4:** README: the spec §9 cutover steps; making the GHCR package public (GitHub → Packages → Package settings → Change visibility); NPM proxy host settings (scheme `http`, host `traction_site`, port `8080`, Force SSL, HTTP/2, HSTS on); rollback (pin `sha-xxxxxxx` or switch NPM back to `traction_wp`); how to add an event, a page or a PDF.
- [ ] **Step 5:** Commit `"Ajoute la publication sur GHCR, le docker-compose et la documentation de déploiement"`.

### Task 11: Final verification

- [ ] **Step 1:** `npm test` locally: all green. CI on `test`: all jobs green.
- [ ] **Step 2:** Lighthouse (`npx --yes lighthouse http://localhost:4321/ --preset=desktop` and `--form-factor=mobile`, same for one article page): ≥ 95 in all four categories. Fix and re-run until met.
- [ ] **Step 3:** Screenshots at 360, 768 and 1440 px of home, one article, one gallery and one document page (Playwright script in the scratchpad), compared side by side with the archived 2024 homepage for identity.
- [ ] **Step 4:** Update the spec status to "Implemented", list the remaining owner actions in the README (proofreading, GHCR visibility, NPM switch), commit `"Vérification finale de la refonte"`, push. Hand over to the owner for review and merge.
