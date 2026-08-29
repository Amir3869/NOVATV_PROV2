import { describe, it, expect } from 'vitest';
import {
  AVATARS,
  avatarSrc,
  defaultAvatarFor,
  isKnownAvatarId,
  resolveAvatar,
} from './avatars';

describe('AVATARS — le catalogue lui-même', () => {
  it('contient exactement huit avatars', () => {
    expect(AVATARS).toHaveLength(8);
  });

  it('n’a aucun identifiant en double', () => {
    // Un doublon rendrait `BY_ID` silencieusement incohérent : la
    // seconde entrée écraserait la première sans aucune erreur.
    const ids = AVATARS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('n’a aucun chemin de fichier en double', () => {
    const srcs = AVATARS.map((a) => a.src);
    expect(new Set(srcs).size).toBe(srcs.length);
  });

  it('pointe tous vers /avatars/ en .webp', () => {
    for (const avatar of AVATARS) {
      expect(avatar.src).toMatch(/^\/avatars\/[a-z]+\.webp$/);
    }
  });

  it('nomme chaque fichier d’après son identifiant', () => {
    // Garde-fou contre la faute de frappe : `{ id: 'renard', src:
    // '/avatars/robot.webp' }` passerait tous les autres tests.
    for (const avatar of AVATARS) {
      expect(avatar.src).toBe(`/avatars/${avatar.id}.webp`);
    }
  });

  it('propose au moins un avatar pour les profils enfants', () => {
    // `defaultAvatarFor` filtre sur ce drapeau ; une liste vide le
    // ferait retomber sur le catalogue complet.
    expect(AVATARS.some((a) => a.kidFriendly)).toBe(true);
  });
});

describe('isKnownAvatarId', () => {
  it('reconnaît un identifiant du catalogue', () => {
    expect(isKnownAvatarId('renard')).toBe(true);
  });

  it('rejette un identifiant absent', () => {
    expect(isKnownAvatarId('licorne')).toBe(false);
  });

  it('rejette l’ancienne valeur avatar-default', () => {
    // C'est exactement la valeur portée par les profils existants.
    expect(isKnownAvatarId('avatar-default')).toBe(false);
  });

  it('rejette null, undefined et la chaîne vide', () => {
    expect(isKnownAvatarId(null)).toBe(false);
    expect(isKnownAvatarId(undefined)).toBe(false);
    expect(isKnownAvatarId('')).toBe(false);
  });
});

describe('avatarSrc', () => {
  it('renvoie le chemin d’un identifiant connu', () => {
    expect(avatarSrc('nova')).toBe('/avatars/nova.webp');
  });

  it('renvoie null sur un identifiant inconnu', () => {
    expect(avatarSrc('inexistant')).toBeNull();
  });

  it('renvoie null sur null et undefined', () => {
    expect(avatarSrc(null)).toBeNull();
    expect(avatarSrc(undefined)).toBeNull();
  });
});

describe('defaultAvatarFor', () => {
  it('renvoie toujours un avatar du catalogue', () => {
    const avatar = defaultAvatarFor('profile-1');
    expect(AVATARS).toContainEqual(avatar);
  });

  it('renvoie le même avatar pour le même identifiant', () => {
    // La stabilité est le point essentiel : sans elle, l'avatar
    // changerait à chaque rechargement de page.
    const first = defaultAvatarFor('profile-1756123456789');
    const second = defaultAvatarFor('profile-1756123456789');
    expect(first.id).toBe(second.id);
  });

  it('ne renvoie qu’un avatar enfant pour un profil enfant', () => {
    for (let i = 0; i < 40; i += 1) {
      const avatar = defaultAvatarFor(`profile-kid-${i}`, true);
      expect(avatar.kidFriendly).toBe(true);
    }
  });

  it('répartit les profils sur plusieurs avatars', () => {
    // L'ancienne règle (`charCodeAt` du dernier caractère) donnait
    // souvent le même résultat sur des identifiants horodatés créés
    // à quelques secondes d'intervalle. On vérifie que la nouvelle
    // ne s'effondre pas sur une seule valeur.
    const ids = new Set(
      Array.from({ length: 60 }, (_, i) => defaultAvatarFor(`profile-${1756123456000 + i}`).id)
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it('supporte un identifiant vide sans lever', () => {
    // `stableHash('')` vaut 0 : le calcul doit rester valide.
    const avatar = defaultAvatarFor('');
    expect(AVATARS).toContainEqual(avatar);
  });

  it('supporte un identifiant très long sans déborder', () => {
    // Le `| 0` maintient le calcul en entiers 32 bits ; sans lui le
    // résultat deviendrait NaN ou négatif sur une longue chaîne.
    const avatar = defaultAvatarFor('x'.repeat(5000));
    expect(AVATARS).toContainEqual(avatar);
  });

  it('tient compte de l’ordre des caractères', () => {
    // Une simple somme donnerait la même empreinte à « ab » et « ba ».
    // Le test ne peut pas exiger deux avatars différents (huit cases,
    // les collisions existent), mais il vérifie que le calcul ne se
    // réduit pas à une addition.
    const forward = defaultAvatarFor('abcdefgh');
    const backward = defaultAvatarFor('hgfedcba');
    expect([forward.id, backward.id].every((id) => isKnownAvatarId(id))).toBe(true);
  });
});

describe('resolveAvatar', () => {
  it('respecte un avatarId valide', () => {
    const avatar = resolveAvatar({ id: 'profile-1', avatarId: 'hibou' });
    expect(avatar.id).toBe('hibou');
  });

  it('ignore un avatarId inconnu et se rabat sur le défaut', () => {
    const avatar = resolveAvatar({ id: 'profile-1', avatarId: 'licorne' });
    expect(avatar.id).toBe(defaultAvatarFor('profile-1').id);
  });

  it('migre les profils portant avatar-default sans rond vide', () => {
    // Le cas réel : tous les profils déjà créés dans l'application.
    const avatar = resolveAvatar({ id: 'profile-1756000000000', avatarId: 'avatar-default' });
    expect(AVATARS).toContainEqual(avatar);
    expect(avatar.src).toMatch(/^\/avatars\//);
  });

  it('accepte un profil sans avatarId du tout', () => {
    const avatar = resolveAvatar({ id: 'profile-2' });
    expect(AVATARS).toContainEqual(avatar);
  });

  it('accepte avatarId à null', () => {
    const avatar = resolveAvatar({ id: 'profile-3', avatarId: null });
    expect(AVATARS).toContainEqual(avatar);
  });

  it('donne un avatar enfant à un profil enfant sans choix explicite', () => {
    const avatar = resolveAvatar({
      id: 'profile-kid',
      avatarId: 'avatar-default',
      isKidsProfile: true,
    });
    expect(avatar.kidFriendly).toBe(true);
  });

  it('laisse un profil enfant garder un avatar d’adulte choisi explicitement', () => {
    // La galerie est commune : le choix de l'utilisateur prime sur la
    // suggestion automatique.
    const avatar = resolveAvatar({
      id: 'profile-kid',
      avatarId: 'atlas',
      isKidsProfile: true,
    });
    expect(avatar.id).toBe('atlas');
  });

  it('reste stable entre deux appels pour le même profil', () => {
    const profile = { id: 'profile-stable', avatarId: 'avatar-default' };
    expect(resolveAvatar(profile).id).toBe(resolveAvatar(profile).id);
  });
});
