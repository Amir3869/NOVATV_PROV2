'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAppStore, useActiveProfile } from '@/store/useAppStore';
import { PinEntryDialog } from '@/design-system/components/PinEntryDialog';
import { verifyPin, channelLockKey, categoryLockKey } from '@/lib/pin';
import { useTranslation } from '@/i18n';
import type { LiveCategory, LiveChannel } from '@/types';

/**
 * Fournisseur du verrou parental.
 *
 * ── Rôle ───────────────────────────────────────────────────────
 * Centralise la vérification du code PIN et le « déverrouillage de
 * session ». Un élément est bloqué s'il est dans `lockedItems` et que
 * le code n'a **pas** encore été validé (`sessionUnlocked`). Après une
 * saisie correcte, tout reste ouvert pour la session.
 *
 * ── Une seule fenêtre pour toute l'application ─────────────────
 * `ensureUnlocked` / `toggleLock` ouvrent la même `PinEntryDialog`,
 * rendue ici, au lieu que chaque carte instancie sa propre modale.
 * Cela évite deux fenêtres superposées et un code dupliqué.
 *
 * ── Qui peut déverrouiller ─────────────────────────────────────
 * Le code attendu est celui du profil **actif** (`pinHash`). Un profil
 * sans PIN ne peut pas déverrouiller : le verrou reste donc effectif
 * pour un profil enfant, qui n'a pas de code. C'est la règle « chaque
 * profil a son code ».
 *
 * ── Verrouiller exige aussi le code ─────────────────────────────
 * `toggleLock` passe par `ensureUnlocked` : un enfant ne peut pas
 * retirer un cadenas en cliquant simplement dessus.
 */
interface ParentalContextValue {
  /** L'élément est-il actuellement bloqué (verrouillé et non déverrouillé) ? */
  isItemBlocked: (key: string) => boolean;
  isChannelBlocked: (channel: LiveChannel) => boolean;
  isCategoryBlocked: (category: LiveCategory) => boolean;
  /** Le profil actif porte-t-il un code (sinon impossible de verrouiller) ? */
  hasPin: boolean;
  /** Demande le code (si besoin) puis renvoie `true` si déverrouillé. */
  ensureUnlocked: () => Promise<boolean>;
  /** Bascule un verrou, en passant d'abord par le code. */
  toggleLock: (key: string) => Promise<void>;
}

const ParentalContext = createContext<ParentalContextValue | null>(null);

export function ParentalProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const sessionUnlocked = useAppStore((s) => s.sessionUnlocked);
  const lockedItems = useAppStore((s) => s.lockedItems);
  const profile = useActiveProfile();

  const [request, setRequest] = useState<{ resolve: (ok: boolean) => void } | null>(null);

  const hasPin = Boolean(profile?.pinHash);

  // `ensureUnlocked` peut être appelé hors de toute interaction React
  // (depuis un lien, une carte) : on lit donc l'état courant via
  // `getState()` plutôt qu'une fermeture qui deviendrait fausse.
  const ensureUnlocked = useCallback(async (): Promise<boolean> => {
    if (useAppStore.getState().sessionUnlocked) return true;
    const state = useAppStore.getState();
    const current = state.profiles.find((p) => p.id === state.activeProfileId) ?? null;
    if (!current?.pinHash) {
      // Sans code sur le profil actif, rien à vérifier : le verrou
      // reste en place (un profil enfant n'a pas de code) et on prévient.
      toast.error(t('parental.noPin'));
      return false;
    }
    // Ouvre la fenêtre de code. La promesse se résout quand elle se
    // ferme (succès ou annulation).
    return new Promise<boolean>((resolve) => setRequest({ resolve }));
  }, [t]);

  const isItemBlocked = useCallback(
    (key: string) => lockedItems.includes(key) && !sessionUnlocked,
    [lockedItems, sessionUnlocked]
  );

  const isChannelBlocked = useCallback(
    (channel: LiveChannel) => isItemBlocked(channelLockKey(channel.id)),
    [isItemBlocked]
  );

  const isCategoryBlocked = useCallback(
    (category: LiveCategory) => isItemBlocked(categoryLockKey(category.playlistId, category.id)),
    [isItemBlocked]
  );

  // Après une saisie correcte : déverrouille la session et ferme.
  const handleVerify = useCallback(
    async (pin: string): Promise<boolean> => {
      const ok = await verifyPin(pin, useAppStore.getState().profiles.find(
        (p) => p.id === useAppStore.getState().activeProfileId
      )?.pinHash);
      if (ok) {
        useAppStore.getState().unlockSession();
        setRequest((r) => {
          r?.resolve(true);
          return null;
        });
        toast.success(t('parental.unlocked'));
      }
      return ok;
    },
    [t]
  );

  const handleCancel = useCallback(() => {
    setRequest((r) => {
      r?.resolve(false);
      return null;
    });
  }, []);

  const toggleLock = useCallback(
    async (key: string) => {
      // D'abord garantir le déverrouillage de session (le code est
      // exigé pour verrouiller aussi). Puis basculer le verrou.
      const unlocked = await ensureUnlocked();
      if (!unlocked) return;
      useAppStore.getState().toggleItemLocked(key);
    },
    [ensureUnlocked]
  );

  const value = useMemo<ParentalContextValue>(
    () => ({
      isItemBlocked,
      isChannelBlocked,
      isCategoryBlocked,
      hasPin,
      ensureUnlocked,
      toggleLock,
    }),
    [isItemBlocked, isChannelBlocked, isCategoryBlocked, hasPin, ensureUnlocked, toggleLock]
  );

  return (
    <ParentalContext.Provider value={value}>
      {children}
      <PinEntryDialog
        open={request !== null}
        title={t('parental.title')}
        subtitle={t('parental.subtitle')}
        onVerify={handleVerify}
        onCancel={handleCancel}
      />
    </ParentalContext.Provider>
  );
}

/** Accès au verrou depuis n'importe quelle carte ou panneau. */
export function useParental(): ParentalContextValue {
  const ctx = useContext(ParentalContext);
  if (!ctx) {
    throw new Error('useParental doit être utilisé sous <ParentalProvider>.');
  }
  return ctx;
}
