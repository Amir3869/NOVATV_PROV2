/**
 * Récupère le guide d'une source déjà synchronisée.
 *
 * Le catalogue (chaînes) doit déjà être en mémoire : l'appariement se
 * fait contre elles. Appelé en fond après un ajout / une synchro
 * Xtream ou M3U, et à la demande depuis le bouton calendrier.
 *
 * Ne connaît pas React : lit le store, écrit le store. Un échec
 * silencieux (`schedulePlaylistEpg`) ne doit jamais masquer un
 * catalogue déjà utilisable.
 */

import { useAppStore } from '@/store/useAppStore';
import { secureStore } from '@/lib/secureStore';
import {
  syncEPG,
  buildXtreamEPGUrl,
  applyLogoFallbacks,
  type EPGSyncOptions,
  type EPGSyncResult,
} from '@/services/epg/epgSync';

export async function runPlaylistEpg(
  playlistId: string,
  options: Pick<EPGSyncOptions, 'onProgress' | 'signal'> = {}
): Promise<EPGSyncResult | null> {
  const state = useAppStore.getState();
  const playlist = state.playlists.find((p) => p.id === playlistId);
  if (!playlist) return null;

  const channels = state.channels.filter((c) => c.playlistId === playlistId);
  if (channels.length === 0) return null;

  let url: string | null = null;
  if (playlist.type === 'xtream' && playlist.xtream) {
    const password = await secureStore.getPlaylistPassword(playlistId);
    if (!password) return null;
    url = buildXtreamEPGUrl({
      serverUrl: playlist.xtream.serverUrl,
      username: playlist.xtream.username,
      password,
    });
  } else if (playlist.m3u?.epgUrl) {
    url = playlist.m3u.epgUrl;
  }
  if (!url) return null;

  const result = await syncEPG(url, channels, playlistId, {
    onProgress: options.onProgress,
    signal: options.signal,
    keepAheadDays: state.preferences.epgDays,
  });
  const store = useAppStore.getState();
  store.setEpgPrograms(playlistId, result.programs);
  const latest = store.channels.filter((c) => c.playlistId === playlistId);
  const patched = applyLogoFallbacks(latest, result.logoFallbacks);
  if (patched !== latest) {
    store.setCatalog(playlistId, { channels: patched });
  }
  return result;
}

/**
 * Lance le guide en fond : jamais de rejet non géré.
 *
 * Un échec ne masque pas le catalogue. L'écran Guide propose un
 * bouton « Réessayer » quand aucun programme n'est en mémoire.
 */
export function schedulePlaylistEpg(playlistId: string): void {
  void runPlaylistEpg(playlistId).catch(() => {
    // Silence volontaire : un toast ici partirait pendant l'ajout
    // d'une source, trop tôt. L'écran Guide porte le message.
  });
}
