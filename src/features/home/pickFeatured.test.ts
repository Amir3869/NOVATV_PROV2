import { describe, expect, it } from 'vitest';
import { pickFeatured } from './pickFeatured';
import type { Movie, Series } from '@/types';

function movie(over: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    name: 'Film',
    streamUrl: 'http://x',
    playlistId: 'pl',
    isFavorite: false,
    ...over,
  };
}

function series(over: Partial<Series> = {}): Series {
  return {
    id: 's1',
    name: 'Série',
    playlistId: 'pl',
    isFavorite: false,
    ...over,
  };
}

describe('pickFeatured', () => {
  it('préfère un visuel à une note seule', () => {
    const out = pickFeatured(
      [movie({ id: 'a', name: 'Sans visuel', rating: '9.9' })],
      [series({ id: 'b', name: 'Avec cover', cover: 'http://c.jpg', rating: '1' })],
      1
    );
    expect(out[0].id).toBe('b');
  });

  it('à visuel égal, le plus récent d’abord — pas la note', () => {
    const out = pickFeatured(
      [
        movie({
          id: 'old',
          logo: 'http://a.jpg',
          rating: '9.9',
          addedAt: '2024-01-01T00:00:00.000Z',
        }),
        movie({
          id: 'new',
          logo: 'http://b.jpg',
          rating: '1',
          addedAt: '2026-06-01T00:00:00.000Z',
        }),
      ],
      [],
      2
    );
    expect(out.map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('borne au plafond', () => {
    const movies = Array.from({ length: 10 }, (_, i) =>
      movie({ id: `m${i}`, logo: 'http://x.jpg', rating: String(i) })
    );
    expect(pickFeatured(movies, [], 5)).toHaveLength(5);
  });
});
