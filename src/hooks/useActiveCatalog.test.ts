import { describe, it, expect } from 'vitest';
import { ofActiveEpg, ofActivePlaylist } from './useActiveCatalog';

describe('ofActivePlaylist', () => {
  const a = { id: 'src-a:m3u:1', playlistId: 'src-a' };
  const b = { id: 'src-b:m3u:2', playlistId: 'src-b' };

  it('ne garde que les entrées de la source active', () => {
    expect(ofActivePlaylist([a, b], 'src-a')).toEqual([a]);
  });

  it('ne montre rien tant qu’aucune source n’est active', () => {
    expect(ofActivePlaylist([a, b], null)).toEqual([]);
  });

  it('se fie au préfixe de l’id si playlistId est faux ou absent', () => {
    const mistagged = { id: 'src-a:live:1', playlistId: 'src-b' };
    const orphan = { id: 'src-a:m3u:9' };
    expect(ofActivePlaylist([mistagged, orphan, b], 'src-a')).toEqual([mistagged, orphan]);
    expect(ofActivePlaylist([mistagged, orphan, b], 'src-b')).toEqual([b]);
  });
});

describe('ofActiveEpg', () => {
  const progA = { id: 'a:epg:1', channelId: 'a:live:1', title: 'A', start: '', stop: '' };
  const progAB = { id: 'ab:epg:1', channelId: 'ab:live:1', title: 'AB', start: '', stop: '' };

  it('filtre par le préfixe de la source', () => {
    expect(ofActiveEpg([progA, progAB], 'a')).toEqual([progA]);
  });

  it('ne confond pas une source dont l’id est préfixe d’une autre', () => {
    expect(ofActiveEpg([progA, progAB], 'ab')).toEqual([progAB]);
  });
});
