'use client';

import React, { useState } from 'react';
import { AppDialog } from '@/design-system/components/AppDialog';
import { useTranslation } from '@/i18n';

/**
 * Fenêtre de renommage d'une catégorie.
 *
 * Portail centré via AppDialog : sans lui, le pop-up restait coincé
 * dans la carte de verre (backdrop-blur), en bas de l'écran.
 */
export function CategoryRenameDialog({
  initialName,
  onSubmit,
  onClose,
}: {
  initialName: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);

  const handleSubmit = () => {
    onSubmit(name);
    onClose();
  };

  return (
    <AppDialog
      open
      onClose={onClose}
      title={t('liveTV.renameCategory')}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/8 bg-white/5 py-2.5 text-sm text-white/60 transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent py-2.5 text-sm font-semibold text-white on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t('common.save')}
          </button>
        </div>
      }
    >
      <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">
        {t('liveTV.categoryName')}
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={initialName}
        maxLength={40}
        className="w-full min-h-11 rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 transition-all focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/40"
      />
      <p className="text-xs text-white/30 mt-2 leading-relaxed">{t('liveTV.categoryRenameHint')}</p>
    </AppDialog>
  );
}
