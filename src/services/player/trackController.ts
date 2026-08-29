/**
 * Sélection des pistes audio et des sous-titres.
 *
 * Chaque moteur de lecture expose ses pistes à sa façon. Ce fichier
 * ramène les trois cas à une seule interface, pour que l'écran du
 * lecteur n'ait pas à savoir lequel tourne.
 *
 * État du support, vérifié dans les fichiers de types installés :
 *
 * | Moteur     | Audio | Sous-titres |
 * |------------|-------|-------------|
 * | hls.js     | oui   | oui         |
 * | natif      | selon | oui         |
 * | mpegts.js  | non   | non         |
 *
 * `mpegts.js` ne propose **rien** : son interface `Player` n'a ni
 * `audioTracks` ni équivalent. Le flux est démultiplexé puis remis à la
 * balise vidéo sous forme d'un seul train audio. Ce n'est pas un oubli
 * de notre part, c'est une limite de la bibliothèque — l'écran retire
 * donc le bouton au lieu de l'afficher inerte.
 *
 * Le cas natif dépend du navigateur : `HTMLMediaElement.audioTracks`
 * n'est implémenté que par Safari. Ailleurs on ne propose que les
 * sous-titres, qui reposent sur `textTracks`, largement disponible.
 */

export type TrackKind = 'audio' | 'subtitle';

export interface MediaTrack {
  /** Identifiant stable pour la durée de la lecture. */
  id: string;
  /** Libellé prêt à afficher. */
  label: string;
  /** Code de langue brut, quand le flux le déclare. */
  lang?: string;
  kind: TrackKind;
}

export interface TrackController {
  audioTracks: MediaTrack[];
  subtitleTracks: MediaTrack[];
  /** Identifiant de la piste audio active, `null` si indéterminé. */
  activeAudioId: string | null;
  /** `null` signifie « sous-titres désactivés ». */
  activeSubtitleId: string | null;
  selectAudio: (id: string) => void;
  /** Passer `null` désactive les sous-titres. */
  selectSubtitle: (id: string | null) => void;
}

/**
 * Prévient l'écran quand les pistes changent.
 *
 * Indispensable : les pistes n'existent pas au moment où la vidéo est
 * attachée. Elles arrivent avec le manifeste, une à deux secondes plus
 * tard. Sans notification, le menu resterait vide jusqu'au prochain
 * rendu déclenché par autre chose.
 */
export type TrackListener = () => void;

export interface TrackSource {
  read: () => TrackController;
  subscribe: (listener: TrackListener) => () => void;
}

/**
 * Fabrique un libellé lisible.
 *
 * Les flux déclarent parfois un nom (« Français VFF »), parfois un
 * simple code de langue (« fra »), parfois rien du tout. On préfère le
 * nom, on convertit le code en nom de langue quand c'est possible, et
 * on retombe sur un numéro plutôt que d'afficher une ligne vide.
 *
 * `Intl.DisplayNames` traduit « fr » en « français » dans la langue de
 * l'interface. Il n'accepte que les codes à 2 ou 3 lettres, d'où le
 * filtre : un `name` mal rangé dans le champ `lang` le ferait échouer.
 */
export function trackLabel(
  index: number,
  kind: TrackKind,
  name?: string,
  lang?: string,
  locale = 'fr'
): string {
  const cleanName = name?.trim();
  if (cleanName) return cleanName;

  const cleanLang = lang?.trim();
  if (cleanLang && /^[a-z]{2,3}(-[a-zA-Z0-9]+)*$/i.test(cleanLang)) {
    try {
      const display = new Intl.DisplayNames([locale], { type: 'language' });
      const label = display.of(cleanLang);
      // `of` renvoie le code lui-même quand il ne le connaît pas.
      if (label && label.toLowerCase() !== cleanLang.toLowerCase()) return label;
    } catch {
      // `Intl.DisplayNames` manque sur les WebView anciennes.
    }
    return cleanLang;
  }

  // Numérotation à partir de 1 : « Piste 0 » n'a de sens que pour un
  // développeur.
  return kind === 'audio' ? `Audio ${index + 1}` : `Sous-titres ${index + 1}`;
}

/**
 * Ce dont nous avons besoin d'une instance hls.js.
 *
 * On décrit la forme au lieu d'importer le type : `hls.js` est chargé
 * par `import()` différé, et l'importer ici, même en `import type`,
 * suffirait à le faire entrer dans le paquet principal dans certaines
 * configurations. La forme reste vérifiée à l'appel.
 */
export interface HlsLike {
  audioTracks: Array<{ id?: number; name?: string; lang?: string }>;
  subtitleTracks: Array<{ id?: number; name?: string; lang?: string }>;
  audioTrack: number;
  subtitleTrack: number;
  on: (event: string, listener: () => void) => void;
  off: (event: string, listener: () => void) => void;
}

/** Noms d'événements hls.js, en clair pour éviter d'importer l'énumération. */
const HLS_TRACK_EVENTS = [
  'hlsAudioTracksUpdated',
  'hlsAudioTrackSwitched',
  'hlsSubtitleTracksUpdated',
  'hlsSubtitleTrackSwitch',
];

/**
 * Adapte hls.js.
 *
 * L'index dans le tableau sert d'identifiant, et non le champ `id` :
 * c'est cet index que `hls.audioTrack = n` attend. Les faire diverger
 * exposerait à sélectionner la mauvaise piste sur les flux où `id` ne
 * suit pas l'ordre du tableau.
 */
export function hlsTrackSource(hls: HlsLike, locale = 'fr'): TrackSource {
  const read = (): TrackController => {
    const audio = hls.audioTracks.map((t, i) => ({
      id: String(i),
      label: trackLabel(i, 'audio', t.name, t.lang, locale),
      lang: t.lang,
      kind: 'audio' as const,
    }));

    const subs = hls.subtitleTracks.map((t, i) => ({
      id: String(i),
      label: trackLabel(i, 'subtitle', t.name, t.lang, locale),
      lang: t.lang,
      kind: 'subtitle' as const,
    }));

    return {
      audioTracks: audio,
      subtitleTracks: subs,
      activeAudioId: hls.audioTrack >= 0 ? String(hls.audioTrack) : null,
      // hls.js code « aucun sous-titre » par -1.
      activeSubtitleId: hls.subtitleTrack >= 0 ? String(hls.subtitleTrack) : null,
      selectAudio: (id) => {
        const index = Number(id);
        if (Number.isInteger(index) && index >= 0 && index < hls.audioTracks.length) {
          hls.audioTrack = index;
        }
      },
      selectSubtitle: (id) => {
        if (id === null) {
          hls.subtitleTrack = -1;
          return;
        }
        const index = Number(id);
        if (Number.isInteger(index) && index >= 0 && index < hls.subtitleTracks.length) {
          hls.subtitleTrack = index;
        }
      },
    };
  };

  const subscribe = (listener: TrackListener) => {
    for (const event of HLS_TRACK_EVENTS) hls.on(event, listener);
    return () => {
      for (const event of HLS_TRACK_EVENTS) hls.off(event, listener);
    };
  };

  return { read, subscribe };
}

/**
 * Piste audio native, telle que Safari l'expose.
 *
 * `audioTracks` ne figure pas dans les types DOM standard parce que la
 * spécification a été retirée : seul Safari l'implémente. On décrit
 * donc la forme à la main, et on vérifie sa présence à l'exécution.
 */
interface NativeAudioTrack {
  id: string;
  label: string;
  language: string;
  enabled: boolean;
}

interface NativeAudioTrackList {
  length: number;
  [index: number]: NativeAudioTrack;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function nativeAudioList(video: HTMLVideoElement): NativeAudioTrackList | null {
  const list = (video as unknown as { audioTracks?: NativeAudioTrackList }).audioTracks;
  return list && typeof list.length === 'number' ? list : null;
}

/**
 * Adapte la balise vidéo elle-même.
 *
 * Sert à deux cas : la lecture MP4 directe, et le HLS lu nativement par
 * Safari — où hls.js n'est pas chargé et où les pistes ne sont donc
 * visibles que par la balise.
 */
export function nativeTrackSource(video: HTMLVideoElement, locale = 'fr'): TrackSource {
  const read = (): TrackController => {
    const audioList = nativeAudioList(video);
    const audio: MediaTrack[] = [];
    let activeAudioId: string | null = null;

    if (audioList) {
      for (let i = 0; i < audioList.length; i++) {
        const t = audioList[i];
        const id = t.id || String(i);
        audio.push({
          id,
          label: trackLabel(i, 'audio', t.label, t.language, locale),
          lang: t.language || undefined,
          kind: 'audio',
        });
        if (t.enabled) activeAudioId = id;
      }
    }

    const textTracks = video.textTracks;
    const subs: MediaTrack[] = [];
    let activeSubtitleId: string | null = null;

    for (let i = 0; i < textTracks.length; i++) {
      const t = textTracks[i];
      // `metadata` et `chapters` ne s'affichent pas : les proposer
      // donnerait des entrées de menu sans effet visible.
      if (t.kind !== 'subtitles' && t.kind !== 'captions') continue;

      const id = t.id || String(i);
      subs.push({
        id,
        label: trackLabel(i, 'subtitle', t.label, t.language, locale),
        lang: t.language || undefined,
        kind: 'subtitle',
      });
      if (t.mode === 'showing') activeSubtitleId = id;
    }

    return {
      audioTracks: audio,
      subtitleTracks: subs,
      activeAudioId,
      activeSubtitleId,
      selectAudio: (id) => {
        const list = nativeAudioList(video);
        if (!list) return;
        // Une seule piste active à la fois : on désactive tout, puis on
        // active la bonne. L'ordre inverse laisserait deux bandes son
        // superposées sur les implémentations permissives.
        for (let i = 0; i < list.length; i++) {
          list[i].enabled = (list[i].id || String(i)) === id;
        }
      },
      selectSubtitle: (id) => {
        for (let i = 0; i < video.textTracks.length; i++) {
          const t = video.textTracks[i];
          if (t.kind !== 'subtitles' && t.kind !== 'captions') continue;
          // `hidden` plutôt que `disabled` pour les pistes inactives :
          // `disabled` empêche le navigateur de charger le fichier, et
          // réactiver la piste imposerait alors un nouveau téléchargement.
          t.mode = (t.id || String(i)) === id ? 'showing' : 'hidden';
        }
      },
    };
  };

  const subscribe = (listener: TrackListener) => {
    const textTracks = video.textTracks;
    textTracks.addEventListener('addtrack', listener);
    textTracks.addEventListener('removetrack', listener);
    textTracks.addEventListener('change', listener);

    const audioList = nativeAudioList(video);
    audioList?.addEventListener?.('addtrack', listener);
    audioList?.addEventListener?.('change', listener);

    return () => {
      textTracks.removeEventListener('addtrack', listener);
      textTracks.removeEventListener('removetrack', listener);
      textTracks.removeEventListener('change', listener);
      audioList?.removeEventListener?.('addtrack', listener);
      audioList?.removeEventListener?.('change', listener);
    };
  };

  return { read, subscribe };
}

/**
 * Vrai s'il y a de quoi remplir un menu.
 *
 * Une seule piste audio et aucun sous-titre : le menu n'offrirait aucun
 * choix. Conformément à la doctrine retenue en Phase 4, le bouton est
 * alors retiré plutôt qu'affiché sans effet.
 */
export function hasSelectableTracks(controller: TrackController | null): boolean {
  if (!controller) return false;
  return controller.audioTracks.length > 1 || controller.subtitleTracks.length > 0;
}

/* ------------------------------------------------------------------ *
 * Sélection automatique au démarrage
 * ------------------------------------------------------------------ */

/**
 * Équivalences entre codes de langue.
 *
 * Une même langue se déclare de plusieurs façons dans les flux : le
 * français apparaît en `fr` (ISO 639-1), `fra` (639-2/T), `fre`
 * (639-2/B, la variante anglaise) ou `fr-FR`. Comparer les chaînes
 * telles quelles raterait la piste une fois sur deux.
 *
 * Seules les langues proposées par l'interface figurent ici : il ne
 * s'agit pas de reconstituer la norme complète, mais de couvrir les
 * choix réellement possibles.
 */
const LANGUAGE_ALIASES: Record<string, readonly string[]> = {
  fr: ['fr', 'fra', 'fre', 'french', 'francais', 'français'],
  en: ['en', 'eng', 'english', 'anglais'],
  es: ['es', 'spa', 'esl', 'spanish', 'espanol', 'español', 'espagnol'],
  ar: ['ar', 'ara', 'arabic', 'arabe'],
};

/**
 * Une piste correspond-elle à la langue demandée ?
 *
 * Le code d'une piste peut porter une région (`fr-FR`, `en-US`) : on ne
 * compare que la partie qui précède le tiret. Quand la piste ne déclare
 * aucun code, on se rabat sur son libellé, souvent explicite
 * (« Français VFF »).
 */
export function matchesLanguage(track: MediaTrack, preferred: string): boolean {
  const wanted = preferred.trim().toLowerCase();
  if (!wanted) return false;

  const aliases = LANGUAGE_ALIASES[wanted] ?? [wanted];

  const lang = track.lang?.trim().toLowerCase();
  if (lang) {
    const base = lang.split(/[-_]/)[0];
    if (aliases.includes(base)) return true;
  }

  // Repli sur le libellé : comparaison par mot entier, sinon « en »
  // correspondrait à n'importe quel titre contenant « en ».
  const label = track.label.trim().toLowerCase();
  if (!label) return false;
  return label
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .some((word) => aliases.includes(word));
}

/**
 * Choisit la piste à activer au démarrage.
 *
 * Renvoie `null` quand aucune piste ne convient : l'appelant laisse
 * alors le flux sur son réglage d'origine plutôt que d'imposer un choix
 * arbitraire.
 *
 * `fallbackToFirst` distingue les deux usages :
 *
 * - **Audio** — `false`. Sans correspondance, la piste par défaut du
 *   flux est déjà la bonne dans l'immense majorité des cas ; la
 *   remplacer par la première venue ferait basculer un film en VO sans
 *   raison.
 * - **Sous-titres** — `true`. L'utilisateur a demandé des sous-titres :
 *   lui en donner dans une autre langue vaut mieux que ne rien afficher.
 */
export function pickPreferredTrack(
  tracks: readonly MediaTrack[],
  preferred: string,
  fallbackToFirst: boolean
): MediaTrack | null {
  if (tracks.length === 0) return null;

  const match = tracks.find((track) => matchesLanguage(track, preferred));
  if (match) return match;

  return fallbackToFirst ? tracks[0] : null;
}

/** Préférences lues par la sélection automatique. */
export interface TrackPreferences {
  /** Code de langue audio souhaité (`'fr'`, `'en'`, …). */
  audioLanguage: string;
  /**
   * Code de langue des sous-titres.
   *
   * Volontairement distinct de `audioLanguage` : le cas d'usage le plus
   * courant est justement de les vouloir différents — un film en version
   * originale anglaise, sous-titré dans sa propre langue. Réutiliser la
   * langue audio ici imposerait des sous-titres anglais sur un film
   * anglais, ce qui n'a aucun intérêt.
   *
   * Aucun réglage dédié n'existe dans l'écran Réglages : c'est la langue
   * de l'interface qui est passée ici, comme le font Netflix et
   * Disney+. Le menu du lecteur permet d'en changer ponctuellement.
   */
  subtitleLanguage: string;
  /** Faut-il afficher des sous-titres dès le démarrage ? */
  subtitlesEnabled: boolean;
}

/**
 * Applique les préférences à un flux qui vient de déclarer ses pistes.
 *
 * Appelée une seule fois par vidéo, dès que des pistes apparaissent :
 * la rejouer écraserait les choix faits à la main dans le menu du
 * lecteur, ce qui rendrait ce menu inutilisable — couper les
 * sous-titres les ferait aussitôt revenir.
 *
 * Renvoie `true` si les pistes étaient disponibles et la sélection
 * effectuée, `false` s'il faut réessayer plus tard. Les pistes n'existent
 * pas au moment où la vidéo est attachée : elles arrivent avec le
 * manifeste, une à deux secondes après.
 */
export function applyTrackPreferences(
  controller: TrackController,
  preferences: TrackPreferences
): boolean {
  const { audioTracks, subtitleTracks } = controller;

  // Aucune piste déclarée : le manifeste n'est pas encore lu. Ne rien
  // faire et laisser l'appelant réessayer au prochain signal.
  if (audioTracks.length === 0 && subtitleTracks.length === 0) return false;

  if (audioTracks.length > 1) {
    const audio = pickPreferredTrack(audioTracks, preferences.audioLanguage, false);
    // Ne pas réémettre une sélection déjà active : certains flux
    // repartent du début du segment à chaque changement de piste.
    if (audio && audio.id !== controller.activeAudioId) {
      controller.selectAudio(audio.id);
    }
  }

  if (preferences.subtitlesEnabled && subtitleTracks.length > 0) {
    const subtitle = pickPreferredTrack(subtitleTracks, preferences.subtitleLanguage, true);
    if (subtitle && subtitle.id !== controller.activeSubtitleId) {
      controller.selectSubtitle(subtitle.id);
    }
  }

  return true;
}
