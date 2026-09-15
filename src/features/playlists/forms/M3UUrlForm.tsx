'use client';

/**
 * Import d'une liste M3U depuis un lien.
 *
 * Même fenêtre que l'ajout Xtream : `AppDialog`, fermeture à la
 * réussite, toast de confirmation. Un lien déjà enregistré est refusé.
 */

import React, { useState } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { AppDialog } from '@/design-system/components/AppDialog';
import { syncM3UFromUrl } from '@/services/m3u/m3uSync';
import { useTranslation, type MessageKey } from '@/i18n';
import { useM3UImport, M3UProgress } from './useM3UImport';

export function M3UUrlForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const { busy, progress, error, run, cancel } = useM3UImport('m3u_url', onClose);

  const handleImport = () =>
    run(name, { url: url.trim(), epgUrl: epgUrl.trim() || undefined }, (id, signal, onProgress) =>
      syncM3UFromUrl(url, id, { signal, onProgress })
    );

  return (
    <AppDialog
      open
      onClose={onClose}
      title={t('playlists.addM3UTitle')}
      size="md"
      busy={busy}
      closeOnOverlay={!busy}
      showClose={!busy}
    >
      <div className="space-y-4">
        {[
          { labelKey: 'playlists.playlistName', value: name, onChange: setName, placeholder: t('playlists.defaultM3UName'), hint: undefined },
          { labelKey: 'playlists.m3uUrl', value: url, onChange: setUrl, placeholder: 'https://exemple.com/playlist.m3u', hint: undefined },
          { labelKey: 'playlists.epgUrl', value: epgUrl, onChange: setEpgUrl, placeholder: 'https://exemple.com/epg.xml', hint: t('playlists.epgDescription') },
        ].map((field) => (
          <div key={field.labelKey}>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">{t(field.labelKey as MessageKey)}</label>
            <input
              type={field.labelKey === 'playlists.playlistName' ? 'text' : 'url'}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={field.placeholder}
              disabled={busy}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-all disabled:opacity-50"
            />
            {field.hint && <p className="text-xs text-white/30 mt-1">{field.hint}</p>}
          </div>
        ))}

        <p className="text-xs text-white/30">{t('playlists.m3uNoVod')}</p>

        {error && (
          <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20" role="alert">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {busy && progress && <M3UProgress progress={progress} onCancel={cancel} />}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/60 hover:bg-white/10 transition-all disabled:opacity-40">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={busy || !name || !url}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            {busy ? t('playlists.adding') : t('common.import')}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
