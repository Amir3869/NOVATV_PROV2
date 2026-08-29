'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/i18n';
import type { Favorite } from '@/types';

/**
 * Sélecteur « Ajouter à une liste ».
 *
 * Reprend le même squelette que ConfirmDialog — piège à focus, Échap,
 * restitution du focus — mais avec une liste de choix au lieu de deux
 * boutons. Les deux ne sont pas fusionnés : ConfirmDialog pose une
 * question fermée, celui-ci en pose une ouverte, et les mélanger
 * donnerait un composant à rallonge dont la moitié des propriétés
 * seraient inutilisées à chaque appel.
 */

/** Éléments qui peuvent recevoir le focus, pour le piège à focus. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface AddToListDialogProps {
  open: boolean;
  mediaId: string;
  mediaType: Favorite['mediaType'];
  onClose: () => void;
}

export function AddToListDialog({ open, mediaId, mediaType, onClose }: AddToListDialogProps) {
  const { t } = useTranslation();
  const customLists = useAppStore((s) => s.customLists);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const addToList = useAppStore((s) => s.addToList);

  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Seules les listes du profil courant. Les listes d'un autre profil ne
  // doivent pas apparaître : chacun a les siennes, c'est tout l'intérêt.
  const lists = customLists.filter((l) => l.profileId === activeProfileId);

  useEffect(() => {
    if (!open) return;

    // On retient le bouton qui a ouvert la fenêtre pour lui rendre le
    // focus à la fermeture. Sans cela, le focus repart au début de la
    // page : à la télécommande, l'utilisateur se retrouve perdu en haut
    // de l'écran après avoir simplement fermé une fenêtre.
    previousFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // Piège à focus : la tabulation tourne en boucle dans la fenêtre.
      // Sans lui, le focus file dans la page du dessous, invisible, et
      // l'application paraît bloquée.
      const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const handlePick = (listId: string, listName: string, alreadyIn: boolean) => {
    // Ajouter deux fois le même film ferait une ligne en double dans la
    // liste, sans aucun moyen de distinguer les deux.
    if (alreadyIn) {
      toast(t('lists.alreadyIn'));
      onClose();
      return;
    }
    addToList(listId, mediaId, mediaType);
    toast.success(t('lists.addedTo', { name: listName }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-list-title"
        className="relative w-full max-w-sm rounded-2xl bg-surface-2 border border-white/10 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h2 id="add-to-list-title" className="text-sm font-bold text-white">
            {t('lists.addToTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {lists.length === 0 ? (
          // Aucune liste : proposer d'aller en créer une plutôt que
          // d'afficher un cadre vide sans issue.
          <div className="p-6 space-y-4 text-center">
            <p className="text-sm text-white/60 leading-relaxed">{t('lists.addToNone')}</p>
            <Link
              href="/lists"
              className="inline-block px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              {t('lists.addToGo')}
            </Link>
          </div>
        ) : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-white/5">
            {lists.map((list) => {
              const alreadyIn = list.items.some((item) => item.mediaId === mediaId);
              return (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(list.id, list.name, alreadyIn)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5',
                      alreadyIn && 'opacity-50'
                    )}
                  >
                    <span className="text-lg">{list.icon || '📋'}</span>
                    <span className="flex-1 min-w-0 text-sm text-white truncate">{list.name}</span>
                    {alreadyIn && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
