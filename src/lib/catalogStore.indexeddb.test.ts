/**
 * Épreuves du catalogue avec un vrai moteur IndexedDB.
 *
 * happy-dom n'implémente pas IndexedDB. `catalogStore.test.ts` couvre
 * donc la logique pure et le cas dégradé — stockage indisponible —
 * mais ne prouve pas qu'un aller-retour réel fonctionne.
 *
 * `fake-indexeddb` est une implémentation complète de la spécification
 * IndexedDB en mémoire. Elle exécute les vraies transactions, les vrais
 * événements, la vraie gestion de version. Ce qui passe ici passe dans
 * un navigateur.
 *
 * L'import ci-dessous doit précéder celui de `catalogStore` : il pose
 * `indexedDB` sur l'objet global, et `isIndexedDbAvailable()` le lit.
 */
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  saveCatalog,
  loadCatalog,
  clearStoredCatalog,
  isIndexedDbAvailable,
  hasCatalogContent,
  EMPTY_CATALOG,
} from './catalogStore';
import type { LiveChannel, Movie, Series } from '@/types';

const channel = (id: string): LiveChannel => ({
  id,
  name: `Chaine ${id}`,
  streamUrl: `http://exemple.tv/${id}.m3u8`,
  streamType: 'hls',
  playlistId: 'pl1',
  isFavorite: false,
  isRecent: false,
  logo: `http://exemple.tv/logo-${id}.png`,
  categoryId: 'cat1',
  categoryName: 'Sport',
});

const movie = (id: string): Movie => ({
  id,
  name: `Film ${id}`,
  streamUrl: `http://exemple.tv/${id}.mkv`,
  playlistId: 'pl1',
  isFavorite: false,
  plot: 'Un resume de longueur ordinaire, comme en renvoie un portail Xtream.',
  rating: '7.5',
  year: 2024,
});

const series = (id: string): Series => ({
  id,
  name: `Serie ${id}`,
  playlistId: 'pl1',
  isFavorite: false,
});

// Chaque épreuve repart d'une base neuve : sans cela, le catalogue
// écrit par l'épreuve précédente fausserait la suivante.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('IndexedDB disponible', () => {
  it('est bien detecte', () => {
    expect(isIndexedDbAvailable()).toBe(true);
  });
});

describe('aller-retour', () => {
  it('relit exactement ce qui a ete enregistre', async () => {
    const ok = await saveCatalog({
      ...EMPTY_CATALOG,
      channels: [channel('a'), channel('b')],
      movies: [movie('m1')],
      series: [series('s1')],
    });
    expect(ok).toBe(true);

    const relu = await loadCatalog();
    expect(relu).not.toBeNull();
    expect(relu!.channels).toHaveLength(2);
    expect(relu!.channels[0].name).toBe('Chaine a');
    expect(relu!.channels[0].logo).toBe('http://exemple.tv/logo-a.png');
    expect(relu!.movies).toHaveLength(1);
    expect(relu!.movies[0].plot).toContain('portail Xtream');
    expect(relu!.series).toHaveLength(1);
  });

  it('renvoie null quand rien n a jamais ete enregistre', async () => {
    await expect(loadCatalog()).resolves.toBeNull();
  });

  it('horodate l enregistrement', async () => {
    const avant = Date.now();
    await saveCatalog({ ...EMPTY_CATALOG, channels: [channel('a')] });
    const relu = await loadCatalog();

    expect(relu).not.toBeNull();
    const savedAt = new Date(relu!.savedAt).getTime();
    expect(savedAt).toBeGreaterThanOrEqual(avant);
    expect(savedAt).toBeLessThanOrEqual(Date.now());
  });

  it('remplace integralement le catalogue precedent', async () => {
    await saveCatalog({ ...EMPTY_CATALOG, channels: [channel('a'), channel('b'), channel('c')] });
    await saveCatalog({ ...EMPTY_CATALOG, channels: [channel('z')] });

    const relu = await loadCatalog();
    // Le remplacement doit être total : si l'ancien catalogue se
    // mélangeait au nouveau, supprimer une source ne supprimerait
    // jamais vraiment ses chaînes.
    expect(relu!.channels).toHaveLength(1);
    expect(relu!.channels[0].id).toBe('z');
  });

  it('accepte un catalogue vide', async () => {
    await expect(saveCatalog(EMPTY_CATALOG)).resolves.toBe(true);
    const relu = await loadCatalog();
    expect(relu).not.toBeNull();
    expect(hasCatalogContent(relu)).toBe(false);
  });
});

describe('clearStoredCatalog', () => {
  it('efface le catalogue enregistre', async () => {
    await saveCatalog({ ...EMPTY_CATALOG, channels: [channel('a')] });
    expect(await loadCatalog()).not.toBeNull();

    await expect(clearStoredCatalog()).resolves.toBe(true);
    await expect(loadCatalog()).resolves.toBeNull();
  });

  it('reussit meme quand il n y a rien a effacer', async () => {
    await expect(clearStoredCatalog()).resolves.toBe(true);
  });
});

describe('volume', () => {
  it('encaisse un catalogue de taille realiste', async () => {
    // 8 000 chaînes et 12 000 films : le « catalogue moyen » mesuré à
    // 14,6 Mo en JSON, soit près de trois fois la limite de
    // localStorage. C'est le scénario qui motive tout ce fichier.
    const channels = Array.from({ length: 8000 }, (_, i) => channel(`c${i}`));
    const movies = Array.from({ length: 12000 }, (_, i) => movie(`m${i}`));

    const ok = await saveCatalog({ ...EMPTY_CATALOG, channels, movies });
    expect(ok).toBe(true);

    const relu = await loadCatalog();
    expect(relu!.channels).toHaveLength(8000);
    expect(relu!.movies).toHaveLength(12000);
    // Contrôle d'intégrité aux extrémités : une troncature passerait
    // inaperçue si l'on ne vérifiait que la longueur.
    expect(relu!.channels[7999].id).toBe('c7999');
    expect(relu!.movies[11999].name).toBe('Film m11999');
  }, 60000);
});

describe('resistance', () => {
  it('renvoie null plutot que de lever quand la base est inutilisable', async () => {
    // On simule un moteur qui refuse toute ouverture — navigation
    // privée sur certains navigateurs, ou WebView verrouillée.
    const casse = {
      open: () => {
        const request: Record<string, unknown> = { error: new Error('refuse'), result: null };
        queueMicrotask(() => {
          const handler = request.onerror as ((e: unknown) => void) | undefined;
          handler?.({ target: request });
        });
        return request;
      },
    };
    globalThis.indexedDB = casse as unknown as IDBFactory;

    await expect(loadCatalog()).resolves.toBeNull();
    await expect(saveCatalog(EMPTY_CATALOG)).resolves.toBe(false);
  });
});
