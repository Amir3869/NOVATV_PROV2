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
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { DetailSkeleton } from '@/design-system/components/LoadingSkeleton';
import { formatEPGTime, getProgramProgress } from '@/utils/cn';
import { channelDisplayName, categoryDisplayName } from '@/lib/displayNames';
import { ChannelRenameDialog } from './ChannelRenameDialog';
import { useTranslation } from '@/i18n';

interface Props { channelId: string; }

export function ChannelDetailPage({ channelId }: Props) {
  const { t } = useTranslation();
  const allChannels = useAppStore((s) => s.channels);
  const allPrograms = useAppStore((s) => s.epgPrograms);
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
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
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative h-48 md:h-64 bg-gradient-to-br from-black via-zinc-900 to-surface-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-0" />

        {/* Back */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t('common.back')}
          className="cinema absolute top-4 start-4 w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors z-10"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Channel logo centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          {channel.logo && !imgError ? (
            <img src={channel.logo} alt={channel.name} className="max-h-24 max-w-48 object-contain filter drop-shadow-2xl" onError={() => setImgError(true)} />
          ) : (
            <div className="w-24 h-16 rounded-xl bg-white/5 flex items-center justify-center">
              <Radio className="w-8 h-8 text-white/30" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-8 lg:px-10 -mt-6 relative z-10 space-y-6 pb-10">
        {/* Channel info */}
        <GlassCard variant="glass" className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="live" size="sm" pulse>{t('liveTV.liveBadge')}</Badge>
                {channel.country && <span className="text-xs text-white/40">{channel.country}</span>}
                {channel.language && <span className="text-xs text-white/40">{channel.language.toUpperCase()}</span>}
              </div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                {displayName}
                <button
                  onClick={() => setRenameOpen(true)}
                  aria-label={t('liveTV.renameChannel')}
                  title={t('liveTV.renameChannel')}
                  className="w-11 h-11 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all inline-flex items-center justify-center"
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
              className={cn('p-3 rounded-xl transition-all', isFav ? 'bg-accent/20 text-accent' : 'bg-white/5 text-white/40 hover:text-white')}
            >
              <Heart className={cn('w-5 h-5', isFav && 'fill-accent')} />
            </button>
          </div>

          {/* Watch button */}
          <Link
            href={`/player?type=live&id=${channel.id}`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-accent hover:bg-accent-hover text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-red-900/20"
          >
            <Radio className="w-4 h-4" />
            {t('liveTV.watchLive')}
          </Link>
        </GlassCard>

        {/* Current Program */}
        {currentProgram && (
          <GlassCard variant="glass">
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">{t('epg.now')}</h2>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">{currentProgram.title}</h3>
              <div className="flex items-center gap-3 mb-2">
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
          <GlassCard variant="glass">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">{t('liveTV.upNext')}</h2>
              <Link href={`/epg`} className="text-xs text-accent hover:text-red-400 transition-colors font-medium">
                {t('liveTV.fullGuide')}
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingPrograms.map((prog) => (
                <div key={prog.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
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
          initialName={channel.name}
          onSubmit={handleRename}
          onClose={() => setRenameOpen(false)}
        />
      )}
    </div>
  );
}
