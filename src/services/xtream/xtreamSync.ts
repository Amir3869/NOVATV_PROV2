/**
 * Pont entre le service Xtream et le catalogue de l'application.
 *
 * ─────────────────────────────────────────────────────────────
 * Pourquoi un fichier séparé
 * ─────────────────────────────────────────────────────────────
 * `xtreamService.ts` parle le langage du serveur : `stream_id`,
 * `category_id`, `container_extension`. Le reste de l'application parle
 * le langage de l'interface : `LiveChannel`, `Movie`, `Series`.
 *
 * Mélanger les deux condamnerait chaque écran à connaître les
 * particularités du protocole Xtream. Le jour où l'on branchera une
 * seconde source (M3U, et plus tard d'autres portails), il faudrait
 * tout réécrire. Ce fichier est la seule frontière à franchir : il
 * traduit, et rien d'autre.
 *
 * Aucune donnée n'est inventée ici. Les champs absents de la réponse du
 * serveur restent absents (`undefined`) plutôt que remplis d'une valeur
 * plausible.
 */

import type {
  LiveCategory,
  LiveChannel,
  Movie,
  Series,
  SourceErrorKind,
} from '@/types';
import type { CatalogPayload } from '@/store/useAppStore';
import {
  xtreamService,
  XtreamError,
  type XtreamCategory,
  type XtreamCredentials,
  type XtreamSeriesInfo,
  type XtreamVodInfo,
} from './xtreamService';
import type { Season, Episode } from '@/types';
import {
  expandWithChildren,
  runWithConcurrency,
  selectionOrAll,
  type CategoryCatalog,
  type CategorySelection,
} from './categorySelection';

/**
 * Étape en cours, pour informer l'utilisateur pendant l'attente.
 *
 * Un catalogue de 40 000 entrées prend plusieurs dizaines de secondes.
 * Sans retour visuel, l'utilisateur croit que l'application est figée
 * et recharge la page en plein téléchargement.
 */
export type SyncStep =
  | 'auth'
  | 'live_categories'
  | 'live_streams'
  | 'vod_categories'
  | 'vod_streams'
  | 'series_categories'
  | 'series'
  | 'done';

export interface SyncProgress {
  step: SyncStep;
  /** Progression de 0 à 1, approximative. */
  ratio: number;
  /** Catégories déjà lues dans l'étape en cours. */
  done?: number;
  /** Catégories à lire dans l'étape en cours. */
  total?: number;
  /** Titres (chaînes / films / séries) déjà reçus. */
  loaded?: number;
}

export interface SyncOptions {
  onProgress?: (progress: SyncProgress) => void;
  signal?: AbortSignal;
  /**
   * Catégories retenues par l'utilisateur.
   *
   * `undefined` — le cas des sources créées avant l'arrivée de ce
   * réglage — signifie « tout télécharger », comportement historique.
   * Une famille au tableau vide signifie « ne rien télécharger de
   * cette famille », ce qui est différent et volontaire.
   */
  selection?: CategorySelection | null;
}

/**
 * Nombre de requêtes menées de front lors d'un téléchargement par
 * catégories.
 *
 * Trois est un compromis mesuré : la latence se recouvre largement,
 * sans ouvrir assez de connexions pour qu'un portail y voie un partage
 * de compte. Beaucoup limitent à 1 ou 2 connexions *de lecture*, mais
 * les appels d'API ne sont pas comptés de la même façon ; on reste
 * néanmoins prudent.
 */
const CATEGORY_CONCURRENCY = 3;

/**
 * Télécharge le contenu d'une famille, catégorie par catégorie.
 *
 * Pourquoi ne pas tout demander puis filtrer sur place ? Parce que la
 * réponse globale d'un gros portail peut peser plusieurs dizaines de
 * méga-octets de JSON. La télécharger pour en jeter 90 % sature la
 * mémoire d'un Fire TV Stick avant même que le filtre ne s'applique.
 *
 * Le total téléchargé ici est toujours inférieur ou égal à l'appel
 * global, et généralement dix fois moindre.
 */
async function fetchByCategories<T extends { categoryId: string }>(
  categoryIds: string[] | undefined,
  fetchAll: () => Promise<T[]>,
  fetchOne: (categoryId: string) => Promise<T[]>,
  onChunk?: (info: { done: number; total: number; loaded: number }) => void
): Promise<T[]> {
  // Pas de sélection : comportement historique, un seul appel.
  if (categoryIds === undefined) return fetchAll();

  // Sélection vide : l'utilisateur ne veut rien de cette famille. On
  // ne contacte pas le serveur du tout.
  if (categoryIds.length === 0) return [];

  let done = 0;
  let loaded = 0;
  const total = categoryIds.length;

  const batches = await runWithConcurrency(
    categoryIds,
    CATEGORY_CONCURRENCY,
    async (categoryId) => {
      const items = await fetchOne(categoryId);
      done += 1;
      loaded += items.length;
      onChunk?.({ done, total, loaded });
      // Beaucoup de portails omettent `category_id` quand on a déjà
      // filtré : sans ce tampon, films / séries / chaînes arrivent
      // sans nom de catégorie et les filtres de l'UI restent vides.
      return items.map((item) =>
        item.categoryId?.trim() ? item : { ...item, categoryId }
      );
    }
  );

  return batches.flat();
}

/**
 * Catalogue rapporté par une synchronisation Xtream.
 *
 * `CatalogPayload` déclare ses champs optionnels, et c'est justifié :
 * une liste M3U ne rapporte que des chaînes, jamais de films ni de
 * séries. Une synchronisation Xtream, elle, renvoie toujours les quatre
 * listes — vides le cas échéant, mais présentes.
 *
 * On resserre donc le type ici. Sans cela, chaque appelant devrait
 * écrire `result.catalog.channels?.length` pour un tableau qui existe
 * toujours, et TypeScript refuserait `result.catalog.channels[0]`.
 *
 * `Required<Pick<...>>` signifie « les mêmes champs, mais obligatoires ».
 * Le type reste accepté partout où l'on attend un `CatalogPayload` :
 * rendre un champ obligatoire est une promesse plus forte, jamais un
 * conflit.
 */
export type XtreamCatalog = CatalogPayload &
  Required<Pick<CatalogPayload, 'channels' | 'liveCategories' | 'movies' | 'series'>>;

export interface SyncResult {
  catalog: XtreamCatalog;
  counts: { channels: number; movies: number; series: number };
  /** Renseigné après authentification, pour l'afficher dans la fiche. */
  expiresAt?: string;
  maxConnections?: number;
  allowedOutputFormats: string[];
}

/**
 * Convertit n'importe quelle erreur en code stable.
 *
 * On renvoie un **code** et non une phrase : la phrase dépend de la
 * langue de l'interface, qui peut changer après l'échec. Le code est
 * enregistré, l'écran le traduit au moment de l'affichage.
 */
export function toSourceErrorKind(err: unknown): SourceErrorKind {
  if (err instanceof XtreamError) return err.kind;
  if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
  return 'unknown';
}

/**
 * Format de lecture à demander au serveur.
 *
 * MPEG-TS (`ts`) est le format historique et le plus largement servi,
 * mais aucun navigateur ne sait le lire nativement. HLS (`m3u8`) l'est
 * par Safari, et par les autres via `hls.js`. On préfère donc `m3u8`
 * **quand le serveur l'annonce**, sinon on retombe sur `ts` — qui
 * exigera `mpegts.js` côté lecteur (Phase 6).
 */
function pickLiveFormat(allowedFormats: string[]): 'ts' | 'm3u8' {
  const normalized = allowedFormats.map((f) => f.toLowerCase());
  return normalized.includes('m3u8') ? 'm3u8' : 'ts';
}

/**
 * Devine le type de flux à partir de l'extension.
 * Sert au lecteur pour choisir son moteur.
 */
function streamTypeFor(format: 'ts' | 'm3u8'): LiveChannel['streamType'] {
  return format === 'm3u8' ? 'hls' : 'other';
}

/**
 * Convertit une date d'expiration en texte ISO.
 * `null` (compte illimité) doit rester `undefined`, pas la chaîne
 * « null » ni la date du jour.
 */
function isoOrUndefined(date: Date | null): string | undefined {
  return date ? date.toISOString() : undefined;
}

/**
 * Interprète une année depuis une date de sortie de forme variable.
 * Les portails renvoient `2019`, `2019-05-01`, `01/05/2019` ou du vide.
 * En cas de doute, on ne renvoie rien.
 */
function yearFrom(releaseDate: string): number | undefined {
  const match = /(\d{4})/.exec(releaseDate);
  if (!match) return undefined;
  const year = Number(match[1]);
  // Garde-fou : un identifiant à 4 chiffres ne doit pas passer pour
  // une année de sortie.
  return year >= 1880 && year <= 2200 ? year : undefined;
}

/** Remplace une chaîne vide par `undefined`. */
function orUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Les logos Xtream arrivent souvent en chemin relatif (`/images/tf1.png`).
 * Sans base, la WebView les cherche sur elle-même : image absente,
 * alors que Smarters les affiche.
 */
export function absoluteMediaUrl(serverUrl: string, raw: string | undefined): string | undefined {
  const value = orUndefined(raw);
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `http:${value}`;
  try {
    const base = serverUrl.endsWith('/') ? serverUrl : `${serverUrl}/`;
    return new URL(value, base).href;
  } catch {
    return value;
  }
}

/** Unix secondes ou date lisible → ISO. Sinon rien. */
export function addedAtFrom(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (seconds > 1_000_000_000) return new Date(seconds * 1000).toISOString();
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

/**
 * Préfixe les identifiants par celui de la source.
 *
 * Deux abonnements différents peuvent servir la chaîne `1`. Sans
 * préfixe, le second écraserait le premier dans le catalogue, et un
 * clic ouvrirait la mauvaise chaîne.
 */
function scopedId(playlistId: string, kind: string, id: number | string): string {
  return `${playlistId}:${kind}:${id}`;
}

export function mapLiveCategories(
  categories: { categoryId: string; categoryName: string }[],
  channelsByCategory: Map<string, number>,
  playlistId: string
): LiveCategory[] {
  return categories.map((c) => ({
    id: scopedId(playlistId, 'livecat', c.categoryId),
    name: c.categoryName,
    channelCount: channelsByCategory.get(c.categoryId) ?? 0,
    playlistId,
  }));
}

export function mapLiveChannels(
  streams: {
    num: number;
    name: string;
    streamId: number;
    streamIcon: string;
    epgChannelId: string;
    categoryId: string;
  }[],
  categoryNames: Map<string, string>,
  creds: XtreamCredentials,
  playlistId: string,
  format: 'ts' | 'm3u8'
): LiveChannel[] {
  return streams.map((s) => ({
    id: scopedId(playlistId, 'live', s.streamId),
    name: s.name,
    streamUrl: xtreamService.getLiveStreamUrl(creds, s.streamId, format),
    streamType: streamTypeFor(format),
    logo: absoluteMediaUrl(creds.serverUrl, s.streamIcon),
    categoryId: s.categoryId
      ? scopedId(playlistId, 'livecat', s.categoryId)
      : undefined,
    categoryName: categoryNames.get(s.categoryId),
    epgChannelId: orUndefined(s.epgChannelId),
    tvgId: orUndefined(s.epgChannelId),
    playlistId,
    streamId: s.streamId,
    // Ces deux drapeaux appartiennent au profil de l'utilisateur, pas
    // au serveur. Ils sont recalculés à l'affichage depuis `favorites`
    // et `watchHistory` ; les fixer ici serait mentir.
    isFavorite: false,
    isRecent: false,
    sortOrder: s.num,
  }));
}

export function mapMovies(
  streams: {
    num: number;
    name: string;
    streamId: number;
    streamIcon: string;
    rating: string;
    categoryId: string;
    containerExtension: string;
    added?: string;
  }[],
  categoryNames: Map<string, string>,
  creds: XtreamCredentials,
  playlistId: string
): Movie[] {
  return streams.map((s) => ({
    id: scopedId(playlistId, 'movie', s.streamId),
    name: s.name,
    streamUrl: xtreamService.getVodStreamUrl(creds, s.streamId, s.containerExtension),
    logo: absoluteMediaUrl(creds.serverUrl, s.streamIcon),
    rating: orUndefined(s.rating),
    categoryId: orUndefined(s.categoryId),
    categoryName: categoryNames.get(s.categoryId),
    playlistId,
    streamId: s.streamId,
    containerExtension: orUndefined(s.containerExtension),
    addedAt: addedAtFrom(s.added),
    isFavorite: false,
    // `plot`, `cast`, `director`, `duration` ne figurent pas dans
    // `get_vod_streams` : ils exigent un appel `get_vod_info` par film.
    // Les demander pour 10 000 films saturerait le serveur. Ils seront
    // chargés à l'ouverture de la fiche.
  }));
}

export function mapSeries(
  entries: {
    num: number;
    name: string;
    seriesId: number;
    cover: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    releaseDate: string;
    rating: string;
    categoryId: string;
  }[],
  categoryNames: Map<string, string>,
  playlistId: string
): Series[] {
  return entries.map((s) => ({
    id: scopedId(playlistId, 'series', s.seriesId),
    name: s.name,
    cover: orUndefined(s.cover),
    plot: orUndefined(s.plot),
    cast: orUndefined(s.cast),
    director: orUndefined(s.director),
    genre: orUndefined(s.genre),
    releaseDate: orUndefined(s.releaseDate),
    year: yearFrom(s.releaseDate),
    rating: orUndefined(s.rating),
    categoryId: orUndefined(s.categoryId),
    categoryName: categoryNames.get(s.categoryId),
    playlistId,
    seriesId: s.seriesId,
    isFavorite: false,
    // Saisons et épisodes exigent un `get_series_info` par série :
    // chargés à l'ouverture de la fiche, pas ici.
  }));
}

export interface SeriesDetails {
  seasons: Season[];
  episodes: Episode[];
  seriesPatch: Partial<Series>;
}

/**
 * Traduit la fiche Xtream d'une série vers les types de l'application.
 *
 * Les identifiants sont préfixés comme le reste du catalogue, pour que
 * deux abonnements ne se marchent pas dessus.
 */
export function mapSeriesInfo(
  info: XtreamSeriesInfo,
  creds: XtreamCredentials,
  playlistId: string,
  seriesId: string
): SeriesDetails {
  const seasons: Season[] = info.seasons.map((season) => ({
    id: `${seriesId}:season:${season.seasonNumber}`,
    seriesId,
    seasonNumber: season.seasonNumber,
    name: season.name.trim(),
    cover: orUndefined(season.cover),
    airDate: orUndefined(season.airDate),
    episodeCount: season.episodeCount,
  }));

  const episodes: Episode[] = info.episodes.map((episode) => {
    const seasonId = `${seriesId}:season:${episode.seasonNumber}`;
    return {
      id: `${seriesId}:episode:${episode.streamId}`,
      seriesId,
      seasonId,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      plot: orUndefined(episode.plot),
      image: orUndefined(episode.image),
      duration: episode.durationSecs > 0 ? episode.durationSecs : undefined,
      streamUrl: xtreamService.getEpisodeStreamUrl(
        creds,
        episode.streamId,
        episode.containerExtension
      ),
      containerExtension: orUndefined(episode.containerExtension),
      rating: orUndefined(episode.rating),
      airDate: orUndefined(episode.airDate),
      isWatched: false,
    };
  });

  const seriesPatch: Partial<Series> = {
    plot: orUndefined(info.plot),
    cast: orUndefined(info.cast),
    director: orUndefined(info.director),
    genre: orUndefined(info.genre),
    releaseDate: orUndefined(info.releaseDate),
    year: yearFrom(info.releaseDate),
    rating: orUndefined(info.rating),
    cover: orUndefined(info.cover),
    backdrop: orUndefined(info.backdrop),
    episodeCount: episodes.length || undefined,
  };

  return { seasons, episodes, seriesPatch };
}

/**
 * Ne recopie que les champs réellement fournis par le serveur.
 * Un champ vide ne doit pas écraser une valeur déjà connue.
 */
export function mapVodInfo(info: XtreamVodInfo, movie: Movie): Partial<Movie> {
  const patch: Partial<Movie> = {};
  const plot = orUndefined(info.plot);
  const cast = orUndefined(info.cast);
  const director = orUndefined(info.director);
  const genre = orUndefined(info.genre);
  const releaseDate = orUndefined(info.releaseDate);
  const rating = orUndefined(info.rating);
  const backdrop = orUndefined(info.backdrop);
  const image = orUndefined(info.image);
  const tmdbId = orUndefined(info.tmdbId);
  if (plot) patch.plot = plot;
  if (cast) patch.cast = cast;
  if (director) patch.director = director;
  if (genre) patch.genre = genre;
  if (releaseDate) {
    patch.releaseDate = releaseDate;
    const year = yearFrom(releaseDate);
    if (year) patch.year = year;
  }
  if (rating) patch.rating = rating;
  if (backdrop) patch.backdrop = backdrop;
  if (image && !movie.logo) patch.logo = image;
  if (tmdbId) patch.tmdbId = tmdbId;
  if (info.durationSecs > 0) {
    patch.duration = Math.round(info.durationSecs / 60);
  }
  if (orUndefined(info.containerExtension) && !movie.containerExtension) {
    patch.containerExtension = info.containerExtension;
  }
  return patch;
}

export async function fetchSeriesDetails(
  creds: XtreamCredentials,
  playlistId: string,
  seriesId: string,
  xtreamSeriesId: number,
  options?: { signal?: AbortSignal }
): Promise<SeriesDetails> {
  const info = await xtreamService.getSeriesInfo(creds, xtreamSeriesId, options);
  return mapSeriesInfo(info, creds, playlistId, seriesId);
}

export async function fetchVodDetails(
  creds: XtreamCredentials,
  movie: Movie,
  options?: { signal?: AbortSignal }
): Promise<Partial<Movie>> {
  if (typeof movie.streamId !== 'number') return {};
  const info = await xtreamService.getVodInfo(creds, movie.streamId, options);
  return mapVodInfo(info, movie);
}

/**
 * Récupère l'intégralité du catalogue d'un compte Xtream.
 *
 * ─── Sur la stratégie d'appels ───
 * On demande les listes **sans filtre de catégorie**. C'est
 * contre-intuitif, mais un appel unique rapportant 40 000 chaînes coûte
 * bien moins cher que 300 appels d'une centaine d'entrées chacun :
 * chaque requête paie sa latence réseau, et beaucoup de portails
 * limitent le nombre de requêtes par minute.
 *
 * ─── Sur la tolérance aux pannes ───
 * Le direct est obligatoire : sans lui, il n'y a pas d'application. Les
 * films et les séries, non — beaucoup d'abonnements n'en proposent pas,
 * et certains portails répondent par une erreur au lieu d'une liste
 * vide. Un échec sur ces deux volets est donc absorbé, pas propagé.
 */
/**
 * Récupère les seules catégories, sans le moindre contenu.
 *
 * C'est l'appel qui précède l'écran de sélection. Trois petites
 * réponses JSON — quelques kilo-octets là où le catalogue complet en
 * pèse des dizaines de milliers — donc une attente d'une seconde au
 * lieu de plusieurs minutes.
 *
 * Films et séries sont tolérants à l'échec : un abonnement qui ne
 * propose que du direct répond en erreur à `get_vod_categories`, et
 * ce n'est pas une panne. Le direct, lui, ne l'est pas : un portail
 * sans aucune catégorie de chaînes est un portail cassé, et le taire
 * conduirait l'utilisateur à valider un écran vide sans comprendre.
 */
export async function fetchCategoryCatalog(
  creds: XtreamCredentials,
  options: { signal?: AbortSignal } = {}
): Promise<CategoryCatalog> {
  const { signal } = options;

  const live = await xtreamService.getLiveCategories(creds, { signal });

  const optional = async (
    load: () => Promise<XtreamCategory[]>
  ): Promise<XtreamCategory[]> => {
    try {
      return await load();
    } catch (err) {
      // Une annulation volontaire doit remonter : ce n'est pas un
      // abonnement sans films, c'est un arrêt demandé.
      if (toSourceErrorKind(err) === 'aborted') throw err;
      return [];
    }
  };

  const vod = await optional(() => xtreamService.getVodCategories(creds, { signal }));
  const series = await optional(() =>
    xtreamService.getSeriesCategories(creds, { signal })
  );

  return { live, vod, series };
}

export async function syncXtreamCatalog(
  creds: XtreamCredentials,
  playlistId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const { onProgress, signal, selection } = options;
  const report = (
    step: SyncStep,
    ratio: number,
    extra?: { done: number; total: number; loaded: number }
  ) => onProgress?.({ step, ratio, ...extra });

  report('auth', 0);
  const { userInfo } = await xtreamService.getAccountInfo(creds, { signal });
  const format = pickLiveFormat(userInfo.allowedOutputFormats);

  report('live_categories', 0.1);
  const allLiveCategories = await xtreamService.getLiveCategories(creds, { signal });
  const liveSelection = expandWithChildren(selectionOrAll(selection, 'live'), allLiveCategories);
  const liveCategories =
    liveSelection === undefined
      ? allLiveCategories
      : allLiveCategories.filter((c) => liveSelection.includes(c.categoryId));
  const liveCategoryNames = new Map(
    liveCategories.map((c) => [c.categoryId, c.categoryName])
  );

  report('live_streams', 0.2);
  const liveStreams = await fetchByCategories(
    liveSelection,
    () => xtreamService.getLiveStreams(creds, undefined, { signal }),
    (categoryId) => xtreamService.getLiveStreams(creds, categoryId, { signal }),
    (chunk) => report('live_streams', 0.2 + 0.25 * (chunk.done / Math.max(1, chunk.total)), chunk)
  );

  // Comptage réel par catégorie : afficher un nombre inventé serait
  // pire que de n'en afficher aucun.
  const channelsByCategory = new Map<string, number>();
  liveStreams.forEach((s) => {
    channelsByCategory.set(s.categoryId, (channelsByCategory.get(s.categoryId) ?? 0) + 1);
  });

  const channels = mapLiveChannels(
    liveStreams,
    liveCategoryNames,
    creds,
    playlistId,
    format
  );

  report('vod_categories', 0.5);
  let movies: Movie[] = [];
  try {
    const allVodCategories = await xtreamService.getVodCategories(creds, { signal });
    const vodSelection = expandWithChildren(selectionOrAll(selection, 'vod'), allVodCategories);
    const vodCategories =
      vodSelection === undefined
        ? allVodCategories
        : allVodCategories.filter((c) => vodSelection.includes(c.categoryId));
    const vodNames = new Map(vodCategories.map((c) => [c.categoryId, c.categoryName]));
    report('vod_streams', 0.6);
    const vodStreams = await fetchByCategories(
      vodSelection,
      () => xtreamService.getVodStreams(creds, undefined, { signal }),
      (categoryId) => xtreamService.getVodStreams(creds, categoryId, { signal }),
      (chunk) => report('vod_streams', 0.6 + 0.15 * (chunk.done / Math.max(1, chunk.total)), chunk)
    );
    movies = mapMovies(vodStreams, vodNames, creds, playlistId);
  } catch (err) {
    // Une annulation par l'utilisateur doit remonter : elle n'est pas
    // un abonnement sans films, c'est un arrêt volontaire.
    if (toSourceErrorKind(err) === 'aborted') throw err;
    movies = [];
  }

  report('series_categories', 0.8);
  let series: Series[] = [];
  try {
    const allSeriesCategories = await xtreamService.getSeriesCategories(creds, { signal });
    const seriesSelection = expandWithChildren(
      selectionOrAll(selection, 'series'),
      allSeriesCategories
    );
    const seriesCategories =
      seriesSelection === undefined
        ? allSeriesCategories
        : allSeriesCategories.filter((c) => seriesSelection.includes(c.categoryId));
    const seriesNames = new Map(
      seriesCategories.map((c) => [c.categoryId, c.categoryName])
    );
    report('series', 0.9);
    const seriesList = await fetchByCategories(
      seriesSelection,
      () => xtreamService.getSeries(creds, undefined, { signal }),
      (categoryId) => xtreamService.getSeries(creds, categoryId, { signal })
    );
    series = mapSeries(seriesList, seriesNames, playlistId);
  } catch (err) {
    if (toSourceErrorKind(err) === 'aborted') throw err;
    series = [];
  }

  report('done', 1);

  return {
    catalog: {
      channels,
      liveCategories: mapLiveCategories(liveCategories, channelsByCategory, playlistId),
      movies,
      series,
    },
    counts: {
      channels: channels.length,
      movies: movies.length,
      series: series.length,
    },
    expiresAt: isoOrUndefined(userInfo.expiresAt),
    maxConnections: userInfo.maxConnections || undefined,
    allowedOutputFormats: userInfo.allowedOutputFormats,
  };
}
