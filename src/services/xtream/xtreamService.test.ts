import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  xtreamService,
  XtreamError,
  normalizeServerUrl,
  type XtreamCredentials,
} from './xtreamService';

const creds: XtreamCredentials = {
  serverUrl: 'http://exemple.tv:8080',
  username: 'user',
  password: 'pass',
};

/**
 * Remplace `fetch` par une réponse contrôlée.
 * `raw` permet de simuler un corps qui n'est pas du JSON — le cas des
 * portails en panne qui renvoient une page HTML avec un code 200.
 */
function mockFetch(
  payload: unknown,
  { status = 200, raw = null }: { status?: number; raw?: string | null } = {}
) {
  vi.stubGlobal('fetch', async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => raw ?? JSON.stringify(payload),
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('conversion des réponses de l’API', () => {
  /**
   * Le défaut central de l'ancienne version : `player_api.php` renvoie
   * ses champs en snake_case, le code les typait en camelCase sans
   * conversion. TypeScript ne pouvait rien signaler puisque
   * `JSON.parse` renvoie `any` — à l'exécution, tous ces champs
   * valaient `undefined`.
   */
  it('convertit les champs snake_case d’une chaîne en direct', async () => {
    mockFetch([
      {
        num: 1,
        name: 'TF1',
        stream_type: 'live',
        stream_id: 1234,
        stream_icon: 'http://exemple.tv/logo.png',
        epg_channel_id: 'TF1.fr',
        added: '1700000000',
        category_id: '5',
        tv_archive: 1,
        tv_archive_duration: 7,
      },
    ]);

    const [ch] = await xtreamService.getLiveStreams(creds);

    expect(ch.streamId).toBe(1234);
    expect(ch.streamIcon).toBe('http://exemple.tv/logo.png');
    expect(ch.epgChannelId).toBe('TF1.fr');
    expect(ch.categoryId).toBe('5');
    expect(ch.hasArchive).toBe(true);
    expect(ch.archiveDurationDays).toBe(7);
  });

  /**
   * Les portails ne sont pas cohérents entre eux : le même champ arrive
   * tantôt en nombre, tantôt en chaîne. La conversion doit absorber les
   * deux formes.
   */
  it('normalise un stream_id transmis en chaîne', async () => {
    mockFetch([{ stream_id: '99', name: 'X', category_id: 7 }]);
    const [ch] = await xtreamService.getLiveStreams(creds);
    expect(ch.streamId).toBe(99);
    expect(typeof ch.streamId).toBe('number');
  });

  it('normalise un category_id transmis en nombre', async () => {
    mockFetch([{ stream_id: '99', name: 'X', category_id: 7 }]);
    const [ch] = await xtreamService.getLiveStreams(creds);
    expect(ch.categoryId).toBe('7');
    expect(typeof ch.categoryId).toBe('string');
  });
});

describe('authentification', () => {
  it('accepte un compte actif et convertit ses champs', async () => {
    mockFetch({
      user_info: {
        auth: 1,
        status: 'Active',
        username: 'u',
        max_connections: '2',
        active_cons: '1',
        is_trial: '0',
        exp_date: '1800000000',
        allowed_output_formats: ['m3u8', 'ts'],
      },
      server_info: { url: 'exemple.tv', port: '8080', server_protocol: 'http' },
    });

    const info = await xtreamService.getAccountInfo(creds);

    expect(info.userInfo.status).toBe('Active');
    expect(info.userInfo.maxConnections).toBe(2);
    expect(info.userInfo.expiresAt).toBeInstanceOf(Date);
    expect(info.userInfo.allowedOutputFormats).toEqual(['m3u8', 'ts']);
  });

  it('rejette des identifiants refusés avec un message clair', async () => {
    mockFetch({ user_info: { auth: 0 } });
    await expect(xtreamService.getAccountInfo(creds)).rejects.toMatchObject({
      kind: 'auth',
    });
  });

  it('distingue un compte expiré d’un identifiant erroné', async () => {
    mockFetch({ user_info: { auth: 1, status: 'Expired' } });
    try {
      await xtreamService.getAccountInfo(creds);
      expect.unreachable('une erreur était attendue');
    } catch (err) {
      expect(err).toBeInstanceOf(XtreamError);
      expect((err as XtreamError).kind).toBe('account_inactive');
      expect((err as XtreamError).userMessage).toMatch(/expir/i);
    }
  });
});

describe('réponses inattendues du serveur', () => {
  /**
   * Cas fréquent : le portail est en panne et son serveur web renvoie
   * une page HTML d'erreur avec un code 200. Sans contrôle,
   * `JSON.parse` échoue et l'utilisateur voit une erreur technique
   * incompréhensible.
   */
  it('intercepte une page HTML servie en HTTP 200', async () => {
    mockFetch(null, { raw: '<html><body>502 Bad Gateway</body></html>' });
    await expect(xtreamService.getLiveStreams(creds)).rejects.toMatchObject({
      kind: 'bad_response',
    });
  });

  it('rejette un objet là où un tableau est attendu', async () => {
    mockFetch({ error: 'no permission' });
    await expect(xtreamService.getLiveStreams(creds)).rejects.toMatchObject({
      kind: 'bad_response',
    });
  });

  it('traduit une erreur HTTP', async () => {
    mockFetch(null, { status: 401, raw: 'Unauthorized' });
    await expect(xtreamService.getLiveStreams(creds)).rejects.toBeInstanceOf(XtreamError);
  });

  it('traduit une panne réseau en message actionnable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    try {
      await xtreamService.getLiveStreams(creds);
      expect.unreachable('une erreur était attendue');
    } catch (err) {
      expect((err as XtreamError).kind).toBe('network');
      expect((err as XtreamError).userMessage.length).toBeGreaterThan(10);
    }
  });

  /** Un message d'erreur ne doit jamais exposer les identifiants. */
  it('ne divulgue pas le mot de passe dans ses messages', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    try {
      await xtreamService.getLiveStreams(creds);
      expect.unreachable('une erreur était attendue');
    } catch (err) {
      const e = err as XtreamError;
      expect(e.userMessage).not.toContain(creds.password);
      expect(e.message).not.toContain(creds.password);
    }
  });
});

describe('URL de lecture', () => {
  /**
   * L'ancienne version concaténait identifiant et mot de passe bruts
   * dans le chemin de l'URL. Un mot de passe contenant `/` ou `?`
   * produisait une URL invalide, donc une lecture impossible.
   */
  it('encode les caractères spéciaux des identifiants', () => {
    const odd: XtreamCredentials = {
      serverUrl: 'http://exemple.tv:8080',
      username: 'user/name',
      password: 'p@ss?w&rd',
    };
    const url = xtreamService.getLiveStreamUrl(odd, 1234, 'm3u8');
    expect(url).not.toContain('user/name');
    expect(url).toContain('user%2Fname');
    expect(url).not.toContain('p@ss?w&rd');
  });

  it.each([
    ['m3u8', '/1234.m3u8'],
    ['ts', '/1234.ts'],
  ])('respecte le format demandé (%s)', (format, suffix) => {
    const url = xtreamService.getLiveStreamUrl(creds, 1234, format as 'm3u8' | 'ts');
    expect(url.endsWith(suffix)).toBe(true);
  });

  it('utilise le bon chemin selon le type de contenu', () => {
    expect(xtreamService.getLiveStreamUrl(creds, 1, 'ts')).toContain('/live/');
    expect(xtreamService.getVodStreamUrl(creds, 7, 'mkv')).toContain('/movie/');
    expect(xtreamService.getEpisodeStreamUrl(creds, 9, 'mp4')).toContain('/series/');
  });
});

describe('normalizeServerUrl', () => {
  it.each([
    ['exemple.tv:8080', 'http://exemple.tv:8080', 'ajoute le protocole manquant'],
    ['https://exemple.tv', 'https://exemple.tv', 'conserve HTTPS'],
    ['http://exemple.tv:8080/player_api.php', 'http://exemple.tv:8080', 'retire le chemin'],
    ['http://exemple.tv/', 'http://exemple.tv', 'retire la barre finale'],
  ])('%s → %s (%s)', (input, expected) => {
    expect(normalizeServerUrl(input)).toBe(expected);
  });

  it('rejette une adresse vide', () => {
    expect(() => normalizeServerUrl('   ')).toThrow(XtreamError);
  });
});
