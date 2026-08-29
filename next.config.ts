import type { NextConfig } from 'next';

/**
 * Configuration Next.js — Nova TV
 *
 * Rappel d'architecture : Nova TV est une application 100 % locale.
 * Aucun serveur, aucune base de données, aucune route API.
 * La cible finale est un APK Android (Capacitor) ; le web sert
 * au développement et de vitrine.
 */

/**
 * En-têtes de sécurité HTTP.
 *
 * Ce sont des instructions envoyées au navigateur avec chaque page.
 * Elles ne changent rien à l'affichage mais ferment des portes
 * d'attaque classiques.
 *
 * ATTENTION — depuis le passage à `output: 'export'`, ces en-têtes ne
 * sont plus appliqués : un en-tête HTTP suppose un serveur qui répond,
 * or l'export ne produit que des fichiers figés.
 *
 * La fonction `headers()` qui les déclarait a donc été retirée : elle
 * n'avait aucun effet et Next émettait deux avertissements à chaque
 * compilation, qui noyaient les vrais messages. Ce qui reste ici est
 * une simple constante, non branchée.
 *
 * Elle est conservée volontairement, comme référence à reporter dans
 * la configuration de l'hébergeur le jour où une vitrine web sera
 * mise en ligne (Nginx, Apache, Vercel…). Dans l'APK, la protection
 * équivalente vient de la configuration Capacitor, pas d'ici.
 *
 * `satisfies` : vérifie la forme de la liste sans figer son type. Sans
 * cette annotation, une constante déclarée puis jamais lue deviendrait
 * du code mort silencieux ; ici la structure reste contrôlée par le
 * compilateur, une faute de frappe sur `key` ou `value` se voit tout
 * de suite.
 */
const securityHeaders = [
  {
    // Empêche d'autres sites d'afficher Nova TV dans un cadre invisible
    // par-dessus lequel ils placeraient de faux boutons (clickjacking).
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    // Empêche le navigateur de « deviner » le type d'un fichier.
    // Sans cela, un fichier déposé par l'utilisateur pourrait être
    // interprété comme du code exécutable.
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Limite l'information envoyée aux serveurs tiers (logos de chaînes,
    // jaquettes) : ils apprennent le domaine, jamais la page consultée.
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Coupe l'accès aux capteurs dont l'application n'a aucun besoin.
    // Si une dépendance tierce tentait d'y accéder, le navigateur refuse.
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
] satisfies { key: string; value: string }[];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Images distantes.
   *
   * Les logos de chaînes et jaquettes viennent des serveurs IPTV de
   * l'utilisateur : leurs domaines sont inconnus à l'avance.
   *
   * `unoptimized: true` désactive l'optimisation d'images de Next.
   * Deux raisons :
   *   1. Cette optimisation exige un serveur Node — incompatible avec
   *      l'export statique nécessaire à l'APK (Phase 9).
   *   2. Elle ferait transiter chaque image par notre infrastructure,
   *      ce qui contredit la position juridique du projet : Nova TV
   *      ne relaie aucun contenu.
   *
   * La performance sera traitée en Phase 6 par le chargement différé
   * et un cache local, pas par un service distant.
   */
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },

  // --------------------------------------------------------------
  // Export statique — prérequis de l'APK Capacitor
  // --------------------------------------------------------------
  // `output: 'export'` produit des fichiers HTML/CSS/JS figés dans
  // `out/`, seul format qu'un APK peut embarquer : il n'y a pas de
  // serveur Node dans un téléphone ni dans un Firestick.
  //
  // Ce mode exige de connaître toutes les adresses à la compilation.
  // Les fiches de chaîne, de film et de série passent donc par un
  // paramètre d'URL (`/live?id=…`) plutôt que par un segment dynamique
  // (`/live/{id}`) : les identifiants viennent de l'abonnement de
  // l'utilisateur, découvert au premier lancement.
  //
  // Les anciennes routes `/live/[id]`, `/movies/[id]` et `/series/[id]`
  // ont été supprimées : Next 16 refuse un `generateStaticParams`
  // renvoyant une liste vide, et produire une page fantôme
  // `/live/placeholder/` pour satisfaire le compilateur serait
  // du poids mort embarqué dans l'APK.
  output: 'export',
  distDir: 'out',

  // Sans cela, l'export produit `/live.html` et un serveur de fichiers
  // statiques renvoie 404 sur `/live`. Avec, il produit `/live/index.html`,
  // que la WebView sert correctement.
  trailingSlash: true,
};

export default nextConfig;
