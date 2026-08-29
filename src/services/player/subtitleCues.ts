/**
 * Récupération des répliques de sous-titres.
 *
 * ─── Le passage au rendu maison ─────────────────────────────────────
 *
 * Tant que hls.js rend les sous-titres nativement, les répliques
 * appartiennent au navigateur : personne ne peut les lire pour les
 * redessiner à sa façon. En passant `renderTextTracksNatively: false`,
 * hls.js ne crée plus de `<track>` visible et émet chaque réplique via
 * l'événement `CUES_PARSED`. C'est ce que ce module écoute pour tenir
 * une liste de répliques, que le calque `SubtitleOverlay` peindra.
 *
 * Confirmé dans hls.js 1.7.1 (node_modules) :
 *   `Events.CUES_PARSED = 'hlsCuesParsed'` ;
 *   `CuesParsedData = { type, cues, track, subtitleTrack }` ;
 *   `renderTextTracksNatively` vit dans `TimelineControllerConfig`.
 *
 * ─── Où s'applique le rendu custom ─────────────────────────────────
 *
 * Seul hls.js nous garantit une collecte exploitable, car c'est lui qui
 * parse les répliques et nous les tend. La lecture native (Safari, MP4)
 * laisse le navigateur assurer son propre rendu : y superposer le nôtre
 * afficherait chaque réplique deux fois. `mpegts.js` n'expose rien du
 * tout. `playbackEngine` ne fournit donc cette source qu'au cas hls.js.
 */

/** Une réplique prête à peindre, indépendante du moteur d'origine. */
export interface SubtitleCue {
  /** Début d'affichage, en secondes depuis le début du flux. */
  start: number;
  /** Fin d'affichage, en secondes. */
  end: number;
  /** Texte, lignes séparées par `\n`. */
  text: string;
}

/** Ce que l'écran lit pour décider quoi peindre. */
export interface SubtitleSnapshot {
  /** Répliques actuellement connues, dans l'ordre chronologique. */
  cues: SubtitleCue[];
  /**
   * Vrai si une piste de sous-titres est sélectionnée, donc si
   * `SubtitleOverlay` doit s'afficher.
   */
  active: boolean;
}

export type SubtitleListener = () => void;

export interface SubtitleSource {
  read: () => SubtitleSnapshot;
  subscribe: (listener: SubtitleListener) => () => void;
}

/**
 * Nettoie le texte brut d'une réplique WebVTT ou SRT.
 *
 * Les répliques transportent du balisage (`<v Speaker>`, `<i>`,
 * `<c.wrap>`, `<br>`). On garde les retours à la ligne et on retire le
 * reste : les balises de voix ne seraient pas rendues par notre calque,
 * et les insérer telles quelles dans le DOM serait risqué.
 */
export function cleanCueText(text: string): string {
  return (text ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u200b/g, '')
    .trim();
}

/** Vrai si la réplique doit être visible à l'instant donné. */
export function isCueActive(cue: SubtitleCue, time: number): boolean {
  return time >= cue.start && time < cue.end;
}

/** Forme minimale d'une instance hls.js, sans l'importer. */
export interface SubtitleHlsLike {
  subtitleTrack: number;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  off: (event: string, listener: (...args: unknown[]) => void) => void;
}

/**
 * Source construite sur une instance hls.js.
 *
 * Les répliques arrivent par paquets, à mesure que les segments sont
 * lus. On les ajoute à un tampon, en ignorant les doublons — hls.js
 * peut réémettre un segment lors d'une lecture arrière. Le tampon est
 * borné : sur un direct long, les répliques anciennes ne servent plus
 * et ne feraient que grossir la mémoire.
 */
export function hlsSubtitleSource(hls: SubtitleHlsLike): SubtitleSource {
  let buffer: SubtitleCue[] = [];

  const read = (): SubtitleSnapshot => ({
    cues: buffer,
    active: hls.subtitleTrack >= 0,
  });

  const subscribe = (listener: SubtitleListener) => {
    const onCuesParsed = (_data: unknown, payload: CuesParsed) => {
      const cues = payload?.cues;
      if (!Array.isArray(cues)) return;
      for (const cue of cues) {
        const text = cleanCueText(cue?.text ?? '');
        if (!text) continue;
        if (
          buffer.some(
            (c) => c.start === cue.startTime && c.end === cue.endTime && c.text === text
          )
        ) {
          continue;
        }
        buffer.push({
          start: Number(cue.startTime) || 0,
          end: Number(cue.endTime) || 0,
          text,
        });
      }
      // Garde-fou mémoire : on ne garde que les dernières répliques.
      if (buffer.length > 1000) buffer = buffer.slice(-1000);
      listener();
    };

    // Changer de piste invalide les répliques précédentes : on vide le
    // tampon pour ne pas afficher du français sur une piste anglaise.
    const onTrackSwitched = () => {
      buffer = [];
      listener();
    };

    const onTracksUpdated = () => listener();

    hls.on(HLS_EVENT.CUES_PARSED, onCuesParsed as never);
    hls.on(HLS_EVENT.SUBTITLE_TRACK_SWITCH, onTrackSwitched);
    hls.on(HLS_EVENT.SUBTITLE_TRACKS_UPDATED, onTracksUpdated);

    return () => {
      hls.off(HLS_EVENT.CUES_PARSED, onCuesParsed as never);
      hls.off(HLS_EVENT.SUBTITLE_TRACK_SWITCH, onTrackSwitched);
      hls.off(HLS_EVENT.SUBTITLE_TRACKS_UPDATED, onTracksUpdated);
    };
  };

  return { read, subscribe };
}

/** Forme de `CuesParsedData`, décrite pour ne pas importer hls.js. */
interface CuesParsed {
  cues?: Array<{ startTime: number; endTime: number; text: string }>;
}

/** Noms d'événements hls.js, en clair pour éviter l'import. */
const HLS_EVENT = {
  CUES_PARSED: 'hlsCuesParsed',
  SUBTITLE_TRACK_SWITCH: 'hlsSubtitleTrackSwitch',
  SUBTITLE_TRACKS_UPDATED: 'hlsSubtitleTracksUpdated',
} as const;
