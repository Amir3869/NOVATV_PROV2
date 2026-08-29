'use client';

/**
 * Code PIN parental : hachage et clés de verrouillage.
 *
 * ─────────────────────────────────────────────────────────────
 * Pourquoi un hachage, jamais le code en clair
 * ─────────────────────────────────────────────────────────────
 * Le code PIN est stocké dans le profil (`Profile.pinHash`). S'il
 * était en clair, quiconque ouvre l'inspecteur du navigateur (ou lit
 * le stockage de l'application) verrait le code parental — le verrou
 * serait décoratif. On ne conserve donc qu'une **empreinte** : un
 * calcul à sens unique qui permet de vérifier un code saisi sans
 * pouvoir retrouver le code d'origine.
 *
 * ─────────────────────────────────────────────────────────────
 * PBKDF2 quand c'est possible, repli sinon
 * ─────────────────────────────────────────────────────────────
 * L'API Web Crypto (`crypto.subtle`) n'est disponible que sur les
 * origines « sécurisées » (https, ou localhost). L'application statique
 * peut tourner sur http (serveur local, télévision) où `subtle` est
 * absent. Dans ce cas la fonction `fallbackHash` prend le relais :
 * elle est **volontairement plus faible** (simple mélange, itérations
 * modérées) mais honnête — et elle garantit que le verrou fonctionne
 * partout. Le préfixe du stockage distingue les deux méthodes.
 *
 * Code par profil : le code attendu est celui du profil actif. Un
 * profil **sans** PIN ne peut pas déverrouiller de contenu (le verrou
 * reste donc en place pour un profil enfant).
 */

/** Code prévu dans `pinHash` : méthode utilisée (`pbkdf2` | `fallback`). */
const KDF = 'pbkdf2';
const FALLBACK = 'fallback';

/** Itérations PBKDF2. 100 000 : suffisant pour un verrou parental. */
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256; // bits

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Octets aléatoires → hexadécimal (sel pour le hachage). */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    // Repli de secours (vieux moteurs) : pseudo-aléa suffisant pour un
    // sel de PIN. Jamais utilisé pour des secrets critiques.
    for (let i = 0; i < bytes; i += 1) buf[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** PBKDF2-SHA256 du PIN avec le sel donné. Renvoie l'hexadécimal (32 octets). */
async function pbkdf2(pin: string, salt: string): Promise<string> {
  const material = await crypto.subtle.importKey('raw', utf8(pin) as unknown as BufferSource, 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: utf8(salt) as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
    },
    material,
    KEY_LENGTH
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Repli quand `crypto.subtle` est indisponible (http / télévision).
 *
 * Mélange délibérément simple mais stable : itérations avec le sel,
 * pour qu'un même code produise toujours la même empreinte. Lisible
 * uniquement pour vérification — ce n'est pas un chiffrement.
 */
export function fallbackHash(pin: string, salt: string): string {
  let h = 0x811c9dc5;
  const seed = salt + '\u0000' + pin;
  for (let round = 0; round < 1000; round += 1) {
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

/** Empreinte d'un code PIN. Renvoie `méthode:sel:empreinte`. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomHex(8);
  if (globalThis.crypto?.subtle) {
    return `${KDF}:${salt}:${await pbkdf2(pin, salt)}`;
  }
  return `${FALLBACK}:${salt}:${fallbackHash(pin, salt)}`;
}

/**
 * Vérifie un code saisi contre une empreinte stockée (`pinHash`).
 * Renvoie `false` pour toute empreinte illisible ou méthode inconnue.
 */
export async function verifyPin(pin: string, stored?: string): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [method, salt, expected] = parts;
  if (method === KDF && globalThis.crypto?.subtle) {
    return (await pbkdf2(pin, salt)) === expected;
  }
  if (method === FALLBACK) {
    return fallbackHash(pin, salt) === expected;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// Clés de verrouillage
// ─────────────────────────────────────────────────────────────
// `lockedItems` est un simple tableau de clés. Centraliser leur
// construction évite qu'une partie écrive `ch:${id}` et une autre
// `channel:${id}` : deux libellés pour le même verrou, sans erreur
// visible. Les identifiants de chaînes sont déjà « scopés » par source
// (préfixe de playlist), donc uniques à l'échelle de l'application.
//
// Pour les catégories en revanche, l'identifiant d'un groupe M3U (son
// `group-title`) peut se répéter d'une source à l'autre : on inclut
// donc la source dans la clé pour éviter de verrouiller par accident
// le même groupe d'une autre playlist.

/** Clé de verrou d'une chaîne. */
export function channelLockKey(channelId: string): string {
  return `ch:${channelId}`;
}

/** Clé de verrou d'une catégorie (groupe), dédupliquée par source. */
export function categoryLockKey(playlistId: string, categoryId: string): string {
  return `cat:${playlistId}:${categoryId}`;
}

/** Le code doit être exactement 4 chiffres. */
export const PIN_LENGTH = 4;
export const PIN_PATTERN = /^[0-9]{4}$/;
