'use client';

/**
 * Formulaire d'ajout d'une source Xtream Codes.
 *
 * Extrait de `PlaylistsPage.tsx` sans modification de comportement :
 * le parcours de premier lancement (onboarding) a besoin exactement de
 * cette saisie. La dupliquer aurait garanti qu'une correction de
 * validation ne soit appliquee qu'a un seul des deux endroits.
 *
 * `onClose` est appele a l'abandon comme a la reussite : c'est
 * l'appelant qui decide de ce qui suit (fermer le panneau sur la page
 * des sources, avancer d'une etape dans l'onboarding).
 */

import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, AlertCircle, Wifi, Plus } from 'lucide-react';
import { cn, generateId } from '@/utils/cn';
import { AppDialog } from '@/design-system/components/AppDialog';
import { useAppStore } from '@/store/useAppStore';
import { secureStore } from '@/lib/secureStore';
import { xtreamService, normalizeServerUrl } from '@/services/xtream/xtreamService';
import {
  fetchCategoryCatalog,
  syncXtreamCatalog,
  toSourceErrorKind,
  type SyncStep,
} from '@/services/xtream/xtreamSync';
import {
  emptyCatalog,
  emptySelection,
  type CategoryCatalog,
  type CategorySelection,
} from '@/services/xtream/categorySelection';
import { CategoryPicker } from '../CategoryPicker';
import { SyncProgress } from '../SyncProgress';
import type { Playlist } from '@/types';
import { useTranslation, type MessageKey } from '@/i18n';
import { ERROR_KEYS } from '../syncMessages';
import { PasswordField } from '@/design-system/components/PasswordField';
import { schedulePlaylistEpg } from '../runPlaylistEpg';

export function XtreamForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState<SyncStep | null>(null);

  /**
   * Étape courante du formulaire.
   *
   * `credentials` — saisie et test de connexion.
   * `categories`  — choix de ce que l'on veut télécharger.
   *
   * Deux étapes plutôt qu'un seul long écran : les catégories ne
   * peuvent être proposées qu'après une connexion réussie, puisque
   * c'est le serveur qui les fournit.
   */
  const [phase, setPhase] = useState<'credentials' | 'categories'>('credentials');
  const [categoryCatalog, setCategoryCatalog] = useState<CategoryCatalog>(emptyCatalog);
  const [selection, setSelection] = useState<CategorySelection>(emptySelection);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const addPlaylist = useAppStore((s) => s.addPlaylist);
  const updatePlaylist = useAppStore((s) => s.updatePlaylist);
  const setCatalog = useAppStore((s) => s.setCatalog);

  /**
   * `AbortController` : l'objet qui permet d'interrompre une requête en
   * cours. On le range dans une `ref` — une case mémoire qui survit aux
   * rendus sans en déclencher — pour pouvoir l'atteindre depuis le
   * bouton Annuler.
   */
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Teste réellement le compte.
   *
   * Version précédente : une attente de 1,5 s puis `success`, sans
   * aucun appel réseau. Le bouton affichait donc « Connexion réussie »
   * pour n'importe quelle adresse, y compris inexistante.
   */
  const handleTest = async () => {
    if (!serverUrl || !username || !password) return;
    setTesting(true);
    setTestResult(null);
    setTestMessage(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { userInfo } = await xtreamService.getAccountInfo(
        { serverUrl, username, password },
        { signal: controller.signal }
      );
      setTestResult('success');
      setTestMessage(
        userInfo.expiresAt
          ? t('playlists.expiresOn', { date: userInfo.expiresAt.toLocaleDateString() })
          : t('playlists.neverExpires')
      );
    } catch (err) {
      const kind = toSourceErrorKind(err);
      setTestResult('error');
      // Le blocage CORS d'un navigateur se présente comme une panne
      // réseau. Le dire évite une chasse au fantôme : depuis
      // localhost:3000 la plupart des portails refusent l'appel, alors
      // que la même adresse fonctionnera dans l'application installée.
      setTestMessage(
        kind === 'network' ? `${t('errors.network')} ${t('errors.corsHint')}` : t(ERROR_KEYS[kind])
      );
    } finally {
      setTesting(false);
      abortRef.current = null;
    }
  };

  /**
   * Passe à l'étape du choix des catégories.
   *
   * On ne rapporte ici que les **noms** des catégories : trois petites
   * réponses JSON, une seconde d'attente. Le contenu, lui, ne sera
   * demandé qu'après validation, et uniquement pour ce qui est coché.
   */
  const handleLoadCategories = async () => {
    if (!name || !serverUrl || !username || !password) return;
    setLoadingCategories(true);
    setTestResult(null);
    setTestMessage(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const loaded = await fetchCategoryCatalog(
        { serverUrl, username, password },
        { signal: controller.signal }
      );
      setCategoryCatalog(loaded);
      // Rien de coché au départ : sur 300 catégories dont 90 % sont
      // inutiles, décocher serait bien plus long que cocher.
      setSelection(emptySelection());
      setPhase('categories');
    } catch (err) {
      const kind = toSourceErrorKind(err);
      if (kind === 'aborted') return;
      setTestResult('error');
      setTestMessage(
        kind === 'network' ? `${t('errors.network')} ${t('errors.corsHint')}` : t(ERROR_KEYS[kind])
      );
    } finally {
      setLoadingCategories(false);
      abortRef.current = null;
    }
  };

  /** Enregistre la source puis télécharge les catégories retenues. */
  const handleAdd = async () => {
    if (!name || !serverUrl || !username || !password) return;
    setAdding(true);
    setStep('auth');
    setTestResult(null);
    setTestMessage(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const id = generateId();
    const now = new Date().toISOString();

    try {
      const result = await syncXtreamCatalog({ serverUrl, username, password }, id, {
        onProgress: (p) => setStep(p.step),
        signal: controller.signal,
        selection,
      });

      // La source n'est créée qu'après succès : une entrée en erreur
      // dans la liste, créée puis abandonnée, ne servirait à rien.
      const playlist: Playlist = {
        id,
        name,
        type: 'xtream',
        isActive: false,
        lastSync: now,
        syncStatus: 'success',
        channelCount: result.counts.channels,
        movieCount: result.counts.movies,
        seriesCount: result.counts.series,
        createdAt: now,
        updatedAt: now,
        xtream: {
          // On enregistre l'adresse normalisée par le service (schéma
          // ajouté, chemin retiré), pas la saisie brute.
          serverUrl: normalizeServerUrl(serverUrl),
          username,
          expiresAt: result.expiresAt,
          maxConnections: result.maxConnections,
          allowedOutputFormats: result.allowedOutputFormats,
          // Conservée pour que les synchronisations suivantes et
          // l'écran de modification repartent du même choix.
          categorySelection: selection,
        },
      };

      addPlaylist(playlist);
      // Le mot de passe part dans secureStore, jamais dans le store
      // Zustand : ce dernier est recopié en clair dans localStorage
      // sous une clé bien connue.
      await secureStore.setPlaylistPassword(id, password);
      setCatalog(id, result.catalog);
      // Pas de `setActivePlaylist` : la première source le devient
      // toute seule, une suivante resterait en réserve. Forcer
      // l'activation ici volerait le catalogue affiché.
      updatePlaylist(id, { updatedAt: new Date().toISOString() });

      toast.success(t('playlists.syncSummary', result.counts));
      schedulePlaylistEpg(id);
      setStep('done');
      await new Promise((r) => window.setTimeout(r, 900));
      onClose();
      return;
    } catch (err) {
      const kind = toSourceErrorKind(err);
      setTestResult('error');
      setTestMessage(
        kind === 'network' ? `${t('errors.network')} ${t('errors.corsHint')}` : t(ERROR_KEYS[kind])
      );
      if (kind !== 'aborted') toast.error(t(ERROR_KEYS[kind]));
    } finally {
      abortRef.current = null;
    }
    setAdding(false);
    setStep(null);
  };

  const busy = testing || adding || loadingCategories;
  const canSubmit = Boolean(name && serverUrl && username && password);

  const dialogTitle = adding
    ? t('playlists.syncing')
    : phase === 'categories'
      ? t('playlists.categoriesTitle')
      : t('playlists.addXtreamTitle');

  return (
    <AppDialog
      open
      onClose={onClose}
      title={dialogTitle}
      description={
        phase === 'categories' && !adding ? t('playlists.categoriesSubtitle') : undefined
      }
      size={phase === 'categories' && !adding ? 'lg' : 'md'}
      busy={adding}
      closeOnOverlay={!busy}
      showClose={!adding}
    >
      {adding ? (
        <SyncProgress step={step} selection={selection} />
      ) : phase === 'categories' ? (
        <>
          <CategoryPicker
            catalog={categoryCatalog}
            selection={selection}
            onChange={setSelection}
            submitLabel={t('playlists.categoriesImport')}
            onSubmit={handleAdd}
            onCancel={() => setPhase('credentials')}
            busy={adding}
            showHeader={false}
          />
          {testResult === 'error' && testMessage && (
            <div className="flex items-start gap-2 px-4 py-2.5 mt-4 rounded-xl bg-red-500/10 border border-red-500/20" role="alert">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{testMessage}</p>
            </div>
          )}
        </>
      ) : (
      <div className="space-y-4">
        {[
          { labelKey: 'playlists.playlistName', value: name, onChange: setName, placeholder: t('playlists.defaultXtreamName'), type: 'text' },
          { labelKey: 'playlists.serverUrl', value: serverUrl, onChange: setServerUrl, placeholder: 'http://exemple.com:8080', type: 'url' },
          { labelKey: 'playlists.username', value: username, onChange: setUsername, placeholder: 'username', type: 'text' },
        ].map((field) => (
          <div key={field.labelKey}>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">{t(field.labelKey as MessageKey)}</label>
            <input
              type={field.type}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={field.placeholder}
              disabled={busy}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 focus:bg-white/7 transition-all disabled:opacity-50"
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-white/50 font-medium uppercase tracking-wider block mb-1.5">{t('playlists.password')}</label>
          <PasswordField value={password} onChange={setPassword} placeholder="••••••••" disabled={busy} />
        </div>

        {testResult === 'success' && (
          <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20" role="status" aria-live="polite">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-emerald-400">{t('playlists.connectionOk')}</p>
              {testMessage && <p className="text-xs text-emerald-400/70 mt-0.5">{testMessage}</p>}
            </div>
          </div>
        )}

        {testResult === 'error' && testMessage && (
          <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20" role="alert">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{testMessage}</p>
          </div>
        )}

        {loadingCategories && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8">
            <p className="text-sm text-white/70" role="status" aria-live="polite">
              {t('playlists.categoriesLoading')}
            </p>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="text-xs text-white/50 hover:text-white underline underline-offset-2 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={busy || !serverUrl || !username || !password}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
          >
            <Wifi className={cn('w-4 h-4', testing && 'animate-pulse')} />
            {testing ? t('common.testing') : t('common.test')}
          </button>
          {/*
            Ce bouton ne télécharge plus rien : il ouvre l'étape des
            catégories. Le téléchargement n'a lieu qu'une fois le choix
            fait, sur les seules catégories cochées.
          */}
          <button
            type="button"
            onClick={handleLoadCategories}
            disabled={busy || !canSubmit}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            {loadingCategories ? t('playlists.categoriesLoading') : t('common.continue')}
          </button>
        </div>
      </div>
      )}
    </AppDialog>
  );
}
