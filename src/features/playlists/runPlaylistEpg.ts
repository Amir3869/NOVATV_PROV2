/**
 * Récupère le guide d'une source déjà synchronisée.
 *
 * Le catalogue (chaînes) doit déjà être en mémoire : l'appariement se
 * fait contre elles. Appelé en fond après un ajout / une synchro
 * Xtream ou M3U, et à la demande depuis le bouton calendrier.
 *
 * Un échec n'efface pas le catalogue. Il est annoncé par un toast
 * (phrase lisible, jamais une clé technique).
 */

import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import { secureStore } from '@/lib/secureStore';
import {
  syncEPG,
  buildXtreamEPGUrl,
  applyLogoFallbacks,
  toEPGErrorKind,
  type EPGSyncOptions,
  type EPGSyncResult,
} from '@/services/epg/epgSync';
import { DEFAULT_LOCALE, isLocale, phrase, translate } from '@/i18n';
import { EPG_ERROR_KEYS } from './syncMessages';

function currentLocale() {
  const language = useAppStore.getState().preferences.language;
  return isLocale(language) ? language : DEFAULT_LOCALE;
}

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
 * Lance le guide en fond. Un échec n'empêche pas d'utiliser les chaînes.
 * On dit clairement ce qui s'est passé : plus de silence.
 */
export function schedulePlaylistEpg(playlistId: string): void {
  void runPlaylistEpg(playlistId)
    .then((result) => {
      if (!result) return;
      const locale = currentLocale();
      if (result.programs.length === 0) {
        toast.error(
          phrase(
            locale,
            'playlists.epgNoMatch',
            undefined,
            'Guide téléchargé, mais aucune chaîne n’a pu être associée.',
          ),
        );
        return;
      }
      toast.success(
        phrase(
          locale,
          'playlists.epgReady',
          { programs: result.programs.length, channels: result.matchedChannels },
          'Guide récupéré : {programs} programmes sur {channels} chaînes.',
        ),
      );
    })
    .catch((err) => {
      const kind = toEPGErrorKind(err);
      if (kind === 'aborted') return;
      const locale = currentLocale();
      toast.error(
        phrase(
          locale,
          EPG_ERROR_KEYS[kind],
          undefined,
          'Le guide des programmes n’a pas pu être récupéré.',
        ),
      );
    });
}
