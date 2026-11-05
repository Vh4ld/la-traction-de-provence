# La Traction de Provence

Site web de **La Traction de Provence**, association loi 1901 basée aux Pennes-Mirabeau, qui réunit les passionnés de la Citroën Traction Avant (1934 – 1957).

🌐 <https://la-traction-de-provence.fr>

Ce dépôt contient la refonte complète du site d'origine (SPIP, piraté en 2023 – 2025), reconstruit en site statique moderne avec l'identité visuelle du club : le logo, le titre Art déco doré et la palette noir / ardoise / bleu marine / or.

## Sommaire

- [Technologies](#technologies)
- [Branches et workflow](#branches-et-workflow)
- [Voir le site en local](#voir-le-site-en-local)
- [Modifier le contenu](#modifier-le-contenu)
- [Déploiement sur le serveur](#déploiement-sur-le-serveur)
- [Bascule depuis WordPress](#bascule-depuis-wordpress)
- [Retour arrière](#retour-arrière)
- [Sécurité](#sécurité)
- [Licence](#licence)

## Technologies

| Rôle | Outil |
|---|---|
| Générateur de site statique | [Astro](https://astro.build) 7 |
| Contenu | Fichiers Markdown (`src/content/`) |
| Tests | Vitest, Playwright + axe (accessibilité WCAG 2.2 AA), linkinator (liens) |
| Serveur | nginx non privilégié, conteneur en lecture seule |
| Intégration continue | GitHub Actions |
| Image Docker | GitHub Container Registry : `ghcr.io/vh4ld/la-traction-de-provence` |
| Déploiement | Watchtower sur le VPS, derrière Nginx Proxy Manager |

Pas de base de données, pas de PHP, pas d'interface d'administration, aucun cookie : le site est entièrement statique.

## Branches et workflow

| Branche | Rôle |
|---|---|
| `test` | Branche de travail. Chaque envoi déclenche les vérifications (compilation, liens, accessibilité, image Docker). **Jamais publiée en ligne.** |
| `main` | Production. Une fusion de `test` vers `main` publie automatiquement le site. |

1. Les modifications sont commitées sur `test`.
2. GitHub Actions vérifie tout (onglet **Actions** du dépôt) ; on peut aussi vérifier en local.
3. Si tout est correct : fusion de `test` dans `main` (pull request sur GitHub).
4. Le workflow **Publication** refait les vérifications, construit l'image et la publie sur GHCR (étiquettes `latest` et `sha-xxxxxxx`).
5. Watchtower détecte la nouvelle image sur le VPS et redémarre le conteneur, en général dans les minutes qui suivent.

L'image est aussi reconstruite chaque lundi à 4 h (UTC) pour intégrer les correctifs de sécurité de nginx.

## Voir le site en local

Prérequis : [Node.js](https://nodejs.org) **24** (ou 22.23.4 minimum).

```bash
git switch test
npm install
npm run dev          # site sur http://localhost:4321, rechargé à chaque modification
```

Autres commandes :

```bash
npm run build        # compile le site dans dist/
npm test             # toutes les vérifications (comme sur GitHub)
npx playwright install chromium   # une seule fois, pour les tests dans le navigateur
```

## Modifier le contenu

Tout se trouve dans `src/content/` sous forme de fichiers texte Markdown. Après modification : commit sur `test`, vérification, puis fusion dans `main`.

### Ajouter un événement (page d'accueil)

Créer un fichier dans `src/content/evenements/`, par exemple `2027-06-pentecote.md` :

```markdown
---
title: Pentecôte dans le Vercors
start: 2027-05-15
end: 2027-05-17
place: Villard-de-Lans
---
```

Les événements des 30 prochains jours s'affichent sur l'accueil ; ils disparaissent d'eux-mêmes une fois passés. `end`, `place` et `link` (adresse d'une page) sont facultatifs.

### Modifier une page

Chaque page correspond à un fichier : `src/content/pages/<rubrique>/<page>.md` donne l'adresse `/<rubrique>/<page>/`, et `index.md` la page de présentation de la rubrique. L'en-tête du fichier contient le titre, l'ordre dans la rubrique et la description (50 à 160 caractères, pour les moteurs de recherche).

- Sous-titre : `## Mon sous-titre`
- Lien : `[texte](/vie-du-club/nous-rejoindre/)`
- Adresse électronique : `[nom@exemple.fr](mailto:nom@exemple.fr)` (masquée automatiquement aux robots)
- Image : `![description de l'image](../../../assets/content/ma-photo.jpg)`. Plusieurs images à la suite, sur la même ligne ou sans ligne vide entre elles, forment une galerie ; un clic les agrandit.

### Ajouter un PDF

Placer le fichier dans `public/documents/` (nom en minuscules, sans espace ni accent), puis le citer : `[Titre du document](/documents/mon-document.pdf)`. Le format et la taille (« PDF, 1,2 Mo ») s'affichent automatiquement.

### Ajouter la photo du mois

Placer la photo dans `src/assets/photo-du-mois/` sous le nom `AAAAMM.jpg` (par exemple `202701.jpg` pour janvier 2027). La plus récente est mise en avant ; les autres sont classées par année.

### Rapport de récupération

`docs/migration-report.md` liste les pages reprises de l'ancien site et **ce que le club doit relire ou mettre à jour** (bureau, tarifs, almanach, textes perdus).

## Déploiement sur le serveur

### Première installation (une seule fois)

1. **Rendre l'image publique** après la première publication : GitHub → profil → *Packages* → `la-traction-de-provence` → *Package settings* → *Change visibility* → **Public**. Watchtower peut alors la télécharger sans identifiants.
2. Sur le VPS, copier `deploy/docker-compose.yml` (par exemple dans `/opt/traction-site/`), puis :

   ```bash
   docker compose -f /opt/traction-site/docker-compose.yml up -d
   docker ps --filter name=traction_site     # état : healthy
   ```

   Le conteneur `traction_site` rejoint le réseau externe `proxy-net` ; aucun port n'est ouvert sur l'hôte.
3. Vérifier depuis le conteneur de Nginx Proxy Manager (remplacer le nom si besoin) :

   ```bash
   docker exec -it <conteneur-npm> curl -sI http://traction_site:8080/healthz
   ```

### Nginx Proxy Manager

Hôte proxy `la-traction-de-provence.fr` (et `www.la-traction-de-provence.fr`) :

| Champ | Valeur |
|---|---|
| Scheme | `http` |
| Forward Hostname / IP | `traction_site` |
| Forward Port | `8080` |
| Block Common Exploits | activé |
| SSL | certificat Let's Encrypt existant, **Force SSL**, **HTTP/2**, **HSTS** activés |

Les en-têtes de sécurité (CSP, etc.) sont envoyés par le conteneur lui-même ; NPM n'a rien d'autre à configurer.

### Mises à jour

Automatiques : toute fusion dans `main` publie une nouvelle image, que Watchtower installe. Pour forcer une mise à jour immédiate :

```bash
docker compose -f /opt/traction-site/docker-compose.yml pull
docker compose -f /opt/traction-site/docker-compose.yml up -d
```

## Bascule depuis WordPress

1. Fusionner `test` dans `main` et attendre la fin du workflow **Publication** (onglet *Actions*).
2. Rendre l'image publique (voir ci-dessus), puis lancer `traction_site` sur le VPS.
3. Dans NPM, remplacer la destination de l'hôte `la-traction-de-provence.fr` (`traction_wp`) par `traction_site`, port `8080`.
4. Vérifier le site, puis une ancienne adresse : <https://la-traction-de-provence.fr/spip.php?article53> doit mener à « Qui sommes-nous ? ».
5. Garder les conteneurs WordPress (`traction_wp`, `traction_db`) arrêtés quelques semaines, puis les supprimer avec leurs volumes.

## Retour arrière

- **Revenir à une version précédente du site** : dans `docker-compose.yml`, remplacer `:latest` par l'étiquette d'une version antérieure (`sha-xxxxxxx`, visible dans *Packages* sur GitHub), puis `docker compose up -d`. Watchtower ne touche pas à une version épinglée.
- **Revenir à WordPress** : dans NPM, remettre `traction_wp` comme destination.

## Sécurité

- Site statique : aucun code exécuté sur le serveur, aucune base de données, aucun formulaire.
- Conteneur non root, système de fichiers en lecture seule, aucune capacité Linux, aucun port publié.
- En-têtes stricts : Content-Security-Policy (`'self'` uniquement), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Les anciennes adresses SPIP (`spip.php?…`, `/IMG/pdf/…`) sont redirigées vers les nouvelles pages ; aucun fichier PHP n'existe.
- Le contenu repris de l'ancien site a été vérifié : textes issus de captures antérieures à la compromission (juillet 2023), fichiers contrôlés (type réel, absence de code, PDF sans JavaScript), images ré-encodées.

## Licence

- **Code source** : licence MIT, voir [LICENSE](LICENSE).
- **Contenu** (textes, photos, images, logo, documents et PDF) : © La Traction de Provence et leurs auteurs respectifs, tous droits réservés. Voir [CONTENT-NOTICE.md](CONTENT-NOTICE.md).
