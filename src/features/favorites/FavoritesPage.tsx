'use client';

import React, { useState } from 'react';
import { Heart, Tv, Film, BookOpen } from 'lucide-react';
import { cn } from '@/utils/cn';
import { MovieCard, SeriesCard, ChannelCard } from '@/design-system/components/MediaCard';
import { EmptyState } from '@/design-system/components/EmptyState';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { GridPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { useRouter } from 'next/navigation';
import { useTranslation, type MessageKey } from '@/i18n';

type Tab = 'all' | 'channels' | 'movies' | 'series';

export function FavoritesPage() {
  const { t } = useTranslation();
  const allChannels = useAppStore((s) => s.channels);
  const allMovies = useAppStore((s) => s.movies);
  const allSeries = useAppStore((s) => s.series);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const favorites = useAppStore((s) => s.favorites);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const router = useRouter();

  const profileFavorites = favorites.filter((f) => f.profileId === activeProfileId);
  const favChannelIds = profileFavorites.filter((f) => f.mediaType === 'channel').map((f) => f.mediaId);
  const favMovieIds = profileFavorites.filter((f) => f.mediaType === 'movie').map((f) => f.mediaId);
  const favSeriesIds = profileFavorites.filter((f) => f.mediaType === 'series').map((f) => f.mediaId);

  const favChannels = allChannels.filter((c) => favChannelIds.includes(c.id));
  const favMovies = allMovies.filter((m) => favMovieIds.includes(m.id));
  const favSeries = allSeries.filter((s) => favSeriesIds.includes(s.id));

  const total = favChannels.length + favMovies.length + favSeries.length;

  const tabs = [
    { id: 'all' as Tab, labelKey: 'favorites.all' as MessageKey, count: total, icon: Heart },
    { id: 'channels' as Tab, labelKey: 'common.channels' as MessageKey, count: favChannels.length, icon: Tv },
    { id: 'movies' as Tab, labelKey: 'nav.movies' as MessageKey, count: favMovies.length, icon: Film },
    { id: 'series' as Tab, labelKey: 'nav.series' as MessageKey, count: favSeries.length, icon: BookOpen },
  ];

  // Voir useHydrated : ne rien conclure tant que les données
  // enregistrées ne sont pas relues.
  const hydrated = useHydrated();

  if (!hydrated) return <GridPageSkeleton count={8} />;

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">{t('favorites.title')}</h1>
        <p className="text-sm text-white/40 mt-0.5">{total} élément{total !== 1 ? 's' : ''} sauvegardé{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id ? 'bg-accent text-white shadow-md' : 'text-white/50 hover:text-white hover:bg-white/5'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t(tab.labelKey)}</span>
            {tab.count > 0 && (
              <span className={cn('text-xs rounded-full px-1.5 py-0.5', activeTab === tab.id ? 'bg-white/20' : 'bg-white/10')}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {total === 0 && (
        <EmptyState
          emoji="❤️"
          title={t('favorites.empty')}
          description={t('favorites.emptyDescription')}
          action={{ label: t('favorites.browseContent'), onClick: () => router.push('/') }}
        />
      )}

      {/* Channels */}
      {(activeTab === 'all' || activeTab === 'channels') && favChannels.length > 0 && (
        <section>
          {activeTab === 'all' && <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><Tv className="w-4 h-4 text-accent" />{t('common.channels')}</h2>}
          <div className="space-y-1">
            {favChannels.map((ch) => <ChannelCard key={ch.id} channel={ch} />)}
          </div>
        </section>
      )}

      {/* Movies */}
      {(activeTab === 'all' || activeTab === 'movies') && favMovies.length > 0 && (
        <section>
          {activeTab === 'all' && <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><Film className="w-4 h-4 text-accent" />{t('nav.movies')}</h2>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {favMovies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
          </div>
        </section>
      )}

      {/* Series */}
      {(activeTab === 'all' || activeTab === 'series') && favSeries.length > 0 && (
        <section>
          {activeTab === 'all' && <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent" />{t('nav.series')}</h2>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {favSeries.map((series) => <SeriesCard key={series.id} series={series} />)}
          </div>
        </section>
      )}
    </div>
  );
}
