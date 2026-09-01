'use client';

import React, { useState } from 'react';
import { Lock, Pencil, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/store/useAppStore';
import { categoryDisplayName } from '@/lib/displayNames';
import { CategoryRenameDialog } from './CategoryRenameDialog';
import { useParental } from '@/features/parental/ParentalProvider';
import { categoryLockKey } from '@/lib/pin';
import type { LiveCategory } from '@/types';
import { useTranslation } from '@/i18n';

/**
 * Liste de renommage des catégories. Le titre est celui de la fenêtre
 * parente (`AppDialog`) : ce composant n'affiche que les lignes.
 */
export function CategoryRenamePanel({
  categories,
}: {
  categories: LiveCategory[];
  title: string;
  hint: string;
}) {
  const { t } = useTranslation();
  const renames = useAppStore((s) => s.categoryRenames);
  const renameCategory = useAppStore((s) => s.renameCategory);
  const lockedItems = useAppStore((s) => s.lockedItems);
  const { toggleLock } = useParental();
  const [editing, setEditing] = useState<LiveCategory | null>(null);

  const handleRename = (categoryId: string, name: string) => {
    renameCategory(categoryId, name);
    const original = categories.find((c) => c.id === categoryId);
    if (name.trim()) {
      toast.success(t('liveTV.renamedCategory', { name: name.trim() }));
    } else if (original) {
      toast.success(t('liveTV.restoredCategory', { name: original.name }));
    }
  };

  if (categories.length === 0) {
    return <p className="text-sm text-white/40">{t('liveTV.noCategories')}</p>;
  }

  return (
    <>
      <ul className="divide-y divide-white/5">
        {categories.map((cat) => {
          const display = categoryDisplayName(cat.id, cat.name, renames);
          const isRenamed = display !== cat.name;
          const lockKey = categoryLockKey(cat.playlistId, cat.id);
          const isLocked = lockedItems.includes(lockKey);
          return (
            <li key={cat.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium truncate',
                    isRenamed ? 'text-white' : 'text-white/85',
                    isLocked && 'opacity-60'
                  )}
                >
                  {display}
                </p>
                <p className="text-xs text-white/35">
                  {t('liveTV.categoryChannelCount', { count: cat.channelCount })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => toggleLock(lockKey)}
                aria-label={isLocked ? t('parental.unlock') : t('parental.lock')}
                aria-pressed={isLocked}
                title={isLocked ? t('parental.unlock') : t('parental.lock')}
                className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
                  isLocked
                    ? 'bg-accent/15 text-accent hover:bg-accent/25'
                    : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white'
                )}
              >
                <Lock className="w-4 h-4" />
              </button>

              {isRenamed && (
                <button
                  type="button"
                  onClick={() => handleRename(cat.id, '')}
                  aria-label={t('liveTV.restoreCategoryName')}
                  title={t('liveTV.restoreCategoryName')}
                  className="w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setEditing(cat)}
                aria-label={t('liveTV.renameCategory')}
                className="w-11 h-11 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ul>

      {editing && (
        <CategoryRenameDialog
          initialName={categoryDisplayName(editing.id, editing.name, renames)}
          onSubmit={(name) => handleRename(editing.id, name)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
