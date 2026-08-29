/**
 * Pont entre l'analyseur M3U et le catalogue de l'application.
 *
 * Même rôle que `xtreamSync.ts` pour Xtream : `m3uParser.ts` rend des
 * `M3UEntry`, c'est-à-dire ce qui est écrit dans le fichier ; les écrans
 * consomment des `LiveChannel`. Ce fichier traduit, et rien d'autre.
 *
 * ─────────────────────────────────────────────────────────────
 * Une différence importante avec Xtream
 * ─────────────────────────────────────────────────────────────
 * Un fichier M3U ne distingue pas les chaînes des films. Certaines
 * playlists y rangent de la vidéo à la demande, repérable seulement à
 * des indices peu fiables (un `group-title` contenant « VOD », une
 * adresse en `.mp4`). Deviner conduirait à ranger des chaînes dans
 * l'onglet Films, et l'inverse.
 *
 * Tout est donc importé comme chaîne. C'est fidèle au fichier : le M3U
 * ne déclare que des flux, la distinction n'y existe pas.
 */

import type { LiveCategory, LiveChannel, M3UEntry, SourceErrorKind } from '@/types';
import type { CatalogPayload } from '@/store/useAppStore';
import { fetchAndParseM3U, parseM3U, type ParseResult } from './m3uParser';

/** Délai au-delà duquel on cesse d'attendre le serveur. */
const FETCH_TIMEOUT_MS = 60_000;

/**
 * Catalogue rapporté par un import M3U.
 *
 * Comme pour Xtream, on resserre `CatalogPayload` : ses champs sont
 * optionnels, mais un import M3U renvoie toujours ces deux listes,
 * vides le cas échéant. Les appelants n'ont donc pas à tester un
 * `undefined` qui ne survient jamais.
 */
export type M3UCatalog = CatalogPayload &
  Required<Pick<CatalogPayload, 'channels' | 'liveCategories'>>;

export interface M3USyncProgress {
  /** `download` puis `parse` : deux attentes de nature différente. */
  step: 'download' | 'parse' | 'done';
  /** Progression de l'analyse, de 0 à 1. Absente pendant le téléchargement. */
  ratio?: number;
  /** Nombre de chaînes déjà trouvées. */
  entriesFound?: number;
}

export interface M3USyncOptions {
  onProgress?: (progress: M3USyncProgress) => void;
  signal?: AbortSignal;
}

export interface M3USyncResult {
  catalog: M3UCatalog;
  counts: { channels: number };
  /**
   * Anomalies rencontrées : lignes ignorées, en-tête manquant.
   *
   * Un fichier partiellement valide s'importe quand même — refuser
   * 8 000 chaînes correctes pour 3 lignes bancales serait absurde —
   * mais l'utilisateur doit pouvoir le savoir.
   */
  warnings: string[];
  /** Nombre d'entrées écartées parce qu'un doublon existait déjà. */
  duplicatesRemoved: number;
}

/**
 * Erreur d'import M3U portant un code stable.
 *
 * `m3uParser` lève des `Error` ordinaires dont seul le message varie.
 * Un message ne se traduit pas et ne se teste pas de façon fiable :
 * on le convertit en code, comme pour Xtream.
 */
export class M3UError extends Error {
  readonly kind: SourceErrorKind;

  constructor(kind: SourceErrorKind, message: string) {
    super(message);
    this.name = 'M3UError';
    this.kind = kind;
  }
}

export function toM3UErrorKind(err: unknown): SourceErrorKind {
  if (err instanceof M3UError) return err.kind;
  if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
  // `fetch` signale une panne réseau par un `TypeError`, sans détail :
  // le navigateur masque volontairement la cause exacte. Un blocage
  // CORS arrive ici, indistinguable d'un serveur éteint.
  if (err instanceof TypeError) return 'network';
  return 'unknown';
}

/**
 * Vérifie l'adresse avant tout appel réseau.
 *
 * `fetch` accepte une adresse relative et la résout contre la page
 * courante : une saisie erronée interrogerait le site lui-même et
 * renverrait du HTML, signalé plus tard comme « fichier illisible ».
 * Autant refuser tout de suite avec la bonne raison.
 */
export function assertM3UUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new M3UError('invalid_url', 'Adresse vide.');

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new M3UError('invalid_url', `Adresse illisible : ${trimmed}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new M3UError('invalid_url', `Protocole non pris en charge : ${parsed.protocol}`);
  }
  return parsed.toString();
}

/**
 * Déduit le type de flux de son adresse, pour orienter le lecteur.
 *
 * On regarde le chemin seul : une adresse peut porter une chaîne de
 * requête (`?token=...m3u8`) qui fausserait une simple recherche de
 * sous-chaîne.
 */
export function detectStreamType(url: string): LiveChannel['streamType'] {
  const lower = url.toLowerCase();
  if (lower.startsWith('rtmp://') || lower.startsWith('rtmps://')) return 'rtmp';

  let path = lower;
  try {
    path = new URL(lower).pathname;
  } catch {
    // Adresse relative ou protocole exotique : on retombe sur le texte
    // complet, en coupant ce qui suit un « ? ».
    path = lower.split('?')[0];
  }

  if (path.endsWith('.m3u8')) return 'hls';
  if (path.endsWith('.mpd')) return 'dash';
  return 'other';
}

/**
 * Empreinte courte et stable d'un texte (FNV-1a 32 bits).
 *
 * Sert à fabriquer un identifiant de chaîne. La stabilité est le point
 * essentiel : si les identifiants changeaient à chaque import, les
 * favoris et la reprise de lecture pointeraient dans le vide après la
 * moindre actualisation. Numéroter les chaînes dans l'ordre du fichier
 * aurait ce défaut — insérer une chaîne en tête décalerait tout.
 *
 * Ce n'est pas une fonction de hachage cryptographique et elle n'a pas
 * à l'être : on ne protège rien, on nomme.
 */
export function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiplication par 16777619 en arithmétique 32 bits.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Convertit les entrées du fichier en chaînes de l'application.
 *
 * Les doublons sont écartés : beaucoup de playlists répètent la même
 * chaîne dans plusieurs groupes. Sans dédoublonnage, elle apparaîtrait
 * plusieurs fois dans la grille, et deux entrées porteraient le même
 * identifiant — l'une masquerait l'autre au hasard du rendu React.
 */
export function mapEntriesToChannels(
  entries: M3UEntry[],
  playlistId: string
): { channels: LiveChannel[]; duplicatesRemoved: number } {
  const channels: LiveChannel[] = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  entries.forEach((entry, index) => {
    // L'adresse du flux identifie la chaîne mieux que son nom : deux
    // bouquets nomment « TF1 » et « TF1 HD » le même flux, tandis que
    // deux flux distincts ont toujours des adresses distinctes.
    const key = shortHash(entry.streamUrl);
    if (seen.has(key)) {
      duplicatesRemoved++;
      return;
    }
    seen.add(key);

    channels.push({
      id: `${playlistId}:m3u:${key}`,
      name: entry.name,
      streamUrl: entry.streamUrl,
      streamType: detectStreamType(entry.streamUrl),
      logo: entry.tvgLogo,
      groupTitle: entry.groupTitle,
      categoryId: entry.groupTitle
        ? `${playlistId}:m3ucat:${shortHash(entry.groupTitle)}`
        : undefined,
      categoryName: entry.groupTitle,
      tvgId: entry.tvgId,
      tvgName: entry.tvgName,
      // `tvg-id` est l'identifiant que le guide XMLTV utilise pour
      // rattacher ses programmes à une chaîne. Sans lui, pas d'EPG.
      epgChannelId: entry.tvgId,
      country: entry.tvgCountry,
      language: entry.tvgLanguage,
      playlistId,
      // Appartiennent au profil, pas au fichier : recalculés à
      // l'affichage depuis `favorites` et `watchHistory`.
      isFavorite: false,
      isRecent: false,
      sortOrder: index,
    });
  });

  return { channels, duplicatesRemoved };
}

/**
 * Reconstitue les catégories à partir des `group-title`.
 *
 * Un fichier M3U ne comporte pas de liste de catégories : chaque
 * chaîne porte son groupe. On les rassemble donc en préservant l'ordre
 * d'apparition, qui reflète le classement voulu par le fournisseur —
 * un tri alphabétique le détruirait.
 */
export function buildCategories(
  channels: LiveChannel[],
  playlistId: string
): LiveCategory[] {
  const counts = new Map<string, { name: string; count: number }>();

  for (const channel of channels) {
    if (!channel.categoryId || !channel.categoryName) continue;
    const existing = counts.get(channel.categoryId);
    if (existing) {
      existing.count++;
    } else {
      counts.set(channel.categoryId, { name: channel.categoryName, count: 1 });
    }
  }

  return Array.from(counts.entries()).map(([id, { name, count }]) => ({
    id,
    name,
    channelCount: count,
    playlistId,
  }));
}

/** Assemble un `ParseResult` en catalogue prêt pour le store. */
function toResult(parsed: ParseResult, playlistId: string): M3USyncResult {
  const { channels, duplicatesRemoved } = mapEntriesToChannels(parsed.entries, playlistId);

  // Un fichier lisible mais sans une seule chaîne exploitable n'est pas
  // un succès : c'est presque toujours une page d'erreur HTML servie
  // avec un code 200, ou une adresse qui ne pointe pas sur une
  // playlist. Le dire évite d'ajouter une source vide.
  if (channels.length === 0) {
    throw new M3UError(
      'parse',
      parsed.errors[0] ?? "Aucune chaîne n'a été trouvée dans ce fichier."
    );
  }

  return {
    catalog: { channels, liveCategories: buildCategories(channels, playlistId) },
    counts: { channels: channels.length },
    warnings: parsed.errors,
    duplicatesRemoved,
  };
}

/**
 * Combine deux signaux d'annulation en un seul.
 *
 * `AbortSignal.any` ferait cela en une ligne, mais il manque sur la
 * WebView des anciens Fire OS — cible principale du projet. Même
 * fonction de remplacement que dans `xtreamService.ts`.
 */
function combineSignals(signals: (AbortSignal | undefined)[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

/** Importe une playlist M3U depuis une adresse web. */
export async function syncM3UFromUrl(
  url: string,
  playlistId: string,
  options: M3USyncOptions = {}
): Promise<M3USyncResult> {
  const { onProgress, signal } = options;
  const safeUrl = assertM3UUrl(url);

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT_MS);
  const combined = combineSignals([signal, timeoutController.signal]);

  onProgress?.({ step: 'download' });

  try {
    const parsed = await fetchAndParseM3U(safeUrl, {
      signal: combined,
      onProgress: (ratio, entriesFound) =>
        onProgress?.({ step: 'parse', ratio, entriesFound }),
    });
    onProgress?.({ step: 'done', ratio: 1, entriesFound: parsed.entries.length });
    return toResult(parsed, playlistId);
  } catch (err) {
    // Le délai dépassé et l'annulation par l'utilisateur produisent tous
    // deux un `AbortError` : seul le drapeau du minuteur les sépare.
    // Les confondre afficherait « opération annulée » alors que
    // personne n'a rien annulé.
    if (timeoutController.signal.aborted && !signal?.aborted) {
      throw new M3UError('timeout', 'Le serveur met trop de temps à répondre.');
    }
    if (err instanceof M3UError) throw err;

    const kind = toM3UErrorKind(err);
    if (kind === 'unknown' && err instanceof Error && /^Le serveur a répondu/.test(err.message)) {
      throw new M3UError('http', err.message);
    }
    throw new M3UError(kind, err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Importe une playlist M3U depuis un fichier choisi sur l'appareil.
 *
 * Aucun réseau n'intervient : pas de CORS, pas de délai d'attente.
 * C'est la seule voie qui fonctionne à coup sûr depuis un navigateur.
 */
export async function syncM3UFromText(
  content: string,
  playlistId: string,
  options: M3USyncOptions = {}
): Promise<M3USyncResult> {
  const { onProgress, signal } = options;

  const parsed = await parseM3U(content, {
    signal,
    onProgress: (ratio, entriesFound) =>
      onProgress?.({ step: 'parse', ratio, entriesFound }),
  });

  onProgress?.({ step: 'done', ratio: 1, entriesFound: parsed.entries.length });
  return toResult(parsed, playlistId);
}
