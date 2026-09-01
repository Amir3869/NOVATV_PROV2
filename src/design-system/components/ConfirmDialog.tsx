'use client';

import React from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/utils/cn';
import { AppDialog } from './AppDialog';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Conséquence concrète de l'action, en une phrase. */
  message: string;
  /** Précision secondaire : ce qui sera effacé, ce qui est conservé. */
  detail?: string;
  confirmLabel: string;
  /** Rouge pour une suppression, accent pour une action ordinaire. */
  tone?: 'danger' | 'default';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel,
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      role="alertdialog"
      busy={busy}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 min-h-11 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'flex-1 min-h-11 px-4 py-2.5 rounded-xl text-sm font-semibold text-white on-accent transition-colors disabled:opacity-40',
              tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-accent hover:bg-accent-hover',
            )}
          >
            {busy ? t('common.loading') : confirmLabel}
          </button>
        </div>
      }
    >
      {detail ? <p className="text-xs text-white/40 leading-relaxed">{detail}</p> : null}
    </AppDialog>
  );
}
