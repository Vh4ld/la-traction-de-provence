/**
 * Menu principal, repris du menu du site d'origine (2024).
 * Source unique : la barre de navigation et l'ordre des pages en dépendent.
 */
export type NavItem = { label: string; href: string; children?: NavItem[] };

export const nav: NavItem[] = [
  {
    label: 'Vie du Club',
    href: '/vie-du-club/',
    children: [
      { label: 'Qui sommes-nous ?', href: '/vie-du-club/qui-sommes-nous/' },
      { label: 'Quai de Javel', href: '/vie-du-club/quai-de-javel/' },
      { label: 'Nous rejoindre', href: '/vie-du-club/nous-rejoindre/' },
      { label: 'Notracanou', href: '/vie-du-club/notracanou/' },
      { label: 'Nous contacter', href: '/vie-du-club/nous-contacter/' },
      { label: 'Lou Coumpan', href: '/vie-du-club/lou-coumpan/' },
      { label: 'Les Tractionnettes', href: '/vie-du-club/les-tractionnettes/' },
    ],
  },
  { label: 'Almanach', href: '/almanach/' },
  { label: 'Nos Routracs', href: '/routracs/' },
  { label: 'Photo du mois', href: '/photo-du-mois/' },
  {
    label: 'Les mains sales',
    href: '/mains-sales/',
    children: [
      { label: 'Dictionnaire des réparations', href: '/mains-sales/dictionnaire-des-reparations/' },
      { label: 'Catalogue des pièces détachées', href: '/mains-sales/catalogue-des-pieces-detachees/' },
      { label: 'Revues techniques', href: '/mains-sales/revues-techniques/' },
      { label: 'Manuels et notices', href: '/mains-sales/manuels-et-notices/' },
      { label: 'Électricité', href: '/mains-sales/electricite/' },
      { label: 'Graissage', href: '/mains-sales/graissage/' },
      { label: 'Carrosserie', href: '/mains-sales/carrosserie/' },
      { label: 'Outils', href: '/mains-sales/outils/' },
      { label: 'Mécanique', href: '/mains-sales/mecanique/' },
      { label: 'Trucs et astuces', href: '/mains-sales/trucs-et-astuces/' },
    ],
  },
  {
    label: 'De 34 à 57',
    href: '/de-34-a-57/',
    children: [
      { label: 'Catalogues Citroën', href: '/de-34-a-57/catalogues-citroen/' },
      { label: 'Publicités d’époque', href: '/de-34-a-57/publicites-d-epoque/' },
      { label: 'Docs étrangères', href: '/de-34-a-57/docs-etrangeres/' },
      { label: 'Accessoires', href: '/de-34-a-57/accessoires/' },
      { label: 'Jouets', href: '/de-34-a-57/jouets/' },
      { label: 'Remorques et caravanes', href: '/de-34-a-57/remorques-et-caravanes/' },
    ],
  },
];

/** Liens du pied de page. */
export const footerLinks: NavItem[] = [
  { label: 'Nous contacter', href: '/vie-du-club/nous-contacter/' },
  { label: 'Nous rejoindre', href: '/vie-du-club/nous-rejoindre/' },
  { label: 'Mentions légales', href: '/infos/mentions-legales/' },
];
