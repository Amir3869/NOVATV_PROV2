/**
 * Identité d'une source : ce qui empêche d'enregistrer deux fois le
 * même compte, même sous un autre nom.
 *
 *   Xtream — adresse de serveur normalisée + identifiant
 *   M3U    — le lien, pas le nom affiché
 *
 * Un fichier local n'a pas de lien : on ne le compare pas.
 */

import { normalizeServerUrl } from '@/services/xtream/xtreamService';
import type { Playlist } from '@/types';

export type SourceIdentity =
  | { kind: 'xtream'; serverUrl: string; username: string }
  | { kind: 'm3u_url'; url: string };

/**
 * Adresse Xtream comparable : schéma + hôte, chemin retiré, casse
 * ignorée. Un collage `exemple.com:8080` et `http://exemple.com:8080/`
 * désignent le même serveur.
 */
export function xtreamIdentityKey(serverUrl: string, username: string): string {
  let server = serverUrl.trim();
  try {
    server = normalizeServerUrl(server);
  } catch {
    // Adresse encore illisible : on compare ce qui a été tapé.
  }
  return `${server.toLowerCase()}\n${username.trim().toLowerCase()}`;
}

/**
 * Lien M3U comparable : hôte en minuscules, slash final retiré, ancre
 * ignorée. La requête (jeton, identifiants) reste telle quelle : deux
 * jetons différents ne sont pas le même lien.
 */
export function normalizeM3uUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    parsed.hash = '';
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

/**
 * Première source déjà enregistrée qui désigne le même compte.
 *
 * `exceptId` ignore une entrée (la source qu'on est en train d'éditer).
 */
export function findDuplicateSource(
  playlists: readonly Playlist[],
  candidate: SourceIdentity,
  exceptId?: string
): Playlist | undefined {
  return playlists.find((playlist) => {
    if (exceptId && playlist.id === exceptId) return false;

    if (candidate.kind === 'xtream') {
      if (playlist.type !== 'xtream' || !playlist.xtream) return false;
      return (
        xtreamIdentityKey(playlist.xtream.serverUrl, playlist.xtream.username) ===
        xtreamIdentityKey(candidate.serverUrl, candidate.username)
      );
    }

    if (playlist.type !== 'm3u_url' || !playlist.m3u?.url) return false;
    const existing = normalizeM3uUrl(playlist.m3u.url);
    const next = normalizeM3uUrl(candidate.url);
    return Boolean(existing) && existing === next;
  });
}
