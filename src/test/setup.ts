/**
 * Amorçage des tests — réparation de `localStorage`.
 *
 * ─── Le problème ───────────────────────────────────────────────────
 *
 * Depuis **Node 25**, l'API Web Storage est activée d'office : Node
 * installe lui-même un `globalThis.localStorage`. Auparavant cette
 * variable n'existait pas côté serveur, et `happy-dom` — le faux
 * navigateur de nos tests — posait tranquillement la sienne.
 *
 * Node pose la sienne en dernier et gagne. Or, tant qu'on ne lui passe
 * pas l'option `--localstorage-file`, ce `localStorage` n'est **pas**
 * un vrai `Storage` : c'est un objet vide. Il n'a ni `setItem`, ni
 * `getItem`. D'où l'avertissement
 *
 *     Warning: `--localstorage-file` was provided without a valid path
 *
 * puis, quand `zustand/persist` essaie d'enregistrer l'état :
 *
 *     TypeError: storage.setItem is not a function
 *
 * Les 32 tests de `useAppStore` tombaient tous là-dessus. Rien à voir
 * avec le code de l'application : la même version passe au vert sous
 * Node 20 ou 22.
 *
 * Référence : nodejs.org/api/globals.html#localstorage — « v25.0.0 :
 * quand webstorage est actif et que `--localstorage-file` n'est pas
 * fourni, accéder au global `localStorage` renvoie un objet vide. »
 *
 * ─── La réparation ─────────────────────────────────────────────────
 *
 * On aurait pu lancer les tests avec `NODE_OPTIONS=--no-webstorage`,
 * mais il faudrait le retaper à chaque fois, et la syntaxe des
 * variables d'environnement diffère entre PowerShell et un terminal
 * Unix — la commande cesserait de marcher pour la moitié de l'équipe.
 *
 * On répare donc **dans le projet** : si le `localStorage` en place
 * n'a pas de `setItem`, on le remplace par une implémentation mémoire
 * conforme à la spécification Web Storage.
 *
 * Le remplacement est **conditionnel**. Sous Node 20 ou 22, celui de
 * `happy-dom` fonctionne : on n'y touche pas. On ne masque donc jamais
 * le vrai comportement du navigateur, on comble seulement un trou.
 */

/** Implémentation mémoire conforme à l'interface `Storage`. */
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    key(index: number) {
      // La spécification impose un ordre stable et un `null` hors bornes.
      return Array.from(entries.keys())[index] ?? null;
    },
    getItem(key: string) {
      // `null` et non `undefined` quand la clé manque : `zustand` teste
      // la valeur, et `undefined` le ferait échouer au parcours JSON.
      return entries.has(String(key)) ? entries.get(String(key))! : null;
    },
    setItem(key: string, value: string) {
      // Web Storage convertit tout en chaîne, y compris les nombres et
      // les objets. Un test qui range un nombre doit relire une chaîne.
      entries.set(String(key), String(value));
    },
    removeItem(key: string) {
      entries.delete(String(key));
    },
    clear() {
      entries.clear();
    },
  } satisfies Storage;
}

function isUsable(candidate: unknown): boolean {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    typeof (candidate as Storage).setItem === 'function' &&
    typeof (candidate as Storage).getItem === 'function'
  );
}

/*
  Lire `globalThis.localStorage` peut lever une exception : à partir de
  Node 26, l'accès sans `--localstorage-file` déclenche une
  `DOMException` au lieu de renvoyer un objet vide. On protège donc la
  lecture elle-même, pas seulement son résultat.
*/
let current: unknown;
try {
  current = globalThis.localStorage;
} catch {
  current = undefined;
}

if (!isUsable(current)) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
}
