'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, ArrowLeft, Radio, AlertTriangle, RotateCcw,
  ChevronLeft, ChevronRight, Settings, List, Ratio, Captions,
  Heart, Lock, LockOpen, Timer, Gauge, PictureInPicture as PictureInPictureIcon
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Badge } from '@/design-system/components/Badge';
import { useTranslation } from '@/i18n';
import type { MessageKey } from '@/i18n';
import { useVideoPlayer } from './useVideoPlayer';
import { QualityMenu } from './QualityMenu';
import { FitMenu } from './FitMenu';
import { videoFitClassName } from '@/services/player/videoFit';
import { NativeVodPlayer } from '@/services/player/nativeVodPlayer';
import { SubtitleOverlay, type SubtitleAppearance } from './SubtitleOverlay';
import { AudioSubtitleMenu } from './AudioSubtitleMenu';
import { ChannelBrowser } from './ChannelBrowser';
import { listCategoryId } from '@/services/player/channelBrowser';
import { decodePlayerMediaId, livePlayerHref } from '@/services/player/livePlayerHref';
import { findCatalogItem } from '@/features/custom-lists/resolveListMedia';
import { categoryDisplayName, channelDisplayName } from '@/lib/displayNames';
import {
  EMPTY_CATEGORY_IDS,
  layoutCategories,
} from '@/services/catalog/categoryLayout';
import { channelMatchesCategory } from '@/services/catalog/categoryMatch';
import { Capacitor } from '@capacitor/core';
import { useDeviceType } from '@/hooks/useDeviceType';
import { usePlayerLandscapeLock } from '@/hooks/usePlayerLandscapeLock';
import { usePlayerImmersive } from '@/hooks/usePlayerImmersive';
import { useWakeLock } from '@/hooks/useWakeLock';
import { SleepMenu, SpeedMenu } from './PlayerExtraMenus';
import { qualityLabel } from '@/services/player/qualityLadder';
import { findNextEpisode, shouldAutoAdvance, episodeCode } from '@/services/player/episodeQueue';
import { Slider } from './Slider';
import { SkipArcButton } from './SkipArcButton';
import { EdgeLevelHud } from './EdgeLevelHud';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';
import { buildChannelEpgMap, buildPlayerEpgView } from '@/services/player/playerEpg';
import { hasSelectableTracks } from '@/services/player/trackController';
import type { PlaybackErrorKind } from '@/services/player/playbackEngine';
import type { LiveChannel } from '@/types';

/**
 * Traduction des pannes de lecture.
 *
 * Le moteur ne renvoie que des codes ; c'est ici, au rendu, qu'ils
 * deviennent des phrases. Enregistrer un texte français dans l'état
 * applicatif le figerait pour un utilisateur arabophone.
 */
const ERROR_TITLE_KEYS: Record<PlaybackErrorKind, MessageKey> = {
  network: 'player.errorNetwork',
  timeout: 'player.errorTimeout',
  cors: 'player.errorCors',
  notFound: 'player.errorNotFound',
  forbidden: 'player.errorForbidden',
  decode: 'player.errorDecode',
  unsupported: 'player.errorUnsupported',
  aborted: 'player.errorUnknown',
  unknown: 'player.errorUnknown',
};

const ERROR_DESCRIPTION_KEYS: Record<PlaybackErrorKind, MessageKey> = {
  network: 'player.errorNetworkDescription',
  timeout: 'player.errorTimeoutDescription',
  cors: 'player.errorCorsDescription',
  notFound: 'player.errorNotFoundDescription',
  forbidden: 'player.errorForbiddenDescription',
  decode: 'player.errorDecodeDescription',
  unsupported: 'player.errorUnsupportedDescription',
  aborted: 'player.errorUnknownDescription',
  unknown: 'player.errorUnknownDescription',
};

/** Met en forme une durée en secondes : `1:05:30` ou `4:07`. */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Delai avant l'enchainement automatique, en secondes.
 *
 * Dix et non cinq : le bouton d'annulation doit rester attrapable a la
 * telecommande, ou chaque deplacement du focus coute un appui.
 */
const AUTO_NEXT_DELAY_SECONDS = 10;

function PlayerContent() {
  const { t, locale } = useTranslation();
  const { isReady, isTV } = useDeviceType();
  const isNativeApp = Capacitor.isNativePlatform();
  const showMuteButton = !isTV;
  const showFullscreenButton = !isTV && !isNativeApp;
  /** Plus de verrou paysage : le lecteur s'ouvre dans le sens du téléphone. */
  usePlayerLandscapeLock(false);
  usePlayerImmersive(isReady);
  const {
    channels: allChannels,
    liveCategories: allLiveCategories,
    movies: allMovies,
    epgPrograms: allPrograms,
  } = useActiveCatalog();
  const allEpisodes = useAppStore((s) => s.episodes);
  const updateProgress = useAppStore((s) => s.updateProgress);
  const addToHistory = useAppStore((s) => s.addToHistory);
  const playbackProgress = useAppStore((s) => s.playbackProgress);
  const defaultAudioLanguage = useAppStore((s) => s.preferences.defaultAudioLanguage);
  const subtitlesEnabled = useAppStore((s) => s.preferences.subtitlesEnabled);
  const autoNextEpisode = useAppStore((s) => s.preferences.autoNextEpisode);
  const defaultQuality = useAppStore((s) => s.preferences.defaultQuality);
  const lastQualityHeight = useAppStore((s) => s.preferences.lastQualityHeight);
  const videoFit = useAppStore((s) => s.preferences.videoFit);
  const subtitleSize = useAppStore((s) => s.preferences.subtitleSize);
  const subtitlePosition = useAppStore((s) => s.preferences.subtitlePosition);
  const subtitleBackground = useAppStore((s) => s.preferences.subtitleBackground);
  const subtitleFont = useAppStore((s) => s.preferences.subtitleFont);
  const updatePreferences = useAppStore((s) => s.updatePreferences);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const favorites = useAppStore((s) => s.favorites);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get('type') as 'live' | 'movie' | 'episode' | null;
  const id = decodePlayerMediaId(searchParams.get('id'));
  const catalogReady = useAppStore((s) => s.catalogReady);
  const storeChannels = useAppStore((s) => s.channels);
  const listId = searchParams.get('listId');
  const fromParam = searchParams.get('from');
  const catId = searchParams.get('catId');
  const customLists = useAppStore((s) => s.customLists);
  const categoryRenames = useAppStore((s) => s.categoryRenames);
  const channelRenames = useAppStore((s) => s.channelRenames);
  const categoryPins = useAppStore(
    (s) => s.categoryPins[activeProfileId ?? 'profile-1'] ?? EMPTY_CATEGORY_IDS
  );
  const categoryOrder = useAppStore(
    (s) => s.categoryOrder[activeProfileId ?? 'profile-1'] ?? EMPTY_CATEGORY_IDS
  );

  const [isFullscreen, setIsFullscreen] = useState(false);
  /**
   * Les contrôles démarrent visibles : play / pause au centre et
   * −10 s / +10 s, puis se cachent après trois secondes de lecture.
   * Un tap les ramène.
   */
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  /**
   * La balise vidéo montée, suivie en état et pas seulement en référence.
   *
   * Une référence se remplit en silence : personne n'est prévenu. Comme
   * l'écran affiche une roue d'attente avant d'avoir relu les données,
   * la balise n'existe pas au premier rendu, et l'abonnement aux
   * événements de la vidéo — qui ne dépendait que de la référence — ne
   * se rejouait jamais. Les boutons restaient donc figés sur leur état
   * de départ. Cet état, lui, provoque un nouveau rendu.
   */
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  /**
   * Posée sur `ref` à la place de la référence nue.
   *
   * React l'appelle avec la balise au montage, puis avec `null` au
   * démontage. On tient les deux à jour : la référence pour les
   * commandes, l'état pour l'abonnement.
   */
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoEl(node);
  }, []);

  /**
   * Secondes restantes avant l'enchainement, `null` quand aucun
   * enchainement n'est en cours. Le decompte est la seule facon
   * d'annuler : sans lui, s'endormir devant un episode en lance six.
   */
  const [countdownState, setCountdownState] = useState<
    { mediaId: string; remaining: number } | null
  >(null);

  const isLive = type === 'live';
  const favoriteType =
    type === 'live' ? 'channel' : type === 'movie' ? 'movie' : type === 'episode' ? 'episode' : null;
  const isFav = Boolean(
    id && favorites.some((f) => f.mediaId === id && f.profileId === (activeProfileId ?? 'profile-1'))
  );

  // Résolution du média : titre, URL du flux et format annoncé.
  //
  // Ces trois informations viennent du catalogue synchronisé. Une URL
  // absente signifie que la source n'a pas été branchée, pas que la
  // lecture a échoué : les deux cas méritent un message différent.
  const channel = isLive && id
    ? (findCatalogItem(id, allChannels) ?? findCatalogItem(id, storeChannels))
    : undefined;
  const movie = type === 'movie' && id ? allMovies.find((m) => m.id === id) : undefined;
  const episode = type === 'episode' && id ? allEpisodes.find((e) => e.id === id) : undefined;

  const mediaTitle = channel
    ? channelDisplayName(channel.id, channel.name, channelRenames)
    : movie?.name ?? episode?.title;
  const streamUrl = channel?.streamUrl ?? movie?.streamUrl ?? episode?.streamUrl ?? null;
  const streamType = channel?.streamType;
  const canUsePictureInPicture = Capacitor.getPlatform() === 'android' && !isTV && Boolean(streamUrl);

  // Reprise de lecture : on ne la cherche que pour un contenu à la
  // demande, un direct n'a pas de position à retenir.
  const savedProgress = !isLive && id
    ? playbackProgress.find((p) => p.mediaId === id)
    : undefined;

  // Enregistrement de la position. Rangé dans un `useCallback` car le
  // hook le garde dans une référence ; une fonction recréée à chaque
  // rendu n'y changerait rien, mais autant éviter le travail inutile.
  const handleProgress = useCallback(
    (position: number, duration: number) => {
      if (!id || !type || isLive) return;
      const percent = duration > 0 ? Math.round((position / duration) * 100) : 0;
      const updatedAt = new Date().toISOString();
      const mediaType = type === 'movie' ? 'movie' : 'episode';
      updateProgress({
        id: `${type}:${id}`,
        mediaId: id,
        mediaType,
        position,
        duration,
        percent,
        updatedAt,
      });
      const title = movie?.name ?? episode?.title;
      if (!title) return;
      const profileId = activeProfileId ?? 'profile-1';
      addToHistory({
        id: `${profileId}:${mediaType}:${id}`,
        profileId,
        mediaId: id,
        mediaType,
        title,
        thumbnail: movie?.logo ?? episode?.image,
        position,
        duration,
        percent,
        watchedAt: updatedAt,
        mediaData:
          mediaType === 'episode' && episode
            ? {
                seriesId: episode.seriesId,
                seasonNumber: episode.seasonNumber,
                episodeNumber: episode.episodeNumber,
              }
            : undefined,
      });
    },
    [id, type, isLive, updateProgress, addToHistory, movie, episode, activeProfileId]
  );

  /**
   * Décompte effectif.
   *
   * Dérivé plutôt que remis à zéro par un effet : le décompte est lié au
   * média qui l'a armé. Changer d'épisode le rend caduc d'office, sans
   * quoi un décompte fantôme détournerait la navigation quelques
   * secondes après un choix manuel dans le menu.
   */
  const nextCountdown =
    countdownState && countdownState.mediaId === id ? countdownState.remaining : null;

  /**
   * Épisode qui suivra celui-ci, `null` s'il n'y en a pas.
   *
   * Calculé même quand l'enchaînement automatique est désactivé : le
   * panneau propose alors le bouton sans lancer le décompte.
   */
  const nextEpisode = useMemo(
    () => (type === 'episode' && id ? findNextEpisode(allEpisodes, id) : null),
    [type, id, allEpisodes]
  );

  /**
   * Horloge du bandeau EPG.
   *
   * Une émission se termine pendant qu'on la regarde : sans réveil
   * périodique, la barre resterait figée sur l'avancement calculé au
   * premier rendu. Trente secondes suffisent à l'œil et ne coûtent rien,
   * même sur un boîtier modeste. La minuterie ne tourne qu'en direct :
   * un film n'a pas de guide.
   */
  const [epgClock, setEpgClock] = useState(() => Date.now());

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => setEpgClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [isLive]);

  /**
   * Bandeau du programme en cours, `null` quand le guide est muet.
   *
   * Muet est le cas courant : beaucoup de listes n'embarquent aucun
   * EPG. L'écran retombe alors sur son affichage habituel, sans ligne
   * vide ni barre à zéro qui laisserait croire à un programme qui
   * vient de commencer.
   */
  const epgView = useMemo(
    () =>
      isLive && channel
        ? buildPlayerEpgView(allPrograms, channel.id, locale, new Date(epgClock))
        : null,
    [isLive, channel, allPrograms, locale, epgClock]
  );

  /**
   * Bascule vers l'épisode suivant.
   *
   * `replace` et non `push`, comme le zapping : enchaîner six épisodes
   * empilerait six entrées, et le bouton Retour obligerait à toutes les
   * remonter avant de sortir du lecteur.
   */
  const goToNextEpisode = useCallback(() => {
    if (!nextEpisode) return;
    setCountdownState(null);
    router.replace(
      `/player?type=episode&id=${encodeURIComponent(nextEpisode.id)}&seriesId=${encodeURIComponent(nextEpisode.seriesId)}`
    );
  }, [nextEpisode, router, setCountdownState]);

  /**
   * Fin naturelle de la vidéo.
   *
   * Rangé dans une référence par le hook : on ne déclenche donc rien
   * ici, on se contente d'armer le décompte. La navigation a lieu quand
   * il arrive à zéro, ou immédiatement si l'utilisateur le demande.
   */
  const handleEnded = useCallback(() => {
    if (!id) return;
    if (!shouldAutoAdvance(type, autoNextEpisode, nextEpisode)) return;
    setCountdownState({ mediaId: id, remaining: AUTO_NEXT_DELAY_SECONDS });
  }, [id, type, autoNextEpisode, nextEpisode, setCountdownState]);

  /**
   * Décompte avant l'enchaînement.
   *
   * La navigation et la décrémentation ont lieu dans le callback du
   * minuteur, jamais dans le corps de l'effet : React interdit d'y
   * appeler `setState` de façon synchrone, ce qui provoquerait des
   * rendus en cascade.
   */
  useEffect(() => {
    if (nextCountdown === null) return;
    const timer = setTimeout(() => {
      if (nextCountdown <= 1) goToNextEpisode();
      else
        setCountdownState((c) =>
          c === null ? null : { ...c, remaining: c.remaining - 1 }
        );
    }, 1000);
    return () => clearTimeout(timer);
  }, [nextCountdown, goToNextEpisode]);

  /**
   * Pistes à sélectionner au démarrage de la vidéo.
   *
   * Mémorisé : un objet recréé à chaque rendu passerait pour une
   * nouvelle valeur et ferait travailler l'effet du hook pour rien.
   *
   * La langue des sous-titres est celle de l'interface, pas la langue
   * audio préférée. Les deux se veulent souvent différentes — un film en
   * version originale anglaise sous-titré en français — et aligner les
   * sous-titres sur l'audio afficherait des sous-titres anglais sur une
   * bande-son anglaise, sans intérêt.
   */
  const trackPreferences = useMemo(
    () => ({
      audioLanguage: defaultAudioLanguage,
      subtitleLanguage: locale,
      subtitlesEnabled,
    }),
    [defaultAudioLanguage, locale, subtitlesEnabled]
  );

  /**
   * Mémorise la hauteur choisie à la main.
   *
   * C'est ce qui fait suivre le choix d'une chaîne à l'autre : à
   * l'ouverture suivante, le lecteur vise la variante la plus proche.
   * Le hook ne connaît pas le store, il se contente de prévenir.
   */
  const handleQualityHeight = useCallback(
    (height: number) => {
      updatePreferences({ lastQualityHeight: height });
    },
    [updatePreferences]
  );

  const player = useVideoPlayer({
    videoRef,
    videoEl,
    url: streamUrl,
    isLive,
    streamType,
    resumeAt: savedProgress?.position,
    onProgress: handleProgress,
    trackPreferences,
    onEnded: handleEnded,
    qualityPolicy: defaultQuality,
    preferredHeight: lastQualityHeight,
    onQualityHeight: handleQualityHeight,
    videoFit,
  });

  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [fitMenuOpen, setFitMenuOpen] = useState(false);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [controlsLocked, setControlsLocked] = useState(false);
  const [showUnlockHint, setShowUnlockHint] = useState(false);
  const [sleepUntil, setSleepUntil] = useState<number | null>(null);
  const [sleepRemainingSeconds, setSleepRemainingSeconds] = useState<number | null>(null);
  const mediaId = id ?? '';
  const [rateMediaId, setRateMediaId] = useState(mediaId);
  const [playbackRate, setPlaybackRate] = useState(1);
  if (rateMediaId !== mediaId) {
    setRateMediaId(mediaId);
    setPlaybackRate(1);
  }
  const lastTapRef = useRef<{ t: number; x: number } | null>(null);
  /** Un tactile synthétise souvent un `mousemove` : sans ça, cacher le chrome le ferait réapparaître. */
  const lastTouchAtRef = useRef(0);

  /**
   * Réglages d'apparence des sous-titres, lus depuis les préférences.
   *
   * Le calque `SubtitleOverlay` et le panneau de réglages partagent le
   * même objet : le panneau modifie les préférences, le calque les
   * applique aussitôt. `useMemo` évite de reconstruire l'objet à chaque
   * rendu, ce qui ferait retravailler le calque pour rien.
   */
  const subtitleAppearance: SubtitleAppearance = useMemo(
    () => ({
      size: subtitleSize,
      position: subtitlePosition,
      background: subtitleBackground,
      font: subtitleFont,
    }),
    [subtitleSize, subtitlePosition, subtitleBackground, subtitleFont]
  );

  /*
    Sélecteur de chaînes.

    Il ne s'ouvre qu'en direct : un film n'a pas de chaîne voisine, et
    le catalogue de chaînes n'aurait aucun sens par-dessus une série.
    Le panneau se pose sur la vidéo sans la démonter, donc la lecture
    continue pendant qu'on parcourt la liste.
  */
  const [browserOpen, setBrowserOpen] = useState(false);
  const sourceList = useMemo(() => {
    if (!listId) return undefined;
    const profileId = activeProfileId ?? 'profile-1';
    return customLists.find((l) => l.id === listId && l.profileId === profileId);
  }, [listId, customLists, activeProfileId]);
  const listChannelIds = useMemo(() => {
    if (!sourceList) return undefined;
    return sourceList.items
      .filter((item) => item.mediaType === 'channel')
      .map((item) => item.mediaId);
  }, [sourceList]);
  const pinnedCategories = useMemo(() => {
    if (!sourceList || !listChannelIds) return undefined;
    const count = listChannelIds.filter((channelId) =>
      Boolean(findCatalogItem(channelId, allChannels) ?? findCatalogItem(channelId, storeChannels))
    ).length;
    if (count === 0) return undefined;
    return [{ id: listCategoryId(sourceList.id), name: sourceList.name, count }];
  }, [sourceList, listChannelIds, allChannels, storeChannels]);
  const liveCategoriesForBrowser = useMemo(() => {
    const { pinned, rest } = layoutCategories(
      allLiveCategories,
      categoryPins,
      categoryOrder
    );
    return [...pinned, ...rest].map((category) => ({
      ...category,
      name: categoryDisplayName(category.id, category.name, categoryRenames),
    }));
  }, [allLiveCategories, categoryPins, categoryOrder, categoryRenames]);
  const channelsForBrowser = useMemo(
    () =>
      allChannels.map((ch) => ({
        ...ch,
        name: channelDisplayName(ch.id, ch.name, channelRenames),
      })),
    [allChannels, channelRenames]
  );
  const canBrowseChannels = isLive && allChannels.length > 0;
  const showChannelBrowser = browserOpen && canBrowseChannels;
  const liveZapContext = { listId, from: fromParam, catId };

  /**
   * Voisins du zapping : ceux du contexte d'ouverture, pas tout le
   * catalogue. Liste perso (ordre de la liste), favoris, ou catégorie.
   */
  const zapChannels = useMemo(() => {
    if (listChannelIds && listChannelIds.length > 0) {
      return listChannelIds
        .map((channelId) => findCatalogItem(channelId, allChannels) ?? findCatalogItem(channelId, storeChannels))
        .filter((channel): channel is LiveChannel => Boolean(channel));
    }
    if (fromParam === 'favorites') {
      const ids = new Set(
        favorites
          .filter((fav) => fav.mediaType === 'channel' && fav.profileId === (activeProfileId ?? 'profile-1'))
          .map((fav) => fav.mediaId)
      );
      return allChannels.filter((channel) => ids.has(channel.id));
    }
    if (catId) {
      return allChannels.filter((channel) => channelMatchesCategory(channel.categoryId, catId));
    }
    return allChannels;
  }, [allChannels, storeChannels, listChannelIds, fromParam, catId, favorites, activeProfileId]);

  /**
   * Programme en cours de chaque chaîne, pour le panneau de zapping.
   *
   * Calculé ici et non dans le panneau : celui-ci se redessine à chaque
   * frappe dans son champ de recherche, alors que le guide, lui, ne
   * change qu'au rythme de l'horloge. Le calcul est donc rattaché à ce
   * qui le fait vraiment varier.
   *
   * Reste indéfini tant que le panneau est fermé : inutile de parcourir
   * des milliers de programmes pour un panneau que personne ne regarde.
   */
  const channelEpgMap = useMemo(
    () =>
      showChannelBrowser && allPrograms.length > 0
        ? buildChannelEpgMap(allPrograms, new Date(epgClock))
        : undefined,
    [showChannelBrowser, allPrograms, epgClock]
  );

  // Un seul bouton « Piste audio & sous-titres » : il apparaît dès que le
  // flux offre un choix (au moins deux pistes audio, ou au moins un
  // sous-titre). Un flux sans piste sélectionnable (mpegts.js, MP4) ne
  // montre rien, conforme à la doctrine « pas de bouton sans action
  // possible ».
  const canChooseTracks = hasSelectableTracks(player.tracks);
  // Le calque custom s'affiche dès qu'une piste de sous-titres est
  // active. Pour hls.js c'est le calque qui rend ; en lecture native la
  // source est `null` et le navigateur affiche de son côté, sans
  // double rendu.
  const subtitleEnabled = (player.tracks?.activeSubtitleId ?? null) !== null;
  // Ouvert seulement s'il y a de quoi choisir ; sinon le panneau n'aurait
  // rien à offrir et on ne laisse pas un panneau vide en suspens.
  const showTrackMenu = subtitleMenuOpen && canChooseTracks && player.tracks !== null;

  /**
   * Sélectionne une piste de sous-titres depuis le panneau (interrupteur
   * inclus, qui envoie `null` pour couper). Garde `subtitlesEnabled` en
   * phase : la sélection automatique du prochain flux s'en sert pour
   * rouvrir les réglages de l'utilisateur.
   */
  const handleSubtitleSelectTrack = useCallback(
    (id: string | null) => {
      player.tracks?.selectSubtitle(id);
      updatePreferences({ subtitlesEnabled: id !== null });
    },
    [player.tracks, updatePreferences]
  );

  /** Sélection d'une piste audio depuis le même panneau. */
  const handleSelectAudio = useCallback(
    (id: string) => {
      player.tracks?.selectAudio(id);
    },
    [player.tracks]
  );

  // Le flux peut perdre ses pistes en cours de route : changement de
  // chaine, ou repli sur un moteur qui n'en expose pas.
  //
  // Deux variantes au minimum pour qu'un choix existe. Un flux MPEG-TS
  // n'en expose aucune, un flux a variante unique n'offre rien a
  // choisir : dans les deux cas le bouton disparait, conformement a la
  // doctrine << pas de bouton sans action possible >>.
  const canChooseQuality = (player.quality?.levels.length ?? 0) > 1;
  const showQualityMenu = qualityMenuOpen && canChooseQuality && player.quality !== null;

  // Zapping chaine par chaine.
  //
  // On cherche la position de la chaine courante dans le catalogue, puis
  // on prend la voisine. Le modulo ramene au debut apres la derniere et
  // a la fin avant la premiere : sur un televiseur, zapper au-dela du
  // dernier canal revient au premier, personne ne s'attend a un
  // cul-de-sac. Si le catalogue est vide ou ne contient qu'une chaine,
  // les deux boutons restent inertes et sont donc desactives.
  const channelIndex = isLive && id ? zapChannels.findIndex((c) => c.id === id) : -1;
  const canZap = isLive && channelIndex !== -1 && zapChannels.length > 1;
  const prevChannel = canZap
    ? zapChannels[(channelIndex - 1 + zapChannels.length) % zapChannels.length]
    : undefined;
  const nextChannel = canZap
    ? zapChannels[(channelIndex + 1) % zapChannels.length]
    : undefined;

  const goToChannel = (offset: number) => {
    if (!canZap) return;
    const total = zapChannels.length;
    const next = zapChannels[(channelIndex + offset + total) % total];
    if (!next) return;
    // `replace` et non `push` : sans cela, zapper quinze fois empilerait
    // quinze entrees dans l'historique, et le bouton Retour obligerait a
    // les remonter une par une avant de sortir du lecteur.
    router.replace(livePlayerHref(next.id, liveZapContext));
  };

  /*
    Choix d'une chaîne dans le sélecteur.

    On emprunte exactement le chemin du zapping : même `router.replace`,
    donc même comportement d'historique et même remise en route du
    lecteur. La seule différence est le point de départ — une liste
    plutôt qu'une voisine immédiate.

    On referme le panneau dans la foulée : l'utilisateur a fait son
    choix, il veut voir l'image, pas la liste.
  */
  const handleSelectChannel = (next: LiveChannel) => {
    setBrowserOpen(false);
    if (next.id === id) return;
    const inRing = zapChannels.some((channel) => channel.id === next.id);
    router.replace(livePlayerHref(next.id, inRing ? liveZapContext : undefined));
  };

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    if (player.isPlaying) {
      controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [player.isPlaying, setShowControls]);

  useEffect(() => {
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
  }, []);

  /**
   * En lecture, cacher le chrome au bout de trois secondes.
   *
   * `setShowControls` est dans le timeout, pas dans le corps de
   * l'effet : React interdit d'y poser un état de façon synchrone.
   * En pause, on coupe le minuteur et on laisse les boutons affichés.
   */
  useEffect(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (!player.isPlaying) return;
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [player.isPlaying]);

  useWakeLock(player.isPlaying && !player.error);

  useEffect(() => {
    const node = videoRef.current;
    if (node) node.playbackRate = playbackRate;
  }, [videoEl, playbackRate]);

  useEffect(() => {
    if (sleepUntil === null) return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((sleepUntil - Date.now()) / 1000));
      if (left <= 0) {
        setSleepUntil(null);
        setSleepRemainingSeconds(null);
        videoRef.current?.pause();
        setShowControls(true);
      } else {
        setSleepRemainingSeconds(left);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sleepUntil]);

  useEffect(() => {
    if (!showUnlockHint) return;
    const timer = setTimeout(() => setShowUnlockHint(false), 3000);
    return () => clearTimeout(timer);
  }, [showUnlockHint]);

  const currentQualityLabel = (() => {
    const q = player.quality;
    if (!q || q.levels.length === 0) return null;
    const index = q.currentLevel >= 0 ? q.currentLevel : 0;
    const level = q.levels[index];
    if (!level) return null;
    return qualityLabel(level, index);
  })();

  const edgeKindAt = (clientX: number): 'brightness' | 'volume' | null => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return null;
    const rel = (clientX - box.left) / box.width;
    if (rel <= 0.16) return 'brightness';
    if (rel >= 0.84) return 'volume';
    return null;
  };

  const applyEdgeValue = (kind: 'volume' | 'brightness', raw: number) => {
    const value = Math.max(0, Math.min(100, raw));
    if (kind === 'brightness') setBrightness(value);
    else player.setVolume(value);
    setEdgeHud({ kind, value });
  };

  const handleEdgePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (controlsLocked) return;
    if (showChannelBrowser) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, [role="slider"], [role="dialog"], input')) return;
    const kind = edgeKindAt(event.clientX);
    if (!kind) return;
    edgeDragRef.current = {
      kind,
      startY: event.clientY,
      startValue: kind === 'brightness' ? brightness : player.isMuted ? 0 : player.volume,
      active: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture refusee : le glissement s'arretera en quittant l'ecran.
    }
  };

  const handleEdgePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = edgeDragRef.current;
    if (!drag) return;
    const dy = drag.startY - event.clientY;
    if (!drag.active && Math.abs(dy) < 12) return;
    drag.active = true;
    skipClickRef.current = true;
    const box = containerRef.current?.getBoundingClientRect();
    const range = box && box.height > 0 ? box.height * 0.42 : 280;
    applyEdgeValue(drag.kind, drag.startValue + (dy / range) * 100);
    if (edgeHideTimer.current) clearTimeout(edgeHideTimer.current);
  };

  const handleEdgePointerUp = () => {
    const drag = edgeDragRef.current;
    edgeDragRef.current = null;
    if (!drag?.active) return;
    if (edgeHideTimer.current) clearTimeout(edgeHideTimer.current);
    edgeHideTimer.current = setTimeout(() => setEdgeHud(null), 900);
  };

  const handleSurfaceClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    if (controlsLocked) {
      setShowUnlockHint(true);
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, [role="slider"], [role="dialog"]')) {
      resetControlsTimer();
      return;
    }

    if (!isLive && streamUrl) {
      const now = Date.now();
      const x = event.clientX;
      const last = lastTapRef.current;
      if (last && now - last.t < 300 && Math.abs(x - last.x) < 120) {
        lastTapRef.current = null;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0) {
          const rel = (x - rect.left) / rect.width;
          if (rel < 0.4) player.seekBy(-10);
          else if (rel > 0.6) player.seekBy(10);
        }
        return;
      }
      lastTapRef.current = { t: now, x };
    }

    if (showControls) {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      setShowControls(false);
      return;
    }
    resetControlsTimer();
  };


  /**
   * Position affichee pendant un glissement.
   *
   * Tant que le doigt est pose, la barre doit suivre le doigt et le
   * compteur afficher l'heure visee, pas celle de la video : le saut
   * n'a pas encore eu lieu.
   */
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  /** 100 = image intacte. Pas la luminosité système : un voile sur la vidéo. */
  const [brightness, setBrightness] = useState(100);
  const [edgeHud, setEdgeHud] = useState<{ kind: 'volume' | 'brightness'; value: number } | null>(null);
  const edgeDragRef = useRef<{
    kind: 'volume' | 'brightness';
    startY: number;
    startValue: number;
    active: boolean;
  } | null>(null);
  const skipClickRef = useRef(false);
  const edgeHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayedTime = seekPreview ?? player.currentTime;

  const handleSeekCommit = useCallback(
    (seconds: number) => {
      setSeekPreview(null);
      player.seekTo(seconds);
      resetControlsTimer();
    },
    [player, resetControlsTimer, setSeekPreview]
  );

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, [setIsFullscreen]);

  // Raccourcis clavier et télécommande.
  //
  // Une télécommande de téléviseur n'envoie pas d'événements exotiques :
  // le pavé directionnel produit ArrowUp/Down/Left/Right, le bouton
  // central Enter, et le retour arrière soit Escape, soit Backspace
  // (Fire TV, Android TV). Les touches média existent sur les modèles
  // qui en sont équipés. On écoute donc au niveau du document, sinon
  // rien ne fonctionne tant qu'un bouton précis n'a pas le focus.
  //
  // Les flèches agissent désormais sur la vidéo réelle : dix secondes
  // d'avance ou de recul, comme sur tous les lecteurs du marché, et non
  // plus dix pour cent d'une barre décorative.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Panneau Chaînes ouvert : ses propres écouteurs gèrent clavier et saisie.
      if (showChannelBrowser) return;

      // Ne pas détourner les touches quand l'utilisateur saisit du texte.
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      // Un curseur qui a le focus gere lui-meme les fleches. Il appelle
      // deja `stopPropagation`, mais on ne se repose pas dessus : si
      // React changeait la racine ou il attache ses ecouteurs, un appui
      // compterait double (vingt secondes au lieu de dix).
      if (target?.closest('[role="slider"]')) return;

      switch (event.key) {
        case ' ':
        case 'Enter':
        case 'MediaPlayPause':
          event.preventDefault();
          player.togglePlay();
          break;
        case 'MediaPlay':
        case 'MediaPause':
          player.togglePlay();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          // Un direct ne se rembobine pas : le serveur n'envoie que le
          // présent. On réserve les flèches au zapping dans ce cas.
          if (isLive) goToChannel(-1);
          else player.seekBy(-10);
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (isLive) goToChannel(1);
          else player.seekBy(10);
          break;
        case 'ArrowUp':
          event.preventDefault();
          player.setVolume(player.volume + 5);
          break;
        case 'ArrowDown':
          event.preventDefault();
          player.setVolume(player.volume - 5);
          break;
        case 'm':
        case 'M':
          player.toggleMute();
          break;
        case 'f':
        case 'F':
          void toggleFullscreen();
          break;
        case 'Escape':
        case 'Backspace':
        case 'GoBack':
          // Un decompte en cours se coupe en premier : quitter le
          // lecteur alors qu'on voulait juste annuler l'enchainement
          // serait la mauvaise interpretation du geste.
          if (nextCountdown !== null) {
            event.preventDefault();
            setCountdownState(null);
            break;
          }
          // En plein écran, le retour doit d'abord en sortir.
          if (document.fullscreenElement) {
            void document.exitFullscreen();
            setIsFullscreen(false);
          } else {
            router.back();
          }
          break;
        default:
          return;
      }
      // Toute interaction réaffiche les contrôles.
      resetControlsTimer();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, isLive, router, resetControlsTimer, toggleFullscreen, nextCountdown, showChannelBrowser]);

  // Voir useHydrated : le titre du média est cherché dans le catalogue.
  // Avant relecture des données enregistrées ce catalogue est vide, donc
  // le lecteur s'ouvrait un instant sans titre. On garde le même
  // indicateur de chargement que celui du Suspense, pour la continuité.
  const hydrated = useHydrated();

  if (!hydrated || !catalogReady) {
    return (
      <div className="cinema min-h-dvh bg-black flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'cinema relative flex items-center justify-center overflow-hidden select-none',
        player.usesNativeSurface ? 'bg-transparent' : 'bg-black',
        isFullscreen ? 'fixed inset-0 z-[100]' : 'min-h-dvh w-full'
      )}
      onMouseMove={() => {
        if (controlsLocked) return;
        if (Date.now() - lastTouchAtRef.current < 800) return;
        resetControlsTimer();
      }}
      onClick={handleSurfaceClick}
      onPointerDown={handleEdgePointerDown}
      onPointerMove={handleEdgePointerMove}
      onPointerUp={handleEdgePointerUp}
      onPointerCancel={handleEdgePointerUp}
      onTouchStart={() => {
        lastTouchAtRef.current = Date.now();
      }}
    >
      {/* Balise vidéo réelle.
          Elle est toujours montée, même sans URL : le hook a besoin de
          la référence avant de pouvoir attacher quoi que ce soit.
          `playsInline` empêche iOS d'ouvrir son lecteur plein écran de
          force, ce qui volerait tous nos contrôles. */}
      <video
        ref={attachVideo}
        className={cn(
          'absolute inset-0 w-full h-full',
          player.usesNativeSurface ? 'invisible bg-transparent' : 'bg-black',
          streamUrl ? videoFitClassName(videoFit) : 'hidden'
        )}
        playsInline
        // Pas de `controls` : l'interface ci-dessous les remplace, et
        // les contrôles natifs ne sont pas navigables à la télécommande.
      />

      {/* Calque custom des sous-titres.
          Peint les répliques selon les réglages (taille, position, fond,
          police). Posé SUR la vidéo mais SOUS les contrôles, et son
          `pointer-events-none` laisse les gestes traverser. Pour la
          lecture native il ne s'affiche pas : `player.subtitles.active`
          reste faux, le navigateur assurant seul son propre rendu. */}
      {streamUrl && brightness < 100 && (
        <div
          className="absolute inset-0 z-[15] bg-black pointer-events-none"
          style={{ opacity: ((100 - brightness) / 100) * 0.72 }}
          aria-hidden
        />
      )}

      {edgeHud && <EdgeLevelHud kind={edgeHud.kind} value={edgeHud.value} />}

      {player.subtitles.active && (
        <SubtitleOverlay
          cues={player.subtitles.cues}
          currentTime={player.currentTime}
          active={player.subtitles.active}
          appearance={subtitleAppearance}
        />
      )}

      {/* Aucune source branchée : ce n'est pas une erreur de lecture. */}
      {!streamUrl && (
        <div className="absolute inset-0 bg-gradient-to-br from-black via-surface-0 to-surface-0 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/10">
              {isLive ? (
                <Radio className="w-8 h-8 text-accent" />
              ) : (
                <Play className="w-8 h-8 text-white/40 ml-1" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">{mediaTitle || t('player.defaultTitle')}</p>
              <p className="text-white/30 text-xs max-w-xs mx-auto">
                {isLive
                  ? t('player.noSourceLive')
                  : t('player.noSourceContent')}
              </p>
              <a
                href="/playlists"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent-hover transition-colors"
              >
                {t('player.addSource')}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Chargement du flux : calque noir, pas le blanc du WebView. */}
      {streamUrl && player.isLoading && !player.error && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-white/60 text-sm" role="status" aria-live="polite">
            {t('player.loading')}
          </p>
        </div>
      )}

      {/* Mémoire tampon en cours de lecture : plus discret qu'une
          erreur, la lecture va reprendre toute seule. */}
      {streamUrl && !player.isLoading && player.isBuffering && !player.error && (
        <div className="absolute inset-0 bg-black flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-black/80">
            <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span className="text-white/80 text-xs" role="status" aria-live="polite">
              {t('player.buffering')}
            </span>
          </div>
        </div>
      )}

      {/* Panne de lecture. */}
      {player.error && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm" role="alert">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <div className="space-y-2">
              <p className="text-white text-base font-semibold">
                {t(ERROR_TITLE_KEYS[player.error.kind])}
              </p>
              <p className="text-white/50 text-sm">
                {t(ERROR_DESCRIPTION_KEYS[player.error.kind])}
              </p>
            </div>
            <button
              type="button"
              onClick={player.retry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <RotateCcw className="w-4 h-4" />
              {t('player.retry')}
            </button>
          </div>
        </div>
      )}

      {/* Overlay gradient */}
      <div className={cn(
        'absolute inset-0 transition-opacity duration-300 pointer-events-none',
        showControls ? 'opacity-100' : 'opacity-0'
      )}>
        {/* Top bar gradient */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/80 to-transparent" />
        {/* Bottom bar gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/90 to-transparent" />
      </div>

      {/* Controls overlay */}
      <div className={cn(
        'absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-300',
        'pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        'ps-[max(0.75rem,env(safe-area-inset-left))] pe-[max(0.75rem,env(safe-area-inset-right))]',
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}>
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            type="button"
            aria-label={t('common.back')}
            className="w-12 h-12 flex-shrink-0 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/*
            Identite de ce qu'on regarde.

            Le logo precede le nom, comme dans le panneau de zapping :
            l'oeil reconnait une chaine a son logo bien avant d'avoir lu
            son nom. La ligne du dessous repond a la deuxieme question,
            « qu'est-ce qui passe » ; elle disparait entierement quand le
            guide est muet, plutot que d'afficher un tiret.

            `min-w-0` sur le conteneur ET sur le bloc de texte : sans
            cela, `truncate` n'a aucun effet dans une boite flex, dont la
            largeur minimale par defaut est celle du contenu.
          */}
          <div className="flex items-center gap-2.5 min-w-0">
            {isLive && channel && (
              <ImageWithFallback
                src={channel.logo}
                alt=""
                className="w-11 h-11 rounded-xl object-contain bg-white/10 flex-shrink-0"
                fallbackClassName="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-white/25"
                fallback={<Radio className="w-4 h-4" />}
              />
            )}
            <div className="min-w-0">
              <p className="text-base font-semibold text-white truncate max-w-48 md:max-w-xs drop-shadow">
                {mediaTitle}
              </p>
              {epgView && (
                <p className="text-xs text-white/70 truncate max-w-48 md:max-w-xs drop-shadow">
                  {epgView.title} · {t('player.epgUntil', { time: epgView.endLabel })}
                </p>
              )}
            </div>
            {isLive && <Badge variant="live" size="sm" pulse>{t('liveTV.liveBadge')}</Badge>}
          </div>

          {/*
            Groupe d'actions.

            Ces boutons vivaient jusqu'ici comme enfants directs de la
            barre, qui est en `justify-between` : cette regle repartit
            l'espace ENTRE CHAQUE enfant, elle les eparpillait donc sur
            toute la largeur. Reunis dans un conteneur unique, ils ne
            comptent plus que pour un seul enfant : l'espace se place
            avant le groupe, plus entre les boutons, et `gap-2` fixe
            lui-meme leur ecartement. Ils forment un bloc soude, cale a
            droite, ou l'oeil trouve toutes les commandes au meme
            endroit.

            L'ordre suit la frequence d'usage decroissante en partant du
            bord : ajustement, qualite, pistes.
          */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {id && favoriteType && (
              <button
                type="button"
                onClick={() => toggleFavorite(id, favoriteType)}
                aria-label={isFav ? t('common.removeFromFavorites') : t('common.addToFavorites')}
                aria-pressed={isFav}
                className="w-12 h-12 flex-shrink-0 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <Heart className={cn('w-5 h-5', isFav && 'fill-accent text-accent')} />
              </button>
            )}

            {/* Toujours present, contrairement aux deux autres :
                l'ajustement ne depend pas de ce que le flux publie, il y
                a donc toujours trois modes a offrir. */}
            <button
              type="button"
              onClick={() => setFitMenuOpen(true)}
              aria-label={t('player.fitTitle')}
              aria-haspopup="dialog"
              className="w-12 h-12 flex-shrink-0 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <Ratio className="w-5 h-5" />
            </button>

            {/* Deux variantes au minimum, sinon rien a choisir : un flux
                MPEG-TS n'en publie aucune. Doctrine de la Phase 4 : un
                bouton sans action possible est retire, pas grise. */}
            {canChooseQuality && (
              <button
                type="button"
                onClick={() => setQualityMenuOpen(true)}
                aria-label={currentQualityLabel
                  ? `${t('player.qualityTitle')} ${currentQualityLabel}`
                  : t('player.qualityTitle')}
                aria-haspopup="dialog"
                className="h-12 flex-shrink-0 px-3 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center gap-1.5 text-white/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <Settings className="w-5 h-5" />
                {currentQualityLabel && (
                  <span className="text-[11px] font-semibold tabular-nums">{currentQualityLabel}</span>
                )}
              </button>
            )}

            {/* Un seul bouton « Piste audio & sous-titres » : il ouvre le
                panneau qui regroupe le choix de la piste audio, le choix
                de la piste de sous-titres et tous les réglages
                d'apparence (taille, position, fond, police) + aperçu.
                L'ancien couple « Pistes » + « Réglages sous-titres »
                affichait la sélection de sous-titres deux fois. */}
            {canChooseTracks && (
              <button
                type="button"
                onClick={() => setSubtitleMenuOpen(true)}
                aria-label={t('player.tracksTitle')}
                aria-haspopup="dialog"
                className="w-12 h-12 flex-shrink-0 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <Captions className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-8 sm:gap-14">
            {!isLive && (
              <SkipArcButton
                direction="back"
                label={t('player.rewind')}
                disabled={!streamUrl}
                onClick={(event) => {
                  event.stopPropagation();
                  player.seekBy(-10);
                  resetControlsTimer();
                }}
              />
            )}
            <button
              className="flex h-20 w-20 items-center justify-center bg-transparent text-white pointer-events-auto transition-opacity hover:opacity-80 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white"
              onClick={(event) => {
                event.stopPropagation();
                player.togglePlay();
                resetControlsTimer();
              }}
              disabled={!streamUrl}
              type="button"
              aria-label={player.isPlaying ? t('common.pause') : t('player.playAction')}
            >
              {player.isPlaying ? (
                <Pause className="h-11 w-11 fill-white text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]" />
              ) : (
                <Play className="ml-1 h-11 w-11 fill-white text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]" />
              )}
            </button>
            {!isLive && (
              <SkipArcButton
                direction="forward"
                label={t('player.forward')}
                disabled={!streamUrl}
                onClick={(event) => {
                  event.stopPropagation();
                  player.seekBy(10);
                  resetControlsTimer();
                }}
              />
            )}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="space-y-3">
          {isLive && (
            <div className="rounded-[1.4rem] bg-black/55 backdrop-blur-md px-4 py-3">
              <div className="flex items-center gap-3">
                {channel && (
                  <ImageWithFallback
                    src={channel.logo}
                    alt=""
                    className="h-12 w-12 flex-shrink-0 rounded-xl object-contain bg-white/10"
                    fallbackClassName="h-12 w-12 flex-shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-white/25"
                    fallback={<Radio className="h-5 w-5" />}
                  />
                )}
                <div className="min-w-0 flex-1">
                  {epgView ? (
                    <>
                      <p className="truncate text-[15px] font-semibold text-white">
                        {epgView.title}
                        {epgView.remainingMinutes !== null && (
                          <span className="font-normal text-white/55">
                            {' '}· {t('player.epgRemaining', { count: epgView.remainingMinutes })}
                          </span>
                        )}
                      </p>
                      {epgView.nextTitle && epgView.nextStartLabel && (
                        <p className="mt-0.5 truncate text-[13px] text-white/50">
                          {t('player.epgFollows', {
                            title: epgView.nextTitle,
                            time: epgView.nextStartLabel,
                          })}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3">
                        <span className="w-10 flex-shrink-0 text-[11px] tabular-nums text-white/50">
                          {epgView.startLabel}
                        </span>
                        <div
                          role="progressbar"
                          aria-label={t('player.epgProgress')}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={epgView.percent}
                          aria-valuetext={`${epgView.percent} %`}
                          className="h-1 flex-1 overflow-hidden rounded-full bg-white/20"
                        >
                          <div
                            className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
                            style={{ width: `${epgView.percent}%` }}
                          />
                        </div>
                        <span className="w-10 flex-shrink-0 text-right text-[11px] tabular-nums text-white/50">
                          {epgView.endLabel}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="truncate text-[15px] font-semibold text-white">{mediaTitle}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isLive && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70 w-14 tabular-nums">
                {formatTime(displayedTime)}
              </span>
              <Slider
                value={displayedTime}
                max={player.duration}
                step={10}
                onPreview={setSeekPreview}
                onCommit={handleSeekCommit}
                label={t('player.progress')}
                valueText={formatTime(displayedTime)}
                disabled={!streamUrl}
                thick
                className="flex-1"
              />
              <span className="text-sm text-white/70 w-14 text-right tabular-nums">
                {player.duration > 0 ? formatTime(player.duration) : '--:--'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto scrollbar-none">
            {!isLive && (
              <button
                onClick={() => player.seekBy(-10)}
                disabled={!streamUrl}
                type="button"
                aria-label={t('player.rewind')}
                className="w-12 h-12 flex-shrink-0 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <SkipBack className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={player.togglePlay}
              disabled={!streamUrl}
              type="button"
              aria-label={player.isPlaying ? t('common.pause') : t('player.playAction')}
              className="w-12 h-12 flex-shrink-0 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {player.isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
            </button>

            {!isLive && (
              <button
                onClick={() => player.seekBy(10)}
                disabled={!streamUrl}
                type="button"
                aria-label={t('player.forward')}
                className="w-12 h-12 flex-shrink-0 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            )}

            {isLive && (
              <>
                <button
                  type="button"
                  aria-label={t('player.previousChannel')}
                  disabled={!canZap}
                  onClick={() => goToChannel(-1)}
                  className="h-12 max-w-[9.5rem] flex-shrink-0 rounded-full bg-black/50 backdrop-blur-md px-3.5 flex items-center gap-1.5 text-white hover:bg-black/70 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                  <span className="min-w-0 truncate text-[13px] font-semibold">
                    {prevChannel
                      ? channelDisplayName(prevChannel.id, prevChannel.name, channelRenames)
                      : t('player.previousChannel')}
                  </span>
                </button>

                {canBrowseChannels && (
                  <button
                    type="button"
                    onClick={() => setBrowserOpen(true)}
                    aria-label={t('player.channelListOpen')}
                    aria-haspopup="dialog"
                    aria-expanded={browserOpen}
                    className={cn(
                      'h-12 flex-shrink-0 px-4 rounded-full backdrop-blur-md flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                      browserOpen
                        ? 'bg-accent text-white'
                        : 'bg-black/50 text-white hover:bg-black/70'
                    )}
                  >
                    <List className="w-5 h-5" />
                    <span className="text-[13px] font-semibold">
                      {t('common.channels')}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  aria-label={t('player.nextChannel')}
                  disabled={!canZap}
                  onClick={() => goToChannel(1)}
                  className="h-12 max-w-[9.5rem] flex-shrink-0 rounded-full bg-black/50 backdrop-blur-md px-3.5 flex items-center gap-1.5 text-white hover:bg-black/70 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <span className="min-w-0 truncate text-[13px] font-semibold">
                    {nextChannel
                      ? channelDisplayName(nextChannel.id, nextChannel.name, channelRenames)
                      : t('player.nextChannel')}
                  </span>
                  <ChevronRight className="w-5 h-5 flex-shrink-0" />
                </button>
              </>
            )}

            {nextEpisode && (
              <button
                type="button"
                onClick={goToNextEpisode}
                aria-label={t('player.nextEpisodeGo', { code: episodeCode(nextEpisode) })}
                className="h-12 flex-shrink-0 px-3.5 rounded-full bg-black/50 backdrop-blur-md flex items-center gap-2 text-white/90 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <SkipForward className="w-5 h-5" />
                <span className="text-[13px] font-semibold hidden sm:inline">
                  {episodeCode(nextEpisode)}
                </span>
              </button>
            )}
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
            {showMuteButton && (
            <button
              onClick={player.toggleMute}
              type="button"
              aria-label={player.isMuted ? t('player.unmute') : t('player.mute')}
              aria-pressed={player.isMuted}
              className="w-12 h-12 flex-shrink-0 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {player.isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            )}

            {!isLive && (
              <button
                type="button"
                onClick={() => setSpeedMenuOpen(true)}
                aria-label={t('player.speedTitle')}
                aria-haspopup="dialog"
                className="h-12 flex-shrink-0 px-3 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center gap-1 text-white/90 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <Gauge className="w-5 h-5" />
                <span className="text-[11px] font-semibold tabular-nums">
                  {t('player.speedValue', { rate: String(playbackRate).replace('.', ',') })}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSleepMenuOpen(true)}
              aria-label={t('player.sleepTitle')}
              aria-haspopup="dialog"
              className={cn(
                'h-12 flex-shrink-0 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center gap-1 text-white/90 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                sleepRemainingSeconds !== null ? 'px-3' : 'w-12'
              )}
            >
              <Timer className="w-5 h-5" />
              {sleepRemainingSeconds !== null && (
                <span className="text-[11px] font-semibold tabular-nums">
                  {formatTime(sleepRemainingSeconds)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setControlsLocked(true);
                setShowControls(false);
                setShowUnlockHint(true);
              }}
              aria-label={t('player.lockControls')}
              className="w-12 h-12 flex-shrink-0 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <Lock className="w-5 h-5" />
            </button>

            {canUsePictureInPicture && (
            <button
              type="button"
              onClick={() => void NativeVodPlayer.enterPictureInPicture()}
              aria-label={t('player.pictureInPicture')}
              className="w-12 h-12 flex-shrink-0 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <PictureInPictureIcon className="w-5 h-5" />
            </button>
            )}

            {showFullscreenButton && (
            <button
              onClick={toggleFullscreen}
              type="button"
              aria-label={isFullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
              className="w-12 h-12 flex-shrink-0 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Panneau « Episode suivant ».
          Affiche des que le decompte est arme, INDEPENDAMMENT de
          `showControls` : les controles s'effacent au bout de trois
          secondes, ce qui ferait disparaitre le bouton d'annulation en
          plein decompte. */}
      {nextCountdown !== null && nextEpisode && (
        <div className="absolute bottom-6 right-6 z-20 w-72 max-w-[calc(100%-3rem)] rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 p-4 shadow-2xl">
          <p className="text-xs uppercase tracking-wider text-white/40 mb-1">
            {t('player.nextEpisodeTitle')}
          </p>
          <p className="text-sm font-semibold text-white truncate">
            {episodeCode(nextEpisode)} · {nextEpisode.title}
          </p>
          <p className="text-xs text-white/50 mt-1" aria-live="polite">
            {t('player.nextEpisodeIn', { count: nextCountdown })}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={goToNextEpisode}
              autoFocus
              className="flex-1 px-3 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {t('player.nextEpisodeNow')}
            </button>
            <button
              type="button"
              onClick={() => setCountdownState(null)}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {t('player.nextEpisodeCancel')}
            </button>
          </div>
        </div>
      )}

      {showQualityMenu && player.quality && (
        <QualityMenu
          quality={player.quality}
          onSelect={player.selectQuality}
          onClose={() => setQualityMenuOpen(false)}
        />
      )}

      {showTrackMenu && player.tracks && (
        <AudioSubtitleMenu
          controller={player.tracks}
          enabled={subtitleEnabled}
          appearance={subtitleAppearance}
          onSelectAudio={handleSelectAudio}
          onSelectTrack={handleSubtitleSelectTrack}
          onSize={(size) => updatePreferences({ subtitleSize: size })}
          onPosition={(position) => updatePreferences({ subtitlePosition: position })}
          onBackground={(background) => updatePreferences({ subtitleBackground: background })}
          onFont={(font) => updatePreferences({ subtitleFont: font })}
          onClose={() => setSubtitleMenuOpen(false)}
        />
      )}

      {fitMenuOpen && (
        <FitMenu
          current={videoFit}
          onSelect={(mode) => updatePreferences({ videoFit: mode })}
          onClose={() => setFitMenuOpen(false)}
        />
      )}

      {showChannelBrowser && (
        <ChannelBrowser
          key={pinnedCategories?.[0]?.id ?? 'catalog'}
          channels={channelsForBrowser}
          categories={liveCategoriesForBrowser}
          pinnedCategories={pinnedCategories}
          listChannelIds={listId ? zapChannels.map((channel) => channel.id) : listChannelIds}
          currentChannelId={id}
          epgByChannel={channelEpgMap}
          onSelect={handleSelectChannel}
          onClose={() => setBrowserOpen(false)}
        />
      )}

      {controlsLocked && (
        <div className="absolute inset-0 z-[110]">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={t('player.unlockControls')}
            onClick={() => setShowUnlockHint(true)}
          />
          {showUnlockHint && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setControlsLocked(false);
                setShowUnlockHint(false);
                resetControlsTimer();
              }}
              aria-label={t('player.unlockControls')}
              className="absolute top-1/2 left-1/2 z-[111] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white border border-white/15"
            >
              <LockOpen className="w-7 h-7" />
            </button>
          )}
        </div>
      )}

      {sleepMenuOpen && (
        <SleepMenu
          remainingSeconds={sleepRemainingSeconds}
          onSelectMinutes={(minutes) => {
            if (minutes === null) {
              setSleepUntil(null);
              setSleepRemainingSeconds(null);
            } else {
              setSleepUntil(Date.now() + minutes * 60_000);
              setSleepRemainingSeconds(minutes * 60);
            }
          }}
          onClose={() => setSleepMenuOpen(false)}
        />
      )}

      {speedMenuOpen && (
        <SpeedMenu
          current={playbackRate}
          onSelect={setPlaybackRate}
          onClose={() => setSpeedMenuOpen(false)}
        />
      )}

    </div>
  );
}

export function PlayerPage() {
  return (
    <Suspense fallback={
      <div className="cinema min-h-dvh bg-black flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    }>
      <PlayerContent />
    </Suspense>
  );
}
