import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  fetchCategoryCatalog,
  syncXtreamCatalog,
  toSourceErrorKind,
  mapLiveChannels,
  mapMovies,
  mapSeries,
  mapLiveCategories,
  mapSeriesInfo,
  mapVodInfo,
  type SyncStep,
} from './xtreamSync';
import type { XtreamSeriesInfo, XtreamVodInfo } from './xtreamService';
import { XtreamError, type XtreamCredentials } from './xtreamService';

const creds: XtreamCredentials = {
  serverUrl: 'http://exemple.tv:8080',
  username: 'user',
  password: 'pass',
};

/**
 * Réponse d'authentification minimale mais valide.
 * `auth: 1` et `status: 'Active'` sont indispensables, sinon le service
 * rejette avant même d'arriver au code testé ici.
 */
const AUTH_OK = {
  user_info: {
    username: 'user',
    auth: 1,
    status: 'Active',
    exp_date: '1893456000', // 2030-01-01
    is_trial: '0',
    active_cons: '1',
    max_connections: '2',
    allowed_output_formats: ['m3u8', 'ts'],
  },
  server_info: { url: 'exemple.tv', port: '8080' },
};

/**
 * Simule le serveur en aiguillant sur le paramètre `action` de l'URL.
 *
 * Le vrai `player_api.php` répond à une même adresse avec des formes
 * très différentes selon `action` ; un mock renvoyant toujours la même
 * chose ne prouverait rien.
 */
function mockPortal(routes: Record<string, unknown>, options: { fail?: string[] } = {}) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (input: string | URL, init?: { signal?: AbortSignal }) => {
    // Le vrai `fetch` rejette immédiatement si le signal est déjà
    // avorté. Un mock qui l'ignore ferait passer un code qui oublie de
    // transmettre le signal.
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const url = new URL(String(input));
    const action = url.searchParams.get('action') ?? 'auth';
    calls.push(action);
    if (options.fail?.includes(action)) {
      return {
        ok: false,
        status: 500,
        headers: { get: () => 'text/html' },
        text: async () => 'erreur serveur',
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify(routes[action] ?? []),
    };
  });
  return calls;
}

const FULL_PORTAL = {
  auth: AUTH_OK,
  get_live_categories: [{ category_id: '1', category_name: 'Sport', parent_id: 0 }],
  get_live_streams: [
    {
      num: 1,
      name: 'Canal Sport',
      stream_id: 42,
      stream_icon: 'http://img/1.png',
      epg_channel_id: 'sport.fr',
      category_id: '1',
      tv_archive: 1,
      tv_archive_duration: 7,
    },
  ],
  get_vod_categories: [{ category_id: '9', category_name: 'Action', parent_id: 0 }],
  get_vod_streams: [
    {
      num: 1,
      name: 'Film A',
      stream_id: 7,
      stream_icon: 'http://img/f.png',
      rating: '8',
      category_id: '9',
      container_extension: 'mkv',
    },
  ],
  get_series_categories: [{ category_id: '3', category_name: 'Drame', parent_id: 0 }],
  get_series: [
    {
      num: 1,
      name: 'Série B',
      series_id: 5,
      cover: 'http://img/s.png',
      plot: 'Un synopsis.',
      cast: 'Untel',
      director: 'Unetelle',
      genre: 'Drame',
      releaseDate: '2019-05-01',
      rating: '7',
      category_id: '3',
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toSourceErrorKind', () => {
  it('conserve le code porté par une XtreamError', () => {
    expect(toSourceErrorKind(new XtreamError('auth', 'refusé'))).toBe('auth');
    expect(toSourceErrorKind(new XtreamError('timeout', 'trop long'))).toBe('timeout');
  });

  it('reconnaît une annulation native comme "aborted"', () => {
    expect(toSourceErrorKind(new DOMException('stop', 'AbortError'))).toBe('aborted');
  });

  it('range toute erreur inconnue dans "unknown" plutôt que de la laisser fuir', () => {
    expect(toSourceErrorKind(new Error('boum'))).toBe('unknown');
    expect(toSourceErrorKind('une chaîne')).toBe('unknown');
    expect(toSourceErrorKind(undefined)).toBe('unknown');
  });
});

describe('conversion vers les types de l’application', () => {
  it('préfixe les identifiants par celui de la source', () => {
    // Deux abonnements peuvent servir la chaîne 42. Sans préfixe, le
    // second écrase le premier dans le catalogue.
    const channels = mapLiveChannels(
      [
        {
          num: 1,
          name: 'A',
          streamId: 42,
          streamIcon: '',
          epgChannelId: '',
          categoryId: '1',
        },
      ],
      new Map(),
      creds,
      'pl-1',
      'ts'
    );
    expect(channels[0].id).toBe('pl-1:live:42');
    expect(channels[0].playlistId).toBe('pl-1');
    expect(channels[0].categoryId).toBe('pl-1:livecat:1');
    // L'identifiant natif reste accessible pour les appels ultérieurs.
    expect(channels[0].streamId).toBe(42);
  });

  it('remplace les champs vides par undefined au lieu de chaînes vides', () => {
    const channels = mapLiveChannels(
      [{ num: 1, name: 'A', streamId: 1, streamIcon: '   ', epgChannelId: '', categoryId: '' }],
      new Map(),
      creds,
      'pl-1',
      'ts'
    );
    expect(channels[0].logo).toBeUndefined();
    expect(channels[0].epgChannelId).toBeUndefined();
    expect(channels[0].categoryId).toBeUndefined();
  });

  it('résout le nom de catégorie depuis la table des catégories', () => {
    const channels = mapLiveChannels(
      [{ num: 1, name: 'A', streamId: 1, streamIcon: '', epgChannelId: '', categoryId: '1' }],
      new Map([['1', 'Sport']]),
      creds,
      'pl-1',
      'ts'
    );
    expect(channels[0].categoryName).toBe('Sport');
  });

  it('construit une adresse de lecture au format demandé', () => {
    const hls = mapLiveChannels(
      [{ num: 1, name: 'A', streamId: 42, streamIcon: '', epgChannelId: '', categoryId: '' }],
      new Map(),
      creds,
      'pl-1',
      'm3u8'
    );
    expect(hls[0].streamUrl).toBe('http://exemple.tv:8080/live/user/pass/42.m3u8');
    expect(hls[0].streamType).toBe('hls');
  });

  it('utilise l’extension du fichier pour l’adresse d’un film', () => {
    const movies = mapMovies(
      [
        {
          num: 1,
          name: 'F',
          streamId: 7,
          streamIcon: '',
          rating: '',
          categoryId: '',
          containerExtension: 'mkv',
        },
      ],
      new Map(),
      creds,
      'pl-1'
    );
    expect(movies[0].streamUrl).toBe('http://exemple.tv:8080/movie/user/pass/7.mkv');
  });

  it('extrait l’année d’une date de sortie, quel qu’en soit le format', () => {
    const base = {
      num: 1,
      name: 'S',
      seriesId: 1,
      cover: '',
      plot: '',
      cast: '',
      director: '',
      genre: '',
      rating: '',
      categoryId: '',
    };
    expect(mapSeries([{ ...base, releaseDate: '2019-05-01' }], new Map(), 'p')[0].year).toBe(2019);
    expect(mapSeries([{ ...base, releaseDate: '2019' }], new Map(), 'p')[0].year).toBe(2019);
    expect(mapSeries([{ ...base, releaseDate: '' }], new Map(), 'p')[0].year).toBeUndefined();
    // Un nombre à 4 chiffres hors plage crédible ne doit pas passer
    // pour une année.
    expect(mapSeries([{ ...base, releaseDate: '9999' }], new Map(), 'p')[0].year).toBeUndefined();
  });

  it('compte les chaînes réellement présentes dans chaque catégorie', () => {
    const cats = mapLiveCategories(
      [
        { categoryId: '1', categoryName: 'Sport' },
        { categoryId: '2', categoryName: 'Info' },
      ],
      new Map([['1', 12]]),
      'pl-1'
    );
    expect(cats[0].channelCount).toBe(12);
    // Catégorie annoncée par le serveur mais sans aucune chaîne : zéro,
    // pas un nombre inventé.
    expect(cats[1].channelCount).toBe(0);
  });

  it('ne présume ni favori ni historique', () => {
    // Ces deux drapeaux appartiennent au profil, pas au serveur.
    const channels = mapLiveChannels(
      [{ num: 1, name: 'A', streamId: 1, streamIcon: '', epgChannelId: '', categoryId: '' }],
      new Map(),
      creds,
      'pl-1',
      'ts'
    );
    expect(channels[0].isFavorite).toBe(false);
    expect(channels[0].isRecent).toBe(false);
  });
});

describe('mapSeriesInfo', () => {
  const info: XtreamSeriesInfo = {
    name: 'Série B',
    cover: 'http://img/s.png',
    plot: 'Un synopsis.',
    cast: 'Untel',
    director: '',
    genre: 'Drame',
    releaseDate: '2019-05-01',
    rating: '7',
    backdrop: 'http://img/back.png',
    seasons: [{ seasonNumber: 1, name: 'Saison 1', cover: '', airDate: '2019-05-01', episodeCount: 1 }],
    episodes: [
      {
        streamId: 205,
        seasonNumber: 1,
        episodeNumber: 1,
        title: 'Pilote',
        plot: 'Début.',
        image: 'http://img/e1.png',
        durationSecs: 2400,
        containerExtension: 'mkv',
        rating: '8',
        airDate: '2019-05-01',
      },
    ],
  };

  it('construit les adresses de lecture et préfixe les identifiants', () => {
    const details = mapSeriesInfo(info, creds, 'pl-1', 'pl-1:series:5');
    expect(details.seasons[0].id).toBe('pl-1:series:5:season:1');
    expect(details.episodes[0].id).toBe('pl-1:series:5:episode:205');
    expect(details.episodes[0].streamUrl).toBe(
      'http://exemple.tv:8080/series/user/pass/205.mkv'
    );
    expect(details.episodes[0].duration).toBe(2400);
    expect(details.seriesPatch.year).toBe(2019);
    expect(details.seriesPatch.episodeCount).toBe(1);
  });

  it('laisse vides les champs absents du serveur', () => {
    const details = mapSeriesInfo(info, creds, 'pl-1', 'pl-1:series:5');
    expect(details.seriesPatch.director).toBeUndefined();
  });
});

describe('mapVodInfo', () => {
  const movie = {
    id: 'pl-1:movie:7',
    name: 'Film A',
    streamUrl: 'http://exemple.tv:8080/movie/user/pass/7.mkv',
    playlistId: 'pl-1',
    isFavorite: false,
    streamId: 7,
    logo: 'http://img/f.png',
  };

  it('convertit la durée en minutes et n’écrase pas une affiche déjà connue', () => {
    const info: XtreamVodInfo = {
      plot: 'Un film.',
      cast: 'Untel',
      director: 'Unetelle',
      genre: 'Drame',
      releaseDate: '1999-10-15',
      rating: '8.8',
      backdrop: 'http://img/bd.png',
      image: 'http://img/other.png',
      durationSecs: 8340,
      tmdbId: '550',
      containerExtension: 'mkv',
    };
    const patch = mapVodInfo(info, movie);
    expect(patch.plot).toBe('Un film.');
    expect(patch.duration).toBe(139);
    expect(patch.year).toBe(1999);
    expect(patch.logo).toBeUndefined();
  });

  it('n’écrit pas un champ vide', () => {
    const info: XtreamVodInfo = {
      plot: '',
      cast: '',
      director: '',
      genre: '',
      releaseDate: '',
      rating: '',
      backdrop: '',
      image: '',
      durationSecs: 0,
      tmdbId: '',
      containerExtension: '',
    };
    expect(mapVodInfo(info, movie)).toEqual({});
  });
});

describe('syncXtreamCatalog', () => {
  it('rapporte les trois volets du catalogue', async () => {
    mockPortal(FULL_PORTAL);
    const result = await syncXtreamCatalog(creds, 'pl-1');

    expect(result.counts).toEqual({ channels: 1, movies: 1, series: 1 });
    expect(result.catalog.channels[0].name).toBe('Canal Sport');
    expect(result.catalog.movies[0].name).toBe('Film A');
    expect(result.catalog.series[0].name).toBe('Série B');
    expect(result.catalog.liveCategories[0].name).toBe('Sport');
  });

  it('préfère le format m3u8 quand le serveur l’annonce', async () => {
    mockPortal(FULL_PORTAL);
    const result = await syncXtreamCatalog(creds, 'pl-1');
    expect(result.catalog.channels[0].streamUrl).toContain('.m3u8');
    expect(result.catalog.channels[0].streamType).toBe('hls');
  });

  it('retombe sur MPEG-TS quand le serveur ne propose que ts', async () => {
    mockPortal({
      ...FULL_PORTAL,
      auth: {
        ...AUTH_OK,
        user_info: { ...AUTH_OK.user_info, allowed_output_formats: ['ts'] },
      },
    });
    const result = await syncXtreamCatalog(creds, 'pl-1');
    expect(result.catalog.channels[0].streamUrl).toContain('.ts');
    expect(result.catalog.channels[0].streamType).toBe('other');
  });

  it('demande les listes en un seul appel, sans filtre de catégorie', async () => {
    // 300 appels d'une centaine d'entrées coûtent bien plus cher qu'un
    // appel unique : chaque requête paie sa latence.
    const calls = mockPortal(FULL_PORTAL);
    await syncXtreamCatalog(creds, 'pl-1');
    expect(calls.filter((a) => a === 'get_live_streams')).toHaveLength(1);
    expect(calls.filter((a) => a === 'get_vod_streams')).toHaveLength(1);
    expect(calls.filter((a) => a === 'get_series')).toHaveLength(1);
  });

  it('annonce chaque étape dans l’ordre, en terminant par done', async () => {
    mockPortal(FULL_PORTAL);
    const steps: SyncStep[] = [];
    await syncXtreamCatalog(creds, 'pl-1', { onProgress: (p) => steps.push(p.step) });

    expect(steps[0]).toBe('auth');
    expect(steps.at(-1)).toBe('done');
    expect(steps).toContain('live_streams');
  });

  it('livre le direct même si les films et les séries échouent', async () => {
    // Beaucoup d'abonnements ne proposent pas de VOD, et certains
    // portails répondent par une erreur au lieu d'une liste vide.
    mockPortal(FULL_PORTAL, {
      fail: ['get_vod_categories', 'get_vod_streams', 'get_series_categories', 'get_series'],
    });
    const result = await syncXtreamCatalog(creds, 'pl-1');

    expect(result.counts.channels).toBe(1);
    expect(result.counts.movies).toBe(0);
    expect(result.counts.series).toBe(0);
  });

  it('échoue si le direct échoue', async () => {
    // Sans chaînes, il n'y a pas d'application : l'erreur doit remonter.
    mockPortal(FULL_PORTAL, { fail: ['get_live_streams'] });
    await expect(syncXtreamCatalog(creds, 'pl-1')).rejects.toBeInstanceOf(XtreamError);
  });

  it('propage un refus d’authentification sans rien télécharger', async () => {
    const calls = mockPortal({
      ...FULL_PORTAL,
      auth: { user_info: { auth: 0 } },
    });
    await expect(syncXtreamCatalog(creds, 'pl-1')).rejects.toMatchObject({ kind: 'auth' });
    expect(calls).not.toContain('get_live_streams');
  });

  it('remonte l’expiration et le nombre de connexions du compte', async () => {
    mockPortal(FULL_PORTAL);
    const result = await syncXtreamCatalog(creds, 'pl-1');
    expect(result.expiresAt).toBe(new Date(1893456000 * 1000).toISOString());
    expect(result.maxConnections).toBe(2);
    expect(result.allowedOutputFormats).toEqual(['m3u8', 'ts']);
  });

  it('laisse expiresAt vide pour un compte sans date d’expiration', async () => {
    // `null` signifie « illimité ». Le convertir en date du jour
    // afficherait un abonnement expiré à tort.
    mockPortal({
      ...FULL_PORTAL,
      auth: { ...AUTH_OK, user_info: { ...AUTH_OK.user_info, exp_date: null } },
    });
    const result = await syncXtreamCatalog(creds, 'pl-1');
    expect(result.expiresAt).toBeUndefined();
  });

  it('interrompt la synchronisation quand le signal est annulé', async () => {
    mockPortal(FULL_PORTAL);
    const controller = new AbortController();
    controller.abort();
    await expect(
      syncXtreamCatalog(creds, 'pl-1', { signal: controller.signal })
    ).rejects.toSatisfy((err: unknown) => toSourceErrorKind(err) === 'aborted');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Sélection des catégories
// ─────────────────────────────────────────────────────────────────────

/**
 * Portail dont chaque catégorie a un contenu distinct.
 *
 * Le mock principal ignore `category_id` : il renverrait la même chose
 * pour toutes les catégories, et un code qui oublierait le filtre
 * passerait quand même. Celui-ci répond réellement par catégorie et
 * enregistre les URL complètes, seule façon de prouver *ce qui* a été
 * demandé.
 */
function mockPortalByCategory() {
  const urls: string[] = [];

  const live: Record<string, unknown[]> = {
    '1': [{ num: 1, name: 'FR TF1', stream_id: 11, category_id: '1' }],
    '2': [
      { num: 2, name: 'AR Sport 1', stream_id: 21, category_id: '2' },
      { num: 3, name: 'AR Sport 2', stream_id: 22, category_id: '2' },
    ],
  };
  const vod: Record<string, unknown[]> = {
    '9': [{ num: 1, name: 'Film FR', stream_id: 91, category_id: '9' }],
    '8': [{ num: 2, name: 'Film AR', stream_id: 81, category_id: '8' }],
  };
  const series: Record<string, unknown[]> = {
    '3': [{ num: 1, name: 'Série FR', series_id: 31, category_id: '3' }],
  };

  const all = (map: Record<string, unknown[]>) => Object.values(map).flat();

  vi.stubGlobal('fetch', async (input: string | URL, init?: { signal?: AbortSignal }) => {
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const url = new URL(String(input));
    urls.push(url.search);
    const action = url.searchParams.get('action') ?? 'auth';
    const categoryId = url.searchParams.get('category_id');

    const pick = (map: Record<string, unknown[]>) =>
      categoryId === null ? all(map) : (map[categoryId] ?? []);

    const body: Record<string, unknown> = {
      auth: AUTH_OK,
      get_live_categories: [
        { category_id: '1', category_name: 'FR | Général', parent_id: 0 },
        { category_id: '2', category_name: 'AR Sport', parent_id: 0 },
      ],
      get_vod_categories: [
        { category_id: '9', category_name: 'FR Films', parent_id: 0 },
        { category_id: '8', category_name: 'AR Films', parent_id: 0 },
      ],
      get_series_categories: [{ category_id: '3', category_name: 'FR Séries', parent_id: 0 }],
      get_live_streams: pick(live),
      get_vod_streams: pick(vod),
      get_series: pick(series),
    };

    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify(body[action] ?? []),
    };
  });

  return urls;
}

describe('syncXtreamCatalog — sélection des catégories', () => {
  it('sans sélection, télécharge tout en un seul appel par famille', async () => {
    // Comportement historique : les sources créées avant ce réglage
    // ne doivent rien voir changer.
    const urls = mockPortalByCategory();
    const result = await syncXtreamCatalog(creds, 'p1');

    expect(result.counts.channels).toBe(3);
    expect(result.counts.movies).toBe(2);
    expect(urls.filter((u) => u.includes('category_id'))).toEqual([]);
  });

  it('ne demande que les catégories cochées', async () => {
    const urls = mockPortalByCategory();
    const result = await syncXtreamCatalog(creds, 'p1', {
      selection: { live: ['1'], vod: ['9'], series: ['3'] },
    });

    expect(result.counts.channels).toBe(1);
    expect(result.catalog.channels[0].name).toBe('FR TF1');
    expect(result.counts.movies).toBe(1);
    expect(result.catalog.movies[0].name).toBe('Film FR');

    // Preuve que le filtre est appliqué côté serveur et non après coup.
    expect(urls.some((u) => u.includes('category_id=2'))).toBe(false);
    expect(urls.some((u) => u.includes('category_id=8'))).toBe(false);
  });

  it('interroge chaque catégorie cochée', async () => {
    const urls = mockPortalByCategory();
    const result = await syncXtreamCatalog(creds, 'p1', {
      selection: { live: ['1', '2'], vod: [], series: [] },
    });

    expect(result.counts.channels).toBe(3);
    expect(urls.filter((u) => u.includes('get_live_streams')).length).toBe(2);
  });

  it('ne contacte pas le serveur pour une famille au tableau vide', async () => {
    // [] veut dire « rien », et non « tout » : la distinction est le
    // point le plus facile à casser de cette fonctionnalité.
    const urls = mockPortalByCategory();
    const result = await syncXtreamCatalog(creds, 'p1', {
      selection: { live: ['1'], vod: [], series: [] },
    });

    expect(result.counts.movies).toBe(0);
    expect(result.counts.series).toBe(0);
    expect(urls.some((u) => u.includes('get_vod_streams'))).toBe(false);
    expect(urls.some((u) => u.includes('action=get_series&'))).toBe(false);
  });

  it("n'enregistre que les catégories retenues", async () => {
    // Sinon l'application afficherait des rubriques sans contenu.
    mockPortalByCategory();
    const result = await syncXtreamCatalog(creds, 'p1', {
      selection: { live: ['1'], vod: [], series: [] },
    });

    expect(result.catalog.liveCategories.map((c) => c.name)).toEqual(['FR | Général']);
  });

  it('compte les chaînes réellement rapportées', async () => {
    mockPortalByCategory();
    const result = await syncXtreamCatalog(creds, 'p1', {
      selection: { live: ['2'], vod: [], series: [] },
    });

    expect(result.catalog.liveCategories[0].channelCount).toBe(2);
  });

  it('tamponne category_id quand le portail l’omet à l’appel par catégorie', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (input: string | URL, init?: { signal?: AbortSignal }) => {
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const url = new URL(String(input));
      urls.push(url.search);
      const action = url.searchParams.get('action') ?? 'auth';
      const body: Record<string, unknown> = {
        auth: AUTH_OK,
        get_live_categories: [{ category_id: '1', category_name: 'FR | Général', parent_id: 0 }],
        get_live_streams: [{ num: 1, name: 'FR TF1', stream_id: 11 }],
        get_vod_categories: [],
        get_vod_streams: [],
        get_series_categories: [],
        get_series: [],
      };
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(body[action] ?? []),
      };
    });

    const result = await syncXtreamCatalog(creds, 'p1', {
      selection: { live: ['1'], vod: [], series: [] },
    });
    expect(result.catalog.channels[0].categoryId).toBe('p1:livecat:1');
    expect(result.catalog.channels[0].categoryName).toBe('FR | Général');
    expect(result.catalog.liveCategories[0].id).toBe('p1:livecat:1');
  });

  it('importe les sous-catégories d’un parent coché', async () => {
    vi.stubGlobal('fetch', async (input: string | URL, init?: { signal?: AbortSignal }) => {
      if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const url = new URL(String(input));
      const action = url.searchParams.get('action') ?? 'auth';
      const categoryId = url.searchParams.get('category_id');
      const live: Record<string, unknown[]> = {
        '1': [],
        '10': [{ num: 1, name: 'TF1', stream_id: 11, category_id: '10' }],
      };
      const body: Record<string, unknown> = {
        auth: AUTH_OK,
        get_live_categories: [
          { category_id: '1', category_name: 'France', parent_id: 0 },
          { category_id: '10', category_name: 'FR | TF1', parent_id: 1 },
        ],
        get_live_streams: categoryId === null ? Object.values(live).flat() : (live[categoryId] ?? []),
        get_vod_categories: [],
        get_vod_streams: [],
        get_series_categories: [],
        get_series: [],
      };
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(body[action] ?? []),
      };
    });

    const result = await syncXtreamCatalog(creds, 'p1', {
      selection: { live: ['1'], vod: [], series: [] },
    });
    expect(result.counts.channels).toBe(1);
    expect(result.catalog.channels[0].name).toBe('TF1');
    expect(result.catalog.liveCategories.map((c) => c.name).sort()).toEqual(['FR | TF1', 'France']);
  });

  it('ignore une catégorie cochée que le serveur ne connaît plus', async () => {
    // Un fournisseur renumérote sans prévenir : la synchronisation doit
    // se poursuivre avec ce qui subsiste, pas échouer.
    mockPortalByCategory();
    const result = await syncXtreamCatalog(creds, 'p1', {
      selection: { live: ['1', '404'], vod: [], series: [] },
    });

    expect(result.counts.channels).toBe(1);
    expect(result.catalog.liveCategories).toHaveLength(1);
  });
});

describe('fetchCategoryCatalog', () => {
  it('rapporte les trois familles sans télécharger de contenu', async () => {
    const urls = mockPortalByCategory();
    const catalog = await fetchCategoryCatalog(creds);

    expect(catalog.live.map((c) => c.categoryName)).toEqual(['FR | Général', 'AR Sport']);
    expect(catalog.vod).toHaveLength(2);
    expect(catalog.series).toHaveLength(1);

    // Le point de la fonctionnalité : aucune chaîne, aucun film.
    expect(urls.some((u) => u.includes('get_live_streams'))).toBe(false);
    expect(urls.some((u) => u.includes('get_vod_streams'))).toBe(false);
  });

  it('tolère un portail sans films ni séries', async () => {
    // Beaucoup d'abonnements ne proposent que du direct.
    mockPortal(FULL_PORTAL, { fail: ['get_vod_categories', 'get_series_categories'] });
    const catalog = await fetchCategoryCatalog(creds);

    expect(catalog.live).toHaveLength(1);
    expect(catalog.vod).toEqual([]);
    expect(catalog.series).toEqual([]);
  });

  it('remonte un échec sur les catégories de direct', async () => {
    // Un portail sans aucune catégorie de chaînes est cassé : le taire
    // ferait valider un écran vide sans explication.
    mockPortal(FULL_PORTAL, { fail: ['get_live_categories'] });
    await expect(fetchCategoryCatalog(creds)).rejects.toThrow();
  });

  it('remonte une annulation volontaire', async () => {
    mockPortalByCategory();
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchCategoryCatalog(creds, { signal: controller.signal })
    ).rejects.toThrow();
  });
});
