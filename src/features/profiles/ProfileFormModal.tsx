'use client';

import React, { useState } from 'react';
import { Check, Lock, Shield } from 'lucide-react';
import { cn } from '@/utils/cn';
import { AvatarPicker } from './AvatarPicker';
import { GlassCard } from '@/design-system/components/GlassCard';
import { hashPin } from '@/lib/pin';
import type { AvatarId } from '@/types';
import { useTranslation } from '@/i18n';

/**
 * Valeurs validées par la fenêtre à la soumission.
 */
export interface ProfileFormValues {
  name: string;
  avatarId: AvatarId;
  isKidsProfile: boolean;
  /** Empreinte du code PIN (déjà hachée, jamais le code en clair). */
  pinHash?: string;
}

/**
 * Fenêtre commune « Nouveau profil » / « Modifier le profil ».
 *
 * ── Pourquoi une seule fenêtre pour les deux ──
 * Les deux actions présentent exactement le même formulaire à l'écran :
 * un champ Nom, la grille d'avatars, l'interrupteur « Profil enfant »,
 * puis Annuler / action (Créer ou Enregistrer). Le croquis validé le
 * précise pour la fenêtre de modification : « exactement la même fenêtre
 * que la création, champs pré-remplis ». On ne duplique donc pas deux
 * fois ce formulaire — on ne veut pas que les deux versions divergent un
 * jour. Ce composant est unique ; les deux écrans ne diffèrent que par
 * leurs valeurs initiales, leur titre et ce que fait le bouton d'action.
 *
 * Le composant ne connaît ni le store ni la création d'identifiant : il
 * ne fait que recueillir des valeurs et les rendre à l'appelant via
 * `onSubmit`. C'est ce qui permet de le réutiliser pour Créer comme pour
 * Modifier sans se soucier de ce que chacun doit faire ensuite.
 */
export function ProfileFormModal({
  title,
  submitLabel,
  initialName,
  initialAvatarId,
  initialIsKids,
  onSubmit,
  onClose,
}: {
  /** Titre de la fenêtre : « Nouveau profil » ou « Modifier le profil ». */
  title: string;
  /** Libellé du bouton d'action : « Créer » ou « Enregistrer ». */
  submitLabel: string;
  /** Nom pré-rempli (vide à la création, celui du profil à la modification). */
  initialName: string;
  /** Avatar pré-sélectionné dans la grille. */
  initialAvatarId: AvatarId;
  /** Interrupteur « Profil enfant » pré-règlé. */
  initialIsKids: boolean;
  /** Empreinte d'un code déjà défini (édition), `undefined` à la création. */
  initialPinHash?: string;
  /** Appelé avec les valeurs validées lors du clic sur le bouton d'action. */
  onSubmit: (values: ProfileFormValues) => void;
  /** Appelé lors de la fermeture (Annuler, ou réussite). */
  onClose: () => void;
}) {
  const { t } = useTranslation();

  // Le formulaire vit en état local. Comme la fenêtre n'est montée que
  // le temps d'une action (création ou modification), ses valeurs
  // initiales ne sont lues qu'à l'ouverture — pas de synchronisation à
  // faire ensuite : si l'on ferme et rouvre, le composant est recréé.
  const [name, setName] = useState(initialName);
  const [avatarId, setAvatarId] = useState<AvatarId>(initialAvatarId);
  const [isKids, setIsKids] = useState(initialIsKids);
  // Code PIN optionnel (4 chiffres). Jamais conservé en clair : on ne
  // stocke que l'empreinte dérivée (PBKDF2) et on vide la saisie.
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  const canSubmit = name.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    // Le hachage est asynchrone (PBKDF2 via Web Crypto) : on l'attend
    // avant de remettre les valeurs, qui ne portent jamais le code en
    // clair, seulement l'empreinte. Champ vide → aucun code.
    const pinHash = pin ? await hashPin(pin) : undefined;
    onSubmit({
      name: name.trim(),
      avatarId,
      isKidsProfile: isKids,
      pinHash,
    });
    // Ne pas conserver le code en mémoire au-delà de la soumission.
    setPin('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <GlassCard variant="dark" padding="lg" className="w-full max-w-sm">
        <h2 className="text-lg font-bold text-white mb-5">{title}</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">{t('common.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profiles.firstName')}
              maxLength={20}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-accent/50 transition-all"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-2">{t('profiles.avatar')}</label>
            <AvatarPicker value={avatarId} onChange={setAvatarId} />
          </div>

          <button
            type="button"
            aria-pressed={isKids}
            onClick={() => setIsKids(!isKids)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl border transition-all',
              isKids ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/3 border-white/8 hover:bg-white/5'
            )}
          >
            <Shield className={cn('w-4 h-4', isKids ? 'text-emerald-400' : 'text-white/40')} />
            <div className="text-left flex-1">
              <p className={cn('text-sm font-medium', isKids ? 'text-emerald-400' : 'text-white/70')}>{t('profiles.kidsProfile')}</p>
              <p className="text-xs text-white/30">{t('profiles.kidsContent')}</p>
            </div>
            <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center transition-all', isKids ? 'bg-emerald-500 border-emerald-500' : 'border-white/20')}>
              {isKids && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
          </button>
        </div>

        <div className="mt-4">
          <label className="text-xs text-white/50 uppercase tracking-wider font-medium block mb-1.5">
            {t('profiles.pinLabel')}
          </label>
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border px-4 py-3 transition-all',
              pinError ? 'border-red-500/60' : 'border-white/10 focus-within:border-white/25'
            )}
          >
            <Lock className="w-4 h-4 text-white/40 flex-shrink-0" />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder={t('profiles.pinPlaceholder')}
              value={pin}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(digits);
                setPinError(digits.length === 4 && !/^\d{4}$/.test(digits));
              }}
              className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none tracking-[0.5em]"
            />
            {pin.length === 4 && (
              <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-white/30 mt-1.5">{t('profiles.pinHint')}</p>
          {pinError && (
            <p className="text-[11px] text-red-400 mt-1">{t('profiles.pinError')}</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/60 hover:bg-white/10 transition-all">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
