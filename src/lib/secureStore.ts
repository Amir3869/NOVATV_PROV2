'use client';

/**
 * Rangement des secrets (mots de passe Xtream, jetons éventuels).
 *
 * ─────────────────────────────────────────────────────────────
 * Pourquoi ce fichier existe
 * ─────────────────────────────────────────────────────────────
 * Un mot de passe Xtream ne doit pas se promener dans l'état de
 * l'application. Le store Zustand est recopié en clair dans
 * `localStorage` sous la clé `novatv-storage`, il est lisible par les
 * outils de développement du navigateur, et il finit dans les captures
 * d'écran de débogage. On le sort donc du store et on le range ici.
 *
 * ─────────────────────────────────────────────────────────────
 * Ce que ce fichier NE fait PAS — à lire avant de s'y fier
 * ─────────────────────────────────────────────────────────────
 * L'implémentation par défaut écrit dans `localStorage`, en clair.
 * Ce n'est **pas** du chiffrement. Toute personne ayant accès à la
 * console du navigateur peut lire le mot de passe.
 *
 * C'est un choix assumé et temporaire : l'application est locale et
 * mono-utilisateur, et il n'existe aucun endroit réellement sûr côté
 * navigateur sans demander un code à l'utilisateur à chaque
 * démarrage. Le jour où le contrôle parental (PIN, Phase 3) existera,
 * on pourra dériver une clé de chiffrement de ce PIN et remplacer
 * `localStorageBackend` ci-dessous — **sans toucher à un seul écran**,
 * puisque tous passent par l'interface `SecretBackend`.
 *
 * C'est tout l'intérêt de cette abstraction : isoler la décision.
 *
 * ─────────────────────────────────────────────────────────────
 * Pourquoi une API asynchrone alors que localStorage est synchrone
 * ─────────────────────────────────────────────────────────────
 * IndexedDB et l'API Web Crypto sont asynchrones. Si l'API était
 * synchrone aujourd'hui, chaque écran appelant devrait être réécrit le
 * jour du basculement. En renvoyant des `Promise` dès maintenant, le
 * remplacement du moteur de stockage n'impacte que ce fichier.
 */

/** Préfixe des clés, pour ne pas polluer l'espace de nommage partagé. */
const PREFIX = 'novatv-secret:';

/**
 * Contrat que doit respecter n'importe quel moteur de stockage.
 * Changer de moteur = fournir un autre objet respectant cette forme.
 */
export interface SecretBackend {
  get(id: string): Promise<string | null>;
  set(id: string, value: string): Promise<void>;
  remove(id: string): Promise<void>;
  /** Supprime tous les secrets de NovaTV, et eux seuls. */
  clear(): Promise<void>;
}

/**
 * Moteur de repli : une simple `Map` en mémoire.
 *
 * Sert pendant le rendu côté serveur (Next.js génère le HTML dans
 * Node.js, où `window` n'existe pas) et dans les tests. Sans ce repli,
 * le moindre appel planterait avec « localStorage is not defined ».
 * Les valeurs sont perdues au rechargement de la page — c'est voulu.
 */
function createMemoryBackend(): SecretBackend {
  const store = new Map<string, string>();
  return {
    async get(id) {
      return store.get(id) ?? null;
    },
    async set(id, value) {
      store.set(id, value);
    },
    async remove(id) {
      store.delete(id);
    },
    async clear() {
      store.clear();
    },
  };
}

/**
 * Moteur par défaut : `localStorage`, en clair.
 *
 * Chaque opération est protégée par un `try` : `localStorage` lève une
 * exception en navigation privée sur certains navigateurs, et quand le
 * quota est dépassé. Un mot de passe non enregistré est gênant ; une
 * application qui plante l'est davantage.
 */
function createLocalStorageBackend(): SecretBackend {
  return {
    async get(id) {
      try {
        return window.localStorage.getItem(PREFIX + id);
      } catch {
        return null;
      }
    },
    async set(id, value) {
      try {
        window.localStorage.setItem(PREFIX + id, value);
      } catch {
        // Quota dépassé ou stockage refusé : on n'interrompt pas
        // l'utilisateur. Il devra ressaisir son mot de passe à la
        // prochaine synchronisation.
      }
    },
    async remove(id) {
      try {
        window.localStorage.removeItem(PREFIX + id);
      } catch {
        // Rien à faire : la clé est déjà inaccessible.
      }
    },
    async clear() {
      try {
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (key?.startsWith(PREFIX)) keys.push(key);
        }
        // Suppression dans un second temps : retirer une clé pendant
        // le parcours décale les index et en sauterait une sur deux.
        keys.forEach((key) => window.localStorage.removeItem(key));
      } catch {
        // Idem.
      }
    },
  };
}

let backend: SecretBackend =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
    ? createLocalStorageBackend()
    : createMemoryBackend();

/**
 * Remplace le moteur de stockage.
 *
 * Prévu pour deux usages : les tests (moteur en mémoire, isolé), et le
 * futur basculement vers un stockage chiffré. Renvoie le moteur
 * précédent pour permettre une restauration.
 */
export function setSecretBackend(next: SecretBackend): SecretBackend {
  const previous = backend;
  backend = next;
  return previous;
}

/** Fabrique un moteur en mémoire neuf. Exporté pour les tests. */
export { createMemoryBackend };

/**
 * Identifiant de secret associé à une source.
 *
 * Centraliser cette construction évite les fautes de frappe : si une
 * partie du code écrivait `playlist-${id}` et une autre
 * `playlist:${id}`, le mot de passe serait enregistré à un endroit et
 * cherché à un autre, sans aucune erreur visible.
 */
export function playlistSecretId(playlistId: string): string {
  return `playlist:${playlistId}:password`;
}

export const secureStore = {
  get: (id: string) => backend.get(id),
  set: (id: string, value: string) => backend.set(id, value),
  remove: (id: string) => backend.remove(id),
  clear: () => backend.clear(),

  /** Raccourci lisible : mot de passe d'une source Xtream. */
  getPlaylistPassword: (playlistId: string) =>
    backend.get(playlistSecretId(playlistId)),

  setPlaylistPassword: (playlistId: string, password: string) =>
    backend.set(playlistSecretId(playlistId), password),

  removePlaylistPassword: (playlistId: string) =>
    backend.remove(playlistSecretId(playlistId)),
};
