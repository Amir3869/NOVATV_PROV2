'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { Search, Clock, X, Tv, Film, BookOpen, Radio } from 'lucide-react';
import { cn } from '@/utils/cn';
import { SearchBar } from '@/design-system/components/SearchBar';
import { MovieCard, SeriesCard, ChannelCard } from '@/design-system/components/MediaCard';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Badge } from '@/design-system/components/Badge';
import Link from 'next/link';
import { useTranslation, type MessageKey } from '@/i18n';


function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SearchPage() {
  const { t } = useTranslation();
  const allChannels = useAppStore((s) => s.channels);
  const allPrograms = useAppStore((s) => s.epgPrograms);
  const allMovies = useAppStore((s) => s.movies);
  const allSeries = useAppStore((s) => s.series);

  // Suggestions tirées des catégories réellement présentes dans le
  // catalogue : proposer un genre absent mènerait à zéro résultat.
  const SUGGESTIONS = useMemo(() => {
    const names = new Set<string>();
    for (const item of [...allMovies, ...allSeries]) {
      if (item.categoryName) names.add(item.categoryName);
    }
    return [...names].sort((a, b) => a.localeCompare(b)).slice(0, 6);
  }, [allMovies, allSeries]);
  const [query, setQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const debouncedQuery = useDebounce(query, 300);

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return null;
    const q = debouncedQuery.toLowerCase();

    return {
      channels: allChannels.filter((c) => c.name.toLowerCase().includes(q) || c.categoryName?.toLowerCase().includes(q)).slice(0, 6),
      movies: allMovies.filter((m) => m.name.toLowerCase().includes(q) || m.genre?.toLowerCase().includes(q) || m.cast?.toLowerCase().includes(q) || m.director?.toLowerCase().includes(q)).slice(0, 8),
      series: allSeries.filter((s) => s.name.toLowerCase().includes(q) || s.genre?.toLowerCase().includes(q) || s.cast?.toLowerCase().includes(q)).slice(0, 6),
      programs: allPrograms.filter((p) => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)).slice(0, 6),
    };
  }, [debouncedQuery, allChannels, allMovies, allSeries, allPrograms]);

  const totalResults = results ? results.channels.length + results.movies.length + results.series.length + results.programs.length : 0;

  const addToHistory = (q: string) => {
    if (q.trim() && !searchHistory.includes(q)) {
      setSearchHistory((prev) => [q, ...prev].slice(0, 10));
    }
  };

  // Voir useHydrated : ne rien conclure tant que les données
  // enregistrées ne sont pas relues.
  const hydrated = useHydrated();

  if (!hydrated) return <ListPageSkeleton rows={4} />;

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-6">
      {/* Search input */}
      <div className="max-w-2xl">
        <h1 className="text-2xl font-black text-white mb-4">{t('search.title')}</h1>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('search.placeholder')}
          autoFocus
          onClear={() => setQuery('')}
          className="text-base"
        />
      </div>

      {/* No query – show suggestions & history */}
      {!query && (
        <div className="space-y-8">
          {/* History */}
          {searchHistory.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">{t('search.recentSearches')}</h2>
                <button onClick={() => setSearchHistory([])} className="text-xs text-white/30 hover:text-white/60 transition-colors">{t('search.clear')}</button>
              </div>
              <div className="space-y-1">
                {searchHistory.map((item) => (
                  <button
                    key={item}
                    onClick={() => setQuery(item)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left group"
                  >
                    <Clock className="w-4 h-4 text-white/30 flex-shrink-0" />
                    <span className="text-sm text-white/70 group-hover:text-white transition-colors flex-1">{item}</span>
                    <X
                      className="w-3.5 h-3.5 text-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-all"
                      onClick={(e) => { e.stopPropagation(); setSearchHistory((h) => h.filter((i) => i !== item)); }}
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Suggestions */}
          {SUGGESTIONS.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">{t('search.suggestions')}</h2>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/8 text-sm text-white/60 hover:bg-white/10 hover:text-white hover:border-white/15 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
          )}

          {/* Browse categories */}
          <section>
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">{t('search.browse')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { labelKey: 'nav.liveTV' as MessageKey, href: '/live', icon: Tv, color: '#C8102E' },
                { labelKey: 'nav.movies' as MessageKey, href: '/movies', icon: Film, color: '#FF9F0A' },
                { labelKey: 'nav.series' as MessageKey, href: '/series', icon: BookOpen, color: '#30D158' },
                { labelKey: 'nav.epg' as MessageKey, href: '/epg', icon: Radio, color: '#64D2FF' },
              ].map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/8 hover:border-white/10 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${cat.color}20` }}>
                    <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
                  </div>
                  <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">{t(cat.labelKey)}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Results */}
      {query && results && (
        <div className="space-y-8">
          <p className="text-sm text-white/40">
            {totalResults === 0
              ? t('search.noResults')
              : totalResults === 1
                ? t('search.resultsOne', { query: debouncedQuery })
                : t('search.resultsMany', { count: totalResults, query: debouncedQuery })}
          </p>

          {totalResults === 0 && (
            <EmptyState
              emoji="🔍"
              title={t('search.noResults')}
              description={t('search.noResultsFor', { query })}
            />
          )}

          {/* Channels */}
          {results.channels.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Tv className="w-4 h-4" />{t('search.channels')} ({results.channels.length})
              </h2>
              <div className="space-y-1">
                {results.channels.map((ch) => <ChannelCard key={ch.id} channel={ch} />)}
              </div>
            </section>
          )}

          {/* Movies */}
          {results.movies.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Film className="w-4 h-4" />{t('search.movies')} ({results.movies.length})
              </h2>
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
                {results.movies.map((m) => <MovieCard key={m.id} movie={m} />)}
              </div>
            </section>
          )}

          {/* Series */}
          {results.series.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />{t('search.series')} ({results.series.length})
              </h2>
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4">
                {results.series.map((s) => <SeriesCard key={s.id} series={s} />)}
              </div>
            </section>
          )}

          {/* Programs */}
          {results.programs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Radio className="w-4 h-4" />{t('search.programsEpg')} ({results.programs.length})
              </h2>
              <div className="space-y-2">
                {results.programs.map((prog) => {
                  const isNow = new Date(prog.start) <= new Date() && new Date(prog.stop) >= new Date();
                  return (
                    <div key={prog.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                      {isNow && <Badge variant="live" size="xs" pulse>{t('search.watching')}</Badge>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{prog.title}</p>
                        {prog.description && <p className="text-xs text-white/40 truncate">{prog.description}</p>}
                      </div>
                      {prog.category && <Badge variant="genre" size="xs">{prog.category}</Badge>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
