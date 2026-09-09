/**
 * Sélection des catégories d'une source Xtream.
 *
 * ─── Le problème ───────────────────────────────────────────────────
 *
 * Un abonnement Xtream courant déclare 15 000 chaînes et parfois
 * 50 000 films, répartis en 150 à 300 catégories. La très grande
 * majorité est dans des langues que l'utilisateur ne lit pas.
 *
 * Tout télécharger coûte trois fois :
 *   - une synchronisation interminable au premier ajout ;
 *   - une mémoire saturée sur un appareil modeste (Fire TV Stick) ;
 *   - une recherche noyée, où « TF1 » sort derrière quarante homonymes.
 *
 * ─── Le principe ───────────────────────────────────────────────────
 *
 * On récupère d'abord les **catégories seules** — trois petites
 * réponses JSON, quelques kilo-octets. L'utilisateur coche. On ne
 * télécharge ensuite que le contenu coché.
 *
 * Ce fichier ne contient que des **fonctions pures** : elles calculent
 * un résultat à partir de leurs arguments, sans réseau, sans état
 * global, sans horloge. C'est ce qui les rend vérifiables par des
 * tests rapides et fiables.
 */

import type { XtreamCategory } from './xtreamService';

/**
 * Les trois familles de contenu d'un portail Xtream.
 *
 * `vod` signifie *Video On Demand* : c'est le nom que l'API donne aux
 * films. On conserve le terme de l'API dans le code technique pour que
 * la correspondance avec `get_vod_categories` reste évidente ;
 * l'interface, elle, affiche « Films ».
 */
export const CATEGORY_KINDS = ['live', 'vod', 'series'] as const;

export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/**
 * Ce que l'utilisateur a coché, par famille.
 *
 * Un tableau **vide** signifie « aucune catégorie de cette famille ».
 * C'est un choix légitime : beaucoup d'abonnements n'ont pas de films.
 *
 * L'absence totale de sélection sur une source — le champ non
 * renseigné — signifie « tout », et se traite en amont : voir
 * `selectionOrAll`. Cette distinction compte pour les sources créées
 * avant l'arrivée de cette fonctionnalité, qui doivent continuer à
 * fonctionner exactement comme avant.
 */
export interface CategorySelection {
  live: string[];
  vod: string[];
  series: string[];
}

/** Les catégories proposées par le serveur, par famille. */
export interface CategoryCatalog {
  live: XtreamCategory[];
  vod: XtreamCategory[];
  series: XtreamCategory[];
}

/** Une sélection où rien n'est coché. État de départ de l'écran. */
export function emptySelection(): CategorySelection {
  return { live: [], vod: [], series: [] };
}

/** Un catalogue vide, utile comme état initial avant chargement. */
export function emptyCatalog(): CategoryCatalog {
  return { live: [], vod: [], series: [] };
}

/**
 * Nombre total de catégories cochées, toutes familles confondues.
 *
 * Sert à afficher « 12 catégories sélectionnées » et à décider si le
 * bouton d'import est actif.
 */
export function countSelected(selection: CategorySelection): number {
  return selection.live.length + selection.vod.length + selection.series.length;
}

/** Vrai quand rien n'est coché — l'import doit alors être refusé. */
export function isSelectionEmpty(selection: CategorySelection): boolean {
  return countSelected(selection) === 0;
}

/** Vrai si cette catégorie précise est cochée. */
export function isCategorySelected(
  selection: CategorySelection,
  kind: CategoryKind,
  categoryId: string
): boolean {
  return selection[kind].includes(categoryId);
}

/**
 * Coche ou décoche une catégorie.
 *
 * Renvoie une **nouvelle** sélection au lieu de modifier celle reçue.
 * React ne redessine l'écran que s'il constate un changement d'objet :
 * modifier le tableau sur place laisserait l'affichage figé, case
 * cochée dans les données mais pas à l'écran.
 */
export function toggleCategory(
  selection: CategorySelection,
  kind: CategoryKind,
  categoryId: string
): CategorySelection {
  const current = selection[kind];
  const next = current.includes(categoryId)
    ? current.filter((id) => id !== categoryId)
    : [...current, categoryId];

  return { ...selection, [kind]: next };
}

/**
 * Coche ou décoche un lot de catégories d'un coup.
 *
 * Utilisé par « Tout sélectionner » et par les en-têtes de groupe.
 * `checked` décide du sens : on ajoute ce qui manque, ou on retire ce
 * qui est présent. Les doublons sont impossibles par construction.
 */
export function setCategories(
  selection: CategorySelection,
  kind: CategoryKind,
  categoryIds: string[],
  checked: boolean
): CategorySelection {
  const current = selection[kind];

  if (!checked) {
    const removed = new Set(categoryIds);
    return { ...selection, [kind]: current.filter((id) => !removed.has(id)) };
  }

  const known = new Set(current);
  const added = categoryIds.filter((id) => !known.has(id));
  return added.length === 0 ? selection : { ...selection, [kind]: [...current, ...added] };
}

/**
 * Retire de la sélection les catégories que le serveur ne propose plus.
 *
 * Un fournisseur renomme et renumérote ses catégories sans prévenir.
 * Sans ce nettoyage, une sélection enregistrée il y a six mois
 * demanderait des identifiants disparus : le serveur répondrait par des
 * listes vides et l'utilisateur croirait son abonnement cassé.
 *
 * On nettoie donc au moment où l'on connaît la liste réelle, c'est-à-dire
 * juste après avoir rechargé les catégories.
 */
export function reconcileSelection(
  selection: CategorySelection,
  catalog: CategoryCatalog
): CategorySelection {
  const keep = (ids: string[], available: XtreamCategory[]) => {
    const known = new Set(available.map((c) => c.categoryId));
    return ids.filter((id) => known.has(id));
  };

  return {
    live: keep(selection.live, catalog.live),
    vod: keep(selection.vod, catalog.vod),
    series: keep(selection.series, catalog.series),
  };
}

/**
 * Relit une sélection venant du disque.
 *
 * Ce qui a été enregistré par une version précédente de l'application,
 * ou modifié à la main dans le stockage du navigateur, n'est pas
 * garanti d'avoir la bonne forme. On ne fait donc jamais confiance :
 * on garde les chaînes de caractères non vides, on écarte le reste, on
 * supprime les doublons.
 *
 * Renvoie `null` quand il n'y a rien d'exploitable — ce qui signifie
 * « pas de sélection », donc « tout », et non « rien ».
 */
export function normalizeSelection(raw: unknown): CategorySelection | null {
  if (raw === null || typeof raw !== 'object') return null;

  const source = raw as Record<string, unknown>;
  const result = emptySelection();
  let found = false;

  for (const kind of CATEGORY_KINDS) {
    const value = source[kind];
    if (!Array.isArray(value)) continue;

    found = true;
    const seen = new Set<string>();
    for (const item of value) {
      if (typeof item !== 'string' || item.length === 0) continue;
      if (seen.has(item)) continue;
      seen.add(item);
      result[kind].push(item);
    }
  }

  return found ? result : null;
}

/**
 * Traduit une sélection en liste d'identifiants à demander au serveur.
 *
 * Renvoie `undefined` quand il faut tout demander : c'est exactement ce
 * qu'attend `getLiveStreams(creds, undefined)`, dont le second argument
 * optionnel signifie déjà « sans filtre de catégorie ». Le code d'appel
 * n'a donc aucun cas particulier à écrire.
 */
export function selectionOrAll(
  selection: CategorySelection | null | undefined,
  kind: CategoryKind
): string[] | undefined {
  if (!selection) return undefined;
  return selection[kind];
}

/**
 * Ajoute les sous-catégories des parents cochés.
 *
 * Xtream expose `parent_id` : une « grande famille » (France, Sport)
 * n'a souvent aucun flux, ce sont les enfants qui portent les chaînes.
 * Cocher le parent sans eux laissait des rubriques vides.
 *
 * `undefined` (tout télécharger) et `[]` (rien) restent inchangés.
 */
export function expandWithChildren(
  ids: string[] | undefined,
  categories: XtreamCategory[]
): string[] | undefined {
  if (ids === undefined) return undefined;
  if (ids.length === 0) return ids;

  const selected = new Set(ids);
  const selectedNums = new Set<number>();
  for (const id of ids) {
    const n = Number(id);
    if (Number.isFinite(n)) selectedNums.add(n);
  }

  let added = true;
  while (added) {
    added = false;
    for (const category of categories) {
      if (selected.has(category.categoryId)) continue;
      if (category.parentId === 0) continue;
      if (!selectedNums.has(category.parentId)) continue;
      selected.add(category.categoryId);
      const n = Number(category.categoryId);
      if (Number.isFinite(n)) selectedNums.add(n);
      added = true;
    }
  }

  return [...selected];
}

// ─────────────────────────────────────────────────────────────────────
// Recherche et regroupement
// ─────────────────────────────────────────────────────────────────────

/**
 * Prépare un texte pour la comparaison.
 *
 * `normalize('NFD')` sépare une lettre accentuée en deux caractères :
 * « é » devient « e » suivi d'une marque d'accent. La seconde étape
 * supprime ces marques. Résultat : chercher « cinema » trouve
 * « Cinéma », ce qu'une comparaison brute ne ferait pas.
 */
function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtre des catégories sur un texte libre.
 *
 * Une requête vide rend la liste inchangée — et le **même** tableau, ce
 * qui évite à React de redessiner une liste de 300 lignes à chaque
 * frappe dans un champ qu'on vient de vider.
 */
export function filterCategories(
  categories: XtreamCategory[],
  query: string
): XtreamCategory[] {
  const needle = foldText(query);
  if (needle.length === 0) return categories;
  return categories.filter((c) => foldText(c.categoryName).includes(needle));
}

/**
 * Devine le préfixe de langue ou de pays d'un nom de catégorie.
 *
 * Les fournisseurs préfixent presque toujours : « FR | TF1 HD »,
 * « AR Sport HD », « US- Movies ». Repérer ce préfixe permet d'offrir
 * « tout cocher pour FR », qui est le geste réellement utile quand 90 %
 * du catalogue est dans une langue inutile.
 *
 * On reste volontairement prudent : un préfixe est un mot de 2 à 4
 * caractères, en majuscules ou en chiffres, placé en tête. « Cinéma
 * Français » n'en a donc pas, et c'est voulu — mieux vaut ne rien
 * proposer que d'inventer un regroupement faux.
 *
 * Renvoie `null` quand aucun préfixe crédible ne se dégage.
 */
export function categoryPrefix(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;

  // Le premier mot, quel que soit le séparateur employé par le portail.
  const match = /^([^\s|:\-–—]+)/.exec(trimmed);
  if (!match) return null;

  const token = match[1];
  if (token.length < 2 || token.length > 4) return null;

  // Majuscules et chiffres seulement : « The » ou « Les » ne sont pas
  // des codes de pays, et les regrouper n'aurait aucun sens.
  if (!/^[A-Z0-9]+$/.test(token)) return null;

  // Un préfixe purement numérique désigne un numéro, pas une langue.
  if (/^[0-9]+$/.test(token)) return null;

  // Le nom doit contenir autre chose que son préfixe : une catégorie
  // qui s'appelle « VIP » tout court n'est pas un groupe.
  if (trimmed.length === token.length) return null;

  return token;
}

/** Un groupe de catégories partageant le même préfixe. */
export interface CategoryGroup {
  /** `null` pour le groupe fourre-tout des noms sans préfixe. */
  prefix: string | null;
  categories: XtreamCategory[];
}

/**
 * Range des catégories par préfixe, en préservant l'ordre du serveur.
 *
 * L'ordre est celui de première apparition, jamais l'ordre
 * alphabétique : un fournisseur place en tête ce qu'il juge important,
 * et bousculer ce classement dessert l'utilisateur. Le groupe sans
 * préfixe est renvoyé en dernier.
 *
 * Un groupe d'une seule catégorie n'en est pas un : ses membres
 * rejoignent le fourre-tout, sinon l'écran afficherait des dizaines
 * d'en-têtes ne couvrant qu'une ligne chacune.
 */
function sortByName(list: XtreamCategory[]): XtreamCategory[] {
  return [...list].sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: 'base' })
  );
}

/**
 * Regroupe par parent Xtream (`parent_id`) quand le portail en envoie.
 *
 * Beaucoup de panneaux exposent une famille (« France », « Sport »)
 * puis des enfants qui portent vraiment les chaînes / films. Sans ça,
 * parents et enfants se mélangent en une liste plate mal triée.
 */
function groupByParent(categories: XtreamCategory[]): CategoryGroup[] | null {
  const byNumericId = new Map<number, XtreamCategory>();
  for (const category of categories) {
    const id = Number(category.categoryId);
    if (Number.isFinite(id)) byNumericId.set(id, category);
  }

  const children = new Map<number, XtreamCategory[]>();
  const roots: XtreamCategory[] = [];
  let nested = 0;

  for (const category of categories) {
    if (category.parentId > 0 && byNumericId.has(category.parentId)) {
      const bucket = children.get(category.parentId) ?? [];
      bucket.push(category);
      children.set(category.parentId, bucket);
      nested += 1;
    } else {
      roots.push(category);
    }
  }

  if (nested === 0) return null;

  const groups: CategoryGroup[] = [];
  const loose: XtreamCategory[] = [];

  for (const root of roots) {
    const id = Number(root.categoryId);
    const kids = (Number.isFinite(id) ? children.get(id) : undefined) ?? [];
    if (kids.length === 0) {
      loose.push(root);
      continue;
    }
    groups.push({ prefix: root.categoryName, categories: sortByName(kids) });
  }

  if (loose.length > 0) groups.push({ prefix: null, categories: sortByName(loose) });
  return groups;
}

function groupByPrefix(categories: XtreamCategory[]): CategoryGroup[] {
  const byPrefix = new Map<string, XtreamCategory[]>();
  const loose: XtreamCategory[] = [];
  const order: string[] = [];

  for (const category of categories) {
    const prefix = categoryPrefix(category.categoryName);
    if (prefix === null) {
      loose.push(category);
      continue;
    }
    const bucket = byPrefix.get(prefix);
    if (bucket) {
      bucket.push(category);
    } else {
      byPrefix.set(prefix, [category]);
      order.push(prefix);
    }
  }

  const groups: CategoryGroup[] = [];
  const orphans: XtreamCategory[] = [];

  for (const prefix of order) {
    const bucket = byPrefix.get(prefix) ?? [];
    if (bucket.length > 1) {
      groups.push({ prefix, categories: sortByName(bucket) });
    } else {
      orphans.push(...bucket);
    }
  }

  const rest = sortByName([...loose, ...orphans]);
  if (rest.length > 0) groups.push({ prefix: null, categories: rest });
  return groups;
}

export function groupCategories(categories: XtreamCategory[]): CategoryGroup[] {
  return groupByParent(categories) ?? groupByPrefix(categories);
}

// ─────────────────────────────────────────────────────────────────────
// Téléchargement par lots
// ─────────────────────────────────────────────────────────────────────

/**
 * Exécute des tâches en limitant le nombre de requêtes simultanées.
 *
 * Demander 40 catégories à la fois ferait ouvrir 40 connexions au
 * portail. Beaucoup limitent les connexions par compte et refuseraient
 * — ou pire, compteraient cela comme un partage d'abonnement. Les
 * lancer une par une, à l'inverse, additionnerait 40 fois la latence.
 *
 * On garde donc `limit` tâches en vol : dès que l'une finit, la
 * suivante part. L'ordre des résultats correspond à l'ordre des
 * tâches, indépendamment de leur ordre d'arrivée.
 *
 * Le premier échec interrompt l'ensemble, `Promise.all` s'en chargeant.
 * C'est le comportement voulu : un portail qui refuse une requête
 * refusera les suivantes, et insister n'aiderait personne.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  const width = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  const runner = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: width }, runner));

  return results;
}
