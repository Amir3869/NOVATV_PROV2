/**
 * État visuel de l'import Xtream (spinner / vert), dérivé de l'étape
 * technique `SyncStep`. Pur : testable sans React.
 */

import type { CategoryKind, CategorySelection } from './categorySelection';
import type { SyncStep } from './xtreamSync';

export type SyncGroupStatus = 'pending' | 'active' | 'done';

const STEP_INDEX: Record<SyncStep, number> = {
  auth: 0,
  live_categories: 1,
  live_streams: 2,
  vod_categories: 3,
  vod_streams: 4,
  series_categories: 5,
  series: 6,
  done: 7,
};

/** Bornes d'index [début, fin] pendant lesquelles le groupe est « en cours ». */
const GROUP_ACTIVE: Record<CategoryKind, readonly [number, number]> = {
  live: [1, 2],
  vod: [3, 4],
  series: [5, 6],
};

export function syncGroupStatus(
  step: SyncStep | null,
  group: CategoryKind,
): SyncGroupStatus {
  if (!step) return 'pending';
  const i = STEP_INDEX[step];
  const [from, to] = GROUP_ACTIVE[group];
  if (i < from) return 'pending';
  if (i <= to) return 'active';
  return 'done';
}

export function authStatus(step: SyncStep | null): SyncGroupStatus {
  if (!step) return 'pending';
  if (step === 'auth') return 'active';
  return 'done';
}

/** Familles réellement cochées : on n'affiche pas une ligne « Direct » vide. */
export function selectedSyncGroups(selection: CategorySelection): CategoryKind[] {
  const groups: CategoryKind[] = [];
  if (selection.live.length > 0) groups.push('live');
  if (selection.vod.length > 0) groups.push('vod');
  if (selection.series.length > 0) groups.push('series');
  return groups;
}
