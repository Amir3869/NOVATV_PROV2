'use client';

import { isQualityPolicy } from '@/services/player/qualityLadder';
import { DEFAULT_VIDEO_FIT, isVideoFitMode } from '@/services/player/videoFit';
import {
  DEFAULT_SUBTITLE_BACKGROUND,
  DEFAULT_SUBTITLE_FONT,
  DEFAULT_SUBTITLE_POSITION,
  DEFAULT_SUBTITLE_SIZE,
  isSubtitleBackground,
  isSubtitleFont,
  isSubtitlePosition,
  isSubtitleSize,
} from '@/services/player/subtitleSettings';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  saveCatalog,
  loadCatalog,
  clearStoredCatalog,
  hasCatalogContent,
} from '@/lib/catalogStore';
import type {
  Profile,
  LiveChannel,
  LiveCategory,
  EPGProgram,
  Movie,
  Series,
  Season,
  Episode,
  Favorite,
  CustomList,
  WatchHistoryEntry,
  PlaybackProgress,
  Playlist,
  UserPreferences,
} from '@/types';

/**
 * Contenu rapatrié depuis une source, en une seule fois.
 *
 * Regrouper les six listes dans un seul objet permet de ne faire
 * **qu'un seul** `set()`. Six appels successifs déclencheraient six
 * rendus de l'interface, et l'écran afficherait des états incohérents
 * entre-temps (des films sans leurs catégories, par exemple).
 *
 * Chaque champ est optionnel : une liste M3U ne rapporte que des
 * chaînes, jamais de films ni de séries.
 */
export interface CatalogPayload {
  channels?: LiveChannel[];
  liveCategories?: LiveCategory[];
  movies?: Movie[];
  series?: Series[];
  seasons?: Season[];
  episodes?: Episode[];
}

interface AppState {
  // Profiles
  profiles: Profile[];
  activeProfileId: string | null;

  // Playlists
  playlists: Playlist[];
  /**
   * Source actuellement consultée.
   *
   * Distinct du champ `isActive` de chaque `Playlist` : l'identifiant
   * permet de retrouver la source en une comparaison, sans parcourir
   * le tableau à chaque rendu.
   */
  activePlaylistId: string | null;

  // Content
  channels: LiveChannel[];
  liveCategories: LiveCategory[];
  movies: Movie[];
  series: Series[];
  seasons: Season[];
  episodes: Episode[];
  epgPrograms: EPGProgram[];

  // Favorites
  favorites: Favorite[];

  // Custom Lists
  customLists: CustomList[];

  // History
  watchHistory: WatchHistoryEntry[];
  playbackProgress: PlaybackProgress[];

  // Preferences
  preferences: UserPreferences;

  /**
   * Noms personnalisés (« surnoms ») des catégories.
   *
   * Clé = identifiant réel de la catégorie (jamais modifié) ; valeur =
   * nom affiché choisi par l'utilisateur. Tout ce qui utilise l'objet
   * du catalogue (guide, favoris, historique) continue de raisonner sur
   * l'identifiant réel ; seule l'étiquette affichée passe par ici.
   */
  categoryRenames: Record<string, string>;

  /**
   * Noms personnalisés (« surnoms ») des chaînes.
   *
   * Même principe que `categoryRenames`, appliqué aux chaînes
   * (section C). Posé dès maintenant pour n'avoir qu'une seule
   * migration de stockage à écrire.
   */
  channelRenames: Record<string, string>;

  /**
   * Éléments mis sous verrou parental (clés de `channelLockKey` /
   * `categoryLockKey`).
   *
   * Persisté : un verrou doit survivre au rechargement, sinon un
   * enfant qui redémarre l'application retrouverait tout déverrouillé.
   * La liste est vide tant qu'aucun cadenas n'a été activé.
   */
  lockedItems: string[];

  /**
   * Le code PIN a-t-il été saisi avec succès cette session ?
   *
   * Volontairement **hors** persistance : un rechargement de la page
   * relève le verrou, pour qu'un enfant ne puisse pas contourner le
   * code en rafraîchissant. Repart à `false` à l'ouverture (et à
   * chaque changement de profil, car le PIN est propre au profil).
   */
  sessionUnlocked: boolean;

  // UI State
  sidebarOpen: boolean;
  searchQuery: string;
  isOnboarded: boolean;

  /**
   * Le catalogue IndexedDB a-t-il fini d'être relu ?
   *
   * Distinct de `useHydrated` (localStorage). Les chaînes n'y sont
   * pas : sans ce drapeau, TV en direct afficherait un catalogue
   * incomplet — ou l'ancienne source — le temps qu'IndexedDB réponde.
   * Volontairement hors persistance : il redevient `false` à chaque
   * ouverture.
   */
  catalogReady: boolean;

  // Actions - Profiles
  setActiveProfile: (profileId: string) => void;
  addProfile: (profile: Profile) => void;
  updateProfile: (profileId: string, updates: Partial<Profile>) => void;
  deleteProfile: (profileId: string) => void;

  // Actions - Playlists (sources)
  addPlaylist: (playlist: Playlist) => void;
  updatePlaylist: (playlistId: string, updates: Partial<Playlist>) => void;
  deletePlaylist: (playlistId: string) => void;
  setActivePlaylist: (playlistId: string) => void;

  // Actions - Catalogue
  setCatalog: (playlistId: string, catalog: CatalogPayload) => void;
  clearCatalog: (playlistId: string) => void;
  /**
   * Remplace saisons et épisodes d'une série, et éventuellement
   * enrichit sa fiche (synopsis, affiche) après `get_series_info`.
   */
  setSeriesDetails: (
    seriesId: string,
    details: {
      seasons: Season[];
      episodes: Episode[];
      seriesPatch?: Partial<Series>;
    }
  ) => void;
  /** Enrichit un film après `get_vod_info`, sans toucher aux autres. */
  updateMovieDetails: (movieId: string, patch: Partial<Movie>) => void;
  /**
   * Remplace le guide des programmes d'une source.
   *
   * Volontairement séparée de `setCatalog` : le guide se récupère
   * après le catalogue, dans un second appel réseau qui peut échouer
   * seul. Le fusionner reviendrait à devoir tout resynchroniser pour
   * rafraîchir les programmes.
   */
  setEpgPrograms: (playlistId: string, programs: EPGProgram[]) => void;

  // Actions - Favorites
  toggleFavorite: (mediaId: string, mediaType: Favorite['mediaType']) => void;
  isFavorite: (mediaId: string) => boolean;

  // Actions - Custom Lists
  addCustomList: (list: CustomList) => void;
  updateCustomList: (listId: string, updates: Partial<CustomList>) => void;
  deleteCustomList: (listId: string) => void;
  addToList: (listId: string, mediaId: string, mediaType: Favorite['mediaType']) => void;
  removeFromList: (listId: string, mediaId: string) => void;

  // Actions - History
  addToHistory: (entry: WatchHistoryEntry) => void;
  removeFromHistory: (entryId: string) => void;
  clearHistory: () => void;

  // Actions - Parental (verrouillage)
  /** Verrouille (`true`) ou déverrouille (`false`) un élément. */
  setItemLocked: (key: string, locked: boolean) => void;
  /** Bascule le verrou d'un élément (liste `lockedItems`). */
  toggleItemLocked: (key: string) => void;
  /** Marque le code PIN comme validé pour la session. */
  unlockSession: () => void;
  /** Relève le verrou de session (changement de profil, etc.). */
  resetSessionUnlock: () => void;

  // Actions - Progress
  updateProgress: (progress: PlaybackProgress) => void;
  getProgress: (mediaId: string) => PlaybackProgress | null;

  // Actions - UI
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setOnboarded: (onboarded: boolean) => void;

  // Actions - Preferences
  updatePreferences: (updates: Partial<UserPreferences>) => void;

  // Actions - Renommages
  renameCategory: (categoryId: string, name: string) => void;
  renameChannel: (channelId: string, name: string) => void;
}

/**
 * Écarte les doublons d'un tableau, en gardant la **dernière**
 * occurrence de chaque identifiant.
 *
 * La dernière et non la première : lors d'une resynchronisation, les
 * entrées fraîches sont ajoutées en fin de tableau et doivent
 * l'emporter sur les anciennes.
 */
function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const byId = new Map<string, T>();
  list.forEach((item) => byId.set(item.id, item));
  return Array.from(byId.values());
}

const defaultPreferences: UserPreferences = {
  profileId: '',
  theme: 'system',
  // `null` = jamais choisi : le comportement dépendra de l'appareil.
  // Voir `resolveGlass` dans src/hooks/useGlass.ts.
  glassEnabled: null,
  // `null` = jamais choisi : suit le système, puis l'appareil.
  animationsEnabled: null,
  autoNextEpisode: true,
  defaultQuality: 'auto',
  lastQualityHeight: null,
  // 'contain' : l'image entiere reste visible, quitte a laisser des
  // bandes noires. Aucune perte tant que rien n'a ete choisi.
  videoFit: DEFAULT_VIDEO_FIT,
  defaultAudioLanguage: 'fr',
  defaultSubtitleLanguage: undefined,
  subtitlesEnabled: false,
  subtitleSize: DEFAULT_SUBTITLE_SIZE,
  subtitlePosition: DEFAULT_SUBTITLE_POSITION,
  subtitleBackground: DEFAULT_SUBTITLE_BACKGROUND,
  subtitleFont: DEFAULT_SUBTITLE_FONT,
  playerControls: 'auto-hide',
  epgDays: 3,
  language: 'fr',
};

/**
 * Sous-ensemble de l'état réellement enregistré dans le navigateur.
 *
 * Le catalogue (chaînes, films, séries) en est volontairement exclu :
 * il peut peser plusieurs dizaines de milliers d'entrées et sera
 * rechargé depuis la source de l'utilisateur.
 */
type PersistedState = Pick<
  AppState,
  | 'profiles'
  | 'activeProfileId'
  | 'playlists'
  | 'activePlaylistId'
  | 'favorites'
  | 'customLists'
  | 'watchHistory'
  | 'playbackProgress'
  | 'preferences'
  | 'categoryRenames'
  | 'channelRenames'
  | 'lockedItems'
  | 'isOnboarded'
>;

/**
 * Convertit un stockage enregistré par une version antérieure.
 *
 * Extraite de la configuration `persist` pour être testable directement :
 * une régression ici est invisible au démarrage mais efface ou fige les
 * préférences de personnes ayant déjà utilisé l'application.
 */
export function migratePersistedState(
  persisted: unknown,
  version: number
): PersistedState {
  // Les étapes s'enchaînent en CASCADE, elles ne s'excluent pas.
  //
  // Le piège évité ici : avec une suite de `if (version === n) return`,
  // une seule branche s'exécute. Quelqu'un resté en version 3 sautait
  // donc l'étape 4 et conservait un `animationsEnabled: true` hérité
  // d'un interrupteur qui n'avait jamais rien commandé — ce faux
  // « choix explicite » aurait ensuite bloqué le réglage système
  // d'accessibilité et le comportement par défaut sur téléviseur.
  //
  // Chaque étape teste donc `version < n` et transmet son résultat à
  // la suivante, si bien qu'un stockage ancien traverse toutes les
  // étapes intermédiaires dans l'ordre.
  let state = persisted as PersistedState;

  // Version 0 : profils, sources et historiques de démonstration.
  // On repart d'un état vierge, l'utilisateur fournissant ses
  // propres sources. Aucune étape ultérieure n'a de sens ici.
  if (version < 1) {
    return {
      profiles: [],
      activeProfileId: null,
      playlists: [],
      activePlaylistId: null,
      favorites: [],
      customLists: [],
      watchHistory: [],
      playbackProgress: [],
      preferences: defaultPreferences,
      categoryRenames: {},
      channelRenames: {},
      lockedItems: [],
      isOnboarded: false,
    };
  }

  // Version 1 : `theme` valait 'dark' ou 'darker', deux nuances de
  // sombre — le thème clair n'existait pas. 'darker' n'a plus
  // d'équivalent, on rebascule ces personnes sur le suivi système.
  if (version < 2) {
    const theme = state.preferences?.theme;
    state = {
      ...state,
      activePlaylistId: state.playlists?.[0]?.id ?? null,
      preferences: {
        ...defaultPreferences,
        ...state.preferences,
        theme: theme === 'light' || theme === 'dark' ? theme : 'system',
      },
    };
  }

  // Version 2 : les sources ne portaient ni leurs coordonnées de
  // connexion (`xtream` / `m3u`) ni `activePlaylistId`. Elles
  // n'étaient de toute façon jamais créées — aucun bouton ne le
  // permettait. On repart d'une liste de sources vide plutôt que de
  // conserver des entrées inexploitables, tout en gardant profils,
  // favoris, listes et historique.
  if (version < 3) {
    state = {
      ...state,
      playlists: [],
      activePlaylistId: null,
    };
  }

  // Version 3 : `glassEnabled` valait `true` pour tout le monde,
  // mais l'interrupteur n'était relié à rien — ce `true` n'exprimait
  // donc aucun choix. Le remettre à `null` rend la main au
  // comportement adapté à l'appareil. Un `false` ne peut venir que
  // d'une action délibérée : on le conserve.
  if (version < 4) {
    const glass = state.preferences?.glassEnabled;
    state = {
      ...state,
      preferences: {
        ...defaultPreferences,
        ...state.preferences,
        glassEnabled: glass === false ? false : null,
      },
    };
  }

  // Version 4 : même situation pour `animationsEnabled`. Le remettre
  // à `null` rend la main au réglage système d'accessibilité,
  // jusque-là ignoré.
  if (version < 5) {
    const anim = state.preferences?.animationsEnabled;
    state = {
      ...state,
      preferences: {
        ...defaultPreferences,
        ...state.preferences,
        animationsEnabled: anim === false ? false : null,
      },
    };
  }

  // Version 5 : le choix « 2 jours » de guide TV a ete retire. La liste
  // se parcourt a la telecommande, quatre valeurs pour un ecart aussi
  // faible n'apportaient rien. Une valeur absente de la liste laisserait
  // le menu deroulant sans option selectionnee, donc visuellement vide.
  // On rabat sur la valeur valide la plus proche, sans jamais augmenter
  // la consommation memoire de quelqu'un qui avait volontairement reduit.
  if (version < 6) {
    const days = state.preferences?.epgDays;
    state = {
      ...state,
      preferences: {
        ...defaultPreferences,
        ...state.preferences,
        epgDays: days === 2 ? 1 : (days ?? defaultPreferences.epgDays),
      },
    };
  }

  // Version 6 : `autoPlay` et `autoNextEpisode` decrivaient le meme
  // comportement. `autoPlay` n'etait affiche nulle part et lu par
  // personne. On retire la cle morte du stockage, sinon elle survivrait
  // indefiniment a chaque fusion avec les valeurs par defaut.
  if (version < 7) {
    const prefs = { ...defaultPreferences, ...state.preferences } as Record<
      string,
      unknown
    >;
    delete prefs.autoPlay;
    state = {
      ...state,
      preferences: prefs as unknown as PersistedState['preferences'],
    };
  }

  // Version 7 : `defaultQuality` valait 'auto' | '1080p' | '720p' |
  // '480p'. Ces trois resolutions etaient inventees : le flux de
  // reference du projet publie du 576p et du 240p, si bien qu'aucun des
  // trois choix ne pouvait jamais s'appliquer. Elles cedent la place a
  // une politique ('auto' | 'saver' | 'best'), qui vaut pour n'importe
  // quel flux. Toute resolution memorisee devient 'best' : la personne
  // avait demande une image nette, on respecte l'intention plutot que
  // le chiffre.
  if (version < 8) {
    const prefs = { ...defaultPreferences, ...state.preferences } as Record<
      string,
      unknown
    >;
    if (!isQualityPolicy(prefs.defaultQuality)) {
      prefs.defaultQuality = prefs.defaultQuality === undefined ? 'auto' : 'best';
    }
    state = {
      ...state,
      preferences: prefs as unknown as PersistedState['preferences'],
    };
  }

  // Version 8 : arrivee de `videoFit`, l'ajustement de l'image dans le
  // cadre du lecteur. La cle n'existait pas dans les etats deja
  // enregistres ; elle prend le mode par defaut, celui qui n'ampute
  // rien de l'image. Une valeur inconnue — anciennes experimentations,
  // ou modification a la main dans la console — est ramenee au defaut
  // plutot que laissee telle quelle : elle ne produirait aucune classe
  // et l'image ne s'ajusterait plus du tout.
  if (version < 9) {
    const prefs = { ...defaultPreferences, ...state.preferences } as Record<
      string,
      unknown
    >;
    if (!isVideoFitMode(prefs.videoFit)) {
      prefs.videoFit = DEFAULT_VIDEO_FIT;
    }
    state = {
      ...state,
      preferences: prefs as unknown as PersistedState['preferences'],
    };
  }

  // Version 9 : arrivee des noms personnalises (surnoms) de categories
  // et de chaines. Les deux cles n'existaient pas dans les etats deja
  // enregistres : on les injecte vides. Elles sont volontairement hors
  // du catalogue, qui est recharge depuis la source et porterait
  // toujours le nom d'origine — un renommage qui ecrirait dans le
  // catalogue serait efface a la prochaine resynchronisation.
  if (version < 10) {
    state = {
      ...state,
      categoryRenames: state.categoryRenames ?? {},
      channelRenames: state.channelRenames ?? {},
    };
  }

  // Version 10 : arrivée du verrou parental. `lockedItems` n'existait
  // pas dans les états déjà enregistrés : on l'injecte vide. Chaque
  // verrou survivra désormais au rechargement. La liste est méta
  // (petit nombre de clés) et volontairement hors du catalogue, qui
  // est toujours rechargé depuis la source.
  if (version < 11) {
    state = {
      ...state,
      lockedItems: state.lockedItems ?? [],
    };
  }

  // Version 11 : arrivée des réglages d'apparence des sous-titres
  // (taille, position, fond, police). Les quatre clés n'existaient
  // pas dans les états déjà enregistrés : elles prennent les valeurs
  // par défaut. Une valeur inconnue — ancienne expérimentation, ou
  // modification à la main dans la console — est ramenée au défaut
  // plutôt que laissée telle quelle : elle ne produirait aucun style
  // et le texte ne s'afficherait plus du tout.
  if (version < 12) {
    const prefs = { ...defaultPreferences, ...state.preferences } as Record<
      string,
      unknown
    >;
    if (!isSubtitleSize(prefs.subtitleSize)) prefs.subtitleSize = DEFAULT_SUBTITLE_SIZE;
    if (!isSubtitlePosition(prefs.subtitlePosition)) {
      prefs.subtitlePosition = DEFAULT_SUBTITLE_POSITION;
    }
    if (!isSubtitleBackground(prefs.subtitleBackground)) {
      prefs.subtitleBackground = DEFAULT_SUBTITLE_BACKGROUND;
    }
    if (!isSubtitleFont(prefs.subtitleFont)) prefs.subtitleFont = DEFAULT_SUBTITLE_FONT;
    state = {
      ...state,
      preferences: prefs as unknown as PersistedState['preferences'],
    };
  }

  return state;
}

/**
 * Enregistre le catalogue dans IndexedDB, sans bloquer l'appelant.
 *
 * ─── Pourquoi differer ─────────────────────────────────────────────
 *
 * `setCatalog` est une action synchrone de zustand : elle doit rendre
 * la main immediatement pour que React affiche le resultat. Attendre
 * l'ecriture disque figerait l'interface pendant la synchronisation
 * d'un gros portail.
 *
 * On planifie donc l'ecriture pour « juste apres », une fois le rendu
 * termine. `queueMicrotask` suffit : l'ecriture elle-meme est de toute
 * facon asynchrone cote IndexedDB.
 *
 * ─── Pourquoi regrouper ────────────────────────────────────────────
 *
 * Une synchronisation Xtream appelle `setCatalog` plusieurs fois de
 * suite — une par famille de contenu — puis `setEpgPrograms`. Sans
 * regroupement, on reecrirait le catalogue entier a chaque appel, soit
 * plusieurs dizaines de mega-octets ecrits pour rien.
 *
 * Le drapeau `pendingSave` fait qu'une seule ecriture est planifiee :
 * les appels suivants sont ignores, et l'ecriture qui finit par avoir
 * lieu prend l'etat le plus recent.
 *
 * ─── En cas d'echec ────────────────────────────────────────────────
 *
 * `saveCatalog` ne leve jamais : elle renvoie `false`. On ne fait rien
 * de plus. Le catalogue reste en memoire pour la session en cours ; il
 * sera simplement absent au prochain demarrage, et l'ecran d'accueil
 * proposera une synchronisation. Une synchro reussie ne doit jamais
 * echouer a cause du stockage.
 */
let pendingSave = false;

/** Saisons et épisodes rattachés aux séries d'une source. */
function dropSeasonsOfPlaylist(
  series: Series[],
  seasons: Season[],
  episodes: Episode[],
  playlistId: string
): { seasons: Season[]; episodes: Episode[] } {
  const ids = new Set(series.filter((s) => s.playlistId === playlistId).map((s) => s.id));
  return {
    seasons: seasons.filter((s) => !ids.has(s.seriesId)),
    episodes: episodes.filter((e) => !ids.has(e.seriesId)),
  };
}

function scheduleCatalogSave(get: () => AppState): void {
  if (pendingSave) return;
  pendingSave = true;

  queueMicrotask(() => {
    pendingSave = false;
    const state = get();
    void saveCatalog({
      channels: state.channels,
      liveCategories: state.liveCategories,
      movies: state.movies,
      series: state.series,
      seasons: state.seasons,
      episodes: state.episodes,
      epgPrograms: state.epgPrograms,
    });
  });
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      profiles: [],
      activeProfileId: null,
      playlists: [],
      activePlaylistId: null,
      channels: [],
      liveCategories: [],
      movies: [],
      series: [],
      seasons: [],
      episodes: [],
      epgPrograms: [],
      favorites: [],
      customLists: [],
      watchHistory: [],
      playbackProgress: [],
      preferences: defaultPreferences,
      categoryRenames: {},
      channelRenames: {},
      lockedItems: [],
      sessionUnlocked: false,
      sidebarOpen: false,
      searchQuery: '',
      isOnboarded: false,
      catalogReady: false,

      // Profile actions
      // Changer de profil relève le verrou de session : le code PIN est
      // propre à un profil, celui d'un autre ne doit pas rester valable.
      setActiveProfile: (profileId) =>
        set({ activeProfileId: profileId, sessionUnlocked: false }),

      addProfile: (profile) =>
        set((state) => ({ profiles: [...state.profiles, profile] })),

      updateProfile: (profileId, updates) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId ? { ...p, ...updates } : p
          ),
        })),

      deleteProfile: (profileId) =>
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== profileId),
          activeProfileId:
            state.activeProfileId === profileId
              ? state.profiles[0]?.id ?? null
              : state.activeProfileId,
        })),

      // Playlists (sources)
      addPlaylist: (playlist) =>
        set((state) => {
          // La première source ajoutée devient forcément l'active :
          // sans cela l'application afficherait « aucune source »
          // alors qu'il y en a une. Une source suivante reste en
          // réserve : l'utilisateur l'active lui-même, sinon le
          // catalogue à l'écran basculerait sans qu'il l'ait demandé.
          const activeId = state.activePlaylistId ?? playlist.id;
          return {
            playlists: [
              ...state.playlists.map((p) => ({ ...p, isActive: p.id === activeId })),
              { ...playlist, isActive: playlist.id === activeId },
            ],
            activePlaylistId: activeId,
          };
        }),

      updatePlaylist: (playlistId, updates) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          ),
        })),

      /**
       * Supprime une source ET tout ce qu'elle a rapporté.
       *
       * Sans le filtrage du catalogue, les chaînes d'une source
       * supprimée resteraient affichées jusqu'au prochain
       * rechargement de la page, et pointeraient vers des adresses
       * dont on n'a plus les identifiants.
       *
       * Le mot de passe associé n'est pas effacé ici : le store est
       * synchrone et `secureStore` ne l'est pas. C'est l'écran qui
       * appelle `secureStore.removePlaylistPassword()` juste avant.
       */
      deletePlaylist: (playlistId) => {
        set((state) => {
          const remaining = state.playlists.filter((p) => p.id !== playlistId);
          const nextActiveId =
            state.activePlaylistId === playlistId
              ? remaining[0]?.id ?? null
              : state.activePlaylistId;
          const dropped = dropSeasonsOfPlaylist(
            state.series,
            state.seasons,
            state.episodes,
            playlistId
          );
          return {
            playlists: remaining.map((p) => ({
              ...p,
              isActive: p.id === nextActiveId,
            })),
            activePlaylistId: nextActiveId,
            channels: state.channels.filter((c) => c.playlistId !== playlistId),
            liveCategories: state.liveCategories.filter(
              (c) => c.playlistId !== playlistId
            ),
            movies: state.movies.filter((m) => m.playlistId !== playlistId),
            series: state.series.filter((s) => s.playlistId !== playlistId),
            seasons: dropped.seasons,
            episodes: dropped.episodes,
            // Le guide suit la source qui l'a fourni : le laisser
            // afficherait des programmes rattaches a des chaines
            // disparues.
            epgPrograms: state.epgPrograms.filter(
              (p) => !p.id.startsWith(`${playlistId}:epg:`)
            ),
            // Les surnoms de la source disparue sont inutiles : on
            // les retire pour ne pas laisser des etiquettes orphelines
            // grossir le stockage. Les identifiants des categories et
            // des chaines portent le prefixe de la source.
            categoryRenames: Object.fromEntries(
              Object.entries(state.categoryRenames).filter(
                ([id]) => !id.startsWith(`${playlistId}:`)
              )
            ),
            channelRenames: Object.fromEntries(
              Object.entries(state.channelRenames).filter(
                ([id]) => !id.startsWith(`${playlistId}:`)
              )
            ),
          };
        });

        // Le catalogue enregistre doit suivre la suppression, sinon la
        // source revient au prochain demarrage. Quand il ne reste plus
        // aucune source, on efface l'enregistrement entier plutot que
        // d'y laisser une coquille vide.
        if (get().playlists.length === 0) {
          void clearStoredCatalog();
        } else {
          scheduleCatalogSave(get);
        }
      },

      setActivePlaylist: (playlistId) =>
        set((state) => ({
          activePlaylistId: playlistId,
          playlists: state.playlists.map((p) => ({
            ...p,
            isActive: p.id === playlistId,
          })),
        })),

      /**
       * Remplace le contenu rapporté par une source.
       *
       * Remplacement et non ajout : une resynchronisation doit refléter
       * l'état actuel du serveur. En ajoutant, une chaîne retirée par
       * le fournisseur resterait visible indéfiniment, et chaque
       * synchronisation dupliquerait tout le catalogue.
       *
       * Les entrées des **autres** sources sont conservées : plusieurs
       * abonnements peuvent coexister.
       */
      setCatalog: (playlistId, catalog) => {
        set((state) => {
          const other = <T extends { playlistId: string }>(list: T[]) =>
            list.filter((item) => item.playlistId !== playlistId);
          // Tout ce qui entre ici appartient à `playlistId`. On
          // recopie le champ s'il manque ou s'il pointe ailleurs :
          // sinon le filtre d'affichage rangerait ces chaînes dans
          // une autre source, ou nulle part.
          const stamp = <T extends { playlistId: string }>(list: T[]): T[] =>
            list.map((item) =>
              item.playlistId === playlistId ? item : { ...item, playlistId }
            );

          return {
            channels: catalog.channels
              ? [...other(state.channels), ...stamp(catalog.channels)]
              : state.channels,
            liveCategories: catalog.liveCategories
              ? [...other(state.liveCategories), ...stamp(catalog.liveCategories)]
              : state.liveCategories,
            movies: catalog.movies
              ? [...other(state.movies), ...stamp(catalog.movies)]
              : state.movies,
            series: catalog.series
              ? [...other(state.series), ...stamp(catalog.series)]
              : state.series,
            // Saisons et épisodes ne portent pas de `playlistId` : ils
            // sont rattachés à une série. On les ajoute sans filtrer,
            // en écartant les doublons d'identifiant.
            seasons: catalog.seasons
              ? dedupeById([...state.seasons, ...catalog.seasons])
              : state.seasons,
            episodes: catalog.episodes
              ? dedupeById([...state.episodes, ...catalog.episodes])
              : state.episodes,
          };
        });
        scheduleCatalogSave(get);
      },

      setEpgPrograms: (playlistId, programs) => {
        set((state) => ({
          // `EPGProgram` ne porte pas de `playlistId` : la source est
          // lisible dans le préfixe de l'identifiant, que `epgSync`
          // construit sous la forme `playlistId:epg:...`. On remplace
          // donc uniquement les programmes de cette source, sans
          // toucher à ceux des autres.
          epgPrograms: [
            ...state.epgPrograms.filter((p) => !p.id.startsWith(`${playlistId}:epg:`)),
            ...programs,
          ],
        }));
        scheduleCatalogSave(get);
      },

      clearCatalog: (playlistId) => {
        set((state) => {
          const dropped = dropSeasonsOfPlaylist(
            state.series,
            state.seasons,
            state.episodes,
            playlistId
          );
          return {
            channels: state.channels.filter((c) => c.playlistId !== playlistId),
            liveCategories: state.liveCategories.filter(
              (c) => c.playlistId !== playlistId
            ),
            movies: state.movies.filter((m) => m.playlistId !== playlistId),
            series: state.series.filter((s) => s.playlistId !== playlistId),
            seasons: dropped.seasons,
            episodes: dropped.episodes,
            // Sans cela, supprimer une source laisserait sa grille de
            // programmes affichée, rattachée à des chaînes disparues.
            epgPrograms: state.epgPrograms.filter(
              (p) => !p.id.startsWith(`${playlistId}:epg:`)
            ),
          };
        });
        scheduleCatalogSave(get);
      },

      setSeriesDetails: (seriesId, details) => {
        set((state) => ({
          seasons: [
            ...state.seasons.filter((s) => s.seriesId !== seriesId),
            ...details.seasons,
          ],
          episodes: [
            ...state.episodes.filter((e) => e.seriesId !== seriesId),
            ...details.episodes,
          ],
          series: details.seriesPatch
            ? state.series.map((item) =>
                item.id === seriesId
                  ? {
                      ...item,
                      ...Object.fromEntries(
                        Object.entries(details.seriesPatch!).filter(
                          ([, value]) => value !== undefined && value !== ''
                        )
                      ),
                    }
                  : item
              )
            : state.series,
        }));
        scheduleCatalogSave(get);
      },

      updateMovieDetails: (movieId, patch) => {
        set((state) => ({
          movies: state.movies.map((movie) =>
            movie.id === movieId
              ? {
                  ...movie,
                  ...Object.fromEntries(
                    Object.entries(patch).filter(([, value]) => value !== undefined && value !== '')
                  ),
                }
              : movie
          ),
        }));
        scheduleCatalogSave(get);
      },

      // Favorites
      toggleFavorite: (mediaId, mediaType) => {
        const state = get();
        const profileId = state.activeProfileId ?? 'profile-1';
        const existing = state.favorites.find(
          (f) => f.mediaId === mediaId && f.profileId === profileId
        );
        if (existing) {
          set((s) => ({ favorites: s.favorites.filter((f) => f.id !== existing.id) }));
        } else {
          const newFav: Favorite = {
            id: `fav-${Date.now()}`,
            profileId,
            mediaId,
            mediaType,
            addedAt: new Date().toISOString(),
          };
          set((s) => ({ favorites: [...s.favorites, newFav] }));
        }
      },

      isFavorite: (mediaId) => {
        const state = get();
        const profileId = state.activeProfileId ?? 'profile-1';
        return state.favorites.some(
          (f) => f.mediaId === mediaId && f.profileId === profileId
        );
      },

      // Custom lists
      addCustomList: (list) =>
        set((state) => ({ customLists: [...state.customLists, list] })),

      updateCustomList: (listId, updates) =>
        set((state) => ({
          customLists: state.customLists.map((l) =>
            l.id === listId ? { ...l, ...updates } : l
          ),
        })),

      deleteCustomList: (listId) =>
        set((state) => ({
          customLists: state.customLists.filter((l) => l.id !== listId),
        })),

      addToList: (listId, mediaId, mediaType) =>
        set((state) => ({
          customLists: state.customLists.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  items: [
                    ...l.items,
                    {
                      id: `li-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                      listId,
                      mediaId,
                      mediaType,
                      sortOrder: l.items.length + 1,
                      addedAt: new Date().toISOString(),
                    },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : l
          ),
        })),

      removeFromList: (listId, mediaId) =>
        set((state) => ({
          customLists: state.customLists.map((l) =>
            l.id === listId
              ? { ...l, items: l.items.filter((i) => i.mediaId !== mediaId) }
              : l
          ),
        })),

      // History
      addToHistory: (entry) =>
        set((state) => {
          // Même média + même profil : on met à jour l'entrée plutôt
          // que d'en créer une nouvelle à chaque enregistrement de
          // progression (toutes les cinq secondes pendant la lecture).
          const existing = state.watchHistory.find(
            (h) => h.mediaId === entry.mediaId && h.profileId === entry.profileId
          );
          const next = { ...entry, id: existing?.id ?? entry.id };
          return {
            watchHistory: [
              next,
              ...state.watchHistory.filter(
                (h) => !(h.mediaId === entry.mediaId && h.profileId === entry.profileId)
              ),
            ].slice(0, 100),
          };
        }),

      removeFromHistory: (entryId) =>
        set((state) => ({
          watchHistory: state.watchHistory.filter((h) => h.id !== entryId),
        })),

      clearHistory: () => set({ watchHistory: [] }),

      // Progress
      updateProgress: (progress) =>
        set((state) => ({
          playbackProgress: [
            progress,
            ...state.playbackProgress.filter((p) => p.mediaId !== progress.mediaId),
          ],
        })),

      getProgress: (mediaId) => {
        const state = get();
        return state.playbackProgress.find((p) => p.mediaId === mediaId) ?? null;
      },

      // Parental (verrouillage)
      // On opère sur l'état courant (`get`) pour que la bascule ne
      // dépende pas d'une fermeture obsolète dans le `set` précédent.
      setItemLocked: (key, locked) =>
        set((state) => ({
          lockedItems: locked
            ? state.lockedItems.includes(key)
              ? state.lockedItems
              : [...state.lockedItems, key]
            : state.lockedItems.filter((k) => k !== key),
        })),

      toggleItemLocked: (key) => {
        const { lockedItems } = get();
        set({
          lockedItems: lockedItems.includes(key)
            ? lockedItems.filter((k) => k !== key)
            : [...lockedItems, key],
        });
      },

      unlockSession: () => set({ sessionUnlocked: true }),
      resetSessionUnlock: () => set({ sessionUnlocked: false }),

      // UI
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setOnboarded: (onboarded) => set({ isOnboarded: onboarded }),

      // Preferences
      updatePreferences: (updates) =>
        set((state) => ({ preferences: { ...state.preferences, ...updates } })),

      /**
       * Enregistre le surnom d'une catégorie.
       *
       * Le nom est validé avant d'être stocké : un champ vidé ou réduit
       * à des espaces ôte le surnom et rend la main au nom d'origine
       * (c'est le « restaurer » de la fenêtre de renommage). Le nom est
       * stocké tel quel, l'identifiant réel n'est jamais touché.
       */
      renameCategory: (categoryId, name) =>
        set((state) => {
          const trimmed = name.trim();
          const renames = { ...state.categoryRenames };
          if (trimmed.length === 0) {
            delete renames[categoryId];
          } else {
            renames[categoryId] = trimmed;
          }
          return { categoryRenames: renames };
        }),

      /**
       * Enregistre le surnom d'une chaîne. Même règle que
       * `renameCategory` : un champ vidé ôte le surnom.
       */
      renameChannel: (channelId, name) =>
        set((state) => {
          const trimmed = name.trim();
          const renames = { ...state.channelRenames };
          if (trimmed.length === 0) {
            delete renames[channelId];
          } else {
            renames[channelId] = trimmed;
          }
          return { channelRenames: renames };
        }),
    }),
    {
      name: 'novatv-storage',
      /**
       * Numéro de version des données enregistrées.
       *
       * `persist` recopie l'état dans le navigateur (`localStorage`).
       * Les versions précédentes y ont écrit des données de
       * démonstration : les retirer du code ne suffit donc pas, elles
       * resteraient enregistrées chez toute personne ayant déjà ouvert
       * l'application.
       *
       * À chaque incrément, Zustand appelle `migrate` ci-dessous pour
       * convertir les données déjà enregistrées au nouveau format.
       */
      version: 12,
      migrate: migratePersistedState,
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        playlists: state.playlists,
        activePlaylistId: state.activePlaylistId,
        favorites: state.favorites,
        customLists: state.customLists,
        watchHistory: state.watchHistory,
        playbackProgress: state.playbackProgress,
        preferences: state.preferences,
        categoryRenames: state.categoryRenames,
        channelRenames: state.channelRenames,
        // Les verrous survivent au rechargement ; le déverrouillage de
        // session, lui, est exclu (voir `sessionUnlocked`) pour que le
        // code soit redemandé à chaque ouverture.
        lockedItems: state.lockedItems,
        isOnboarded: state.isOnboarded,
      }),
    }
  )
);

/**
 * Recharge le catalogue depuis IndexedDB dans le store.
 *
 * ─── Le partage des roles ──────────────────────────────────────────
 *
 * Deux stockages travaillent en parallele :
 *
 *   localStorage  profils, sources, favoris, historique, reglages.
 *                 Quelques kilo-octets, relus instantanement par le
 *                 middleware `persist` de zustand.
 *
 *   IndexedDB     le catalogue : chaines, films, series, saisons,
 *                 episodes, guide. Jusqu'a plusieurs dizaines de
 *                 mega-octets, relus ici, de facon asynchrone.
 *
 * Il faut les deux : `localStorage` deborde au-dela de 5 Mo, et
 * IndexedDB ne peut pas etre lu assez tot pour decider du theme ou de
 * la langue au premier rendu.
 *
 * ─── Quand cette fonction est appelee ──────────────────────────────
 *
 * Une seule fois, au demarrage, depuis `ClientLayout`. Le drapeau
 * `catalogRestored` empeche qu'un second appel ecrase un catalogue
 * fraichement synchronise par une version plus ancienne relue du
 * disque.
 *
 * ─── Ce qu'elle ne fait pas ────────────────────────────────────────
 *
 * Elle ne va **jamais** sur le reseau. Si le catalogue enregistre est
 * vieux de trois semaines, il est reaffiche tel quel. Declencher une
 * resynchronisation automatique est une decision separee, non prise a
 * ce jour : l'utilisateur garde la main via le bouton de
 * synchronisation.
 *
 * @returns `true` si un catalogue exploitable a ete restaure.
 */
let catalogRestored = false;

/**
 * Fusionne un catalogue relu du disque avec celui déjà en mémoire.
 *
 * La mémoire l'emporte pour toute source qu'elle connaît déjà : un
 * import M3U pendant l'`await loadCatalog()` aurait sinon disparu
 * (le snapshot IndexedDB date d'avant l'import). Le disque complète
 * seulement les sources absentes de la mémoire.
 */
export function mergeCatalogLists<T extends { playlistId: string }>(
  stored: T[],
  memory: T[]
): T[] {
  if (memory.length === 0) return stored;
  const memorySources = new Set(memory.map((item) => item.playlistId));
  const fromDisk = stored.filter((item) => !memorySources.has(item.playlistId));
  return fromDisk.length === 0 ? memory : [...fromDisk, ...memory];
}

function mergeEpgPrograms(stored: EPGProgram[], memory: EPGProgram[]): EPGProgram[] {
  if (memory.length === 0) return stored;
  const memorySources = new Set(
    memory.map((program) => {
      const sep = program.id.indexOf(':epg:');
      return sep === -1 ? '' : program.id.slice(0, sep);
    })
  );
  const fromDisk = stored.filter((program) => {
    const sep = program.id.indexOf(':epg:');
    const source = sep === -1 ? '' : program.id.slice(0, sep);
    return !memorySources.has(source);
  });
  return fromDisk.length === 0 ? memory : [...fromDisk, ...memory];
}

export async function restoreCatalog(): Promise<boolean> {
  if (catalogRestored) return false;
  catalogRestored = true;

  try {
    const stored = await loadCatalog();
    if (!hasCatalogContent(stored)) return false;

    const current = useAppStore.getState();
    const hasMemory =
      current.channels.length > 0 ||
      current.movies.length > 0 ||
      current.series.length > 0;

    if (!hasMemory) {
      useAppStore.setState({
        channels: stored!.channels,
        liveCategories: stored!.liveCategories,
        movies: stored!.movies,
        series: stored!.series,
        seasons: stored!.seasons,
        episodes: stored!.episodes,
        epgPrograms: stored!.epgPrograms,
      });
      return true;
    }

    useAppStore.setState({
      channels: mergeCatalogLists(stored!.channels, current.channels),
      liveCategories: mergeCatalogLists(stored!.liveCategories, current.liveCategories),
      movies: mergeCatalogLists(stored!.movies, current.movies),
      series: mergeCatalogLists(stored!.series, current.series),
      seasons: dedupeById([...stored!.seasons, ...current.seasons]),
      episodes: dedupeById([...stored!.episodes, ...current.episodes]),
      epgPrograms: mergeEpgPrograms(stored!.epgPrograms, current.epgPrograms),
    });
    return true;
  } finally {
    useAppStore.setState({ catalogReady: true });
  }
}

/**
 * Efface le catalogue enregistre sur le disque.
 *
 * Utile lorsque l'utilisateur supprime sa derniere source : sans cela,
 * un catalogue orphelin serait rejoue au prochain demarrage, affichant
 * des chaines rattachees a une source disparue.
 */
export async function forgetStoredCatalog(): Promise<void> {
  await clearStoredCatalog();
}

/**
 * Remet a zero le verrou de restauration. Reserve aux tests : sans
 * cela, la premiere epreuve qui appelle `restoreCatalog` empecherait
 * toutes les suivantes de fonctionner.
 */
export function __resetCatalogRestoreFlag(): void {
  catalogRestored = false;
  useAppStore.setState({ catalogReady: false });
}

export const useActiveProfile = () => {
  const profiles = useAppStore((s) => s.profiles);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  return profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;
};
