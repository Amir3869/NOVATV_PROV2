/**
 * Logique du parcours de premier lancement.
 *
 * ─── Pourquoi un fichier sans React ────────────────────────────────
 *
 * Tout ce qui décide — quelle étape vient après, peut-on revenir en
 * arrière, où reprendre après une fermeture — est ici, en fonctions
 * pures. Une fonction pure prend des valeurs et renvoie un résultat,
 * sans rien lire ni modifier autour d'elle. Deux appels avec les mêmes
 * valeurs donnent toujours le même résultat.
 *
 * L'intérêt est concret : ces règles se vérifient par des tests
 * ordinaires, sans navigateur, sans affichage, en quelques
 * millisecondes. L'écran, lui, se contentera d'afficher ce que ces
 * fonctions lui disent. C'est le découpage déjà en place pour la
 * sélection de catégories, le sélecteur de chaînes et l'ajustement
 * d'image.
 */

import { isLocale, type Locale } from '@/i18n';

/**
 * Les écrans du parcours, dans l'ordre.
 *
 *   welcome   page d'accueil : ce qu'est l'application, un seul bouton
 *   language  la langue de l'interface
 *   profile   le nom de la personne qui regarde
 *   source    les identifiants Xtream ou le fichier M3U
 *
 * L'accueil sert à deux choses. Il dit franchement, dès la première
 * seconde, que NOVA TV lit des sources mais n'en fournit aucune. Et il
 * laisse à `detectLocale` le temps de deviner la langue du système :
 * l'écran suivant arrive donc déjà traduit, et ne demande plus qu'une
 * confirmation.
 *
 * La langue passe avant le reste du parcours : quelqu'un qui ouvre
 * l'application en arabe ne doit pas traverser deux écrans en français
 * avant de pouvoir en changer.
 */
export const ONBOARDING_STEPS = ['welcome', 'language', 'profile', 'source'] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Premier écran du parcours. Point de départ d'un démarrage neuf. */
export const FIRST_STEP: OnboardingStep = ONBOARDING_STEPS[0];

/**
 * Les étapes qui comptent dans la progression affichée.
 *
 * ─── Pourquoi l'accueil est exclu ──────────────────────────────────
 *
 * Quatre écrans, mais « Étape 1 sur 3 ». Ce n'est pas une erreur :
 * l'accueil ne demande rien, il n'y a donc rien à y franchir.
 * Annoncer « 1 sur 4 » ferait paraître le parcours plus long qu'il ne
 * l'est, pour un écran qui se traverse d'un seul appui.
 *
 * Cette liste est dérivée de la précédente plutôt que réécrite à la
 * main : ajouter une étape à `ONBOARDING_STEPS` la fait entrer
 * automatiquement dans le compte, sans risque d'oubli.
 */
export const NUMBERED_STEPS = ONBOARDING_STEPS.filter(
  (step): step is Exclude<OnboardingStep, 'welcome'> => step !== 'welcome'
);

/**
 * Vérifie qu'une valeur inconnue est bien une étape connue.
 *
 * Indispensable à la reprise : l'étape en cours est relue depuis le
 * stockage du navigateur, où n'importe quoi a pu être écrit — une
 * version antérieure de l'application, une modification manuelle, une
 * donnée corrompue. Sans ce contrôle, on afficherait un écran vide.
 */
export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return (
    typeof value === 'string' &&
    (ONBOARDING_STEPS as readonly string[]).includes(value)
  );
}

/**
 * Position de l'étape dans la progression affichée, à partir de 1.
 *
 * Renvoie `null` pour l'accueil, qui ne porte pas de numéro. Ce `null`
 * n'est pas un oubli : c'est lui qui dit à l'écran de masquer
 * entièrement la barre de progression. Un `0` ou un `-1` aurait pu
 * être affiché par accident.
 */
export function stepNumber(step: OnboardingStep): number | null {
  const i = (NUMBERED_STEPS as readonly OnboardingStep[]).indexOf(step);
  return i === -1 ? null : i + 1;
}

/** Nombre d'étapes numérotées — le « 3 » de « Étape 2 sur 3 ». */
export const TOTAL_STEPS = NUMBERED_STEPS.length;

/**
 * Étape suivante, ou `null` si l'on est déjà à la dernière.
 *
 * `null` porte une information : il n'y a plus rien après, le parcours
 * est terminé. C'est à l'appelant d'en tirer la conclusion (marquer le
 * parcours comme fait, aller à l'accueil).
 */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[i + 1] ?? null;
}

/**
 * Étape précédente, ou `null` si l'on est à la première.
 *
 * `null` sert à masquer le bouton « Retour » plutôt qu'à l'afficher
 * inactif : un bouton visible mais sans effet se fait essayer à la
 * télécommande, et donne l'impression que l'application est bloquée.
 */
export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.indexOf(step);
  return i <= 0 ? null : ONBOARDING_STEPS[i - 1];
}

/** Vrai si l'étape est la dernière — le bouton porte alors « Terminer ». */
export function isLastStep(step: OnboardingStep): boolean {
  return nextStep(step) === null;
}

/**
 * Ce qu'a saisi l'utilisateur, au fil des étapes.
 *
 * Chaque champ est facultatif : le parcours se remplit
 * progressivement, et peut être interrompu à tout moment.
 */
export interface OnboardingDraft {
  locale?: Locale;
  profileName?: string;
  /** Passe à vrai dès qu'une source a été enregistrée avec succès. */
  sourceAdded?: boolean;
}

/**
 * Nettoie un nom de profil saisi au clavier.
 *
 * Retire les espaces de début et de fin, et réduit toute suite
 * d'espaces à un seul. Sans cela, « Jean   Dupont » et « Jean Dupont »
 * deviendraient deux profils distincts à l'écran, visuellement
 * identiques.
 *
 * La limite de 30 caractères évite qu'un nom déborde de la pastille de
 * profil. On coupe plutôt que de refuser : refuser en cours de frappe
 * bloque la saisie sans expliquer pourquoi.
 */
export const MAX_PROFILE_NAME_LENGTH = 30;

export function normalizeProfileName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_PROFILE_NAME_LENGTH);
}

/**
 * Un nom de profil est-il utilisable ?
 *
 * Seule règle : il reste quelque chose après nettoyage. On n'impose ni
 * longueur minimale, ni caractères interdits — c'est un prénom, pas un
 * identifiant technique, et refuser « Bo » ou « 김 » n'aurait aucun
 * sens.
 */
export function isValidProfileName(value: string): boolean {
  return normalizeProfileName(value).length > 0;
}

/**
 * L'étape en cours est-elle satisfaite, autrement dit peut-on avancer ?
 *
 * Une règle par étape :
 *
 *   welcome   rien à remplir : on peut toujours continuer
 *   language  une langue reconnue a été choisie
 *   profile   un nom non vide a été saisi
 *   source    une source a réellement été enregistrée
 *
 * L'étape « source » est la seule qu'on ne puisse pas contourner. La
 * sauter mènerait mécaniquement à un accueil vide, c'est-à-dire au
 * problème que ce parcours existe pour éviter.
 */
export function canAdvance(step: OnboardingStep, draft: OnboardingDraft): boolean {
  switch (step) {
    case 'welcome':
      return true;
    case 'language':
      return isLocale(draft.locale);
    case 'profile':
      return isValidProfileName(draft.profileName ?? '');
    case 'source':
      return draft.sourceAdded === true;
  }
}

/**
 * État complet du parcours, tel qu'il est conservé entre deux
 * ouvertures de l'application.
 */
export interface OnboardingState {
  step: OnboardingStep;
  draft: OnboardingDraft;
}

/**
 * Parcours neuf, tel qu'au tout premier lancement.
 *
 * `suggestedLocale` est la langue devinée à partir du système, via
 * `detectLocale`. Elle préremplit le choix : l'écran des langues
 * arrive avec une case déjà cochée, et l'utilisateur confirme au lieu
 * de choisir à froid. Il reste évidemment libre d'en changer.
 *
 * Le paramètre est facultatif pour que la fonction reste testable sans
 * navigateur — un parcours sans suggestion démarre simplement sans
 * rien de coché.
 */
export function initialState(suggestedLocale?: Locale): OnboardingState {
  return {
    step: FIRST_STEP,
    draft: isLocale(suggestedLocale) ? { locale: suggestedLocale } : {},
  };
}

/**
 * Reconstruit un parcours interrompu à partir d'une valeur relue du
 * stockage.
 *
 * ─── Ce que cette fonction protège ─────────────────────────────────
 *
 * L'utilisateur a demandé que fermer l'application en cours de route
 * ne fasse pas tout recommencer. On enregistre donc l'étape et la
 * saisie — quelques octets, dans `localStorage`, sans aucun rapport
 * avec le catalogue qui vit dans IndexedDB.
 *
 * Tout ce qui est relu du disque est suspect : écrit par une version
 * antérieure, modifié à la main, tronqué. Chaque champ est donc
 * vérifié un par un, et tout ce qui n'est pas reconnu est ignoré
 * plutôt que de faire échouer la lecture. Au pire, on repart de la
 * première étape — jamais sur un écran cassé.
 *
 * Le nom de profil est renettoyé au passage : la version enregistrée
 * a pu l'être par une version antérieure aux règles actuelles.
 */
export function restoreState(value: unknown, suggestedLocale?: Locale): OnboardingState {
  if (typeof value !== 'object' || value === null) return initialState(suggestedLocale);

  const raw = value as Record<string, unknown>;
  const step = isOnboardingStep(raw.step) ? raw.step : FIRST_STEP;

  const rawDraft =
    typeof raw.draft === 'object' && raw.draft !== null
      ? (raw.draft as Record<string, unknown>)
      : {};

  const draft: OnboardingDraft = {};
  // La langue enregistrée prime toujours sur celle devinée : elle a été
  // choisie sciemment, la suggestion n'est qu'un repli.
  if (isLocale(rawDraft.locale)) draft.locale = rawDraft.locale;
  else if (isLocale(suggestedLocale)) draft.locale = suggestedLocale;
  if (typeof rawDraft.profileName === 'string') {
    const name = normalizeProfileName(rawDraft.profileName);
    if (name) draft.profileName = name;
  }
  if (rawDraft.sourceAdded === true) draft.sourceAdded = true;

  return { step, draft };
}

/**
 * Fait avancer le parcours d'une étape.
 *
 * Renvoie l'état inchangé si l'étape en cours n'est pas satisfaite :
 * la règle de passage vit ici, et non dans l'écran, pour qu'un bouton
 * mal désactivé ne laisse pas filer une étape incomplète.
 *
 * `done` indique que la dernière étape vient d'être franchie. C'est le
 * signal qui fera passer `isOnboarded` à vrai.
 */
export function advance(state: OnboardingState): { state: OnboardingState; done: boolean } {
  if (!canAdvance(state.step, state.draft)) {
    return { state, done: false };
  }

  const next = nextStep(state.step);
  if (next === null) {
    return { state, done: true };
  }

  return { state: { ...state, step: next }, done: false };
}

/**
 * Revient à l'étape précédente, en conservant la saisie.
 *
 * On garde volontairement ce qui a déjà été rempli : revenir corriger
 * son prénom ne doit pas effacer la langue choisie.
 */
export function goBack(state: OnboardingState): OnboardingState {
  const previous = previousStep(state.step);
  return previous === null ? state : { ...state, step: previous };
}
