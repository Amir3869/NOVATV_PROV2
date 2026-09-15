import { describe, expect, it } from 'vitest';
import { groupByName } from './groupByName';

describe('groupByName', () => {
  it('regroupe par nom et trie', () => {
    const items = [
      { id: '1', categoryName: 'Horreur' },
      { id: '2', categoryName: 'Action' },
      { id: '3', categoryName: 'Action' },
    ];
    const groups = groupByName(items, (item) => item.categoryName, 'Autres');
    expect(groups.map((g) => g.name)).toEqual(['Action', 'Horreur']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['2', '3']);
  });

  it('envoie les noms vides dans le repli', () => {
    const items = [
      { id: '1', categoryName: '  ' },
      { id: '2' },
      { id: '3', categoryName: 'Drame' },
    ];
    const groups = groupByName(items, (item) => item.categoryName, 'Autres');
    expect(groups).toEqual([
      { name: 'Autres', items: [items[0], items[1]] },
      { name: 'Drame', items: [items[2]] },
    ]);
  });
});
