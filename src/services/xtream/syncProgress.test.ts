import { describe, expect, it } from 'vitest';
import { emptySelection } from './categorySelection';
import { authStatus, selectedSyncGroups, syncGroupStatus } from './syncProgress';

describe('syncGroupStatus', () => {
  it('reste en attente avant le groupe', () => {
    expect(syncGroupStatus('auth', 'live')).toBe('pending');
    expect(syncGroupStatus('live_streams', 'vod')).toBe('pending');
    expect(syncGroupStatus('vod_streams', 'series')).toBe('pending');
  });

  it('est actif pendant les deux étapes du groupe', () => {
    expect(syncGroupStatus('live_categories', 'live')).toBe('active');
    expect(syncGroupStatus('live_streams', 'live')).toBe('active');
    expect(syncGroupStatus('vod_categories', 'vod')).toBe('active');
    expect(syncGroupStatus('series', 'series')).toBe('active');
  });

  it('est terminé une fois le groupe dépassé', () => {
    expect(syncGroupStatus('vod_categories', 'live')).toBe('done');
    expect(syncGroupStatus('series', 'vod')).toBe('done');
    expect(syncGroupStatus('done', 'series')).toBe('done');
    expect(syncGroupStatus('done', 'live')).toBe('done');
  });

  it('sans étape : tout est en attente', () => {
    expect(syncGroupStatus(null, 'live')).toBe('pending');
  });
});

describe('authStatus', () => {
  it('tourne sur auth, puis est vert', () => {
    expect(authStatus(null)).toBe('pending');
    expect(authStatus('auth')).toBe('active');
    expect(authStatus('live_streams')).toBe('done');
    expect(authStatus('done')).toBe('done');
  });
});

describe('selectedSyncGroups', () => {
  it('n’affiche que les familles cochées', () => {
    expect(selectedSyncGroups(emptySelection())).toEqual([]);
    expect(selectedSyncGroups({ live: ['1'], vod: [], series: [] })).toEqual(['live']);
    expect(selectedSyncGroups({ live: ['1'], vod: ['2'], series: ['3'] })).toEqual([
      'live',
      'vod',
      'series',
    ]);
  });
});
