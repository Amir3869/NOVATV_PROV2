'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/i18n';

const subscribeNoop = () => () => {};

export const SLEEP_MINUTES = [15, 30, 45, 60] as const;
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

function useMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

function useMenuKeys(onClose: () => void, panelRef: React.RefObject<HTMLDivElement | null>) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
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
  }, [onClose, panelRef]);
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useMenuKeys(onClose, panelRef);

  return createPortal(
    <div
      className="cinema fixed inset-0 z-[300] flex items-center justify-center bg-black/70 px-3"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-black border border-white/10 shadow-2xl overflow-hidden px-3 py-3"
      >
        <h2 className="font-bold text-white text-sm px-2 pb-2">{title}</h2>
        {children}
      </div>
    </div>,
    document.body
  );
}

function Row({
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
        'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        selected ? 'bg-accent/15 text-white font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white'
      )}
    >
      <span className="truncate">{label}</span>
      {selected && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
    </button>
  );
}

export function SleepMenu({
  remainingSeconds,
  onSelectMinutes,
  onClose,
}: {
  remainingSeconds: number | null;
  onSelectMinutes: (minutes: number | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const mounted = useMounted();
  if (!mounted) return null;

  return (
    <Sheet title={t('player.sleepTitle')} onClose={onClose}>
      <ul className="space-y-0.5">
        <li>
          <Row
            label={t('player.sleepOff')}
            selected={remainingSeconds === null}
            onSelect={() => {
              onSelectMinutes(null);
              onClose();
            }}
          />
        </li>
        {SLEEP_MINUTES.map((minutes) => (
          <li key={minutes}>
            <Row
              label={t('player.sleepMinutes', { count: minutes })}
              selected={false}
              onSelect={() => {
                onSelectMinutes(minutes);
                onClose();
              }}
            />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function SpeedMenu({
  current,
  onSelect,
  onClose,
}: {
  current: number;
  onSelect: (rate: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const mounted = useMounted();
  if (!mounted) return null;

  return (
    <Sheet title={t('player.speedTitle')} onClose={onClose}>
      <ul className="space-y-0.5">
        {PLAYBACK_RATES.map((rate) => (
          <li key={rate}>
            <Row
              label={t('player.speedValue', { rate: String(rate).replace('.', ',') })}
              selected={current === rate}
              onSelect={() => {
                onSelect(rate);
                onClose();
              }}
            />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
