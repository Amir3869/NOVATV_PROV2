import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, migratePersistedState, mergeCatalogLists } from './useAppStore';
import type { EPGProgram, LiveCategory, LiveChannel, Movie, Playlist, Profile, Series } from '@/types';

/**
 * Le store est un singleton : sans remise à zéro, l'état laissé par un
 * test contaminerait le suivant et le résultat dépendrait de l'ordre
 * d'exécution.
 */
function reset() {
  useAppStore.setState({
    playlists: [],
    activePlaylistId: null,
    channels: [],
    liveCategories: [],
    movies: [],
    series: [],
    seasons: [],
    episodes: [],
    epgPrograms: [],
    categoryRenames: {},
    channelRenames: {},
    categoryPins: {},
    categoryOrder: {},
    lockedItems: [],
    sessionUnlocked: false,
    watchHistory: [],
  });
}

function makePlaylist(id: string, overrides: Partial<Playlist> = {}): Playlist {
  return {
    id,
    name: `Source ${id}`,
    type: 'xtream',
    isActive: false,
    lastSync: null,
    syncStatus: 'idle',
    channelCount: 0,
    movieCount: 0,
    seriesCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeChannel(id: string, playlistId: string): LiveChannel {
  return {
    id,
    name: id,
    streamUrl: `http://exemple/${id}`,
    streamType: 'other',
    playlistId,
    isFavorite: false,
    isRecent: false,
  };
}

function makeMovie(id: string, playlistId: string): Movie {
  return {
    id,
    name: id,
    streamUrl: `http://exemple/${id}`,
    playlistId,
    isFavorite: false,
  };
}

function makeSeries(id: string, playlistId: string): Series {
  return { id, name: id, playlistId, isFavorite: false };
}

beforeEach(reset);

describe('addPlaylist', () => {
  it('ajoute une source à la liste', () => {
    useAppStore.getState().addPlaylist(makePlaylist('a'));
    expect(useAppStore.getState().playlists).toHaveLength(1);
  });

  it('la première source devient automatiquement active', () => {
    useAppStore.getState().addPlaylist(makePlaylist('a'));
    const after = useAppStore.getState();
    expect(after.activePlaylistId).toBe('a');
    expect(after.playlists[0]?.isActive).toBe(true);
  });

  it("la seconde source ne vole pas la place de l'active", () => {
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.addPlaylist(makePlaylist('b'));
    const after = useAppStore.getState();
    expect(after.activePlaylistId).toBe('a');
    expect(after.playlists).toHaveLength(2);
    expect(after.playlists.find((p) => p.id === 'a')?.isActive).toBe(true);
    expect(after.playlists.find((p) => p.id === 'b')?.isActive).toBe(false);
  });
});

describe('updatePlaylist', () => {
  it('modifie uniquement les champs fournis', () => {
    useAppStore.getState().addPlaylist(makePlaylist('a', { name: 'Avant' }));
    useAppStore.getState().updatePlaylist('a', { syncStatus: 'success' });
    const p = useAppStore.getState().playlists[0];
    expect(p.name).toBe('Avant');
    expect(p.syncStatus).toBe('success');
  });

  it('rafraîchit updatedAt', () => {
    useAppStore.getState().addPlaylist(makePlaylist('a'));
    const before = useAppStore.getState().playlists[0].updatedAt;
    useAppStore.getState().updatePlaylist('a', { channelCount: 12 });
    expect(useAppStore.getState().playlists[0].updatedAt).not.toBe(before);
  });

  it('ne touche pas les autres sources', () => {
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.addPlaylist(makePlaylist('b'));
    s.updatePlaylist('a', { syncStatus: 'error' });
    const b = useAppStore.getState().playlists.find((p) => p.id === 'b');
    expect(b?.syncStatus).toBe('idle');
  });

  it('un identifiant inconnu ne modifie rien', () => {
    useAppStore.getState().addPlaylist(makePlaylist('a'));
    useAppStore.getState().updatePlaylist('inexistant', { syncStatus: 'error' });
    expect(useAppStore.getState().playlists[0].syncStatus).toBe('idle');
  });
});

describe('deletePlaylist', () => {
  it('retire la source', () => {
    useAppStore.getState().addPlaylist(makePlaylist('a'));
    useAppStore.getState().deletePlaylist('a');
    expect(useAppStore.getState().playlists).toHaveLength(0);
  });

  it('retire aussi le contenu rapporté par cette source', () => {
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.setCatalog('a', {
      channels: [makeChannel('c1', 'a')],
      movies: [makeMovie('m1', 'a')],
      series: [makeSeries('s1', 'a')],
    });
    s.deletePlaylist('a');
    const after = useAppStore.getState();
    expect(after.channels).toHaveLength(0);
    expect(after.movies).toHaveLength(0);
    expect(after.series).toHaveLength(0);
  });

  it('conserve le contenu des autres sources', () => {
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.addPlaylist(makePlaylist('b'));
    s.setCatalog('a', { channels: [makeChannel('c1', 'a')] });
    s.setCatalog('b', { channels: [makeChannel('c2', 'b')] });
    s.deletePlaylist('a');
    const channels = useAppStore.getState().channels;
    expect(channels).toHaveLength(1);
    expect(channels[0].id).toBe('c2');
  });

  it("désigne une autre source active si l'active est supprimée", () => {
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.addPlaylist(makePlaylist('b'));
    s.deletePlaylist('a');
    const after = useAppStore.getState();
    expect(after.activePlaylistId).toBe('b');
    expect(after.playlists.find((p) => p.id === 'b')?.isActive).toBe(true);
  });

  it('remet activePlaylistId à null quand il ne reste rien', () => {
    useAppStore.getState().addPlaylist(makePlaylist('a'));
    useAppStore.getState().deletePlaylist('a');
    expect(useAppStore.getState().activePlaylistId).toBeNull();
  });
});

describe('renameCategory / renameChannel', () => {
  it('enregistre le surnom de la catégorie', () => {
    useAppStore.getState().renameCategory('a:m3ucat:1', 'Sport VIP');
    expect(useAppStore.getState().categoryRenames['a:m3ucat:1']).toBe('Sport VIP');
  });

  it('un nom réduit à des espaces retire le surnom', () => {
    const s = useAppStore.getState();
    s.renameCategory('a:m3ucat:1', 'Sport VIP');
    s.renameCategory('a:m3ucat:1', '   ');
    expect(useAppStore.getState().categoryRenames['a:m3ucat:1']).toBeUndefined();
  });

  it('un autre surnom remplace le précédent sans doublon', () => {
    const s = useAppStore.getState();
    s.renameCategory('a:m3ucat:1', 'Sport VIP');
    s.renameCategory('a:m3ucat:1', 'Football');
    const renames = useAppStore.getState().categoryRenames;
    expect(renames['a:m3ucat:1']).toBe('Football');
    expect(Object.keys(renames)).toHaveLength(1);
  });

  it('enregistre le surnom de la chaîne', () => {
    useAppStore.getState().renameChannel('a:m3u:1', 'Ma chaîne');
    expect(useAppStore.getState().channelRenames['a:m3u:1']).toBe('Ma chaîne');
  });

  it('retire les surnoms de la source supprimée, pas des autres', () => {
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.addPlaylist(makePlaylist('b'));
    s.renameCategory('a:m3ucat:1', 'Sport');
    s.renameCategory('b:m3ucat:1', 'News');
    s.renameChannel('a:m3u:1', 'Ma chaîne');
    s.deletePlaylist('a');
    const after = useAppStore.getState();
    expect(after.categoryRenames['a:m3ucat:1']).toBeUndefined();
    expect(after.categoryRenames['b:m3ucat:1']).toBe('News');
    expect(after.channelRenames['a:m3u:1']).toBeUndefined();
  });
});

function makeLiveCategory(id: string, playlistId: string): LiveCategory {
  return { id, name: id, playlistId, channelCount: 1 };
}

describe('toggleCategoryPin / moveCategory', () => {
  it('épingle puis retire, par profil, sans dépasser 4', () => {
    useAppStore.setState({ activeProfileId: 'p1' });
    const s = useAppStore.getState();
    s.toggleCategoryPin('a:livecat:1');
    s.toggleCategoryPin('a:livecat:2');
    s.toggleCategoryPin('a:livecat:3');
    s.toggleCategoryPin('a:livecat:4');
    s.toggleCategoryPin('a:livecat:5');
    expect(useAppStore.getState().categoryPins.p1).toEqual([
      'a:livecat:1',
      'a:livecat:2',
      'a:livecat:3',
      'a:livecat:4',
    ]);
    s.toggleCategoryPin('a:livecat:2');
    expect(useAppStore.getState().categoryPins.p1).toEqual([
      'a:livecat:1',
      'a:livecat:3',
      'a:livecat:4',
    ]);
  });

  it('sépare les profils', () => {
    useAppStore.setState({ activeProfileId: 'p1' });
    useAppStore.getState().toggleCategoryPin('a:livecat:1');
    useAppStore.setState({ activeProfileId: 'p2' });
    useAppStore.getState().toggleCategoryPin('a:livecat:9');
    const after = useAppStore.getState();
    expect(after.categoryPins.p1).toEqual(['a:livecat:1']);
    expect(after.categoryPins.p2).toEqual(['a:livecat:9']);
  });

  it('déplace une épingle dans son groupe', () => {
    useAppStore.setState({ activeProfileId: 'p1' });
    const s = useAppStore.getState();
    s.toggleCategoryPin('a:livecat:1');
    s.toggleCategoryPin('a:livecat:2');
    s.moveCategory('a:livecat:2', -1);
    expect(useAppStore.getState().categoryPins.p1).toEqual(['a:livecat:2', 'a:livecat:1']);
  });

  it('déplace le reste selon le catalogue de la source active', () => {
    useAppStore.setState({
      activeProfileId: 'p1',
      activePlaylistId: 'a',
      liveCategories: [
        makeLiveCategory('a:livecat:1', 'a'),
        makeLiveCategory('a:livecat:2', 'a'),
        makeLiveCategory('a:livecat:3', 'a'),
      ],
    });
    useAppStore.getState().moveCategory('a:livecat:2', -1);
    expect(useAppStore.getState().categoryOrder.p1).toEqual([
      'a:livecat:2',
      'a:livecat:1',
      'a:livecat:3',
    ]);
  });

  it('retire les ids de la source supprimée', () => {
    useAppStore.setState({ activeProfileId: 'p1' });
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.addPlaylist(makePlaylist('b'));
    s.toggleCategoryPin('a:livecat:1');
    s.toggleCategoryPin('b:livecat:1');
    s.deletePlaylist('a');
    const after = useAppStore.getState();
    expect(after.categoryPins.p1).toEqual(['b:livecat:1']);
  });
});

describe('setActivePlaylist', () => {
  it('met à jour isActive sur toutes les sources', () => {
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.addPlaylist(makePlaylist('b'));
    s.setActivePlaylist('b');
    const list = useAppStore.getState().playlists;
    expect(list.find((p) => p.id === 'a')?.isActive).toBe(false);
    expect(list.find((p) => p.id === 'b')?.isActive).toBe(true);
    expect(useAppStore.getState().activePlaylistId).toBe('b');
  });
});

describe('setCatalog', () => {
  it('remplace le contenu au lieu de le cumuler', () => {
    const s = useAppStore.getState();
    s.setCatalog('a', { channels: [makeChannel('c1', 'a'), makeChannel('c2', 'a')] });
    s.setCatalog('a', { channels: [makeChannel('c3', 'a')] });
    const channels = useAppStore.getState().channels;
    expect(channels).toHaveLength(1);
    expect(channels[0].id).toBe('c3');
  });

  it("ne touche pas au contenu d'une autre source", () => {
    const s = useAppStore.getState();
    s.setCatalog('a', { channels: [makeChannel('c1', 'a')] });
    s.setCatalog('b', { channels: [makeChannel('c2', 'b')] });
    expect(useAppStore.getState().channels).toHaveLength(2);
  });

  it('rattache au playlistId fourni les chaînes mal étiquetées', () => {
    useAppStore.getState().setCatalog('a', { channels: [makeChannel('c1', 'autre')] });
    expect(useAppStore.getState().channels[0].playlistId).toBe('a');
  });

  it('un champ absent laisse la liste correspondante intacte', () => {
    const s = useAppStore.getState();
    s.setCatalog('a', { channels: [makeChannel('c1', 'a')], movies: [makeMovie('m1', 'a')] });
    // Nouvelle synchronisation ne rapportant que des chaînes :
    // les films précédents doivent survivre.
    s.setCatalog('a', { channels: [makeChannel('c9', 'a')] });
    expect(useAppStore.getState().movies).toHaveLength(1);
  });

  it('écarte les saisons et épisodes en double', () => {
    const s = useAppStore.getState();
    const saison = {
      id: 'season-1',
      seriesId: 's1',
      seasonNumber: 1,
      name: 'Saison 1',
      episodeCount: 2,
    };
    s.setCatalog('a', { seasons: [saison] });
    s.setCatalog('a', { seasons: [{ ...saison, name: 'Saison 1 (maj)' }] });
    const seasons = useAppStore.getState().seasons;
    expect(seasons).toHaveLength(1);
    expect(seasons[0].name).toBe('Saison 1 (maj)');
  });
});

describe('clearCatalog', () => {
  it('vide le contenu sans supprimer la source', () => {
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.setCatalog('a', { channels: [makeChannel('c1', 'a')] });
    s.clearCatalog('a');
    expect(useAppStore.getState().channels).toHaveLength(0);
    expect(useAppStore.getState().playlists).toHaveLength(1);
  });
});

describe('setSeriesDetails / updateMovieDetails', () => {
  it('remplace saisons et épisodes d’une série sans toucher aux autres', () => {
    const s = useAppStore.getState();
    s.setCatalog('a', { series: [makeSeries('s1', 'a'), makeSeries('s2', 'a')] });
    s.setSeriesDetails('s1', {
      seasons: [{ id: 's1:season:1', seriesId: 's1', seasonNumber: 1, name: 'S1', episodeCount: 1 }],
      episodes: [
        {
          id: 's1:episode:1',
          seriesId: 's1',
          seasonId: 's1:season:1',
          seasonNumber: 1,
          episodeNumber: 1,
          title: 'Pilote',
          streamUrl: 'http://exemple/1',
          isWatched: false,
        },
      ],
      seriesPatch: { plot: 'Un synopsis.' },
    });
    s.setSeriesDetails('s2', {
      seasons: [{ id: 's2:season:1', seriesId: 's2', seasonNumber: 1, name: 'S1', episodeCount: 0 }],
      episodes: [],
    });
    s.setSeriesDetails('s1', {
      seasons: [{ id: 's1:season:1', seriesId: 's1', seasonNumber: 1, name: 'Saison 1', episodeCount: 0 }],
      episodes: [],
      seriesPatch: { plot: 'Mis à jour.' },
    });
    const after = useAppStore.getState();
    expect(after.seasons.filter((x) => x.seriesId === 's1')).toHaveLength(1);
    expect(after.seasons.find((x) => x.seriesId === 's1')?.name).toBe('Saison 1');
    expect(after.episodes.filter((x) => x.seriesId === 's1')).toHaveLength(0);
    expect(after.seasons.filter((x) => x.seriesId === 's2')).toHaveLength(1);
    expect(after.series.find((x) => x.id === 's1')?.plot).toBe('Mis à jour.');
  });

  it('enrichit un film sans toucher aux autres', () => {
    const s = useAppStore.getState();
    s.setCatalog('a', { movies: [makeMovie('m1', 'a'), makeMovie('m2', 'a')] });
    s.updateMovieDetails('m1', { plot: 'Un film.', duration: 120 });
    const after = useAppStore.getState();
    expect(after.movies.find((m) => m.id === 'm1')?.plot).toBe('Un film.');
    expect(after.movies.find((m) => m.id === 'm2')?.plot).toBeUndefined();
  });

  it('retire saisons et épisodes avec la source', () => {
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.addPlaylist(makePlaylist('b'));
    s.setCatalog('a', { series: [makeSeries('s1', 'a')] });
    s.setSeriesDetails('s1', {
      seasons: [{ id: 's1:season:1', seriesId: 's1', seasonNumber: 1, name: 'S1', episodeCount: 0 }],
      episodes: [],
    });
    s.setCatalog('b', { series: [makeSeries('s2', 'b')] });
    s.setSeriesDetails('s2', {
      seasons: [{ id: 's2:season:1', seriesId: 's2', seasonNumber: 1, name: 'S1', episodeCount: 0 }],
      episodes: [],
    });
    s.deletePlaylist('a');
    const after = useAppStore.getState();
    expect(after.seasons.map((x) => x.seriesId)).toEqual(['s2']);
  });
});

describe('addToHistory', () => {
  it('met à jour la même entrée pour un média et un profil', () => {
    const s = useAppStore.getState();
    s.addToHistory({
      id: 'h1',
      profileId: 'p1',
      mediaId: 'm1',
      mediaType: 'movie',
      title: 'Film',
      position: 10,
      duration: 100,
      percent: 10,
      watchedAt: '2026-01-01T00:00:00.000Z',
    });
    s.addToHistory({
      id: 'h2',
      profileId: 'p1',
      mediaId: 'm1',
      mediaType: 'movie',
      title: 'Film',
      position: 40,
      duration: 100,
      percent: 40,
      watchedAt: '2026-01-01T00:05:00.000Z',
    });
    const history = useAppStore.getState().watchHistory;
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe('h1');
    expect(history[0].percent).toBe(40);
  });

  it('sépare les profils', () => {
    const s = useAppStore.getState();
    s.addToHistory({
      id: 'h1',
      profileId: 'p1',
      mediaId: 'm1',
      mediaType: 'movie',
      title: 'Film',
      position: 10,
      duration: 100,
      percent: 10,
      watchedAt: '2026-01-01T00:00:00.000Z',
    });
    s.addToHistory({
      id: 'h2',
      profileId: 'p2',
      mediaId: 'm1',
      mediaType: 'movie',
      title: 'Film',
      position: 20,
      duration: 100,
      percent: 20,
      watchedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(useAppStore.getState().watchHistory).toHaveLength(2);
  });
});

function makeProgram(id: string, channelId: string): EPGProgram {
  return {
    id,
    channelId,
    title: `Programme ${id}`,
    start: '2026-08-20T19:00:00.000Z',
    stop: '2026-08-20T20:00:00.000Z',
  };
}

describe('setEpgPrograms', () => {
  it('enregistre le guide d une source', () => {
    useAppStore.getState().setEpgPrograms('a', [makeProgram('a:epg:1', 'a:live:1')]);
    expect(useAppStore.getState().epgPrograms).toHaveLength(1);
  });

  it('remplace le guide precedent de la meme source', () => {
    const s = useAppStore.getState();
    s.setEpgPrograms('a', [makeProgram('a:epg:1', 'a:live:1')]);
    s.setEpgPrograms('a', [makeProgram('a:epg:2', 'a:live:1')]);
    const out = useAppStore.getState().epgPrograms;
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a:epg:2');
  });

  it('ne touche pas au guide des autres sources', () => {
    const s = useAppStore.getState();
    s.setEpgPrograms('a', [makeProgram('a:epg:1', 'a:live:1')]);
    s.setEpgPrograms('b', [makeProgram('b:epg:1', 'b:live:1')]);
    expect(useAppStore.getState().epgPrograms).toHaveLength(2);
  });

  it('accepte un guide vide pour effacer celui d une source', () => {
    const s = useAppStore.getState();
    s.setEpgPrograms('a', [makeProgram('a:epg:1', 'a:live:1')]);
    s.setEpgPrograms('a', []);
    expect(useAppStore.getState().epgPrograms).toHaveLength(0);
  });

  it('ne confond pas deux sources dont l identifiant est prefixe de l autre', () => {
    const s = useAppStore.getState();
    // 'a' est un prefixe de 'ab' : un filtre naif sur startsWith('a')
    // supprimerait le guide de 'ab'. Le separateur ':epg:' l evite.
    s.setEpgPrograms('ab', [makeProgram('ab:epg:1', 'ab:live:1')]);
    s.setEpgPrograms('a', [makeProgram('a:epg:1', 'a:live:1')]);
    expect(useAppStore.getState().epgPrograms).toHaveLength(2);
  });
});

describe('clearCatalog et guide', () => {
  it('efface aussi le guide de la source videe', () => {
    const s = useAppStore.getState();
    s.addPlaylist(makePlaylist('a'));
    s.setEpgPrograms('a', [makeProgram('a:epg:1', 'a:live:1')]);
    s.clearCatalog('a');
    expect(useAppStore.getState().epgPrograms).toHaveLength(0);
  });

  it('conserve le guide des autres sources', () => {
    const s = useAppStore.getState();
    s.setEpgPrograms('a', [makeProgram('a:epg:1', 'a:live:1')]);
    s.setEpgPrograms('b', [makeProgram('b:epg:1', 'b:live:1')]);
    s.clearCatalog('a');
    const out = useAppStore.getState().epgPrograms;
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('b:epg:1');
  });
});

/**
 * Migrations du stockage.
 *
 * Ces tests couvrent un bug réel : les étapes s'excluaient mutuellement,
 * si bien qu'un stockage en version 3 sautait l'étape 4. La préférence
 * `animationsEnabled` y restait à `true` — un faux « choix explicite »
 * qui aurait ensuite empêché le réglage système d'accessibilité et le
 * comportement par défaut sur téléviseur de s'appliquer.
 */
describe('migratePersistedState', () => {
  const stockageV3 = () => ({
    profiles: [],
    activeProfileId: null,
    playlists: [],
    activePlaylistId: null,
    favorites: [],
    customLists: [],
    watchHistory: [],
    playbackProgress: [],
    isOnboarded: true,
    preferences: {
      theme: 'dark',
      glassEnabled: true,
      animationsEnabled: true,
      epgDays: 5,
    },
  });

  it('traverse TOUTES les étapes depuis la version 3', () => {
    const r = migratePersistedState(stockageV3(), 3);
    // Les deux réglages étaient morts : leur `true` n'exprimait aucun
    // choix, il doit redevenir « jamais décidé ».
    expect(r.preferences.glassEnabled).toBeNull();
    expect(r.preferences.animationsEnabled).toBeNull();
  });

  it('conserve un refus délibéré au passage', () => {
    const s = stockageV3();
    s.preferences.glassEnabled = false;
    s.preferences.animationsEnabled = false;
    const r = migratePersistedState(s, 3);
    expect(r.preferences.glassEnabled).toBe(false);
    expect(r.preferences.animationsEnabled).toBe(false);
  });

  it('préserve les préférences sans rapport', () => {
    const r = migratePersistedState(stockageV3(), 3);
    expect(r.preferences.theme).toBe('dark');
    expect(r.preferences.epgDays).toBe(5);
    expect(r.isOnboarded).toBe(true);
  });

  it('applique la seule étape 4 depuis la version 4', () => {
    const s = stockageV3();
    s.preferences.glassEnabled = false;
    const r = migratePersistedState(s, 4);
    // Déjà migré à l'étape précédente : on n'y retouche pas.
    expect(r.preferences.glassEnabled).toBe(false);
    expect(r.preferences.animationsEnabled).toBeNull();
  });

  it('repart de zéro depuis la version 0', () => {
    const r = migratePersistedState({ preferences: { theme: 'light' } }, 0);
    expect(r.playlists).toEqual([]);
    expect(r.profiles).toEqual([]);
    expect(r.isOnboarded).toBe(false);
  });

  it('vide les sources inexploitables depuis la version 2', () => {
    const s = stockageV3();
    s.playlists = [{ id: 'p1' }] as never;
    const r = migratePersistedState(s, 2);
    expect(r.playlists).toEqual([]);
    expect(r.activePlaylistId).toBeNull();
  });

  it('ne touche à rien à la version courante', () => {
    const s = stockageV3();
    s.preferences.glassEnabled = null as never;
    s.preferences.animationsEnabled = null as never;
    const r = migratePersistedState(s, 5);
    expect(r.preferences.glassEnabled).toBeNull();
    expect(r.preferences.animationsEnabled).toBeNull();
  });

  it('injecte des surnoms vides depuis une version antérieure à 10', () => {
    const r = migratePersistedState(stockageV3(), 9);
    expect(r.categoryRenames).toEqual({});
    expect(r.channelRenames).toEqual({});
  });

  it('conserve les surnoms déjà enregistrés au passage vers 10', () => {
    const s = { ...stockageV3(), categoryRenames: { a: 'Sport' } };
    const r = migratePersistedState(s, 9);
    expect(r.categoryRenames).toEqual({ a: 'Sport' });
    expect(r.channelRenames).toEqual({});
  });

  it('injecte une liste de verrous vide depuis une version antérieure à 11', () => {
    const r = migratePersistedState(stockageV3(), 10);
    expect(r.lockedItems).toEqual([]);
  });

  it('conserve les verrous déjà posés au passage vers 11', () => {
    const s = { ...stockageV3(), lockedItems: ['ch:a:m3u:1'] };
    const r = migratePersistedState(s, 10);
    expect(r.lockedItems).toEqual(['ch:a:m3u:1']);
  });
});

describe('verrouillage parental (store)', () => {
  beforeEach(reset);

  it('verrouille puis déverrouille un élément', () => {
    useAppStore.getState().setItemLocked('ch:a:m3u:1', true);
    expect(useAppStore.getState().lockedItems).toEqual(['ch:a:m3u:1']);
    useAppStore.getState().setItemLocked('ch:a:m3u:1', false);
    expect(useAppStore.getState().lockedItems).toEqual([]);
  });

  it('évite les doublons et bascule correctement', () => {
    const s = useAppStore.getState();
    s.toggleItemLocked('cat:a:g1');
    s.toggleItemLocked('cat:a:g1');
    expect(useAppStore.getState().lockedItems).toEqual([]);
    s.toggleItemLocked('cat:a:g1');
    s.setItemLocked('cat:a:g1', true);
    expect(useAppStore.getState().lockedItems).toEqual(['cat:a:g1']);
  });

  it('ouvre le verrou de session, rejoué à chaque changement de profil', () => {
    useAppStore.setState({ profiles: [makeProfile('p1'), makeProfile('p2')] });
    useAppStore.getState().setActiveProfile('p1');
    useAppStore.getState().unlockSession();
    expect(useAppStore.getState().sessionUnlocked).toBe(true);
    // Changer de profil relève le verrou : le code est propre au profil.
    useAppStore.getState().setActiveProfile('p2');
    expect(useAppStore.getState().sessionUnlocked).toBe(false);
  });
});

describe('mergeCatalogLists', () => {
  it('garde le disque quand la mémoire est vide', () => {
    const stored = [makeChannel('c1', 'a')];
    expect(mergeCatalogLists(stored, [])).toEqual(stored);
  });

  it("complète la mémoire avec les sources que le disque a et pas la RAM", () => {
    const stored = [makeChannel('c1', 'a')];
    const memory = [makeChannel('c2', 'b')];
    const out = mergeCatalogLists(stored, memory);
    expect(out.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
  });

  it("la mémoire l'emporte pour une source présente des deux côtés", () => {
    const stored = [makeChannel('c1-old', 'a')];
    const memory = [makeChannel('c1-new', 'a')];
    expect(mergeCatalogLists(stored, memory)).toEqual(memory);
  });
});

/** Fabrique un profil minimal pour les tests de la section précédente. */
function makeProfile(id: string): Profile {
  return {
    id,
    name: `Profil ${id}`,
    avatarId: 'fox',
    isKidsProfile: false,
    language: 'fr',
    audioLanguage: 'fr',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}
