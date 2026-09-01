'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Lock, Delete } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/i18n';
import { AppDialog } from './AppDialog';

export function PinEntryDialog({
  open,
  title,
  subtitle,
  onVerify,
  onCancel,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onVerify: (pin: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const previousOpen = useRef(open);

  useEffect(() => {
    if (open && !previousOpen.current) {
      setValue('');
      setError(false);
      setBusy(false);
    }
    previousOpen.current = open;
  }, [open]);

  const press = async (digit: string) => {
    if (busy) return;
    if (value.length >= 4) return;
    const next = value + digit;
    setValue(next);
    setError(false);
    if (next.length === 4) {
      setBusy(true);
      const ok = await onVerify(next);
      setBusy(false);
      if (!ok) {
        setValue('');
        setError(true);
      }
    }
  };

  const backspace = () => {
    if (busy) return;
    setValue(value.slice(0, -1));
    setError(false);
  };

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      title={title}
      description={subtitle}
      size="xs"
      busy={busy}
      closeOnOverlay={false}
    >
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-accent/15 flex items-center justify-center">
          <Lock className="w-5 h-5 text-accent" />
        </div>

        <div className="flex justify-center gap-4 my-6" aria-label={t('parental.codeProgress')}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                'w-3.5 h-3.5 rounded-full border-2 transition-all',
                i < value.length
                  ? 'bg-white border-white'
                  : i === value.length && error
                    ? 'border-accent animate-pulse'
                    : 'border-white/25',
              )}
            />
          ))}
        </div>

        <p role="alert" className={cn('text-xs text-accent mb-3 h-4', error ? '' : 'invisible')}>
          {t('parental.wrongCode')}
        </p>

        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => press(d)}
              disabled={busy}
              className="min-h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white text-lg font-bold transition-colors disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <span />
          <button
            type="button"
            onClick={() => press('0')}
            disabled={busy}
            className="min-h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white text-lg font-bold transition-colors disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={backspace}
            disabled={busy || value.length === 0}
            aria-label={t('common.erase')}
            className="min-h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="mt-4 min-h-11 text-xs text-white/40 hover:text-white underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
      </div>
    </AppDialog>
  );
}
