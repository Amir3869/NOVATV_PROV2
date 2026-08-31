'use client';

import React, { useState } from 'react';
import { AppDialog } from '@/design-system/components/AppDialog';
import { useTranslation } from '@/i18n';

/**
 * Fenêtre de renommage d'une chaîne.
 *
 * Même gabarit que `CategoryRenameDialog`. Portail centré : sans lui,
 * le pop-up restait coincé dans la carte de verre, en bas de l'écran.
 */
export function ChannelRenameDialog({
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
      title={t('liveTV.renameChannel')}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-11 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/60 hover:bg-white/10 transition-all"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 min-h-11 py-2.5 rounded-xl bg-accent text-white on-accent text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            {t('common.save')}
          </button>
        </div>
      }
    >
      <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">
        {t('liveTV.channelName')}
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={initialName}
        maxLength={40}
        className="w-full min-h-11 px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent/50 transition-all"
      />
      <p className="text-xs text-white/30 mt-2 leading-relaxed">{t('liveTV.channelRenameHint')}</p>
    </AppDialog>
  );
}
