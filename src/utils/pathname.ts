/**
 * Compare des chemins d'URL sans se faire piéger par la barre finale.
 *
 * ─── Le piège ──────────────────────────────────────────────────────
 *
 * `next.config.ts` active `trailingSlash: true`. C'est nécessaire à
 * l'export statique : sans cela, Next produit `/welcome.html`, qu'un
 * serveur de fichiers — et la WebView Android — renvoie en 404.
 *
 * Conséquence : le chemin réel devient `/welcome/`, avec une barre
 * finale. Un test écrit `pathname === '/welcome'` est donc TOUJOURS
 * faux, silencieusement. Aucune erreur, aucun avertissement : la
 * condition ne se déclenche simplement jamais.
 *
 * C'est exactement ce qui affichait le menu par-dessus l'écran de
 * bienvenue. On centralise donc la normalisation ici plutôt que de
 * répéter un `replace()` à chaque comparaison.
 */

/**
 * Retire la barre finale d'un chemin, sauf pour la racine.
 *
 * La racine `/` est le seul cas où la barre est signifiante : la
 * réduire à une chaîne vide casserait la comparaison de la page
 * d'accueil.
 *
 * @example
 * normalizePathname('/welcome/')  // '/welcome'
 * normalizePathname('/welcome')   // '/welcome'
 * normalizePathname('/')          // '/'
 */
export function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Teste l'égalité de deux chemins en ignorant la barre finale.
 *
 * @example
 * isSamePath('/welcome/', '/welcome')  // true
 */
export function isSamePath(a: string, b: string): boolean {
  return normalizePathname(a) === normalizePathname(b);
}
