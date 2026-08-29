import { describe, it, expect } from 'vitest';
import {
  hashPin,
  verifyPin,
  fallbackHash,
  channelLockKey,
  categoryLockKey,
  PIN_PATTERN,
} from './pin';

describe('hashPin / verifyPin', () => {
  it('reconnaît un code correct et rejette un code faux', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('1234', hash)).toBe(true);
    expect(await verifyPin('4321', hash)).toBe(false);
  });

  it('ne conserve jamais le code en clair', async () => {
    const hash = await hashPin('1234');
    expect(hash).not.toContain('1234');
  });

  it('produit une empreinte différente à chaque appel (sel aléatoire)', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a).not.toBe(b);
  });

  it('rejette un stockage vide ou illisible', async () => {
    expect(await verifyPin('1234', undefined)).toBe(false);
    expect(await verifyPin('1234', '')).toBe(false);
    expect(await verifyPin('1234', 'abcdef')).toBe(false);
  });

  it('vérifie un empreinte « repli » (Web Crypto absent) au format attendu', async () => {
    const salt = '0123456789abcdef';
    const stored = `fallback:${salt}:${fallbackHash('1234', salt)}`;
    expect(await verifyPin('1234', stored)).toBe(true);
    expect(await verifyPin('9999', stored)).toBe(false);
  });
});

describe('fallbackHash', () => {
  it('est déterministe : même code + sel = même empreinte', () => {
    expect(fallbackHash('1234', 'abc')).toBe(fallbackHash('1234', 'abc'));
    expect(fallbackHash('1234', 'abc')).not.toBe(fallbackHash('1234', 'def'));
  });
});

describe('clés de verrouillage', () => {
  it('déduplique les catégories par source', () => {
    expect(categoryLockKey('a', 'g1')).toBe('cat:a:g1');
    expect(categoryLockKey('b', 'g1')).toBe('cat:b:g1');
  });

  it('préfixe la clé de chaîne sans ambiguïté', () => {
    expect(channelLockKey('a:m3u:1')).toBe('ch:a:m3u:1');
  });
});

describe('PIN_PATTERN', () => {
  it('accepte exactement 4 chiffres', () => {
    expect(PIN_PATTERN.test('1234')).toBe(true);
    expect(PIN_PATTERN.test('0000')).toBe(true);
    expect(PIN_PATTERN.test('123')).toBe(false);
    expect(PIN_PATTERN.test('12345')).toBe(false);
    expect(PIN_PATTERN.test('12a4')).toBe(false);
    expect(PIN_PATTERN.test('')).toBe(false);
  });
});
