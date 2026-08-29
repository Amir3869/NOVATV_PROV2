/**
 * Enchaînement des épisodes d'une série.
 *
 * Isolé du lecteur, et volontairement sans aucune dépendance à React ni
 * au store : c'est du calcul pur sur une liste d'épisodes. La raison est
 * concrète — ce code déclenche une navigation, et une erreur de tri
 * ferait reboucler le lecteur sur l'épisode qu'on vient de finir. Une
 * fonction pure se prouve par des tests, un effet enfoui dans un
 * composant ne se prouve pas.
 */

import type { Episode } from '@/types';

/**
 * Ordonne deux épisodes : saison d'abord, numéro d'épisode ensuite.
 *
 * Le catalogue arrive dans l'ordre du serveur, qui n'est pas garanti.
 * Un portail Xtream renvoie couramment les épisodes triés par
 * identifiant interne, ce qui mélange les saisons.
 */
function compareEpisodes(a: Episode, b: Episode): number {
  if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
  return a.episodeNumber - b.episodeNumber;
}

/**
 * Épisodes d'une série, triés dans l'ordre de diffusion.
 *
 * Les épisodes spéciaux portent souvent la saison 0 chez les portails
 * Xtream (« Specials »). Ils sont conservés : les exclure d'office
 * priverait l'utilisateur d'un contenu qu'il voit pourtant dans la
 * fiche de la série. Ils passent simplement en tête, saison 0 oblige.
 */
export function sortedEpisodesOf(episodes: Episode[], seriesId: string): Episode[] {
  return episodes.filter((e) => e.seriesId === seriesId).sort(compareEpisodes);
}

/**
 * Épisode suivant celui qui vient de se terminer.
 *
 * Renvoie `null` quand il n'y a pas de suite : dernier épisode de la
 * dernière saison, épisode introuvable dans le catalogue, ou série sans
 * autre épisode. Le lecteur doit alors s'arrêter, jamais reboucler.
 *
 * Le passage d'une saison à l'autre est implicite : la liste étant
 * triée, l'élément qui suit le dernier épisode d'une saison est le
 * premier de la saison suivante.
 */
export function findNextEpisode(
  episodes: Episode[],
  currentEpisodeId: string
): Episode | null {
  const current = episodes.find((e) => e.id === currentEpisodeId);
  if (!current) return null;

  const ordered = sortedEpisodesOf(episodes, current.seriesId);
  const index = ordered.findIndex((e) => e.id === currentEpisodeId);
  if (index === -1) return null;

  // Deux épisodes peuvent porter le même numéro dans un catalogue mal
  // rempli. On avance sur la POSITION dans la liste triée, pas sur le
  // numéro : chercher « numéro + 1 » tournerait en rond sur un doublon.
  return ordered[index + 1] ?? null;
}

/**
 * Y a-t-il une suite à proposer ?
 *
 * Sépare la question « existe-t-il un épisode suivant » de la décision
 * « faut-il l'enchaîner », qui dépend du réglage utilisateur. Le lecteur
 * a besoin des deux séparément : il propose le bouton même quand
 * l'enchaînement automatique est désactivé.
 */
export function hasNextEpisode(episodes: Episode[], currentEpisodeId: string): boolean {
  return findNextEpisode(episodes, currentEpisodeId) !== null;
}

/**
 * Faut-il enchaîner automatiquement ?
 *
 * Un épisode terminé n'est pas la seule fin de lecture possible : un
 * film aussi se termine, et n'a pas de suite. Le type du média est donc
 * vérifié ici plutôt que dans le composant, où l'oubli serait invisible.
 */
export function shouldAutoAdvance(
  mediaType: 'live' | 'movie' | 'episode' | null,
  autoNextEpisode: boolean,
  next: Episode | null
): boolean {
  return mediaType === 'episode' && autoNextEpisode && next !== null;
}

/** Libellé court d'un épisode, du type « S02E05 ». */
export function episodeCode(episode: Episode): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `S${pad(episode.seasonNumber)}E${pad(episode.episodeNumber)}`;
}
