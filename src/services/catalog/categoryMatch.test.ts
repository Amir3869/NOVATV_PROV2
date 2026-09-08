import { describe, expect, it } from 'vitest';
import { categoryToken, channelMatchesCategory } from './categoryMatch';

describe('categoryToken', () => {
  it('extrait le jeton d’un id Xtream scopé', () => {
    expect(categoryToken('pl-1:livecat:12')).toBe('12');
  });

  it('laisse intact un id brut', () => {
    expect(categoryToken('12')).toBe('12');
  });

  it('extrait le jeton M3U', () => {
    expect(categoryToken('pl-1:m3ucat:ab12')).toBe('ab12');
  });
});

describe('channelMatchesCategory', () => {
  it('match exact', () => {
    expect(channelMatchesCategory('pl-1:livecat:12', 'pl-1:livecat:12')).toBe(true);
  });

  it('match brut contre scopé — catalogues déjà synchronisés', () => {
    expect(channelMatchesCategory('12', 'pl-1:livecat:12')).toBe(true);
  });

  it('refuse un voisin numérique (12 vs 112)', () => {
    expect(channelMatchesCategory('12', 'pl-1:livecat:112')).toBe(false);
  });

  it('refuse une chaîne sans catégorie', () => {
    expect(channelMatchesCategory(undefined, 'pl-1:livecat:12')).toBe(false);
    expect(channelMatchesCategory('', 'pl-1:livecat:12')).toBe(false);
  });
});
