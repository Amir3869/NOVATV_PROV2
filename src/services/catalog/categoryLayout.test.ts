import { describe, it, expect } from 'vitest';
import {
  MAX_PINNED_CATEGORIES,
  dropIdsWithPrefix,
  layoutCategories,
  moveIdInList,
  orderedCategoryIds,
} from './categoryLayout';

function cats(...ids: string[]) {
  return ids.map((id) => ({ id, name: id }));
}

describe('layoutCategories', () => {
  it('sans pins ni ordre, conserve l’ordre du catalogue', () => {
    const { pinned, rest } = layoutCategories(cats('a', 'b', 'c'), [], []);
    expect(pinned).toEqual([]);
    expect(rest.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('place les épingles en tête, dans leur ordre', () => {
    const { pinned, rest } = layoutCategories(cats('a', 'b', 'c'), ['c', 'a'], []);
    expect(pinned.map((c) => c.id)).toEqual(['c', 'a']);
    expect(rest.map((c) => c.id)).toEqual(['b']);
  });

  it('ignore un id épinglé inconnu', () => {
    const { pinned } = layoutCategories(cats('a'), ['z', 'a'], []);
    expect(pinned.map((c) => c.id)).toEqual(['a']);
  });

  it('plafonne à MAX_PINNED_CATEGORIES', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const { pinned } = layoutCategories(cats(...ids), ids, []);
    expect(pinned).toHaveLength(MAX_PINNED_CATEGORIES);
    expect(pinned.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ordonne le reste selon orderIds, les nouveaux en fin', () => {
    const { rest } = layoutCategories(cats('a', 'b', 'c', 'd'), [], ['c', 'a']);
    expect(rest.map((c) => c.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('n’applique pas l’ordre aux épingles', () => {
    const { pinned, rest } = layoutCategories(cats('a', 'b', 'c'), ['b'], ['c', 'a', 'b']);
    expect(pinned.map((c) => c.id)).toEqual(['b']);
    expect(rest.map((c) => c.id)).toEqual(['c', 'a']);
  });
});

describe('moveIdInList', () => {
  it('échange avec le voisin', () => {
    expect(moveIdInList(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveIdInList(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('ne dépasse pas les bords', () => {
    expect(moveIdInList(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(moveIdInList(['a', 'b'], 'b', 1)).toEqual(['a', 'b']);
  });
});

describe('orderedCategoryIds', () => {
  it('concatène épingles puis reste', () => {
    expect(orderedCategoryIds(cats('a', 'b', 'c'), ['c'], ['a', 'b'])).toEqual(['c', 'a', 'b']);
  });
});

describe('dropIdsWithPrefix', () => {
  it('retire les ids d’une source, par profil', () => {
    const out = dropIdsWithPrefix(
      { p1: ['pl-a:livecat:1', 'pl-b:livecat:1'], p2: ['pl-a:livecat:2'] },
      'pl-a:'
    );
    expect(out).toEqual({ p1: ['pl-b:livecat:1'] });
  });
});
