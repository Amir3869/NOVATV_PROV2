import { describe, it, expect } from 'vitest';
import type { Playlist } from '@/types';
import {
  findDuplicateSource,
  normalizeM3uUrl,
  xtreamIdentityKey,
} from './sourceIdentity';

function playlist(partial: Partial<Playlist> & Pick<Playlist, 'id' | 'type'>): Playlist {
  return {
    name: 'Source',
    isActive: false,
    lastSync: null,
    syncStatus: 'success',
    channelCount: 0,
    movieCount: 0,
    seriesCount: 0,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('xtreamIdentityKey', () => {
  it('ignore le nom affiché : même serveur et identifiant = même clé', () => {
    expect(xtreamIdentityKey('http://panel.tv:8080', 'bob')).toBe(
      xtreamIdentityKey('http://panel.tv:8080/', 'BOB')
    );
  });

  it('ajoute le schéma manquant et retire le chemin', () => {
    expect(xtreamIdentityKey('panel.tv:8080/player_api.php', 'bob')).toBe(
      xtreamIdentityKey('http://panel.tv:8080', 'bob')
    );
  });

  it('distingue deux identifiants sur le même serveur', () => {
    expect(xtreamIdentityKey('http://panel.tv:8080', 'bob')).not.toBe(
      xtreamIdentityKey('http://panel.tv:8080', 'alice')
    );
  });
});

describe('normalizeM3uUrl', () => {
  it('ignore la casse de l’hôte, le slash final et l’ancre', () => {
    expect(normalizeM3uUrl('HTTPS://LIST.TV/get.php/')).toBe(
      normalizeM3uUrl('https://list.tv/get.php#frag')
    );
  });

  it('conserve la chaîne de requête', () => {
    expect(normalizeM3uUrl('http://list.tv/get.php?username=a&password=b')).not.toBe(
      normalizeM3uUrl('http://list.tv/get.php?username=a&password=c')
    );
  });

  it('coupe les espaces autour', () => {
    expect(normalizeM3uUrl('  http://list.tv/a.m3u  ')).toBe(
      normalizeM3uUrl('http://list.tv/a.m3u')
    );
  });
});

describe('findDuplicateSource', () => {
  const xtream = playlist({
    id: 'p1',
    type: 'xtream',
    name: 'Maison',
    xtream: { serverUrl: 'http://panel.tv:8080', username: 'bob' },
  });
  const m3u = playlist({
    id: 'p2',
    type: 'm3u_url',
    name: 'Liste',
    m3u: { url: 'https://list.tv/get.php?u=1' },
  });
  const file = playlist({
    id: 'p3',
    type: 'm3u_file',
    name: 'Fichier',
    m3u: { fileName: 'live.m3u' },
  });

  it('repère un compte Xtream déjà présent sous un autre nom', () => {
    const hit = findDuplicateSource([xtream, m3u], {
      kind: 'xtream',
      serverUrl: 'panel.tv:8080',
      username: 'Bob',
    });
    expect(hit?.id).toBe('p1');
  });

  it('repère un lien M3U déjà présent', () => {
    const hit = findDuplicateSource([xtream, m3u], {
      kind: 'm3u_url',
      url: 'https://LIST.TV/get.php?u=1/',
    });
    expect(hit?.id).toBe('p2');
  });

  it('ignore la source en cours d’édition', () => {
    expect(
      findDuplicateSource(
        [xtream],
        { kind: 'xtream', serverUrl: 'http://panel.tv:8080', username: 'bob' },
        'p1'
      )
    ).toBeUndefined();
  });

  it('ne compare pas un fichier local', () => {
    expect(
      findDuplicateSource([file], { kind: 'm3u_url', url: 'https://list.tv/live.m3u' })
    ).toBeUndefined();
  });

  it('ne mélange pas Xtream et M3U', () => {
    expect(
      findDuplicateSource([xtream], {
        kind: 'm3u_url',
        url: 'http://panel.tv:8080/get.php?username=bob',
      })
    ).toBeUndefined();
  });
});
