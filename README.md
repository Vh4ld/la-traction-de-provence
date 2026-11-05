# La Traction de Provence

Site web de **La Traction de Provence**, association loi 1901 basée aux Pennes-Mirabeau, qui réunit les passionnés de la Citroën Traction Avant (1934 – 1957).

🌐 Site en ligne : <https://la-traction-de-provence.fr>

Ce dépôt contient la refonte complète du site d'origine (anciennement sous SPIP), reconstruite en site statique moderne en conservant l'identité visuelle du club : le logo, le titre Art déco doré et la palette noir / bleu marine / or.

> 🚧 **Refonte en cours.** Le site WordPress provisoire reste en ligne jusqu'à la bascule.

## Technologies

| Rôle | Outil |
|---|---|
| Générateur de site statique | [Astro](https://astro.build) |
| Contenu | Fichiers Markdown (`src/content/`) |
| Serveur | Nginx (image Docker non-root, en lecture seule) |
| Intégration continue | GitHub Actions |
| Image Docker | GitHub Container Registry (`ghcr.io/vh4ld/la-traction-de-provence`) |
| Déploiement | Watchtower sur le VPS, derrière Nginx Proxy Manager |

Pas de base de données, pas de PHP, pas d'interface d'administration : le site est entièrement statique, ce qui réduit fortement la surface d'attaque.

## Branches et workflow

| Branche | Rôle |
|---|---|
| `test` | Branche de travail. Toutes les modifications y sont faites et vérifiées (compilation, liens, accessibilité). **Jamais publiée en ligne.** |
| `main` | Production. Une fusion de `test` vers `main` publie automatiquement le site. |

Processus :

1. Les modifications sont commitées sur `test`.
2. Vérification en local (voir ci-dessous).
3. Si tout est correct : fusion de `test` dans `main` (pull request sur GitHub).
4. GitHub Actions construit l'image Docker et la publie sur GHCR.
5. Watchtower détecte la nouvelle image sur le VPS et redémarre le conteneur.

## Vérifier le site en local

Prérequis : [Node.js](https://nodejs.org) 22 LTS ou plus récent.

```bash
git switch test
npm install
npm run dev        # site accessible sur http://localhost:4321
```

Pour tester la version de production :

```bash
npm run build
npm run preview
```

Ou avec Docker :

```bash
docker build -t traction-site .
docker run --rm -p 8080:8080 traction-site   # http://localhost:8080
```

## Modifier le contenu

Tout le contenu se trouve dans `src/content/` sous forme de fichiers Markdown :

- **Ajouter un événement** : créer un fichier dans `src/content/evenements/` (date, titre, lieu). Les événements passés disparaissent automatiquement de la page d'accueil.
- **Modifier une page** : éditer le fichier `.md` correspondant.
- **Ajouter des photos ou des PDF** : les placer dans le dossier indiqué dans la page concernée.

Le détail sera complété au fil de la refonte.

## Déploiement sur le serveur

Le conteneur `traction_site` est rattaché au réseau Docker externe `proxy-net` partagé avec Nginx Proxy Manager. Aucun port n'est publié sur l'hôte.

Dans Nginx Proxy Manager, l'hôte proxy `la-traction-de-provence.fr` pointe vers `http://traction_site:8080` (certificat Let's Encrypt géré par NPM).

Les instructions complètes (`docker-compose.yml`, bascule depuis WordPress, retour arrière) seront ajoutées avec la mise en production.

## Licence

- **Code source** : licence MIT, voir [LICENSE](LICENSE).
- **Contenu** (textes, photos, images, logo, documents et PDF) : © La Traction de Provence et leurs auteurs respectifs, tous droits réservés. Voir [CONTENT-NOTICE.md](CONTENT-NOTICE.md).
