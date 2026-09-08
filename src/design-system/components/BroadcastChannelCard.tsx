'use client';

import Link from 'next/link';
import { Heart, Info, Lock, Tv } from 'lucide-react';
import { cn, formatEPGTime } from '@/utils/cn';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';
import { ScrollingText } from './ScrollingText';
import { ImageWithFallback } from './ImageWithFallback';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/i18n';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useLongPress } from '@/hooks/useLongPress';
import { useParental } from '@/features/parental/ParentalProvider';
import { channelDisplayName } from '@/lib/displayNames';
import { broadcastArtworkUrl } from '@/services/epg/epgSync';
import type { LiveChannel } from '@/types';

/**
 * Ligne Live « cinéma » (look B).
 *
 * Visuel : affiche émission si l'EPG en a une, sinon logo chaîne,
 * sinon monogramme. Jamais une carte noire vide.
 */
export function BroadcastChannelCard({
  channel,
  className,
  listId,
}: {
  channel: LiveChannel;
  className?: string;
  listId?: string;
}) {
  const { t } = useTranslation();
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFav = useAppStore((s) => s.isFavorite(channel.id));
  const channelRenames = useAppStore((s) => s.channelRenames);
  const { isTV } = useDeviceType();
  const { isChannelBlocked, ensureUnlocked } = useParental();
  const blocked = isChannelBlocked(channel);
  const displayName = channelDisplayName(channel.id, channel.name, channelRenames);
  const playHref = `/player?type=live&id=${encodeURIComponent(channel.id)}${listId ? `&listId=${encodeURIComponent(listId)}` : ''}`;
  const infoHref = `/live?id=${encodeURIComponent(channel.id)}`;
  const longPress = useLongPress(infoHref, isTV);
  const art = broadcastArtworkUrl(channel);
  const current = channel.currentProgram;
  const next = channel.nextProgram;
  const number =
    typeof channel.sortOrder === 'number' && channel.sortOrder > 0
      ? String(channel.sortOrder).padStart(2, '0')
      : null;

  return (
    <div className={cn('catalog-card group relative', className)}>
      <Link
        href={playHref}
        className="block"
        {...longPress}
        onClick={(e) => {
          if (blocked) {
            e.preventDefault();
            ensureUnlocked();
          }
        }}
      >
        <div
          className={cn(
            'relative min-h-[104px] overflow-hidden rounded-2xl border border-line bg-surface-2',
            blocked && 'opacity-60'
          )}
        >
          {art ? (
            <img
              src={art}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-35"
              referrerPolicy="no-referrer"
              decoding="async"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-surface-2 via-surface-2/85 to-surface-2/20" />

          <div className="relative flex items-stretch gap-3 p-3">
            <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl bg-black/45 px-1 py-2">
              <ImageWithFallback
                src={channel.logo}
                alt={displayName}
                className="max-h-10 max-w-full object-contain"
                fallbackClassName="h-10 w-10"
                fallback={<Tv className="h-5 w-5 text-white/30" />}
              />
              {number ? (
                <span className="mt-1 text-[10px] font-semibold tabular-nums text-white/40">
                  {number}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pe-10">
              <div className="flex items-center gap-2">
                <ScrollingText
                  text={displayName}
                  className="flex-1 text-sm font-semibold text-white"
                />
                <Badge variant="live" size="xs" pulse>
                  {t('common.liveShort')}
                </Badge>
                {blocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
              </div>

              {current ? (
                <>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    {t('liveTV.now')}
                  </p>
                  <p className="truncate text-sm font-semibold text-white">{current.title}</p>
                  <p className="text-[11px] text-white/50">
                    {formatEPGTime(current.start)} – {formatEPGTime(current.stop)}
                  </p>
                  {current.progressPercent !== undefined ? (
                    <ProgressBar value={current.progressPercent} size="xs" className="mt-1.5" />
                  ) : null}
                  {next ? (
                    <p className="mt-1 truncate text-[11px] text-white/40">
                      {formatEPGTime(next.start)} {next.title}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 text-xs text-white/40">{t('liveTV.noProgram')}</p>
              )}
            </div>
          </div>
        </div>
      </Link>

      {!isTV && (
        <Link
          href={infoHref}
          aria-label={t('liveTV.channelInfo')}
          className="absolute start-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/70 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-black/80 hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white"
        >
          <Info className="h-3.5 w-3.5" />
        </Link>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          toggleFavorite(channel.id, 'channel');
        }}
        aria-label={
          isFav
            ? `Retirer ${displayName} des favoris`
            : `Ajouter ${displayName} aux favoris`
        }
        aria-pressed={isFav}
        className="absolute end-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm"
      >
        <Heart className={cn('h-4 w-4', isFav && 'fill-accent text-accent')} />
      </button>
    </div>
  );
}
