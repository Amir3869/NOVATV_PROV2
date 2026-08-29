/**
 * Ajustement de l'image dans le cadre du lecteur.
 *
 * ─── Le problème ───────────────────────────────────────────────────
 *
 * Un flux n'a pas forcément les proportions de l'écran. Une chaîne
 * d'archives diffuse souvent en 4:3 sur un téléviseur 16:9 : deux
 * bandes noires apparaissent sur les côtés. Un film en 2.39:1 sur le
 * même écran donne des bandes en haut et en bas.
 *
 * Certaines chaînes vont plus loin : elles diffusent une image 4:3
 * déjà entourée de noir *à l'intérieur* d'un flux 16:9. L'image utile
 * se retrouve alors dans une petite fenêtre au centre de l'écran.
 * Aucun réglage du téléviseur ne peut rattraper ça, car pour lui le
 * flux occupe bien tout l'écran : le noir fait partie de l'image.
 *
 * ─── La réponse ────────────────────────────────────────────────────
 *
 * Trois modes, correspondant chacun à une valeur de la propriété CSS
 * `object-fit` appliquée à la balise vidéo. C'est le navigateur qui
 * fait le travail, sur la surface d'affichage : aucun re-décodage,
 * aucun coût processeur. Le point est important sur un Firestick, dont
 * le processeur est déjà occupé à décoder le flux.
 *
 *   `contain` — Ajusté (défaut). L'image entière est visible, ses
 *               proportions sont respectées. Des bandes noires
 *               apparaissent si le flux et l'écran diffèrent.
 *
 *   `cover`   — Remplir. L'image est agrandie jusqu'à couvrir tout
 *               l'écran ; ce qui dépasse est rogné. Les proportions
 *               restent justes, mais on perd les bords. C'est le mode
 *               qui fait disparaître les bandes noires.
 *
 *   `fill`    — Étirer. L'image est déformée pour occuper exactement
 *               l'écran. Rien n'est perdu, rien n'est ajouté, mais les
 *               visages s'élargissent ou s'allongent.
 *
 * ─── Ce que ce module ne fait pas ──────────────────────────────────
 *
 * Ni luminosité, ni contraste, ni saturation : ces réglages existent
 * déjà sur le téléviseur, et les refaire en CSS (`filter`) forcerait
 * une recomposition de chaque image par le processeur graphique — sur
 * un Firestick, cela coûte des images par seconde.
 *
 * Il n'y a pas non plus de zoom libre ni de recadrage manuel. Trois
 * modes se parcourent à la télécommande ; un curseur de zoom, non.
 */

/** Mode d'ajustement de l'image. Reprend les valeurs CSS `object-fit`. */
export type VideoFitMode = 'contain' | 'cover' | 'fill';

/**
 * Ordre d'affichage dans le menu.
 *
 * `contain` en tête : c'est le défaut, le choix correct dans la
 * grande majorité des cas, et il doit être atteignable en un cran de
 * télécommande. Même principe que « Automatique » pour la qualité.
 */
export const VIDEO_FIT_MODES: readonly VideoFitMode[] = ['contain', 'cover', 'fill'];

/** Mode appliqué tant que rien n'a été choisi. */
export const DEFAULT_VIDEO_FIT: VideoFitMode = 'contain';

/**
 * Classes Tailwind associées à chaque mode.
 *
 * Les noms de classes sont écrits en toutes lettres, jamais construits
 * par concaténation : Tailwind analyse les fichiers source à la
 * recherche de chaînes littérales. Une classe assemblée à l'exécution
 * (`'object-' + mode`) n'apparaîtrait nulle part dans le source et ne
 * serait donc pas générée dans la feuille de style finale.
 */
const FIT_CLASS: Record<VideoFitMode, string> = {
  contain: 'object-contain',
  cover: 'object-cover',
  fill: 'object-fill',
};

/** Classe Tailwind à poser sur la balise vidéo pour un mode donné. */
export function videoFitClassName(mode: VideoFitMode): string {
  return FIT_CLASS[mode] ?? FIT_CLASS[DEFAULT_VIDEO_FIT];
}

/**
 * Garde de type : la valeur est-elle un mode connu ?
 *
 * Sert à la migration du store. Les préférences enregistrées dans le
 * navigateur viennent d'une version antérieure de l'application et
 * peuvent contenir n'importe quoi — y compris une valeur écrite à la
 * main dans la console par un utilisateur curieux.
 */
export function isVideoFitMode(value: unknown): value is VideoFitMode {
  return (
    typeof value === 'string' &&
    (VIDEO_FIT_MODES as readonly string[]).includes(value)
  );
}

/**
 * Mode suivant dans le cycle, en revenant au début après le dernier.
 *
 * Permet de proposer plus tard un basculement en une seule touche,
 * sans rouvrir le menu. Non branché sur une touche pour l'instant :
 * le lecteur intercepte déjà quatorze touches et aucune n'est libre de
 * façon évidente sur une télécommande de Firestick.
 */
export function nextVideoFit(mode: VideoFitMode): VideoFitMode {
  const index = VIDEO_FIT_MODES.indexOf(mode);
  // Un mode inconnu ramène au premier plutôt que de renvoyer
  // `undefined` : `indexOf` vaut alors -1, et -1 + 1 = 0.
  return VIDEO_FIT_MODES[(index + 1) % VIDEO_FIT_MODES.length];
}
