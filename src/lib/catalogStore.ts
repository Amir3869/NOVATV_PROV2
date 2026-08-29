'use client';

/**
 * Enregistrement du catalogue dans IndexedDB.
 *
 * ─── Pourquoi ce fichier existe ────────────────────────────────────
 *
 * Le reste du store (profils, sources, favoris, réglages) tient dans
 * `localStorage` : quelques kilo-octets, relus instantanément au
 * démarrage. Le catalogue, lui, ne tient pas.
 *
 * Mesures faites sur des catalogues Xtream réalistes, avec les champs
 * réels de nos types et des résumés TMDB de longueur normale :
 *
 *   2 000 chaînes /  3 000 films /   500 séries →  3,6 Mo
 *   8 000 chaînes / 12 000 films / 2 000 séries → 14,6 Mo
 *  20 000 chaînes / 40 000 films / 6 000 séries → 45,4 Mo
 *
 * `localStorage` plafonne autour de 5 Mo. Dès le catalogue moyen on
 * dépasse d'un facteur trois. Alléger les fiches (retirer résumé,
 * distribution, réalisateur, image de fond) ne fait gagner que 43 % —
 * mesuré aussi — ce qui ne suffit pas.
 *
 * Pire : quand `localStorage` déborde, il lève une exception que le
 * middleware `persist` de zustand n'intercepte pas. L'enregistrement
 * échouerait **en silence**. L'application marcherait avec un petit
 * portail et casserait avec un gros, sans message.
 *
 * ─── Ce qu'est IndexedDB ───────────────────────────────────────────
 *
 * La base de données intégrée au navigateur. Trois différences avec
 * `localStorage` :
 *
 *   • la place disponible se compte en giga-octets, pas en méga-octets ;
 *   • elle enregistre les objets JavaScript directement, sans passer
 *     par du texte ;
 *   • sa lecture est **asynchrone** : il faut attendre la réponse.
 *
 * Ce dernier point est le seul inconvénient. Il est sans effet visible
 * ici : l'application affiche déjà des squelettes de chargement le
 * temps que les données reviennent, via le hook `useHydrated`.
 *
 * IndexedDB fonctionne dans la WebView Android, donc dans le futur APK.
 *
 * ─── Le principe retenu ────────────────────────────────────────────
 *
 * Une base, un magasin, **un seul enregistrement** contenant tout le
 * catalogue. On n'a jamais besoin de lire un film précis depuis la
 * base : l'application charge le catalogue entier en mémoire au
 * démarrage, puis travaille dessus. Un enregistrement unique évite
 * toute la complexité des index et des curseurs, pour un gain nul.
 *
 * ─── Ce que ce fichier ne fait pas ─────────────────────────────────
 *
 * Il n'appelle jamais le réseau et ne sait pas ce qu'est un portail
 * Xtream. Il enregistre et relit, rien de plus. La synchronisation
 * reste du ressort de `xtreamSync` et `m3uSync`.
 */

import type {
  LiveChannel,
  LiveCategory,
  Movie,
  Series,
  Season,
  Episode,
  EPGProgram,
} from '@/types';

/**
 * Nom de la base. Distinct de la clé `localStorage` (`novatv-storage`)
 * pour que les deux stockages restent lisibles séparément dans les
 * outils de développement du navigateur.
 */
const DB_NAME = 'novatv-catalog';

/**
 * Version du schéma de la base — à ne pas confondre avec la version
 * des données de `persist`.
 *
 * IndexedDB s'en sert pour savoir quand exécuter `onupgradeneeded`,
 * c'est-à-dire quand créer ou modifier la structure. On ne l'augmente
 * que si l'on change cette structure : ajouter un champ au catalogue
 * n'en fait pas partie, puisque tout est dans un seul enregistrement.
 */
const DB_VERSION = 1;

/** Nom du magasin d'objets. L'équivalent d'une table. */
const STORE_NAME = 'catalog';

/** Clé de l'unique enregistrement du magasin. */
const RECORD_KEY = 'current';

/**
 * Le catalogue tel qu'il est enregistré.
 *
 * Reprend exactement les sept champs de contenu du store. Tout le
 * reste (profils, favoris, historique, réglages) demeure dans
 * `localStorage`, où il est relu instantanément.
 */
export interface PersistedCatalog {
  channels: LiveChannel[];
  liveCategories: LiveCategory[];
  movies: Movie[];
  series: Series[];
  seasons: Season[];
  episodes: Episode[];
  epgPrograms: EPGProgram[];
  /**
   * Date d'écriture, au format ISO.
   *
   * Sert à afficher « synchronisé il y a deux jours » et permettra
   * plus tard de déclencher une resynchronisation automatique quand le
   * catalogue est trop vieux. Non utilisé pour l'instant.
   */
  savedAt: string;
}

/** Catalogue vide — ce que l'on renvoie quand il n'y a rien à relire. */
export const EMPTY_CATALOG: Omit<PersistedCatalog, 'savedAt'> = {
  channels: [],
  liveCategories: [],
  movies: [],
  series: [],
  seasons: [],
  episodes: [],
  epgPrograms: [],
};

/**
 * Indique si IndexedDB est utilisable dans l'environnement courant.
 *
 * Trois cas où il ne l'est pas :
 *   • le rendu côté serveur, où `window` n'existe pas ;
 *   • certains modes de navigation privée, qui exposent l'objet mais
 *     refusent toute ouverture ;
 *   • les environnements de test, comme happy-dom, qui ne
 *     l'implémentent pas.
 *
 * La lecture du global est enveloppée dans un `try/catch` : sur
 * certaines plateformes verrouillées, y accéder lève directement une
 * exception au lieu de renvoyer `undefined`.
 */
export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Ouvre la base, en la créant au premier appel.
 *
 * L'API d'IndexedDB fonctionne par événements et non par promesses.
 * On l'enrobe ici une fois pour toutes, afin que le reste du fichier
 * puisse utiliser `await` normalement.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Déclenché uniquement à la création de la base, ou quand
    // DB_VERSION augmente. C'est le seul endroit où la structure peut
    // être modifiée.
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB: ouverture refusée'));

    // Survient si un autre onglet garde une version précédente de la
    // base ouverte. Sans ce garde-fou, la promesse ne se résoudrait
    // jamais et l'application resterait bloquée sur ses squelettes.
    request.onblocked = () => reject(new Error('IndexedDB: base verrouillée par un autre onglet'));
  });
}

/**
 * Enregistre le catalogue, en remplaçant intégralement le précédent.
 *
 * Renvoie `true` si l'écriture a réussi, `false` sinon. **Ne lève
 * jamais d'exception** : un échec d'enregistrement ne doit pas
 * interrompre une synchronisation qui, elle, a réussi. L'utilisateur
 * garde son catalogue en mémoire pour la session en cours ; il sera
 * simplement perdu au prochain démarrage.
 */
export async function saveCatalog(
  catalog: Omit<PersistedCatalog, 'savedAt'>
): Promise<boolean> {
  if (!isIndexedDbAvailable()) return false;

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();
    const record: PersistedCatalog = { ...catalog, savedAt: new Date().toISOString() };

    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record, RECORD_KEY);

      // On attend la fin de la transaction, pas celle de la requête :
      // `put` peut réussir alors que la transaction échoue ensuite,
      // par exemple si le quota de disque est atteint.
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB: écriture refusée'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB: écriture interrompue'));
    });

    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

/**
 * Relit le catalogue enregistré.
 *
 * Renvoie `null` quand il n'y a rien à relire — première ouverture,
 * IndexedDB indisponible, ou enregistrement illisible. L'appelant
 * traite ces trois cas de la même façon : catalogue vide, et l'on
 * propose une synchronisation.
 *
 * **Ne lève jamais d'exception** pour la même raison que `saveCatalog` :
 * un stockage défaillant doit dégrader l'application, pas l'empêcher
 * de démarrer.
 */
export async function loadCatalog(): Promise<PersistedCatalog | null> {
  if (!isIndexedDbAvailable()) return null;

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();

    const record = await new Promise<unknown>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB: lecture refusée'));
    });

    return normalizeCatalog(record);
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

/** Efface le catalogue enregistré. Renvoie `true` en cas de succès. */
export async function clearStoredCatalog(): Promise<boolean> {
  if (!isIndexedDbAvailable()) return false;

  let db: IDBDatabase | null = null;
  try {
    db = await openDatabase();

    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB: suppression refusée'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB: suppression interrompue'));
    });

    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

/**
 * Vérifie qu'un enregistrement relu a bien la forme attendue.
 *
 * Ce qui sort d'IndexedDB n'est pas typé : c'est du `unknown`. Une
 * version précédente de l'application a pu y écrire une structure
 * différente, ou l'enregistrement a pu être corrompu.
 *
 * Sans ce contrôle, un champ manquant deviendrait `undefined` et le
 * premier `.map()` de l'écran d'accueil planterait sur un écran blanc.
 * Chaque champ absent ou d'un type inattendu est donc ramené à un
 * tableau vide : on préfère un catalogue partiel à un plantage.
 *
 * Exporté pour être testable sans IndexedDB.
 */
export function normalizeCatalog(value: unknown): PersistedCatalog | null {
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  const list = <T>(key: string): T[] => {
    const candidate = record[key];
    return Array.isArray(candidate) ? (candidate as T[]) : [];
  };

  const savedAt = typeof record.savedAt === 'string' ? record.savedAt : new Date(0).toISOString();

  return {
    channels: list<LiveChannel>('channels'),
    liveCategories: list<LiveCategory>('liveCategories'),
    movies: list<Movie>('movies'),
    series: list<Series>('series'),
    seasons: list<Season>('seasons'),
    episodes: list<Episode>('episodes'),
    epgPrograms: list<EPGProgram>('epgPrograms'),
    savedAt,
  };
}

/**
 * Indique si un catalogue relu contient quelque chose d'affichable.
 *
 * Un catalogue peut exister tout en étant vide : source supprimée,
 * synchronisation interrompue. L'écran d'accueil doit alors proposer
 * une synchronisation plutôt que d'afficher des rangées vides.
 *
 * Les programmes du guide ne comptent pas : sans chaîne à laquelle les
 * rattacher, ils ne sont pas affichables.
 */
export function hasCatalogContent(catalog: PersistedCatalog | null): boolean {
  if (!catalog) return false;
  return (
    catalog.channels.length > 0 ||
    catalog.movies.length > 0 ||
    catalog.series.length > 0
  );
}
