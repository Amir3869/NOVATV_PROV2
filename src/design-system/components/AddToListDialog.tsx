'use client';

import React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/i18n';
import type { Favorite } from '@/types';
import { AppDialog } from './AppDialog';

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

  const lists = customLists.filter((l) => l.profileId === activeProfileId);

  const handlePick = (listId: string, listName: string, alreadyIn: boolean) => {
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
    <AppDialog open={open} onClose={onClose} title={t('lists.addToTitle')}>
      {lists.length === 0 ? (
        <div className="space-y-4 text-center py-2">
          <p className="text-sm text-white/60 leading-relaxed">{t('lists.addToNone')}</p>
          <Link
            href="/lists"
            className="inline-flex min-h-11 items-center justify-center px-4 py-2.5 rounded-xl bg-accent text-white on-accent text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            {t('lists.addToGo')}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/5 -mx-2">
          {lists.map((list) => {
            const alreadyIn = list.items.some((item) => item.mediaId === mediaId);
            return (
              <li key={list.id}>
                <button
                  type="button"
                  onClick={() => handlePick(list.id, list.name, alreadyIn)}
                  className={cn(
                    'w-full flex items-center gap-3 min-h-11 px-3 py-3 text-left rounded-xl transition-colors hover:bg-white/5',
                    alreadyIn && 'opacity-50',
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
    </AppDialog>
  );
}
