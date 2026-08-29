/**
 * Connecteur Xtream Codes — Nova TV
 *
 * Un serveur Xtream Codes expose une seule adresse, `player_api.php`, à
 * laquelle on passe un identifiant, un mot de passe et une « action ».
 * Il répond en JSON.
 *
 * Deux points à connaître avant de toucher à ce fichier :
 *
 * 1. Le serveur répond en **snake_case** (`stream_id`, `category_id`),
 *    alors que le reste du projet est en camelCase. La conversion est
 *    faite ici, explicitement, champ par champ. Il ne faut jamais
 *    supposer qu'un champ du serveur porte le nom qu'on utilise côté
 *    interface.
 *
 * 2. Le serveur répond **HTTP 200 même quand les identifiants sont
 *    faux**. L'échec se lit dans `user_info.auth`, qui vaut 0. Se fier
 *    au code HTTP seul afficherait « connecté » à quelqu'un qui ne
 *    l'est pas.
 *
 * Aucun identifiant n'est conservé dans ce module : ils sont passés à
 * chaque appel et stockés par l'appelant.
 *
 * Cadre légal : ce connecteur ne fonctionne qu'avec un abonnement dont
 * l'utilisateur dispose légitimement. Il ne fournit aucun accès.
 */

export interface XtreamCredentials {
  /** Adresse complète du serveur, ex. `http://exemple.com:8080`. */
  serverUrl: string;
  username: string;
  password: string;
}

export interface XtreamUserInfo {
  username: string;
  /** `Active`, `Expired`, `Disabled`, `Banned`… */
  status: string;
  /** Date d'expiration, ou `null` si le compte est illimité. */
  expiresAt: Date | null;
  isTrial: boolean;
  activeConnections: number;
  maxConnections: number;
  /** Formats acceptés par le serveur, ex. `['m3u8', 'ts']`. */
  allowedOutputFormats: string[];
}

export interface XtreamServerDetails {
  url: string;
  port: string;
  httpsPort: string;
  serverProtocol: string;
  timezone: string;
  /** Heure du serveur, utile pour aligner l'EPG. */
  serverTime: Date | null;
}

export interface XtreamCategory {
  categoryId: string;
  categoryName: string;
  parentId: number;
}

export interface XtreamLiveStream {
  num: number;
  name: string;
  streamId: number;
  streamIcon: string;
  /** Identifiant à rapprocher du `channel id` de l'EPG XMLTV. */
  epgChannelId: string;
  categoryId: string;
  /** Le serveur conserve-t-il les programmes passés (replay) ? */
  hasArchive: boolean;
  archiveDurationDays: number;
}

export interface XtreamVodStream {
  num: number;
  name: string;
  streamId: number;
  streamIcon: string;
  rating: string;
  categoryId: string;
  /** Extension du fichier, nécessaire pour construire l'adresse. */
  containerExtension: string;
}

export interface XtreamSeries {
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
  youtubeTrailer: string;
  episodeRunTime: string;
  categoryId: string;
}

/**
 * Erreur enrichie : porte un message lisible par l'utilisateur final,
 * distinct du détail technique destiné aux journaux.
 */
export type XtreamErrorKind =
  | 'invalid_url'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'auth'
  | 'account_inactive'
  | 'http'
  | 'bad_response';

export class XtreamError extends Error {
  readonly kind: XtreamErrorKind;
  /** Message destiné à être affiché tel quel dans l'interface. */
  readonly userMessage: string;

  constructor(kind: XtreamErrorKind, userMessage: string, technical?: string) {
    super(technical ?? userMessage);
    this.name = 'XtreamError';
    this.kind = kind;
    this.userMessage = userMessage;
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  /** Délai maximal en millisecondes. */
  timeoutMs?: number;
}

/** Listes complètes : un catalogue peut dépasser 50 000 entrées. */
const TIMEOUT_LIST = 60_000;
/** Test de connexion : l'utilisateur attend devant l'écran. */
const TIMEOUT_AUTH = 15_000;
/** Fiche d'un seul film ou d'une seule série. */
const TIMEOUT_DETAIL = 20_000;

/**
 * Vérifie et normalise l'adresse du serveur.
 *
 * L'utilisateur tape souvent `exemple.com:8080` sans préfixe. Sans
 * cette étape, `new URL()` lèverait une exception incompréhensible.
 */
export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new XtreamError('invalid_url', "L'adresse du serveur est vide.");
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new XtreamError(
      'invalid_url',
      "L'adresse du serveur n'est pas valide. Exemple attendu : http://monserveur.com:8080",
      raw
    );
  }

  if (!parsed.hostname) {
    throw new XtreamError('invalid_url', "L'adresse du serveur est incomplète.");
  }

  // On retire le chemin : certains utilisateurs collent l'URL complète
  // du player_api.php, ou une adresse de flux.
  return `${parsed.protocol}//${parsed.host}`;
}

function assertCredentials(creds: XtreamCredentials): XtreamCredentials {
  if (!creds.username?.trim()) {
    throw new XtreamError('auth', "L'identifiant est vide.");
  }
  if (!creds.password) {
    throw new XtreamError('auth', 'Le mot de passe est vide.');
  }
  return {
    serverUrl: normalizeServerUrl(creds.serverUrl),
    username: creds.username.trim(),
    password: creds.password,
  };
}

/**
 * Combine le délai d'attente et une éventuelle annulation utilisateur.
 * `AbortSignal.any` n'est pas disponible partout (WebView Fire OS
 * ancienne) : on le remplace au besoin.
 */
function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) return timeout;

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeout, external]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (external.aborted || timeout.aborted) controller.abort();
  external.addEventListener('abort', abort, { once: true });
  timeout.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

function toUserFacingError(err: unknown, external?: AbortSignal): XtreamError {
  if (err instanceof XtreamError) return err;

  if (err instanceof DOMException) {
    // Distinguer « l'utilisateur a annulé » de « le serveur n'a pas
    // répondu à temps » : ce n'est pas le même message à l'écran.
    if (external?.aborted) {
      return new XtreamError('aborted', 'Opération annulée.');
    }
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return new XtreamError(
        'timeout',
        "Le serveur met trop de temps à répondre. Vérifiez l'adresse et votre connexion, puis réessayez."
      );
    }
  }

  return new XtreamError(
    'network',
    "Impossible de joindre le serveur. Vérifiez votre connexion Internet, puis réessayez.",
    err instanceof Error ? err.message : String(err)
  );
}

type XtreamAction =
  | 'get_live_categories'
  | 'get_live_streams'
  | 'get_vod_categories'
  | 'get_vod_streams'
  | 'get_series'
  | 'get_series_categories'
  | 'get_series_info'
  | 'get_vod_info'
  | 'get_short_epg'
  | 'get_simple_data_table';

async function xtreamRequest(
  creds: XtreamCredentials,
  action: XtreamAction,
  extraParams: Record<string, string> = {},
  options: RequestOptions = {}
): Promise<unknown> {
  const safe = assertCredentials(creds);

  const params = new URLSearchParams({
    username: safe.username,
    password: safe.password,
    action,
    ...extraParams,
  });

  const url = `${safe.serverUrl}/player_api.php?${params.toString()}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      // Note : `User-Agent` ne peut pas être défini depuis un navigateur
      // (en-tête interdit par la spécification fetch, silencieusement
      // ignoré). L'ancienne version le posait pour rien. Sur Android via
      // Capacitor, il faudra le régler côté natif si un serveur l'exige.
      headers: { Accept: 'application/json' },
      signal: combineSignals(options.timeoutMs ?? TIMEOUT_LIST, options.signal),
    });
  } catch (err) {
    throw toUserFacingError(err, options.signal);
  }

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new XtreamError(
        'auth',
        'Identifiant ou mot de passe refusé par le serveur.',
        `HTTP ${resp.status}`
      );
    }
    throw new XtreamError(
      'http',
      `Le serveur a répondu par une erreur (${resp.status}). Réessayez plus tard.`,
      `HTTP ${resp.status} ${resp.statusText}`
    );
  }

  // Un portail mal configuré renvoie une page HTML d'erreur avec un
  // code 200. `resp.json()` lèverait alors une exception illisible.
  const text = await resp.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new XtreamError(
      'bad_response',
      "Le serveur n'a pas renvoyé de données exploitables. L'adresse pointe peut-être vers autre chose qu'un serveur Xtream.",
      text.slice(0, 200)
    );
  }
}

/* ------------------------------------------------------------------ */
/* Conversion des réponses                                            */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * Le serveur mélange les types : `category_id` arrive tantôt en nombre,
 * tantôt en chaîne, selon la version du portail. On normalise.
 */
function str(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function bool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return false;
}

/** Les dates arrivent en secondes Unix, souvent sous forme de chaîne. */
function unixToDate(value: unknown): Date | null {
  const seconds = num(value, NaN);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Certaines actions renvoient `[]` quand tout va bien, mais un objet
 * `{"user_info":…}` ou `false` quand quelque chose cloche. On refuse
 * silencieusement ce qui n'est pas une liste plutôt que de laisser
 * planter l'interface.
 */
function asArray(value: unknown, context: string): unknown[] {
  if (Array.isArray(value)) return value;
  throw new XtreamError(
    'bad_response',
    "Le serveur a renvoyé une réponse inattendue. Vérifiez que votre abonnement est actif.",
    `${context}: ${typeof value}`
  );
}

function toCategory(raw: unknown): XtreamCategory {
  const r = asRecord(raw);
  return {
    categoryId: str(r.category_id),
    categoryName: str(r.category_name, 'Sans nom'),
    parentId: num(r.parent_id),
  };
}

function toLiveStream(raw: unknown): XtreamLiveStream {
  const r = asRecord(raw);
  return {
    num: num(r.num),
    name: str(r.name, 'Chaîne sans nom'),
    streamId: num(r.stream_id),
    streamIcon: str(r.stream_icon),
    epgChannelId: str(r.epg_channel_id),
    categoryId: str(r.category_id),
    hasArchive: bool(r.tv_archive),
    archiveDurationDays: num(r.tv_archive_duration),
  };
}

function toVodStream(raw: unknown): XtreamVodStream {
  const r = asRecord(raw);
  return {
    num: num(r.num),
    name: str(r.name, 'Sans titre'),
    streamId: num(r.stream_id),
    streamIcon: str(r.stream_icon),
    rating: str(r.rating),
    categoryId: str(r.category_id),
    // Sans extension, l'adresse de lecture serait invalide. `mp4` est
    // le repli le plus courant.
    containerExtension: str(r.container_extension, 'mp4'),
  };
}

function toSeries(raw: unknown): XtreamSeries {
  const r = asRecord(raw);
  return {
    num: num(r.num),
    name: str(r.name, 'Sans titre'),
    seriesId: num(r.series_id),
    cover: str(r.cover),
    plot: str(r.plot),
    cast: str(r.cast),
    director: str(r.director),
    genre: str(r.genre),
    releaseDate: str(r.releaseDate) || str(r.release_date),
    rating: str(r.rating),
    youtubeTrailer: str(r.youtube_trailer),
    episodeRunTime: str(r.episode_run_time),
    categoryId: str(r.category_id),
  };
}

/* ------------------------------------------------------------------ */
/* Construction des adresses de lecture                               */
/* ------------------------------------------------------------------ */

/**
 * L'identifiant et le mot de passe font partie du **chemin** de
 * l'adresse, pas des paramètres. Un mot de passe contenant `/`, `?`,
 * `#` ou un espace casserait l'adresse s'il n'était pas encodé.
 * L'ancienne version les concaténait bruts.
 */
function buildStreamUrl(
  creds: XtreamCredentials,
  kind: 'live' | 'movie' | 'series',
  streamId: number,
  extension: string
): string {
  const safe = assertCredentials(creds);
  const user = encodeURIComponent(safe.username);
  const pass = encodeURIComponent(safe.password);
  const ext = extension.replace(/^\./, '');
  return `${safe.serverUrl}/${kind}/${user}/${pass}/${streamId}.${ext}`;
}

/* ------------------------------------------------------------------ */
/* Service public                                                     */
/* ------------------------------------------------------------------ */

export const xtreamService = {
  normalizeServerUrl,

  /**
   * Teste la connexion et récupère l'état du compte.
   *
   * Attention : un serveur Xtream répond **HTTP 200 avec `auth: 0`**
   * quand les identifiants sont faux. C'est la seule façon fiable de
   * détecter un échec d'authentification.
   */
  async getAccountInfo(
    creds: XtreamCredentials,
    options: RequestOptions = {}
  ): Promise<{ userInfo: XtreamUserInfo; serverInfo: XtreamServerDetails }> {
    const safe = assertCredentials(creds);

    const params = new URLSearchParams({
      username: safe.username,
      password: safe.password,
    });

    let resp: Response;
    try {
      resp = await fetch(`${safe.serverUrl}/player_api.php?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: combineSignals(options.timeoutMs ?? TIMEOUT_AUTH, options.signal),
      });
    } catch (err) {
      throw toUserFacingError(err, options.signal);
    }

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        throw new XtreamError('auth', 'Identifiant ou mot de passe refusé par le serveur.');
      }
      throw new XtreamError(
        'http',
        `Le serveur a répondu par une erreur (${resp.status}).`,
        `HTTP ${resp.status}`
      );
    }

    const text = await resp.text();
    let payload: Record<string, unknown>;
    try {
      payload = asRecord(JSON.parse(text));
    } catch {
      throw new XtreamError(
        'bad_response',
        "Cette adresse ne semble pas être un serveur Xtream Codes. Vérifiez l'adresse et le port.",
        text.slice(0, 200)
      );
    }

    const rawUser = asRecord(payload.user_info);
    const rawServer = asRecord(payload.server_info);

    // Le point critique : identifiants refusés malgré un HTTP 200.
    if (Object.keys(rawUser).length === 0 || num(rawUser.auth, 0) !== 1) {
      throw new XtreamError(
        'auth',
        'Identifiant ou mot de passe incorrect. Vérifiez vos informations de connexion.',
        `auth=${str(rawUser.auth, 'absent')}`
      );
    }

    const status = str(rawUser.status, 'Unknown');
    if (status.toLowerCase() !== 'active') {
      const explanation: Record<string, string> = {
        expired: 'Votre abonnement a expiré. Contactez votre fournisseur.',
        disabled: 'Ce compte a été désactivé par le fournisseur.',
        banned: 'Ce compte a été banni par le fournisseur.',
      };
      throw new XtreamError(
        'account_inactive',
        explanation[status.toLowerCase()] ??
          `Ce compte n'est pas actif (état renvoyé : ${status}).`,
        status
      );
    }

    const formats = Array.isArray(rawUser.allowed_output_formats)
      ? rawUser.allowed_output_formats.map((f) => str(f)).filter(Boolean)
      : [];

    return {
      userInfo: {
        username: str(rawUser.username),
        status,
        expiresAt: unixToDate(rawUser.exp_date),
        isTrial: bool(rawUser.is_trial),
        activeConnections: num(rawUser.active_cons),
        maxConnections: num(rawUser.max_connections),
        allowedOutputFormats: formats,
      },
      serverInfo: {
        url: str(rawServer.url),
        port: str(rawServer.port),
        httpsPort: str(rawServer.https_port),
        serverProtocol: str(rawServer.server_protocol, 'http'),
        timezone: str(rawServer.timezone),
        serverTime: unixToDate(rawServer.timestamp_now),
      },
    };
  },

  async getLiveCategories(
    creds: XtreamCredentials,
    options?: RequestOptions
  ): Promise<XtreamCategory[]> {
    const raw = await xtreamRequest(creds, 'get_live_categories', {}, options);
    return asArray(raw, 'get_live_categories').map(toCategory);
  },

  async getLiveStreams(
    creds: XtreamCredentials,
    categoryId?: string,
    options?: RequestOptions
  ): Promise<XtreamLiveStream[]> {
    const raw = await xtreamRequest(
      creds,
      'get_live_streams',
      categoryId ? { category_id: categoryId } : {},
      options
    );
    return asArray(raw, 'get_live_streams').map(toLiveStream);
  },

  async getVodCategories(
    creds: XtreamCredentials,
    options?: RequestOptions
  ): Promise<XtreamCategory[]> {
    const raw = await xtreamRequest(creds, 'get_vod_categories', {}, options);
    return asArray(raw, 'get_vod_categories').map(toCategory);
  },

  async getVodStreams(
    creds: XtreamCredentials,
    categoryId?: string,
    options?: RequestOptions
  ): Promise<XtreamVodStream[]> {
    const raw = await xtreamRequest(
      creds,
      'get_vod_streams',
      categoryId ? { category_id: categoryId } : {},
      options
    );
    return asArray(raw, 'get_vod_streams').map(toVodStream);
  },

  async getSeriesCategories(
    creds: XtreamCredentials,
    options?: RequestOptions
  ): Promise<XtreamCategory[]> {
    const raw = await xtreamRequest(creds, 'get_series_categories', {}, options);
    return asArray(raw, 'get_series_categories').map(toCategory);
  },

  async getSeries(
    creds: XtreamCredentials,
    categoryId?: string,
    options?: RequestOptions
  ): Promise<XtreamSeries[]> {
    const raw = await xtreamRequest(
      creds,
      'get_series',
      categoryId ? { category_id: categoryId } : {},
      options
    );
    return asArray(raw, 'get_series').map(toSeries);
  },

  /**
   * Fiche détaillée d'une série : saisons et épisodes.
   * La forme de la réponse varie fortement d'un portail à l'autre ;
   * elle est renvoyée brute et sera normalisée en Phase 4, contre un
   * vrai serveur.
   */
  getSeriesInfo(creds: XtreamCredentials, seriesId: number, options?: RequestOptions) {
    return xtreamRequest(
      creds,
      'get_series_info',
      { series_id: String(seriesId) },
      { timeoutMs: TIMEOUT_DETAIL, ...options }
    );
  },

  getVodInfo(creds: XtreamCredentials, vodId: number, options?: RequestOptions) {
    return xtreamRequest(
      creds,
      'get_vod_info',
      { vod_id: String(vodId) },
      { timeoutMs: TIMEOUT_DETAIL, ...options }
    );
  },

  /** Programmes à venir d'une chaîne (guide court). */
  getShortEpg(
    creds: XtreamCredentials,
    streamId: number,
    limit = 8,
    options?: RequestOptions
  ) {
    return xtreamRequest(
      creds,
      'get_short_epg',
      { stream_id: String(streamId), limit: String(limit) },
      { timeoutMs: TIMEOUT_DETAIL, ...options }
    );
  },

  /**
   * Adresse de lecture d'une chaîne en direct.
   *
   * Le format par défaut est `ts` (MPEG-TS) : c'est ce que servent la
   * plupart des portails. `m3u8` n'est pas toujours disponible —
   * `userInfo.allowedOutputFormats` indique ce que le serveur accepte.
   */
  getLiveStreamUrl(
    creds: XtreamCredentials,
    streamId: number,
    format: 'ts' | 'm3u8' = 'ts'
  ): string {
    return buildStreamUrl(creds, 'live', streamId, format);
  },

  getVodStreamUrl(creds: XtreamCredentials, streamId: number, ext: string): string {
    return buildStreamUrl(creds, 'movie', streamId, ext || 'mp4');
  },

  getEpisodeStreamUrl(creds: XtreamCredentials, streamId: number, ext: string): string {
    return buildStreamUrl(creds, 'series', streamId, ext || 'mp4');
  },

  /** Adresse du guide des programmes complet, au format XMLTV. */
  getEpgUrl(creds: XtreamCredentials): string {
    const safe = assertCredentials(creds);
    const params = new URLSearchParams({
      username: safe.username,
      password: safe.password,
    });
    return `${safe.serverUrl}/xmltv.php?${params.toString()}`;
  },
};
