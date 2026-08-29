'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, Check, Shield, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Avatar } from '@/design-system/components/Avatar';
import { NovaLogo } from '@/design-system/components/NovaLogo';
import { ProfileFormModal } from './ProfileFormModal';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { Skeleton } from '@/design-system/components/LoadingSkeleton';
import { AVATARS } from '@/services/profiles/avatars';
import type { AvatarId } from '@/types';
import { useTranslation } from '@/i18n';

// L'avatar est désormais rendu par `Avatar` (design-system). L'ancien
// composant local dessinait l'initiale sur un dégradé choisi d'après
// le dernier caractère de l'identifiant du profil — une règle qui
// n'existait qu'ici, d'où le même profil vert sur cet écran et rouge
// dans le menu latéral.

export function ProfilesPage() {
  const { t } = useTranslation();
  const profiles = useAppStore((s) => s.profiles);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);
  const addProfile = useAppStore((s) => s.addProfile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const deleteProfile = useAppStore((s) => s.deleteProfile);
  const [showCreate, setShowCreate] = useState(false);
  // Identifie le profil en cours de modification. Le bouton crayon
  // l'écrit ; la fenêtre « Modifier le profil » le lit. Sans lecture,
  // le bouton ne faisait rien — voir l'étape 3.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Voir useHydrated : sans ce garde, l'écran « Qui regarde ? » s'affiche
  // un instant sans aucun profil, comme si tous avaient été effacés.
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-8">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-7 w-48" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <Skeleton className="w-20 h-20" rounded />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Le profil associé au crayon en cours. S'il a été supprimé entre-temps
  // (improbable mais possible), on n'affiche simplement pas la fenêtre.
  const editingProfile = editingId ? profiles.find((p) => p.id === editingId) : undefined;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-8">
        {/* Logo */}
        <div className="text-center">
          <NovaLogo variant="full" size="lg" className="inline-flex mb-4" />
          <h1 className="text-2xl font-black text-white">{t('profiles.whoIsWatching')}</h1>
          <p className="text-sm text-white/40 mt-1">{t('profiles.selectProfile')}</p>
        </div>

        {/* Profile grid */}
        <div className={cn('grid gap-4', profiles.length <= 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {profiles.map((profile) => (
            // Les boutons Modifier/Supprimer sont des freres du bouton de
            // selection, pas ses enfants : un <button> imbrique dans un
            // <button> est du HTML invalide (erreur d'hydratation React) et
            // le clic sur le bouton interieur declenche aussi celui du
            // parent. Le conteneur porte la classe `group` pour que le
            // survol et le focus continuent de reveler les actions.
            <div
              key={profile.id}
              className={cn(
                'group relative rounded-2xl border-2 transition-all duration-200',
                activeProfileId === profile.id
                  ? 'border-accent bg-accent/10'
                  : 'border-white/5 bg-white/3 hover:border-white/15 hover:bg-white/6'
              )}
            >
            <button
              type="button"
              onClick={() => setActiveProfile(profile.id)}
              aria-label={t('profiles.selectProfileNamed', { name: profile.name })}
              className="w-full flex flex-col items-center gap-3 p-4 rounded-2xl"
            >
              <div className="relative">
                <Avatar profile={profile} size="lg" />
                {activeProfileId === profile.id && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center border-2 border-surface-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                {profile.isKidsProfile && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-surface-0">
                    <Shield className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="text-sm font-semibold text-white leading-tight">{profile.name}</p>
                {profile.isKidsProfile && <p className="text-xs text-emerald-400 mt-0.5">{t('profiles.kid')}</p>}
              </div>

            </button>

              {/* Actions : freres du bouton de selection */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => setEditingId(profile.id)}
                  aria-label={t('profiles.editProfileNamed', { name: profile.name })}
                  className="w-6 h-6 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white focus-visible:opacity-100 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteProfile(profile.id)}
                    aria-label={t('profiles.deleteProfileNamed', { name: profile.name })}
                    className="w-6 h-6 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/40 hover:text-red-400 focus-visible:opacity-100 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add profile button */}
          {profiles.length < 5 && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-white/10 text-white/30 hover:border-white/20 hover:text-white/50 hover:bg-white/3 transition-all"
            >
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                <Plus className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium">{t('common.add')}</p>
            </button>
          )}
        </div>

        {/* Confirm button */}
        {activeProfileId && (
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 py-4 bg-accent hover:bg-accent-hover text-white font-bold text-base rounded-2xl transition-colors shadow-lg shadow-red-900/20"
          >
            {t('common.continue')}
            <ChevronRight className="w-5 h-5" />
          </Link>
        )}

        {/* Create Profile Modal */}
        {showCreate && (
          <ProfileFormModal
            title={t('profiles.newProfile')}
            submitLabel={t('common.create')}
            initialName=""
            initialAvatarId={defaultAvatarId}
            initialIsKids={false}
            onSubmit={(values) => {
              const id = `profile-${Date.now()}`;
              const now = new Date().toISOString();
              addProfile({
                id,
                name: values.name,
                avatarId: values.avatarId,
                isKidsProfile: values.isKidsProfile,
                // Code parental : l'empreinte hachée remonte telle quelle
                // (jamais le code en clair). Vide → pas de code.
                pinHash: values.pinHash,
                language: 'fr',
                audioLanguage: 'fr',
                createdAt: now,
                updatedAt: now,
              });
            }}
            onClose={() => setShowCreate(false)}
          />
        )}

        {/* Edit Profile Modal — réparé (étape 3). Même formulaire que la
            création, valeurs pré-remplies, bouton « Enregistrer ». */}
        {editingProfile && (
          <ProfileFormModal
            title={t('profiles.editProfile')}
            submitLabel={t('common.save')}
            initialName={editingProfile.name}
            initialAvatarId={editingProfile.avatarId}
            initialIsKids={editingProfile.isKidsProfile}
            initialPinHash={editingProfile.pinHash}
            onSubmit={(values) => {
              updateProfile(editingProfile.id, {
                name: values.name,
                avatarId: values.avatarId,
                isKidsProfile: values.isKidsProfile,
                pinHash: values.pinHash,
                updatedAt: new Date().toISOString(),
              });
            }}
            onClose={() => setEditingId(null)}
          />
        )}
      </div>
    </div>
  );
}

// Avatar proposé par défaut à l'ouverture de la fenêtre de création.
// On ne connaît pas encore l'identifiant du futur profil (il n'est
// forgé qu'à la validation), donc on pose l'avatar adapté aux enfants
// le plus en tête de galerie. L'utilisateur garde le dernier mot avec
// la grille. À la modification, la valeur vient du profil et n'utilise
// donc pas cette constante.
const defaultAvatarId: AvatarId = AVATARS.find((a) => a.kidFriendly)?.id ?? AVATARS[0].id;
