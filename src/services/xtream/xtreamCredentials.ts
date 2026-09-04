/**
 * Relit les identifiants Xtream d'une source déjà enregistrée.
 *
 * Le mot de passe n'est pas dans le store : il vit dans `secureStore`.
 * Si l'utilisateur a vidé son navigateur, la source subsiste sans son
 * secret — on renvoie `null` plutôt que d'envoyer une requête vide.
 */

import { secureStore } from '@/lib/secureStore';
import { useAppStore } from '@/store/useAppStore';
import type { XtreamCredentials } from './xtreamService';

export async function getPlaylistXtreamCredentials(
  playlistId: string
): Promise<XtreamCredentials | null> {
  const playlist = useAppStore.getState().playlists.find((p) => p.id === playlistId);
  if (!playlist || playlist.type !== 'xtream' || !playlist.xtream) return null;
  const password = await secureStore.getPlaylistPassword(playlist.id);
  if (!password) return null;
  return {
    serverUrl: playlist.xtream.serverUrl,
    username: playlist.xtream.username,
    password,
  };
}
