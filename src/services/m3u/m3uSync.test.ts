import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  syncM3UFromText,
  syncM3UFromUrl,
  assertM3UUrl,
  detectStreamType,
  shortHash,
  mapEntriesToChannels,
  buildCategories,
  toM3UErrorKind,
  M3UError,
} from './m3uSync';
import type { M3UEntry } from '@/types';

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="TF1.fr" tvg-logo="http://img/tf1.png" group-title="Généralistes",TF1
http://serveur:8080/live/u/p/1.ts
#EXTINF:-1 tvg-id="M6.fr" group-title="Généralistes",M6
http://serveur:8080/live/u/p/2.m3u8
#EXTINF:-1 tvg-id="ESPN" group-title="Sport",ESPN
http://serveur:8080/live/u/p/3.ts
`;

function mockFetch(body: string, { status = 200 }: { status?: number } = {}) {
  vi.stubGlobal('fetch', async (_url: string, init?: { signal?: AbortSignal }) => {
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 404 ? 'Not Found' : 'OK',
      text: async () => body,
    };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('assertM3UUrl', () => {
  it('accepte http et https', () => {
    expect(assertM3UUrl('http://a.tv/list.m3u')).toBe('http://a.tv/list.m3u');
    expect(assertM3UUrl('  https://a.tv/list.m3u  ')).toBe('https://a.tv/list.m3u');
  });

  it('refuse une adresse vide ou illisible', () => {
    expect(() => assertM3UUrl('')).toThrow(M3UError);
    expect(() => assertM3UUrl('   ')).toThrow(M3UError);
    // Sans schéma, `fetch` résoudrait contre la page courante et
    // interrogerait le site lui-même.
    expect(() => assertM3UUrl('serveur.tv/list.m3u')).toThrow(M3UError);
  });

  it('refuse un protocole non web avec le code invalid_url', () => {
    // `expect(fn).toMatchObject(...)` comparerait la fonction elle-même
    // sans jamais l'appeler : il faut capturer l'erreur pour inspecter
    // son code.
    const kindOf = (url: string) => {
      try {
        assertM3UUrl(url);
        return null;
      } catch (err) {
        return toM3UErrorKind(err);
      }
    };
    expect(kindOf('ftp://a.tv/list.m3u')).toBe('invalid_url');
    expect(kindOf('file:///etc/passwd')).toBe('invalid_url');
  });
});

describe('detectStreamType', () => {
  it('reconnaît HLS, DASH et RTMP', () => {
    expect(detectStreamType('http://a.tv/live/1.m3u8')).toBe('hls');
    expect(detectStreamType('http://a.tv/live/1.mpd')).toBe('dash');
    expect(detectStreamType('rtmp://a.tv/live/1')).toBe('rtmp');
    expect(detectStreamType('http://a.tv/live/1.ts')).toBe('other');
  });

  it('ignore la chaîne de requête', () => {
    // Une recherche de sous-chaîne se ferait piéger par un jeton
    // contenant « .m3u8 » ou par « ?type=.ts ».
    expect(detectStreamType('http://a.tv/live/1.ts?token=abc.m3u8')).toBe('other');
    expect(detectStreamType('http://a.tv/live/1.m3u8?token=xyz')).toBe('hls');
  });
});

describe('shortHash', () => {
  it('donne toujours le même résultat pour la même entrée', () => {
    // C'est la propriété essentielle : des identifiants instables
    // videraient les favoris à chaque réimport.
    expect(shortHash('http://a.tv/1.ts')).toBe(shortHash('http://a.tv/1.ts'));
  });

  it('distingue deux adresses proches', () => {
    expect(shortHash('http://a.tv/1.ts')).not.toBe(shortHash('http://a.tv/2.ts'));
  });
});

describe('mapEntriesToChannels', () => {
  const entry = (over: Partial<M3UEntry> = {}): M3UEntry => ({
    name: 'TF1',
    streamUrl: 'http://a.tv/1.ts',
    ...over,
  });

  it('reporte les attributs du fichier sur la chaîne', () => {
    const { channels } = mapEntriesToChannels(
      [
        entry({
          tvgId: 'TF1.fr',
          tvgLogo: 'http://img/tf1.png',
          groupTitle: 'Généralistes',
          tvgCountry: 'FR',
          tvgLanguage: 'Français',
        }),
      ],
      'pl-1'
    );

    expect(channels[0].name).toBe('TF1');
    expect(channels[0].logo).toBe('http://img/tf1.png');
    expect(channels[0].categoryName).toBe('Généralistes');
    expect(channels[0].country).toBe('FR');
    expect(channels[0].language).toBe('Français');
    // `tvg-id` est la clé de rattachement au guide XMLTV.
    expect(channels[0].epgChannelId).toBe('TF1.fr');
  });

  it('préfixe les identifiants par la source', () => {
    const { channels } = mapEntriesToChannels([entry()], 'pl-1');
    expect(channels[0].id.startsWith('pl-1:m3u:')).toBe(true);
    expect(channels[0].playlistId).toBe('pl-1');
  });

  it('produit des identifiants stables entre deux imports', () => {
    // Même fichier réimporté : les identifiants doivent coïncider,
    // sinon favoris et reprise de lecture pointent dans le vide.
    const a = mapEntriesToChannels([entry()], 'pl-1').channels[0].id;
    const b = mapEntriesToChannels([entry()], 'pl-1').channels[0].id;
    expect(a).toBe(b);
  });

  it('conserve les identifiants quand une chaîne est insérée en tête', () => {
    // Une numérotation par position serait décalée par cette insertion.
    const first = mapEntriesToChannels([entry()], 'pl-1').channels[0].id;
    const { channels } = mapEntriesToChannels(
      [entry({ name: 'Nouvelle', streamUrl: 'http://a.tv/0.ts' }), entry()],
      'pl-1'
    );
    expect(channels[1].id).toBe(first);
  });

  it('écarte les doublons et les compte', () => {
    // Beaucoup de playlists répètent la même chaîne dans plusieurs
    // groupes ; deux entrées porteraient alors le même identifiant.
    const { channels, duplicatesRemoved } = mapEntriesToChannels(
      [entry(), entry({ name: 'TF1 HD' }), entry({ streamUrl: 'http://a.tv/2.ts' })],
      'pl-1'
    );
    expect(channels).toHaveLength(2);
    expect(duplicatesRemoved).toBe(1);
    // C'est la première occurrence qui est retenue.
    expect(channels[0].name).toBe('TF1');
  });

  it('laisse la catégorie vide quand le fichier n’en déclare pas', () => {
    const { channels } = mapEntriesToChannels([entry({ groupTitle: undefined })], 'pl-1');
    expect(channels[0].categoryId).toBeUndefined();
    expect(channels[0].categoryName).toBeUndefined();
  });
});

describe('buildCategories', () => {
  it('regroupe les chaînes et respecte l’ordre du fichier', () => {
    // Le classement du fournisseur porte une intention ; un tri
    // alphabétique la détruirait.
    const { channels } = mapEntriesToChannels(
      [
        { name: 'ESPN', streamUrl: 'http://a.tv/3.ts', groupTitle: 'Sport' },
        { name: 'TF1', streamUrl: 'http://a.tv/1.ts', groupTitle: 'Généralistes' },
        { name: 'M6', streamUrl: 'http://a.tv/2.ts', groupTitle: 'Généralistes' },
      ],
      'pl-1'
    );
    const cats = buildCategories(channels, 'pl-1');

    expect(cats.map((c) => c.name)).toEqual(['Sport', 'Généralistes']);
    expect(cats[0].channelCount).toBe(1);
    expect(cats[1].channelCount).toBe(2);
  });

  it('ignore les chaînes sans groupe', () => {
    const { channels } = mapEntriesToChannels(
      [{ name: 'Sans groupe', streamUrl: 'http://a.tv/1.ts' }],
      'pl-1'
    );
    expect(buildCategories(channels, 'pl-1')).toHaveLength(0);
  });
});

describe('toM3UErrorKind', () => {
  it('conserve le code d’une M3UError', () => {
    expect(toM3UErrorKind(new M3UError('timeout', 'trop long'))).toBe('timeout');
  });

  it('reconnaît une annulation', () => {
    expect(toM3UErrorKind(new DOMException('stop', 'AbortError'))).toBe('aborted');
  });

  it('traduit le TypeError de fetch en panne réseau', () => {
    // C'est ainsi qu'un blocage CORS se présente : le navigateur
    // masque la cause exacte.
    expect(toM3UErrorKind(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('range le reste dans unknown', () => {
    expect(toM3UErrorKind(new Error('boum'))).toBe('unknown');
    expect(toM3UErrorKind('texte')).toBe('unknown');
  });
});

describe('syncM3UFromText', () => {
  it('importe les chaînes et reconstitue les catégories', async () => {
    const result = await syncM3UFromText(SAMPLE, 'pl-1');

    expect(result.counts.channels).toBe(3);
    expect(result.catalog.channels[0].name).toBe('TF1');
    expect(result.catalog.liveCategories.map((c) => c.name)).toEqual([
      'Généralistes',
      'Sport',
    ]);
    expect(result.catalog.liveCategories[0].channelCount).toBe(2);
  });

  it('déduit le type de flux de chaque adresse', async () => {
    const result = await syncM3UFromText(SAMPLE, 'pl-1');
    expect(result.catalog.channels[0].streamType).toBe('other'); // .ts
    expect(result.catalog.channels[1].streamType).toBe('hls'); // .m3u8
  });

  it('annonce la progression et termine par done', async () => {
    const steps: string[] = [];
    await syncM3UFromText(SAMPLE, 'pl-1', {
      onProgress: (p) => steps.push(p.step),
    });
    expect(steps).toContain('parse');
    expect(steps.at(-1)).toBe('done');
  });

  it('remonte les anomalies sans refuser le fichier', async () => {
    // Un fichier partiellement valide s'importe : refuser des milliers
    // de chaînes correctes pour une ligne bancale serait absurde.
    const result = await syncM3UFromText(
      `#EXTINF:-1,Sans en-tête
http://a.tv/1.ts
`,
      'pl-1'
    );
    expect(result.counts.channels).toBe(1);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('#EXTM3U');
  });

  it('refuse un contenu sans aucune chaîne exploitable', async () => {
    // Cas courant : une page d'erreur HTML servie avec un code 200.
    await expect(
      syncM3UFromText('<html><body>404</body></html>', 'pl-1')
    ).rejects.toMatchObject({ kind: 'parse' });
  });

  it('refuse un fichier vide', async () => {
    await expect(syncM3UFromText('', 'pl-1')).rejects.toMatchObject({ kind: 'parse' });
  });

  it('s’interrompt sur annulation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      syncM3UFromText(SAMPLE, 'pl-1', { signal: controller.signal })
    ).rejects.toSatisfy((err: unknown) => toM3UErrorKind(err) === 'aborted');
  });
});

describe('syncM3UFromUrl', () => {
  it('télécharge puis analyse', async () => {
    mockFetch(SAMPLE);
    const result = await syncM3UFromUrl('http://a.tv/list.m3u', 'pl-1');
    expect(result.counts.channels).toBe(3);
  });

  it('signale le téléchargement avant l’analyse', async () => {
    mockFetch(SAMPLE);
    const steps: string[] = [];
    await syncM3UFromUrl('http://a.tv/list.m3u', 'pl-1', {
      onProgress: (p) => steps.push(p.step),
    });
    expect(steps[0]).toBe('download');
    expect(steps).toContain('parse');
  });

  it('refuse l’adresse avant tout appel réseau', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await expect(syncM3UFromUrl('pas-une-adresse', 'pl-1')).rejects.toMatchObject({
      kind: 'invalid_url',
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('convertit une réponse en erreur HTTP en code http', async () => {
    mockFetch('', { status: 404 });
    await expect(syncM3UFromUrl('http://a.tv/list.m3u', 'pl-1')).rejects.toMatchObject({
      kind: 'http',
    });
  });

  it('convertit une panne de fetch en code network', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(syncM3UFromUrl('http://a.tv/list.m3u', 'pl-1')).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('distingue une annulation par l’utilisateur d’un délai dépassé', async () => {
    // Les deux produisent un AbortError ; les confondre afficherait
    // « annulé » alors que personne n'a rien annulé.
    mockFetch(SAMPLE);
    const controller = new AbortController();
    controller.abort();
    await expect(
      syncM3UFromUrl('http://a.tv/list.m3u', 'pl-1', { signal: controller.signal })
    ).rejects.toMatchObject({ kind: 'aborted' });
  });
});
