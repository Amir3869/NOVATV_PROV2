'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Radio, Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Badge } from '@/design-system/components/Badge';
import { ProgressBar } from '@/design-system/components/ProgressBar';
import { GlassCard } from '@/design-system/components/GlassCard';
import { EmptyState } from '@/design-system/components/EmptyState';
import { formatEPGTime, getProgramProgress } from '@/utils/cn';
import { useTranslation, type MessageKey } from '@/i18n';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';

const DAY_KEYS = ['epg.yesterday', 'epg.today', 'epg.tomorrow'] as const satisfies ReadonlyArray<MessageKey>;

export function EPGPage() {
  const { t } = useTranslation();
  const allChannels = useAppStore((s) => s.channels);
  const allPrograms = useAppStore((s) => s.epgPrograms);
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, -1 = yesterday, +1 = tomorrow
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const channels = allChannels;

  const filteredPrograms = useMemo(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dayStart = new Date(targetDate.setHours(0, 0, 0, 0));
    const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999));

    return allPrograms.filter((p) => {
      const start = new Date(p.start);
      return start >= dayStart && start <= dayEnd;
    });
  }, [dayOffset, allPrograms]);

  const channelPrograms = useMemo(() => {
    if (selectedChannelId) {
      return filteredPrograms.filter((p) => p.channelId === selectedChannelId);
    }
    return filteredPrograms;
  }, [filteredPrograms, selectedChannelId]);

  const now = new Date();

  // Voir useHydrated : ne rien conclure tant que les données
  // enregistrées ne sont pas relues.
  const hydrated = useHydrated();

  if (!hydrated) return <ListPageSkeleton />;

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">{t('epg.title')}</h1>
          <p className="text-sm text-white/40 mt-0.5">{t('epg.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDayOffset((d) => Math.max(d - 1, -1))}
            disabled={dayOffset <= -1}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-1">
            {[-1, 0, 1].map((offset) => (
              <button
                key={offset}
                onClick={() => setDayOffset(offset)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  offset === dayOffset ? 'bg-accent text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                )}
              >
                {t(DAY_KEYS[offset + 1])}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDayOffset((d) => Math.min(d + 1, 1))}
            disabled={dayOffset >= 1}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Channel list (sidebar on md+) */}
        <div className="flex-shrink-0 space-y-1 hidden md:block w-48">
          <p className="text-xs text-white/30 uppercase tracking-wider mb-2 px-2">{t('common.channels')}</p>
          <button
            onClick={() => setSelectedChannelId(null)}
            className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors', !selectedChannelId ? 'bg-accent/15 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white')}
          >
            <CalendarDays className="w-4 h-4" />
            {t('epg.allChannels')}
          </button>
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannelId(ch.id === selectedChannelId ? null : ch.id)}
              className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors', ch.id === selectedChannelId ? 'bg-accent/15 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white')}
            >
              <ImageWithFallback
                src={ch.logo}
                alt={ch.name}
                className="w-8 h-5 object-contain"
                fallbackClassName="w-8 h-5 flex-shrink-0"
                fallback={<Radio className="w-4 h-4" />}
              />
              <span className="truncate">{ch.name}</span>
            </button>
          ))}
        </div>

        {/* Programs */}
        <div className="flex-1 min-w-0">
          {/* Mobile channel selector */}
          <div className="md:hidden flex gap-2 overflow-x-auto scrollbar-none pb-2 mb-4">
            <button
              onClick={() => setSelectedChannelId(null)}
              className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-sm transition-all', !selectedChannelId ? 'bg-accent text-white' : 'bg-white/5 text-white/50')}
            >
              {t('epg.allChannels')}
            </button>
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannelId(ch.id === selectedChannelId ? null : ch.id)}
                className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-sm transition-all', ch.id === selectedChannelId ? 'bg-accent text-white' : 'bg-white/5 text-white/50')}
              >
                {ch.name}
              </button>
            ))}
          </div>

          {channelPrograms.length === 0 ? (
            <EmptyState emoji="📅" title={t('epg.noPrograms')} description={t('epg.noProgramsDescription')} />
          ) : (
            <div className="space-y-2">
              {channelPrograms.map((prog) => {
                const progStart = new Date(prog.start);
                const progEnd = new Date(prog.stop);
                const isNow = progStart <= now && progEnd >= now;
                const isPast = progEnd < now;
                const progress = isNow ? getProgramProgress(prog.start, prog.stop) : 0;
                const channel = channels.find((c) => c.id === prog.channelId);

                return (
                  <GlassCard
                    key={prog.id}
                    variant={isNow ? 'red' : 'glass'}
                    padding="md"
                    className={cn(isPast && 'opacity-50')}
                  >
                    <div className="flex items-start gap-3">
                      {/* Channel logo */}
                      {!selectedChannelId && channel && (
                        <ImageWithFallback
                          src={channel.logo}
                          alt={channel.name}
                          className="w-10 h-6 object-contain flex-shrink-0 mt-1"
                          fallbackClassName="w-10 h-6 flex-shrink-0 mt-1"
                          fallback={<Radio className="w-4 h-4 text-white/20" />}
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-white/50 font-medium">{formatEPGTime(prog.start)} – {formatEPGTime(prog.stop)}</span>
                            {isNow && <Badge variant="live" size="xs" pulse>{t('epg.onNow')}</Badge>}
                            {prog.category && <Badge variant="genre" size="xs">{prog.category}</Badge>}
                          </div>
                          {isNow && (
                            <Link
                              href={`/player?type=live&id=${prog.channelId}`}
                              className="flex-shrink-0 flex items-center gap-1 px-3 py-1 bg-accent text-white text-xs font-bold rounded-lg"
                            >
                              <Play className="w-3 h-3 fill-white" />
                              {t('common.watch')}
                            </Link>
                          )}
                        </div>

                        <p className={cn('font-semibold text-white', isPast && 'text-white/60')}>{prog.title}</p>

                        {!selectedChannelId && channel && (
                          <p className="text-xs text-white/30 mt-0.5">{channel.name}</p>
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
