/**
 * Pont entre le guide XMLTV brut et les types de l'application.
 *
 * Même séparation que pour Xtream et M3U :
 *   - `epgService`  parle le format du fichier (dates `Date`, pas d'identifiant) ;
 *   - `epgSync`     traduit vers `EPGProgram`, le type que le store et les
 *                   écrans savent lire (dates en texte ISO, identifiant stable).
 *
 * Ce fichier ne connaît ni React ni le store : il prend des chaînes et
 * une source, il rend des programmes. C'est ce qui le rend testable.
 */

import {
  parseXMLTV,
  endOfDayAhead,
  matchChannelsWithEPG,
  normalizeChannelName,
  type EPGParseResult,
  type ParsedEPGChannel,
  type ParsedEPGProgram,
} from './epgService';
import { shortHash } from '../m3u/m3uSync';
import type { EPGProgram, LiveChannel, SourceErrorKind } from '@/types';
import { xtreamService, type XtreamCredentials } from '../xtream/xtreamService';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Les guides XMLTV ne sont plus refusés sur un plafond arbitraire.
 *
 * Les sources Xtream avec une sélection de catégories passent par
 * `get_short_epg` dans `runPlaylistEpg`, donc seules les chaînes
 * importées sont interrogées. Les autres guides restent acceptés quelle
 * que soit leur taille déclarée par le serveur ; le parseur ne conserve
 * ensuite que les programmes des chaînes présentes dans le catalogue.
 */

/**
 * On jette les programmes terminés depuis plus de 6 heures.
 *
 * Un XMLTV contient souvent une semaine de passé, sans aucun usage :
 * la grille commence à « hier ». Six heures suffisent à couvrir
 * l'émission en cours quand elle est longue.
 */
const DROP_OLDER_THAN_HOURS = 6;

export type EPGSyncStep = 'download' | 'parse' | 'match' | 'done';

export interface EPGSyncProgress {
  step: EPGSyncStep;
  /** Progression de 0 à 1, approximative. */
  ratio: number;
  /** Nombre de chaînes courtes déjà interrogées, si disponible. */
  done?: number;
  /** Nombre total de chaînes à interroger, si disponible. */
  total?: number;
  /** Compteurs finaux transmis au toast. */
  programs?: number;
  channels?: number;
}

export interface EPGSyncOptions {
  onProgress?: (progress: EPGSyncProgress) => void;
  signal?: AbortSignal;
  /**
   * Nombre de jours de guide à conserver, réglage « Jours de guide TV ».
   *
   * Le guide vit en mémoire seule (jamais écrit sur le disque) : ce
   * plafond est la seule protection contre un portail qui renvoie
   * quatorze jours pour cinq cents chaînes. Omis, le comportement
   * historique est conservé (tout est gardé).
   */
  keepAheadDays?: number;
}

export interface EPGSyncResult {
  /** Origine réellement utilisée : XMLTV complet ou guide court Xtream. */
  source?: 'xmltv' | 'xtream_short' | 'merged';
  programs: EPGProgram[];
  /** Nombre de chaînes de la source appariées à une chaîne du guide. */
  matchedChannels: number;
  /** Nombre de chaînes restées sans guide. */
  unmatchedChannels: number;
  /** Anomalies non bloquantes relevées pendant l'analyse. */
  warnings: string[];
  /**
   * Logo XMLTV de la chaîne, pour celles qui n'en ont pas déjà un
   * côté Xtream / M3U. Clé = id de la chaîne source.
   */
  logoFallbacks: Record<string, string>;
}

/**
 * Adresse du guide d'un portail Xtream.
 *
 * Le point d'entrée est `/xmltv.php`, distinct de `player_api.php`.
 * `encodeURIComponent` est indispensable : un mot de passe contenant
 * `&` ou `=` casserait la requête sans lui.
 */
export function buildXtreamEPGUrl(creds: XtreamCredentials): string {
  const base = creds.serverUrl.replace(/\/+$/, '');
  const user = encodeURIComponent(creds.username);
  const pass = encodeURIComponent(creds.password);
  return `${base}/xmltv.php?username=${user}&password=${pass}`;
}

/**
 * Convertit une erreur quelconque en code stable.
 *
 * On renvoie un **code** et non une phrase : la langue de l'interface
 * peut changer après l'échec. L'écran traduit au moment de l'affichage.
 */
export function toEPGErrorKind(err: unknown): SourceErrorKind {
  if (err instanceof EPGSyncError) return err.kind;
  if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('annul')) return 'aborted';
    if (msg.includes('délai') || msg.includes('delai') || msg.includes('timeout')) {
      return 'timeout';
    }
    if (msg.includes('401') || msg.includes('403')) return 'auth';
    if (msg.includes('erreur (')) return 'http';
    if (msg.includes('télécharger') || msg.includes('telecharger')) return 'network';
    if (msg.includes('analys') || msg.includes('xml') || msg.includes('domparser')) {
      return 'parse';
    }
  }
  return 'unknown';
}

/**
 * Erreur portant déjà son code, pour les cas que nous détectons
 * nous-mêmes (guide trop volumineux, aucune chaîne à apparier).
 *
 * Sans elle, `toEPGErrorKind` devrait deviner le code en cherchant des
 * mots dans un message français — fragile, et cassé dès qu'on traduit.
 */
export class EPGSyncError extends Error {
  readonly kind: SourceErrorKind;

  constructor(kind: SourceErrorKind, message: string) {
    super(message);
    this.name = 'EPGSyncError';
    this.kind = kind;
  }
}

/**
 * Identifiant stable d'un programme.
 *
 * Deux contraintes : il doit survivre à une resynchronisation (sinon
 * les favoris et rappels pointeraient dans le vide), et rester unique
 * quand deux chaînes diffusent la même émission à la même heure. D'où
 * la combinaison chaîne + début + titre, condensée pour rester courte.
 */
function programId(playlistId: string, channelId: string, start: Date, title: string): string {
  return `${playlistId}:epg:${shortHash(`${channelId}|${start.getTime()}|${title}`)}`;
}

const EPG_FALLBACK_TITLE = 'Programme TV';

const XML_ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&#x27;': "'",
};

function decodeKnownXmlEntities(value: string): string {
  let decoded = value;
  // Certains portails renvoient par exemple `&amp;lt;` : deux passes
  // suffisent pour ce double échappement sans interpréter du HTML libre.
  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(
      /&(?:lt|gt|amp|quot|apos|#39|#x27);/gi,
      (entity) => XML_ENTITIES[entity.toLowerCase()] ?? entity,
    );
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function isReadableEpgText(value: string): boolean {
  if (!value.trim()) return false;
  const characters = [...value];
  const controls = characters.filter((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && !'\n\r\t'.includes(character);
  }).length;
  return controls === 0 && /[\p{L}\p{N}]/u.test(value);
}

function tryDecodeBase64Text(value: string): string | undefined {
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 8 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)) return undefined;

  const normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
    return isReadableEpgText(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Nettoie les titres EPG fournis par certains portails.
 *
 * Les réponses Xtream peuvent contenir du Base64, des entités XML
 * (`&lt;`) ou un fragment de balise à la place du titre. On ne décode
 * que les chaînes qui donnent un texte réellement lisible ; un titre
 * normal reste donc inchangé.
 */
export function normalizeEpgText(value: string | undefined, fallback?: string): string | undefined {
  if (!value?.trim()) return fallback;

  let text = decodeKnownXmlEntities(value.trim());
  const decodedBase64 = tryDecodeBase64Text(text);
  if (decodedBase64) text = decodeKnownXmlEntities(decodedBase64);

  text = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  // Cas observé sur certains guides : `&lt;jfis6` devient `<jfis6`,
  // une pseudo-balise incomplète qui ne doit pas être affichée.
  if (/^<[A-Za-z][\w:-]*$/.test(text)) return fallback;
  return isReadableEpgText(text) ? text : fallback;
}

/**
 * Télécharge le XMLTV en refusant les fichiers démesurés.
 *
 * `fetchAndParseXMLTV` du service ne contrôle pas la taille : sur un
 * guide de 300 Mo, l'onglet gonflerait jusqu'au plantage avant même
 * l'analyse. On fait donc le téléchargement ici pour pouvoir arrêter.
 *
 * Deux garde-fous, car l'un ne suffit pas : `Content-Length` est
 * déclaratif et souvent absent, alors on compte aussi les octets reçus
 * au fil de l'eau et on coupe dès le dépassement.
 */
const XMLTV_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function nativeXmltvGet(url: string) {
  const request = {
    url,
    headers: { Accept: 'application/xml,text/xml,*/*' },
    connectTimeout: 120_000,
    readTimeout: 120_000,
  };
  let response = await CapacitorHttp.get(request);
  if (XMLTV_REDIRECT_STATUSES.has(response.status) && /^http:\/\//i.test(url)) {
    try {
      const secureUrl = new URL(url);
      secureUrl.protocol = 'https:';
      response = await CapacitorHttp.get({ ...request, url: secureUrl.toString() });
    } catch {
      // Conserver le statut initial si le serveur HTTPS n'est pas disponible.
    }
  }
  return response;
}

async function downloadXMLTV(url: string, signal?: AbortSignal): Promise<string> {
  const timeout = AbortSignal.timeout(120_000);
  const combined =
    signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([timeout, signal])
      : timeout;

  if (Capacitor.getPlatform() === 'android') {
    try {
      const nativeResponse = await nativeXmltvGet(url);
      if (signal?.aborted) {
        throw new EPGSyncError('aborted', 'Téléchargement du guide annulé.');
      }
      if (nativeResponse.status < 200 || nativeResponse.status >= 300) {
        const kind: SourceErrorKind =
          nativeResponse.status === 401 || nativeResponse.status === 403 ? 'auth' : 'http';
        throw new EPGSyncError(
          kind,
          `Le serveur du guide a répondu par une erreur (${nativeResponse.status}).`,
        );
      }
      if (typeof nativeResponse.data === 'string') return nativeResponse.data;
      return JSON.stringify(nativeResponse.data) ?? '';
    } catch (error) {
      if (error instanceof EPGSyncError) throw error;
      if (signal?.aborted) {
        throw new EPGSyncError('aborted', 'Téléchargement du guide annulé.');
      }
      throw new EPGSyncError(
        'network',
        "Impossible de télécharger le guide des programmes. Vérifiez votre connexion.",
      );
    }
  }

  let resp: Response;
  try {
    resp = await fetch(url, { signal: combined });
  } catch (err) {
    if (signal?.aborted) {
      throw new EPGSyncError('aborted', 'Téléchargement du guide annulé.');
    }
    if (timeout.aborted) {
      throw new EPGSyncError('timeout', 'Le guide met trop de temps à arriver.');
    }
    throw new EPGSyncError(
      'network',
      "Impossible de télécharger le guide des programmes. Vérifiez votre connexion."
    );
  }

  if (!resp.ok) {
    const kind: SourceErrorKind =
      resp.status === 401 || resp.status === 403 ? 'auth' : 'http';
    throw new EPGSyncError(
      kind,
      `Le serveur du guide a répondu par une erreur (${resp.status}).`
    );
  }

  // Le Content-Length peut annoncer un guide très volumineux. Il ne
  // constitue plus un motif de refus : certains serveurs annoncent la
  // taille compressée, d'autres la taille complète, et une sélection
  // Xtream peut éviter ce téléchargement par la voie courte.
  //
  // Sans flux lisible (vieille WebView, ou réponse mise en cache), on se
  // rabat sur la lecture directe. Le serveur reste libre de renvoyer un
  // guide de toute taille supportée par l'appareil.
  if (!resp.body) {
    const raw = new Uint8Array(await resp.arrayBuffer());
    return decodeXmltvBytes(raw);
  }

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    chunks.push(value);
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return decodeXmltvBytes(merged);
}

/** Gzip (magic `1f 8b`) même sans en-tête `Content-Encoding` — cas iptv-org et beaucoup de xmltv.php. */
export function isGzipBuffer(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export async function decodeXmltvBytes(bytes: Uint8Array): Promise<string> {
  if (!isGzipBuffer(bytes)) {
    return new TextDecoder('utf-8').decode(bytes);
  }

  if (typeof DecompressionStream !== 'function') {
    throw new EPGSyncError(
      'parse',
      'Le guide est compressé (gzip) et cet appareil ne peut pas le lire.',
    );
  }

  try {
    // Copie dans un `ArrayBuffer` neuf : `Uint8Array` vu depuis un
    // `SharedArrayBuffer` n'est pas un `BlobPart` pour TypeScript 5.9.
    const gzipCopy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(gzipCopy).set(bytes);
    const stream = new Blob([gzipCopy]).stream().pipeThrough(new DecompressionStream('gzip'));
    const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
    return new TextDecoder('utf-8').decode(inflated);
  } catch (err) {
    if (err instanceof EPGSyncError) throw err;
    throw new EPGSyncError('parse', 'Le fichier du guide compressé est illisible.');
  }
}

/**
 * Traduit les programmes analysés vers le type de l'application.
 *
 * `mapping` associe l'identifiant d'une chaîne de la source à
 * l'identifiant de la chaîne correspondante dans le guide. On le
 * parcourt à l'envers : à un identifiant de guide, une ou plusieurs
 * chaînes de la source. Le même programme peut donc être dupliqué pour
 * deux chaînes qui pointent le même guide — c'est voulu, chaque écran
 * filtre sur `channelId`.
 */
export function mapEPGPrograms(
  parsed: ParsedEPGProgram[],
  mapping: Map<string, string>,
  playlistId: string
): EPGProgram[] {
  // Index inverse : identifiant du guide -> identifiants de la source.
  const byEpgId = new Map<string, string[]>();
  for (const [channelId, epgId] of mapping) {
    const list = byEpgId.get(epgId);
    if (list) list.push(channelId);
    else byEpgId.set(epgId, [channelId]);
  }

  const out: EPGProgram[] = [];

  for (const p of parsed) {
    const targets = byEpgId.get(p.channelId);
    // Programme d'une chaîne absente de la source : inutile de le garder.
    if (!targets) continue;

    for (const channelId of targets) {
      out.push({
        id: programId(playlistId, channelId, p.start, p.title),
        channelId,
        title: p.title,
        start: p.start.toISOString(),
        stop: p.stop.toISOString(),
        description: p.description,
        category: p.category,
        rating: p.rating,
        icon: p.icon,
        episodeNum: p.episodeNum,
      });
    }
  }

  return out;
}

/** Logos XMLTV indexés par id de chaîne source. */
export function logoFallbacksFromEpg(
  mapping: Map<string, string>,
  epgChannels: ParsedEPGChannel[]
): Record<string, string> {
  const byId = new Map<string, string>();
  for (const channel of epgChannels) {
    if (channel.icon) byId.set(channel.id, channel.icon);
  }
  const out: Record<string, string> = {};
  for (const [channelId, epgId] of mapping) {
    const icon = byId.get(epgId);
    if (icon) out[channelId] = icon;
  }
  return out;
}

/**
 * Ne remplit le logo que s'il manque : un `stream_icon` Xtream
 * l'emporte toujours sur l'icône du guide.
 */
export function applyLogoFallbacks(
  channels: LiveChannel[],
  fallbacks: Record<string, string>
): LiveChannel[] {
  let changed = false;
  const next = channels.map((channel) => {
    if (channel.logo) return channel;
    const icon = fallbacks[channel.id];
    if (!icon) return channel;
    changed = true;
    return { ...channel, logo: icon };
  });
  return changed ? next : channels;
}

/**
 * Visuel d'une carte Live B : affiche émission, sinon logo chaîne.
 * Jamais `undefined` si l'un des deux existe — sinon la carte est noire.
 */
export function broadcastArtworkUrl(channel: LiveChannel): string | undefined {
  return channel.currentProgram?.icon || channel.logo || undefined;
}

/**
 * Récupère le guide d'une source et le traduit pour le store.
 *
 * `channels` doit contenir les chaînes **déjà synchronisées** de cette
 * source : l'appariement se fait contre elles. Passer un tableau vide
 * ne lèverait pas d'erreur mais renverrait zéro programme, ce qui
 * serait incompréhensible côté écran — d'où le garde-fou.
 */
export async function syncEPG(
  url: string,
  channels: LiveChannel[],
  playlistId: string,
  options: EPGSyncOptions = {}
): Promise<EPGSyncResult> {
  const { onProgress, signal, keepAheadDays } = options;
  const report = (
    step: EPGSyncStep,
    ratio: number,
    details: Pick<EPGSyncProgress, 'done' | 'total' | 'programs' | 'channels'> = {},
  ) => onProgress?.({ step, ratio, ...details });

  if (channels.length === 0) {
    throw new EPGSyncError(
      'bad_response',
      "Aucune chaîne à associer : synchronisez d'abord le catalogue de la source."
    );
  }

  report('download', 0);
  const xml = await downloadXMLTV(url, signal);

  const wantedChannelIds = new Set(
    channels.flatMap((channel) =>
      [
        channel.epgChannelId,
        channel.tvgId,
        typeof channel.streamId === 'number' && channel.streamId > 0
          ? String(channel.streamId)
          : undefined,
      ].filter((id): id is string => Boolean(id)),
    ),
  );
  const wantedChannelNames = new Set(
    channels.map((channel) => normalizeChannelName(channel.name)).filter(Boolean),
  );

  const parsed: EPGParseResult = await parseXMLTV(xml, {
    signal,
    dropOlderThanHours: DROP_OLDER_THAN_HOURS,
    keepAheadDays,
    wantedChannelIds: wantedChannelIds.size > 0 ? wantedChannelIds : undefined,
    wantedChannelNames,

    // L'analyse couvre la tranche 0,1 → 0,8 de la progression globale :
    // le téléchargement occupe le début, l'appariement la fin.
    onProgress: (ratio) => report('parse', 0.1 + ratio * 0.7),
  });

  report('match', 0.85);

  const resolveGuideMediaUrl = (raw?: string): string | undefined => {
    if (!raw) return undefined;
    try {
      return new URL(raw, url).toString();
    } catch {
      return raw;
    }
  };
  const resolvedParsed: EPGParseResult = {
    ...parsed,
    channels: parsed.channels.map((channel) => ({
      ...channel,
      icon: resolveGuideMediaUrl(channel.icon),
    })),
    programs: parsed.programs.map((program) => ({
      ...program,
      title: normalizeEpgText(program.title, EPG_FALLBACK_TITLE) ?? EPG_FALLBACK_TITLE,
      description: normalizeEpgText(program.description),
      category: normalizeEpgText(program.category),
      icon: resolveGuideMediaUrl(program.icon),
    })),
  };

  const mapping = matchChannelsWithEPG(
    channels.map((c) => ({
      id: c.id,
      name: c.name,
      // Un portail Xtream renseigne `epgChannelId` ; un M3U renseigne
      // `tvgId`. On accepte les deux, le premier disponible gagne.
      tvgId: c.epgChannelId || c.tvgId,
      streamId: c.streamId,
    })),
    resolvedParsed.channels
  );

  const programs = mapEPGPrograms(resolvedParsed.programs, mapping, playlistId);

  report('done', 1, {
    programs: programs.length,
    channels: mapping.size,
  });

  const fromPrograms: Record<string, string> = {};
  for (const program of programs) {
    if (program.icon && !fromPrograms[program.channelId]) {
      fromPrograms[program.channelId] = program.icon;
    }
  }

  return {
    source: 'xmltv',
    programs,
    matchedChannels: mapping.size,
    unmatchedChannels: channels.length - mapping.size,
    warnings: parsed.errors,
    logoFallbacks: {
      ...fromPrograms,
      ...logoFallbacksFromEpg(mapping, resolvedParsed.channels),
    },
  };
}

/** Date Xtream : accepte ISO, secondes Unix et millisecondes Unix. */
function parseXtreamEpgDate(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 10_000_000_000 ? value : value * 1000);
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000);
    }
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function resolveXtreamMediaUrl(raw: string | undefined, creds: XtreamCredentials): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw, `${creds.serverUrl}/`).toString();
  } catch {
    return raw;
  }
}

function shortEpgListings(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
  }
  if (!raw || typeof raw !== 'object') return [];
  const record = raw as Record<string, unknown>;
  for (const key of ['epg_listings', 'listings', 'programs', 'epg']) {
    if (Array.isArray(record[key])) {
      return record[key].filter(
        (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
      );
    }
  }
  return [];
}

/**
 * Guide court Xtream utilisé lorsque `xmltv.php` est absent, trop lourd
 * ou refusé par le fournisseur. Chaque chaîne est interrogée séparément
 * afin de conserver un guide utile même si quelques flux échouent.
 */
export async function syncXtreamShortEPG(
  creds: XtreamCredentials,
  channels: readonly LiveChannel[],
  playlistId: string,
  options: Pick<EPGSyncOptions, 'signal' | 'keepAheadDays' | 'onProgress'> = {},
): Promise<EPGSyncResult> {
  const now = Date.now();
  let completed = 0;
  options.onProgress?.({ step: 'download', ratio: 0, done: 0, total: channels.length });
  const end = options.keepAheadDays && options.keepAheadDays > 0
    ? endOfDayAhead(options.keepAheadDays).getTime()
    : Infinity;
  const programs: EPGProgram[] = [];
  const matched = new Set<string>();
  const errors: string[] = [];
  let cursor = 0;
  const width = Math.min(4, Math.max(1, channels.length));

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      const channel = channels[index];
      if (!channel) return;
      if (typeof channel.streamId !== 'number' || channel.streamId <= 0) {
        completed += 1;
        options.onProgress?.({
          step: 'download',
          ratio: completed / channels.length,
          done: completed,
          total: channels.length,
        });
        continue;
      }

      try {
        const raw = await xtreamService.getShortEpg(creds, channel.streamId, 12, {
          signal: options.signal,
        });
        for (const listing of shortEpgListings(raw)) {
          const start = parseXtreamEpgDate(
            listing.start_timestamp ?? listing.start ?? listing.start_time,
          );
          const stop = parseXtreamEpgDate(
            listing.stop_timestamp ?? listing.end ?? listing.stop ?? listing.end_time,
          );
          if (!start || !stop || stop.getTime() <= start.getTime()) continue;
          if (stop.getTime() < now - DROP_OLDER_THAN_HOURS * 60 * 60 * 1000) continue;
          if (start.getTime() > end) continue;

          const title = normalizeEpgText(
            stringField(listing, ['title', 'name', 'program_name']),
            EPG_FALLBACK_TITLE,
          );
          if (!title) continue;
          const description = normalizeEpgText(
            stringField(listing, ['description', 'desc', 'plot']),
          );
          const category = normalizeEpgText(
            stringField(listing, ['category', 'genre']),
          );
          const icon = resolveXtreamMediaUrl(
            stringField(listing, ['icon', 'image', 'poster']),
            creds,
          );
          const id = `${playlistId}:epg:short:${shortHash(`${channel.id}|${start.toISOString()}|${title}`)}`;
          programs.push({
            id,
            channelId: channel.id,
            title,
            start: start.toISOString(),
            stop: stop.toISOString(),
            ...(description ? { description } : {}),
            ...(category ? { category } : {}),
            ...(icon ? { icon } : {}),
          });
          matched.add(channel.id);
        }
      } catch (error) {
        if (options.signal?.aborted) throw error;
        errors.push(error instanceof Error ? error.message : 'short EPG request failed');
      }
      completed += 1;
      options.onProgress?.({
        step: 'download',
        ratio: Math.min(1, completed / channels.length),
        done: completed,
        total: channels.length,
      });
    }
  };

  await Promise.all(Array.from({ length: width }, () => worker()));
  programs.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  options.onProgress?.({
    step: 'done',
    ratio: 1,
    done: channels.length,
    total: channels.length,
    programs: programs.length,
    channels: matched.size,
  });

  return {
    source: 'xtream_short',
    programs,
    matchedChannels: matched.size,
    unmatchedChannels: channels.length - matched.size,
    warnings: errors.slice(0, 50),
    logoFallbacks: {},
  };
}

/**
 * Fusionne le guide court Xtream et le XMLTV sans écraser les chaînes
 * déjà alimentées par le premier. Certains portails répondent avec un
 * guide court pour une partie du catalogue seulement.
 */
export function mergeEPGResults(
  primary: EPGSyncResult,
  supplement: EPGSyncResult,
  totalChannels: number,
): EPGSyncResult {
  const programs = new Map<string, EPGProgram>();
  const channelKeys = new Set<string>();

  for (const program of [...primary.programs, ...supplement.programs]) {
    const key = `${program.channelId}|${program.start}|${program.title}`;
    if (!programs.has(key)) programs.set(key, program);
    channelKeys.add(program.channelId);
  }

  return {
    source: 'merged',
    programs: [...programs.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    matchedChannels: channelKeys.size,
    unmatchedChannels: Math.max(0, totalChannels - channelKeys.size),
    warnings: [...new Set([...primary.warnings, ...supplement.warnings])].slice(0, 50),
    logoFallbacks: { ...supplement.logoFallbacks, ...primary.logoFallbacks },
  };
}

/**
 * Programme en cours et programme suivant, au format de l'application.
 *
 * Version `EPGProgram` de `getCurrentAndNext`, pour les écrans qui
 * lisent le store et n'ont jamais vu les types du parseur.
 */
/**
 * Programme en cours par chaîne — un passage, pas un find par chaîne.
 *
 * Appelé par TV en direct et l'accueil : un `find` par chaîne sur un
 * guide de 20 000 programmes figeait l'interface.
 */
export function indexNowPlaying(
  programs: readonly EPGProgram[],
  nowMs: number = Date.now()
): Map<string, EPGProgram> {
  const map = new Map<string, EPGProgram>();
  for (const program of programs) {
    const start = Date.parse(program.start);
    const stop = Date.parse(program.stop);
    if (Number.isNaN(start) || Number.isNaN(stop)) continue;
    if (start <= nowMs && nowMs < stop && !map.has(program.channelId)) {
      map.set(program.channelId, program);
    }
  }
  return map;
}

/** Prochain programme de chaque chaîne (le plus tôt après `now`). */
export function indexUpcoming(
  programs: readonly EPGProgram[],
  nowMs: number = Date.now()
): Map<string, EPGProgram> {
  const map = new Map<string, EPGProgram>();
  const starts = new Map<string, number>();
  for (const program of programs) {
    const start = Date.parse(program.start);
    if (Number.isNaN(start) || start <= nowMs) continue;
    const prev = starts.get(program.channelId);
    if (prev !== undefined && start >= prev) continue;
    starts.set(program.channelId, start);
    map.set(program.channelId, program);
  }
  return map;
}

export function findCurrentAndNext(
  programs: EPGProgram[],
  channelId: string,
  now: Date = new Date()
): { current: EPGProgram | null; next: EPGProgram | null } {
  const nowMs = now.getTime();
  let current: EPGProgram | null = null;
  let next: EPGProgram | null = null;
  let nextStart = Infinity;

  for (const p of programs) {
    if (p.channelId !== channelId) continue;

    const start = Date.parse(p.start);
    const stop = Date.parse(p.stop);
    if (Number.isNaN(start) || Number.isNaN(stop)) continue;

    if (start <= nowMs && nowMs < stop) {
      current = p;
    } else if (start > nowMs && start < nextStart) {
      next = p;
      nextStart = start;
    }
  }

  return { current, next };
}

/**
 * Pourcentage écoulé d'un programme, borné entre 0 et 100.
 *
 * Renvoie `undefined` plutôt que 0 quand les dates sont inexploitables :
 * une barre à zéro laisserait croire que l'émission vient de commencer.
 */
export function programProgressPercent(
  program: EPGProgram,
  now: Date = new Date()
): number | undefined {
  const start = Date.parse(program.start);
  const stop = Date.parse(program.stop);
  if (Number.isNaN(start) || Number.isNaN(stop) || stop <= start) return undefined;

  const ratio = (now.getTime() - start) / (stop - start);
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}

/**
 * Pose en-cours, suivant et barre de progression sur chaque chaîne.
 *
 * Un seul passage sur le guide (via les index), pas un find par chaîne.
 */
export function enrichLiveChannels(
  channels: readonly LiveChannel[],
  programs: readonly EPGProgram[],
  nowMs: number
): LiveChannel[] {
  if (programs.length === 0) return channels as LiveChannel[];
  const nowPlaying = indexNowPlaying(programs, nowMs);
  const upcoming = indexUpcoming(programs, nowMs);
  const now = new Date(nowMs);
  return channels.map((channel) => {
    const current = nowPlaying.get(channel.id);
    const next = upcoming.get(channel.id);
    if (!current && !next) return channel;
    return {
      ...channel,
      currentProgram: current
        ? { ...current, progressPercent: programProgressPercent(current, now) }
        : undefined,
      nextProgram: next,
    };
  });
}
