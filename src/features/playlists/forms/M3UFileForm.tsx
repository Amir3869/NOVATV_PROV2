'use client';

/**
 * Import d'une liste M3U depuis un fichier de l'appareil.
 *
 * Même fenêtre que l'ajout Xtream : `AppDialog`, fermeture à la
 * réussite, toast de confirmation.
 */

import React, { useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { AppDialog } from '@/design-system/components/AppDialog';
import { syncM3UFromText } from '@/services/m3u/m3uSync';
import { useTranslation } from '@/i18n';
import { useM3UImport, M3UProgress } from './useM3UImport';

/** Taille au-delà de laquelle on refuse un fichier local. */
const MAX_FILE_MB = 50;

/**
 * Import depuis un fichier enregistré sur l'appareil.
 *
 * C'est la seule voie qui fonctionne à coup sûr depuis un navigateur :
 * aucun réseau, donc aucun blocage CORS possible.
 */
export function M3UFileForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const { busy, progress, error, run, cancel } = useM3UImport('m3u_file', onClose);

  const handleFile = (chosen: File | null) => {
    setFileError(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    // Un fichier lu entièrement en mémoire : au-delà de quelques
    // dizaines de mégaoctets, un Firestick manquerait de mémoire et le
    // navigateur fermerait l'onglet sans explication.
    if (chosen.size > MAX_FILE_MB * 1024 * 1024) {
      setFile(null);
      setFileError(t('playlists.fileTooLarge', { max: MAX_FILE_MB }));
      return;
    }
    setFile(chosen);
    // Nom pré-rempli à partir du fichier, sans son extension.
    if (!name) setName(chosen.name.replace(/\.(m3u8?|txt)$/i, ''));
  };

  const handleImport = () => {
    if (!file) return;
    run(name, { fileName: file.name }, async (id, signal, onProgress) => {
      const content = await file.text();
      return syncM3UFromText(content, id, { signal, onProgress });
    });
  };

  return (
    <AppDialog
      open
      onClose={onClose}
      title={t('playlists.m3uFileTitle')}
      size="md"
      busy={busy}
      closeOnOverlay={!busy}
      showClose={!busy}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="m3u-file" className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">
            {t('playlists.chooseFile')}
          </label>
          {/* `<input type="file">` natif : son apparence n'est pas
              stylable de façon fiable, mais il reste accessible au
              clavier et à la télécommande, contrairement à un faux
              bouton déclenchant un clic caché. */}
          <input
            id="m3u-file"
            type="file"
            accept=".m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain"
            disabled={busy}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-white/70 file:mr-3 file:px-4 file:py-2.5 file:rounded-xl file:border-0 file:bg-accent file:text-white file:text-sm file:font-semibold hover:file:bg-accent-hover file:cursor-pointer disabled:opacity-50"
          />
          <p className="text-xs text-white/30 mt-1">{t('playlists.chooseFileHint')}</p>
          {file && <p className="text-xs text-white/50 mt-1">{t('playlists.fileSelected', { name: file.name })}</p>}
          {fileError && (
            <p className="text-xs text-red-400 mt-1" role="alert">
              {fileError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="m3u-file-name" className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">
            {t('playlists.playlistName')}
          </label>
          <input
            id="m3u-file-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('playlists.defaultM3UName')}
            disabled={busy}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/40 transition-all disabled:opacity-50"
          />
        </div>

        <p className="text-xs text-white/30">{t('playlists.m3uNoVod')}</p>

        {error && (
          <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20" role="alert">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {busy && progress && <M3UProgress progress={progress} onCancel={cancel} />}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="flex min-h-11 items-center justify-center rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white/60 transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={busy || !name || !file}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
          >
            <Upload className="w-4 h-4" />
            {busy ? t('playlists.adding') : t('common.import')}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
