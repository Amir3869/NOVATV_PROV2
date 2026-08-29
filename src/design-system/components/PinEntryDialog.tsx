'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Lock, Delete } from 'lucide-react';
import { cn } from '@/utils/cn';
import { GlassCard } from './GlassCard';

/**
 * Fenêtre de saisie du code PIN parental.
 *
 * ── Contrat ────────────────────────────────────────────────────
 * Le composant est volontairement muet sur la suite : il recueille un
 * code de 4 chiffres, l'envoie à `onVerify`, et affiche un message
 * d'erreur si `onVerify` renvoie `false`. Il ne connaît ni le profil
 * ni le hachage — le parent d'appel (le fournisseur `ParentalProvider`)
 * s'occupe de vérifier contre `pinHash` du profil actif.
 *
 * ── Pourquoi un clavier numérique et non un champ texte ─────────
 * La cible est un téléviseur (télécommande). Un clavier en grille
 * donne un cible de focus simple et prévisible ; un `<input>` masqué
 * (type `password`) rendrait la saisie au doigt plus pénible et ne
 * montrerait pas la progression du code. Les points du haut reflètent
 * la saisie en cours, en plus de l'accessibilité.
 *
 * ── Remise à zéro ──────────────────────────────────────────────
 * À chaque ouverture (`open` passe à `true`), le code saisi et le
 * message d'erreur sont effacés : deux tentatives successives ne
 * doivent pas hériter de la saisie de la première.
 */
export function PinEntryDialog({
  open,
  title,
  subtitle,
  onVerify,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** Précision sur quel profil/protection demande le code. */
  subtitle?: string;
  /** Vérifie le code ; doit renvoyer `true` pour fermer en succès. */
  onVerify: (pin: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const previousOpen = useRef(open);

  // Remise à zéro à la (ré)ouverture.
  useEffect(() => {
    if (open && !previousOpen.current) {
      setValue('');
      setError(false);
      setBusy(false);
    }
    previousOpen.current = open;
  }, [open]);

  if (!open) return null;

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <GlassCard variant="dark" padding="lg" className="w-full max-w-xs text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-accent/15 flex items-center justify-center">
          <Lock className="w-5 h-5 text-accent" />
        </div>
        <h2 className="text-base font-bold text-white">{title}</h2>
        {subtitle && (
          <p className="text-xs text-white/50 mt-1 leading-relaxed">{subtitle}</p>
        )}

        {/* Points de progression */}
        <div className="flex justify-center gap-4 my-6" aria-label="Code saisi">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                'w-3.5 h-3.5 rounded-full border-2 transition-all',
                i < value.length
                  ? 'bg-white border-white'
                  : i === value.length && error
                    ? 'border-accent animate-pulse'
                    : 'border-white/25'
              )}
            />
          ))}
        </div>

        <p
          role="alert"
          className={cn('text-xs text-accent mb-3 h-4', error ? '' : 'invisible')}
        >
          Code incorrect — réessaie.
        </p>

        {/* Clavier 1-9, puis vide/0/effacement */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => press(d)}
              disabled={busy}
              className="h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white text-lg font-bold transition-colors disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <span />
          <button
            type="button"
            onClick={() => press('0')}
            disabled={busy}
            className="h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white text-lg font-bold transition-colors disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={backspace}
            disabled={busy || value.length === 0}
            aria-label="Effacer"
            className="h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="mt-4 text-xs text-white/40 hover:text-white underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
      </GlassCard>
    </div>
  );
}
