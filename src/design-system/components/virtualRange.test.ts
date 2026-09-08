import { describe, expect, it } from 'vitest';
import { catalogColumnCount, visibleItemRange } from './virtualRange';

describe('catalogColumnCount', () => {
  it('suit les seuils Tailwind des grilles catalogue', () => {
    expect(catalogColumnCount(390)).toBe(3);
    expect(catalogColumnCount(767)).toBe(3);
    expect(catalogColumnCount(768)).toBe(4);
    expect(catalogColumnCount(1024)).toBe(5);
    expect(catalogColumnCount(1280)).toBe(6);
  });
});

describe('visibleItemRange', () => {
  it('ne rend rien sans items', () => {
    expect(
      visibleItemRange({
        itemCount: 0,
        columns: 3,
        rowStride: 200,
        scrollTop: 0,
        viewportHeight: 800,
        origin: 0,
        overscan: 2,
      })
    ).toEqual({ start: 0, end: 0, paddingTop: 0, totalHeight: 0 });
  });

  it('fenêtre le milieu d une longue liste', () => {
    const range = visibleItemRange({
      itemCount: 3000,
      columns: 3,
      rowStride: 200,
      scrollTop: 2000,
      viewportHeight: 800,
      origin: 0,
      overscan: 1,
    });
    // Ligne 10 (2000/200) ± 1 overscan → lignes 9–15 exclus fin.
    expect(range.start).toBe(9 * 3);
    expect(range.end).toBe(15 * 3);
    expect(range.paddingTop).toBe(9 * 200);
    expect(range.totalHeight).toBe(1000 * 200);
  });

  it('ne dépasse pas le dernier item', () => {
    const range = visibleItemRange({
      itemCount: 10,
      columns: 3,
      rowStride: 200,
      scrollTop: 0,
      viewportHeight: 4000,
      origin: 0,
      overscan: 8,
    });
    expect(range.start).toBe(0);
    expect(range.end).toBe(10);
  });
});
