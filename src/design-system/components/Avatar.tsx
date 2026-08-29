'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { resolveAvatar } from '@/services/profiles/avatars';

/**
 * Avatar rond d'un profil.
 *
 * ─────────────────────────────────────────────────────────────
 * Pourquoi ce composant existe
 * ─────────────────────────────────────────────────────────────
 * L'avatar était dessiné à trois endroits — l'écran « Qui regarde ? »,
 * le menu latéral et la page des réglages — chacun avec son propre
 * bout de code. Les couleurs divergeaient : le même profil s'affichait
 * vert sur un écran et rouge sur l'autre. Ce composant est désormais
 * le seul à savoir à quoi ressemble un avatar.
 *
 * ─────────────────────────────────────────────────────────────
 * Pourquoi un repli alors que les images sont livrées avec l'appli
 * ─────────────────────────────────────────────────────────────
 * Les huit fichiers sont dans `public/avatars/`, donc ils ne peuvent
 * pas « tomber » comme un logo de chaîne distant. Mais ils peuvent
 * manquer : un collage incomplet, un fichier oublié au moment d'une
 * mise à jour, un cache corrompu sur l'appareil. Dans ce cas on
 * revient à l'initiale du prénom sur fond rouge — la présentation
 * d'avant, qui reste correcte — plutôt qu'à l'icône d'image cassée du
 * navigateur.
 *
 * On ne réutilise pas `ImageWithFallback` ici : ce composant traite
 * des logos distants dont l'adresse change en cours de défilement,
 * avec la mécanique de réessai que ça impose. Un avatar a une adresse
 * fixe issue d'un catalogue de huit entrées ; la logique serait
 * surdimensionnée.
 */

/**
 * Ce dont l'avatar a besoin. Volontairement plus large que `Profile` :
 * la grille de sélection travaille sur des profils en cours de
 * création, qui n'existent pas encore dans le magasin.
 */
export interface AvatarProfileLike {
  id: string;
  name: string;
  avatarId?: string | null;
  isKidsProfile?: boolean;
}

/**
 * Tailles nommées plutôt qu'un nombre de pixels.
 *
 * Chaque valeur correspond à un emplacement réel de l'application.
 * Passer par des noms empêche l'apparition d'un `w-[73px]` isolé
 * quelque part, et garde les tailles cohérentes d'un écran à l'autre.
 */
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'w-8 h-8 text-xs', //  32 px — ligne des réglages
  sm: 'w-[34px] h-[34px] text-xs', //  34 px — menu latéral
  md: 'w-14 h-14 text-lg', //  56 px — grille de sélection
  lg: 'w-20 h-20 text-2xl', //  80 px — carte de profil
  xl: 'w-28 h-28 text-4xl', // 112 px — écran « Qui regarde ? »
};

interface AvatarProps {
  profile: AvatarProfileLike;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ profile, size = 'lg', className }: AvatarProps) {
  const definition = resolveAvatar(profile);

  // On mémorise l'adresse fautive, pas un simple booléen. Si le profil
  // change d'avatar, l'échec enregistré ne correspond plus et l'image
  // retente sa chance — sans `useEffect`, donc sans second rendu.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === definition.src;

  const shape = cn(
    'rounded-full flex-shrink-0 object-cover',
    SIZE_CLASS[size],
    className
  );

  if (failed) {
    return (
      <div
        className={cn(
          shape,
          'bg-gradient-to-br from-accent to-[#8B0000]',
          'flex items-center justify-center font-black text-white'
        )}
      >
        {profile.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={definition.src}
      // Vide et masqué aux lecteurs d'écran : l'avatar n'apporte
      // aucune information que le nom du profil, toujours affiché ou
      // annoncé à côté, ne donne déjà. Le décrire ferait entendre
      // « image renard, Lina » — du bruit.
      alt=""
      aria-hidden="true"
      width={256}
      height={256}
      // `loading="eager"` : ces images pèsent 3 Ko et sont visibles
      // immédiatement. Les différer ferait clignoter l'écran d'accueil.
      loading="eager"
      draggable={false}
      onError={() => setFailedSrc(definition.src)}
      className={shape}
    />
  );
}
