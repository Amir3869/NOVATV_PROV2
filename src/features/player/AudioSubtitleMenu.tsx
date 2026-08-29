'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/i18n';
import type { TrackController } from '@/services/player/trackController';
import type { SubtitleAppearance } from './SubtitleOverlay';
import type {
  SubtitleBackground,
  SubtitleFont,
  SubtitlePosition,
  SubtitleSize,
} from '@/services/player/subtitleSettings';
import {
  subtitleBackgroundCss,
  subtitleFontSize,
  subtitleFontStack,
} from '@/services/player/subtitleSettings';

interface AudioSubtitleMenuProps {
  /** Pistes audio et sous-titres du flux en cours. */
  controller: TrackController;
  /** Sous-titres affichés ou non (dépend de la piste active). */
  enabled: boolean;
  /** Réglages d'apparence courants. */
  appearance: SubtitleAppearance;
  /** Sélection d'une piste audio. */
  onSelectAudio: (id: string) => void;
  /** Sélection d'une piste de sous-titres, `null` pour désactiver. */
  onSelectTrack: (id: string | null) => void;
  onSize: (value: SubtitleSize) => void;
  onPosition: (value: SubtitlePosition) => void;
  onBackground: (value: SubtitleBackground) => void;
  onFont: (value: SubtitleFont) => void;
  onClose: () => void;
}

/** Abonnement vide : la valeur ne change jamais après le montage. */
const subscribeNoop = () => () => {};

/**
 * Panneau « Piste audio & sous-titres », ouvert dans le lecteur.
 *
 * Réplique le format de l'image de référence validée : un panneau
 * compact au **fond translucide** (verre dépoli), un seul titre en haut
 * à gauche, et pour chaque réglage une **ligne** avec le libellé à
 * gauche et le contrôle segmenté à droite. Police proposée en trois
 * styles affichés par leur lettre (A / T / Tä) dans leur propre police.
 * Aperçu réel de l'apparence en bas.
 *
 * Reprend le motif de `FitMenu` : portail vers `document.body`, piège à
 * focus à la télécommande, `Escape` en capture, restitution du focus — le
 * lecteur applique un `backdrop-blur` qui crée un contexte
 * d'empilement.
 *
 * Le rendu du texte est fait par `SubtitleOverlay`, pas par le
 * navigateur : chaque réglage agit donc réellement. Les sections
 * sous-titres ne s'affichent que si le flux en propose ; un flux avec
 * plusieurs pistes audio mais aucun sous-titre ne montre que la partie
 * audio, sans contrôle orphelin.
 */
export function AudioSubtitleMenu({
  controller,
  enabled,
  appearance,
  onSelectAudio,
  onSelectTrack,
  onSize,
  onPosition,
  onBackground,
  onFont,
  onClose,
}: AudioSubtitleMenuProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('button')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = panel?.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  if (!mounted) return null;

  const { audioTracks, activeAudioId, subtitleTracks, activeSubtitleId } = controller;
  const hasMultipleAudio = audioTracks.length > 1;
  const hasMultipleSubtitleTracks = subtitleTracks.length > 1;
  const hasSubtitles = subtitleTracks.length > 0;

  const fontOptions: Array<{ value: SubtitleFont; letter: string; font: string }> = [
    { value: 'sans', letter: 'A', font: 'Verdana' },
    { value: 'serif', letter: 'T', font: 'Georgia' },
    { value: 'mono', letter: 'Tä', font: 'Courier' },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('player.tracksTitle')}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[320px] rounded-2xl bg-black/65 backdrop-blur-xl border border-white/10 shadow-2xl px-6 pt-5 pb-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Titre seul, en haut à gauche — pas de barre d'en-tête. */}
        <h2 className="text-xl font-bold tracking-tight text-white">{t('player.tracksTitle')}</h2>

        <div className="mt-4 flex flex-col gap-4">
          {/* Interrupteur principal des sous-titres. */}
          {hasSubtitles && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-white/90">{t('player.subtitleToggle')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={t('player.subtitleToggle')}
                onClick={() =>
                  onSelectTrack(enabled ? null : defaultTrackId(subtitleTracks, activeSubtitleId))
                }
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                  enabled ? 'bg-accent' : 'bg-white/20'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                    enabled && 'translate-x-5'
                  )}
                />
              </button>
            </div>
          )}

          {/* Sélecteurs de pistes : une liste de BOUTONS focusables (pas
              de <select> natif). La télécommande navigue de bouton en
              bouton avec les flèches et sélectionne avec OK — un menu
              déroulant navigateur n'est pas pilotable ainsi. Rangées
              compactes pour ne pas allonger le panneau. */}
          {hasMultipleAudio && (
            <section>
              <RowLabel>{t('player.audioTracks')}</RowLabel>
              <div className="flex flex-col gap-1">
                {audioTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    label={track.label}
                    selected={activeAudioId === track.id}
                    onSelect={() => onSelectAudio(track.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {hasSubtitles && hasMultipleSubtitleTracks && (
            <section>
              <RowLabel>{t('player.subtitleTracks')}</RowLabel>
              <div className="flex flex-col gap-1">
                <TrackRow
                  label={t('player.subtitlesOff')}
                  selected={activeSubtitleId === null}
                  onSelect={() => onSelectTrack(null)}
                />
                {subtitleTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    label={track.label}
                    selected={activeSubtitleId === track.id}
                    onSelect={() => onSelectTrack(track.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Grille 2×2 regroupant les quatre réglages segmentés : ça
              raccourcit le panneau et le rend quasi carré. Chaque cellule
              a le même gabarit (libellé au-dessus, contrôle pleine
              largeur) pour un alignement net et premium. */}
          {hasSubtitles && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <SettingCell label={t('player.subtitleSize')}>
                <Segmented<SubtitleSize>
                  value={appearance.size}
                  onChange={onSize}
                  options={[
                    { value: 'small', label: 'S' },
                    { value: 'medium', label: 'M' },
                    { value: 'large', label: 'L' },
                  ]}
                />
              </SettingCell>

              <SettingCell label={t('player.subtitlePosition')}>
                <Segmented<SubtitlePosition>
                  value={appearance.position}
                  onChange={onPosition}
                  options={[
                    { value: 'bottom', label: t('player.positionBottom') },
                    { value: 'middle', label: t('player.positionMiddle') },
                    { value: 'top', label: t('player.positionTop') },
                  ]}
                  compact
                />
              </SettingCell>

              <SettingCell label={t('player.subtitleBackground')}>
                <Segmented<SubtitleBackground>
                  value={appearance.background}
                  onChange={onBackground}
                  options={[
                    { value: 'none', label: t('player.backgroundNone') },
                    { value: 'translucent', label: t('player.backgroundTranslucent') },
                    { value: 'opaque', label: t('player.backgroundOpaque') },
                  ]}
                  compact
                />
              </SettingCell>

              <SettingCell label={t('player.subtitleFont')}>
                <Segmented<SubtitleFont>
                  value={appearance.font}
                  onChange={onFont}
                  options={fontOptions.map(({ value, letter }) => ({ value, label: letter }))}
                  optionFont={(value) => subtitleFontStack(value)}
                />
              </SettingCell>
            </div>
          )}

          {/* Aperçu réel de l'apparence, compact pour tenir dans un
              panneau carré. Reproduit exactement le rendu du calque :
              fond selon le réglage, ombre si aucun fond. */}
          {hasSubtitles && (
            <section>
              <RowLabel>{t('player.subtitlePreview')}</RowLabel>
              <div className="flex items-center">
                <span
                  style={{
                    color: '#fff',
                    fontFamily: subtitleFontStack(appearance.font),
                    fontSize: subtitleFontSize(appearance.size),
                    fontWeight: 500,
                    lineHeight: 1.3,
                    textAlign: 'left',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    whiteSpace: 'normal',
                    textShadow:
                      appearance.background === 'none'
                        ? '0 2px 4px rgba(0,0,0,0.85)'
                        : 'none',
                    backgroundColor: subtitleBackgroundCss(appearance.background),
                    borderRadius: appearance.background === 'none' ? 0 : 4,
                    padding: appearance.background === 'none' ? 0 : '2px 8px',
                  }}
                >
                  {t('player.subtitlePreviewText')}
                </span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Libellé de section (taille normale, minuscules, à gauche). */
function RowLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-sm font-medium text-white/85 mb-1.5">{children}</span>;
}

/** Cellule de grille : libellé au-dessus du contrôle segmenté. */
function SettingCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block text-sm font-medium text-white/85 mb-1.5 truncate">{label}</span>
      {children}
    </div>
  );
}

/** Piste à sélectionner quand on active l'interrupteur. */
function defaultTrackId(
  tracks: TrackController['subtitleTracks'],
  current: string | null
): string | null {
  if (current !== null && tracks.some((t) => t.id === current)) return current;
  return tracks[0]?.id ?? null;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  optionFont,
  compact,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  optionFont?: (value: T) => string;
  /** Diminue les libellés longs (ex. « Translucide ») pour tenir dans une demi-largeur. */
  compact?: boolean;
}) {
  return (
    <div className="flex rounded-lg bg-white/10 border border-white/10 overflow-hidden">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            style={optionFont ? { fontFamily: optionFont(option.value) } : undefined}
            className={cn(
              'px-2 py-1.5 font-medium transition-colors whitespace-nowrap leading-none h-8',
              compact ? 'text-[11px]' : 'text-sm',
              'flex-1 text-center flex items-center justify-center',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-inset',
              selected ? 'bg-accent text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Rangée de piste, bouton focusable à la télécommande (groupe radio). */
function TrackRow({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full flex items-center justify-between gap-3 rounded-lg px-3 h-9 text-sm text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        selected ? 'bg-accent/20 text-white' : 'bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
      )}
    >
      <span className="truncate">{label}</span>
      {selected && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
    </button>
  );
}
