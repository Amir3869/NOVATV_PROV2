'use client';

/**
 * Appui long sur la touche OK d'une télécommande.
 *
 * Pourquoi ce hook existe
 * -----------------------
 * Dans les listes de chaînes, un clic lance la chaîne. La fiche détaillée
 * (programme en cours, grille des horaires) reste accessible par un
 * bouton « i ». Mais sur téléviseur ce bouton est un piège : à la
 * télécommande, le focus doit traverser chaque élément d'une vignette
 * pour atteindre la suivante. Vingt chaînes = quarante pressions de
 * flèche au lieu de vingt.
 *
 * La convention du monde TV est donc l'appui long : on maintient OK
 * pour obtenir les options, on appuie brièvement pour valider.
 *
 * Comment ça marche
 * -----------------
 * Le navigateur envoie `keydown` en RAFALE tant qu'une touche est
 * maintenue (répétition automatique du clavier). On ne peut donc pas
 * simplement compter les événements. On procède ainsi :
 *
 *   1. au tout premier `keydown` (ceux marqués `event.repeat` sont
 *      ignorés), on arme une minuterie de 500 ms ;
 *   2. si la minuterie arrive au bout, c'est un appui long : on navigue
 *      vers la fiche et on lève un drapeau ;
 *   3. au `keyup`, on désarme la minuterie. Si le drapeau est levé, on
 *      neutralise le clic que le navigateur s'apprête à émettre, sinon
 *      la fiche s'ouvrirait ET la chaîne se lancerait.
 *
 * Le hook renvoie des propriétés à étaler sur un élément (`{...longPress}`).
 * Quand `enabled` est faux — souris, tactile — il renvoie un objet vide :
 * aucun écouteur n'est posé, et le composant se comporte normalement.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/** Durée de maintien, en millisecondes, au-delà de laquelle l'appui est « long ». */
const LONG_PRESS_MS = 500;

/** Touches de validation d'une télécommande ou d'un clavier. */
const CONFIRM_KEYS = new Set(['Enter', ' ', 'Spacebar']);

export interface LongPressHandlers {
  onKeyDown?: (event: React.KeyboardEvent) => void;
  onKeyUp?: (event: React.KeyboardEvent) => void;
  onClick?: (event: React.MouseEvent) => void;
  onBlur?: () => void;
}

export function useLongPress(href: string, enabled: boolean): LongPressHandlers {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Une minuterie encore armée au démontage déclencherait une navigation
  // depuis un composant disparu.
  useEffect(() => clear, [clear]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!CONFIRM_KEYS.has(event.key)) return;
      // Rafale de répétition automatique : on ne réarme pas.
      if (event.repeat || timerRef.current) return;

      firedRef.current = false;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        router.push(href);
      }, LONG_PRESS_MS);
    },
    [router, href]
  );

  const onKeyUp = useCallback(
    (event: React.KeyboardEvent) => {
      if (!CONFIRM_KEYS.has(event.key)) return;
      clear();
    },
    [clear]
  );

  const onClick = useCallback((event: React.MouseEvent) => {
    // L'appui long a déjà navigué vers la fiche : on empêche le lien de
    // lancer la chaîne par-dessus.
    if (firedRef.current) {
      event.preventDefault();
      firedRef.current = false;
    }
  }, []);

  // Perdre le focus pendant le maintien annule l'appui long.
  const onBlur = useCallback(() => {
    clear();
    firedRef.current = false;
  }, [clear]);

  if (!enabled) return {};

  return { onKeyDown, onKeyUp, onClick, onBlur };
}
