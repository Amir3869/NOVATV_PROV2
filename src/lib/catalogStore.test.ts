import { describe, it, expect } from 'vitest';
import {
  normalizeCatalog,
  hasCatalogContent,
  isIndexedDbAvailable,
  saveCatalog,
  loadCatalog,
  clearStoredCatalog,
  EMPTY_CATALOG,
  type PersistedCatalog,
} from './catalogStore';
import type { LiveChannel, Movie, Series } from '@/types';

/**
 * happy-dom n'implémente pas IndexedDB — vérifié : `typeof indexedDB`
 * y vaut `undefined`. On ne peut donc pas tester ici un aller-retour
 * réel dans la base.
 *
 * Ce n'est pas une lacune : cela permet de vérifier exactement ce qui
 * compte le plus, à savoir que l'application **survit** à un stockage
 * indisponible. C'est le cas réel de la navigation privée et de
 * certaines WebView verrouillées.
 *
 * Le reste — validation de ce qui est relu, détection d'un catalogue
 * vide — est de la logique pure, testable intégralement.
 */

const channel = (id: string): LiveChannel => ({
  id,
  name: `Chaine ${id}`,
  streamUrl: `http://exemple.tv/${id}.m3u8`,
  streamType: 'hls',
  playlistId: 'pl1',
  isFavorite: false,
  isRecent: false,
});

const movie = (id: string): Movie => ({
  id,
  name: `Film ${id}`,
  streamUrl: `http://exemple.tv/${id}.mkv`,
  playlistId: 'pl1',
  isFavorite: false,
});

const series = (id: string): Series => ({
  id,
  name: `Serie ${id}`,
  playlistId: 'pl1',
  isFavorite: false,
});

const full = (over: Partial<PersistedCatalog> = {}): PersistedCatalog => ({
  ...EMPTY_CATALOG,
  savedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('isIndexedDbAvailable', () => {
  it("renvoie false quand l'environnement ne fournit pas IndexedDB", () => {
    // happy-dom : pas d'IndexedDB. C'est précisément le cas dégradé
    // que l'application doit savoir traverser.
    expect(isIndexedDbAvailable()).toBe(false);
  });
});

describe('comportement sans IndexedDB', () => {
  it('saveCatalog renvoie false au lieu de lever une exception', async () => {
    await expect(saveCatalog(EMPTY_CATALOG)).resolves.toBe(false);
  });

  it('loadCatalog renvoie null au lieu de lever une exception', async () => {
    await expect(loadCatalog()).resolves.toBeNull();
  });

  it('clearStoredCatalog renvoie false au lieu de lever une exception', async () => {
    await expect(clearStoredCatalog()).resolves.toBe(false);
  });

  it("une synchronisation reste exploitable meme si l'enregistrement echoue", async () => {
    // Le scénario qui compte : la synchro a réussi, le stockage non.
    // L'utilisateur doit garder son catalogue pour la session.
    const ok = await saveCatalog({ ...EMPTY_CATALOG, channels: [channel('a')] });
    expect(ok).toBe(false); // échec signalé...
    // ...mais aucune exception n'a interrompu l'appelant.
  });
});

describe('normalizeCatalog', () => {
  it('rejette une valeur absente', () => {
    expect(normalizeCatalog(undefined)).toBeNull();
    expect(normalizeCatalog(null)).toBeNull();
  });

  it('rejette une valeur qui n est pas un objet', () => {
    expect(normalizeCatalog('catalogue')).toBeNull();
    expect(normalizeCatalog(42)).toBeNull();
    expect(normalizeCatalog(true)).toBeNull();
  });

  it('accepte un enregistrement complet et le rend tel quel', () => {
    const source = full({ channels: [channel('a'), channel('b')], movies: [movie('m')] });
    const result = normalizeCatalog(source);

    expect(result).not.toBeNull();
    expect(result!.channels).toHaveLength(2);
    expect(result!.movies).toHaveLength(1);
    expect(result!.savedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('remplace un champ manquant par un tableau vide', () => {
    // Cas réel : une version précédente n'enregistrait pas `episodes`.
    // Sans ce garde-fou, le premier `.map()` planterait.
    const result = normalizeCatalog({ channels: [channel('a')], savedAt: '2026-01-01T00:00:00.000Z' });

    expect(result).not.toBeNull();
    expect(result!.channels).toHaveLength(1);
    expect(result!.movies).toEqual([]);
    expect(result!.series).toEqual([]);
    expect(result!.seasons).toEqual([]);
    expect(result!.episodes).toEqual([]);
    expect(result!.epgPrograms).toEqual([]);
    expect(result!.liveCategories).toEqual([]);
  });

  it("remplace un champ du mauvais type par un tableau vide", () => {
    const result = normalizeCatalog({
      channels: 'pas un tableau',
      movies: { id: 'x' },
      series: null,
      savedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result).not.toBeNull();
    expect(result!.channels).toEqual([]);
    expect(result!.movies).toEqual([]);
    expect(result!.series).toEqual([]);
  });

  it('fournit une date de repli quand savedAt est absent ou invalide', () => {
    const sansDate = normalizeCatalog({ channels: [] });
    expect(sansDate!.savedAt).toBe(new Date(0).toISOString());

    const dateInvalide = normalizeCatalog({ channels: [], savedAt: 12345 });
    expect(dateInvalide!.savedAt).toBe(new Date(0).toISOString());
  });

  it('accepte un objet vide sans planter', () => {
    const result = normalizeCatalog({});
    expect(result).not.toBeNull();
    expect(result!.channels).toEqual([]);
  });
});

describe('hasCatalogContent', () => {
  it('renvoie false pour un catalogue absent', () => {
    expect(hasCatalogContent(null)).toBe(false);
  });

  it('renvoie false pour un catalogue vide', () => {
    expect(hasCatalogContent(full())).toBe(false);
  });

  it('renvoie true des qu il y a des chaines', () => {
    expect(hasCatalogContent(full({ channels: [channel('a')] }))).toBe(true);
  });

  it('renvoie true des qu il y a des films', () => {
    expect(hasCatalogContent(full({ movies: [movie('m')] }))).toBe(true);
  });

  it('renvoie true des qu il y a des series', () => {
    expect(hasCatalogContent(full({ series: [series('s')] }))).toBe(true);
  });

  it("ignore les programmes du guide : sans chaine ils ne s'affichent pas", () => {
    const guideSeul = full({
      epgPrograms: [
        {
          id: 'pl1:epg:1',
          channelId: 'c1',
          title: 'Journal',
          start: '2026-01-01T12:00:00.000Z',
          stop: '2026-01-01T12:30:00.000Z',
        },
      ],
    });
    expect(hasCatalogContent(guideSeul)).toBe(false);
  });

  it('ignore les categories seules : une categorie vide ne remplit pas un ecran', () => {
    const categoriesSeules = full({
      liveCategories: [{ id: 'cat1', name: 'Sport', channelCount: 0, playlistId: 'pl1' }],
    });
    expect(hasCatalogContent(categoriesSeules)).toBe(false);
  });
});

describe('EMPTY_CATALOG', () => {
  it('expose les sept champs de contenu, tous vides', () => {
    expect(Object.keys(EMPTY_CATALOG).sort()).toEqual(
      ['channels', 'episodes', 'epgPrograms', 'liveCategories', 'movies', 'seasons', 'series'].sort()
    );
    for (const value of Object.values(EMPTY_CATALOG)) {
      expect(value).toEqual([]);
    }
  });
});
