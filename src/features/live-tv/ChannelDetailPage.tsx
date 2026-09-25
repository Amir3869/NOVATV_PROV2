'use client';

import React, { useState } from 'react';
import { ArrowLeft, Heart, Radio, Calendar, Globe, Clock, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { Badge } from '@/design-system/components/Badge';
import { GlassCard } from '@/design-system/components/GlassCard';
import { ProgressBar } from '@/design-system/components/ProgressBar';
import { EmptyState } from '@/design-system/components/EmptyState';
import { ImageWithFallback } from '@/design-system/components/ImageWithFallback';
import { useAppStore } from '@/store/useAppStore';
import { useActiveCatalog } from '@/hooks/useActiveCatalog';
import { useHydrated } from '@/hooks/useHydrated';
import { DetailSkeleton } from '@/design-system/components/LoadingSkeleton';
import { formatEPGTime, getProgramProgress } from '@/utils/cn';
import { channelDisplayName, categoryDisplayName } from '@/lib/displayNames';
import { ChannelRenameDialog } from './ChannelRenameDialog';
import { useTranslation } from '@/i18n';

interface Props { channelId: string; }

export function ChannelDetailPage({ channelId }: Props) {
  const { t } = useTranslation();
  const { channels: allChannels, epgPrograms: allPrograms } = useActiveCatalog();
  const router = useRouter();
  const channel = allChannels.find((c) => c.id === channelId);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFav = useAppStore((s) => s.isFavorite(channelId));
  const channelRenames = useAppStore((s) => s.channelRenames);
  const categoryRenames = useAppStore((s) => s.categoryRenames);
  const renameChannel = useAppStore((s) => s.renameChannel);
  const [renameOpen, setRenameOpen] = useState(false);

  // Voir useHydrated : sans ce garde, la page annonce « Chaîne
  // introuvable » avant même d'avoir lu les données enregistrées.
  const hydrated = useHydrated();

  if (!hydrated) return <DetailSkeleton />;

  if (!channel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState emoji="📡" title={t('liveTV.channelNotFound')} description={t('liveTV.channelNotFoundDescription')} action={{ label: t('common.back'), onClick: () => router.back() }} />
      </div>
    );
  }

  const programs = allPrograms.filter((p) => p.channelId === channelId);
  const currentProgram = programs.find((p) => new Date(p.start) <= new Date() && new Date(p.stop) >= new Date());
  const upcomingPrograms = programs.filter((p) => new Date(p.start) > new Date()).slice(0, 5);

  // Noms affichés : la chaîne et sa catégorie peuvent avoir été
  // renommées. Seul l'affichage change, l'identifiant réel reste celui
  // qui relie la fiche au guide, aux favoris et à l'historique.
  const displayName = channelDisplayName(channel.id, channel.name, channelRenames);
  const displayCategory =
    channel.categoryId && channel.categoryName
      ? categoryDisplayName(channel.categoryId, channel.categoryName, categoryRenames)
      : channel.categoryName;

  const handleRename = (name: string) => {
    renameChannel(channel.id, name);
    if (name.trim()) {
      toast.success(t('liveTV.renamedChannel', { name: name.trim() }));
    } else {
      toast.success(t('liveTV.restoredChannel', { name: channel.name }));
    }
  };

  return (
    <div className="detail-page min-h-screen">
      {/* Hero */}
      <div className="channel-detail-hero relative h-32 sm:h-40 md:h-56 lg:h-64 bg-gradient-to-br from-black via-zinc-900 to-surface-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-0" />

        {/* Back */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="cinema absolute top-4 start-4 w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Channel logo centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageWithFallback
            src={channel.logo}
            alt={displayName}
            className="max-h-16 max-w-32 object-contain filter drop-shadow-2xl md:max-h-24 md:max-w-48"
            fallbackClassName="flex h-12 w-16 items-center justify-center rounded-xl bg-white/5 md:h-16 md:w-24"
            fallback={<Radio className="h-6 w-6 text-white/30 md:h-8 md:w-8" />}
          />
        </div>
      </div>

      <div className="channel-detail-content px-3 sm:px-4 md:px-8 lg:px-10 -mt-4 md:-mt-6 relative z-10 space-y-4 md:space-y-6 pb-8 md:pb-10">
        {/* Channel info */}
        <GlassCard variant="glass" className="channel-detail-primary flex flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:p-5">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="live" size="sm" pulse>{t('liveTV.liveBadge')}</Badge>
                {channel.country && <span className="text-xs text-white/40">{channel.country}</span>}
                {channel.language && <span className="text-xs text-white/40">{channel.language.toUpperCase()}</span>}
              </div>
              <h1 className="flex min-w-0 flex-wrap items-center gap-2 text-xl font-black text-white sm:text-2xl">
                {displayName}
                <button
                  onClick={() => setRenameOpen(true)}
                  aria-label={t('liveTV.renameChannel')}
                  title={t('liveTV.renameChannel')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/40 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </h1>
              {displayCategory && (
                <p className="text-sm text-white/40 mt-1">{displayCategory}</p>
              )}
            </div>
            <button
              onClick={() => toggleFavorite(channel.id, 'channel')}
              className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', isFav ? 'bg-accent/20 text-accent' : 'bg-white/5 text-white/40 hover:text-white')}
            >
              <Heart className={cn('w-5 h-5', isFav && 'fill-accent')} />
            </button>
          </div>

          {/* Watch button */}
          <Link
            href={`/player?type=live&id=${channel.id}`}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-lg shadow-red-900/20 transition-colors hover:bg-accent-hover sm:py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
          >
            <Radio className="w-4 h-4" />
            {t('liveTV.watchLive')}
          </Link>
        </GlassCard>

        {/* Current Program */}
        {currentProgram && (
          <GlassCard variant="glass" className="channel-detail-section p-3 sm:p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/50">{t('epg.now')}</h2>
            <div>
              <h3 className="mb-1 text-base font-bold text-white sm:text-lg">{currentProgram.title}</h3>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <span className="text-xs text-white/40">{formatEPGTime(currentProgram.start)} – {formatEPGTime(currentProgram.stop)}</span>
                {currentProgram.category && <Badge variant="genre">{currentProgram.category}</Badge>}
              </div>
              <ProgressBar value={getProgramProgress(currentProgram.start, currentProgram.stop)} className="mb-2" />
              {currentProgram.description && (
                <p className="text-sm text-white/60 leading-relaxed">{currentProgram.description}</p>
              )}
            </div>
          </GlassCard>
        )}

        {/* Upcoming */}
        {upcomingPrograms.length > 0 && (
          <GlassCard variant="glass" className="channel-detail-section p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">{t('liveTV.upNext')}</h2>
              <Link href={`/epg`} className="text-xs text-accent hover:text-red-400 transition-colors font-medium">
                {t('liveTV.fullGuide')}
              </Link>
            </div>
            <div className="space-y-2 sm:space-y-3">
              {upcomingPrograms.map((prog) => (
                <div key={prog.id} className="flex items-start gap-3 border-b border-white/5 py-1.5 last:border-0 sm:py-2">
                  <div className="flex-shrink-0 text-xs text-white/40 w-14">
                    {formatEPGTime(prog.start)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">{prog.title}</p>
                    {prog.category && <Badge variant="genre" size="xs" className="mt-1">{prog.category}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {programs.length === 0 && (
          <EmptyState emoji="📅" title={t('epg.noData')} description={t('epg.noDataDescription')} size="sm" />
        )}
      </div>

      {renameOpen && (
        <ChannelRenameDialog
          initialName={displayName}
          onSubmit={handleRename}
          onClose={() => setRenameOpen(false)}
        />
      )}
    </div>
  );
}
