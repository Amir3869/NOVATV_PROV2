import { describe, expect, it } from 'vitest';
import {
  buildCategoryHierarchy,
  categoryPathFromName,
  categoryAndDescendants,
} from './categoryHierarchy';

function input(
  id: string,
  name: string,
  count = 0,
  extra: Partial<{ sourceId: string; parentSourceId: string }> = {},
) {
  return { id, name, count, ...extra };
}

describe('categoryPathFromName', () => {
  it('recognises explicit separators without treating quality as a parent', () => {
    expect(categoryPathFromName('FR | SPORT | France HD')).toEqual({
      path: ['FR', 'SPORT', 'France'],
      relation: 'inferred',
    });
  });

  it('recognises region prefixes and suffixes', () => {
    expect(categoryPathFromName('AR Sport')).toEqual({
      path: ['AR', 'Sport'],
      relation: 'inferred',
    });
    expect(categoryPathFromName('Movies ES')).toEqual({
      path: ['ES', 'Movies'],
      relation: 'inferred',
    });
  });

  it('keeps an ordinary flat category flat', () => {
    expect(categoryPathFromName('Cinéma Français')).toEqual({
      path: ['Cinéma Français'],
      relation: 'flat',
    });
    expect(categoryPathFromName('HD')).toEqual({
      path: ['HD'],
      relation: 'flat',
    });
  });
});

describe('buildCategoryHierarchy', () => {
  it('keeps a native Xtream parent relation', () => {
    const nodes = buildCategoryHierarchy(
      [
        input('cat:1', 'France', 0, { sourceId: '1' }),
        input('cat:2', 'France HD', 12, { sourceId: '2', parentSourceId: '1' }),
        input('cat:3', 'France FHD', 8, { sourceId: '3', parentSourceId: '1' }),
      ],
      { playlistId: 'pl', family: 'live' },
    );

    const parent = nodes.find((node) => node.id === 'cat:1');
    expect(parent?.relation).toBe('flat');
    expect(parent?.childIds).toEqual(['cat:2', 'cat:3']);
    expect(parent?.count).toBe(20);
    expect(nodes.find((node) => node.id === 'cat:2')).toMatchObject({
      parentId: 'cat:1',
      level: 1,
      relation: 'native',
      qualities: ['HD'],
    });
  });

  it('creates explicit inferred parents and preserves quality metadata', () => {
    const nodes = buildCategoryHierarchy(
      [
        input('cat:1', 'FR | SPORT | France HD', 4),
        input('cat:2', 'FR | SPORT | France FHD', 6),
        input('cat:3', 'FR | NEWS', 3),
      ],
      { playlistId: 'pl', family: 'live' },
    );

    const sport = nodes.find((node) => node.name === 'SPORT');
    const franceHd = nodes.find((node) => node.id === 'cat:1');
    const news = nodes.find((node) => node.id === 'cat:3');

    expect(sport).toMatchObject({ relation: 'inferred', level: 1, count: 10 });
    expect(franceHd).toMatchObject({
      parentId: sport?.id,
      level: 2,
      qualities: ['HD'],
      originalName: 'FR | SPORT | France HD',
    });
    expect(news?.path).toEqual(['FR', 'NEWS']);
    expect(nodes.some((node) => node.name === 'HD')).toBe(false);
  });

  it('does not create an HD/FHD/4K family', () => {
    const nodes = buildCategoryHierarchy(
      [input('cat:1', 'HD', 1), input('cat:2', 'FHD', 2), input('cat:3', '4K', 3)],
      { playlistId: 'pl', family: 'live' },
    );

    expect(nodes).toHaveLength(3);
    expect(nodes.every((node) => node.parentId === null)).toBe(true);
  });

  it('returns a parent and all descendants for filtering', () => {
    const nodes = buildCategoryHierarchy(
      [input('cat:1', 'FR | Sport | France HD', 4), input('cat:2', 'FR | Sport | France FHD', 6)],
      { playlistId: 'pl', family: 'live' },
    );
    const region = nodes.find((node) => node.name === 'FR');

    expect(region).toBeDefined();
    expect(categoryAndDescendants(nodes, region!.id).map((node) => node.id)).toHaveLength(4);
  });
});
