import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_STEPS,
  NUMBERED_STEPS,
  FIRST_STEP,
  TOTAL_STEPS,
  MAX_PROFILE_NAME_LENGTH,
  isOnboardingStep,
  stepNumber,
  nextStep,
  previousStep,
  isLastStep,
  normalizeProfileName,
  isValidProfileName,
  canAdvance,
  initialState,
  restoreState,
  advance,
  goBack,
  type OnboardingState,
} from './onboardingFlow';

describe('la forme du parcours', () => {
  it('compte quatre ecrans, accueil en premier et source en dernier', () => {
    // L'ordre est un choix produit : l'accueil dit ce qu'est l'appli,
    // la langue ensuite pour que la suite s'affiche traduite, la
    // source en dernier parce que c'est la plus longue a remplir.
    expect(ONBOARDING_STEPS).toEqual(['welcome', 'language', 'profile', 'source']);
    expect(FIRST_STEP).toBe('welcome');
  });

  it('ne compte que trois etapes numerotees : l accueil ne demande rien', () => {
    // Quatre ecrans mais « sur 3 » : l'accueil se traverse d'un appui,
    // l'inclure ferait paraitre le parcours plus long qu'il ne l'est.
    expect(NUMBERED_STEPS).toEqual(['language', 'profile', 'source']);
    expect(TOTAL_STEPS).toBe(3);
  });

  it('numerote les etapes a partir de 1, pour un affichage « 2 sur 3 »', () => {
    expect(stepNumber('language')).toBe(1);
    expect(stepNumber('profile')).toBe(2);
    expect(stepNumber('source')).toBe(3);
  });

  it('ne donne aucun numero a l accueil, ce qui masque la barre', () => {
    // null plutot que 0 : un 0 aurait pu s'afficher par accident.
    expect(stepNumber('welcome')).toBeNull();
  });
});

describe('isOnboardingStep', () => {
  it('accepte les trois etapes connues', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(isOnboardingStep(step)).toBe(true);
    }
  });

  it('refuse tout ce qui vient du stockage sans etre une etape', () => {
    // Ces valeurs sont celles qu'on peut vraiment relire d'un
    // localStorage : ancienne version, donnee tronquee, bidouille.
    for (const bad of ['', 'Language', 'accueil', 'pin', null, undefined, 3, {}, []]) {
      expect(isOnboardingStep(bad)).toBe(false);
    }
  });
});

describe('naviguer entre les etapes', () => {
  it('avance dans l ordre', () => {
    expect(nextStep('welcome')).toBe('language');
    expect(nextStep('language')).toBe('profile');
    expect(nextStep('profile')).toBe('source');
  });

  it('renvoie null apres la derniere etape, ce qui signale la fin', () => {
    expect(nextStep('source')).toBeNull();
    expect(isLastStep('source')).toBe(true);
  });

  it('recule dans l ordre', () => {
    expect(previousStep('source')).toBe('profile');
    expect(previousStep('profile')).toBe('language');
    expect(previousStep('language')).toBe('welcome');
  });

  it('renvoie null avant la premiere etape, pour masquer le bouton Retour', () => {
    // Masquer plutot qu'afficher inactif : un bouton visible sans effet
    // se fait essayer a la telecommande et laisse croire a un blocage.
    expect(previousStep('welcome')).toBeNull();
  });

  it('seule la derniere etape est la derniere', () => {
    expect(isLastStep('welcome')).toBe(false);
    expect(isLastStep('language')).toBe(false);
    expect(isLastStep('profile')).toBe(false);
  });
});

describe('normalizeProfileName', () => {
  it('retire les espaces autour', () => {
    expect(normalizeProfileName('  Jean  ')).toBe('Jean');
  });

  it('reduit les espaces multiples a un seul', () => {
    // Sans cela « Jean   Dupont » et « Jean Dupont » donneraient deux
    // profils differents, visuellement identiques a l'ecran.
    expect(normalizeProfileName('Jean   Dupont')).toBe('Jean Dupont');
  });

  it('traite tabulations et retours a la ligne comme des espaces', () => {
    expect(normalizeProfileName('Jean\t\nDupont')).toBe('Jean Dupont');
  });

  it('coupe au-dela de la longueur maximale', () => {
    const long = 'a'.repeat(MAX_PROFILE_NAME_LENGTH + 20);
    expect(normalizeProfileName(long)).toHaveLength(MAX_PROFILE_NAME_LENGTH);
  });

  it('rend une chaine vide quand il n y a que des espaces', () => {
    expect(normalizeProfileName('     ')).toBe('');
  });

  it('conserve les accents et les alphabets non latins', () => {
    // L'application est traduite en arabe : refuser ces caracteres
    // rendrait le parcours impraticable pour une partie des gens.
    expect(normalizeProfileName('Amélie')).toBe('Amélie');
    expect(normalizeProfileName('عائلة')).toBe('عائلة');
  });

  it('accepte les emoji, souvent utilises comme marqueur de profil', () => {
    expect(normalizeProfileName('Salon 📺')).toBe('Salon 📺');
  });
});

describe('isValidProfileName', () => {
  it('accepte un nom court : c est un prenom, pas un identifiant', () => {
    expect(isValidProfileName('Bo')).toBe(true);
    expect(isValidProfileName('김')).toBe(true);
  });

  it('refuse le vide et les espaces seuls', () => {
    expect(isValidProfileName('')).toBe(false);
    expect(isValidProfileName('   ')).toBe(false);
    expect(isValidProfileName('\t\n')).toBe(false);
  });
});

describe('canAdvance', () => {
  it('laisse toujours quitter l accueil : il n y a rien a remplir', () => {
    expect(canAdvance('welcome', {})).toBe(true);
  });

  it('exige une langue reconnue a l etape langue', () => {
    expect(canAdvance('language', {})).toBe(false);
    expect(canAdvance('language', { locale: 'fr' })).toBe(true);
    expect(canAdvance('language', { locale: 'ar' })).toBe(true);
  });

  it('refuse une langue que l application ne parle pas', () => {
    // @ts-expect-error — on simule une valeur relue d'un stockage abime.
    expect(canAdvance('language', { locale: 'de' })).toBe(false);
  });

  it('exige un nom non vide a l etape profil', () => {
    expect(canAdvance('profile', {})).toBe(false);
    expect(canAdvance('profile', { profileName: '   ' })).toBe(false);
    expect(canAdvance('profile', { profileName: 'Jean' })).toBe(true);
  });

  it('exige une source reellement enregistree a l etape source', () => {
    // La seule etape qu'on ne peut pas contourner : la sauter menerait
    // droit a l'accueil vide, le probleme que ce parcours doit eviter.
    expect(canAdvance('source', {})).toBe(false);
    expect(canAdvance('source', { sourceAdded: false })).toBe(false);
    expect(canAdvance('source', { sourceAdded: true })).toBe(true);
  });
});

describe('advance', () => {
  it('passe a l etape suivante quand la condition est remplie', () => {
    const { state, done } = advance({ step: 'language', draft: { locale: 'fr' } });
    expect(state.step).toBe('profile');
    expect(done).toBe(false);
  });

  it('ne bouge pas tant que l etape n est pas satisfaite', () => {
    // La regle vit ici et non dans l'ecran : un bouton mal desactive
    // ne doit pas suffire a laisser filer une etape incomplete.
    const before: OnboardingState = { step: 'language', draft: {} };
    const { state, done } = advance(before);
    expect(state).toBe(before);
    expect(done).toBe(false);
  });

  it('signale la fin apres la derniere etape, sans changer d etape', () => {
    const { state, done } = advance({ step: 'source', draft: { sourceAdded: true } });
    expect(done).toBe(true);
    expect(state.step).toBe('source');
  });

  it('conserve la saisie en avancant', () => {
    const { state } = advance({
      step: 'profile',
      draft: { locale: 'es', profileName: 'Ana' },
    });
    expect(state.draft).toEqual({ locale: 'es', profileName: 'Ana' });
  });

  it('ne modifie pas l etat qu on lui donne', () => {
    // Une fonction pure ne touche pas a ses entrees : sans cela, React
    // ne verrait pas toujours le changement.
    const before: OnboardingState = { step: 'language', draft: { locale: 'fr' } };
    advance(before);
    expect(before.step).toBe('language');
  });

  it('mene de l accueil a la fin en quatre passages', () => {
    let state: OnboardingState = initialState();
    state = advance(state).state;
    expect(state.step).toBe('language');

    state = advance({ ...state, draft: { locale: 'fr' } }).state;
    expect(state.step).toBe('profile');

    state = advance({ ...state, draft: { ...state.draft, profileName: 'Jean' } }).state;
    expect(state.step).toBe('source');

    const last = advance({ ...state, draft: { ...state.draft, sourceAdded: true } });
    expect(last.done).toBe(true);
  });
});

describe('goBack', () => {
  it('revient a l etape precedente', () => {
    expect(goBack({ step: 'source', draft: {} }).step).toBe('profile');
  });

  it('ramene de la langue vers l accueil', () => {
    expect(goBack({ step: 'language', draft: {} }).step).toBe('welcome');
  });

  it('ne fait rien a l accueil, qui est le premier ecran', () => {
    const before: OnboardingState = { step: 'welcome', draft: {} };
    expect(goBack(before)).toBe(before);
  });

  it('conserve la saisie : corriger son prenom n efface pas la langue', () => {
    const state = goBack({
      step: 'source',
      draft: { locale: 'fr', profileName: 'Jean' },
    });
    expect(state.draft).toEqual({ locale: 'fr', profileName: 'Jean' });
  });
});

describe('initialState', () => {
  it('demarre a l accueil, sans rien de saisi', () => {
    expect(initialState()).toEqual({ step: 'welcome', draft: {} });
  });

  it('preremplit la langue quand le systeme en suggere une', () => {
    // L'ecran des langues arrive avec une case deja cochee : on
    // confirme au lieu de choisir a froid.
    expect(initialState('es')).toEqual({ step: 'welcome', draft: { locale: 'es' } });
  });

  it('ignore une suggestion que l application ne parle pas', () => {
    // @ts-expect-error — navigator.language peut renvoyer n'importe quoi.
    expect(initialState('de').draft.locale).toBeUndefined();
  });

  it('rend un objet neuf a chaque appel', () => {
    // Un objet partage serait modifie par accident d'un parcours a
    // l'autre — invisible en test unitaire, penible a diagnostiquer.
    expect(initialState()).not.toBe(initialState());
  });
});

describe('restoreState : reprendre un parcours interrompu', () => {
  it('rend une etape et une saisie valides telles quelles', () => {
    const stored = { step: 'profile', draft: { locale: 'en', profileName: 'Sam' } };
    expect(restoreState(stored)).toEqual({
      step: 'profile',
      draft: { locale: 'en', profileName: 'Sam' },
    });
  });

  it('repart du debut quand il n y a rien d enregistre', () => {
    expect(restoreState(undefined)).toEqual(initialState());
    expect(restoreState(null)).toEqual(initialState());
  });

  it('applique la langue suggeree quand rien n est enregistre', () => {
    expect(restoreState(undefined, 'en')).toEqual({ step: 'welcome', draft: { locale: 'en' } });
  });

  it('la langue enregistree prime sur celle devinee', () => {
    // Elle a ete choisie sciemment : la suggestion n'est qu'un repli.
    const state = restoreState({ step: 'profile', draft: { locale: 'ar' } }, 'en');
    expect(state.draft.locale).toBe('ar');
  });

  it('comble une langue absente par la suggestion', () => {
    const state = restoreState({ step: 'profile', draft: { profileName: 'Sam' } }, 'es');
    expect(state.draft.locale).toBe('es');
    expect(state.draft.profileName).toBe('Sam');
  });

  it('repart du debut sur une valeur qui n est pas un objet', () => {
    for (const bad of ['texte', 42, true, []]) {
      expect(restoreState(bad).step).toBe('welcome');
    }
  });

  it('ignore une etape inconnue et repart du debut', () => {
    // Cas reel : une version future ajoute une etape « pin », puis
    // l'utilisateur revient a une version anterieure.
    expect(restoreState({ step: 'pin', draft: {} }).step).toBe('welcome');
  });

  it('ignore une langue que l application ne parle pas', () => {
    const state = restoreState({ step: 'profile', draft: { locale: 'de' } });
    expect(state.draft.locale).toBeUndefined();
    expect(state.step).toBe('profile');
  });

  it('ignore un nom de profil qui n est pas du texte', () => {
    const state = restoreState({ step: 'profile', draft: { profileName: 42 } });
    expect(state.draft.profileName).toBeUndefined();
  });

  it('renettoie le nom relu : il a pu etre ecrit par une version anterieure', () => {
    const state = restoreState({ step: 'source', draft: { profileName: '  Jean   Dupont  ' } });
    expect(state.draft.profileName).toBe('Jean Dupont');
  });

  it('ignore un nom qui ne contient que des espaces', () => {
    const state = restoreState({ step: 'profile', draft: { profileName: '    ' } });
    expect(state.draft.profileName).toBeUndefined();
  });

  it('n accepte sourceAdded que s il vaut exactement vrai', () => {
    // Une valeur « presque vraie » comme 1 ou 'oui' ne doit pas laisser
    // croire qu'une source existe : l'accueil serait vide.
    expect(restoreState({ step: 'source', draft: { sourceAdded: 1 } }).draft.sourceAdded)
      .toBeUndefined();
    expect(restoreState({ step: 'source', draft: { sourceAdded: 'oui' } }).draft.sourceAdded)
      .toBeUndefined();
    expect(restoreState({ step: 'source', draft: { sourceAdded: true } }).draft.sourceAdded)
      .toBe(true);
  });

  it('accepte une saisie absente ou mal formee sans echouer', () => {
    expect(restoreState({ step: 'profile' }).draft).toEqual({});
    expect(restoreState({ step: 'profile', draft: 'texte' }).draft).toEqual({});
    expect(restoreState({ step: 'profile', draft: null }).draft).toEqual({});
  });

  it('ne conserve que les champs connus', () => {
    const state = restoreState({
      step: 'profile',
      draft: { locale: 'fr', inconnu: 'a jeter', pinHash: 'secret' },
    });
    expect(state.draft).toEqual({ locale: 'fr' });
  });

  it('survit a un objet profondement absurde', () => {
    expect(() => restoreState({ step: { nested: true }, draft: { locale: [] } })).not.toThrow();
    expect(restoreState({ step: { nested: true }, draft: { locale: [] } })).toEqual(initialState());
  });

  it('rend un etat directement utilisable par advance', () => {
    // L'enchainement reel apres une reprise : on relit, puis on avance.
    const restored = restoreState({ step: 'profile', draft: { locale: 'fr', profileName: 'Jean' } });
    expect(advance(restored).state.step).toBe('source');
  });
});
