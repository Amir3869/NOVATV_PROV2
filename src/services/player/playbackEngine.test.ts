import { describe, it, expect, vi } from 'vitest';
import {
  extensionOf,
  pickEngine,
  httpStatusToKind,
  mediaErrorToKind,
} from './playbackEngine';

describe('extensionOf', () => {
  it('lit une extension simple', () => {
    expect(extensionOf('http://portail.tv/live/u/p/123.ts')).toBe('ts');
  });

  it('ignore la chaine de requete', () => {
    expect(extensionOf('http://portail.tv/movie/u/p/9.mp4?token=abc&x=1')).toBe('mp4');
  });

  it('ignore l ancre', () => {
    expect(extensionOf('http://portail.tv/a/b.m3u8#t=10')).toBe('m3u8');
  });

  it('normalise la casse', () => {
    expect(extensionOf('http://portail.tv/a/B.M3U8')).toBe('m3u8');
  });

  it('rend une chaine vide sans extension', () => {
    expect(extensionOf('http://portail.tv/live/u/p/123')).toBe('');
  });

  it('ne confond pas un point du chemin avec une extension', () => {
    // Le point est dans le nom d'hote, pas dans le dernier segment.
    expect(extensionOf('http://mon.portail.tv/live/stream')).toBe('');
  });

  it('rend une chaine vide si le point termine le nom', () => {
    expect(extensionOf('http://portail.tv/fichier.')).toBe('');
  });
});

describe('pickEngine', () => {
  it('choisit hls.js pour une extension m3u8', () => {
    expect(pickEngine('http://p.tv/live/u/p/1.m3u8')).toBe('hlsjs');
  });

  it('choisit mpegts.js pour une extension ts', () => {
    expect(pickEngine('http://p.tv/live/u/p/1.ts')).toBe('mpegts');
  });

  it('choisit la lecture native pour un mp4', () => {
    expect(pickEngine('http://p.tv/movie/u/p/1.mp4')).toBe('native');
  });

  it('fait primer streamType hls sur une extension trompeuse', () => {
    // Certains portails servent du HLS derriere une URL en .ts.
    expect(pickEngine('http://p.tv/live/u/p/1.ts', 'hls')).toBe('hlsjs');
  });

  it('bascule sur mpegts pour une URL nue de type other', () => {
    expect(pickEngine('http://p.tv/live/u/p/1', 'other')).toBe('mpegts');
  });

  it('reste natif pour une URL nue sans streamType', () => {
    expect(pickEngine('http://p.tv/quelque/chose')).toBe('native');
  });
});

describe('httpStatusToKind', () => {
  it('classe 401 et 403 en interdit', () => {
    expect(httpStatusToKind(401)).toBe('forbidden');
    expect(httpStatusToKind(403)).toBe('forbidden');
  });

  it('classe 404 et 410 en introuvable', () => {
    expect(httpStatusToKind(404)).toBe('notFound');
    expect(httpStatusToKind(410)).toBe('notFound');
  });

  it('classe le statut zero en CORS', () => {
    // Un statut 0 signale une reponse que le navigateur a masquee.
    expect(httpStatusToKind(0)).toBe('cors');
  });

  it('classe les 5xx en reseau', () => {
    expect(httpStatusToKind(500)).toBe('network');
    expect(httpStatusToKind(502)).toBe('network');
  });
});

describe('mediaErrorToKind', () => {
  const fake = (code: number) => ({ code }) as MediaError;

  it('rend unknown sans erreur', () => {
    expect(mediaErrorToKind(null)).toBe('unknown');
  });

  it('traduit les quatre codes du standard', () => {
    // Valeurs figees par le standard HTML : 1 abandon, 2 reseau,
    // 3 decodage, 4 source non prise en charge.
    expect(mediaErrorToKind(fake(1))).toBe('aborted');
    expect(mediaErrorToKind(fake(2))).toBe('network');
    expect(mediaErrorToKind(fake(3))).toBe('decode');
    expect(mediaErrorToKind(fake(4))).toBe('unsupported');
  });

  it('rend unknown sur un code inconnu', () => {
    expect(mediaErrorToKind(fake(99))).toBe('unknown');
  });
});

/**
 * Choix du moteur pour un flux HLS.
 *
 * Test de non-régression. Le code testait `canPlayType` AVANT
 * `Hls.isSupported()`, pour laisser Safari décoder lui-même. Mais Chrome
 * et Edge répondent « maybe » à `canPlayType('application/vnd.apple.mpegurl')`
 * sans lire correctement le HLS : le raccourci se déclenchait partout,
 * hls.js n'était jamais chargé, et le menu Qualité restait vide faute de
 * variantes exposées.
 */
describe('attachPlayer — ordre des moteurs HLS', () => {
  /** Balise vidéo minimale, `canPlayType` répondant ce qu'on veut. */
  function fakeVideo(canPlay: string): HTMLVideoElement {
    const video = document.createElement('video');
    video.canPlayType = () => canPlay as CanPlayTypeResult;
    return video;
  }

  it('prefere hls.js quand canPlayType repond maybe', async () => {
    // Cas de Chrome et Edge, reproduit a l'identique.
    vi.resetModules();
    const created: string[] = [];
    vi.doMock('hls.js', () => {
      class FakeHls {
        static isSupported() {
          return true;
        }
        static Events = {
          MANIFEST_PARSED: 'manifestParsed',
          LEVEL_SWITCHED: 'levelSwitched',
          ERROR: 'hlsError',
        };
        static ErrorTypes = { NETWORK_ERROR: 'net', MEDIA_ERROR: 'media' };
        levels = [{ height: 576 }, { height: 240 }];
        currentLevel = -1;
        autoLevelEnabled = true;
        audioTracks = [];
        subtitleTracks = [];
        audioTrack = -1;
        subtitleTrack = -1;
        on() {}
        off() {}
        loadSource(url: string) {
          created.push(url);
        }
        attachMedia() {}
        destroy() {}
      }
      return { default: FakeHls };
    });

    const { attachPlayer } = await import('./playbackEngine');
    const attachment = await attachPlayer({
      url: 'https://example.test/master.m3u8',
      video: fakeVideo('maybe'),
      isLive: true,
    });

    expect(attachment.engine).toBe('hlsjs');
    expect(created).toEqual(['https://example.test/master.m3u8']);
    // Le vrai symptome : sans hls.js, aucune variante n'est exposee.
    expect(attachment.quality).not.toBeNull();
    expect(attachment.quality?.read().levels).toHaveLength(2);
    attachment.destroy();
    vi.doUnmock('hls.js');
  });

  it('se rabat sur la lecture native quand MSE manque', async () => {
    // Cas d'iOS : WebKit n'expose pas Media Source Extensions.
    vi.resetModules();
    vi.doMock('hls.js', () => {
      class FakeHls {
        static isSupported() {
          return false;
        }
        static Events = { MANIFEST_PARSED: 'a', LEVEL_SWITCHED: 'b', ERROR: 'c' };
        static ErrorTypes = { NETWORK_ERROR: 'net', MEDIA_ERROR: 'media' };
      }
      return { default: FakeHls };
    });

    const { attachPlayer } = await import('./playbackEngine');
    const video = fakeVideo('maybe');
    const attachment = await attachPlayer({
      url: 'https://example.test/master.m3u8',
      video,
      isLive: true,
    });

    expect(attachment.engine).toBe('native');
    expect(video.src).toContain('master.m3u8');
    // La balise ne donne aucun acces a l'echelle de qualite.
    expect(attachment.quality).toBeNull();
    attachment.destroy();
    vi.doUnmock('hls.js');
  });

  it('annonce unsupported sans MSE ni lecture native', async () => {
    vi.resetModules();
    vi.doMock('hls.js', () => {
      class FakeHls {
        static isSupported() {
          return false;
        }
        static Events = { MANIFEST_PARSED: 'a', LEVEL_SWITCHED: 'b', ERROR: 'c' };
        static ErrorTypes = { NETWORK_ERROR: 'net', MEDIA_ERROR: 'media' };
      }
      return { default: FakeHls };
    });

    const { attachPlayer } = await import('./playbackEngine');
    const errors: string[] = [];
    const attachment = await attachPlayer({
      url: 'https://example.test/master.m3u8',
      video: fakeVideo(''),
      isLive: true,
      onError: (error) => errors.push(error.kind),
    });

    expect(errors).toEqual(['unsupported']);
    expect(attachment.quality).toBeNull();
    vi.doUnmock('hls.js');
  });
});
