import type { EPGProgram } from '@/types';
import { findCurrentAndNext, programProgressPercent } from '@/services/epg/epgSync';

/**
 * Bandeau EPG du lecteur : ce que l'écran affiche, déjà mis en forme.
 *
 * Le composant ne doit pas manipuler de dates. Il reçoit des chaînes
 * prêtes à poser et un pourcentage, ce qui rend cette logique testable
 * sans monter le lecteur, et évite qu'un calcul d'horaire se retrouve
 * dupliqué entre la barre du haut et celle du bas.
 */
export interface PlayerEpgView {
  /** Titre de l'émission en cours. */
  title: string;
  /** Heure de début, format local court : « 20:00 ». */
  startLabel: string;
  /** Heure de fin, format local court : « 20:45 ». */
  endLabel: string;
  /** Avancement de 0 à 100, pour la barre de progression. */
  percent: number;
  /**
   * Minutes restantes, `null` si l'information n'est pas exploitable.
   *
   * Distinct de zéro : « encore 0 min » serait faux, alors que l'absence
   * de valeur fait simplement disparaître la mention.
   */
  remainingMinutes: number | null;
  /** Titre de l'émission suivante, `null` si le guide s'arrête là. */
  nextTitle: string | null;
  /** Heure de début de la suivante, `null` de même. */
  nextStartLabel: string | null;
}

/**
 * Heure locale sur deux chiffres.
 *
 * La langue de l'interface décide du format : un anglophone attend
 * « 8:45 PM » là où un francophone lit « 20:45 ». Une date illisible
 * renvoie une chaîne vide plutôt que « Invalid Date ».
 */
export function formatClockTime(iso: string, locale: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Minutes restantes avant la fin, arrondies au supérieur.
 *
 * Arrondi vers le haut car il reste bien « 1 min » tant que la seconde
 * finale n'est pas passée ; arrondir vers le bas afficherait « 0 min »
 * pendant cinquante-neuf secondes.
 */
export function remainingMinutes(
  program: EPGProgram,
  now: Date = new Date()
): number | null {
  const stop = Date.parse(program.stop);
  if (Number.isNaN(stop)) return null;

  const diff = stop - now.getTime();
  if (diff <= 0) return null;

  return Math.ceil(diff / 60000);
}

/**
 * Assemble le bandeau, ou `null` quand il n'y a rien à montrer.
 *
 * Renvoyer `null` est le cas courant, pas une erreur : beaucoup de
 * listes n'embarquent aucun guide. Le lecteur retombe alors sur son
 * affichage habituel, sans ligne vide ni barre à zéro.
 */
export function buildPlayerEpgView(
  programs: EPGProgram[],
  channelId: string,
  locale: string,
  now: Date = new Date()
): PlayerEpgView | null {
  if (!channelId) return null;

  const { current, next } = findCurrentAndNext(programs, channelId, now);
  if (!current) return null;

  const percent = programProgressPercent(current, now);
  if (percent === undefined) return null;

  return {
    title: current.title,
    startLabel: formatClockTime(current.start, locale),
    endLabel: formatClockTime(current.stop, locale),
    percent,
    remainingMinutes: remainingMinutes(current, now),
    nextTitle: next?.title ?? null,
    nextStartLabel: next ? formatClockTime(next.start, locale) : null,
  };
}


/**
 * Resume d'une ligne du panneau de zapping.
 *
 * Volontairement plus maigre que `PlayerEpgView` : dans une liste on
 * lit le titre et le temps restant, pas les horaires exacts.
 */
export interface ChannelEpgSummary {
  /** Titre de l'emission en cours. */
  title: string;
  /** Avancement de 0 a 100, pour la mini-barre. */
  percent: number;
  /** Minutes restantes, `null` si la donnee n'est pas exploitable. */
  remainingMinutes: number | null;
}

/**
 * Resume EPG de plusieurs chaines d'un coup.
 *
 * Interroger le guide chaine par chaine reviendrait a parcourir tout le
 * tableau des programmes autant de fois qu'il y a de lignes affichees.
 * Sur une liste de plusieurs centaines de chaines et des milliers de
 * programmes, ce produit se paie a chaque rendu du panneau.
 *
 * Une seule passe suffit : on ne retient que le programme dont la plage
 * horaire contient l'instant demande, chaine par chaine. Les autres
 * sont ecartes au vol, sans tri ni tableau intermediaire.
 *
 * Les chaines sans programme en cours sont absentes du resultat plutot
 * qu'associees a `null` : l'appelant teste la presence, pas la valeur.
 */
export function buildChannelEpgMap(
  programs: EPGProgram[],
  now: Date = new Date()
): Map<string, ChannelEpgSummary> {
  const nowMs = now.getTime();
  const result = new Map<string, ChannelEpgSummary>();

  for (const program of programs) {
    // Une chaine n'a qu'une emission a l'antenne : des qu'elle est
    // trouvee, les programmes suivants de cette chaine sont inutiles.
    if (result.has(program.channelId)) continue;

    const start = Date.parse(program.start);
    const stop = Date.parse(program.stop);
    if (Number.isNaN(start) || Number.isNaN(stop) || stop <= start) continue;
    if (start > nowMs || stop <= nowMs) continue;

    result.set(program.channelId, {
      title: program.title,
      percent: Math.min(100, Math.max(0, Math.round(((nowMs - start) / (stop - start)) * 100))),
      remainingMinutes: remainingMinutes(program, now),
    });
  }

  return result;
}
