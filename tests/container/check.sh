#!/usr/bin/env bash
# Vérifie l'image Docker en fonctionnement : pages, en-têtes de sécurité, redirections SPIP.
# Usage : tests/container/check.sh http://localhost:8080
set -u
BASE="${1:-http://localhost:8080}"
fail=0

check() { # description, attendu, obtenu
  if [[ "$3" == "$2" ]]; then echo "ok   $1"; else echo "ÉCHEC $1 : attendu « $2 », obtenu « $3 »"; fail=1; fi
}
status() { curl -s -o /dev/null -w '%{http_code}' "$BASE$1"; }
redirect() { curl -s -o /dev/null -w '%{http_code} %header{location}' "$BASE$1"; }
header() { curl -s -D - -o /dev/null "$BASE$1" | tr -d '\r' | grep -i "^$2:" | head -n1 | cut -d' ' -f2-; }

check "accueil"                         "200" "$(status /)"
check "santé invisible de l'extérieur"   "404" "$(status /healthz)"
check "page de contenu"                 "200" "$(status /mains-sales/electricite/)"
check "PDF"                             "200" "$(status /documents/bulletin-adhesion.pdf)"
check "CSP présente"                    "yes" "$([[ "$(header / content-security-policy)" == *"script-src 'self'"* ]] && echo yes || echo no)"
check "CSP : tout interdit par défaut"  "yes" "$([[ "$(header / content-security-policy)" == "default-src 'none';"* ]] && echo yes || echo no)"
check "CORP"                            "same-site" "$(header / cross-origin-resource-policy)"
check "nosniff"                         "nosniff" "$(header / x-content-type-options)"
check "X-Frame-Options"                 "DENY" "$(header / x-frame-options)"
check "version nginx masquée"           "nginx" "$(header / server)"
check "HTML non mis en cache"           "no-cache" "$(header / cache-control)"
check "PDF mis en cache 30 jours"       "public, max-age=2592000" "$(header /documents/bulletin-adhesion.pdf cache-control)"

Q='/vie-du-club/qui-sommes-nous/'
check "spip.php?page=article&id_article=53"         "301 $Q" "$(redirect '/spip.php?page=article&id_article=53')"
check "spip.php?article53&lang=fr"                  "301 $Q" "$(redirect '/spip.php?article53&lang=fr')"
check "…&id_article=53&var_mode=calcul"             "301 $Q" "$(redirect '/spip.php?page=article&id_article=53&var_mode=calcul')"
check "spip.php?id_article=53"                      "301 $Q" "$(redirect '/spip.php?id_article=53')"
check "rubrique 5"                                  "301 /vie-du-club/les-tractionnettes/" "$(redirect '/spip.php?page=rubrique&id_rubrique=5')"
check "article inconnu : disparu"                   "410" "$(status '/spip.php?article99999')"
check "forum privé (74) : disparu"                  "410" "$(status '/spip.php?page=article&id_article=74')"
check "spip.php seul → accueil"                     "301 /" "$(redirect '/spip.php')"
check "page=sommaire → accueil"                     "301 /" "$(redirect '/spip.php?page=sommaire&lang=fr')"
check "page SPIP quelconque : disparue"             "410" "$(status '/spip.php?page=backend')"
check "IMG/pdf en majuscules"                       "301 /documents/ac4606.pdf" "$(redirect '/IMG/pdf/AC4606.pdf')"
check "IMG/pdf/manuel-bord.pdf"                     "301 /documents/manuel-bord.pdf" "$(redirect '/IMG/pdf/manuel-bord.pdf')"
check "IMG/pdf inconnu"                             "404" "$(status /IMG/pdf/inconnu.pdf)"
check "ancien chemin SPIP"                          "410" "$(status '/ecrire/')"
check "ancien chemin SPIP sans barre"               "410" "$(status '/ecrire')"
check "ancien webshell IMG"                         "410" "$(status '/IMG/store.php')"
check "page inexistante : 404"                      "404" "$(status /nope/)"
check "page 404 personnalisée"                      "yes" "$(curl -s "$BASE/nope/" | grep -q 'Page introuvable' && echo yes || echo no)"
check "pas d'exécution PHP : disparu"               "410" "$(status /bd.php)"
check "page 410 personnalisée"                      "yes" "$(curl -s "$BASE/bd.php" | grep -q 'Page introuvable' && echo yes || echo no)"
check "fichier caché"                               "404" "$(status /.git/config)"
check "répertoire sans index : 404, pas 403"        "404" "$(status /documents/)"
check "POST refusé"                                 "405" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/")"
check "POST refusé sur une redirection"             "405" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/spip.php")"
check "page 405 sans signature nginx"               "no" "$(curl -s -X POST "$BASE/" | grep -q '<center>nginx' && echo yes || echo no)"

exit $fail
