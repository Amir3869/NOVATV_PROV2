'use client';

import { useEffect } from 'react';

/**
 * Fait suivre le défilement quand un élément reçoit le focus.
 *
 * Pourquoi c'est nécessaire
 * -------------------------
 * Les rangées de vignettes sont des conteneurs `overflow-x-auto` : elles
 * défilent horizontalement. À la souris on fait glisser, au doigt on balaie —
 * mais à la télécommande on se déplace de vignette en vignette avec les
 * flèches. Arrivé à la 8e carte d'une rangée qui n'en montre que 6, la carte
 * sélectionnée se trouve hors de l'écran : elle a bien le focus, l'appui sur
 * Entrée fonctionne, mais l'utilisateur ne voit rien bouger. L'application
 * paraît bloquée.
 *
 * Les navigateurs font en principe défiler l'élément focalisé jusqu'à le
 * rendre visible, mais le résultat est irrégulier dès qu'on empile plusieurs
 * conteneurs défilants (ici : la page à la verticale, chaque rangée à
 * l'horizontale) et que des marges négatives `-mx-4 px-4` décalent les bords.
 * On reprend donc la main explicitement.
 *
 * Comment
 * -------
 * Un seul écouteur posé sur le `document`, en phase de capture, réagit à
 * `focusin` — l'événement de prise de focus, qui remonte l'arbre (contrairement
 * à `focus`). `scrollIntoView` avec `nearest` déplace du minimum nécessaire :
 * si l'élément est déjà visible, rien ne se passe. C'est ce qui rend l'appel
 * sans danger sur la souris et le tactile, où il ne se déclenche jamais à tort.
 *
 * Un seul écouteur global couvre les 14 rangées de l'application, et couvrira
 * les suivantes sans qu'on ait à y penser.
 */
/**
 * Décide s'il faut faire défiler jusqu'à la cible d'un `focusin`, et le fait.
 *
 * Extraite du hook pour être testable directement : un test peut appeler
 * cette fonction avec un faux événement, là où il faudrait tout un rendu
 * React pour éprouver le hook.
 */
export function scrollFocusIntoView(
  target: EventTarget | null,
  reducedMotion: boolean
): boolean {
  if (!(target instanceof HTMLElement)) return false;

  // Le focus déclenché à la souris ou au doigt n'a pas besoin d'aide :
  // l'utilisateur vise directement ce qu'il voit. `:focus-visible` ne
  // s'active qu'au clavier et à la télécommande.
  //
  // Ce pseudo-sélecteur n'est pas reconnu par tous les moteurs de rendu ;
  // `matches` lève alors une exception. Dans ce cas on fait défiler, quitte
  // à le faire un peu trop : ne rien faire rendrait l'application
  // inutilisable à la télécommande, ce qui est bien plus grave.
  try {
    if (!target.matches(':focus-visible')) return false;
  } catch {
    // moteur sans `:focus-visible` — on continue
  }

  // Le lien d'évitement cible <main tabIndex={-1}> pour y poser le focus.
  // Le faire défiler remonterait la page de force à chaque navigation.
  if (target.tagName === 'MAIN') return false;

  target.scrollIntoView({
    behavior: reducedMotion ? 'auto' : 'smooth',
    block: 'nearest',
    inline: 'nearest',
  });
  return true;
}

export function useFocusScroll(): void {
  useEffect(() => {
    function handleFocusIn(event: FocusEvent): void {
      // L'état est relu à chaque focus, et non une fois pour toutes : le
      // réglage peut changer pendant que l'application tourne, et une
      // valeur capturée au montage resterait périmée.
      //
      // La source de vérité est l'attribut `data-motion` posé sur <html>
      // par `useAnimations`, car lui seul tient compte des trois
      // niveaux : choix de l'utilisateur, réglage système, appareil.
      // Lire directement `prefers-reduced-motion` ici ferait défiler en
      // douceur alors que l'utilisateur a coupé les animations.
      const reducedMotion =
        document.documentElement.getAttribute('data-motion') === 'off';

      scrollFocusIntoView(event.target, reducedMotion);
    }

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);
}
