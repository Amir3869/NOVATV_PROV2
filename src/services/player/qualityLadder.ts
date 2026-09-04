/**
 * Choix de la qualité vidéo.
 *
 * Un flux HLS multi-débit publie plusieurs versions du même contenu :
 * une en 1024x576, une en 424x240, etc. hls.js appelle ces versions des
 * « niveaux » (levels) et sait passer de l'une à l'autre en cours de
 * lecture selon le débit mesuré.
 *
 * Ce fichier ne contient que des fonctions pures : elles reçoivent une
 * liste de niveaux et rendent un index. Aucune ne touche à hls.js, au
 * DOM ni au store. C'est ce qui les rend testables sans navigateur.
 *
 * Pourquoi une politique et pas une résolution
 * --------------------------------------------
 * Le réglage précédent proposait « 1080p / 720p / 480p ». Ces valeurs
 * étaient inventées : le flux de référence du projet publie du 576p et
 * du 240p, donc aucun des trois choix ne pouvait s'appliquer. Une
 * résolution fixe n'a de sens que rapportée à un flux précis, et les
 * variantes ne sont connues qu'une fois le manifeste chargé.
 *
 * Une POLITIQUE, elle, s'applique à n'importe quel flux : « la plus
 * basse », « la plus haute », « laisse le lecteur décider ». C'est ce
 * que retient le réglage global ; le choix d'une résolution précise
 * appartient au menu du lecteur, alimenté par le flux en cours.
 */

/**
 * Un niveau tel que nous en avons besoin.
 *
 * Volontairement plus étroit que le type de hls.js : ne dépendre que de
 * `height` et `bitrate` permet de tester sans installer la bibliothèque
 * et protège des changements de son interface.
 */
export interface QualityLevel {
  /** Hauteur en pixels. `0` ou absent quand le flux ne la déclare pas. */
  height?: number;
  /** Débit en bits par seconde. Sert de départage. */
  bitrate?: number;
}

/**
 * Politique de départ, choisie une fois pour toutes dans les réglages.
 *
 * - `auto` : démarre sur le plus haut, puis hls.js baisse si le
 *   réseau ne suit pas. Défaut retenu.
 * - `saver` : démarre (et reste) sur le niveau le plus bas.
 * - `best` : verrouille le niveau le plus haut, sans adaptation.
 */
export type QualityPolicy = 'auto' | 'saver' | 'best';

export const QUALITY_POLICIES = ['auto', 'saver', 'best'] as const;

/** Valeur `currentLevel` de hls.js signifiant « choisis pour moi ». */
export const AUTO_LEVEL = -1;

/**
 * Vrai si la valeur est une politique connue.
 *
 * Sert à la migration du stockage : une valeur venue du disque n'est
 * jamais digne de confiance.
 */
export function isQualityPolicy(value: unknown): value is QualityPolicy {
  return typeof value === 'string' && (QUALITY_POLICIES as readonly string[]).includes(value);
}

/**
 * Ordonne les niveaux du plus haut au plus bas.
 *
 * hls.js les livre en principe du plus bas au plus haut, mais rien ne
 * l'impose et certains encodeurs les déclarent dans le désordre. On
 * range nous-mêmes plutôt que de supposer.
 *
 * Le tri porte d'abord sur la hauteur, puis sur le débit : deux
 * variantes peuvent partager la même résolution et ne différer que par
 * la quantité de données, cas courant sur les flux de sport.
 *
 * Rend des INDEX dans le tableau d'origine, jamais des copies : hls.js
 * ne comprend que la position d'un niveau dans sa propre liste.
 */
export function sortLevelsDescending(levels: readonly QualityLevel[]): number[] {
  return levels
    .map((level, index) => ({ level, index }))
    .sort((a, b) => {
      const heightGap = (b.level.height ?? 0) - (a.level.height ?? 0);
      if (heightGap !== 0) return heightGap;
      return (b.level.bitrate ?? 0) - (a.level.bitrate ?? 0);
    })
    .map((entry) => entry.index);
}

/**
 * Applique la politique de départ.
 *
 * Rend l'index à poser sur `hls.currentLevel`, ou `AUTO_LEVEL` pour
 * laisser hls.js décider.
 *
 * Une liste vide ou d'un seul élément rend toujours `AUTO_LEVEL` : sans
 * choix réel, forcer un niveau n'apporte rien et prive le lecteur de sa
 * capacité d'adaptation.
 */
export function levelForPolicy(
  levels: readonly QualityLevel[],
  policy: QualityPolicy
): number {
  if (policy === 'auto' || levels.length < 2) return AUTO_LEVEL;

  const ordered = sortLevelsDescending(levels);
  return policy === 'best' ? ordered[0] : ordered[ordered.length - 1];
}

/**
 * Niveau de DÉMARRAGE pour la politique `auto`.
 *
 * `levelForPolicy(..., 'auto')` rend `AUTO_LEVEL` : hls.js reste en
 * adaptation. Sans `startLevel`, il commence souvent trop bas. On lui
 * donne ici le plus haut : la première image est nette, et l'ABR
 * redescend si le réseau ne suit pas.
 *
 * Rend `AUTO_LEVEL` s'il n'y a rien à choisir.
 */
export function startLevelForAuto(levels: readonly QualityLevel[]): number {
  if (levels.length < 2) return AUTO_LEVEL;
  return sortLevelsDescending(levels)[0];
}

/**
 * Retrouve le niveau le plus proche d'une hauteur mémorisée.
 *
 * Sert au report d'un choix d'une chaîne à l'autre. L'utilisateur a
 * forcé 576p sur une chaîne ; la suivante propose 1080p, 720p et 360p.
 * Le 576p n'existe pas ici, il faut décider quoi lui donner.
 *
 * Règle retenue : le plus proche PAR LE DESSOUS, c'est-à-dire le plus
 * grand niveau qui ne dépasse pas la hauteur demandée — ici 360p. Un
 * choix par le dessus donnerait 720p et pourrait saturer une connexion
 * que l'utilisateur avait justement voulu ménager. Respecter son
 * intention prime sur la qualité d'image.
 *
 * Quand tous les niveaux dépassent la hauteur demandée, on rend le plus
 * bas : c'est le plus proche de son intention, faute de mieux.
 *
 * Rend `AUTO_LEVEL` si la liste est vide ou si aucune hauteur n'est
 * déclarée — impossible de comparer sans repère.
 */
export function levelClosestToHeight(
  levels: readonly QualityLevel[],
  targetHeight: number
): number {
  if (levels.length === 0 || targetHeight <= 0) return AUTO_LEVEL;

  const ordered = sortLevelsDescending(levels).filter(
    (index) => (levels[index].height ?? 0) > 0
  );
  if (ordered.length === 0) return AUTO_LEVEL;

  // `ordered` va du plus haut au plus bas : le premier qui ne dépasse
  // pas la cible est le plus proche par le dessous.
  const atOrBelow = ordered.find((index) => (levels[index].height ?? 0) <= targetHeight);
  return atOrBelow ?? ordered[ordered.length - 1];
}

/**
 * Libellé d'un niveau pour le menu.
 *
 * Convention retenue avec l'utilisateur : la hauteur seule, « 576p ».
 * Courte, universellement comprise, lisible à trois mètres sur un
 * téléviseur — critère qui a écarté l'ajout du débit.
 *
 * Repli sur le débit quand la hauteur manque : certains flux audio ou
 * mal encodés ne déclarent aucune résolution. « 2,3 Mb/s » reste plus
 * parlant que « Niveau 2 ».
 */
export function qualityLabel(level: QualityLevel, index: number): string {
  const height = level.height ?? 0;
  if (height > 0) return `${height}p`;

  const bitrate = level.bitrate ?? 0;
  if (bitrate > 0) return `${(bitrate / 1_000_000).toFixed(1).replace('.', ',')} Mb/s`;

  // Dernier recours : la position. Numérotée à partir de 1, l'index
  // technique n'ayant aucun sens pour l'utilisateur.
  return `#${index + 1}`;
}
