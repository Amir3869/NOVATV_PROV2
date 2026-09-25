import { secureStore } from '@/lib/secureStore';
import { useAppStore } from '@/store/useAppStore';
import { xtreamService } from '@/services/xtream/xtreamService';
import type { LiveChannel, Playlist } from '@/types';

const IMAGE_PROBE_CONCURRENCY = 10;
const EPG_PROBE_CONCURRENCY = 4;
const IMAGE_TIMEOUT_MS = 8_000;

export type DiagnosticImageStatus = 'ok' | 'error' | 'timeout' | 'not-tested';
export type DiagnosticEpgProbeStatus = 'ok' | 'error' | 'missing-stream-id' | 'unsupported';
export type DiagnosticCategoryFamily = 'live' | 'movie' | 'series';

export interface SourceDiagnosticImage {
  kind: 'channel-logo' | 'movie-poster' | 'series-poster';
  catalogId: string;
  title: string;
  category?: string;
  url: string;
  status: DiagnosticImageStatus;
  probeMode: 'browser-image';
  elapsedMs?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  error?: string;
}

export interface SourceDiagnosticEpgProbe {
  channelId: string;
  channel: string;
  category?: string;
  streamId?: number;
  epgChannelId?: string;
  tvgId?: string;
  storedProgramCount: number;
  requestStatus: DiagnosticEpgProbeStatus;
  responseType: string;
  responseKeys: string[];
  listingCount: number;
  listingKeys: string[];
  error?: string;
}

export interface SourceDiagnosticCategory {
  family: DiagnosticCategoryFamily;
  id: string;
  name: string;
  originalName?: string;
  parentId?: string;
  parent?: string;
  childIds: string[];
  childCount: number;
  level?: number;
  path?: string[];
  relation?: 'native' | 'inferred' | 'flat';
  regionCode?: string;
  qualities: string[];
  contentCount: number;
  duplicateNameKey: string;
  sameNameAsParent: boolean;
}

export interface SourceDiagnosticCategorySummary {
  family: DiagnosticCategoryFamily;
  total: number;
  roots: number;
  categoriesWithChildren: number;
  categoriesWithContent: number;
  duplicateNameGroups: Array<{
    normalizedName: string;
    categoryIds: string[];
    names: string[];
  }>;
  sameNameParentChildren: Array<{
    parentId: string;
    childId: string;
    name: string;
  }>;
}

export interface SourceDiagnosticReport {
  format: 'nova-tv-source-diagnostic';
  version: 2;
  generatedAt: string;
  warning: string;
  source: {
    name: string;
    type: Playlist['type'];
    server?: string;
    playlistUrl?: string;
    selectedCategories?: {
      live: string[];
      vod: string[];
      series: string[];
    };
  };
  catalog: {
    channels: number;
    movies: number;
    series: number;
    liveCategories: number;
    movieCategories: number;
    seriesCategories: number;
    categoriesWithChildren: number;
  };
  epg: {
    method: 'xtream-short-epg' | 'stored-catalog-only';
    programsStored: number;
    channelsWithPrograms: number;
    channelsWithoutPrograms: number;
    matchedChannelIds: string[];
    missingChannels: Array<{
      channelId: string;
      name: string;
      category?: string;
      streamId?: number;
      epgChannelId?: string;
      tvgId?: string;
    }>;
    probeStatusCounts: Record<DiagnosticEpgProbeStatus, number>;
    probes: SourceDiagnosticEpgProbe[];
  };
  categories: SourceDiagnosticCategory[];
  categorySummaries: SourceDiagnosticCategorySummary[];
  categoryAnomalies: Array<{
    type: 'same-name-parent-child' | 'duplicate-name';
    family: DiagnosticCategoryFamily;
    name: string;
    categoryIds: string[];
    parentId?: string;
  }>;
  imageSummary: Array<{
    kind: SourceDiagnosticImage['kind'];
    total: number;
    withUrl: number;
    ok: number;
    error: number;
    timeout: number;
    notTested: number;
  }>;
  images: SourceDiagnosticImage[];
}

function safeUrl(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const url = new URL(raw.trim());
    const queryKeys = [...url.searchParams.keys()]
      .filter((key) => !/user(name)?|pass(word)?|token|auth|key|sig/i.test(key));
    const query = queryKeys.length > 0 ? `?${queryKeys.join('&')}` : '';
    return `${url.protocol}//${url.host}${url.pathname}${query}`;
  } catch {
    return raw
      .replace(/(username|user|password|pass|token|auth|key|signature)=([^&\s]+)/gi, '$1=[redacted]')
      .slice(0, 500);
  }
}

function sourceServer(playlist: Playlist): string | undefined {
  const raw = playlist.xtream?.serverUrl ?? playlist.m3u?.url;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

function responseListings(raw: unknown): { keys: string[]; listings: Record<string, unknown>[] } {
  if (Array.isArray(raw)) {
    return {
      keys: [],
      listings: raw.filter(
        (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
      ),
    };
  }
  if (!raw || typeof raw !== 'object') return { keys: [], listings: [] };
  const record = raw as Record<string, unknown>;
  for (const key of ['epg_listings', 'listings', 'programs', 'epg']) {
    if (Array.isArray(record[key])) {
      return {
        keys: Object.keys(record),
        listings: record[key].filter(
          (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
        ),
      };
    }
  }
  return { keys: Object.keys(record), listings: [] };
}

function normalizeCategoryName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) }, worker),
  );
  return results;
}

interface ImageProbeResult {
  status: DiagnosticImageStatus;
  elapsedMs: number;
  naturalWidth?: number;
  naturalHeight?: number;
  error?: string;
}

function probeImage(url: string): Promise<ImageProbeResult> {
  if (typeof Image === 'undefined') return Promise.resolve({ status: 'not-tested', elapsedMs: 0 });

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const image = new Image();
    let finished = false;
    const finish = (
      status: DiagnosticImageStatus,
      extra: Pick<ImageProbeResult, 'naturalWidth' | 'naturalHeight' | 'error'> = {},
    ) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve({ status, elapsedMs: Date.now() - startedAt, ...extra });
    };
    const timer = window.setTimeout(() => finish('timeout', { error: `timeout_${IMAGE_TIMEOUT_MS}ms` }), IMAGE_TIMEOUT_MS);
    image.onload = () => finish('ok', { naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
    image.onerror = () => finish('error', { error: 'image_load_error' });
    image.referrerPolicy = 'no-referrer';
    image.src = url;
  });
}

async function probeImages(
  candidates: Array<{
    kind: SourceDiagnosticImage['kind'];
    catalogId: string;
    title: string;
    category?: string;
    raw?: string;
  }>,
): Promise<SourceDiagnosticImage[]> {
  const cache = new Map<string, Promise<Awaited<ReturnType<typeof probeImage>>>>();
  const results = await mapWithConcurrency(candidates, IMAGE_PROBE_CONCURRENCY, async (item) => {
    if (!item.raw?.trim()) {
      return {
        kind: item.kind,
        catalogId: item.catalogId,
        title: item.title,
        category: item.category,
        url: '[missing-url]',
        status: 'error' as const,
        probeMode: 'browser-image' as const,
        elapsedMs: 0,
        error: 'missing_image_url',
      };
    }

    let probe = cache.get(item.raw);
    if (!probe) {
      probe = probeImage(item.raw);
      cache.set(item.raw, probe);
    }
    const result = await probe;
    return {
      kind: item.kind,
      catalogId: item.catalogId,
      title: item.title,
      category: item.category,
      url: safeUrl(item.raw) ?? '[invalid-url]',
      status: result.status,
      probeMode: 'browser-image' as const,
      elapsedMs: result.elapsedMs,
      ...(result.naturalWidth ? { naturalWidth: result.naturalWidth } : {}),
      ...(result.naturalHeight ? { naturalHeight: result.naturalHeight } : {}),
      ...(result.error ? { error: result.error } : {}),
    };
  });
  return results;
}

async function probeShortEpg(
  playlist: Playlist,
  channels: LiveChannel[],
  storedProgramCounts: Map<string, number>,
): Promise<SourceDiagnosticEpgProbe[]> {
  const base = channels.map((channel) => ({
    channelId: channel.id,
    channel: channel.name,
    category: channel.categoryName,
    streamId: channel.streamId,
    epgChannelId: channel.epgChannelId,
    tvgId: channel.tvgId,
    storedProgramCount: storedProgramCounts.get(channel.id) ?? 0,
  }));

  if (playlist.type !== 'xtream' || !playlist.xtream) {
    return base.map((item) => ({
      ...item,
      requestStatus: 'unsupported' as const,
      responseType: 'not-requested',
      responseKeys: [],
      listingCount: 0,
      listingKeys: [],
      error: 'short_epg_requires_xtream',
    }));
  }

  const password = await secureStore.getPlaylistPassword(playlist.id);
  if (!password) {
    return base.map((item) => ({
      ...item,
      requestStatus: 'error' as const,
      responseType: 'not-requested',
      responseKeys: [],
      listingCount: 0,
      listingKeys: [],
      error: 'playlist_password_unavailable',
    }));
  }

  const credentials = {
    serverUrl: playlist.xtream.serverUrl,
    username: playlist.xtream.username,
    password,
  };

  return mapWithConcurrency(base, EPG_PROBE_CONCURRENCY, async (item) => {
    if (!item.streamId) {
      return {
        ...item,
        requestStatus: 'missing-stream-id' as const,
        responseType: 'not-requested',
        responseKeys: [],
        listingCount: 0,
        listingKeys: [],
        error: 'missing_stream_id',
      };
    }

    try {
      const raw = await xtreamService.getShortEpg(credentials, item.streamId, 12);
      const parsed = responseListings(raw);
      return {
        ...item,
        requestStatus: 'ok' as const,
        responseType: Array.isArray(raw) ? 'array' : typeof raw,
        responseKeys: parsed.keys,
        listingCount: parsed.listings.length,
        listingKeys: parsed.listings[0] ? Object.keys(parsed.listings[0]) : [],
      };
    } catch (error) {
      return {
        ...item,
        requestStatus: 'error' as const,
        responseType: 'error',
        responseKeys: [],
        listingCount: 0,
        listingKeys: [],
        error: error instanceof Error ? error.message.slice(0, 240) : 'request_failed',
      };
    }
  });
}

function buildCategoryDiagnostics(
  playlistId: string,
  state: ReturnType<typeof useAppStore.getState>,
): {
  categories: SourceDiagnosticCategory[];
  summaries: SourceDiagnosticCategorySummary[];
  anomalies: SourceDiagnosticReport['categoryAnomalies'];
} {
  const rows: SourceDiagnosticCategory[] = [];
  const sources: Array<{
    family: DiagnosticCategoryFamily;
    categories: readonly {
      id: string;
      name: string;
      originalName?: string;
      parentId?: string;
      childIds?: string[];
      level?: number;
      path?: string[];
      relation?: 'native' | 'inferred' | 'flat';
      regionCode?: string;
      qualities?: string[];
      playlistId: string;
      channelCount?: number;
      movieCount?: number;
      seriesCount?: number;
    }[];
    count: (category: {
      channelCount?: number;
      movieCount?: number;
      seriesCount?: number;
    }) => number;
  }> = [
    { family: 'live', categories: state.liveCategories, count: (category) => category.channelCount ?? 0 },
    { family: 'movie', categories: state.movieCategories, count: (category) => category.movieCount ?? 0 },
    { family: 'series', categories: state.seriesCategories, count: (category) => category.seriesCount ?? 0 },
  ];

  for (const source of sources) {
    const categories = source.categories.filter((category) => category.playlistId === playlistId);
    const byId = new Map(categories.map((category) => [category.id, category]));
    for (const category of categories) {
      const parent = category.parentId ? byId.get(category.parentId) : undefined;
      const nameKey = normalizeCategoryName(category.name);
      rows.push({
        family: source.family,
        id: category.id,
        name: category.name,
        originalName: category.originalName,
        ...(category.parentId ? { parentId: category.parentId } : {}),
        ...(parent ? { parent: parent.name } : {}),
        childIds: category.childIds ?? [],
        childCount: category.childIds?.length ?? 0,
        level: category.level,
        path: category.path,
        relation: category.relation,
        regionCode: category.regionCode,
        qualities: category.qualities ?? [],
        contentCount: source.count(category),
        duplicateNameKey: nameKey,
        sameNameAsParent: Boolean(parent && normalizeCategoryName(parent.name) === nameKey),
      });
    }
  }

  const summaries = sources.map((source) => {
    const categories = rows.filter((category) => category.family === source.family);
    const duplicateGroups = new Map<string, SourceDiagnosticCategory[]>();
    for (const category of categories) {
      const group = duplicateGroups.get(category.duplicateNameKey) ?? [];
      group.push(category);
      duplicateGroups.set(category.duplicateNameKey, group);
    }
    const duplicateNameGroups = [...duplicateGroups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([normalizedName, group]) => ({
        normalizedName,
        categoryIds: group.map((category) => category.id),
        names: group.map((category) => category.name),
      }));
    const sameNameParentChildren = categories
      .filter((category) => category.sameNameAsParent && category.parentId)
      .map((category) => ({
        parentId: category.parentId!,
        childId: category.id,
        name: category.name,
      }));

    return {
      family: source.family,
      total: categories.length,
      roots: categories.filter((category) => !category.parentId).length,
      categoriesWithChildren: categories.filter((category) => category.childCount > 0).length,
      categoriesWithContent: categories.filter((category) => category.contentCount > 0).length,
      duplicateNameGroups,
      sameNameParentChildren,
    };
  });

  const anomalies: SourceDiagnosticReport['categoryAnomalies'] = [];
  for (const summary of summaries) {
    for (const duplicate of summary.duplicateNameGroups) {
      anomalies.push({
        type: 'duplicate-name',
        family: summary.family,
        name: duplicate.names[0] ?? duplicate.normalizedName,
        categoryIds: duplicate.categoryIds,
      });
    }
    for (const duplicate of summary.sameNameParentChildren) {
      anomalies.push({
        type: 'same-name-parent-child',
        family: summary.family,
        name: duplicate.name,
        categoryIds: [duplicate.parentId, duplicate.childId],
        parentId: duplicate.parentId,
      });
    }
  }

  return { categories: rows, summaries, anomalies };
}

export async function buildSourceDiagnosticReport(playlistId: string): Promise<SourceDiagnosticReport> {
  const state = useAppStore.getState();
  const playlist = state.playlists.find((item) => item.id === playlistId);
  if (!playlist) throw new Error('source_not_found');

  const channels = state.channels.filter((channel) => channel.playlistId === playlistId);
  const movies = state.movies.filter((movie) => movie.playlistId === playlistId);
  const series = state.series.filter((item) => item.playlistId === playlistId);
  const programs = state.epgPrograms.filter((program) => program.id.startsWith(`${playlistId}:epg:`));
  const channelIdsWithPrograms = new Set(programs.map((program) => program.channelId));
  const storedProgramCounts = new Map<string, number>();
  for (const program of programs) {
    storedProgramCounts.set(program.channelId, (storedProgramCounts.get(program.channelId) ?? 0) + 1);
  }
  const missingChannels = channels
    .filter((channel) => !channelIdsWithPrograms.has(channel.id))
    .map((channel) => ({
      channelId: channel.id,
      name: channel.name,
      category: channel.categoryName,
      streamId: channel.streamId,
      epgChannelId: channel.epgChannelId,
      tvgId: channel.tvgId,
    }));

  const imageCandidates = [
    ...channels.map((channel) => ({
      kind: 'channel-logo' as const,
      catalogId: channel.id,
      title: channel.name,
      category: channel.categoryName,
      raw: channel.logo,
    })),
    ...movies.map((movie) => ({
      kind: 'movie-poster' as const,
      catalogId: movie.id,
      title: movie.name,
      category: movie.categoryName,
      raw: movie.logo,
    })),
    ...series.map((item) => ({
      kind: 'series-poster' as const,
      catalogId: item.id,
      title: item.name,
      category: item.categoryName,
      raw: item.cover,
    })),
  ];

  const [imageResults, epgProbes] = await Promise.all([
    probeImages(imageCandidates),
    probeShortEpg(playlist, channels, storedProgramCounts),
  ]);

  const categoryDiagnostics = buildCategoryDiagnostics(playlistId, state);
  const categoryCounts = {
    live: categoryDiagnostics.categories.filter((category) => category.family === 'live').length,
    movie: categoryDiagnostics.categories.filter((category) => category.family === 'movie').length,
    series: categoryDiagnostics.categories.filter((category) => category.family === 'series').length,
  };
  const probeStatusCounts: Record<DiagnosticEpgProbeStatus, number> = {
    ok: 0,
    error: 0,
    'missing-stream-id': 0,
    unsupported: 0,
  };
  for (const probe of epgProbes) probeStatusCounts[probe.requestStatus] += 1;

  const imageKinds: SourceDiagnosticImage['kind'][] = ['channel-logo', 'movie-poster', 'series-poster'];
  const imageSummary = imageKinds.map((kind) => {
    const items = imageResults.filter((image) => image.kind === kind);
    return {
      kind,
      total: items.length,
      withUrl: items.filter((image) => image.url !== '[missing-url]').length,
      ok: items.filter((image) => image.status === 'ok').length,
      error: items.filter((image) => image.status === 'error').length,
      timeout: items.filter((image) => image.status === 'timeout').length,
      notTested: items.filter((image) => image.status === 'not-tested').length,
    };
  });

  return {
    format: 'nova-tv-source-diagnostic',
    version: 2,
    generatedAt: new Date().toISOString(),
    warning: 'Rapport anonymisé. Les images et les requêtes EPG sont testées pour toutes les chaînes et le rapport peut être volumineux.',
    source: {
      name: playlist.name,
      type: playlist.type,
      server: sourceServer(playlist),
      selectedCategories: playlist.xtream?.categorySelection,
    },
    catalog: {
      channels: channels.length,
      movies: movies.length,
      series: series.length,
      liveCategories: categoryCounts.live,
      movieCategories: categoryCounts.movie,
      seriesCategories: categoryCounts.series,
      categoriesWithChildren: categoryDiagnostics.categories.filter((category) => category.childCount > 0).length,
    },
    epg: {
      method: playlist.type === 'xtream' ? 'xtream-short-epg' : 'stored-catalog-only',
      programsStored: programs.length,
      channelsWithPrograms: channelIdsWithPrograms.size,
      channelsWithoutPrograms: channels.length - channelIdsWithPrograms.size,
      matchedChannelIds: [...channelIdsWithPrograms],
      missingChannels,
      probeStatusCounts,
      probes: epgProbes,
    },
    categories: categoryDiagnostics.categories,
    categorySummaries: categoryDiagnostics.summaries,
    categoryAnomalies: categoryDiagnostics.anomalies,
    imageSummary,
    images: imageResults,
  };
}

export function formatSourceDiagnostic(report: SourceDiagnosticReport): string {
  return JSON.stringify(report, null, 2);
}

/** Copie le rapport sans dépendance native : l'utilisateur le colle ici. */
export async function copySourceDiagnostic(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('clipboard_unavailable');
}
