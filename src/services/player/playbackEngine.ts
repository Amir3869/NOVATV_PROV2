/**
 * Choix et pilotage du moteur de lecture.
 *
 * Un navigateur ne sait pas lire tout seul les flux servis par les
 * portails IPTV. Il faut lui mâcher le travail, et le bon outil dépend
 * du format :
 *
 * - **HLS** (`.m3u8`) : le flux est découpé en petits fichiers listés
 *   dans un index. Safari le lit nativement ; les autres navigateurs
 *   ont besoin de `hls.js`, qui télécharge les morceaux et les injecte
 *   dans la balise vidéo.
 * - **MPEG-TS** (`.ts`) : le format historique des portails Xtream, un
 *   flux continu sans découpage. *Aucun* navigateur ne le lit, et Safari
 *   refuse même le type `video/mp2t`. Il faut `mpegts.js`.
 * - **MP4, MKV, WebM** : les films et épisodes. La balise vidéo les lit
 *   directement, sans bibliothèque — à condition que le codec interne
 *   soit reconnu, ce qui n'est pas garanti pour le MKV.
 *
 * Ce fichier ne contient aucun composant React. Il expose une fonction
 * `attachPlayer` qui relie une URL à une balise `<video>` et rend une
 * fonction de nettoyage. Séparer ainsi permet de tester la logique de
 * choix sans monter d'interface, et de remplacer le moteur plus tard
 * (ExoPlayer via Capacitor) sans toucher à l'écran du lecteur.
 */

import type { LiveChannel } from '@/types';
import {
  hlsTrackSource,
  nativeTrackSource,
  type HlsLike,
  type TrackSource,
} from './trackController';
import {
  AUTO_LEVEL,
  levelClosestToHeight,
  levelForPolicy,
  startLevelForAuto,
  type QualityLevel,
  type QualityPolicy,
} from './qualityLadder';
import {
  hlsSubtitleSource,
  type SubtitleHlsLike,
  type SubtitleSource,
} from './subtitleCues';

/** Moteur retenu pour une URL donnée. */
export type EngineKind = 'native' | 'hlsjs' | 'mpegts';

/**
 * Causes d'échec de lecture.
 *
 * Comme partout ailleurs dans le projet, on renvoie un code et jamais
 * une phrase : la traduction se fait au rendu, sinon un message
 * français se retrouverait figé dans l'état d'une application arabe.
 */
export type PlaybackErrorKind =
  | 'network'
  /**
   * Le serveur du flux n'a jamais repondu dans le delai imparti.
   *
   * A distinguer de `network`, qui designe la connexion de
   * l'utilisateur. Confondre les deux fait accuser sa box internet
   * alors que le serveur de la chaine est simplement hors service --
   * cas frequent sur les listes publiques, ou une part des chaines est
   * morte. Dire la verite evite un redemarrage de box inutile.
   */
  | 'timeout'
  | 'cors'
  | 'notFound'
  | 'forbidden'
  | 'decode'
  | 'unsupported'
  | 'aborted'
  | 'unknown';

export interface PlaybackError {
  kind: PlaybackErrorKind;
  /** Vrai si réessayer a une chance d'aboutir (coupure passagère). */
  recoverable: boolean;
}

export interface AttachOptions {
  /** Flux à lire. */
  url: string;
  /** Balise vidéo cible, déjà montée dans la page. */
  video: HTMLVideoElement;
  /** Un direct ne se met pas en pause de la même façon qu'un film. */
  isLive: boolean;
  /**
   * Format annoncé par le catalogue, quand il est connu. Il prime sur
   * l'extension de l'URL, moins fiable.
   */
  streamType?: LiveChannel['streamType'];
  /** Appelé dès que la première image est prête. */
  onReady?: () => void;
  /** Appelé à chaque échec, y compris ceux dont le moteur se relève. */
  onError?: (error: PlaybackError) => void;
  /**
   * Politique de qualité au démarrage. Défaut : `auto`.
   *
   * Appliquée une seule fois, à la lecture du manifeste. L'utilisateur
   * reste libre de forcer un autre niveau ensuite.
   */
  qualityPolicy?: QualityPolicy;
  /**
   * Hauteur forcée lors de la lecture précédente, en pixels.
   *
   * Prime sur la politique quand elle est renseignée : un choix
   * explicite pèse plus qu'un réglage par défaut. Le niveau retenu est
   * le plus proche par le dessous.
   */
  preferredHeight?: number | null;
}

/**
 * Accès aux variantes de qualité d'un flux.
 *
 * Même forme que `TrackSource` : une lecture instantanée et un
 * abonnement. Les niveaux n'existent pas au moment de l'attachement,
 * ils arrivent avec le manifeste une à deux secondes plus tard — sans
 * abonnement, le menu resterait vide.
 */
export interface QualitySource {
  /** Variantes déclarées par le manifeste, dans l'ordre du flux. */
  read: () => { levels: QualityLevel[]; currentLevel: number; autoMode: boolean };
  /** `-1` rend la main à l'adaptation automatique. */
  selectLevel: (index: number) => void;
  subscribe: (listener: () => void) => () => void;
}

/** Ce que `attachPlayer` rend à l'appelant. */
export interface Attachment {
  engine: EngineKind;
  /**
   * Accès aux pistes audio et sous-titres, `null` quand le moteur n'en
   * expose aucune. C'est le cas de `mpegts.js`, dont l'interface
   * `Player` ne propose aucune sélection : le flux est remis à la
   * balise sous forme d'un seul train audio.
   */
  tracks: TrackSource | null;
  /**
   * Variantes de qualité, `null` quand le moteur n'en expose aucune.
   *
   * Seul HLS en propose. Un flux MPEG-TS est un train unique : il n'y a
   * rien à choisir, et le menu se masquera de lui-même.
   */
  quality: QualitySource | null;
  /**
   * Répliques de sous-titres, `null` quand le moteur n'en expose pas.
   *
   * Présent pour hls.js et la lecture native, absent pour mpegts.js —
   * qui n'expose aucune piste. C'est la source du calque custom :
   * sans elle, l'écran se contente du rendu natif du navigateur et ne
   * peut appliquer ni taille, ni position, ni fond, ni police.
   */
  subtitles: SubtitleSource | null;
  /** À appeler au démontage. Idempotent. */
  destroy: () => void;
}

/**
 * Extensions lisibles directement par la balise vidéo.
 *
 * Le MKV n'y figure pas : le conteneur passe parfois, mais son contenu
 * (souvent H.265 ou AC-3) est refusé par la plupart des navigateurs.
 * Mieux vaut annoncer « format non pris en charge » que laisser un
 * écran noir sans explication.
 */
const NATIVE_EXTENSIONS = ['mp4', 'm4v', 'webm', 'ogg', 'ogv', 'mov'];

/**
 * Extrait l'extension d'une URL, sans la requête ni l'ancre.
 *
 * `…/movie/user/pass/123.mp4?token=abc` doit donner `mp4`, pas
 * `mp4?token=abc`.
 */
export function extensionOf(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0] ?? '';
  const lastSegment = withoutQuery.split('/').pop() ?? '';
  const dot = lastSegment.lastIndexOf('.');
  if (dot === -1 || dot === lastSegment.length - 1) return '';
  return lastSegment.slice(dot + 1).toLowerCase();
}

/**
 * Détermine le moteur à utiliser.
 *
 * `streamType` vient du catalogue et fait foi quand il est renseigné :
 * la synchronisation Xtream sait quel format elle a demandé au portail.
 * L'extension ne sert que de repli, notamment pour le M3U où l'on ne
 * dispose que d'une URL brute.
 */
export function pickEngine(
  url: string,
  streamType?: LiveChannel['streamType']
): EngineKind {
  if (streamType === 'hls') return 'hlsjs';

  const ext = extensionOf(url);
  if (ext === 'm3u8') return 'hlsjs';
  if (ext === 'ts' || ext === 'mpegts') return 'mpegts';
  if (NATIVE_EXTENSIONS.includes(ext)) return 'native';

  // Sans extension exploitable, on parie sur MPEG-TS : les portails
  // Xtream servent souvent le direct sur une URL nue, et c'est leur
  // format par défaut.
  return streamType === 'other' ? 'mpegts' : 'native';
}

/** Traduit un code HTTP en cause de panne. */
export function httpStatusToKind(status: number): PlaybackErrorKind {
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404 || status === 410) return 'notFound';
  if (status === 0) return 'cors';
  if (status >= 500) return 'network';
  return 'unknown';
}

/**
 * Traduit l'erreur d'une balise vidéo.
 *
 * Les quatre codes du standard sont peu bavards : `MEDIA_ERR_DECODE` et
 * `MEDIA_ERR_SRC_NOT_SUPPORTED` recouvrent aussi bien un codec absent
 * qu'un serveur qui a répondu du HTML à la place d'une vidéo.
 */
export function mediaErrorToKind(error: MediaError | null): PlaybackErrorKind {
  if (!error) return 'unknown';
  // On compare des nombres et non `MediaError.MEDIA_ERR_ABORTED` : cette
  // constante est portée par l'objet global du navigateur, absent des
  // environnements de test. Les quatre valeurs sont figées par le
  // standard HTML et ne changeront pas.
  switch (error.code) {
    case 1:
      return 'aborted';
    case 2:
      return 'network';
    case 3:
      return 'decode';
    case 4:
      return 'unsupported';
    default:
      return 'unknown';
  }
}

/**
 * Relie une URL à une balise vidéo et rend de quoi tout défaire.
 *
 * Les deux bibliothèques sont chargées à la demande par `import()`.
 * Elles pèsent plusieurs centaines de kilo-octets ; les inclure dans le
 * paquet principal rallongerait le démarrage de tous les écrans, y
 * compris ceux qui ne lisent aucune vidéo. Sur un Firestick, ce délai
 * se voit.
 */
export async function attachPlayer(options: AttachOptions): Promise<Attachment> {
  const {
    url,
    video,
    isLive,
    streamType,
    onReady,
    onError,
    qualityPolicy = 'auto',
    preferredHeight = null,
  } = options;
  const engine = pickEngine(url, streamType);

  // Garde-fou : `destroy` peut être appelé avant la fin du chargement
  // de la bibliothèque, si l'utilisateur quitte l'écran aussitôt.
  let destroyed = false;

  const fail = (kind: PlaybackErrorKind, recoverable = false) => {
    if (destroyed) return;
    onError?.({ kind, recoverable });
  };

  if (engine === 'hlsjs') {
    // Ordre : hls.js D'ABORD, lecture native en repli.
    //
    // L'inverse paraissait plus malin -- laisser Safari décoder lui-même
    // -- mais `canPlayType('application/vnd.apple.mpegurl')` répond
    // « maybe » sur Chrome et Edge, qui ne lisent pourtant le HLS que de
    // façon partielle. Le raccourci se déclenchait donc partout, hls.js
    // n'était jamais chargé, et le lecteur perdait tout accès aux
    // variantes de qualité comme au détail des erreurs.
    //
    // C'est l'ordre que recommande la documentation de hls.js, et pour
    // cette raison précise : `Hls.isSupported()` teste la présence de
    // Media Source Extensions, un fait vérifiable, là où `canPlayType`
    // n'exprime qu'une intention.
    //
    // iOS reste servi : le WebKit de l'iPhone n'expose pas MSE,
    // `isSupported()` y répond `false` et le repli natif s'applique.
    const { default: Hls } = await import('hls.js');
    if (destroyed) return { engine, tracks: null, quality: null, subtitles: null, destroy: () => {} };

    if (!Hls.isSupported()) {
      // Pas de MSE : la balise vidéo est la seule voie. Elle gère son
      // échelle de qualité en interne, sans API pour la piloter.
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        const onLoaded = () => onReady?.();
        const onVideoError = () => fail(mediaErrorToKind(video.error));
        video.addEventListener('loadedmetadata', onLoaded, { once: true });
        video.addEventListener('error', onVideoError);
        return {
          engine: 'native',
          // Safari expose les pistes du flux HLS sur la balise elle-même.
          tracks: nativeTrackSource(video),
          quality: null,
          // `null` : en lecture native le navigateur assure son propre
          // rendu des sous-titres. Exposer des répliques ici ferait
          // apparaître le sous-titre deux fois — le nôtre et le sien.
          subtitles: null,
          destroy: () => {
            destroyed = true;
            video.removeEventListener('loadedmetadata', onLoaded);
            video.removeEventListener('error', onVideoError);
            video.removeAttribute('src');
            video.load();
          },
        };
      }

      fail('unsupported');
      return { engine, tracks: null, quality: null, subtitles: null, destroy: () => {} };
    }

    const hls = new Hls({
      // Réglages pensés pour une connexion lente et un appareil modeste.
      // Les valeurs par défaut de hls.js visent le poste de bureau.
      maxBufferLength: isLive ? 10 : 30,
      maxMaxBufferLength: 60,
      // En direct, se caler près du bord réduit le décalage, mais un
      // réseau irrégulier fera bégayer. Trois segments est le compromis
      // habituel.
      liveSyncDurationCount: 3,
      // Un Firestick n'a pas la puissance de recalculer sans cesse.
      enableWorker: true,
      lowLatencyMode: false,
      // Rendre soi-même les sous-titres. Par défaut hls.js confie le
      // rendu au navigateur, qui affiche les répliques à sa façon :
      // taille, police, fond et position ne sont alors réglables nulle
      // part. En désactivant ce rendu natif, hls.js émet les répliques
      // via `CUES_PARSED` et notre calque les peint selon les réglages.
      renderTextTracksNatively: false,
    });

    // Les variantes n'existent qu'ici : avant la lecture du manifeste,
    // `hls.levels` est vide. C'est donc le seul endroit où la politique
    // de départ peut s'appliquer.
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const levels = hls.levels as QualityLevel[];
      // Un choix explicite de l'utilisateur prime sur la politique.
      const wanted =
        preferredHeight && preferredHeight > 0
          ? levelClosestToHeight(levels, preferredHeight)
          : levelForPolicy(levels, qualityPolicy);
      if (wanted !== AUTO_LEVEL) {
        hls.currentLevel = wanted;
      } else if (qualityPolicy === 'auto') {
        const start = startLevelForAuto(levels);
        if (start !== AUTO_LEVEL) hls.startLevel = start;
      }
      onReady?.();
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return; // hls.js se rattrape tout seul.

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR: {
          const status = data.response?.code ?? 0;
          // Une coupure réseau se retente ; un 403 ne se retentera
          // jamais avec succès, l'abonnement est en cause.
          const kind = status ? httpStatusToKind(status) : 'network';
          fail(kind, kind === 'network');
          if (kind === 'network') hls.startLoad();
          break;
        }
        case Hls.ErrorTypes.MEDIA_ERROR:
          fail('decode', true);
          hls.recoverMediaError();
          break;
        default:
          fail('unknown');
          hls.destroy();
      }
    });

    hls.loadSource(url);
    hls.attachMedia(video);

    return {
      engine,
      // `as unknown as HlsLike` : on ne décrit que les membres utilisés
      // pour éviter d'importer le type de hls.js hors du chargement
      // différé. Les signatures correspondent, vérifiées dans hls.d.ts.
      tracks: hlsTrackSource(hls as unknown as HlsLike),
      // Répliques à peindre sur le calque custom de l'écran.
      subtitles: hlsSubtitleSource(hls as unknown as SubtitleHlsLike),
      quality: {
        read: () => ({
          levels: hls.levels as QualityLevel[],
          currentLevel: hls.currentLevel,
          // `autoLevelEnabled` dit si hls.js choisit encore seul. Le
          // distinguer de `currentLevel` compte : en mode auto,
          // `currentLevel` vaut le niveau réellement diffusé, pas -1.
          autoMode: hls.autoLevelEnabled,
        }),
        selectLevel: (index) => {
          hls.currentLevel = index;
        },
        subscribe: (listener) => {
          // MANIFEST_PARSED remplit la liste, LEVEL_SWITCHED signale
          // chaque bascule, y compris celles décidées par hls.js.
          const events = [Hls.Events.MANIFEST_PARSED, Hls.Events.LEVEL_SWITCHED];
          for (const event of events) hls.on(event, listener);
          return () => {
            for (const event of events) hls.off(event, listener);
          };
        },
      },
      destroy: () => {
        destroyed = true;
        hls.destroy();
      },
    };
  }

  if (engine === 'mpegts') {
    const mpegts = (await import('mpegts.js')).default;
    if (destroyed) return { engine, tracks: null, quality: null, subtitles: null, destroy: () => {} };

    if (!mpegts.isSupported()) {
      fail('unsupported');
      return { engine, tracks: null, quality: null, subtitles: null, destroy: () => {} };
    }

    const player = mpegts.createPlayer(
      {
        type: 'mpegts',
        isLive,
        url,
        // Un direct n'a ni durée ni possibilité de revenir en arrière.
        hasAudio: true,
        hasVideo: true,
      },
      {
        // Sans cela, le flux dérive : la lecture prend du retard sur le
        // direct, seconde après seconde, jusqu'à plusieurs minutes.
        liveBufferLatencyChasing: isLive,
        liveBufferLatencyMaxLatency: 5,
        liveBufferLatencyMinRemain: 1,
        enableWorker: true,
        // Le mode différé économise la mémoire, précieuse sur clé TV.
        lazyLoad: !isLive,
      }
    );

    player.on(mpegts.Events.MEDIA_INFO, () => onReady?.());

    player.on(mpegts.Events.ERROR, (type: string) => {
      // mpegts.js distingue réseau et flux illisible ; les deux autres
      // types sont trop rares pour mériter un message dédié.
      if (type === mpegts.ErrorTypes.NETWORK_ERROR) {
        fail('network', true);
      } else if (type === mpegts.ErrorTypes.MEDIA_ERROR) {
        fail('decode');
      } else {
        fail('unknown');
      }
    });

    player.attachMediaElement(video);
    player.load();

    return {
      engine,
      // mpegts.js n'expose aucune sélection de piste : son interface
      // `Player` n'a ni `audioTracks` ni équivalent. Annoncer `null`
      // plutôt qu'une liste vide permet à l'écran de retirer le bouton
      // au lieu d'ouvrir un menu sans contenu.
      tracks: null,
      // mpegts.js lit un train unique : aucune variante à proposer.
      quality: null,
      // mpegts.js n'expose aucune piste de sous-titres.
      subtitles: null,
      destroy: () => {
        destroyed = true;
        // L'ordre compte : détacher avant de détruire, sinon la balise
        // vidéo garde une référence sur un lecteur mort et la mémoire
        // n'est pas rendue — visible après une dizaine de zappings.
        try {
          player.pause();
          player.unload();
          player.detachMediaElement();
          player.destroy();
        } catch {
          // Un lecteur déjà détruit lève ; sans conséquence ici.
        }
      },
    };
  }

  // Lecture native : la balise se débrouille seule.
  video.src = url;
  const onLoaded = () => onReady?.();
  const onVideoError = () => fail(mediaErrorToKind(video.error));
  video.addEventListener('loadedmetadata', onLoaded, { once: true });
  video.addEventListener('error', onVideoError);

  return {
    engine: 'native',
    tracks: nativeTrackSource(video),
    // Lecture directe par la balise : aucune échelle de variantes.
    quality: null,
    // `null` : le navigateur rend les sous-titres lui-même. Le calque
    // custom n'est utilisé que par hls.js, voir plus haut.
    subtitles: null,
    destroy: () => {
      destroyed = true;
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onVideoError);
      video.removeAttribute('src');
      // Sans `load()`, le téléchargement continue en arrière-plan après
      // avoir quitté l'écran, et consomme des données pour rien.
      video.load();
    },
  };
}
