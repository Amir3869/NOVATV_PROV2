import { describe, expect, it } from 'vitest';
import { mediaUrlCandidates, normalizeMediaUrl } from './mediaUrl';

describe('normalizeMediaUrl', () => {
  it('répare les schémas dupliqués et un suffixe mécanique après une IPv4', () => {
    expect(normalizeMediaUrl('hthttp://91.208.162.66m/logos/tf1.png')).toBe(
      'http://91.208.162.66/logos/tf1.png',
    );
  });

  it('résout une URL relative sans réécrire son chemin', () => {
    expect(normalizeMediaUrl('/images/logo.png', 'http://provider.example:8080')).toBe(
      'http://provider.example:8080/images/logo.png',
    );
  });

  it('rejette une URL manifestement invalide', () => {
    expect(normalizeMediaUrl('not a url')).toBeUndefined();
  });
});

describe('mediaUrlCandidates', () => {
  it('conserve HTTP puis essaie HTTPS comme alternative', () => {
    expect(mediaUrlCandidates('http://provider.example/logo.png')).toEqual([
      'http://provider.example/logo.png',
      'https://provider.example/logo.png',
    ]);
  });

  it('ne fabrique pas de candidat pour une URL absente', () => {
    expect(mediaUrlCandidates(undefined)).toEqual([]);
  });
});
