'use client';

/**
 * Parcours de premier lancement.
 *
 * Cet écran n'invente aucune règle : il affiche ce que décide
 * `onboardingFlow.ts` — quelle étape, peut-on avancer, où reprendre.
 * Toute la logique y est testée sans navigateur ; ici il ne reste que
 * l'affichage et la saisie.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Link as LinkIcon, FileText, Check } from 'lucide-react';
import { defaultAvatarFor } from '@/services/profiles/avatars';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation, useSetLocale, LOCALES, LOCALE_NAMES, detectLocale, type Locale } from '@/i18n';
import { XtreamForm } from '@/features/playlists/forms/XtreamForm';
import { M3UUrlForm } from '@/features/playlists/forms/M3UUrlForm';
import { M3UFileForm } from '@/features/playlists/forms/M3UFileForm';
import { NovaLogo } from '@/design-system/components/NovaLogo';
import type { Profile } from '@/types';
import {
  TOTAL_STEPS,
  advance,
  canAdvance,
  goBack,
  isLastStep,
  normalizeProfileName,
  previousStep,
  restoreState,
  stepNumber,
  MAX_PROFILE_NAME_LENGTH,
  type OnboardingState,
} from '@/services/onboarding/onboardingFlow';

/**
 * Où l'avancement est conservé entre deux ouvertures.
 *
 * Volontairement séparé de `novatv-storage`, qui porte les réglages
 * définitifs. Un parcours abandonné n'est pas un réglage : cette clé
 * est effacée dès qu'il aboutit.
 */
const STORAGE_KEY = 'novatv-onboarding';

/**
 * Sait-on déjà que l'on tourne dans le navigateur ?
 *
 * Le HTML est pré-généré au build : le premier rendu côté client doit
 * lui être identique, sinon React signale une erreur d'hydratation. On
 * affiche donc un écran neutre tant que ce n'est pas le cas.
 *
 * `useSyncExternalStore` est fait pour cela : son instantané serveur
 * vaut `false`, son instantané client `true`. Aucun abonnement n'est
 * nécessaire — la valeur ne change qu'une fois, à l'hydratation.
 */
const NO_OP_SUBSCRIBE = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(
    NO_OP_SUBSCRIBE,
    () => true,
    () => false
  );
}

/**
 * Relit l'avancement enregistré. Ne lève jamais.
 *
 * Appelée à l'initialisation de l'état plutôt que dans un effet :
 * écrire dans l'état depuis un effet déclenche un second rendu en
 * cascade, ce que React déconseille — et que la configuration ESLint
 * du projet refuse.
 */
function readStoredState(): OnboardingState {
  let stored: unknown = null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    // Stockage inaccessible ou contenu illisible : on repart de zéro
    // plutôt que d'empêcher l'application de démarrer.
  }

  let suggested: Locale | undefined;
  try {
    suggested = detectLocale(window.navigator.languages ?? [window.navigator.language]);
  } catch {
    suggested = undefined;
  }

  return restoreState(stored, suggested);
}

/** Anneau de focus commun. Sans lui, la navigation télécommande est aveugle. */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black';

/** Les trois types de source, dans l'ordre d'affichage. */
const SOURCE_KINDS = [
  { id: 'xtream', icon: Key, titleKey: 'onboarding.sourceXtream', hintKey: 'onboarding.sourceXtreamHint' },
  { id: 'm3u_url', icon: LinkIcon, titleKey: 'onboarding.sourceM3UUrl', hintKey: 'onboarding.sourceM3UUrlHint' },
  { id: 'm3u_file', icon: FileText, titleKey: 'onboarding.sourceM3UFile', hintKey: 'onboarding.sourceM3UFileHint' },
] as const;

type SourceKind = (typeof SOURCE_KINDS)[number]['id'];

export function WelcomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const setLocale = useSetLocale();
  const addProfile = useAppStore((s) => s.addProfile);
  const profiles = useAppStore((s) => s.profiles);
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const playlistCount = useAppStore((s) => s.playlists.length);

  const hydrated = useHydrated();

  /**
   * L'avancement, relu une seule fois à la création de l'état.
   *
   * L'initialiseur paresseux — la fonction passée à `useState` — ne
   * s'exécute qu'au tout premier rendu. Sur le serveur il n'y a pas de
   * `window` : on part de l'état neuf, et le vrai est lu côté client.
   * Ce premier rendu client n'est jamais affiché tel quel, `hydrated`
   * le remplaçant par un écran neutre.
   */
  const [state, setState] = useState<OnboardingState>(() =>
    typeof window === 'undefined' ? { step: 'welcome', draft: {} } : readStoredState()
  );
  const [sourceKind, setSourceKind] = useState<SourceKind | null>(null);

  // Nombre de sources au montage : sert à détecter un ajout réussi.
  const initialPlaylistCount = useRef(playlistCount);

  /**
   * Une source déjà enregistrée satisfait l'étape.
   *
   * Cas concret : le parcours est rejoué depuis les réglages par
   * quelqu'un qui a déjà configuré son accès. Sans cette lecture, il
   * lui faudrait ajouter une *seconde* source pour pouvoir terminer,
   * alors que la première est parfaitement valable.
   *
   * On combine avec `draft.sourceAdded`, qui reste nécessaire au
   * premier lancement : la playlist n'existe pas encore au moment où
   * l'étape s'affiche.
   */
  const hasSource = state.draft.sourceAdded === true || playlistCount > 0;
  const draftWithSource = useMemo(
    () => (hasSource ? { ...state.draft, sourceAdded: true } : state.draft),
    [hasSource, state.draft]
  );

  /** Enregistre l'avancement à chaque changement. */
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota atteint ou mode privé : perdre la reprise est acceptable,
      // bloquer le parcours ne l'est pas.
    }
  }, [state, hydrated]);

  /**
   * Applique la langue immédiatement, sans attendre la fin du parcours.
   *
   * Sans cela, choisir « English » à l'étape 1 laisserait les étapes 2
   * et 3 en français : le choix paraîtrait ignoré.
   */
  useEffect(() => {
    if (hydrated && state.draft.locale) setLocale(state.draft.locale);
  }, [hydrated, state.draft.locale, setLocale]);

  /**
   * Détecte l'ajout d'une source.
   *
   * Les formulaires enregistrent eux-mêmes la playlist dans le store et
   * ne préviennent pas l'appelant. Plutôt que de les modifier — ils
   * sont partagés avec l'écran des sources — on observe le résultat :
   * une playlist de plus qu'au montage signifie que l'import a abouti.
   */
  useEffect(() => {
    if (playlistCount > initialPlaylistCount.current) {
      setState((s) => ({ ...s, draft: { ...s.draft, sourceAdded: true } }));
      setSourceKind(null);
    }
  }, [playlistCount]);

  const finish = useCallback(() => {
    const name = normalizeProfileName(state.draft.profileName ?? '');

    /**
     * Un profil n'est créé que s'il n'en existe pas déjà un du même nom.
     *
     * Sans ce contrôle, rejouer le parcours depuis les réglages en
     * gardant son prénom ajouterait un doublon à chaque passage — deux
     * « Jean » identiques dans le sélecteur de profils, impossibles à
     * distinguer.
     *
     * La comparaison ignore la casse et les espaces superflus, comme
     * `normalizeProfileName` le fait déjà à la saisie.
     */
    const exists = profiles.some(
      (p) => normalizeProfileName(p.name).toLowerCase() === name.toLowerCase()
    );

    if (name && !exists) {
      const now = new Date().toISOString();
      const id = `profile-${Date.now()}`;
      const profile: Profile = {
        id,
        name,
        // Plus d'`avatar-default` : cette valeur ne correspondait à
        // aucun fichier. On pose un avatar réel du catalogue, dérivé
        // de l'identifiant du profil.
        avatarId: defaultAvatarFor(id).id,
        isKidsProfile: false,
        language: state.draft.locale ?? 'fr',
        audioLanguage: state.draft.locale ?? 'fr',
        createdAt: now,
        updatedAt: now,
      };
      addProfile(profile);
    }

    setOnboarded(true);
    // Le parcours est terminé : sa reprise n'a plus d'objet.
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sans conséquence : `isOnboarded` fait foi.
    }
    router.replace('/');
  }, [state.draft, profiles, addProfile, setOnboarded, router]);

  const handleNext = useCallback(() => {
    // On avance sur l'état enrichi d'une source préexistante, sinon la
    // dernière étape resterait bloquée lors d'un rejeu.
    const result = advance({ ...state, draft: draftWithSource });
    if (result.done) finish();
    else setState(result.state);
  }, [state, draftWithSource, finish]);

  const handleBack = useCallback(() => setState((s) => goBack(s)), []);

  /**
   * Avant hydratation, on ne peut afficher que ce que contient le HTML
   * pré-généré — lequel ignore l'étape en cours et la langue du
   * système. On rend donc la seule marque, sans texte traduit : ce qui
   * suit dépend entièrement de valeurs lues dans le navigateur.
   */
  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[color:var(--surface-0)]">
        <span className="text-3xl font-extrabold tracking-[0.16em] text-white">
          NOVA<span className="text-accent">TV</span>
        </span>
      </div>
    );
  }

  const step = state.step;
  const number = stepNumber(step);
  const canGoNext = canAdvance(step, draftWithSource);
  const canGoBack = previousStep(step) !== null;

  return (
    /**
     * `h-dvh` et non `min-h-screen`.
     *
     * `min-h-screen` autorise le contenu à dépasser : sur mobile la page
     * se mettait à défiler alors qu'un parcours de configuration doit
     * tenir dans l'écran. `h-dvh` fixe la hauteur à celle du viewport
     * *dynamique* — c'est-à-dire barre d'adresse du navigateur mobile
     * déduite, ce que `100vh` ne fait pas et qui provoquait un
     * débordement d'une centaine de pixels sur téléphone.
     *
     * `overflow-hidden` ici, et défilement interne sur le seul <main> :
     * l'en-tête et les boutons restent ainsi toujours visibles.
     */
    <div className="h-dvh flex flex-col overflow-hidden bg-[color:var(--surface-0)]">
      {/* Lueur d'ambiance, purement décorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-0 h-[45vh] w-[70vw] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(ellipse, var(--accent), transparent 70%)' }}
      />

      {/* En-tête : marque et progression. */}
      <header className="relative z-10 flex items-center gap-4 px-6 pt-6 md:px-12 md:pt-8">
        <span className="text-sm font-extrabold tracking-[0.14em] text-white">
          NOVA<span className="text-accent">TV</span>
        </span>

        {/* `number === null` sur l'accueil : il ne demande rien, ce n'est
            pas une étape. Quatre écrans, mais « sur 3 ». */}
        {number !== null && (
          <>
            <div className="flex max-w-[210px] flex-1 gap-2" aria-hidden="true">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <div
                  key={i}
                  className={`h-[3px] flex-1 rounded-full transition-colors ${
                    i < number ? 'bg-accent' : 'bg-white/12'
                  }`}
                />
              ))}
            </div>
            {/* La barre est décorative ; ce texte porte l'information
                pour les lecteurs d'écran. */}
            <p className="text-xs tabular-nums text-white/25">
              {t('onboarding.stepOf', { current: number, total: TOTAL_STEPS })}
            </p>
          </>
        )}
      </header>

      {/* `min-h-0` : sans cela un enfant en `flex-1` refuse de rétrécir
          sous sa taille de contenu et déborde du conteneur, ce qui
          ramènerait le défilement de page qu'on vient de supprimer.
          `overflow-y-auto` garde une issue si l'écran est très court
          (téléphone en paysage), mais le défilement reste interne. */}
      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-8 md:px-12">
        <div className="w-full max-w-2xl text-center">
          {step === 'welcome' && <WelcomeStep onStart={handleNext} />}
          {step === 'language' && (
            <LanguageStep
              selected={state.draft.locale}
              onSelect={(locale) => setState((s) => ({ ...s, draft: { ...s.draft, locale } }))}
            />
          )}
          {step === 'profile' && (
            <ProfileStep
              value={state.draft.profileName ?? ''}
              onChange={(profileName) => setState((s) => ({ ...s, draft: { ...s.draft, profileName } }))}
            />
          )}
          {step === 'source' && (
            <SourceStep
              added={hasSource}
              kind={sourceKind}
              onPick={setSourceKind}
            />
          )}
        </div>
      </main>

      {/* Sur l'écran d'accueil, le bouton « Commencer » est rendu au
          centre, sous le texte (voir WelcomeStep) : un appel à l'action
          isolé dans l'angle inférieur droit se remarque mal et oblige
          l'œil à traverser l'écran. Le pied de page ne sert donc qu'aux
          étapes suivantes, où « Retour » et « Suivant » forment une
          paire attendue en bas. */}
      {step !== 'welcome' && (
      <footer className="relative z-10 flex items-center justify-between px-6 pb-8 md:px-12 md:pb-10">
        {/* Masqué et non désactivé sur le premier écran : un bouton
            visible mais inerte se fait essayer à la télécommande et
            laisse croire à un blocage. */}
        {canGoBack ? (
          <button
            type="button"
            onClick={handleBack}
            className={`rounded-xl border border-white/8 px-6 py-3 text-sm font-semibold text-white/60 transition-colors hover:bg-white/5 hover:text-white ${FOCUS_RING}`}
          >
            {t('onboarding.back')}
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext}
          className={`rounded-xl px-8 py-3 text-sm font-semibold transition-colors ${FOCUS_RING} ${
            canGoNext
              ? 'bg-accent text-[color:var(--on-accent)] hover:bg-accent-hover'
              : 'cursor-not-allowed bg-white/7 text-white/25'
          }`}
        >
          {isLastStep(step) ? t('onboarding.finish') : t('onboarding.next')}
        </button>
      </footer>
      )}
    </div>
  );
}

/* ─────────────────────────── Écran d'accueil ─────────────────────── */

function WelcomeStep({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <div>
      {/* Le logo dessiné, pas seulement le mot : c'est le premier écran
          de l'application, la marque doit y être complète. */}
      <NovaLogo variant="icon" size="xl" colorScheme="red" className="mb-6" />

      {/* `leading-none` empêche l'interlignage par défaut d'ajouter un
          creux sous un texte à grand corps, ce qui décalait le titre. */}
      <p className="mb-6 text-[2.125rem] font-extrabold leading-none tracking-[0.16em] text-white md:text-5xl">
        NOVA<span className="text-accent">TV</span>
      </p>

      {/* `text-balance` répartit le titre sur des lignes de longueur
          voisine au lieu de laisser un mot seul en dernière ligne. */}
      <h1 className="mb-3 text-[1.625rem] font-bold tracking-[-0.01em] text-balance text-white md:text-4xl">
        {t('onboarding.welcomeTitle')}
      </h1>

      <p className="mx-auto max-w-[29rem] text-base leading-relaxed text-balance text-white/[0.72] md:text-lg">
        {t('onboarding.welcomeSubtitle')}
      </p>

      {/* L'appel à l'action est ici, sous le texte qu'il conclut. */}
      <button
        type="button"
        onClick={onStart}
        className={`mt-9 rounded-xl bg-accent px-10 py-3.5 text-[15px] font-semibold text-[color:var(--on-accent)] transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
      >
        {t('onboarding.start')}
      </button>

      {/* Dire d'emblée ce que le produit n'est pas : NOVA TV lit des
          sources, il n'en fournit aucune. */}
      <p className="mx-auto mt-9 max-w-[27rem] text-xs leading-relaxed text-white/30">
        {t('onboarding.welcomeDisclaimer')}
      </p>
    </div>
  );
}

/* ────────────────────────────── Langue ───────────────────────────── */

function LanguageStep({
  selected,
  onSelect,
}: {
  selected?: Locale;
  onSelect: (locale: Locale) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-4 text-5xl" aria-hidden="true">🌍</div>
      <h1 className="mb-2 text-2xl font-bold text-white">{t('onboarding.languageTitle')}</h1>
      <p className="mx-auto mb-7 max-w-sm text-sm text-white/45">{t('onboarding.languageSubtitle')}</p>

      {/* `radiogroup` : ces boutons forment un choix unique. Un lecteur
          d'écran annonce « 2 sur 4 » et l'état coché. */}
      <div role="radiogroup" aria-label={t('onboarding.languageTitle')} className="mx-auto grid max-w-md grid-cols-2 gap-3">
        {LOCALES.map((locale) => {
          const active = selected === locale;
          return (
            <button
              key={locale}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(locale)}
              className={`flex items-center justify-between rounded-xl border px-5 py-4 text-left text-[15px] font-medium transition-colors ${FOCUS_RING} ${
                active
                  ? 'border-accent bg-accent/10 text-white'
                  : 'border-white/8 bg-white/4 text-white hover:bg-white/8'
              }`}
            >
              {/* Chaque nom est écrit dans sa propre langue : `lang` évite
                  qu'un lecteur d'écran lise « العربية » avec la
                  prononciation de la langue courante. */}
              <span lang={locale}>{LOCALE_NAMES[locale]}</span>
              {active && <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────── Profil ───────────────────────────── */

function ProfileStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Le champ prend le focus à l'arrivée : sur téléviseur, cela évite de
  // devoir l'atteindre à la télécommande avant de pouvoir saisir.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = normalizeProfileName(value);
  const initial = trimmed ? trimmed[0]?.toUpperCase() : '?';
  const atMax = value.length >= MAX_PROFILE_NAME_LENGTH;

  return (
    <div>
      <div
        aria-hidden="true"
        className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[22px] text-3xl font-bold text-white"
        style={{ background: 'linear-gradient(140deg, var(--accent), #7a0a1c)' }}
      >
        {initial}
      </div>
      <h1 className="mb-2 text-2xl font-bold text-white">{t('onboarding.profileTitle')}</h1>
      <p className="mx-auto mb-7 max-w-sm text-sm text-white/45">{t('onboarding.profileSubtitle')}</p>

      <div className="mx-auto max-w-sm">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={MAX_PROFILE_NAME_LENGTH}
          placeholder={t('onboarding.profilePlaceholder')}
          aria-label={t('onboarding.profileTitle')}
          className={`w-full rounded-xl border border-white/8 bg-white/4 px-5 py-4 text-center text-base text-white placeholder:text-white/20 ${FOCUS_RING} focus:border-accent/50`}
        />
        {/* Hauteur réservée en permanence : sans cela, l'apparition du
            message décalerait le champ vers le haut. */}
        <p className="mt-2 h-4 text-xs text-white/25">
          {atMax ? t('onboarding.profileMaxLength') : ''}
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────── Source ───────────────────────────── */

function SourceStep({
  added,
  kind,
  onPick,
}: {
  added: boolean;
  kind: SourceKind | null;
  onPick: (k: SourceKind | null) => void;
}) {
  const { t } = useTranslation();

  // Source enregistrée : on confirme au lieu de reproposer la liste.
  if (added) {
    return (
      <div>
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent/15">
          <Check className="h-8 w-8 text-accent" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">{t('onboarding.sourceAdded')}</h1>
        <p className="mx-auto max-w-sm text-sm text-white/45">{t('onboarding.sourceSubtitle')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 text-5xl" aria-hidden="true">📡</div>
      <h1 className="mb-2 text-2xl font-bold text-white">{t('onboarding.sourceTitle')}</h1>
      <p className="mx-auto mb-7 max-w-md text-sm text-white/45">{t('onboarding.sourceSubtitle')}</p>

      <div className="mx-auto flex max-w-md flex-col gap-3">
        {SOURCE_KINDS.map(({ id, icon: Icon, titleKey, hintKey }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className={`flex items-center gap-4 rounded-xl border border-white/8 bg-white/4 px-5 py-4 text-left transition-colors hover:bg-white/8 ${FOCUS_RING}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15">
              <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">{t(titleKey)}</span>
              <span className="block text-xs text-white/45">{t(hintKey)}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Formulaires repris tels quels de l'écran des sources : même
          validation, mêmes messages d'erreur, aucune duplication. */}
      {kind === 'xtream' && <XtreamForm onClose={() => onPick(null)} />}
      {kind === 'm3u_url' && <M3UUrlForm onClose={() => onPick(null)} />}
      {kind === 'm3u_file' && <M3UFileForm onClose={() => onPick(null)} />}
    </div>
  );
}
