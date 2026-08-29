'use client';

import React from 'react';
import Link from 'next/link';
import { Play, Trash2, Clock, History } from 'lucide-react';
import { cn } from '@/utils/cn';
import { ProgressBar } from '@/design-system/components/ProgressBar';
import { EmptyState } from '@/design-system/components/EmptyState';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { formatTimeAgo } from '@/utils/cn';
import { useTranslation } from '@/i18n';
import type { Episode } from '@/types';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';

export function HistoryPage() {
  const { t } = useTranslation();
  const watchHistory = useAppStore((s) => s.watchHistory);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const removeFromHistory = useAppStore((s) => s.removeFromHistory);
  const clearHistory = useAppStore((s) => s.clearHistory);

  const profileHistory = watchHistory.filter((h) => h.profileId === activeProfileId);
  const continueWatching = profileHistory.filter((h) => h.percent > 0 && h.percent < 100);
  const completed = profileHistory.filter((h) => h.percent >= 100);
  const other = profileHistory.filter((h) => h.percent === 0);

  // Voir useHydrated : ne rien conclure tant que les données
  // enregistrées ne sont pas relues.
  const hydrated = useHydrated();

  if (!hydrated) return <ListPageSkeleton />;

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">{t('history.title')}</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {t(profileHistory.length > 1 ? 'history.viewCountPlural' : 'history.viewCount', { count: profileHistory.length })}
          </p>
        </div>
        {profileHistory.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white/50 hover:text-white hover:bg-white/10 text-sm transition-all border border-white/5"
          >
            <Trash2 className="w-4 h-4" />
            {t('history.clearAll')}
          </button>
        )}
      </div>

      {profileHistory.length === 0 && (
        <EmptyState
          emoji="🕐"
          title={t('history.empty')}
          description={t('history.emptyDescription')}
        />
      )}

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            {t('history.continueWatching')}
          </h2>
          <div className="space-y-3">
            {continueWatching.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} onRemove={removeFromHistory} />
            ))}
          </div>
        </section>
      )}

      {/* All History */}
      {other.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-white/40" />
            {t('history.recentlyWatched')}
          </h2>
          <div className="space-y-3">
            {other.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} onRemove={removeFromHistory} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-[10px]">✓</span>
            {t('history.completedPlural')}
          </h2>
          <div className="space-y-3">
            {completed.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} onRemove={removeFromHistory} completed />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function HistoryItem({ entry, onRemove, completed = false }: {
  entry: ReturnType<typeof useAppStore.getState>['watchHistory'][0];
  onRemove: (id: string) => void;
  completed?: boolean;
}) {
  const { t } = useTranslation();
  // Un épisode renvoie vers sa série, pas vers lui-même : il n'existe pas
  // d'écran par épisode. `seriesId` est porté par `mediaData`, rempli à
  // l'enregistrement dans l'historique.
  //
  // Le lien pointait auparavant vers `/series/series-2` en dur — un
  // vestige des données de démonstration, qui menait tout épisode vers
  // une série inexistante.
  const episodeSeriesId =
    entry.mediaType === 'episode'
      ? (entry.mediaData as Partial<Episode> | undefined)?.seriesId
      : undefined;

  const href = entry.mediaType === 'movie' ? `/movies?id=${encodeURIComponent(entry.mediaId)}`
    : entry.mediaType === 'episode'
      ? (episodeSeriesId ? `/series?id=${encodeURIComponent(episodeSeriesId)}` : '/series')
    : entry.mediaType === 'live' ? `/live?id=${encodeURIComponent(entry.mediaId)}`
    : `/`;

  return (
    <div className="group flex items-center gap-4 p-3 rounded-xl bg-white/3 hover:bg-white/5 border border-white/5 hover:border-white/8 transition-all">
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-surface-3">
        <ImageWithFallback
          src={entry.thumbnail}
          alt={entry.title}
          className="w-full h-full object-cover"
          fallbackClassName="w-full h-full"
          fallback={<Play className="w-5 h-5 text-white/20" />}
        />
        {entry.percent > 0 && entry.percent < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
            <div className="h-full bg-accent" style={{ width: `${entry.percent}%` }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{entry.title}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-white/30 capitalize">{entry.mediaType === 'live' ? t('history.typeLive') : entry.mediaType === 'movie' ? t('history.typeMovie') : t('history.typeEpisode')}</span>
          {entry.watchedAt && <span className="text-xs text-white/30">{formatTimeAgo(entry.watchedAt)}</span>}
          {!completed && entry.percent > 0 && <span className="text-xs text-white/30">{t('history.shortWatchedPercent', { percent: entry.percent })}</span>}
          {completed && <span className="text-xs text-emerald-400">{t('history.completed')}</span>}
        </div>
        {!completed && entry.percent > 0 && entry.percent < 100 && (
          <ProgressBar value={entry.percent} size="xs" className="mt-1.5 max-w-32" />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity flex-shrink-0">
        <Link
          href={href}
          aria-label={t('common.play')}
          className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent hover:bg-accent/30 transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
        </Link>
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          aria-label={t('common.delete')}
          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
