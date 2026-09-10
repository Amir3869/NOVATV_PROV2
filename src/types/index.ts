// ============================================================
// Core IPTV Types for NovaTV
// ============================================================

import type { QualityPolicy } from '@/services/player/qualityLadder';
import type { VideoFitMode } from '@/services/player/videoFit';
import type {
  SubtitleBackground,
  SubtitleFont,
  SubtitlePosition,
  SubtitleSize,
} from '@/services/player/subtitleSettings';
import type { Locale } from '@/i18n/types';

export type MediaType = 'live' | 'movie' | 'series' | 'episode';
export type PlaylistType = 'xtream' | 'm3u_url' | 'm3u_file';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// ─────────────────────────────────────────────
// Playlist / Source
// ─────────────────────────────────────────────

/**
 * Nature d'un échec de connexion ou de synchronisation.
 *
 * On enregistre un **code** et non une phrase toute faite : la phrase
 * dépend de la langue de l'interface, qui peut changer après coup. Le
 * code, lui, est stable. L'écran le traduit au moment de l'affichage
 * via `sources.error<Code>` dans les dictionnaires.
 *
 * Les huit premières valeurs reprennent `XtreamErrorKind`
 * (`src/services/xtream/xtreamService.ts`) afin qu'aucune conversion
 * ne soit nécessaire ; `parse` et `unknown` couvrent l'import M3U et
 * les cas imprévus.
 */
export type SourceErrorKind =
  | 'invalid_url'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'auth'
  | 'account_inactive'
  | 'http'
  | 'bad_response'
  | 'parse'
  | 'unknown';

/**
 * Coordonnées d'un serveur Xtream Codes.
 *
 * Le mot de passe est **volontairement absent**. Il est rangé à part
 * par `src/lib/secureStore.ts`, sous la clé `playlist:<id>:password`.
 * Tout ce qui se trouve dans `Playlist` est recopié en clair dans
 * `localStorage` par le middleware `persist` de Zustand.
 */
export interface XtreamConnection {
  /** Adresse normalisée, protocole et port compris. */
  serverUrl: string;
  username: string;
  /** Renseigné après un test de connexion réussi. */
  expiresAt?: string;
  maxConnections?: number;
  /** Formats de flux acceptés par le portail : `ts`, `m3u8`, `rtmp`… */
  allowedOutputFormats?: string[];
  /**
   * Catégories retenues par l'utilisateur, par famille.
   *
   * Absent pour les sources créées avant l'arrivée de ce réglage :
   * elles continuent alors de tout télécharger, exactement comme
   * avant. Une famille au tableau vide signifie « rien de cette
   * famille », ce qui est un choix explicite et non une absence.
   *
   * Volontairement typé ici plutôt qu'importé depuis le service : ce
   * fichier de types ne doit dépendre d'aucun service, sans quoi la
   * moindre modification du protocole Xtream ferait recompiler toute
   * l'application.
   */
  categorySelection?: {
    live: string[];
    vod: string[];
    series: string[];
  };
}

/** Coordonnées d'une liste M3U : un lien, éventuellement un guide. */
export interface M3UConnection {
  /** Absent pour un fichier importé depuis le disque. */
  url?: string;
  /** Nom du fichier d'origine, pour un import local. */
  fileName?: string;
  /** Adresse XMLTV du guide des programmes. */
  epgUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  type: PlaylistType;
  isActive: boolean;
  lastSync: string | null;
  syncStatus: SyncStatus;
  channelCount: number;
  movieCount: number;
  seriesCount: number;
  createdAt: string;
  updatedAt: string;
  /** Renseigné si `type === 'xtream'`. */
  xtream?: XtreamConnection;
  /** Renseigné si `type === 'm3u_url'` ou `'m3u_file'`. */
  m3u?: M3UConnection;
  /** Cause du dernier échec, quand `syncStatus === 'error'`. */
  lastError?: SourceErrorKind;
}

export interface XtreamAccount {
  id: string;
  playlistId: string;
  serverUrl: string;
  username: string;
  // password stored in secure storage, never in state
  serverInfo?: XtreamServerInfo;
}

export interface XtreamServerInfo {
  url: string;
  port: string;
  httpsPort?: string;
  serverProtocol: string;
  rtmpPort?: string;
  timezone: string;
  timestampNow: number;
  timeNow: string;
  process: boolean;
}

export interface M3USource {
  id: string;
  playlistId: string;
  url?: string;
  fileName?: string;
  epgUrl?: string;
}

// ─────────────────────────────────────────────
// Live TV
// ─────────────────────────────────────────────
export interface LiveCategory {
  id: string;
  name: string;
  channelCount: number;
  playlistId: string;
}

export interface LiveChannel {
  id: string;
  name: string;
  streamUrl: string;
  streamType: 'hls' | 'rtmp' | 'dash' | 'other';
  logo?: string;
  groupTitle?: string;
  categoryId?: string;
  categoryName?: string;
  tvgId?: string;
  tvgName?: string;
  country?: string;
  language?: string;
  playlistId: string;
  streamId?: number;
  epgChannelId?: string;
  isFavorite: boolean;
  isRecent: boolean;
  sortOrder?: number;
  currentProgram?: EPGProgram;
  nextProgram?: EPGProgram;
}

// ─────────────────────────────────────────────
// EPG
// ─────────────────────────────────────────────
export interface EPGChannel {
  id: string;
  displayName: string;
  icon?: string;
  url?: string;
  lang?: string;
}

export interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  start: string;
  stop: string;
  description?: string;
  category?: string;
  rating?: string;
  icon?: string;
  episodeNum?: string;
  lang?: string;
  progressPercent?: number;
}

// ─────────────────────────────────────────────
// Movies (VOD)
// ─────────────────────────────────────────────
export interface MovieCategory {
  id: string;
  name: string;
  movieCount: number;
  playlistId: string;
}

export interface Movie {
  id: string;
  name: string;
  streamUrl: string;
  logo?: string;
  backdrop?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  year?: number;
  rating?: string;
  tmdbId?: string;
  duration?: number;
  categoryId?: string;
  categoryName?: string;
  playlistId: string;
  streamId?: number;
  containerExtension?: string;
  isFavorite: boolean;
  watchProgress?: number;
  watchedAt?: string;
  /** Date d'ajout côté portail, ISO, si le serveur la fournit. */
  addedAt?: string;
  audioTracks?: AudioTrack[];
  subtitleTracks?: SubtitleTrack[];
}

// ─────────────────────────────────────────────
// Series
// ─────────────────────────────────────────────
export interface SeriesCategory {
  id: string;
  name: string;
  seriesCount: number;
  playlistId: string;
}

export interface Series {
  id: string;
  name: string;
  cover?: string;
  backdrop?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  year?: number;
  rating?: string;
  tmdbId?: string;
  categoryId?: string;
  categoryName?: string;
  playlistId: string;
  seriesId?: number;
  isFavorite: boolean;
  seasons?: Season[];
  episodeCount?: number;
  lastWatchedEpisodeId?: string;
  watchProgress?: WatchProgress;
  /** Date d'ajout côté portail, ISO, si le serveur la fournit. */
  addedAt?: string;
}

export interface Season {
  id: string;
  seriesId: string;
  seasonNumber: number;
  name: string;
  cover?: string;
  airDate?: string;
  episodeCount: number;
  episodes?: Episode[];
}

export interface Episode {
  id: string;
  seriesId: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  plot?: string;
  image?: string;
  duration?: number;
  streamUrl: string;
  containerExtension?: string;
  rating?: string;
  airDate?: string;
  isWatched: boolean;
  watchProgress?: number;
  audioTracks?: AudioTrack[];
  subtitleTracks?: SubtitleTrack[];
}

// ─────────────────────────────────────────────
// Player
// ─────────────────────────────────────────────
export interface AudioTrack {
  id: string;
  language: string;
  label: string;
  isDefault: boolean;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  url?: string;
  isDefault: boolean;
}

export interface PlaybackProgress {
  id: string;
  mediaId: string;
  mediaType: MediaType;
  position: number;
  duration: number;
  percent: number;
  updatedAt: string;
}

export interface WatchProgress {
  totalEpisodes: number;
  watchedEpisodes: number;
  percent: number;
  lastEpisodeId?: string;
  lastPosition?: number;
}

// ─────────────────────────────────────────────
// Profiles
// ─────────────────────────────────────────────
export type AvatarId = string;

export interface Profile {
  id: string;
  name: string;
  avatarId: AvatarId;
  isKidsProfile: boolean;
  /**
   * Empreinte du code PIN, JAMAIS le code lui-même.
   *
   * Un « hachage » transforme `1234` en une longue suite illisible.
   * L'opération est à sens unique : on peut vérifier qu'un code saisi
   * correspond, mais on ne peut pas retrouver le code d'origine.
   *
   * Sans cela, n'importe qui ouvrant l'inspecteur du navigateur lirait
   * le code parental en clair — le contrôle parental serait décoratif.
   *
   * Format prévu (Phase 3) : PBKDF2 via l'API Web Crypto, avec sel.
   */
  pinHash?: string;
  language: string;
  audioLanguage: string;
  subtitleLanguage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParentalControl {
  profileId: string;
  enabled: boolean;
  /** Empreinte du PIN — voir Profile.pinHash. Jamais le code en clair. */
  pinHash: string;
  maxRating: string;
  blockedCategories: string[];
  requirePinForChanges: boolean;
}

// ─────────────────────────────────────────────
// Favorites & Lists
// ─────────────────────────────────────────────
export type FavoriteType = 'channel' | 'movie' | 'series' | 'episode';

export interface Favorite {
  id: string;
  profileId: string;
  mediaId: string;
  mediaType: FavoriteType;
  addedAt: string;
}

export interface CustomList {
  id: string;
  profileId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  items: CustomListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomListItem {
  id: string;
  listId: string;
  mediaId: string;
  mediaType: FavoriteType;
  sortOrder: number;
  addedAt: string;
}

// ─────────────────────────────────────────────
// History
// ─────────────────────────────────────────────
export interface WatchHistoryEntry {
  id: string;
  profileId: string;
  mediaId: string;
  mediaType: MediaType;
  title: string;
  thumbnail?: string;
  position: number;
  duration: number;
  percent: number;
  watchedAt: string;
  mediaData?: Partial<LiveChannel | Movie | Episode>;
}

// ─────────────────────────────────────────────
// User Preferences
// ─────────────────────────────────────────────
export interface UserPreferences {
  profileId: string;
  /**
   * Thème de l'interface.
   * `dark` est la valeur d'usine. `system` suit le système
   * d'exploitation ; `light` force le clair.
   */
  theme: 'light' | 'dark' | 'system';
  /**
   * Effet de verre dépoli (panneaux translucides et floutés).
   *
   * Trois états, et non deux :
   *   `true`  — l'utilisateur le veut ;
   *   `false` — l'utilisateur n'en veut pas ;
   *   `null`  — il n'a jamais touché l'interrupteur.
   *
   * Sans le troisième état, impossible d'appliquer un comportement
   * d'usine différent selon l'appareil — actif sur téléphone, inactif
   * sur téléviseur où le flou coûte cher en fluidité — tout en
   * respectant un choix explicite dès qu'il existe. Voir `useGlass`.
   */
  glassEnabled: boolean | null;
  /**
   * Transitions et défilement adouci.
   *
   * Trois états, comme `glassEnabled` :
   *   `true` / `false` — choix explicite de l'utilisateur ;
   *   `null`           — jamais touché.
   *
   * `null` permet d'obéir au réglage système « réduire les animations »
   * sans écraser un choix contraire fait dans l'application. Voir
   * `resolveAnimations`.
   */
  animationsEnabled: boolean | null;
  /**
   * Enchaîner l'épisode suivant à la fin d'un épisode.
   *
   * Remplace l'ancienne paire `autoPlay` / `autoNextEpisode` : deux
   * préférences pour un seul comportement, dont une jamais affichée ni
   * lue. Voir la migration 6 → 7 du store.
   */
  autoNextEpisode: boolean;
  /**
   * Politique de qualite au demarrage d'un flux.
   *
   * Ce n'est PAS une resolution : les variantes disponibles dependent
   * du flux et ne sont connues qu'apres lecture du manifeste. Une
   * politique, elle, s'applique partout. Voir `qualityLadder.ts`.
   */
  defaultQuality: QualityPolicy;
  /**
   * Derniere hauteur choisie a la main dans le lecteur, en pixels.
   *
   * `null` tant que l'utilisateur n'a rien force. Sert a reporter son
   * choix d'une chaine a l'autre en visant la variante la plus proche.
   */
  lastQualityHeight: number | null;
  /**
   * Ajustement de l'image dans le cadre du lecteur.
   *
   * Répond aux chaînes qui ne diffusent pas dans les proportions de
   * l'écran : bandes noires sur les côtés en 4:3, en haut et en bas
   * pour un film large. Voir `videoFit.ts` pour le détail des modes.
   */
  videoFit: VideoFitMode;
  defaultAudioLanguage: string;
  defaultSubtitleLanguage?: string;
  subtitlesEnabled: boolean;
  /**
   * Taille du texte des sous-titres.
   *
   * N'a d'effet que sur le calque custom (`renderTextTracksNatively:
   * false`). Le rendu natif du navigateur garde sa propre taille.
   */
  subtitleSize: SubtitleSize;
  /** Position verticale du bloc de sous-titres dans l'image. */
  subtitlePosition: SubtitlePosition;
  /** Fond posé derrière le texte, pour la lisibilité sur image claire. */
  subtitleBackground: SubtitleBackground;
  /** Famille de police. Trois styles seulement, par choix. */
  subtitleFont: SubtitleFont;
  playerControls: 'auto-hide' | 'always-visible';
  epgDays: number;
  /**
   * Langue de l'interface.
   *
   * Typée `Locale` et non `string` : le compilateur refuse une langue
   * pour laquelle aucune traduction n'existe. Voir `src/i18n/types.ts`.
   */
  language: Locale;
}

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────
export interface SearchResult {
  channels: LiveChannel[];
  movies: Movie[];
  series: Series[];
  programs: EPGProgram[];
}

export interface SearchHistoryEntry {
  query: string;
  timestamp: string;
}

// ─────────────────────────────────────────────
// UI State
// ─────────────────────────────────────────────
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// M3U Entry during parse
export interface M3UEntry {
  name: string;
  streamUrl: string;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  groupTitle?: string;
  tvgCountry?: string;
  tvgLanguage?: string;
  duration?: number;
  raw?: string;
}
