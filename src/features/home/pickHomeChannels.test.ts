import { describe, expect, it } from 'vitest';
import { pickHomeChannels } from './pickHomeChannels';

const catalog = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

describe('pickHomeChannels', () => {
  it('reprend le catalogue si listes et favoris sont vides', () => {
    const r = pickHomeChannels(catalog, [], [], 2);
    expect(r.source).toBe('catalog');
    expect(r.items.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('place les listes avant les favoris, sans doublon', () => {
    const r = pickHomeChannels(catalog, ['c', 'a'], ['a', 'd']);
    expect(r.source).toBe('personal');
    expect(r.items.map((c) => c.id)).toEqual(['c', 'a']);
  });

  it('ignore les identifiants absents du catalogue', () => {
    const r = pickHomeChannels(catalog, ['ghost', 'b'], ['nope']);
    expect(r.items.map((c) => c.id)).toEqual(['b']);
    expect(r.source).toBe('personal');
  });

  it('utilise les favoris puis les dernières chaînes regardées', () => {
    const favorite = pickHomeChannels(catalog, [], ['d'], 2, ['c', 'a']);
    expect(favorite.source).toBe('favorites');
    expect(favorite.items.map((c) => c.id)).toEqual(['d']);

    const recent = pickHomeChannels(catalog, [], [], 2, ['c', 'a']);
    expect(recent.source).toBe('recent');
    expect(recent.items.map((c) => c.id)).toEqual(['c', 'a']);
  });
});
