import { describe, it, expect } from 'vitest';
import {
  findNextEpisode,
  hasNextEpisode,
  shouldAutoAdvance,
  sortedEpisodesOf,
  episodeCode,
} from './episodeQueue';
import type { Episode } from '@/types';

/**
 * Fabrique un episode minimal. Seuls les champs qui participent au tri
 * comptent ici, le reste est du remplissage conforme au type.
 */
function ep(
  id: string,
  seasonNumber: number,
  episodeNumber: number,
  seriesId = 'serie-a'
): Episode {
  return {
    id,
    seriesId,
    seasonId: `${seriesId}:s${seasonNumber}`,
    seasonNumber,
    episodeNumber,
    title: `Episode ${episodeNumber}`,
    streamUrl: `http://exemple.tv/${id}.mp4`,
    isWatched: false,
  };
}

describe('sortedEpisodesOf', () => {
  it('trie par saison puis par numero', () => {
    const liste = [ep('c', 2, 1), ep('a', 1, 1), ep('d', 2, 2), ep('b', 1, 2)];
    expect(sortedEpisodesOf(liste, 'serie-a').map((e) => e.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('ecarte les episodes d\'une autre serie', () => {
    const liste = [ep('a', 1, 1), ep('x', 1, 2, 'serie-b'), ep('b', 1, 3)];
    expect(sortedEpisodesOf(liste, 'serie-a').map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('ne trie pas les numeros comme du texte', () => {
    // Un tri alphabetique placerait 10 avant 2.
    const liste = [ep('dix', 1, 10), ep('deux', 1, 2)];
    expect(sortedEpisodesOf(liste, 'serie-a').map((e) => e.id)).toEqual([
      'deux',
      'dix',
    ]);
  });

  it('garde les episodes speciaux de saison 0, en tete', () => {
    const liste = [ep('s1e1', 1, 1), ep('special', 0, 1)];
    expect(sortedEpisodesOf(liste, 'serie-a').map((e) => e.id)).toEqual([
      'special',
      's1e1',
    ]);
  });

  it('ne modifie pas le tableau recu', () => {
    const liste = [ep('b', 1, 2), ep('a', 1, 1)];
    sortedEpisodesOf(liste, 'serie-a');
    expect(liste[0].id).toBe('b');
  });
});

describe('findNextEpisode', () => {
  const serie = [ep('a', 1, 1), ep('b', 1, 2), ep('c', 2, 1), ep('d', 2, 2)];

  it('donne l\'episode suivant de la meme saison', () => {
    expect(findNextEpisode(serie, 'a')?.id).toBe('b');
  });

  /** Le cas qui justifie le tri : la fin d\'une saison enchaine sur la suivante. */
  it('passe a la saison suivante en fin de saison', () => {
    expect(findNextEpisode(serie, 'b')?.id).toBe('c');
  });

  it('renvoie null apres le dernier episode', () => {
    expect(findNextEpisode(serie, 'd')).toBeNull();
  });

  it('renvoie null pour un identifiant inconnu', () => {
    expect(findNextEpisode(serie, 'fantome')).toBeNull();
  });

  it('renvoie null pour une serie a episode unique', () => {
    expect(findNextEpisode([ep('seul', 1, 1)], 'seul')).toBeNull();
  });

  it('fonctionne sur une liste desordonnee', () => {
    const melange = [ep('d', 2, 2), ep('a', 1, 1), ep('c', 2, 1), ep('b', 1, 2)];
    expect(findNextEpisode(melange, 'b')?.id).toBe('c');
  });

  it('ignore les episodes d\'une autre serie', () => {
    const melange = [ep('a', 1, 1), ep('x', 1, 2, 'serie-b'), ep('b', 1, 2)];
    expect(findNextEpisode(melange, 'a')?.id).toBe('b');
  });

  /**
   * Un catalogue mal rempli peut declarer deux fois le meme numero.
   * Avancer sur le numero plutot que sur la position ferait boucler le
   * lecteur sur place.
   */
  it('ne boucle pas sur un doublon de numero', () => {
    const doublon = [ep('a', 1, 1), ep('a-bis', 1, 1), ep('b', 1, 2)];
    expect(findNextEpisode(doublon, 'a')?.id).toBe('a-bis');
    expect(findNextEpisode(doublon, 'a-bis')?.id).toBe('b');
  });

  it('ne renvoie jamais l\'episode courant', () => {
    for (const e of serie) {
      expect(findNextEpisode(serie, e.id)?.id).not.toBe(e.id);
    }
  });

  it('accepte une numerotation a trous', () => {
    const trous = [ep('a', 1, 1), ep('b', 1, 5), ep('c', 1, 12)];
    expect(findNextEpisode(trous, 'a')?.id).toBe('b');
    expect(findNextEpisode(trous, 'b')?.id).toBe('c');
  });

  it('saute une saison entierement absente', () => {
    const sansS2 = [ep('a', 1, 1), ep('c', 3, 1)];
    expect(findNextEpisode(sansS2, 'a')?.id).toBe('c');
  });

  it('renvoie null sur un catalogue vide', () => {
    expect(findNextEpisode([], 'a')).toBeNull();
  });
});

describe('hasNextEpisode', () => {
  const serie = [ep('a', 1, 1), ep('b', 1, 2)];

  it('vrai quand une suite existe', () => {
    expect(hasNextEpisode(serie, 'a')).toBe(true);
  });

  it('faux sur le dernier episode', () => {
    expect(hasNextEpisode(serie, 'b')).toBe(false);
  });
});

describe('shouldAutoAdvance', () => {
  const suivant = ep('b', 1, 2);

  it('enchaine un episode quand le reglage est actif', () => {
    expect(shouldAutoAdvance('episode', true, suivant)).toBe(true);
  });

  it('n\'enchaine pas quand le reglage est desactive', () => {
    expect(shouldAutoAdvance('episode', false, suivant)).toBe(false);
  });

  /** Un film se termine aussi, et n\'a pas de suite. */
  it('n\'enchaine jamais un film', () => {
    expect(shouldAutoAdvance('movie', true, suivant)).toBe(false);
  });

  it('n\'enchaine jamais un direct', () => {
    expect(shouldAutoAdvance('live', true, suivant)).toBe(false);
  });

  it('n\'enchaine pas sans episode suivant', () => {
    expect(shouldAutoAdvance('episode', true, null)).toBe(false);
  });

  it('n\'enchaine pas sans type de media', () => {
    expect(shouldAutoAdvance(null, true, suivant)).toBe(false);
  });
});

describe('episodeCode', () => {
  it('complete les nombres a deux chiffres', () => {
    expect(episodeCode(ep('a', 2, 5))).toBe('S02E05');
  });

  it('n\'ampute pas les nombres a trois chiffres', () => {
    expect(episodeCode(ep('a', 1, 138))).toBe('S01E138');
  });
});
