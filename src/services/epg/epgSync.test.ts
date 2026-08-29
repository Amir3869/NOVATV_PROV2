import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildXtreamEPGUrl,
  mapEPGPrograms,
  findCurrentAndNext,
  programProgressPercent,
  toEPGErrorKind,
  EPGSyncError,
  syncEPG,
  MAX_EPG_BYTES,
} from './epgSync';
import type { ParsedEPGProgram } from './epgService';
import type { EPGProgram, LiveChannel } from '@/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

function program(over: Partial<ParsedEPGProgram> = {}): ParsedEPGProgram {
  return {
    channelId: 'tf1.fr',
    title: 'Journal',
    start: new Date('2026-08-20T19:00:00Z'),
    stop: new Date('2026-08-20T19:40:00Z'),
    ...over,
  };
}

function channel(over: Partial<LiveChannel> = {}): LiveChannel {
  return {
    id: 'pl1:live:1',
    name: 'TF1',
    streamUrl: 'http://x/live/u/p/1.m3u8',
    streamType: 'hls',
    playlistId: 'pl1',
    isFavorite: false,
    isRecent: false,
    ...over,
  };
}

describe('buildXtreamEPGUrl', () => {
  it('vise xmltv.php et non player_api.php', () => {
    const url = buildXtreamEPGUrl({
      serverUrl: 'http://exemple.com:8080',
      username: 'bob',
      password: 'secret',
    });
    expect(url).toBe('http://exemple.com:8080/xmltv.php?username=bob&password=secret');
  });

  it('encode les caracteres speciaux du mot de passe', () => {
    const url = buildXtreamEPGUrl({
      serverUrl: 'http://exemple.com',
      username: 'a&b',
      password: 'p=1&q=2',
    });
    // Sans encodage, le `&` couperait la requete en deux parametres.
    expect(url).toContain('username=a%26b');
    expect(url).toContain('password=p%3D1%26q%3D2');
  });

  it('supprime la barre oblique finale du serveur', () => {
    const url = buildXtreamEPGUrl({
      serverUrl: 'http://exemple.com:8080/',
      username: 'u',
      password: 'p',
    });
    expect(url).not.toContain('//xmltv.php');
  });
});

describe('mapEPGPrograms', () => {
  const mapping = new Map([['pl1:live:1', 'tf1.fr']]);

  it('convertit les dates en texte ISO', () => {
    const out = mapEPGPrograms([program()], mapping, 'pl1');
    expect(out).toHaveLength(1);
    expect(out[0].start).toBe('2026-08-20T19:00:00.000Z');
    expect(out[0].stop).toBe('2026-08-20T19:40:00.000Z');
  });

  it('reattribue le programme a la chaine de la source', () => {
    const out = mapEPGPrograms([program()], mapping, 'pl1');
    // Et non 'tf1.fr' : les ecrans filtrent sur l'identifiant de la source.
    expect(out[0].channelId).toBe('pl1:live:1');
  });

  it('ecarte les programmes des chaines absentes de la source', () => {
    const out = mapEPGPrograms([program({ channelId: 'inconnue' })], mapping, 'pl1');
    expect(out).toHaveLength(0);
  });

  it('duplique le programme quand deux chaines pointent le meme guide', () => {
    const multi = new Map([
      ['pl1:live:1', 'tf1.fr'],
      ['pl1:live:2', 'tf1.fr'],
    ]);
    const out = mapEPGPrograms([program()], multi, 'pl1');
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.channelId).sort()).toEqual(['pl1:live:1', 'pl1:live:2']);
  });

  it('donne deux identifiants distincts aux deux copies', () => {
    const multi = new Map([
      ['pl1:live:1', 'tf1.fr'],
      ['pl1:live:2', 'tf1.fr'],
    ]);
    const out = mapEPGPrograms([program()], multi, 'pl1');
    expect(out[0].id).not.toBe(out[1].id);
  });

  it('produit un identifiant stable entre deux appels', () => {
    const a = mapEPGPrograms([program()], mapping, 'pl1');
    const b = mapEPGPrograms([program()], mapping, 'pl1');
    // Sinon une resynchronisation invaliderait tous les rappels poses.
    expect(a[0].id).toBe(b[0].id);
  });

  it('distingue deux emissions differentes a la meme heure', () => {
    const out = mapEPGPrograms(
      [program(), program({ title: 'Meteo' })],
      mapping,
      'pl1'
    );
    expect(out[0].id).not.toBe(out[1].id);
  });

  it('prefixe l identifiant par la source', () => {
    const out = mapEPGPrograms([program()], mapping, 'pl1');
    expect(out[0].id.startsWith('pl1:epg:')).toBe(true);
  });

  it('reporte les champs facultatifs', () => {
    const out = mapEPGPrograms(
      [program({ description: 'Info', category: 'News', episodeNum: 'S1E2' })],
      mapping,
      'pl1'
    );
    expect(out[0].description).toBe('Info');
    expect(out[0].category).toBe('News');
    expect(out[0].episodeNum).toBe('S1E2');
  });
});

describe('findCurrentAndNext', () => {
  const now = new Date('2026-08-20T19:10:00Z');
  const programs: EPGProgram[] = [
    {
      id: 'a',
      channelId: 'c1',
      title: 'Avant',
      start: '2026-08-20T18:00:00Z',
      stop: '2026-08-20T19:00:00Z',
    },
    {
      id: 'b',
      channelId: 'c1',
      title: 'Maintenant',
      start: '2026-08-20T19:00:00Z',
      stop: '2026-08-20T19:40:00Z',
    },
    {
      id: 'c',
      channelId: 'c1',
      title: 'Apres',
      start: '2026-08-20T19:40:00Z',
      stop: '2026-08-20T20:00:00Z',
    },
    {
      id: 'd',
      channelId: 'c2',
      title: 'Autre chaine',
      start: '2026-08-20T19:00:00Z',
      stop: '2026-08-20T20:00:00Z',
    },
  ];

  it('trouve le programme en cours', () => {
    expect(findCurrentAndNext(programs, 'c1', now).current?.title).toBe('Maintenant');
  });

  it('trouve le programme suivant le plus proche', () => {
    expect(findCurrentAndNext(programs, 'c1', now).next?.title).toBe('Apres');
  });

  it('ignore les programmes des autres chaines', () => {
    const r = findCurrentAndNext(programs, 'c1', now);
    expect(r.current?.channelId).toBe('c1');
    expect(r.next?.channelId).toBe('c1');
  });

  it('renvoie null quand la chaine n a aucun programme', () => {
    const r = findCurrentAndNext(programs, 'inconnue', now);
    expect(r.current).toBeNull();
    expect(r.next).toBeNull();
  });

  it('exclut la borne de fin du programme en cours', () => {
    // A 19h40 pile, « Maintenant » est fini et « Apres » commence.
    const r = findCurrentAndNext(programs, 'c1', new Date('2026-08-20T19:40:00Z'));
    expect(r.current?.title).toBe('Apres');
  });

  it('ignore une date illisible sans planter', () => {
    const casses: EPGProgram[] = [
      { id: 'x', channelId: 'c1', title: 'Casse', start: 'n importe quoi', stop: 'idem' },
    ];
    expect(findCurrentAndNext(casses, 'c1', now).current).toBeNull();
  });
});

describe('programProgressPercent', () => {
  const p: EPGProgram = {
    id: 'a',
    channelId: 'c1',
    title: 'T',
    start: '2026-08-20T19:00:00Z',
    stop: '2026-08-20T20:00:00Z',
  };

  it('calcule le pourcentage ecoule', () => {
    expect(programProgressPercent(p, new Date('2026-08-20T19:30:00Z'))).toBe(50);
  });

  it('borne a 0 avant le debut', () => {
    expect(programProgressPercent(p, new Date('2026-08-20T18:00:00Z'))).toBe(0);
  });

  it('borne a 100 apres la fin', () => {
    expect(programProgressPercent(p, new Date('2026-08-20T23:00:00Z'))).toBe(100);
  });

  it('renvoie undefined sur des dates inexploitables', () => {
    const casse: EPGProgram = { ...p, stop: '2026-08-20T18:00:00Z' };
    // Et non 0 : une barre a zero laisserait croire que ca vient de commencer.
    expect(programProgressPercent(casse)).toBeUndefined();
  });
});

describe('toEPGErrorKind', () => {
  it('lit le code porte par EPGSyncError', () => {
    expect(toEPGErrorKind(new EPGSyncError('timeout', 'peu importe'))).toBe('timeout');
  });

  it('reconnait une annulation', () => {
    expect(toEPGErrorKind(new DOMException('stop', 'AbortError'))).toBe('aborted');
  });

  it('retombe sur unknown pour une valeur quelconque', () => {
    expect(toEPGErrorKind('texte nu')).toBe('unknown');
  });
});

describe('syncEPG', () => {
  it('refuse de travailler sans chaine a apparier', async () => {
    await expect(syncEPG('http://x/xmltv.php', [], 'pl1')).rejects.toThrow(EPGSyncError);
  });

  it('signale un guide trop volumineux avant de le lire', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<tv></tv>', {
          status: 200,
          headers: { 'content-length': String(MAX_EPG_BYTES + 1) },
        })
      )
    );

    const err = await syncEPG('http://x/xmltv.php', [channel()], 'pl1').catch((e) => e);
    expect(err).toBeInstanceOf(EPGSyncError);
    expect(toEPGErrorKind(err)).toBe('bad_response');
  });

  it('traduit un 403 en erreur d authentification', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('non', { status: 403 })));

    const err = await syncEPG('http://x/xmltv.php', [channel()], 'pl1').catch((e) => e);
    expect(toEPGErrorKind(err)).toBe('auth');
  });

  it('traduit un 500 en erreur http', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boum', { status: 500 })));

    const err = await syncEPG('http://x/xmltv.php', [channel()], 'pl1').catch((e) => e);
    expect(toEPGErrorKind(err)).toBe('http');
  });

  it('traduit une panne reseau', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );

    const err = await syncEPG('http://x/xmltv.php', [channel()], 'pl1').catch((e) => e);
    expect(toEPGErrorKind(err)).toBe('network');
  });
});
