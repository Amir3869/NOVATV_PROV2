'use client';

/**
 * Fiche d'une source déjà enregistrée.
 *
 * Le crayon de la liste ouvre CE formulaire, pas un simple renommage :
 * Xtream = nom + adresse + identifiants (même id, mot de passe vide =
 * secret inchangé) ; M3U lien = nom + URL + EPG ; M3U fichier = nom
 * seulement. Test réussi avant enregistrement Xtream, puis synchro
 * du catalogue et du guide.
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertCircle, Check, Save, Wifi } from 'lucide-react';
import { cn } from '@/utils/cn';
import { AppDialog } from '@/design-system/components/AppDialog';
import { PasswordField } from '@/design-system/components/PasswordField';
import { useAppStore } from '@/store/useAppStore';
import { secureStore } from '@/lib/secureStore';
import { xtreamService, normalizeServerUrl } from '@/services/xtream/xtreamService';
import { syncXtreamCatalog, toSourceErrorKind } from '@/services/xtream/xtreamSync';
import { normalizeSelection } from '@/services/xtream/categorySelection';
import { syncM3UFromUrl, toM3UErrorKind } from '@/services/m3u/m3uSync';
import { schedulePlaylistEpg } from './runPlaylistEpg';
import { ERROR_KEYS } from './syncMessages';
import type { Playlist } from '@/types';
import { useTranslation } from '@/i18n';

export function EditSourceDialog({
  playlist,
  onClose,
}: {
  playlist: Playlist;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const updatePlaylist = useAppStore((s) => s.updatePlaylist);
  const setCatalog = useAppStore((s) => s.setCatalog);

  const [name, setName] = useState(playlist.name);
  const [serverUrl, setServerUrl] = useState(playlist.xtream?.serverUrl ?? '');
  const [username, setUsername] = useState(playlist.xtream?.username ?? '');
  const [password, setPassword] = useState('');
  const [m3uUrl, setM3uUrl] = useState(playlist.m3u?.url ?? '');
  const [epgUrl, setEpgUrl] = useState(playlist.m3u?.epgUrl ?? '');

  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmitName = Boolean(name.trim());

  const resolveXtreamPassword = async (): Promise<string | null> => {
    const typed = password.trim();
    if (typed) return typed;
    return secureStore.getPlaylistPassword(playlist.id);
  };

  const handleTest = async () => {
    if (playlist.type !== 'xtream') return;
    setTesting(true);
    setTestResult(null);
    setMessage(null);
    try {
      const secret = await resolveXtreamPassword();
      if (!secret) throw new Error('missing_password');
      const { userInfo } = await xtreamService.getAccountInfo({
        serverUrl,
        username,
        password: secret,
      });
      setTestResult('success');
      setMessage(
        userInfo.expiresAt
          ? t('playlists.expiresOn', { date: userInfo.expiresAt.toLocaleDateString() })
          : t('playlists.neverExpires')
      );
    } catch (err) {
      const kind =
        err instanceof Error && err.message === 'missing_password'
          ? 'auth'
          : toSourceErrorKind(err);
      setTestResult('error');
      setMessage(
        kind === 'network' ? `${t('errors.network')} ${t('errors.corsHint')}` : t(ERROR_KEYS[kind])
      );
    } finally {
      setTesting(false);
    }
  };

  const handleSaveXtream = async () => {
    if (!canSubmitName || !serverUrl.trim() || !username.trim()) return;
    setBusy(true);
    setTestResult(null);
    setMessage(null);
    try {
      const secret = await resolveXtreamPassword();
      if (!secret) throw new Error('missing_password');

      const { userInfo } = await xtreamService.getAccountInfo({
        serverUrl,
        username,
        password: secret,
      });

      if (password.trim()) {
        await secureStore.setPlaylistPassword(playlist.id, password.trim());
      }

      const connection = {
        ...(playlist.xtream ?? { serverUrl: '', username: '' }),
        serverUrl: normalizeServerUrl(serverUrl),
        username: username.trim(),
        expiresAt: userInfo.expiresAt?.toISOString(),
        maxConnections: userInfo.maxConnections,
      };

      updatePlaylist(playlist.id, { name: name.trim(), xtream: connection });

      const result = await syncXtreamCatalog(
        { serverUrl: connection.serverUrl, username: connection.username, password: secret },
        playlist.id,
        { selection: normalizeSelection(connection.categorySelection) ?? undefined }
      );

      setCatalog(playlist.id, result.catalog);
      updatePlaylist(playlist.id, {
        syncStatus: 'success',
        lastSync: new Date().toISOString(),
        channelCount: result.counts.channels,
        movieCount: result.counts.movies,
        seriesCount: result.counts.series,
        lastError: undefined,
        xtream: {
          ...connection,
          expiresAt: result.expiresAt,
          maxConnections: result.maxConnections,
          allowedOutputFormats: result.allowedOutputFormats,
        },
      });
      toast.success(t('playlists.savedCredentials'));
      toast.success(t('playlists.syncSummary', result.counts));
      schedulePlaylistEpg(playlist.id);
      onClose();
    } catch (err) {
      const kind =
        err instanceof Error && err.message === 'missing_password'
          ? 'auth'
          : toSourceErrorKind(err);
      setTestResult('error');
      setMessage(
        kind === 'network' ? `${t('errors.network')} ${t('errors.corsHint')}` : t(ERROR_KEYS[kind])
      );
      if (kind !== 'aborted') toast.error(t(ERROR_KEYS[kind]));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveM3uUrl = async () => {
    if (!canSubmitName || !m3uUrl.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const nextM3u = {
        ...playlist.m3u,
        url: m3uUrl.trim(),
        epgUrl: epgUrl.trim() || undefined,
      };
      updatePlaylist(playlist.id, { name: name.trim(), m3u: nextM3u });

      const urlChanged = m3uUrl.trim() !== (playlist.m3u?.url ?? '');
      if (urlChanged) {
        const result = await syncM3UFromUrl(m3uUrl.trim(), playlist.id);
        setCatalog(playlist.id, result.catalog);
        updatePlaylist(playlist.id, {
          syncStatus: 'success',
          lastSync: new Date().toISOString(),
          channelCount: result.counts.channels,
          lastError: undefined,
        });
        toast.success(t('playlists.importSummary', { channels: result.counts.channels }));
      } else {
        toast.success(t('playlists.renamed'));
      }
      schedulePlaylistEpg(playlist.id);
      onClose();
    } catch (err) {
      const kind = toM3UErrorKind(err);
      setMessage(
        kind === 'network' ? `${t('errors.network')} ${t('errors.corsHint')}` : t(ERROR_KEYS[kind])
      );
      if (kind !== 'aborted') toast.error(t(ERROR_KEYS[kind]));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveM3uFile = () => {
    if (!canSubmitName) return;
    const trimmed = name.trim();
    if (trimmed !== playlist.name) {
      updatePlaylist(playlist.id, { name: trimmed });
      toast.success(t('playlists.renamed'));
    }
    onClose();
  };

  const handleSave = () => {
    if (playlist.type === 'xtream') return void handleSaveXtream();
    if (playlist.type === 'm3u_url') return void handleSaveM3uUrl();
    handleSaveM3uFile();
  };

  const working = busy || testing;

  return (
    <AppDialog
      open
      onClose={onClose}
      title={t('playlists.editTitle')}
      description={
        playlist.type === 'm3u_file'
          ? t('playlists.fileRenameOnly')
          : t('playlists.editCredentialsHint')
      }
      busy={busy}
      closeOnOverlay={!working}
      showClose={!busy}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-source-name" className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">
            {t('playlists.playlistName')}
          </label>
          <input
            id="edit-source-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={working}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-all disabled:opacity-50"
          />
        </div>

        {playlist.type === 'xtream' && (
          <>
            <div>
              <label htmlFor="edit-source-url" className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">
                {t('playlists.serverUrl')}
              </label>
              <input
                id="edit-source-url"
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                disabled={working}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="edit-source-user" className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">
                {t('playlists.username')}
              </label>
              <input
                id="edit-source-user"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={working}
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="edit-source-password" className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">
                {t('playlists.password')}
              </label>
              <PasswordField
                id="edit-source-password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                disabled={working}
              />
              <p className="text-xs text-white/30 mt-1">{t('playlists.passwordKeepHint')}</p>
            </div>
          </>
        )}

        {playlist.type === 'm3u_url' && (
          <>
            <div>
              <label htmlFor="edit-m3u-url" className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">
                {t('playlists.m3uUrl')}
              </label>
              <input
                id="edit-m3u-url"
                type="url"
                value={m3uUrl}
                onChange={(e) => setM3uUrl(e.target.value)}
                disabled={working}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="edit-m3u-epg" className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">
                {t('playlists.epgUrl')}
              </label>
              <input
                id="edit-m3u-epg"
                type="url"
                value={epgUrl}
                onChange={(e) => setEpgUrl(e.target.value)}
                disabled={working}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-all disabled:opacity-50"
              />
            </div>
          </>
        )}

        {playlist.type === 'm3u_file' && (
          <p className="text-xs text-white/30">{t('playlists.reimportFileHint')}</p>
        )}

        {testResult === 'success' && (
          <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20" role="status">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-emerald-400">{t('playlists.connectionOk')}</p>
              {message && <p className="text-xs text-emerald-400/70 mt-0.5">{message}</p>}
            </div>
          </div>
        )}

        {testResult === 'error' && message && (
          <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20" role="alert">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{message}</p>
          </div>
        )}

        <div className="flex gap-3">
          {playlist.type === 'xtream' && (
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={working || !serverUrl.trim() || !username.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
            >
              <Wifi className={cn('w-4 h-4', testing && 'animate-pulse')} />
              {testing ? t('common.testing') : t('common.test')}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={
              working ||
              !canSubmitName ||
              (playlist.type === 'xtream' && (!serverUrl.trim() || !username.trim())) ||
              (playlist.type === 'm3u_url' && !m3uUrl.trim())
            }
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            {busy ? t('playlists.syncing') : t('common.save')}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
