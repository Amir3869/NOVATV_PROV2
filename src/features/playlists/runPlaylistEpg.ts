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
  syncXtreamShortEPG,
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

function categoryIdMatchesRaw(categoryId: string, rawId: string): boolean {
  return categoryId === rawId || categoryId.endsWith(`:livecat:${rawId}`);
}

/**
 * Limite le guide aux chaînes réellement retenues par la sélection de la
 * source. La sélection peut contenir un parent (`FR`) : les catégories
 * enfants présentes dans le catalogue sont alors ajoutées par relation
 * parent/enfant, sans télécharger l'EPG des autres familles.
 */
function channelsForSelectedLiveCategories(
  state: ReturnType<typeof useAppStore.getState>,
  playlistId: string,
): ReturnType<typeof useAppStore.getState>['channels'] {
  const playlist = state.playlists.find((item) => item.id === playlistId);
  const selection = playlist?.xtream?.categorySelection;
  const channels = state.channels.filter((channel) => channel.playlistId === playlistId);

  if (!selection) return channels;
  if (selection.live.length === 0) return [];

  const categories = state.liveCategories.filter((category) => category.playlistId === playlistId);
  const selectedIds = new Set(
    selection.live.flatMap((rawId) => [rawId, `${playlistId}:livecat:${rawId}`]),
  );
  categories
    .filter((category) => selection.live.some((rawId) => categoryIdMatchesRaw(category.id, rawId)))
    .forEach((category) => selectedIds.add(category.id));

  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (!category.parentId || selectedIds.has(category.id)) continue;
      if (!selectedIds.has(category.parentId)) continue;
      selectedIds.add(category.id);
      changed = true;
    }
  }

  return channels.filter((channel) => Boolean(channel.categoryId && selectedIds.has(channel.categoryId)));
}

export async function runPlaylistEpg(
  playlistId: string,
  options: Pick<EPGSyncOptions, 'onProgress' | 'signal'> = {}
): Promise<EPGSyncResult | null> {
  const state = useAppStore.getState();
  const playlist = state.playlists.find((p) => p.id === playlistId);
  if (!playlist) return null;

  const channels = channelsForSelectedLiveCategories(state, playlistId);
  if (channels.length === 0) return null;

  let url: string | null = null;
  let xtreamCredentials: { serverUrl: string; username: string; password: string } | null = null;
  if (playlist.type === 'xtream' && playlist.xtream) {
    const password = await secureStore.getPlaylistPassword(playlistId);
    if (!password) return null;
    xtreamCredentials = {
      serverUrl: playlist.xtream.serverUrl,
      username: playlist.xtream.username,
      password,
    };
    url = buildXtreamEPGUrl(xtreamCredentials);
  } else if (playlist.m3u?.epgUrl) {
    url = playlist.m3u.epgUrl;
  }
  if (!url) return null;

  let result: EPGSyncResult;
  const hasExplicitLiveSelection = Boolean(playlist.xtream?.categorySelection);

  if (xtreamCredentials && hasExplicitLiveSelection) {
    // Une sélection de catégories signifie que le XMLTV global serait
    // disproportionné : interroger uniquement les chaînes importées
    // évite de télécharger plusieurs centaines de mégaoctets pour en
    // conserver une petite partie.
    result = await syncXtreamShortEPG(xtreamCredentials, channels, playlistId, {
      signal: options.signal,
      keepAheadDays: state.preferences.epgDays,
    });
  } else {
    try {
      result = await syncEPG(url, channels, playlistId, {
        onProgress: options.onProgress,
        signal: options.signal,
        keepAheadDays: state.preferences.epgDays,
      });
    } catch (error) {
      // Certains portails Xtream exposent get_short_epg mais refusent ou
      // désactivent xmltv.php. On tente alors un guide court par chaîne.
      if (!xtreamCredentials || toEPGErrorKind(error) === 'aborted') throw error;
      result = await syncXtreamShortEPG(xtreamCredentials, channels, playlistId, {
        signal: options.signal,
        keepAheadDays: state.preferences.epgDays,
      });
    }
  }
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
