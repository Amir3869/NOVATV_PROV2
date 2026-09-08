'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  attachPlayer,
  mediaErrorToKind,
  type Attachment,
  type PlaybackError,
} from '@/services/player/playbackEngine';
import {
  applyTrackPreferences,
  type TrackController,
  type TrackPreferences,
} from '@/services/player/trackController';
import type { SubtitleSnapshot } from '@/services/player/subtitleCues';
import type {
  QualityLevel,
  QualityPolicy,
} from '@/services/player/qualityLadder';
import type { QualitySource } from '@/services/player/playbackEngine';
import type { LiveChannel } from '@/types';
import {
  NativeVodPlayer,
  shouldUseNativeVod,
  type NativeVodEvent,
} from '@/services/player/nativeVodPlayer';
import type { PluginListenerHandle } from '@capacitor/core';
import type { PlaybackErrorKind } from '@/services/player/playbackEngine';

/**
 * Pilote une balise vidéo réelle.
 *
 * Le composant du lecteur se contentait d'états décoratifs : `isPlaying`
 * était un booléen que personne ne lisait, `progress` un pourcentage
 * qu'aucune vidéo ne produisait. Ce hook remplace ces faux-semblants par
 * l'état réel de la balise `<video>`, et rend les commandes qui agissent
 * dessus.
 *
 * Principe : la balise vidéo est la source de vérité. On ne tient pas un
 * état parallèle que l'on tenterait de garder synchronisé — c'est la
 * source de bogues la plus classique sur un lecteur. On s'abonne aux
 * événements de la balise et on recopie ce qu'elle annonce.
 */

export interface UseVideoPlayerOptions {
  /**
   * Politique de qualité au démarrage : `auto`, `saver` ou `best`.
   *
   * Réglage global venu des préférences. Un choix explicite mémorisé
   * (`preferredHeight`) prime sur elle.
   */
  qualityPolicy?: QualityPolicy;
  /** Hauteur forcée lors de la lecture précédente, en pixels. */
  preferredHeight?: number | null;
  /**
   * Prévient l'appelant qu'une hauteur vient d'être choisie à la main.
   *
   * C'est lui qui décide de la mémoriser : le hook ne connaît pas le
   * store et ne doit pas en dépendre.
   */
  onQualityHeight?: (height: number) => void;

  /**
   * Référence vers la balise `<video>`, créée par le composant.
   *
   * Elle est fournie plutôt que rendue : une référence renvoyée dans le
   * même objet que les valeurs d'état contamine tout l'objet aux yeux de
   * l'analyseur React, qui interdit alors de lire `isPlaying` ou
   * `isMuted` pendant le rendu — ce qui est pourtant leur seul usage.
   */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /**
   * La balise elle-même, une fois montée, `null` avant.
   *
   * Elle double la référence pour une raison précise : une référence ne
   * prévient personne quand elle se remplit. L'écran affiche une roue
   * d'attente tant que les données ne sont pas relues, si bien que la
   * balise n'existe pas au premier rendu ; un effet qui ne dépend que de
   * `videoRef` — un objet stable — ne se rejoue donc jamais et n'écoute
   * jamais rien. Cette valeur, elle, change, ce qui relance l'abonnement
   * au bon moment. Elle est fournie par l'écran via une fonction de
   * référence, et non renvoyée par le hook : un objet de retour qui
   * contient une référence devient illisible pendant le rendu.
   */
  videoEl: HTMLVideoElement | null;
  /** URL du flux. `null` tant que le média n'est pas résolu. */
  url: string | null;
  /** Direct ou contenu à la demande : change le moteur et les commandes. */
  isLive: boolean;
  /** Format annoncé par le catalogue, quand il est connu. */
  streamType?: LiveChannel['streamType'];
  /** Position de reprise en secondes, ignorée pour un direct. */
  resumeAt?: number;
  /** Appelé régulièrement pendant la lecture, pour enregistrer la reprise. */
  onProgress?: (position: number, duration: number) => void;
  /**
   * Pistes à sélectionner d'office au démarrage.
   *
   * Omettre cette option laisse le flux sur ses pistes par défaut. Elle
   * ne fixe qu'un point de départ : le menu du lecteur reste maître
   * ensuite, la sélection n'est jamais rejouée pour une même vidéo.
   */
  trackPreferences?: TrackPreferences;
  /**
   * Appelé quand la vidéo atteint sa fin naturelle.
   *
   * Sert à l'enchaînement automatique des épisodes. Gardé dans une
   * référence : le lecteur y déclenche une navigation, et une fonction
   * recréée à chaque rendu ferait sinon réinstaller l'écouteur en
   * boucle.
   */
  onEnded?: () => void;
}

export interface VideoPlayerState {
  /** Vrai entre la demande de flux et la première image. */
  isLoading: boolean;
  /** Vrai si la vidéo avance réellement. */
  isPlaying: boolean;
  /** Vrai pendant un remplissage de mémoire tampon en cours de lecture. */
  isBuffering: boolean;
  isMuted: boolean;
  /** Volume de 0 à 100, pour coller aux commandes existantes. */
  volume: number;
  /** Position courante en secondes. */
  currentTime: number;
  /** Durée totale en secondes, `0` pour un direct. */
  duration: number;
  /** Panne en cours, `null` si tout va bien. */
  error: PlaybackError | null;
  togglePlay: () => void;
  toggleMute: () => void;
  setVolume: (value: number) => void;
  /** Déplacement absolu, en secondes. */
  seekTo: (seconds: number) => void;
  /** Déplacement relatif, en secondes. Négatif pour reculer. */
  seekBy: (delta: number) => void;
  /** Relance après une panne. */
  retry: () => void;
  /**
   * Pistes audio et sous-titres disponibles, `null` quand le moteur
   * n'en expose pas (`mpegts.js`) ou avant l'arrivée du manifeste.
   *
   * C'est un instantané recalculé à chaque changement annoncé par le
   * moteur, pas un objet vivant : le lire pendant le rendu est sûr.
   */
  tracks: TrackController | null;
  /**
   * Variantes de qualité du flux en cours, `null` quand le moteur n'en
   * expose aucune (MPEG-TS, lecture native) ou avant le manifeste.
   *
   * Instantané recalculé à chaque bascule, sûr à lire pendant le rendu.
   */
  quality: QualityState | null;
  /**
   * Force une variante. `-1` rend la main à l'adaptation automatique.
   *
   * Mémorise aussi la hauteur choisie, pour la reporter sur la chaîne
   * suivante.
   */
  selectQuality: (index: number) => void;
  /**
   * Répliques de sous-titres collectées par le moteur, pour le calque
   * custom. Sans source, l'écran n'affiche que le rendu natif.
   */
  subtitles: SubtitleSnapshot;
  /**
   * Vrai quand ExoPlayer peint sous la WebView (VOD Android).
   * L'écran doit alors rendre le chrome transparent et cacher `<video>`.
   */
  usesNativeSurface: boolean;
}

/** Ce que l'écran a besoin de savoir sur les qualités disponibles. */
export interface QualityState {
  levels: QualityLevel[];
  /** Index du niveau diffusé, même quand hls.js l'a choisi seul. */
  currentLevel: number;
  /** Vrai tant que l'utilisateur n'a rien forcé. */
  autoMode: boolean;
}

/** Intervalle d'enregistrement de la position, en millisecondes. */
const PROGRESS_SAVE_INTERVAL = 5000;

/**
 * Garde-temps d'ouverture d'un flux, en millisecondes.
 *
 * Un flux injoignable ne produit pas toujours d'erreur. Le serveur
 * accepte la connexion puis ne renvoie jamais le manifeste : hls.js
 * attend, n'émet ni `MANIFEST_PARSED` ni `ERROR`, et l'écran reste sur
 * « chargement du flux » indéfiniment. C'est le cas le plus fréquent
 * sur les listes publiques, où une part des chaînes est hors service.
 *
 * Ce délai est le dernier filet : passé vingt secondes sans manifeste,
 * on déclare le flux injoignable et on rend la main à l'utilisateur.
 * Au-delà, un flux IPTV n'aboutit quasiment jamais, et l'attente muette
 * est pire qu'un message d'erreur — elle empêche de zapper.
 */
const STREAM_OPEN_TIMEOUT = 20000;

export function useVideoPlayer(options: UseVideoPlayerOptions): VideoPlayerState {
  const {
    videoRef,
    videoEl,
    url,
    isLive,
    streamType,
    resumeAt,
    onProgress,
    trackPreferences,
    onEnded,
    qualityPolicy = 'auto',
    preferredHeight = null,
    onQualityHeight,
  } = options;

  const attachmentRef = useRef<Attachment | null>(null);
  /**
   * Désabonnement des changements de pistes.
   *
   * Conservé à part de l'attachement : il est posé après la résolution
   * de la promesse, donc bien après que la fonction de nettoyage de
   * l'effet a été enregistrée.
   */
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const unsubscribeQualityRef = useRef<(() => void) | null>(null);
  const unsubscribeSubtitleRef = useRef<(() => void) | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(100);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<PlaybackError | null>(null);
  const [tracks, setTracks] = useState<TrackController | null>(null);
  const [quality, setQuality] = useState<QualityState | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleSnapshot>({ cues: [], active: false });

  // Incrémenter ce compteur relance l'effet d'attachement, donc le flux.
  const [retryToken, setRetryToken] = useState(0);

  // `onProgress` et `resumeAt` sont rangés dans des références : s'ils
  // figuraient dans les dépendances de l'effet, une fonction recréée à
  // chaque rendu par le composant parent détruirait et rechargerait le
  // flux en boucle.
  //
  // La mise à jour passe par un effet et non par une affectation directe
  // pendant le rendu : écrire dans une référence pendant le rendu est
  // interdit par React, car ce rendu peut être abandonné puis rejoué, ce
  // qui laisserait la référence dans un état incohérent.
  const onProgressRef = useRef(onProgress);
  const resumeAtRef = useRef(resumeAt);

  /**
   * Préférences de pistes, rangées en référence pour la même raison que
   * `onProgress` : les placer dans les dépendances de l'effet
   * rechargerait le flux dès que l'objet est recréé par le parent.
   */
  const trackPreferencesRef = useRef(trackPreferences);
  /**
   * Source de qualité de l'attachement courant.
   *
   * Séparée de `attachmentRef` parce que `selectQuality` doit y accéder
   * depuis un `useCallback` sans dépendre du cycle d'attachement.
   */
  const qualitySourceRef = useRef<QualitySource | null>(null);
  const onQualityHeightRef = useRef(onQualityHeight);
  const onEndedRef = useRef(onEnded);

  /**
   * Verrou : les préférences ne s'appliquent qu'une fois par vidéo.
   *
   * Sans lui, chaque signal du moteur rejouerait la sélection et
   * écraserait les choix faits à la main dans le menu du lecteur —
   * couper les sous-titres les ferait aussitôt revenir. Remis à `false`
   * par l'effet d'attachement, donc à chaque changement de flux.
   */
  const preferencesAppliedRef = useRef(false);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);

  const sessionKey = `${url ?? ''}|${isLive ? '1' : '0'}|${retryToken}`;
  const [activeSession, setActiveSession] = useState(sessionKey);
  if (sessionKey !== activeSession) {
    setActiveSession(sessionKey);
    setIsLoading(Boolean(url));
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsBuffering(false);
  }

  useEffect(() => {
    onProgressRef.current = onProgress;
    resumeAtRef.current = resumeAt;
    trackPreferencesRef.current = trackPreferences;
    onEndedRef.current = onEnded;
    onQualityHeightRef.current = onQualityHeight;
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
  }, [onProgress, resumeAt, trackPreferences, onEnded, onQualityHeight, currentTime, duration]);

  // Attachement du flux.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    if (shouldUseNativeVod(isLive)) return;

    let cancelled = false;
    preferencesAppliedRef.current = false;

    /**
     * Garde-temps : armé maintenant, désarmé par le premier signal du
     * moteur, quel qu'il soit. Sans lui, un serveur qui accepte la
     * connexion sans jamais répondre laisse l'écran gelé pour toujours.
     */
    let openTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      openTimer = null;
      if (cancelled) return;
      setIsLoading(false);
      // `timeout` et non `network` : la connexion de l'utilisateur
      // fonctionne -- les autres ecrans se chargent -- c'est le serveur
      // du flux qui reste muet. Lui faire verifier son internet
      // l'enverrait redemarrer sa box pour rien.
      //
      // `recoverable` : le bouton Reessayer s'affiche. Un serveur muet
      // peut tres bien repondre a la tentative suivante.
      setError({ kind: 'timeout', recoverable: true });
    }, STREAM_OPEN_TIMEOUT);

    const clearOpenTimer = () => {
      if (openTimer !== null) {
        clearTimeout(openTimer);
        openTimer = null;
      }
    };

    void attachPlayer({
      url,
      video,
      isLive,
      streamType,
      qualityPolicy,
      preferredHeight,
      onReady: () => {
        clearOpenTimer();
        if (cancelled) return;
        setIsLoading(false);
        // Reprise : on se replace là où l'utilisateur s'était arrêté.
        // Seulement pour un contenu à la demande, et seulement si la
        // position est crédible — sauter à la toute fin rejouerait le
        // générique en boucle.
        const resume = resumeAtRef.current;
        if (!isLive && resume && resume > 5) {
          const total = video.duration;
          if (!Number.isFinite(total) || resume < total - 10) {
            video.currentTime = resume;
          }
        }
        // La lecture automatique est refusée par les navigateurs si le
        // son est actif et qu'aucun geste utilisateur n'a eu lieu. On ne
        // force pas : l'utilisateur a cliqué pour arriver ici, si le
        // navigateur refuse quand même il reste le bouton Lecture.
        void video.play().catch(() => {
          if (!cancelled) setIsPlaying(false);
        });
      },
      onError: (playbackError) => {
        clearOpenTimer();
        if (cancelled) return;
        setIsLoading(false);
        setError(playbackError);
      },
    }).then((attachment) => {
      if (cancelled) {
        attachment.destroy();
        return;
      }
      attachmentRef.current = attachment;

      // Qualité : même patron que les pistes. Les variantes n'existent
      // pas à l'attachement, elles arrivent avec le manifeste.
      const qualitySource = attachment.quality;
      qualitySourceRef.current = qualitySource;
      if (qualitySource) {
        const refreshQuality = () => {
          if (cancelled) return;
          setQuality(qualitySource.read());
        };
        refreshQuality();
        unsubscribeQualityRef.current = qualitySource.subscribe(refreshQuality);
      } else {
        setQuality(null);
      }

      // Sous-titres : même patron que la qualité. La source existe dès
      // l'attachement, mais les répliques arrivent avec les segments.
      const subtitleSource = attachment.subtitles;
      if (subtitleSource) {
        const refreshSubtitles = () => {
          if (cancelled) return;
          setSubtitles(subtitleSource.read());
        };
        refreshSubtitles();
        unsubscribeSubtitleRef.current = subtitleSource.subscribe(refreshSubtitles);
      } else {
        setSubtitles({ cues: [], active: false });
      }

      const source = attachment.tracks;
      if (!source) {
        // Moteur sans pistes sélectionnables : on le dit explicitement
        // pour que l'écran retire le bouton plutôt que d'ouvrir un menu
        // vide.
        setTracks(null);
        return;
      }

      // Les pistes n'existent pas encore : elles arrivent avec le
      // manifeste, une à deux secondes plus tard. D'où l'abonnement, en
      // plus de la lecture immédiate.
      const refresh = () => {
        if (cancelled) return;
        const controller = source.read();

        // Les préférences s'appliquent au premier signal qui apporte de
        // vraies pistes, pas à l'attachement : à cet instant le manifeste
        // n'est pas lu et les listes sont vides.
        const preferences = trackPreferencesRef.current;
        if (preferences && !preferencesAppliedRef.current) {
          if (applyTrackPreferences(controller, preferences)) {
            preferencesAppliedRef.current = true;
            // Relecture : `applyTrackPreferences` a pu changer la piste
            // active, l'instantané pris plus haut est déjà périmé.
            setTracks(source.read());
            return;
          }
        }

        setTracks(controller);
      };
      refresh();
      unsubscribeRef.current = source.subscribe(refresh);
    }).catch(() => {
      // `attachPlayer` charge hls.js et mpegts.js a la demande. Si ce
      // telechargement echoue -- reseau coupe, fichier absent du build --
      // la promesse est rejetee. Sans ce filet, personne ne remet
      // `isLoading` a `false` et l'ecran reste fige sans rien afficher.
      clearOpenTimer();
      if (cancelled) return;
      setIsLoading(false);
      setError({ kind: 'unsupported', recoverable: false });
    });

    return () => {
      cancelled = true;
      clearOpenTimer();
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      unsubscribeQualityRef.current?.();
      unsubscribeQualityRef.current = null;
      unsubscribeSubtitleRef.current?.();
      unsubscribeSubtitleRef.current = null;
      qualitySourceRef.current = null;
      attachmentRef.current?.destroy();
      attachmentRef.current = null;
    };
    // `qualityPolicy` et `preferredHeight` sont volontairement absents
    // des dépendances : ils ne s'appliquent qu'à l'ouverture du flux.
    // Les y mettre relancerait toute la lecture dès que l'utilisateur
    // change de qualité, ce qui est exactement l'inverse du but.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, url, isLive, streamType, retryToken]);

  // VOD Android : ExoPlayer sous la WebView (AC-3). Le chrome HTML reste.
  useEffect(() => {
    if (!shouldUseNativeVod(isLive) || !url) return;

    let cancelled = false;
    const handles: PluginListenerHandle[] = [];
    document.documentElement.classList.add('native-vod');

    const resume = resumeAtRef.current;
    void NativeVodPlayer.play({
      url,
      resumeAt: resume && resume > 5 ? resume : 0,
    }).catch(() => {
      if (cancelled) return;
      setIsLoading(false);
      setError({ kind: 'unknown', recoverable: true });
    });

    const listen = async (
      event: Parameters<typeof NativeVodPlayer.addListener>[0],
      cb: (data: NativeVodEvent) => void
    ) => {
      const handle = await NativeVodPlayer.addListener(event, cb);
      if (cancelled) {
        void handle.remove();
        return;
      }
      handles.push(handle);
    };

    void listen('ready', (data) => {
      if (cancelled) return;
      setIsLoading(false);
      setDuration(data.duration ?? 0);
    });
    void listen('time', (data) => {
      if (cancelled) return;
      if (typeof data.position === 'number') setCurrentTime(data.position);
      if (typeof data.duration === 'number' && data.duration > 0) setDuration(data.duration);
    });
    void listen('playing', () => {
      if (cancelled) return;
      setIsPlaying(true);
      setIsBuffering(false);
    });
    void listen('paused', () => {
      if (!cancelled) setIsPlaying(false);
    });
    void listen('buffering', (data) => {
      if (!cancelled) setIsBuffering(Boolean(data.value));
    });
    void listen('ended', () => {
      if (cancelled) return;
      setIsPlaying(false);
      onEndedRef.current?.();
    });
    void listen('error', (data) => {
      if (cancelled) return;
      setIsLoading(false);
      const kind = (['network', 'timeout', 'cors', 'notFound', 'forbidden', 'decode', 'unsupported', 'aborted', 'unknown'].includes(data.kind ?? '')
        ? data.kind
        : 'unknown') as PlaybackErrorKind;
      setError({ kind, recoverable: kind === 'network' || kind === 'timeout' });
    });

    return () => {
      cancelled = true;
      document.documentElement.classList.remove('native-vod');
      handles.forEach((h) => void h.remove());
      void NativeVodPlayer.release();
    };
  }, [url, isLive, retryToken]);

  // Abonnement aux événements de la balise.
  useEffect(() => {
    const video = videoEl;
    if (!video) return;
    if (shouldUseNativeVod(isLive)) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
    };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => {
      // Un direct annonce une durée infinie : on la ramène à zéro pour
      // que l'interface sache qu'il n'y a pas de barre de progression.
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };
    const onVolumeChange = () => {
      setIsMuted(video.muted);
      setVolumeState(Math.round(video.volume * 100));
    };
    /**
     * Panne signalee par la balise elle-meme.
     *
     * `playbackEngine` ne pose cet ecouteur que dans sa branche native.
     * Quand hls.js ou mpegts.js pilote la lecture -- la quasi-totalite
     * des chaines IPTV -- un echec de decodage (codec absent, frequent
     * sur Firestick) n'etait capte par personne : la video s'arretait,
     * aucune erreur ne s'affichait. On le capte donc ici, ou l'ecouteur
     * vaut pour tous les moteurs.
     */
    const onVideoError = () => {
      const kind = mediaErrorToKind(video.error);
      // `aborted` n'est pas une panne : la balise signale ainsi un
      // changement de source volontaire, typiquement un zapping. Le
      // traiter comme une erreur ferait clignoter un message a chaque
      // changement de chaine.
      if (kind === 'aborted') return;
      setIsLoading(false);
      setError({ kind, recoverable: kind === 'network' });
    };

    const onEnded = () => {
      setIsPlaying(false);
      // Signalé APRÈS la mise à jour de l'état : l'appelant peut
      // déclencher une navigation, et le composant serait alors démonté
      // avant d'avoir enregistré l'arrêt.
      onEndedRef.current?.();
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onVideoError);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onVideoError);
    };
  }, [videoEl, isLive]);

  // Enregistrement périodique de la position.
  //
  // On n'enregistre pas à chaque `timeupdate` : l'événement se déclenche
  // quatre fois par seconde, ce qui écrirait sans arrêt dans le stockage
  // local et ferait ramer un appareil modeste.
  useEffect(() => {
    if (isLive || !isPlaying) return;
    const timer = setInterval(() => {
      if (shouldUseNativeVod(isLive)) {
        if (durationRef.current > 0) {
          onProgressRef.current?.(currentTimeRef.current, durationRef.current);
        }
        return;
      }
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.duration === 0) return;
      onProgressRef.current?.(video.currentTime, video.duration);
    }, PROGRESS_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [videoRef, isLive, isPlaying]);

  // Dernier enregistrement au démontage : sans cela, quitter le lecteur
  // perd jusqu'à cinq secondes de visionnage à chaque fois.
  useEffect(() => {
    // On capture la balise a l'inscription de l'effet : au moment ou le
    // nettoyage s'execute, `videoRef.current` peut deja valoir null.
    const video = videoRef.current;
    return () => {
      if (isLive) return;
      if (shouldUseNativeVod(isLive)) {
        if (durationRef.current > 0 && currentTimeRef.current >= 5) {
          onProgressRef.current?.(currentTimeRef.current, durationRef.current);
        }
        return;
      }
      if (!video) return;
      if (!Number.isFinite(video.duration) || video.duration === 0) return;
      if (video.currentTime < 5) return;
      onProgressRef.current?.(video.currentTime, video.duration);
    };
  }, [videoRef, isLive]);

  const togglePlay = useCallback(() => {
    if (shouldUseNativeVod(isLive)) {
      if (isPlaying) void NativeVodPlayer.pause();
      else void NativeVodPlayer.resume();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [videoRef, isPlaying, isLive]);

  const toggleMute = useCallback(() => {
    if (shouldUseNativeVod(isLive)) {
      const next = !isMuted;
      setIsMuted(next);
      void NativeVodPlayer.setMuted({ value: next });
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, [videoRef, isMuted, isLive]);

  const setVolume = useCallback((value: number) => {
    if (shouldUseNativeVod(isLive)) {
      const clamped = Math.min(100, Math.max(0, value));
      setVolumeState(clamped);
      if (clamped > 0 && isMuted) setIsMuted(false);
      void NativeVodPlayer.setVolume({ value: clamped });
      if (clamped > 0) void NativeVodPlayer.setMuted({ value: false });
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.min(100, Math.max(0, value));
    video.volume = clamped / 100;
    // Monter le son alors que tout est coupé doit rétablir le son, sinon
    // l'utilisateur pousse le volume sans rien entendre.
    if (clamped > 0 && video.muted) video.muted = false;
  }, [videoRef, isMuted, isLive]);

  const seekTo = useCallback((seconds: number) => {
    if (shouldUseNativeVod(isLive)) {
      const total = durationRef.current;
      const next = Math.min(total > 0 ? total : seconds, Math.max(0, seconds));
      setCurrentTime(next);
      void NativeVodPlayer.seek({ seconds: next });
      return;
    }
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(video.duration, Math.max(0, seconds));
  }, [videoRef, isLive]);

  const seekBy = useCallback(
    (delta: number) => {
      if (shouldUseNativeVod(isLive)) {
        seekTo(currentTimeRef.current + delta);
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      seekTo(video.currentTime + delta);
    },
    [videoRef, seekTo]
  );

  /**
   * Force une variante de qualité, ou rend la main à l'automatique.
   *
   * La hauteur choisie remonte à l'appelant pour être mémorisée : c'est
   * ce qui permet de reporter le choix sur la chaîne suivante. Passer
   * `-1` (mode auto) ne mémorise rien — l'automatique n'est pas une
   * hauteur, et l'écraser ferait perdre la préférence précédente.
   */
  const selectQuality = useCallback(
    (index: number) => {
      const source = qualitySourceRef.current;
      if (!source) return;
      source.selectLevel(index);
      // Relecture immédiate : hls.js émet bien `LEVEL_SWITCHED`, mais
      // seulement au segment suivant. Sans ce rafraîchissement, la coche
      // du menu resterait sur l'ancien choix pendant plusieurs secondes.
      setQuality(source.read());

      if (index < 0) return;
      const height = source.read().levels[index]?.height ?? 0;
      if (height > 0) onQualityHeightRef.current?.(height);
    },
    []
  );

  const retry = useCallback(() => {
    setError(null);
    setRetryToken((token) => token + 1);
  }, []);

  return {
    isLoading,
    isPlaying,
    isBuffering,
    isMuted,
    volume,
    currentTime,
    duration,
    error,
    togglePlay,
    toggleMute,
    setVolume,
    seekTo,
    seekBy,
    retry,
    tracks,
    quality,
    selectQuality,
    subtitles,
    usesNativeSurface: shouldUseNativeVod(isLive),
  };
}
