import { describe, it, expect } from 'vitest';
import { normalizePathname, isSamePath } from './pathname';

describe('normalizePathname', () => {
  it('retire la barre finale', () => {
    expect(normalizePathname('/welcome/')).toBe('/welcome');
  });

  it('laisse un chemin deja sans barre inchange', () => {
    expect(normalizePathname('/welcome')).toBe('/welcome');
  });

  it('preserve la racine', () => {
    // Cas limite : reduire '/' a '' casserait la page d'accueil.
    expect(normalizePathname('/')).toBe('/');
  });

  it('gere les chemins imbriques', () => {
    expect(normalizePathname('/legal/terms/')).toBe('/legal/terms');
    expect(normalizePathname('/legal/terms')).toBe('/legal/terms');
  });

  it('ne retire qu une seule barre', () => {
    expect(normalizePathname('/welcome//')).toBe('/welcome/');
  });

  it('gere la chaine vide', () => {
    expect(normalizePathname('')).toBe('');
  });
});

describe('isSamePath', () => {
  it('rapproche les deux ecritures du meme chemin', () => {
    expect(isSamePath('/welcome/', '/welcome')).toBe(true);
    expect(isSamePath('/welcome', '/welcome/')).toBe(true);
    expect(isSamePath('/welcome/', '/welcome/')).toBe(true);
  });

  it('distingue deux chemins differents', () => {
    expect(isSamePath('/welcome/', '/player')).toBe(false);
  });

  it('ne confond pas un prefixe avec le chemin complet', () => {
    // '/legal' ne doit pas egaler '/legal/terms'.
    expect(isSamePath('/legal/', '/legal/terms')).toBe(false);
  });

  it('compare la racine correctement', () => {
    expect(isSamePath('/', '/')).toBe(true);
    expect(isSamePath('/', '/welcome')).toBe(false);
  });
});
