import { secureStore } from '@/lib/secureStore';
import { useAppStore } from '@/store/useAppStore';
import { xtreamService } from '@/services/xtream/xtreamService';
import type { LiveChannel, Playlist } from '@/types';

const IMAGE_PROBE_CONCURRENCY = 10;
const EPG_PROBE_CONCURRENCY = 4;
const IMAGE_TIMEOUT_MS = 8_000;

export type DiagnosticImageStatus = 'ok' | 'error' | 'timeout' | 'not-tested';
export type DiagnosticEpgProbeStatus = 'ok' | 'error' | 'redirect' | 'missing-stream-id' | 'unsupported' | 'not-tested';
export type DiagnosticCategoryFamily = 'live' | 'movie' | 'series';

export interface SourceDiagnosticProgress {
  phase: 'images' | 'epg';
  completed: number;
  total: number;
}

export interface SourceDiagnosticBuildOptions {
  probe?: boolean;
  onProgress?: (progress: SourceDiagnosticProgress) => void;
}

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
    errorGroups: Array<{
      status: 'error' | 'redirect';
      error: string;
      count: number;
      sampleChannels: string[];
      sampleChannelIds: string[];
    }>;
    probes: SourceDiagnosticEpgProbe[];
  };
  categories: SourceDiagnosticCategory[];
  categorySummaries: SourceDiagnosticCategorySummary[];
  categoryFallbackFamilies: DiagnosticCategoryFamily[];
  categoryAnomalies: Array<{
    type: 'same-name-parent-child' | 'duplicate-name';
    family: DiagnosticCategoryFamily;
    name: string;
    categoryIds: string[];
    parentId?: string;
  }>;
  categoryContentMatches: Array<{
    family: DiagnosticCategoryFamily;
    contentId: string;
    contentName: string;
    categoryId: string;
    categoryName: string;
    categoryContentCount: number;
    onlyContentInCategory: boolean;
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
  if (typeof raw === 'string') {
    try {
      return responseListings(JSON.parse(raw) as unknown);
    } catch {
      return { keys: [], listings: [] };
    }
  }
  if (!raw || typeof raw !== 'object') return { keys: [], listings: [] };
  const record = raw as Record<string, unknown>;
  for (const key of ['epg_listings', 'listings', 'programs', 'epg', 'js']) {
    const value = record[key];
    if (Array.isArray(value)) {
      return {
        keys: Object.keys(record),
        listings: value.filter(
          (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'),
        ),
      };
    }
    if (key === 'js' && (typeof value === 'string' || (value && typeof value === 'object'))) {
      const nested = responseListings(value);
      if (nested.listings.length > 0) {
        return { keys: Object.keys(record), listings: nested.listings };
      }
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

type ImageCandidate = {
  kind: SourceDiagnosticImage['kind'];
  catalogId: string;
  title: string;
  category?: string;
  raw?: string;
};

function notTestedImages(candidates: ImageCandidate[]): SourceDiagnosticImage[] {
  return candidates.map((item) => ({
    kind: item.kind,
    catalogId: item.catalogId,
    title: item.title,
    category: item.category,
    url: item.raw?.trim() ? safeUrl(item.raw) ?? '[invalid-url]' : '[missing-url]',
    status: item.raw?.trim() ? 'not-tested' : 'error',
    probeMode: 'browser-image',
    elapsedMs: 0,
    ...(item.raw?.trim() ? { error: 'probe_pending' } : { error: 'missing_image_url' }),
  }));
}

async function probeImages(
  candidates: ImageCandidate[],
  onProgress?: (progress: SourceDiagnosticProgress) => void,
): Promise<SourceDiagnosticImage[]> {
  const cache = new Map<string, Promise<Awaited<ReturnType<typeof probeImage>>>>();
  let completed = 0;
  const notify = () => {
    completed += 1;
    onProgress?.({ phase: 'images', completed, total: candidates.length });
  };
  const results = await mapWithConcurrency(candidates, IMAGE_PROBE_CONCURRENCY, async (item) => {
    if (!item.raw?.trim()) {
      const result = {
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
      notify();
      return result;
    }

    let probe = cache.get(item.raw);
    if (!probe) {
      probe = probeImage(item.raw);
      cache.set(item.raw, probe);
    }
    const result = await probe;
    notify();
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

function epgProbeBase(
  channels: LiveChannel[],
  storedProgramCounts: Map<string, number>,
): Array<{
  channelId: string;
  channel: string;
  category?: string;
  streamId?: number;
  epgChannelId?: string;
  tvgId?: string;
  storedProgramCount: number;
}> {
  return channels.map((channel) => ({
    channelId: channel.id,
    channel: channel.name,
    category: channel.categoryName,
    streamId: channel.streamId,
    epgChannelId: channel.epgChannelId,
    tvgId: channel.tvgId,
    storedProgramCount: storedProgramCounts.get(channel.id) ?? 0,
  }));
}

function notTestedEpgProbes(
  channels: LiveChannel[],
  storedProgramCounts: Map<string, number>,
): SourceDiagnosticEpgProbe[] {
  return epgProbeBase(channels, storedProgramCounts).map((item) => ({
    ...item,
    requestStatus: item.streamId ? 'not-tested' : 'missing-stream-id',
    responseType: 'not-requested',
    responseKeys: [],
    listingCount: 0,
    listingKeys: [],
    error: item.streamId ? 'probe_pending' : 'missing_stream_id',
  }));
}

async function probeShortEpg(
  playlist: Playlist,
  channels: LiveChannel[],
  storedProgramCounts: Map<string, number>,
  onProgress?: (progress: SourceDiagnosticProgress) => void,
): Promise<SourceDiagnosticEpgProbe[]> {
  const base = epgProbeBase(channels, storedProgramCounts);
  let completed = 0;
  const notify = () => {
    completed += 1;
    onProgress?.({ phase: 'epg', completed, total: base.length });
  };

  if (playlist.type !== 'xtream' || !playlist.xtream) {
    return base.map((item) => {
      notify();
      return {
        ...item,
        requestStatus: 'unsupported' as const,
        responseType: 'not-requested',
        responseKeys: [],
        listingCount: 0,
        listingKeys: [],
        error: 'short_epg_requires_xtream',
      };
    });
  }

  const password = await secureStore.getPlaylistPassword(playlist.id);
  if (!password) {
    return base.map((item) => {
      notify();
      return {
        ...item,
        requestStatus: 'error' as const,
        responseType: 'not-requested',
        responseKeys: [],
        listingCount: 0,
        listingKeys: [],
        error: 'playlist_password_unavailable',
      };
    });
  }

  const credentials = {
    serverUrl: playlist.xtream.serverUrl,
    username: playlist.xtream.username,
    password,
  };

  return mapWithConcurrency(base, EPG_PROBE_CONCURRENCY, async (item) => {
    if (!item.streamId) {
      const result = {
        ...item,
        requestStatus: 'missing-stream-id' as const,
        responseType: 'not-requested',
        responseKeys: [],
        listingCount: 0,
        listingKeys: [],
        error: 'missing_stream_id',
      };
      notify();
      return result;
    }

    try {
      const raw = await xtreamService.getShortEpg(credentials, item.streamId, 12);
      const parsed = responseListings(raw);
      const result = {
        ...item,
        requestStatus: 'ok' as const,
        responseType: Array.isArray(raw) ? 'array' : typeof raw,
        responseKeys: parsed.keys,
        listingCount: parsed.listings.length,
        listingKeys: parsed.listings[0] ? Object.keys(parsed.listings[0]) : [],
      };
      notify();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 240) : 'request_failed';
      const requestStatus = /\bHTTP\s+(301|302|303|307|308)\b/i.test(message)
        ? ('redirect' as const)
        : ('error' as const);
      const result = {
        ...item,
        requestStatus,
        responseType: requestStatus === 'redirect' ? 'redirect' : 'error',
        responseKeys: [],
        listingCount: 0,
        listingKeys: [],
        error: message,
      };
      notify();
      return result;
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
  categoryFallbackFamilies: DiagnosticCategoryFamily[];
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

  const categoryContentCounts = new Map<string, number>();
  const categoryContentNames = new Map<string, string>();
  const contentSources: Array<{
    family: DiagnosticCategoryFamily;
    items: readonly { playlistId: string; categoryId?: string; categoryName?: string }[];
  }> = [
    { family: 'live', items: state.channels },
    { family: 'movie', items: state.movies },
    { family: 'series', items: state.series },
  ];
  for (const contentSource of contentSources) {
    for (const item of contentSource.items) {
      if (item.playlistId !== playlistId || !item.categoryId) continue;
      const key = `${contentSource.family}:${item.categoryId}`;
      categoryContentCounts.set(key, (categoryContentCounts.get(key) ?? 0) + 1);
      if (!categoryContentNames.has(key) && item.categoryName?.trim()) {
        categoryContentNames.set(key, item.categoryName.trim());
      }
    }
  }

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
        contentCount: Math.max(
          source.count(category),
          categoryContentCounts.get(`${source.family}:${category.id}`) ?? 0,
        ),
        duplicateNameKey: nameKey,
        sameNameAsParent: Boolean(parent && normalizeCategoryName(parent.name) === nameKey),
      });
    }
  }

  const categoryFallbackFamilies: DiagnosticCategoryFamily[] = [];
  for (const source of sources) {
    const existingIds = new Set(
      rows
        .filter((category) => category.family === source.family)
        .map((category) => category.id),
    );
    const contentCategoryIds = [...categoryContentCounts.keys()]
      .filter((key) => key.startsWith(`${source.family}:`))
      .map((key) => key.slice(source.family.length + 1));
    let addedFallback = false;
    for (const categoryId of contentCategoryIds) {
      if (existingIds.has(categoryId)) continue;
      const key = `${source.family}:${categoryId}`;
      const name = categoryContentNames.get(key) ?? `[category-name-missing:${categoryId}]`;
      const nameKey = normalizeCategoryName(name);
      rows.push({
        family: source.family,
        id: categoryId,
        name,
        originalName: name,
        childIds: [],
        childCount: 0,
        relation: 'flat',
        qualities: [],
        contentCount: categoryContentCounts.get(key) ?? 0,
        duplicateNameKey: nameKey,
        sameNameAsParent: false,
      });
      existingIds.add(categoryId);
      addedFallback = true;
    }
    if (addedFallback) categoryFallbackFamilies.push(source.family);
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

  return { categories: rows, summaries, anomalies, categoryFallbackFamilies };
}

export async function buildSourceDiagnosticReport(
  playlistId: string,
  options: SourceDiagnosticBuildOptions = {},
): Promise<SourceDiagnosticReport> {
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

  let imageResults: SourceDiagnosticImage[];
  let epgProbes: SourceDiagnosticEpgProbe[];
  if (options.probe === false) {
    imageResults = notTestedImages(imageCandidates);
    epgProbes = notTestedEpgProbes(channels, storedProgramCounts);
  } else {
    [imageResults, epgProbes] = await Promise.all([
      probeImages(imageCandidates, options.onProgress),
      probeShortEpg(playlist, channels, storedProgramCounts, options.onProgress),
    ]);
  }

  const categoryDiagnostics = buildCategoryDiagnostics(playlistId, state);
  const categoryCounts = {
    live: categoryDiagnostics.categories.filter((category) => category.family === 'live').length,
    movie: categoryDiagnostics.categories.filter((category) => category.family === 'movie').length,
    series: categoryDiagnostics.categories.filter((category) => category.family === 'series').length,
  };
  const probeStatusCounts: Record<DiagnosticEpgProbeStatus, number> = {
    ok: 0,
    error: 0,
    redirect: 0,
    'missing-stream-id': 0,
    unsupported: 0,
    'not-tested': 0,
  };
  for (const probe of epgProbes) probeStatusCounts[probe.requestStatus] += 1;

  const epgErrorGroups = new Map<string, {
    status: 'error' | 'redirect';
    error: string;
    count: number;
    sampleChannels: string[];
    sampleChannelIds: string[];
  }>();
  for (const probe of epgProbes) {
    if (probe.requestStatus !== 'error' && probe.requestStatus !== 'redirect') continue;
    const error = probe.error ?? 'request_failed';
    const status = probe.requestStatus;
    const key = `${status}:${error}`;
    const group = epgErrorGroups.get(key) ?? {
      status,
      error,
      count: 0,
      sampleChannels: [],
      sampleChannelIds: [],
    };
    group.count += 1;
    if (group.sampleChannels.length < 10) group.sampleChannels.push(probe.channel);
    if (group.sampleChannelIds.length < 10) group.sampleChannelIds.push(probe.channelId);
    epgErrorGroups.set(key, group);
  }
  const errorGroups = [...epgErrorGroups.values()].sort((left, right) => right.count - left.count);

  const categoryByKey = new Map(
    categoryDiagnostics.categories.map((category) => [`${category.family}:${category.id}`, category]),
  );
  const contentRows: Array<{
    family: DiagnosticCategoryFamily;
    contentId: string;
    contentName: string;
    categoryId?: string;
  }> = [
    ...channels.map((channel) => ({
      family: 'live' as const,
      contentId: channel.id,
      contentName: channel.name,
      categoryId: channel.categoryId,
    })),
    ...movies.map((movie) => ({
      family: 'movie' as const,
      contentId: movie.id,
      contentName: movie.name,
      categoryId: movie.categoryId,
    })),
    ...series.map((item) => ({
      family: 'series' as const,
      contentId: item.id,
      contentName: item.name,
      categoryId: item.categoryId,
    })),
  ];
  const categoryContentMatches = contentRows.flatMap((content) => {
    if (!content.categoryId) return [];
    const category = categoryByKey.get(`${content.family}:${content.categoryId}`);
    if (!category || normalizeCategoryName(content.contentName) !== category.duplicateNameKey) return [];
    return [{
      family: content.family,
      contentId: content.contentId,
      contentName: content.contentName,
      categoryId: category.id,
      categoryName: category.name,
      categoryContentCount: category.contentCount,
      onlyContentInCategory: category.contentCount === 1,
    }];
  });

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
      errorGroups,
      probes: epgProbes,
    },
    categories: categoryDiagnostics.categories,
    categorySummaries: categoryDiagnostics.summaries,
    categoryFallbackFamilies: categoryDiagnostics.categoryFallbackFamilies,
    categoryAnomalies: categoryDiagnostics.anomalies,
    categoryContentMatches,
    imageSummary,
    images: imageResults,
  };
}

export function formatSourceDiagnostic(report: SourceDiagnosticReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatSourceDiagnosticSummary(report: SourceDiagnosticReport): string {
  return JSON.stringify({
    format: report.format,
    version: report.version,
    generatedAt: report.generatedAt,
    source: report.source,
    catalog: report.catalog,
    epg: {
      method: report.epg.method,
      programsStored: report.epg.programsStored,
      channelsWithPrograms: report.epg.channelsWithPrograms,
      channelsWithoutPrograms: report.epg.channelsWithoutPrograms,
      probeStatusCounts: report.epg.probeStatusCounts,
      errorGroups: report.epg.errorGroups,
      problematicProbes: report.epg.probes.filter(
        (probe) =>
          (probe.requestStatus !== 'ok' && probe.requestStatus !== 'not-tested') ||
          (probe.listingCount === 0 && probe.requestStatus !== 'not-tested'),
      ),
      pendingProbes: report.epg.probes.filter((probe) => probe.requestStatus === 'not-tested'),
    },
    images: {
      summary: report.imageSummary,
      failures: report.images.filter((image) => image.status === 'error' || image.status === 'timeout'),
      pending: report.images.filter((image) => image.status === 'not-tested'),
    },
    categories: {
      summaries: report.categorySummaries,
      fallbackFamilies: report.categoryFallbackFamilies,
      anomalies: report.categoryAnomalies,
      contentNameMatches: report.categoryContentMatches,
    },
  }, null, 2);
}

export function formatSourceCategoryDiagnostic(report: SourceDiagnosticReport): string {
  return JSON.stringify({
    format: report.format,
    version: report.version,
    generatedAt: report.generatedAt,
    source: report.source,
    catalog: report.catalog,
    categories: report.categories,
    summaries: report.categorySummaries,
    fallbackFamilies: report.categoryFallbackFamilies,
    anomalies: report.categoryAnomalies,
    contentNameMatches: report.categoryContentMatches,
  }, null, 2);
}

export function splitSourceDiagnostic(text: string, maxChars = 12_000): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    if (line.length <= maxChars) {
      current = line;
      continue;
    }
    for (let offset = 0; offset < line.length; offset += maxChars) {
      chunks.push(line.slice(offset, offset + maxChars));
    }
    current = '';
  }
  if (current) chunks.push(current);
  return chunks;
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
