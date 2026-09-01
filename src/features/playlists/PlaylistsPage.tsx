'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Server, Link as LinkIcon, FileText, RefreshCw, Trash2, Edit2, AlertCircle, Wifi, CheckCircle2, CalendarDays, Layers, Tags } from 'lucide-react';
import { cn } from '@/utils/cn';
import { GlassCard } from '@/design-system/components/GlassCard';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Badge } from '@/design-system/components/Badge';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';
import { ConfirmDialog } from '@/design-system/components/ConfirmDialog';
import { AppDialog } from '@/design-system/components/AppDialog';
import { secureStore } from '@/lib/secureStore';
import {
  fetchCategoryCatalog,
  syncXtreamCatalog,
  toSourceErrorKind,
  type SyncStep,
} from '@/services/xtream/xtreamSync';
import {
  emptySelection,
  normalizeSelection,
  reconcileSelection,
  type CategoryCatalog,
  type CategorySelection,
} from '@/services/xtream/categorySelection';
import { CategoryPicker } from './CategoryPicker';
import { CatalogManager } from '@/features/categories/CatalogManager';
import { ERROR_KEYS, STEP_KEYS, EPG_STEP_KEYS } from './syncMessages';
import { XtreamForm } from './forms/XtreamForm';
import { M3UUrlForm } from './forms/M3UUrlForm';
import { M3UFileForm } from './forms/M3UFileForm';
import { syncM3UFromUrl, toM3UErrorKind } from '@/services/m3u/m3uSync';
import {
  syncEPG,
  buildXtreamEPGUrl,
  toEPGErrorKind,
  type EPGSyncStep,
} from '@/services/epg/epgSync';
import type { Playlist, XtreamConnection } from '@/types';
import { useTranslation, type MessageKey } from '@/i18n';

type AddMode = null | 'xtream' | 'm3u_url' | 'm3u_file';

/**
 * Listes déclarées hors composant : on stocke la CLÉ de traduction, pas le
 * texte. Le texte n'est produit qu'au rendu, avec `t(...)`, sinon il resterait
 * figé dans la langue de départ après un changement de langue.
 */
const ADD_MODES = [
  { mode: 'xtream' as const, labelKey: 'playlists.xtreamCodes', icon: Server },
  { mode: 'm3u_url' as const, labelKey: 'playlists.m3uLink', icon: LinkIcon },
  { mode: 'm3u_file' as const, labelKey: 'playlists.m3uFile', icon: FileText },
] as const satisfies ReadonlyArray<{
  mode: 'xtream' | 'm3u_url' | 'm3u_file';
  labelKey: MessageKey;
  icon: React.ElementType;
}>;

/**
 * Les trois cartes de présentation, en bas de la page.
 *
 * Les deux premières correspondent à un type de source : les rendre
 * cliquables ouvre directement le bon formulaire, au lieu d'obliger
 * l'utilisateur à remonter vers le bouton d'ajout.
 *
 * La troisième, EPG/XMLTV, reste volontairement non cliquable : le
 * guide des programmes n'est pas une source, il se configure DANS une
 * source déjà ajoutée. Lui donner un clic mènerait vers un formulaire
 * qui ne correspond pas à ce que la carte annonce. `mode: null` marque
 * cette absence d'action.
 */
const FEATURES = [
  { icon: Server, titleKey: 'playlists.xtreamCodes', descriptionKey: 'playlists.xtreamDescription', mode: 'xtream' },
  { icon: LinkIcon, titleKey: 'playlists.m3uLink', descriptionKey: 'playlists.m3uDescription', mode: 'm3u_url' },
  { icon: Wifi, titleKey: 'playlists.epgXmltv', descriptionKey: 'playlists.epgSubtitle', mode: null },
] as const satisfies ReadonlyArray<{ icon: React.ElementType; titleKey: MessageKey; descriptionKey: MessageKey; mode: AddMode }>;

export function PlaylistsPage() {
  const { t } = useTranslation();
  const [addMode, setAddMode] = useState<AddMode>(null);
  const playlists = useAppStore((s) => s.playlists);

  // Voir useHydrated : ne rien conclure tant que les données
  // enregistrées ne sont pas relues.
  const hydrated = useHydrated();

  if (!hydrated) return <ListPageSkeleton rows={3} />;

  return (
    <div className="min-h-screen bg-surface-0 px-4 pb-12 pt-6 md:px-8 md:pb-16 md:pt-8 lg:px-10 lg:pt-10 space-y-8">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white">{t('playlists.pageTitle')}</h1>
          <p className="text-sm text-white/40 mt-0.5">{t('playlists.pageSubtitle')}</p>
        </div>
        {!addMode && (
          <button
            type="button"
            onClick={() => setAddMode('xtream')}
            className="flex items-center gap-2 min-h-11 px-4 py-2.5 bg-accent text-white on-accent text-sm font-semibold rounded-xl hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('common.add')}
          </button>
        )}
      </div>

      {/* Legal notice */}
      <GlassCard variant="dark" className="flex gap-3 !p-4">
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white/80">{t('playlists.legalTitle')}</p>
          <p className="text-xs text-white/50 mt-1">{t('playlists.legalText')}</p>
        </div>
      </GlassCard>

      {/* Add form */}
      {addMode && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {ADD_MODES.map(({ mode, labelKey, icon: Icon }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={addMode === mode}
                onClick={() => setAddMode(mode)}
                className={cn(
                  'flex items-center gap-2 min-h-11 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border',
                  addMode === mode ? 'bg-accent text-white border-accent' : 'bg-white/5 text-white/60 border-white/8 hover:bg-white/10'
                )}
              >
                <Icon className="w-4 h-4" />
                {t(labelKey)}
              </button>
            ))}
          </div>

          {addMode === 'xtream' && <XtreamForm onClose={() => setAddMode(null)} />}
          {addMode === 'm3u_url' && <M3UUrlForm onClose={() => setAddMode(null)} />}
          {addMode === 'm3u_file' && <M3UFileForm onClose={() => setAddMode(null)} />}
        </div>
      )}

      {/* Playlists list */}
      <div className="space-y-3">
        {playlists.length === 0 ? (
          <EmptyState
            emoji="📡"
            title={t('playlists.emptyTitle')}
            description={t('playlists.emptyText')}
            action={{ label: t('playlists.addSource'), onClick: () => setAddMode('xtream') }}
          />
        ) : (
          playlists.map((playlist) => (
            <PlaylistItem key={playlist.id} playlist={playlist} />
          ))
        )}
      </div>

      {/* Features overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        {FEATURES.map((f) =>
          f.mode === null ? (
            <GlassCard key={f.titleKey} variant="glass" padding="md">
              <f.icon className="w-6 h-6 text-accent mb-3" />
              <h3 className="font-semibold text-white text-sm mb-1">{t(f.titleKey)}</h3>
              <p className="text-xs text-white/50">{t(f.descriptionKey)}</p>
            </GlassCard>
          ) : (
            <button
              key={f.titleKey}
              type="button"
              onClick={() => setAddMode(f.mode)}
              className="text-start rounded-2xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <GlassCard variant="glass" padding="md" className="h-full transition-colors hover:border-white/20 hover:bg-white/[0.07]">
                <f.icon className="w-6 h-6 text-accent mb-3" />
                <h3 className="font-semibold text-white text-sm mb-1">{t(f.titleKey)}</h3>
                <p className="text-xs text-white/50">{t(f.descriptionKey)}</p>
              </GlassCard>
            </button>
          )
        )}
      </div>
    </div>
  );
}

function PlaylistItem({ playlist }: { playlist: Playlist }) {
  const { t, locale } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [step, setStep] = useState<SyncStep | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(playlist.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [epgBusy, setEpgBusy] = useState(false);
  const [epgStep, setEpgStep] = useState<EPGSyncStep | null>(null);

  /**
   * Écran de modification des catégories.
   *
   * `null` = fermé. Sinon on y range le catalogue rapporté du serveur :
   * les noms des catégories changent avec l'abonnement, il faut donc
   * les relire à chaque ouverture plutôt que de les figer.
   */
  const [editCatalog, setEditCatalog] = useState<CategoryCatalog | null>(null);
  const [editSelection, setEditSelection] = useState<CategorySelection>(emptySelection);
  const [loadingCategories, setLoadingCategories] = useState(false);

  /** Affiche ou non le panneau de renommage (catégories + chaînes). */
  const [showRenames, setShowRenames] = useState(false);

  const updatePlaylist = useAppStore((s) => s.updatePlaylist);
  const setCatalog = useAppStore((s) => s.setCatalog);
  const setEpgPrograms = useAppStore((s) => s.setEpgPrograms);
  const deletePlaylist = useAppStore((s) => s.deletePlaylist);
  const setActivePlaylist = useAppStore((s) => s.setActivePlaylist);
  const activePlaylistId = useAppStore((s) => s.activePlaylistId);
  const isCurrent = playlist.id === activePlaylistId;

  /**
   * Chaînes déjà synchronisées de cette source.
   *
   * L'appariement du guide se fait contre elles : sans catalogue, pas
   * de guide possible. On lit le nombre plutôt que le tableau entier
   * pour l'affichage, mais `syncEPG` a besoin des objets.
   */
  const channels = useAppStore((s) => s.channels);
  // Reglage « Jours de guide TV ». Lu ici, seul endroit qui declenche
  // une synchronisation : c'est le fichier qui CONSOMME la preference.
  const epgDays = useAppStore((s) => s.preferences.epgDays);
  const liveCategories = useAppStore((s) => s.liveCategories);

  /**
   * Adresse du guide, ou `null` si la source n'en a pas.
   *
   * Xtream expose toujours `/xmltv.php`, construit à partir des
   * identifiants. Une source M3U n'a de guide que si l'utilisateur a
   * renseigné une adresse XMLTV à l'import — d'où le bouton absent
   * dans le cas contraire, plutôt que grisé.
   */
  const hasEpgSource =
    playlist.type === 'xtream' ? Boolean(playlist.xtream) : Boolean(playlist.m3u?.epgUrl);

  const playlistChannels = channels.filter((c) => c.playlistId === playlist.id);
  const playlistCategories = liveCategories.filter(
    (c) => c.playlistId === playlist.id
  );

  /**
   * Récupère le guide des programmes.
   *
   * Séparé de la synchronisation du catalogue : c'est un second appel
   * réseau, souvent bien plus lourd (un XMLTV se compte en dizaines de
   * Mo), et qui peut échouer seul. Le lier au catalogue obligerait à
   * tout retélécharger pour rafraîchir les horaires.
   */
  const handleSyncEPG = async () => {
    if (epgBusy) return;

    if (playlistChannels.length === 0) {
      toast.error(t('playlists.epgNeedsChannels'));
      return;
    }

    let url: string;
    if (playlist.type === 'xtream') {
      if (!playlist.xtream) return;
      const password = await secureStore.getPlaylistPassword(playlist.id);
      if (!password) {
        toast.error(t('errors.auth'));
        return;
      }
      url = buildXtreamEPGUrl({
        serverUrl: playlist.xtream.serverUrl,
        username: playlist.xtream.username,
        password,
      });
    } else {
      if (!playlist.m3u?.epgUrl) return;
      url = playlist.m3u.epgUrl;
    }

    setEpgBusy(true);
    setEpgStep('download');

    try {
      const result = await syncEPG(url, playlistChannels, playlist.id, {
        onProgress: (p) => setEpgStep(p.step),
        keepAheadDays: epgDays,
      });

      setEpgPrograms(playlist.id, result.programs);

      if (result.programs.length === 0) {
        // Le téléchargement a réussi mais aucune chaîne n'a pu être
        // appariée : annoncer « guide récupéré » serait mensonger.
        toast.error(t('playlists.epgNoMatch'));
      } else {
        toast.success(
          t('playlists.epgSummary', {
            programs: result.programs.length,
            channels: result.matchedChannels,
          })
        );
      }
    } catch (err) {
      const kind = toEPGErrorKind(err);
      if (kind !== 'aborted') {
        toast.error(
          kind === 'network'
            ? `${t('errors.network')} ${t('errors.corsHint')}`
            : t(ERROR_KEYS[kind])
        );
      }
    } finally {
      setEpgBusy(false);
      setEpgStep(null);
    }
  };

  /**
   * Renomme la source.
   *
   * Seul le nom est modifiable. Changer l'adresse ou les identifiants
   * reviendrait à pointer vers un autre abonnement tout en gardant les
   * chaînes déjà téléchargées : la liste afficherait le contenu d'une
   * source et les identifiants d'une autre. Le formulaire le dit, et
   * renvoie vers « supprimer puis rajouter ».
   */
  const handleRename = () => {
    const trimmed = draftName.trim();
    // Un nom vide rendrait la source impossible à distinguer des
    // autres dans la liste.
    if (!trimmed) {
      setDraftName(playlist.name);
      setEditing(false);
      return;
    }
    if (trimmed !== playlist.name) {
      updatePlaylist(playlist.id, { name: trimmed });
      toast.success(t('playlists.renamed'));
    }
    setEditing(false);
  };

  /**
   * Supprime la source, son contenu et son mot de passe.
   *
   * L'ordre compte : le secret part d'abord. `deletePlaylist` est
   * synchrone et `secureStore` ne l'est pas ; si l'on supprimait
   * l'entrée en premier et que l'effacement du secret échouait, le mot
   * de passe resterait dans le navigateur sans plus aucune source pour
   * le désigner — donc sans moyen de le retrouver ni de l'effacer.
   */
  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (playlist.type === 'xtream') {
        await secureStore.removePlaylistPassword(playlist.id);
      }
      deletePlaylist(playlist.id);
      toast.success(t('playlists.deleted'));
    } catch {
      // Même si l'effacement du secret échoue, la source doit partir :
      // la garder afficherait un contenu que l'utilisateur a demandé à
      // supprimer.
      deletePlaylist(playlist.id);
      toast.success(t('playlists.deleted'));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  /**
   * Ouvre l'écran de modification des catégories.
   *
   * On relit les catégories depuis le serveur au lieu de réutiliser
   * celles du dernier import : un abonnement en ajoute et en retire au
   * fil du temps. `reconcileSelection` écarte ensuite les identifiants
   * qui n'existent plus, sinon on garderait des choix fantômes que
   * l'utilisateur ne pourrait plus décocher, faute de ligne à afficher.
   */
  const handleOpenCategories = async () => {
    if (playlist.type !== 'xtream' || !playlist.xtream) return;
    setLoadingCategories(true);

    try {
      const password = await secureStore.getPlaylistPassword(playlist.id);
      if (!password) throw new Error('missing_password');

      const loaded = await fetchCategoryCatalog({
        serverUrl: playlist.xtream.serverUrl,
        username: playlist.xtream.username,
        password,
      });

      const saved = normalizeSelection(playlist.xtream.categorySelection);
      setEditSelection(saved ? reconcileSelection(saved, loaded) : emptySelection());
      setEditCatalog(loaded);
    } catch (err) {
      const kind =
        err instanceof Error && err.message === 'missing_password'
          ? 'auth'
          : toSourceErrorKind(err);
      if (kind === 'aborted') return;
      toast.error(t(ERROR_KEYS[kind]));
    } finally {
      setLoadingCategories(false);
    }
  };

  /**
   * Enregistre le nouveau choix puis relance la synchronisation.
   *
   * Resynchroniser n'est pas optionnel : le catalogue en mémoire
   * contient encore les chaînes des catégories que l'on vient de
   * décocher. Sans nouvelle synchronisation, l'écran continuerait de
   * les afficher et le réglage paraîtrait sans effet.
   */
  const handleSaveCategories = async () => {
    if (playlist.type !== 'xtream' || !playlist.xtream) return;

    updatePlaylist(playlist.id, {
      xtream: { ...playlist.xtream, categorySelection: editSelection },
    });
    setEditCatalog(null);
    await handleSync({ ...playlist.xtream, categorySelection: editSelection });
  };

  /**
   * Resynchronise une source déjà enregistrée.
   *
   * Le mot de passe ne se trouve pas dans le store : il est relu depuis
   * `secureStore` à chaque besoin. Si l'utilisateur a vidé son
   * navigateur, le secret a disparu alors que la source est toujours
   * là — il faut donc le dire clairement plutôt que d'envoyer une
   * requête vide qui reviendrait en « identifiants refusés ».
   */
  const handleSync = async (override?: XtreamConnection) => {
    // Un fichier importé depuis l'appareil ne peut pas être
    // resynchronisé : le navigateur n'a pas le droit de relire un
    // fichier local sans que l'utilisateur le désigne à nouveau. Le
    // bouton est donc masqué dans ce cas, et cette garde le confirme.
    if (playlist.type === 'm3u_file') return;

    setSyncing(true);
    updatePlaylist(playlist.id, { syncStatus: 'syncing' });

    try {
      if (playlist.type === 'xtream') {
        /*
          `override` sert au retour de l'écran des catégories : la mise
          à jour du store vient d'être demandée, mais la prop `playlist`
          de ce rendu porte encore l'ancienne valeur. Sans cela, la
          synchronisation repartirait sur le choix précédent.
        */
        const connection = override ?? playlist.xtream;
        if (!connection) throw new Error('missing_connection');
        setStep('auth');

        const password = await secureStore.getPlaylistPassword(playlist.id);
        // Le mot de passe vit dans secureStore, pas dans le store. Si
        // l'utilisateur a vidé son navigateur, la source subsiste sans
        // son secret : mieux vaut le dire que d'envoyer une requête
        // vide qui reviendrait en « identifiants refusés ».
        if (!password) throw new Error('missing_password');

        const result = await syncXtreamCatalog(
          { serverUrl: connection.serverUrl, username: connection.username, password },
          playlist.id,
          {
            onProgress: (p) => setStep(p.step),
            // `normalizeSelection` rend `null` si le champ est absent
            // (source créée avant cette fonctionnalité) ou corrompu par
            // une écriture manuelle. `undefined` signifie alors « tout
            // télécharger », ce qui est bien l'ancien comportement.
            selection: normalizeSelection(connection.categorySelection) ?? undefined,
          }
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
        toast.success(t('playlists.syncSummary', result.counts));
        return;
      }

      // Source M3U distante : on retélécharge la liste.
      if (!playlist.m3u?.url) throw new Error('missing_connection');
      setStep('live_streams');

      const result = await syncM3UFromUrl(playlist.m3u.url, playlist.id);

      setCatalog(playlist.id, result.catalog);
      updatePlaylist(playlist.id, {
        syncStatus: 'success',
        lastSync: new Date().toISOString(),
        channelCount: result.counts.channels,
        lastError: undefined,
      });
      toast.success(t('playlists.importSummary', { channels: result.counts.channels }));
    } catch (err) {
      const kind =
        err instanceof Error && (err.message === 'missing_password' || err.message === 'missing_connection')
          ? 'auth'
          : playlist.type === 'xtream'
            ? toSourceErrorKind(err)
            : toM3UErrorKind(err);
      updatePlaylist(playlist.id, { syncStatus: 'error', lastError: kind });
      toast.error(t(ERROR_KEYS[kind]));
    } finally {
      setSyncing(false);
      setStep(null);
    }
  };

  const typeLabel =
    playlist.type === 'xtream'
      ? t('playlists.xtreamCodes')
      : playlist.type === 'm3u_url'
        ? t('playlists.m3uLink')
        : t('playlists.m3uFile');
  const typeIcon = playlist.type === 'xtream' ? Server : playlist.type === 'm3u_url' ? LinkIcon : FileText;
  const TypeIcon = typeIcon;

  const actions = (
    <>
          {/* Pas de bouton pour un fichier local : le navigateur ne peut
              pas le relire sans que l'utilisateur le redésigne. Un
              bouton présent mais sans effet serait un mensonge de
              plus. */}
          {playlist.type !== 'm3u_file' && (
            <button
              onClick={() => handleSync()}
              disabled={syncing}
              type="button"
              aria-label={t('playlists.syncPlaylist')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
            </button>
          )}
          {/* Gérer les catégories (ajouter / masquer des groupes).
              Réservé aux sources Xtream : une liste M3U livre un fichier
              entier, sans catalogue de catégories à interroger. */}
          {playlist.type === 'xtream' && (
            <button
              type="button"
              onClick={handleOpenCategories}
              disabled={loadingCategories || syncing}
              aria-label={t('playlists.categoriesEdit')}
              className={cn(
                'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 sm:px-2.5',
                'w-11 sm:w-auto',
                editCatalog
                  ? 'bg-accent/20 text-accent'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              )}
            >
              <Layers className={cn('h-4 w-4', loadingCategories && 'animate-pulse')} />
              <span className="hidden sm:inline">{t('playlists.categoriesEdit')}</span>
            </button>
          )}
          {/* Renommer les catégories et les chaînes. Disponible pour
              toutes les sources : contrairement à la sélection
              ci-dessus, qui n'a de sens que pour Xtream (catalogue
              interrogeable), le renommage agit sur les catégories et
              chaînes déjà rapportées, y compris celles d'une liste
              M3U. */}
          <button
            type="button"
            onClick={() => setShowRenames((v) => !v)}
            disabled={syncing}
            aria-expanded={showRenames}
            aria-label={t('playlists.catalogManage')}
            className={cn(
              'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 sm:px-2.5',
              'w-11 sm:w-auto',
              showRenames
                ? 'bg-accent/20 text-accent'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            )}
          >
            <Tags className="h-4 w-4" />
            <span className="hidden sm:inline">{t('playlists.catalogManage')}</span>
          </button>
          {/* Guide des programmes. Bouton absent quand la source n'en
              propose pas : une liste M3U sans adresse XMLTV n'a aucun
              guide à récupérer. Désactivé pendant la synchronisation du
              catalogue, car il a besoin des chaînes qu'elle écrit. */}
          {hasEpgSource && (
            <button
              onClick={handleSyncEPG}
              disabled={epgBusy || syncing}
              type="button"
              aria-label={t('playlists.syncEpg')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <CalendarDays className={cn('h-4 w-4', epgBusy && 'animate-pulse')} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDraftName(playlist.name);
              setEditing(true);
            }}
            disabled={editing}
            aria-label={t('playlists.editPlaylist')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={t('playlists.deletePlaylist')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50 transition-colors hover:bg-red-900/20 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
    </>
  );

  return (
    <GlassCard variant="glass" padding="md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
          <TypeIcon className="w-5 h-5 text-accent" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {editing ? (
              /* Renommage sur place plutôt que dans une fenêtre : un
                 seul champ ne justifie pas d'interrompre l'écran.
                 Entrée valide, Échap abandonne, et la perte du focus
                 vaut validation — sinon la modification disparaîtrait
                 sans explication. */
              <input
                type="text"
                value={draftName}
                autoFocus
                aria-label={t('playlists.playlistName')}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRename();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setDraftName(playlist.name);
                    setEditing(false);
                  }
                }}
                className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white/10 border border-accent/50 text-sm font-semibold text-white focus:outline-none"
              />
            ) : (
              <h3 className="font-semibold text-white truncate">{playlist.name}</h3>
            )}
            {isCurrent && <Badge variant="new" size="xs">{t('common.active')}</Badge>}
            <Badge variant="hd" size="xs">{typeLabel}</Badge>
          </div>

          <div className="flex items-center gap-3 text-xs text-white/40 flex-wrap">
            {playlist.channelCount > 0 && <span>{t('playlists.channelCount', { count: playlist.channelCount })}</span>}
            {playlist.movieCount > 0 && <span>{t('playlists.movieCount', { count: playlist.movieCount })}</span>}
            {playlist.seriesCount > 0 && <span>{t('playlists.seriesCount', { count: playlist.seriesCount })}</span>}
            {playlist.lastSync && (
              <span>{t('playlists.syncShort', { date: new Date(playlist.lastSync).toLocaleDateString(locale) })}</span>
            )}
            {playlist.xtream?.expiresAt && (
              <span>
                {t('playlists.expiresOn', {
                  date: new Date(playlist.xtream.expiresAt).toLocaleDateString(locale),
                })}
              </span>
            )}
          </div>

          {/* Étape en cours : sans elle, une attente de 40 s ressemble
              à une application figée. */}
          {syncing && step && (
            <p className="text-xs text-white/50 mt-1" role="status" aria-live="polite">
              {t(STEP_KEYS[step])}
            </p>
          )}

          {epgBusy && epgStep && (
            <p className="text-xs text-white/50 mt-1" role="status" aria-live="polite">
              {t(EPG_STEP_KEYS[epgStep])}
            </p>
          )}

          {!syncing && playlist.syncStatus === 'error' && (
            <p className="text-xs text-red-400 mt-1 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>{playlist.lastError ? t(ERROR_KEYS[playlist.lastError]) : t('playlists.syncError')}</span>
            </p>
          )}
        </div>
        </div>

        <div className="flex w-full items-center gap-1 sm:w-auto sm:shrink-0 sm:flex-wrap sm:justify-end">
          {actions}
        </div>
      </div>

      {/*
        Une seule source visible à la fois. Pas de popup : activer n'est
        pas destructif, un toast suffit. Le bouton est hors de la rangée
        d'icônes — trop facile à rater au milieu de sync / poubelle.
      */}
      {!isCurrent && (
        <button
          type="button"
          onClick={() => {
            setActivePlaylist(playlist.id);
            toast.success(t('playlists.activated', { name: playlist.name }));
          }}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <CheckCircle2 className="h-4 w-4" />
          {t('playlists.activate')}
        </button>
      )}

      {editing && (
        <p className="text-xs text-white/30 mt-3">
          {t('playlists.renameHint')} {t('playlists.editServerHint')}
        </p>
      )}

      {/*
        Écran de modification des catégories.
        Rendu en place plutôt qu'en fenêtre superposée : la liste peut
        faire 300 lignes, une modale imposerait deux zones de défilement
        imbriquées, impraticables à la télécommande.
      */}
      <AppDialog
        open={editCatalog !== null}
        onClose={() => setEditCatalog(null)}
        title={t('playlists.categoriesEditTitle')}
        description={t('playlists.categoriesEditHint')}
        size="lg"
      >
        {editCatalog && (
          <CategoryPicker
            catalog={editCatalog}
            selection={editSelection}
            onChange={setEditSelection}
            submitLabel={t('playlists.categoriesSave')}
            onSubmit={handleSaveCategories}
            onCancel={() => setEditCatalog(null)}
            busy={syncing}
          />
        )}
      </AppDialog>

      <AppDialog
        open={showRenames}
        onClose={() => setShowRenames(false)}
        title={t('playlists.catalogTitle', { name: playlist.name })}
        description={t('playlists.catalogHint')}
        size="lg"
      >
        <CatalogManager
          categories={playlistCategories}
          channels={playlistChannels}
          title={t('playlists.catalogTitle', { name: playlist.name })}
          hint={t('playlists.catalogHint')}
        />
      </AppDialog>

      {/* Une suppression efface la source, son catalogue et son mot de
          passe : rien de tout cela n'est récupérable. */}
      <ConfirmDialog
        open={confirmDelete}
        busy={deleting}
        title={t('playlists.deleteTitle', { name: playlist.name })}
        message={t('playlists.deleteMessage')}
        detail={
          playlist.type === 'xtream'
            ? t('playlists.deleteDetailXtream')
            : t('playlists.deleteDetailM3U')
        }
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </GlassCard>
  );
}
