/**
 * Logique du sélecteur de chaînes affiché par-dessus le lecteur.
 *
 * Fonctions pures, sans React ni DOM : elles se testent sans navigateur
 * et se relisent sans suivre le fil d'un composant.
 *
 * Le panneau superpose deux colonnes à la vidéo — catégories à gauche,
 * chaînes à droite. Il ne touche jamais à l'élément `<video>` : la
 * lecture continue derrière lui, y compris pendant le défilement.
 */

import type { LiveCategory, LiveChannel } from '@/types';

/**
 * Rubrique « Toutes les chaînes ».
 *
 * Une chaîne de caractères impossible à confondre avec un identifiant
 * de catégorie réel. Le même motif est déjà employé ailleurs dans le
 * projet : une sentinelle plutôt qu'un `null`, pour que la valeur
 * traverse sans encombre les attributs HTML, qui ne transportent que du
 * texte.
 */
export const ALL_CATEGORIES = '__all__';

/** Une rubrique de la colonne de gauche. */
export interface BrowserCategory {
  /** `ALL_CATEGORIES` ou l'identifiant réel de la catégorie. */
  id: string;
  name: string;
  /** Nombre de chaînes réellement présentes dans le catalogue. */
  count: number;
}

/**
 * Construit la colonne de gauche.
 *
 * Les comptes sont recalculés à partir des chaînes présentes, jamais
 * repris du champ `channelCount` de la catégorie : celui-ci vient du
 * serveur et peut annoncer des chaînes qui n'ont pas été téléchargées,
 * notamment depuis la sélection par catégories. Un compte qui ne
 * correspond pas à ce que la liste affiche est pire que pas de compte.
 *
 * Une catégorie sans aucune chaîne est écartée : elle n'ouvrirait
 * qu'une colonne vide.
 */
export function buildCategoryList(
  channels: LiveChannel[],
  categories: LiveCategory[],
  allLabel: string
): BrowserCategory[] {
  const counts = new Map<string, number>();
  for (const channel of channels) {
    if (!channel.categoryId) continue;
    counts.set(channel.categoryId, (counts.get(channel.categoryId) ?? 0) + 1);
  }

  const known = categories
    .filter((category) => (counts.get(category.id) ?? 0) > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      count: counts.get(category.id) ?? 0,
    }));

  /*
    Chaînes sans catégorie, ou rattachées à une catégorie absente du
    catalogue. Sans ce rattrapage, elles ne seraient joignables que par
    « Toutes les chaînes » — et invisibles dès qu'une rubrique est
    ouverte. Les listes M3U, souvent sans catégories propres, tombent
    entièrement dans ce cas.
  */
  const knownIds = new Set(categories.map((c) => c.id));
  const orphans = channels.filter(
    (channel) => !channel.categoryId || !knownIds.has(channel.categoryId)
  ).length;

  const list: BrowserCategory[] = [
    { id: ALL_CATEGORIES, name: allLabel, count: channels.length },
    ...known,
  ];

  if (orphans > 0) {
    // Placé en dernier : c'est un fourre-tout, pas un choix éditorial.
    list.push({ id: '__uncategorized__', name: '', count: orphans });
  }

  return list;
}

/** Identifiant du fourre-tout, exporté pour que l'affichage le nomme. */
export const UNCATEGORIZED = '__uncategorized__';

/**
 * Filtre la colonne de droite.
 *
 * La recherche l'emporte sur la catégorie : chercher « bein » alors
 * qu'une rubrique est ouverte doit trouver la chaîne où qu'elle soit.
 * L'inverse obligerait à revenir à « Toutes les chaînes » avant chaque
 * recherche, ce qui est le contraire de ce qu'on attend d'un champ de
 * recherche.
 */
export function filterChannels(
  channels: LiveChannel[],
  categoryId: string,
  query: string
): LiveChannel[] {
  const trimmed = query.trim().toLowerCase();

  if (trimmed) {
    return channels.filter((channel) => channel.name.toLowerCase().includes(trimmed));
  }

  if (categoryId === ALL_CATEGORIES) return channels;

  if (categoryId === UNCATEGORIZED) {
    const knownIds = new Set(
      channels.map((c) => c.categoryId).filter((id): id is string => Boolean(id))
    );
    return channels.filter((channel) => !channel.categoryId || !knownIds.has(channel.categoryId));
  }

  return channels.filter((channel) => channel.categoryId === categoryId);
}

/**
 * Catégorie à ouvrir à l'affichage du panneau.
 *
 * On se place sur la rubrique de la chaîne en cours plutôt qu'en tête
 * de liste : l'utilisateur qui ouvre le sélecteur cherche le plus
 * souvent une chaîne voisine de celle qu'il regarde. Le renvoyer sur
 * « Toutes les chaînes » l'obligerait à retrouver sa rubrique parmi
 * cent autres à chaque ouverture.
 */
export function initialCategory(
  currentChannel: LiveChannel | undefined,
  categories: BrowserCategory[]
): string {
  const categoryId = currentChannel?.categoryId;
  if (categoryId && categories.some((c) => c.id === categoryId)) {
    return categoryId;
  }
  return ALL_CATEGORIES;
}
