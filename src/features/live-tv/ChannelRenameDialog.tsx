'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/design-system/components/GlassCard';
import { useTranslation } from '@/i18n';

/**
 * Fenêtre de renommage d'une chaîne.
 *
 * Reprend le gabarit des autres fenêtres (voile plein écran, carte de
 * verre, champ unique, Annuler / action). La règle du champ vide est
 * la même que pour les catégories : un champ vidé (ou réduit à des
 * espaces) retire le surnom et rend la main au nom d'origine — le nom
 * réel appartient au catalogue et ne peut pas être supprimé d'ici.
 *
 * Le composant ne connaît ni le store ni le catalogue : il recueille un
 * nom et le rend via `onSubmit`.
 */
export function ChannelRenameDialog({
  initialName,
  onSubmit,
  onClose,
}: {
  /** Nom d'origine de la chaîne, pré-rempli dans le champ. */
  initialName: string;
  /** Appelé avec le nom saisi (possiblement vide, pour restaurer). */
  onSubmit: (name: string) => void;
  /** Appelé à la fermeture (Annuler, ou réussite). */
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);

  const handleSubmit = () => {
    onSubmit(name);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <GlassCard variant="dark" padding="lg" className="w-full max-w-sm">
        <h2 className="text-lg font-bold text-white mb-5">
          {t('liveTV.renameChannel')}
        </h2>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">
            {t('liveTV.channelName')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={initialName}
            maxLength={40}
            autoFocus
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent/50 transition-all"
          />
          <p className="text-xs text-white/30 mt-2 leading-relaxed">
            {t('liveTV.channelRenameHint')}
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/60 hover:bg-white/10 transition-all"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            {t('common.save')}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
