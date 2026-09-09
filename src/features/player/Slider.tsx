'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import {
  ratioFromPointer,
  valueFromRatio,
  percentFromValue,
  sliderKeyIntent,
  applySliderIntent,
} from '@/services/player/sliderMath';

interface SliderProps {
  /** Valeur courante, dans la meme unite que `max`. */
  value: number;
  /** Borne haute. Un `max` a zero desactive le curseur. */
  max: number;
  /** Appele pendant le glissement, a chaque mouvement. */
  onPreview?: (value: number) => void;
  /** Appele au relachement, ou a chaque appui clavier. */
  onCommit: (value: number) => void;
  /** Pas d'un appui sur une fleche. */
  step: number;
  /** Lu par les lecteurs d'ecran. */
  label: string;
  /** Texte enonce a la place du nombre brut (ex. « 2 minutes 30 »). */
  valueText?: string;
  /** Epaisseur de la piste. Le volume est plus fin que la progression. */
  className?: string;
  /** Grise et rend non focusable. */
  disabled?: boolean;
  /**
   * Progression video : piste plus haute et pastille toujours visible,
   * pour un doigt sur telephone. Le volume reste plus fin.
   */
  thick?: boolean;
}

/**
 * Curseur horizontal utilisable a la souris, au doigt et a la
 * telecommande.
 *
 * Un seul composant sert a la progression video et au volume : les deux
 * repondent au meme besoin (choisir une valeur entre zero et un
 * maximum), et les dupliquer garantirait qu'ils divergent.
 *
 * Trois choix structurants :
 *
 * 1. **Evenements « pointer » et non « mouse »/« touch ».** Le navigateur
 *    unifie souris, doigt et stylet derriere une seule famille
 *    d'evenements. Ecouter les deux anciennes familles ferait declencher
 *    l'action deux fois sur les ecrans tactiles.
 *
 * 2. **Capture du pointeur.** `setPointerCapture` redirige tous les
 *    mouvements vers cet element, meme quand le doigt sort de la barre.
 *    Sans lui, glisser trop haut abandonnerait le curseur en route.
 *
 * 3. **`role="slider"` et non `progressbar`.** Une barre de progression
 *    s'annonce comme non modifiable ; un lecteur d'ecran ne proposerait
 *    donc jamais de la deplacer.
 */
export function Slider({
  value,
  max,
  onPreview,
  onCommit,
  step,
  label,
  valueText,
  className,
  disabled = false,
  thick = false,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);

  // Pendant le glissement, la barre suit le doigt et non la video :
  // sans cela, chaque image decodee ramenerait le curseur en arriere.
  const shown = dragValue ?? value;
  const percent = percentFromValue(shown, max);
  const usable = !disabled && max > 0;

  const valueAt = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const bounds = track.getBoundingClientRect();
    return valueFromRatio(ratioFromPointer(clientX, bounds.left, bounds.width), max);
  }, [max]);

  /*
    Capture et relachement du pointeur.

    Ces deux appels echouent en levant une exception si le navigateur a
    deja relache la capture de son cote : souris sortie de la fenetre,
    doigt leve hors de l'ecran, onglet masque en plein glissement. Le
    navigateur nettoie alors tout seul, et notre appel arrive apres la
    bataille.

    L'exception interromprait le gestionnaire AVANT `setDragValue(null)`
    : le curseur resterait bloque en mode glissement, insensible aux
    clics suivants. On ignore donc l'echec, qui signifie simplement
    << c'etait deja fait >>.
  */
  const capturePointer = (el: HTMLElement, pointerId: number) => {
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // Capture refusee : le glissement fonctionne quand meme, il
      // s'arretera seulement si le pointeur quitte la barre.
    }
  };

  const releasePointer = (el: HTMLElement, pointerId: number) => {
    try {
      // Certains navigateurs emettent pointerup apres avoir deja annule
      // la capture (notamment lors d'un geste tactile interrompu).
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
    } catch {
      // Deja relachee par le navigateur : rien a faire.
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!usable) return;
    // Empeche le navigateur de demarrer une selection de texte ou un
    // defilement, qui volerait les mouvements suivants.
    event.preventDefault();
    capturePointer(event.currentTarget, event.pointerId);
    const next = valueAt(event.clientX);
    setDragValue(next);
    onPreview?.(next);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragValue === null) return;
    const next = valueAt(event.clientX);
    setDragValue(next);
    onPreview?.(next);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragValue === null) return;
    releasePointer(event.currentTarget, event.pointerId);
    onCommit(dragValue);
    setDragValue(null);
  };

  /*
    Filet de securite : `pointercancel`.

    Le navigateur emet cet evenement quand il reprend la main de force
    - appel entrant, geste systeme, doigt sorti de la dalle. Sans lui,
    `pointerup` n'arrive jamais et `dragValue` reste fige : la barre
    semble collee au dernier point touche.

    On valide la derniere valeur connue plutot que de l'abandonner :
    l'utilisateur a bouge le curseur, ignorer son geste serait plus
    surprenant que de le prendre en compte.
  */
  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragValue === null) return;
    releasePointer(event.currentTarget, event.pointerId);
    onCommit(dragValue);
    setDragValue(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!usable) return;
    const intent = sliderKeyIntent(event.key, step);
    if (!intent) return; // Laisse passer les autres touches.
    event.preventDefault();
    // `stopPropagation` : le lecteur ecoute les memes fleches au niveau
    // du document pour avancer de dix secondes. Sans cela un appui
    // compterait deux fois.
    event.stopPropagation();
    onCommit(applySliderIntent(intent, value, max));
  };

  // Un glissement interrompu par la perte de la page (onglet cache,
  // application mise en arriere-plan sur Fire OS) laisserait le curseur
  // colle au doigt pour toujours.
  useEffect(() => {
    if (dragValue === null) return;
    const cancel = () => setDragValue(null);
    window.addEventListener('pointercancel', cancel);
    return () => window.removeEventListener('pointercancel', cancel);
  }, [dragValue]);

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={usable ? 0 : -1}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={valueText}
      aria-disabled={!usable}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative rounded-full bg-white/20 group touch-none',
        // Zone de saisie verticale elargie : viser une barre de 4 px au
        // doigt est impossible, alors que la zone sensible peut etre
        // plus haute que le trait visible.
        thick ? 'py-3.5 -my-3.5 cursor-pointer' : 'py-2.5 -my-2.5 cursor-pointer',
        // Focus vu a trois metres, regle du projet.
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        !usable && 'opacity-40 cursor-default',
        className
      )}
    >
      <div className={cn('rounded-full bg-white/20 overflow-hidden', thick ? 'h-2' : 'h-1.5')}>
        <div className="h-full bg-accent rounded-full" style={{ width: `${percent}%` }} />
      </div>
      {/* Pastille : toujours visible pendant le glissement et au focus,
          sinon elle disparaitrait sous le doigt au moment ou elle sert.
          En mode epais (progression), elle reste affichee : un pouce
          a besoin d'un point d'appui, pas seulement d'un trait. */}
      <div
        className={cn(
          'absolute top-1/2 rounded-full bg-accent shadow-md pointer-events-none transition-opacity',
          thick ? 'w-5 h-5' : 'w-3.5 h-3.5',
          dragValue !== null || thick
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
        )}
        style={{ left: `${percent}%`, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
}
