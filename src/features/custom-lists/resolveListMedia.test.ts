import { describe, expect, it } from 'vitest';
import { catalogIdMatches, findCatalogItem, resolveListItems } from './resolveListMedia';
import type { CustomList, LiveChannel } from '@/types';

function channel(over: Partial<LiveChannel> = {}): LiveChannel {
  return {
    id: 'pl-1:live:12',
    name: 'TF1',
    streamUrl: 'http://x',
    streamType: 'hls',
    playlistId: 'pl-1',
    isFavorite: false,
    isRecent: false,
    ...over,
  };
}

describe('catalogIdMatches', () => {
  it('match exact', () => {
    expect(catalogIdMatches('pl-1:live:12', 'pl-1:live:12')).toBe(true);
  });

  it('match brut contre scopé', () => {
    expect(catalogIdMatches('12', 'pl-1:live:12')).toBe(true);
  });

  it('refuse un voisin (12 vs 112)', () => {
    expect(catalogIdMatches('12', 'pl-1:live:112')).toBe(false);
  });

  it('refuse live vs movie du même numéro', () => {
    expect(catalogIdMatches('pl-1:live:12', 'pl-1:movie:12')).toBe(false);
  });
});

describe('findCatalogItem', () => {
  it('préfère l’id exact', () => {
    const list = [channel(), channel({ id: 'pl-2:live:12', name: 'TF1 bis' })];
    expect(findCatalogItem('pl-1:live:12', list)?.name).toBe('TF1');
  });
});

describe('resolveListItems', () => {
  const list: CustomList = {
    id: 'list-1',
    profileId: 'p1',
    name: 'Sport',
    items: [
      {
        id: 'li-1',
        listId: 'list-1',
        mediaId: 'pl-1:live:12',
        mediaType: 'channel',
        sortOrder: 1,
        addedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'li-2',
        listId: 'list-1',
        mediaId: 'gone',
        mediaType: 'channel',
        sortOrder: 2,
        addedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('résout les présentes et marque les absentes', () => {
    const out = resolveListItems(list, {
      channels: [channel()],
      movies: [],
      series: [],
    });
    expect(out).toHaveLength(2);
    expect(out[0].status).toBe('ok');
    expect(out[1].status).toBe('missing');
  });
});
