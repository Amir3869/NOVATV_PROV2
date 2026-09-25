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
  mergeEPGResults,
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
  options: Pick<EPGSyncOptions, 'onProgress' | 'signal'> & { channelIds?: readonly string[] } = {}
): Promise<EPGSyncResult | null> {
  const state = useAppStore.getState();
  const playlist = state.playlists.find((p) => p.id === playlistId);
  if (!playlist) return null;

  const selectedChannelIds = options.channelIds ? new Set(options.channelIds) : null;
  const channels = channelsForSelectedLiveCategories(state, playlistId)
    .filter((channel) => !selectedChannelIds || selectedChannelIds.has(channel.id));
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

  if (xtreamCredentials) {
    // Le guide court est rapide, mais certains portails ne le remplissent
    // que pour une partie des chaînes. Le XMLTV complète alors les trous
    // au lieu de remplacer les programmes déjà récupérés.
    const shortResult = await syncXtreamShortEPG(xtreamCredentials, channels, playlistId, {
      signal: options.signal,
      onProgress: options.onProgress,
      keepAheadDays: state.preferences.epgDays,
    });

    if (shortResult.unmatchedChannels === 0) {
      result = shortResult;
    } else {
      try {
        const xmltvResult = await syncEPG(url, channels, playlistId, {
          onProgress: options.onProgress,
          signal: options.signal,
          keepAheadDays: state.preferences.epgDays,
        });
        result = mergeEPGResults(shortResult, xmltvResult, channels.length);
      } catch (error) {
        // Un guide court partiel reste exploitable si le XMLTV du portail
        // est indisponible. Si le guide court est totalement vide, on
        // conserve l'erreur XMLTV pour ne pas masquer une vraie panne.
        if (shortResult.programs.length === 0) throw error;
        result = shortResult;
      }
    }
  } else {
    result = await syncEPG(url, channels, playlistId, {
      onProgress: options.onProgress,
      signal: options.signal,
      keepAheadDays: state.preferences.epgDays,
    });
  }
  const store = useAppStore.getState();
  const syncedChannelIds = new Set(channels.map((channel) => channel.id));
  const programsToStore = options.channelIds
    ? [
        ...store.epgPrograms.filter(
          (program) =>
            program.id.startsWith(`${playlistId}:epg:`) && !syncedChannelIds.has(program.channelId),
        ),
        ...result.programs,
      ]
    : result.programs;
  store.setEpgPrograms(playlistId, programsToStore);
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
