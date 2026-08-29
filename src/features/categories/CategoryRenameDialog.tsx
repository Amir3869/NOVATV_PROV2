'use client';

import React, { useState } from 'react';
import { GlassCard } from '@/design-system/components/GlassCard';
import { useTranslation } from '@/i18n';

/**
 * Fenêtre de renommage d'une catégorie.
 *
 * Partagée entre la page TV en direct et la page Sources : reprend le
 * gabarit de `ProfileFormModal` (voile plein écran, carte de verre,
 * champ unique, Annuler / action) pour ne pas donner l'impression de
 * changer d'application entre deux écrans.
 *
 * ── La règle du champ vide ─────────────────────────────────────────
 * Le surnom vit hors du catalogue et ne sert qu'à l'affichage. Un champ
 * vidé (ou réduit à des espaces) retire donc le surnom et rend la main
 * au nom d'origine : c'est le moyen simple de « restaurer » sans bouton
 * supplémentaire. C'est aussi ce qui garantit qu'on ne peut pas
 * supprimer le nom réel, qui appartient au catalogue.
 *
 * Le composant ne connaît ni le store ni le catalogue : il recueille un
 * nom et le rend via `onSubmit`, comme `ProfileFormModal` recueille des
 * valeurs sans savoir ce que l'appelant en fera.
 */
export function CategoryRenameDialog({
  initialName,
  onSubmit,
  onClose,
}: {
  /** Nom d'origine de la catégorie, pré-rempli dans le champ. */
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
          {t('liveTV.renameCategory')}
        </h2>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">
            {t('liveTV.categoryName')}
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
            {t('liveTV.categoryRenameHint')}
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
