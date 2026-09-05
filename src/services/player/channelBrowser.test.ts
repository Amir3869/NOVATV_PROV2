import { describe, it, expect } from 'vitest';

import {
  ALL_CATEGORIES,
  UNCATEGORIZED,
  buildCategoryList,
  filterChannels,
  initialCategory,
  listCategoryId,
} from './channelBrowser';
import type { LiveCategory, LiveChannel } from '@/types';

function channel(id: string, name: string, categoryId?: string): LiveChannel {
  return {
    id,
    name,
    streamUrl: `http://example.test/${id}.m3u8`,
    streamType: 'hls',
    categoryId,
    playlistId: 'p1',
    isFavorite: false,
    isRecent: false,
  };
}

function category(id: string, name: string, channelCount = 0): LiveCategory {
  return { id, name, channelCount, playlistId: 'p1' };
}

describe('buildCategoryList', () => {
  it('place « Toutes les chaînes » en tête avec le total', () => {
    const channels = [channel('1', 'A', 'c1'), channel('2', 'B', 'c2')];
    const list = buildCategoryList(channels, [category('c1', 'Sport'), category('c2', 'News')], 'Toutes');

    expect(list[0]).toEqual({ id: ALL_CATEGORIES, name: 'Toutes', count: 2 });
  });

  it('compte les chaînes réellement présentes, pas ce que le serveur annonce', () => {
    // La catégorie prétend 500 chaînes ; le catalogue n'en contient
    // qu'une. C'est le cas après une sélection partielle.
    const channels = [channel('1', 'A', 'c1')];
    const list = buildCategoryList(channels, [category('c1', 'Sport', 500)], 'Toutes');

    expect(list[1]).toEqual({ id: 'c1', name: 'Sport', count: 1 });
  });

  it('écarte une catégorie sans aucune chaîne', () => {
    const channels = [channel('1', 'A', 'c1')];
    const list = buildCategoryList(
      channels,
      [category('c1', 'Sport'), category('c2', 'Vide', 42)],
      'Toutes'
    );

    expect(list.map((c) => c.id)).toEqual([ALL_CATEGORIES, 'c1']);
  });

  it('regroupe les chaînes sans catégorie dans un fourre-tout final', () => {
    const channels = [channel('1', 'A', 'c1'), channel('2', 'B'), channel('3', 'C')];
    const list = buildCategoryList(channels, [category('c1', 'Sport')], 'Toutes');

    expect(list[list.length - 1]).toMatchObject({ id: UNCATEGORIZED, count: 2 });
  });

  it('rattrape une chaîne dont la catégorie est absente du catalogue', () => {
    // Cas réel : la catégorie a été décochée à l'import, mais une
    // chaîne y renvoie encore. Sans rattrapage, elle disparaîtrait.
    const channels = [channel('1', 'A', 'fantome')];
    const list = buildCategoryList(channels, [], 'Toutes');

    expect(list[list.length - 1]).toMatchObject({ id: UNCATEGORIZED, count: 1 });
  });

  it("n'ajoute pas de fourre-tout quand tout est classé", () => {
    const channels = [channel('1', 'A', 'c1')];
    const list = buildCategoryList(channels, [category('c1', 'Sport')], 'Toutes');

    expect(list.some((c) => c.id === UNCATEGORIZED)).toBe(false);
  });

  it('préserve l’ordre du catalogue', () => {
    const channels = [channel('1', 'A', 'c2'), channel('2', 'B', 'c1')];
    const list = buildCategoryList(
      channels,
      [category('c2', 'News'), category('c1', 'Sport')],
      'Toutes'
    );

    expect(list.map((c) => c.id)).toEqual([ALL_CATEGORIES, 'c2', 'c1']);
  });

  it('accepte un catalogue vide', () => {
    expect(buildCategoryList([], [], 'Toutes')).toEqual([
      { id: ALL_CATEGORIES, name: 'Toutes', count: 0 },
    ]);
  });

  it('place une liste perso en tête, avant « Toutes »', () => {
    const channels = [channel('1', 'A', 'c1'), channel('2', 'B', 'c1')];
    const pinned = [{ id: listCategoryId('mine'), name: 'Soirée foot', count: 1 }];
    const list = buildCategoryList(channels, [category('c1', 'Sport')], 'Toutes', pinned);

    expect(list.map((c) => c.id)).toEqual([listCategoryId('mine'), ALL_CATEGORIES, 'c1']);
  });

  it('ignore une liste perso vide', () => {
    const channels = [channel('1', 'A', 'c1')];
    const list = buildCategoryList(channels, [category('c1', 'Sport')], 'Toutes', [
      { id: listCategoryId('vide'), name: 'Vide', count: 0 },
    ]);
    expect(list[0].id).toBe(ALL_CATEGORIES);
  });
});

describe('filterChannels', () => {
  const channels = [
    channel('1', 'beIN Sports 1', 'c1'),
    channel('2', 'France 24', 'c2'),
    channel('3', 'Sans catégorie'),
  ];

  it('rend tout sur « Toutes les chaînes »', () => {
    expect(filterChannels(channels, ALL_CATEGORIES, '')).toHaveLength(3);
  });

  it('filtre par catégorie', () => {
    expect(filterChannels(channels, 'c1', '').map((c) => c.id)).toEqual(['1']);
  });

  it('la recherche traverse toutes les catégories', () => {
    // Rubrique « c2 » ouverte, mais la chaîne cherchée est dans « c1 ».
    const found = filterChannels(channels, 'c2', 'bein');
    expect(found.map((c) => c.id)).toEqual(['1']);
  });

  it('la recherche ignore la casse et les espaces autour', () => {
    expect(filterChannels(channels, ALL_CATEGORIES, '  FRANCE  ').map((c) => c.id)).toEqual(['2']);
  });

  it('rend une liste vide quand rien ne correspond', () => {
    expect(filterChannels(channels, ALL_CATEGORIES, 'zzzz')).toEqual([]);
  });

  it('le fourre-tout ne rend que les chaînes non classées', () => {
    expect(filterChannels(channels, UNCATEGORIZED, '').map((c) => c.id)).toEqual(['3']);
  });

  it('une liste perso suit l’ordre des identifiants, pas celui du catalogue', () => {
    const found = filterChannels(channels, listCategoryId('mine'), '', ['3', '1']);
    expect(found.map((c) => c.id)).toEqual(['3', '1']);
  });

  it('écarte de la liste perso une chaîne absente du catalogue', () => {
    const found = filterChannels(channels, listCategoryId('mine'), '', ['1', 'disparue']);
    expect(found.map((c) => c.id)).toEqual(['1']);
  });
});

describe('initialCategory', () => {
  const categories = [
    { id: ALL_CATEGORIES, name: 'Toutes', count: 3 },
    { id: 'c1', name: 'Sport', count: 2 },
  ];

  it('ouvre la rubrique de la chaîne en cours', () => {
    expect(initialCategory(channel('1', 'A', 'c1'), categories)).toBe('c1');
  });

  it('se replie sur « Toutes » quand la rubrique n’est pas listée', () => {
    expect(initialCategory(channel('1', 'A', 'inconnue'), categories)).toBe(ALL_CATEGORIES);
  });

  it('se replie sur « Toutes » sans chaîne en cours', () => {
    expect(initialCategory(undefined, categories)).toBe(ALL_CATEGORIES);
  });

  it('se replie sur « Toutes » pour une chaîne non classée', () => {
    expect(initialCategory(channel('1', 'A'), categories)).toBe(ALL_CATEGORIES);
  });

  it('ouvre la liste perso quand elle est demandée', () => {
    const withList = [
      { id: listCategoryId('mine'), name: 'Soirée foot', count: 2 },
      ...categories,
    ];
    expect(initialCategory(channel('1', 'A', 'c1'), withList, listCategoryId('mine'))).toBe(
      listCategoryId('mine')
    );
  });
});
