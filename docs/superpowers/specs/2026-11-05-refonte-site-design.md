# Refonte du site La Traction de Provence — Design

**Date:** 2026-11-05
**Status:** Awaiting review
**Repo:** `git@github.com:Vh4ld/la-traction-de-provence.git`

## 1. Goal

Rebuild the website of La Traction de Provence (non-profit "association loi 1901", Les Pennes-Mirabeau, Citroën Traction Avant club) from scratch, after the original SPIP site was hacked. The new site keeps the club's visual identity, uses current web standards, and is far harder to compromise. It replaces the stopgap WordPress currently served at `https://la-traction-de-provence.fr`.

### Success criteria

- All public sections of the original site are present, with their content recovered and proofread, **except the forum** (SPIP forum / article comments), which is deliberately not recreated.
- The site is recognisably the same club: logo, gold Art Deco title, dark / navy / gold palette, Vieux-Port photo banner.
- Static output only: no database, no server-side code, no admin login.
- WCAG 2.2 AA; Lighthouse ≥ 95 in Performance, Accessibility, Best Practices and SEO on the homepage and a representative article page.
- Merging `test` → `main` deploys to production with no manual server step.
- Old `spip.php?…` URLs redirect (301) to their new equivalents.

### Decisions already made (by the owner)

| Topic | Decision |
|---|---|
| Content source | Wayback Machine, clean snapshots before the hack. Owner may still find an older backup; if so it supersedes the archive. |
| Editing | Owner edits Markdown via Git. No CMS. |
| Stack | Astro static site. |
| Style | Modernised, same identity (not a pixel replica). |
| Hosting | Owner's OVH VPS, Docker, behind the existing Nginx Proxy Manager on network `proxy-net`. |
| Deploy | GitHub Actions → public image on GHCR → Watchtower. |
| Test environment | Local only. `test` is never published online. |
| Forum | Not recreated. |

## 2. Findings from the existing material

- `traction-provence-docker/wordpress-export.tar` is a `docker commit` of a stock `wordpress:latest` (6.8.2) container. It holds only default themes and Akismet: `/var/www/html` was a volume and was not captured.
- `wordpress_db.sql` contains only mysqldump's usage message. No data.
- The original site was **SPIP 3.1.9** with the "SPIP Party 1.5" template and the `feria-blue` stylesheet, served at `s631887927.onlinehome.fr` and framed under `la-traction-de-provence.fr`.
- The homepage shrinks from ~5.9 KB to ~575 bytes in **September 2025** (likely hack date). Spam pages (`/js/1856.html`, `/images/3057.html`, …) appear from **February 2025**. Only snapshots **before 2025-02-01** are trusted.
- Wayback holds ~35 article pages (`spip.php?page=article&id_article=N`), one section page (`id_rubrique=5`), ~100 PDFs under `IMG/pdf/`, images under `IMG/jpg/` and `local/cache-vignettes/`, the header image and the 6 banner photos (`squelettes/toto/1-6.jpg`).

### Visual identity extracted

| Element | Value |
|---|---|
| Page background | `#1F1F1F` |
| Header band | `#5C5A5A` with `header-blue.png` (1220×200): logo (navy cabriolet Traction under a gold sun with Notre-Dame de la Garde) + "LA TRACTION DE PROVENCE" in gold Art Deco outlined lettering |
| Navy | `#07286D` |
| Gold (accent, links hover, headings) | `#FAC608` (secondary `#F4C418`) |
| Light tint | `#D3DBEE` |
| Banner | 6 rotating photos (1214×486), Tractions on the Marseille Vieux-Port |
| Typography | Arial, italic for headings and taglines |

## 3. Architecture

```
GitHub repo (Astro source + Markdown content + assets)
  ├─ branch test  ── CI: build + checks (never deployed)
  └─ branch main  ── CI: build + checks + docker build → ghcr.io/vh4ld/la-traction-de-provence:latest
                                                              │
OVH VPS                                                       ▼
  ├─ Watchtower ── polls GHCR, pulls new image, restarts traction_site
  ├─ stack "traction" (docker compose)
  │     └─ traction_site : nginxinc/nginx-unprivileged:alpine + /dist
  │          internal port 8080, network proxy-net (external), no host port
  └─ Nginx Proxy Manager : la-traction-de-provence.fr → http://traction_site:8080
                            (Let's Encrypt, as today)
```

### Repository layout

```
.
├── .github/workflows/
│   ├── ci.yml            # test + main: install, astro check, build, link check, a11y
│   └── release.yml       # main + weekly cron: build & push image to GHCR
├── deploy/
│   ├── docker-compose.yml  # traction_site on proxy-net, Watchtower label
│   └── nginx.conf          # site config: headers, caching, redirects, 404
├── Dockerfile            # multi-stage: node:22-alpine build → nginx-unprivileged
├── scripts/migrate/      # one-off Wayback → Markdown migration (Node)
├── public/               # fonts, favicon, PDFs (served as-is)
├── src/
│   ├── assets/           # images processed by astro:assets
│   ├── components/       # Header, Nav, Banner, Footer, Gallery, EventList, DocList
│   ├── content/          # Markdown collections (see §4)
│   ├── content.config.ts # collection schemas (zod)
│   ├── layouts/          # BaseLayout, ArticleLayout
│   ├── pages/            # routes
│   └── styles/           # tokens.css, global.css
├── docs/superpowers/     # specs and plans
└── README.md             # French
```

### Container

- `Dockerfile` stage 1: `node:22-alpine`, `npm ci`, `npm run build`.
- Stage 2: `nginxinc/nginx-unprivileged:alpine` (non-root, port 8080), copies `dist/` and `deploy/nginx.conf`.
- Compose runs it with `read_only: true`, a `tmpfs` for `/tmp`, `cap_drop: [ALL]`, `security_opt: no-new-privileges`, healthcheck, `restart: unless-stopped`, label `com.centurylinklabs.watchtower.enable=true`.
- Image tags: `latest`, `sha-<commit>` (for rollback) and an OCI `source` label linking to the repo.

### Nginx (inside the container)

- Security headers: strict `Content-Security-Policy` (`default-src 'self'`, no inline scripts beyond hashed ones), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: DENY`. HSTS is set in NPM, which owns TLS.
- Caching: hashed assets `immutable, max-age=1y`; HTML `no-cache`; PDFs and images 30 days.
- gzip on; pre-compressed `.br`/`.gz` served if present.
- Custom 404 page.
- **Redirect map** from SPIP URLs: `spip.php?page=article&id_article=N`, `spip.php?articleN`, `spip.php?page=rubrique&id_rubrique=N` → new slugs; `IMG/pdf/<file>.pdf` → `/documents/<file>.pdf`; everything else under `spip.php` → `/`.

### CI/CD

- `ci.yml` (push to any branch, PR): `npm ci`, `astro check`, `astro build`, internal link check on `dist/`, axe accessibility scan of built pages (Playwright + `@axe-core/playwright`). A failure blocks merge.
- `release.yml` (push to `main`, weekly cron, manual): runs the same checks, then builds and pushes the image to GHCR with `GITHUB_TOKEN` (`packages: write`). The weekly run picks up patched nginx base images. Image visibility set to public once, by hand, after the first push.

## 4. Content model

Astro content collections with zod schemas, so a missing field fails the build.

| Collection | Folder | Fields |
|---|---|---|
| `pages` | `src/content/pages/` | `title`, `section` (enum), `order`, `description`, `legacyIds` (old SPIP article ids, for redirects), `cover?` |
| `evenements` | `src/content/evenements/` | `title`, `start` (date), `end?`, `place?`, `link?` |
| `sorties` (Almanach / Routracs) | `src/content/sorties/` | `title`, `year`, `date?`, `place?`, `cover`, `gallery[]` |
| `documents` | `src/content/documents/` (data, YAML) | grouped lists of PDFs: `title`, `file`, `thumb?`, `category` |

### Sitemap and navigation (from the 2024 menu)

| Menu | Pages | Old ids |
|---|---|---|
| Accueil | Banner, upcoming events (30 days), intro | – |
| Vie du Club | Qui sommes-nous, Quai de Javel, Nous rejoindre, Notracanou, Nous contacter, Lou Coumpan, Les Tractionnettes | 90, 53, 42, 2, 57, 43, 44, rub. 5 |
| Almanach | Club outings by year | 11 |
| Nos Routracs | Club road trips | 70 |
| Photo du mois | Gallery | 48 |
| Les mains sales | Dictionnaire des réparations, Catalogue des pièces, Revues techniques, Manuels et notices, Électricité, Graissage, Carrosserie, Outils, Mécanique, Trucs et astuces | 76, 55, 68, 66, 61, 56, 65, 62, 63, 64, 54 |
| De 34 à 57 | Catalogues Citroën, Publicités d'époque, Docs étrangères, Accessoires, Jouets, Remorques et caravanes | 77, 105, 71, 72, 50, 51, 73 |
| Footer | Mentions légales, Contact, membership PDF | 60 |

Other archived ids (74, 91, 98, 100, 104, 109) are reviewed during migration and placed where they fit or dropped if obsolete.

### Explicitly out of scope

- Forum and article comments (SPIP `formulaire_forum`).
- RSS feed of the old site, SPIP calendar widget, CKEditor, search engine. An RSS feed for events can be added later if wanted.
- Contact form: replaced by an obfuscated `mailto:` link. No form, no backend.
- Analytics and any third-party script. No cookies, so no consent banner.

## 5. Content recovery (migration)

One-off Node script in `scripts/migrate/`, run locally, output committed after manual review.

1. Query the Wayback CDX API for each known URL; pick the **latest 200 snapshot before 2025-02-01**.
2. Fetch the raw page (`id_` mode), with retry and backoff (the archive is flaky and rate-limited).
3. Extract the article body from the SPIP Party markup; drop all `<script>`, `<iframe>`, inline handlers, hidden elements, external links not on an allowlist and anything matching spam patterns.
4. Convert to Markdown (`turndown`), write frontmatter, record `legacyIds`.
5. Download referenced images and PDFs; verify MIME type by content (not extension); store images in `src/assets/`, PDFs in `public/documents/`.
6. Write a migration report: pages fetched, snapshot date per page, missing assets, flagged suspicious content.

Every recovered page is reviewed by hand before commit. All downloaded files are treated as untrusted: they are only read and copied, never executed. The owner proofreads texts, since several pages date from 2017–2021 snapshots.

**Repo size:** if PDFs plus images exceed ~300 MB, PDFs move to Git LFS (requires `lfs: true` in CI checkout). Measured during migration.

## 6. Design

Modern take on the original identity, not a replica.

- **Tokens** in `src/styles/tokens.css`: the palette in §2 plus derived tints; spacing and type scales on fluid `clamp()` values.
- **Header:** the original logo, extracted from `header-blue.png`, redrawn as SVG if quality allows, otherwise a high-resolution PNG. The title set in a self-hosted Art Deco display font (candidate: *Poiret One* or *Limelight*, OFL licence) in gold with the outlined look, on the slate band.
- **Banner:** the 6 Vieux-Port photos as a CSS scroll-snap carousel with slow auto-advance, paused on hover/focus, and no motion when `prefers-reduced-motion` is set. Optimised AVIF/WebP, `srcset`.
- **Navigation:** a disclosure-pattern dropdown menu (buttons with `aria-expanded`), keyboard operable, a collapsible menu on mobile. Works without JavaScript on mobile via `<details>`.
- **Body:** dark theme by default (faithful to the original), readable body font (system stack or *Inter*), max line length ~70ch, gold headings in italic as a nod to the original.
- **Light theme:** follows the visitor's system setting (`prefers-color-scheme`) with a navy-on-cream variant. No manual toggle.
- **Galleries:** grid of thumbnails with a native `<dialog>` lightbox (small vanilla script); each image has alt text.
- **Document lists:** cards with thumbnail, title, file size and "PDF" label.
- **Accessibility:** WCAG 2.2 AA, verified contrast for every text/background pair (gold on navy is checked; gold on `#1F1F1F` passes), visible focus rings, skip link, `lang="fr"`, logical headings.
- **SEO:** per-page title/description, Open Graph image, `sitemap.xml`, `robots.txt`, JSON-LD `Organization` (NGO).

## 7. Error handling

- **Build:** schema validation in content collections; broken internal links fail CI.
- **Runtime:** custom 404 page; nginx healthcheck; Watchtower only restarts after a successful pull.
- **Rollback:** pin `image: ghcr.io/vh4ld/la-traction-de-provence:sha-<previous>` in compose, or switch the NPM proxy host back to `traction_wp` (WordPress stays up until the owner decides to remove it).
- **Migration:** retries, per-page report, nothing committed without review.

## 8. Testing and verification

Before each commit to `test`:

- `astro check` and `astro build` succeed.
- Link check on `dist/` (internal links and anchors).
- axe scan on every built page: zero violations.
- Lighthouse on homepage and one article page: ≥ 95 in all four categories.
- Manual check at 360 px, 768 px and 1440 px wide; keyboard-only navigation of the menu.
- Redirect map tested against the list of legacy URLs (curl against the local container).

## 9. Cutover

1. Owner merges `test` → `main`; CI publishes the image; owner sets the GHCR package to public.
2. On the VPS: `docker compose -f deploy/docker-compose.yml up -d` (one time).
3. Check `traction_site` from inside `proxy-net` (e.g. from the NPM container).
4. In NPM: point `la-traction-de-provence.fr` to `traction_site:8080`.
5. Keep WordPress stopped but not deleted for a few weeks, then remove it.

## 10. Open points

- ~~Licence~~ **Decided:** code under MIT (`LICENSE`); content (texts, photos, images, logo, documents, PDFs) © La Traction de Provence and its authors, all rights reserved (`CONTENT-NOTICE.md`). The site footer repeats the content notice.
- **Local tooling:** Node.js is installed. Docker is not; the image is tested in CI, so Docker locally is optional.
- **Font choice** for the title is confirmed visually during implementation.
- **Mentions légales** must name the publication director and the host (OVH). Content to be confirmed by the owner from the recovered page.
