'use client';

import React, { useState, useMemo } from 'react';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { useClock } from '@/hooks/useClock';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import Link from 'next/link';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Play, Radio, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Badge } from '@/design-system/components/Badge';
import { ProgressBar } from '@/design-system/components/ProgressBar';
import { GlassCard } from '@/design-system/components/GlassCard';
import { EmptyState } from '@/design-system/components/EmptyState';
import { VirtualGrid } from '@/design-system/components/VirtualGrid';
import { formatEPGTime, getProgramProgress } from '@/utils/cn';
import { useTranslation, type MessageKey } from '@/i18n';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';
import { useAppStore } from '@/store/useAppStore';
import { channelDisplayName } from '@/lib/displayNames';
import { runPlaylistEpg } from '@/features/playlists/runPlaylistEpg';
import { EPG_STEP_KEYS } from '@/features/playlists/syncMessages';
import { indexNowPlaying, indexUpcoming, type EPGSyncProgress } from '@/services/epg/epgSync';
import toast from 'react-hot-toast';
import type { EPGProgram, LiveChannel } from '@/types';

const DAY_KEYS = ['epg.yesterday', 'epg.today', 'epg.tomorrow'] as const satisfies ReadonlyArray<MessageKey>;

interface EpgRow {
  key: string;
  program: EPGProgram;
  channel: LiveChannel | undefined;
  isNow: boolean;
  isPast: boolean;
}

function EPGPageContent() {
  const { t } = useTranslation();
  const { channels: allChannels, epgPrograms: allPrograms, activePlaylistId } = useActiveCatalog();
  const [epgBusy, setEpgBusy] = useState(false);
  const channelRenames = useAppStore((s) => s.channelRenames);
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[] | null>(null);
  const [channelSelectorOpen, setChannelSelectorOpen] = useState(true);
  const [channelSearch, setChannelSearch] = useState('');
  const [showPast, setShowPast] = useState(false);
  const nowMs = useClock();

  const channelsById = useMemo(() => {
    const map = new Map<string, LiveChannel>();
    for (const ch of allChannels) map.set(ch.id, ch);
    return map;
  }, [allChannels]);

  const channelLabel = (ch: { id: string; name: string }) =>
    channelDisplayName(ch.id, ch.name, channelRenames);

  const channelsWithGuide = useMemo(() => {
    const ids = new Set(allPrograms.map((p) => p.channelId));
    return allChannels.filter((ch) => ids.has(ch.id));
  }, [allChannels, allPrograms]);
  const channelsWithGuideSet = useMemo(
    () => new Set(channelsWithGuide.map((channel) => channel.id)),
    [channelsWithGuide],
  );

  const selectedChannelSet = useMemo(
    () => new Set(selectedChannelIds ?? allChannels.map((channel) => channel.id)),
    [allChannels, selectedChannelIds],
  );
  const selectedChannelCount = selectedChannelSet.size;
  const filteredChannelOptions = useMemo(() => {
    const query = channelSearch.trim().toLowerCase();
    if (!query) return allChannels;
    return allChannels.filter((channel) =>
      channelDisplayName(channel.id, channel.name, channelRenames).toLowerCase().includes(query),
    );
  }, [allChannels, channelSearch, channelRenames]);

  const nowPlaying = useMemo(() => indexNowPlaying(allPrograms, nowMs), [allPrograms, nowMs]);
  const upcoming = useMemo(() => indexUpcoming(allPrograms, nowMs), [allPrograms, nowMs]);

  const rows = useMemo((): EpgRow[] => {
    const target = new Date(nowMs);
    target.setDate(target.getDate() + dayOffset);
    const dayStart = new Date(target);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(target);
    dayEnd.setHours(23, 59, 59, 999);
    const startMs = dayStart.getTime();
    const endMs = dayEnd.getTime();

    const toRow = (program: EPGProgram): EpgRow => {
      const start = Date.parse(program.start);
      const stop = Date.parse(program.stop);
      return {
        key: program.id,
        program,
        channel: channelsById.get(program.channelId),
        isNow: start <= nowMs && nowMs < stop,
        isPast: stop <= nowMs,
      };
    };

    if (dayOffset === 0 && !showPast) {
      const out: EpgRow[] = [];
      for (const ch of channelsWithGuide) {
        if (!selectedChannelSet.has(ch.id)) continue;
        const current = nowPlaying.get(ch.id);
        const next = upcoming.get(ch.id);
        if (current) out.push(toRow(current));
        if (next) out.push(toRow(next));
      }
      return out;
    }

    let list = allPrograms.filter((p) => {
      const start = Date.parse(p.start);
      const stop = Date.parse(p.stop);
      if (Number.isNaN(start) || Number.isNaN(stop)) return false;
      if (!selectedChannelSet.has(p.channelId)) return false;
      if (stop < startMs || start > endMs) return false;
      if (dayOffset === 0 && !showPast && stop <= nowMs) return false;
      return true;
    });

    list = [...list].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    return list.map(toRow);
  }, [
    allPrograms,
    channelsById,
    channelsWithGuide,
    dayOffset,
    nowMs,
    nowPlaying,
    selectedChannelSet,
    showPast,
    upcoming,
  ]);

  const selectAllChannels = () => setSelectedChannelIds(null);
  const selectNoChannels = () => setSelectedChannelIds([]);
  const toggleChannel = (channelId: string) => {
    const next = new Set(selectedChannelSet);
    if (next.has(channelId)) next.delete(channelId);
    else next.add(channelId);

    const allSelected = next.size === allChannels.length && allChannels.every((channel) => next.has(channel.id));
    setSelectedChannelIds(allSelected ? null : [...next]);
  };

  const handleRetryEpg = async () => {
    if (!activePlaylistId || epgBusy || selectedChannelCount === 0) return;
    setEpgBusy(true);
    const epgToastId = `epg-retry-${activePlaylistId}`;
    const updateEpgToast = (progress: EPGSyncProgress) => {
      const label = t(EPG_STEP_KEYS[progress.step]);
      const percent = Math.round(Math.max(0, Math.min(1, progress.ratio)) * 100);
      const detail =
        progress.done !== undefined && progress.total !== undefined && progress.total > 0
          ? t('playlists.epgProgressChannels', {
              done: progress.done,
              total: progress.total,
              percent,
            })
          : progress.step === 'download' && progress.ratio <= 0
            ? null
            : `${percent} %`;
      toast.loading(detail ? `${label} · ${detail}` : label, { id: epgToastId });
    };

    updateEpgToast({ step: 'download', ratio: 0 });
    try {
      const result = await runPlaylistEpg(activePlaylistId, {
        channelIds: selectedChannelIds ?? undefined,
        onProgress: updateEpgToast,
      });
      if (!result) {
        toast.error(t('epg.loadFailed'), { id: epgToastId });
        return;
      }
      if (result.programs.length === 0) {
        toast.error(t('playlists.epgNoMatch'), { id: epgToastId });
        return;
      }
      toast.success(
        t('playlists.epgSummary', {
          programs: result.programs.length,
          channels: result.matchedChannels,
        }),
        { id: epgToastId },
      );
    } catch {
      toast.error(t('epg.loadFailed'), { id: epgToastId });
    } finally {
      setEpgBusy(false);
    }
  };

  const hydrated = useHydrated();

  if (!hydrated) return <ListPageSkeleton />;

  return (
    <div className="epg-page min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">{t('epg.title')}</h1>
          <p className="text-sm text-white/40 mt-0.5">{t('epg.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDayOffset((d) => Math.max(d - 1, -1))}
            disabled={dayOffset <= -1}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2 text-white/60 transition-colors hover:bg-surface-3 hover:text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-1">
            {[-1, 0, 1].map((offset) => (
              <button
                key={offset}
                type="button"
                onClick={() => setDayOffset(offset)}
                className={cn(
                  'min-h-11 rounded-full px-4 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  offset === dayOffset ? 'bg-accent text-white' : 'border border-line bg-surface-2 text-white/60 hover:bg-surface-3 hover:text-white'
                )}
              >
                {t(DAY_KEYS[offset + 1])}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDayOffset((d) => Math.min(d + 1, 1))}
            disabled={dayOffset >= 1}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2 text-white/60 transition-colors hover:bg-surface-3 hover:text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {dayOffset === 0 && (
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className="min-h-11 rounded-full border border-line bg-surface-2 px-4 text-sm text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {showPast ? t('epg.hidePast') : t('epg.showPast')}
        </button>
      )}

      <section className="epg-channel-selector rounded-2xl border border-line bg-surface-1">
        <button
          type="button"
          onClick={() => setChannelSelectorOpen((open) => !open)}
          aria-expanded={channelSelectorOpen}
          className="flex min-h-14 w-full items-center gap-3 px-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Radio className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">{t('common.channels')}</span>
            <span className="block truncate text-xs text-white/40">
              {t('epg.selectedChannelsSummary', {
                selected: selectedChannelCount,
                total: allChannels.length,
              })}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-white/45">
            {channelSelectorOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {channelSelectorOpen && (
          <div className="border-t border-line px-3 pb-3 pt-3 sm:px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">{t('common.search')}</span>
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  type="search"
                  value={channelSearch}
                  onChange={(event) => setChannelSearch(event.target.value)}
                  placeholder={t('common.search')}
                  className="min-h-10 w-full rounded-xl border border-line bg-surface-2 ps-9 pe-3 text-sm text-white placeholder:text-white/35 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </label>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllChannels}
                  className={cn(
                    'min-h-10 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    selectedChannelIds === null || selectedChannelCount === allChannels.length
                      ? 'bg-accent/15 text-white'
                      : 'border border-line text-white/55 hover:bg-white/5 hover:text-white',
                  )}
                >
                  {t('epg.selectAll')}
                </button>
                <button
                  type="button"
                  onClick={selectNoChannels}
                  className={cn(
                    'min-h-10 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    selectedChannelCount === 0
                      ? 'bg-accent/15 text-white'
                      : 'border border-line text-white/55 hover:bg-white/5 hover:text-white',
                  )}
                >
                  {t('epg.selectNone')}
                </button>
              </div>
            </div>

            <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface-2/40">
              {filteredChannelOptions.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-white/40">{t('search.noResultsFor', { query: channelSearch })}</p>
              ) : (
                filteredChannelOptions.map((channel) => {
                  const selected = selectedChannelSet.has(channel.id);
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => toggleChannel(channel.id)}
                      aria-pressed={selected}
                      className="flex min-h-12 w-full items-center gap-3 border-b border-line px-3 text-start last:border-b-0 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      <span className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                        selected ? 'border-accent bg-accent text-white' : 'border-white/25 text-transparent',
                      )}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <ImageWithFallback
                        src={channel.logo}
                        alt={channelLabel(channel)}
                        className="h-6 w-9 shrink-0 object-contain"
                        fallbackClassName="h-6 w-9 shrink-0"
                        fallback={<Radio className="h-3.5 w-3.5 text-white/35" />}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-white/80">{channelLabel(channel)}</span>
                      {channelsWithGuideSet.has(channel.id) && <span className="text-[10px] uppercase tracking-wide text-accent">EPG</span>}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-white/40">{t('epg.selectedChannels', { count: selectedChannelCount })}</span>
              <button
                type="button"
                onClick={handleRetryEpg}
                disabled={!activePlaylistId || epgBusy || selectedChannelCount === 0}
                className="min-h-10 rounded-xl bg-accent px-3 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {epgBusy ? t('playlists.syncing') : t('epg.syncSelected')}
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="min-w-0">

          {rows.length === 0 ? (
            <EmptyState
              emoji="📅"
              title={allPrograms.length === 0 && allChannels.length > 0 ? t('epg.loadFailed') : t('epg.noPrograms')}
              description={
                allPrograms.length === 0 && allChannels.length > 0
                  ? t('epg.loadFailedDescription')
                  : t('epg.noProgramsDescription')
              }
              action={
                allPrograms.length === 0 && allChannels.length > 0 && activePlaylistId
                  ? {
                      label: epgBusy ? t('common.loading') : t('common.retry'),
                      onClick: handleRetryEpg,
                    }
                  : undefined
              }
            />
          ) : (
            <VirtualGrid
              items={rows}
              layout="list"
              getKey={(row) => row.key}
              renderItem={(row) => {
                const { program: prog, channel, isNow, isPast } = row;
                const progress = isNow ? getProgramProgress(prog.start, prog.stop) : 0;
                const href = `/player?type=live&id=${encodeURIComponent(prog.channelId)}`;
                return (
                  <Link href={href} className="block">
                    <GlassCard
                      variant={isNow ? 'red' : 'glass'}
                      padding="md"
                      className={cn(isPast && 'opacity-50')}
                    >
                      <div className="flex items-start gap-3">
                        {channel && (
                          <ImageWithFallback
                            src={channel.logo}
                            alt={channelLabel(channel)}
                            className="w-10 h-6 object-contain flex-shrink-0 mt-1"
                            fallbackClassName="w-10 h-6 flex-shrink-0 mt-1"
                            fallback={<Radio className="w-4 h-4 text-white/20" />}
                          />
                        )}
                        {prog.icon ? (
                          <img
                            src={prog.icon}
                            alt=""
                            className="h-12 w-20 shrink-0 rounded-md object-cover"
                            referrerPolicy="no-referrer"
                            decoding="async"
                          />
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-white/50 font-medium">{formatEPGTime(prog.start)} – {formatEPGTime(prog.stop)}</span>
                              {isNow && <Badge variant="live" size="xs" pulse>{t('epg.onNow')}</Badge>}
                              {prog.category && <Badge variant="genre" size="xs">{prog.category}</Badge>}
                            </div>
                            <span className="flex-shrink-0 flex items-center gap-1 px-3 py-1 bg-accent text-white text-xs font-bold rounded-lg">
                              <Play className="w-3 h-3 fill-white" />
                              {t('common.watch')}
                            </span>
                          </div>
                          <p className={cn('font-semibold text-white', isPast && 'text-white/60')}>{prog.title}</p>
                          {channel && (
                            <p className="text-xs text-white/30 mt-0.5">{channelLabel(channel)}</p>
                          )}
                          {prog.description && (
                            <p className="text-sm text-white/50 mt-1.5 line-clamp-2">{prog.description}</p>
                          )}
                          {isNow && (
                            <ProgressBar value={progress} className="mt-2" size="xs" />
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                );
              }}
            />
          )}
        </div>
    </div>
  );
}

export function EPGPage() {
  const { activePlaylistId } = useActiveCatalog();

  return <EPGPageContent key={activePlaylistId ?? 'none'} />;
}
