/**
 * Correspondances entre les codes techniques de synchronisation et les
 * cles de traduction affichees.
 *
 * ─── Pourquoi un fichier a part ────────────────────────────────────
 *
 * Ces tables servent des deux cotes : la page qui liste les sources
 * (pour afficher l'erreur d'une source deja enregistree) et les
 * formulaires d'ajout (pour afficher l'erreur d'une saisie en cours).
 * Les laisser dans l'un des deux forcerait l'autre a importer un
 * fichier de composants pour trois constantes.
 *
 * On stocke la CLE de traduction, jamais le texte : le texte est
 * produit au rendu par `t(...)`, sinon il resterait fige dans la
 * langue de depart apres un changement de langue.
 */

import type { SourceErrorKind } from '@/types';
import type { SyncStep } from '@/services/xtream/xtreamSync';
import type { EPGSyncStep } from '@/services/epg/epgSync';
import type { MessageKey } from '@/i18n';

export const ERROR_KEYS: Record<SourceErrorKind, MessageKey> = {
  invalid_url: 'errors.invalidUrl',
  network: 'errors.network',
  timeout: 'errors.timeout',
  aborted: 'errors.aborted',
  auth: 'errors.auth',
  account_inactive: 'errors.accountInactive',
  http: 'errors.http',
  bad_response: 'errors.badResponse',
  parse: 'errors.parse',
  unknown: 'errors.unknown',
};

export const STEP_KEYS: Record<SyncStep, MessageKey> = {
  auth: 'playlists.stepAuth',
  live_categories: 'playlists.stepLiveCategories',
  live_streams: 'playlists.stepLiveStreams',
  vod_categories: 'playlists.stepVodCategories',
  vod_streams: 'playlists.stepVodStreams',
  series_categories: 'playlists.stepSeriesCategories',
  series: 'playlists.stepSeries',
  done: 'playlists.stepDone',
};

/** Étapes de la récupération du guide, distinctes de celles du catalogue. */
export const EPG_STEP_KEYS: Record<EPGSyncStep, MessageKey> = {
  download: 'playlists.epgStepDownload',
  parse: 'playlists.epgStepParse',
  match: 'playlists.epgStepMatch',
  done: 'playlists.stepDone',
};
