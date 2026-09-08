'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '@/i18n';

/**
 * Champ mot de passe avec un œil pour l'afficher.
 *
 * L'œil ne chiffre rien : le secret Xtream est déjà en clair dans
 * `secureStore` (localStorage) en v1. Il évite seulement de se tromper
 * de caractère à la saisie.
 */
export function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete = 'current-password',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className="w-full px-4 py-3 pe-12 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 focus:bg-white/7 transition-all disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-pressed={visible}
        aria-label={visible ? t('common.hidePassword') : t('common.showPassword')}
        className="absolute end-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-white/40 hover:text-white disabled:opacity-40"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
