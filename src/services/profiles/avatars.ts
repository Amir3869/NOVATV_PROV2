import type { AvatarId } from '@/types';

/**
 * Catalogue des avatars de profil.
 *
 * ─────────────────────────────────────────────────────────────
 * Pourquoi un fichier de service plutôt qu'une liste dans l'écran
 * ─────────────────────────────────────────────────────────────
 * Avant ce fichier, l'avatar d'un profil était dessiné à trois
 * endroits différents — l'écran « Qui regarde ? », le menu latéral et
 * la page des réglages — chacun avec ses propres règles de couleur.
 * Le même profil apparaissait vert ici et rouge là.
 *
 * La liste des avatars et la règle qui associe un profil à son image
 * vivent donc ici, une seule fois. Les écrans se contentent
 * d'afficher. Ajouter un neuvième avatar demain, ce sera une ligne
 * dans ce tableau et un fichier dans `public/avatars/`.
 *
 * ─────────────────────────────────────────────────────────────
 * Pourquoi des images plutôt que des dessins en code
 * ─────────────────────────────────────────────────────────────
 * Les huit fichiers sont livrés **avec** l'application, dans
 * `public/avatars/`. Ils ne sont pas téléchargés depuis un site
 * extérieur : un hébergeur qui tombe, et tous les profils afficheraient
 * un carré vide. Format WebP en 256 × 256, entre 2,8 et 5,3 Ko pièce,
 * 30 Ko pour les huit — moins qu'une seule affiche de film.
 *
 * 256 pixels est la plus grande taille réellement affichée (112 px sur
 * l'écran « Qui regarde ? », doublés pour les écrans à forte densité).
 * Fournir plus grand alourdirait l'APK sans rien améliorer à l'œil.
 */

/**
 * Un avatar disponible dans la galerie.
 */
export interface AvatarDefinition {
  /** Identifiant stable, écrit dans `Profile.avatarId`. Jamais affiché. */
  id: AvatarId;
  /** Adresse du fichier, servi tel quel depuis `public/`. */
  src: string;
  /**
   * Mis en avant pour les profils enfants.
   *
   * La galerie reste la même pour tout le monde — un adulte a le droit
   * de choisir le renard. Ce drapeau sert uniquement à proposer un
   * avatar plausible par défaut à un profil enfant.
   */
  kidFriendly: boolean;
}

/**
 * Les huit avatars, dans l'ordre d'affichage de la grille (4 × 2).
 *
 * Les identifiants ne sont **jamais** montrés à l'utilisateur : ce sont
 * des noms de fichiers. Ils n'ont donc pas à être traduits.
 */
export const AVATARS: readonly AvatarDefinition[] = [
  { id: 'nova', src: '/avatars/nova.webp', kidFriendly: false },
  { id: 'ember', src: '/avatars/ember.webp', kidFriendly: false },
  { id: 'luna', src: '/avatars/luna.webp', kidFriendly: false },
  { id: 'atlas', src: '/avatars/atlas.webp', kidFriendly: false },
  { id: 'minou', src: '/avatars/minou.webp', kidFriendly: true },
  { id: 'renard', src: '/avatars/renard.webp', kidFriendly: true },
  { id: 'robot', src: '/avatars/robot.webp', kidFriendly: true },
  { id: 'hibou', src: '/avatars/hibou.webp', kidFriendly: true },
] as const;

/**
 * Recherche directe par identifiant, construite une seule fois.
 *
 * Sur huit entrées, parcourir le tableau serait tout aussi rapide.
 * Mais `resolveAvatar` est appelé à chaque rendu de chaque carte de
 * profil, et la liste grandira ; autant poser tout de suite la forme
 * qui ne se dégrade pas.
 */
const BY_ID = new Map<string, AvatarDefinition>(AVATARS.map((a) => [a.id, a]));

/** Vrai si cet identifiant correspond à un avatar de la galerie. */
export function isKnownAvatarId(avatarId: string | null | undefined): boolean {
  return typeof avatarId === 'string' && BY_ID.has(avatarId);
}

/**
 * Empreinte numérique stable d'une chaîne de caractères.
 *
 * ── Pourquoi pas simplement le dernier caractère ──
 * L'ancien code faisait `id.charCodeAt(id.length - 1) % 6`. Or les
 * identifiants de profil se terminent tous par un horodatage
 * (`profile-1756...`) : le dernier caractère est un chiffre de 0 à 9,
 * et deux profils créés à quelques secondes d'intervalle tombaient
 * régulièrement sur la même couleur.
 *
 * On additionne donc tous les caractères, avec un décalage à chaque
 * tour pour que l'ordre compte — sans quoi « ab » et « ba » auraient
 * la même empreinte.
 *
 * Ce n'est **pas** une fonction de hachage cryptographique et elle ne
 * doit jamais servir à la sécurité : elle sert à répartir des avatars,
 * rien d'autre.
 */
function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    // `| 0` maintient le calcul dans les entiers 32 bits : sans lui le
    // nombre finirait par dépasser la précision de JavaScript et le
    // résultat deviendrait imprévisible sur les identifiants longs.
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Avatar attribué d'office à un profil qui n'en a pas choisi.
 *
 * ── Le problème que ça règle ──
 * Les profils créés avant cette fonctionnalité portent
 * `avatarId: 'avatar-default'`, une valeur à laquelle **aucun fichier
 * ne correspond**. Sans garde-fou, leur rond deviendrait vide au
 * prochain lancement — l'utilisateur croirait avoir perdu son profil.
 *
 * ── La règle ──
 * On dérive un avatar de l'identifiant du profil. Le résultat est
 * toujours le même pour un profil donné : l'avatar ne changera pas
 * d'un lancement à l'autre. L'utilisateur pourra en choisir un autre
 * dès que la fenêtre de modification existera.
 *
 * Un profil enfant reçoit un avatar de la sous-liste enfants ; c'est
 * plus cohérent qu'un visage d'adulte barbu sur le profil d'un enfant.
 */
export function defaultAvatarFor(profileId: string, isKidsProfile = false): AvatarDefinition {
  const pool = isKidsProfile ? AVATARS.filter((a) => a.kidFriendly) : AVATARS;
  // `pool` n'est jamais vide : quatre avatars portent `kidFriendly`.
  // Le repli protège malgré tout d'une modification maladroite du
  // tableau — mieux vaut un avatar inattendu qu'un écran blanc.
  const list = pool.length > 0 ? pool : AVATARS;
  return list[stableHash(profileId) % list.length];
}

/**
 * Avatar à afficher pour un profil.
 *
 * C'est le seul point d'entrée que les écrans doivent utiliser. Il
 * accepte tout, y compris `undefined` et les identifiants inconnus, et
 * renvoie toujours un avatar valide — jamais `null`, jamais un rond
 * vide.
 */
export function resolveAvatar(profile: {
  id: string;
  avatarId?: string | null;
  isKidsProfile?: boolean;
}): AvatarDefinition {
  const known = profile.avatarId ? BY_ID.get(profile.avatarId) : undefined;
  return known ?? defaultAvatarFor(profile.id, profile.isKidsProfile ?? false);
}

/**
 * Adresse du fichier d'un avatar, ou `null` si l'identifiant est
 * inconnu.
 *
 * Utile là où l'on ne dispose que d'un identifiant sans profil autour
 * — la grille de sélection, par exemple.
 */
export function avatarSrc(avatarId: string | null | undefined): string | null {
  const found = avatarId ? BY_ID.get(avatarId) : undefined;
  return found?.src ?? null;
}
