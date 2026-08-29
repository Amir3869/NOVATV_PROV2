import { describe, it, expect } from 'vitest';
import { categoryDisplayName, channelDisplayName } from './displayNames';

/**
 * La fonction de nom affiché est l'unique endroit qui décide si l'on
 * montre le surnom ou le nom d'origine. Ces tests verrouillent la règle
 * pour que l'affichage ne dépende pas de l'appelant (page TV, fiche
 * chaîne, recherche).
 */
describe('categoryDisplayName', () => {
  it('renvoie le nom d\u2019origine sans surnom', () => {
    expect(categoryDisplayName('c1', 'Actualités', {})).toBe('Actualités');
  });

  it('renvoie le surnom quand il existe', () => {
    expect(categoryDisplayName('c1', 'Actualités', { c1: 'News VIP' })).toBe(
      'News VIP'
    );
  });

  it('ignore un surnom réduit à des espaces', () => {
    expect(categoryDisplayName('c1', 'Actualités', { c1: '   ' })).toBe(
      'Actualités'
    );
  });

  it('ne fait pas de doublon entre deux identifiants', () => {
    expect(categoryDisplayName('c1', 'Actualités', { c2: 'News' })).toBe(
      'Actualités'
    );
  });
});

describe('channelDisplayName', () => {
  it('renvoie le nom d\u2019origine sans surnom', () => {
    expect(channelDisplayName('ch1', 'TF1', {})).toBe('TF1');
  });

  it('renvoie le surnom quand il existe', () => {
    expect(channelDisplayName('ch1', 'TF1', { ch1: 'Ma chaîne' })).toBe(
      'Ma chaîne'
    );
  });
});
