'use client';

/**
 * Nom affiché d'une catégorie ou d'une chaîne.
 *
 * ── Surnom et identifiant réel ─────────────────────────────────────
 * Le catalogue (chaînes, catégories) est rechargé depuis la source de
 * l'utilisateur à chaque synchronisation : il porte toujours le nom
 * fourni par le serveur ou le fichier. Un renommage ne doit donc **pas**
 * écrire dans l'objet du catalogue — ce nom réapparaîtrait dès la
 * resynchronisation, et modifier l'identifiant réel (qui sert au guide
 * TV, aux favoris, à l'historique) casserait toute la navigation.
 *
 * La couche de renommage est donc une carte séparée `id → surnom` :
 *   - la **clé** est l'identifiant réel, jamais modifié ;
 *   - la **valeur** est le nom ajouté par l'utilisateur, qui ne sert
 *     qu'à l'affichage.
 *
 * Ces deux fonctions font le lien : elles renvoient le surnom s'il en
 * existe un, sinon le nom d'origine. C'est la seule source de vérité
 * pour l'affichage ; elles ne déterminent que du texte.
 *
 * ── Pourquoi dans `lib/` et pas dans le composant ──────────────────
 * Dès que la passe « renommer les chaînes » (section C) arrivera, la
 * page TV, la fiche chaîne et la recherche devront toutes utiliser le
 * même nom affiché. Centraliser la règle ici évite que deux écrans ne
 * divergent un jour — le même piège que la fenêtre unique de profil.
 */

/**
 * Nom affiché d'une catégorie, ou son nom d'origine si aucun surnom
 * n'est enregistré.
 */
export function categoryDisplayName(
  id: string,
  originalName: string,
  renames: Record<string, string>
): string {
  const renamed = renames[id];
  return renamed && renamed.trim().length > 0 ? renamed : originalName;
}

/**
 * Nom affiché d'une chaîne, ou son nom d'origine si aucun surnom
 * n'est enregistré.
 */
export function channelDisplayName(
  id: string,
  originalName: string,
  renames: Record<string, string>
): string {
  const renamed = renames[id];
  return renamed && renamed.trim().length > 0 ? renamed : originalName;
}
