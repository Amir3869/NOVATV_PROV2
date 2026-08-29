/**
 * Calculs de curseur (barre de progression, volume).
 *
 * Isole dans des fonctions pures tout ce qui touche a la conversion
 * entre une position de pointeur, un ratio et une valeur. Le composant
 * qui les utilise manipule des evenements DOM impossibles a tester dans
 * happy-dom (pas de mise en page, donc pas de `getBoundingClientRect`
 * credible) : la logique vit donc ici, ou elle se teste sans navigateur.
 */

/** Ramene un nombre entre 0 et 1. Protege aussi contre `NaN`. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Ratio occupe par un pointeur sur une piste horizontale.
 *
 * `width <= 0` renvoie 0 : cela arrive quand l'element n'est pas encore
 * mis en page, et diviser par zero donnerait `Infinity`, donc une barre
 * bloquee a 100 %.
 */
export function ratioFromPointer(clientX: number, left: number, width: number): number {
  if (width <= 0) return 0;
  return clamp01((clientX - left) / width);
}

/** Valeur absolue correspondant a un ratio, bornee par `max`. */
export function valueFromRatio(ratio: number, max: number): number {
  if (max <= 0) return 0;
  return clamp01(ratio) * max;
}

/**
 * Pourcentage de remplissage a afficher.
 *
 * Renvoie 0 quand `max` est inconnu plutot que `NaN`, qui produirait un
 * `width: NaN%` silencieusement ignore par le navigateur et donc une
 * barre qui ne bouge jamais.
 */
export function percentFromValue(value: number, max: number): number {
  if (max <= 0 || Number.isNaN(value) || Number.isNaN(max)) return 0;
  return clamp01(value / max) * 100;
}

/** Intention exprimee par une touche sur un curseur. */
export type SliderKeyIntent =
  | { kind: 'delta'; amount: number }
  | { kind: 'absolute'; ratio: number };

/**
 * Traduit une touche en deplacement de curseur.
 *
 * `null` signifie « touche non geree » : l'appelant doit alors laisser
 * l'evenement suivre son cours, sans quoi le curseur avalerait des
 * touches dont la page a besoin.
 *
 * Les fleches haut et bas sont volontairement absentes : dans le
 * lecteur elles reglent le volume, et les capturer ici priverait
 * l'utilisateur du reglage des qu'il poserait le focus sur la barre.
 */
export function sliderKeyIntent(key: string, step: number): SliderKeyIntent | null {
  switch (key) {
    case 'ArrowRight':
      return { kind: 'delta', amount: step };
    case 'ArrowLeft':
      return { kind: 'delta', amount: -step };
    case 'PageUp':
      return { kind: 'delta', amount: step * 5 };
    case 'PageDown':
      return { kind: 'delta', amount: -step * 5 };
    case 'Home':
      return { kind: 'absolute', ratio: 0 };
    case 'End':
      return { kind: 'absolute', ratio: 1 };
    default:
      return null;
  }
}

/**
 * Applique une intention a la valeur courante, en restant dans [0, max].
 */
export function applySliderIntent(
  intent: SliderKeyIntent,
  current: number,
  max: number
): number {
  if (max <= 0) return 0;
  const raw = intent.kind === 'delta' ? current + intent.amount : intent.ratio * max;
  if (raw < 0) return 0;
  if (raw > max) return max;
  return raw;
}
