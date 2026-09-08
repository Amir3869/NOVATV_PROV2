'use client';

/**
 * Overlay d'import : une ligne par famille, spinner puis coche verte,
 * puis « Source ajoutée ».
 */

import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useTranslation, type MessageKey } from '@/i18n';
import { cn } from '@/utils/cn';
import type { CategoryKind, CategorySelection } from '@/services/xtream/categorySelection';
import type { SyncStep } from '@/services/xtream/xtreamSync';
import {
  authStatus,
  selectedSyncGroups,
  syncGroupStatus,
  type SyncGroupStatus,
} from '@/services/xtream/syncProgress';

const GROUP_LABEL: Record<CategoryKind, MessageKey> = {
  live: 'playlists.categoriesLive',
  vod: 'playlists.categoriesVod',
  series: 'playlists.categoriesSeries',
};

function StatusIcon({ status }: { status: SyncGroupStatus }) {
  if (status === 'done') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
        <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8">
        <Loader2 className="h-4 w-4 animate-spin text-white/80" aria-hidden="true" />
      </span>
    );
  }
  return <span className="h-8 w-8 rounded-full border border-white/15" aria-hidden="true" />;
}

export function SyncProgress({
  step,
  selection,
}: {
  step: SyncStep | null;
  selection: CategorySelection;
}) {
  const { t } = useTranslation();
  const groups = selectedSyncGroups(selection);
  const auth = authStatus(step);
  const finished = step === 'done';

  return (
    <div className="flex flex-col gap-3 py-2" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <StatusIcon status={auth} />
        <p className={cn('text-sm', auth === 'pending' ? 'text-white/35' : 'text-white/85')}>
          {t('playlists.stepAuth')}
        </p>
      </div>

      {groups.map((group) => {
        const status = syncGroupStatus(step, group);
        return (
          <div key={group} className="flex items-center gap-3">
            <StatusIcon status={status} />
            <p className={cn('text-sm', status === 'pending' ? 'text-white/35' : 'text-white/85')}>
              {t(GROUP_LABEL[group])}
            </p>
          </div>
        );
      })}

      {finished && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
            <Check className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-emerald-400">{t('onboarding.sourceAdded')}</p>
        </div>
      )}
    </div>
  );
}
