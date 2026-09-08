'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Image distante qui cède la place à un repli quand elle échoue.
 *
 * ── Le problème ──
 * Les listes M3U publiques pointent vers des logos hébergés un peu
 * partout : `i0.wp.com`, `pbs.twimg.com`, le site du diffuseur… Ces
 * adresses meurent avec le temps, bien plus vite que les flux. Une
 * liste de quelques centaines de chaînes en compte toujours une part
 * dont le logo répond 404.
 *
 * Sans garde-fou, le navigateur affiche l'icône d'image cassée et
 * remplit la console d'erreurs rouges. Ce n'est pas une panne — la
 * chaîne se lit très bien — mais ça donne l'impression que l'appli est
 * défaillante, et ça noie les vraies erreurs dans le bruit.
 *
 * ── La solution ──
 * On écoute `onError`, l'événement émis par la balise quand le
 * téléchargement échoue, et on bascule sur un repli fourni par
 * l'appelant : une initiale, une icône. Le motif existait déjà en
 * plusieurs exemplaires dans le projet ; ce composant l'unifie pour
 * que les endroits oubliés cessent de se multiplier.
 *
 * ── Le piège de la liste virtualisée ──
 * React réutilise les composants au lieu de les recréer quand on fait
 * défiler une longue liste. Une carte dont le logo a échoué garderait
 * son repli en changeant de chaîne, alors que la nouvelle a peut-être
 * un logo valide.
 *
 * On ne corrige pas ça avec un `useEffect` qui remettrait l'état à
 * zéro : écrire dans l'état depuis un effet déclenche un second rendu
 * en cascade, et la règle `react-hooks/set-state-in-effect` l'interdit
 * dans ce projet. On mémorise plutôt *quelle* adresse a échoué. La
 * comparaison se fait alors pendant le rendu : dès que `src` change,
 * l'échec enregistré ne correspond plus et l'image retente sa chance,
 * sans rendu supplémentaire.
 */
interface ImageWithFallbackProps {
  /** Adresse du logo. `null` ou vide affiche directement le repli. */
  src: string | null | undefined;
  /** Texte alternatif, lu par les lecteurs d'écran. */
  alt: string;
  /** Classes appliquées à la balise image. */
  className?: string;
  /**
   * Ce qu'on montre à la place quand l'image manque ou échoue.
   * L'appelant décide : une icône sur une carte de chaîne, une
   * initiale sur une affiche de film.
   */
  fallback: ReactNode;
  /**
   * Classes du conteneur du repli. Sans repli visuel imposé, chaque
   * emplacement garde ses propres dimensions.
   */
  fallbackClassName?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className,
  fallback,
  fallbackClassName,
}: ImageWithFallbackProps) {
  // On retient l'adresse fautive, pas un simple booléen : c'est ce qui
  // permet de savoir, sans effet, si l'échec concerne l'image courante.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc !== null && failedSrc === src;

  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center', fallbackClassName)}>
        {fallback}
      </div>
    );
  }

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}
