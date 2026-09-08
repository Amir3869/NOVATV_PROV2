'use client';

/**
 * Socle commun aux deux imports M3U : le hook qui pilote l'import et
 * les deux bandeaux (progression, anomalies).
 *
 * Extrait de `PlaylistsPage.tsx` sans modification de comportement,
 * pour que le parcours de premier lancement reutilise exactement le
 * meme import que la page des sources.
 */

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X, AlertCircle } from 'lucide-react';
import { generateId } from '@/utils/cn';
import { useAppStore } from '@/store/useAppStore';
import {
  syncM3UFromUrl,
  syncM3UFromText,
  toM3UErrorKind,
  type M3USyncProgress,
  type M3USyncResult,
} from '@/services/m3u/m3uSync';
import type { Playlist } from '@/types';
import { useTranslation } from '@/i18n';
import { ERROR_KEYS } from '../syncMessages';
import { schedulePlaylistEpg } from '../runPlaylistEpg';

/**
 * Logique commune aux deux imports M3U.
 *
 * Un « hook » est une fonction qui met en commun de l'état et du
 * comportement entre plusieurs composants. Lien et fichier local
 * partagent tout sauf la façon d'obtenir le contenu : l'écriture des
 * deux fois la même chose garantirait qu'une correction n'en touche
 * qu'une.
 */
export function useM3UImport(type: 'm3u_url' | 'm3u_file', onClose: () => void) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<M3USyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const addPlaylist = useAppStore((s) => s.addPlaylist);
  const setCatalog = useAppStore((s) => s.setCatalog);

  const abortRef = useRef<AbortController | null>(null);

  /**
   * `run` reçoit la façon d'obtenir le catalogue, pas le catalogue :
   * l'identifiant de la source doit être connu du convertisseur avant
   * l'import, puisqu'il préfixe chaque identifiant de chaîne.
   */
  const run = async (
    name: string,
    connection: { url?: string; fileName?: string; epgUrl?: string },
    importer: (id: string, signal: AbortSignal, onProgress: (p: M3USyncProgress) => void) => Promise<M3USyncResult>
  ) => {
    setBusy(true);
    setError(null);
    setWarnings([]);

    const controller = new AbortController();
    abortRef.current = controller;

    const id = generateId();
    const now = new Date().toISOString();

    try {
      const result = await importer(id, controller.signal, setProgress);

      // La source n'est créée qu'après succès : une entrée vide et
      // inutilisable dans la liste serait à supprimer à la main.
      const playlist: Playlist = {
        id,
        name,
        type,
        isActive: false,
        lastSync: now,
        syncStatus: 'success',
        channelCount: result.counts.channels,
        // Un fichier M3U ne déclare que des flux : annoncer 0 film est
        // exact, ce n'est pas un échec.
        movieCount: 0,
        seriesCount: 0,
        createdAt: now,
        updatedAt: now,
        m3u: connection,
      };

      addPlaylist(playlist);
      setCatalog(id, result.catalog);
      schedulePlaylistEpg(id);
      // La première source s'active dans `addPlaylist`. Une suivante
      // reste en réserve jusqu'au bouton « Utiliser cette source ».

      const summary = t('playlists.importSummary', { channels: result.counts.channels });
      const extra =
        result.duplicatesRemoved > 0
          ? ` — ${t('playlists.duplicatesRemoved', { count: result.duplicatesRemoved })}`
          : '';
      toast.success(summary + extra);

      // Le fichier s'est importé mais comportait des lignes bancales :
      // on n'annule pas pour autant, on le signale.
      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
      } else {
        onClose();
      }
    } catch (err) {
      const kind = toM3UErrorKind(err);
      setError(
        kind === 'network' ? `${t('errors.network')} ${t('errors.corsHint')}` : t(ERROR_KEYS[kind])
      );
      if (kind !== 'aborted') toast.error(t(ERROR_KEYS[kind]));
    } finally {
      setBusy(false);
      setProgress(null);
      abortRef.current = null;
    }
  };

  return {
    busy,
    progress,
    error,
    warnings,
    run,
    cancel: () => abortRef.current?.abort(),
    dismiss: onClose,
  };
}

/** Bandeau de progression, partagé par les deux formulaires M3U. */
export function M3UProgress({
  progress,
  onCancel,
}: {
  progress: M3USyncProgress;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const label =
    progress.step === 'download' ? t('playlists.stepDownload') : t('playlists.stepParse');

  return (
    <div className="space-y-2 px-4 py-3 rounded-xl bg-white/5 border border-white/8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/70" role="status" aria-live="polite">
          {label}
          {progress.entriesFound !== undefined && progress.entriesFound > 0 && (
            <span className="text-white/40">
              {' — '}
              {t('playlists.channelsFound', { count: progress.entriesFound })}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-white/50 hover:text-white underline underline-offset-2 transition-colors flex-shrink-0"
        >
          {t('common.cancel')}
        </button>
      </div>

      {/* Le téléchargement ne rapporte pas de progression chiffrée :
          `fetch` ne dit rien tant que le corps n'est pas reçu. On
          n'affiche donc la barre que pendant l'analyse, plutôt qu'une
          jauge immobile qui ferait croire à un blocage. */}
      {progress.ratio !== undefined && (
        <div
          className="h-1.5 rounded-full bg-white/10 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progress.ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${Math.round(progress.ratio * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Anomalies relevées dans un fichier importé malgré tout. */
export function M3UWarnings({ warnings, onClose }: { warnings: string[]; onClose: () => void }) {
  const { t } = useTranslation();
  const shown = warnings.slice(0, 5);
  const rest = warnings.length - shown.length;

  return (
    <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
      <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        {t('playlists.warningsTitle')}
      </p>
      <ul className="text-xs text-amber-400/80 space-y-0.5 list-disc list-inside">
        {shown.map((w) => (
          <li key={w}>{w}</li>
        ))}
        {rest > 0 && <li>{t('playlists.warningsMore', { count: rest })}</li>}
      </ul>
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-white/60 hover:text-white underline underline-offset-2 transition-colors"
      >
        {t('common.close')}
      </button>
    </div>
  );
}
