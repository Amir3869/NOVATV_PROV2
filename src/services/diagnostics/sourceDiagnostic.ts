import { secureStore } from '@/lib/secureStore';
import { useAppStore } from '@/store/useAppStore';
import { xtreamService } from '@/services/xtream/xtreamService';
import type { LiveChannel, Playlist } from '@/types';

const MAX_MISSING_EPG = 80;
const MAX_IMAGE_PROBES = 36;
const MAX_SHORT_EPG_PROBES = 12;

export type DiagnosticImageStatus = 'ok' | 'error' | 'timeout' | 'not-tested';

export interface SourceDiagnosticReport {
  format: 'nova-tv-source-diagnostic';
  version: 1;
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
    categoriesWithChildren: number;
  };
  epg: {
    programsStored: number;
    channelsWithPrograms: number;
    channelsWithoutPrograms: number;
    matchedChannelIds: string[];
    missingChannels: Array<{
      name: string;
      category?: string;
      streamId?: number;
      epgChannelId?: string;
      tvgId?: string;
    }>;
    shortEpgProbes: Array<{
      channel: string;
      streamId?: number;
      responseType: string;
      responseKeys: string[];
      listingCount: number;
      listingKeys: string[];
      error?: string;
    }>;
  };
  categories: Array<{
    name: string;
    parent?: string;
    childCount: number;
    channelCount: number;
  }>;
  images: Array<{
    kind: 'channel-logo' | 'movie-poster' | 'series-poster';
    title: string;
    url: string;
    status: DiagnosticImageStatus;
  }>;
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

function probeImage(url: string): Promise<DiagnosticImageStatus> {
  if (typeof Image === 'undefined') return Promise.resolve('not-tested');
  return new Promise((resolve) => {
    const image = new Image();
    let finished = false;
    const finish = (status: DiagnosticImageStatus) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(status);
    };
    const timer = window.setTimeout(() => finish('timeout'), 8_000);
    image.onload = () => finish('ok');
    image.onerror = () => finish('error');
    image.referrerPolicy = 'no-referrer';
    image.src = url;
  });
}

async function probeShortEpg(
  playlist: Playlist,
  channels: LiveChannel[],
): Promise<SourceDiagnosticReport['epg']['shortEpgProbes']> {
  if (playlist.type !== 'xtream' || !playlist.xtream) return [];
  const password = await secureStore.getPlaylistPassword(playlist.id);
  if (!password) return [];

  const credentials = {
    serverUrl: playlist.xtream.serverUrl,
    username: playlist.xtream.username,
    password,
  };
  const probes: SourceDiagnosticReport['epg']['shortEpgProbes'] = [];
  for (const channel of channels.slice(0, MAX_SHORT_EPG_PROBES)) {
    if (!channel.streamId) continue;
    try {
      const raw = await xtreamService.getShortEpg(credentials, channel.streamId, 12);
      const parsed = responseListings(raw);
      probes.push({
        channel: channel.name,
        streamId: channel.streamId,
        responseType: Array.isArray(raw) ? 'array' : typeof raw,
        responseKeys: parsed.keys,
        listingCount: parsed.listings.length,
        listingKeys: parsed.listings[0] ? Object.keys(parsed.listings[0]) : [],
      });
    } catch (error) {
      probes.push({
        channel: channel.name,
        streamId: channel.streamId,
        responseType: 'error',
        responseKeys: [],
        listingCount: 0,
        listingKeys: [],
        error: error instanceof Error ? error.message.slice(0, 240) : 'request failed',
      });
    }
  }
  return probes;
}

export async function buildSourceDiagnosticReport(playlistId: string): Promise<SourceDiagnosticReport> {
  const state = useAppStore.getState();
  const playlist = state.playlists.find((item) => item.id === playlistId);
  if (!playlist) throw new Error('source_not_found');

  const channels = state.channels.filter((channel) => channel.playlistId === playlistId);
  const movies = state.movies.filter((movie) => movie.playlistId === playlistId);
  const series = state.series.filter((item) => item.playlistId === playlistId);
  const categories = state.liveCategories.filter((category) => category.playlistId === playlistId);
  const programs = state.epgPrograms.filter((program) => program.id.startsWith(`${playlistId}:epg:`));
  const channelIdsWithPrograms = new Set(programs.map((program) => program.channelId));
  const missingChannels = channels
    .filter((channel) => !channelIdsWithPrograms.has(channel.id))
    .slice(0, MAX_MISSING_EPG)
    .map((channel) => ({
      name: channel.name,
      category: channel.categoryName,
      streamId: channel.streamId,
      epgChannelId: channel.epgChannelId,
      tvgId: channel.tvgId,
    }));

  const imageCandidates = [
    ...channels.flatMap((channel) => channel.logo
      ? [{ kind: 'channel-logo' as const, title: channel.name, raw: channel.logo }]
      : []),
    ...movies.flatMap((movie) => movie.logo
      ? [{ kind: 'movie-poster' as const, title: movie.name, raw: movie.logo }]
      : []),
    ...series.flatMap((item) => item.cover
      ? [{ kind: 'series-poster' as const, title: item.name, raw: item.cover }]
      : []),
  ];
  const uniqueImages = [...new Map(imageCandidates.map((item) => [item.raw, item])).values()]
    .slice(0, MAX_IMAGE_PROBES);
  const imageResults = await Promise.all(
    uniqueImages.map(async (item) => ({
      kind: item.kind,
      title: item.title,
      url: safeUrl(item.raw) ?? '[invalid-url]',
      status: await probeImage(item.raw),
    })),
  );

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const shortEpgProbes = await probeShortEpg(
    playlist,
    channels.filter((channel) => !channelIdsWithPrograms.has(channel.id)),
  );

  return {
    format: 'nova-tv-source-diagnostic',
    version: 1,
    generatedAt: new Date().toISOString(),
    warning: 'Rapport anonymisé : aucun identifiant ou mot de passe n’est exporté.',
    source: {
      name: playlist.name,
      type: playlist.type,
      server: sourceServer(playlist),
      playlistUrl: safeUrl(playlist.m3u?.url),
      selectedCategories: playlist.xtream?.categorySelection,
    },
    catalog: {
      channels: channels.length,
      movies: movies.length,
      series: series.length,
      liveCategories: categories.length,
      categoriesWithChildren: categories.filter((category) => (category.childIds?.length ?? 0) > 0).length,
    },
    epg: {
      programsStored: programs.length,
      channelsWithPrograms: channelIdsWithPrograms.size,
      channelsWithoutPrograms: channels.length - channelIdsWithPrograms.size,
      matchedChannelIds: [...channelIdsWithPrograms],
      missingChannels,
      shortEpgProbes,
    },
    categories: categories.map((category) => ({
      name: category.name,
      parent: category.parentId ? categoryById.get(category.parentId)?.name : undefined,
      childCount: category.childIds?.length ?? 0,
      channelCount: category.channelCount,
    })),
    images: imageResults,
  };
}

export function downloadSourceDiagnostic(report: SourceDiagnosticReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `nova-tv-diagnostic-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
