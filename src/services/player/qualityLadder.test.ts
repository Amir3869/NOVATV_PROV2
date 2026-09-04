import { describe, it, expect } from 'vitest';
import {
  AUTO_LEVEL,
  isQualityPolicy,
  levelClosestToHeight,
  levelForPolicy,
  qualityLabel,
  sortLevelsDescending,
  startLevelForAuto,
  type QualityLevel,
} from './qualityLadder';

/**
 * Les deux variantes réelles du flux de référence du projet
 * (4TV News, premier flux jamais décodé sur ce lecteur).
 * Déclarées dans l'ordre du manifeste : la plus haute en premier.
 */
const REAL_STREAM: QualityLevel[] = [
  { height: 576, bitrate: 2_340_800 },
  { height: 240, bitrate: 690_800 },
];

describe('isQualityPolicy', () => {
  it('accepte les trois politiques', () => {
    expect(isQualityPolicy('auto')).toBe(true);
    expect(isQualityPolicy('saver')).toBe(true);
    expect(isQualityPolicy('best')).toBe(true);
  });

  it('refuse les anciennes valeurs du stockage v7', () => {
    // Ce sont exactement les valeurs que la migration doit convertir.
    expect(isQualityPolicy('1080p')).toBe(false);
    expect(isQualityPolicy('720p')).toBe(false);
    expect(isQualityPolicy('480p')).toBe(false);
  });

  it('refuse ce qui ne vient pas du bon type', () => {
    expect(isQualityPolicy(undefined)).toBe(false);
    expect(isQualityPolicy(null)).toBe(false);
    expect(isQualityPolicy(3)).toBe(false);
    expect(isQualityPolicy({})).toBe(false);
    expect(isQualityPolicy('')).toBe(false);
  });
});

describe('sortLevelsDescending', () => {
  it('range du plus haut au plus bas', () => {
    const levels: QualityLevel[] = [
      { height: 240 },
      { height: 1080 },
      { height: 576 },
    ];
    expect(sortLevelsDescending(levels)).toEqual([1, 2, 0]);
  });

  it('rend des index du tableau d origine, pas des rangs', () => {
    // hls.js ne comprend que la position dans SA liste : si le tri
    // rendait des rangs, on sélectionnerait le mauvais niveau.
    const levels: QualityLevel[] = [{ height: 360 }, { height: 720 }];
    const ordered = sortLevelsDescending(levels);
    expect(levels[ordered[0]].height).toBe(720);
    expect(levels[ordered[1]].height).toBe(360);
  });

  it('departage deux memes hauteurs par le debit', () => {
    const levels: QualityLevel[] = [
      { height: 720, bitrate: 1_500_000 },
      { height: 720, bitrate: 3_000_000 },
    ];
    expect(sortLevelsDescending(levels)).toEqual([1, 0]);
  });

  it('traite une hauteur absente comme zero', () => {
    const levels: QualityLevel[] = [{ bitrate: 800_000 }, { height: 480 }];
    expect(sortLevelsDescending(levels)).toEqual([1, 0]);
  });

  it('ne modifie pas le tableau recu', () => {
    const levels: QualityLevel[] = [{ height: 240 }, { height: 1080 }];
    sortLevelsDescending(levels);
    expect(levels[0].height).toBe(240);
  });

  it('rend un tableau vide pour une liste vide', () => {
    expect(sortLevelsDescending([])).toEqual([]);
  });
});

describe('levelForPolicy', () => {
  it('auto laisse toujours hls.js decider', () => {
    expect(levelForPolicy(REAL_STREAM, 'auto')).toBe(AUTO_LEVEL);
  });

  it('best prend le niveau le plus haut du flux reel', () => {
    // Index 0 = 576p, la plus haute des deux variantes de 4TV News.
    expect(levelForPolicy(REAL_STREAM, 'best')).toBe(0);
  });

  it('saver prend le niveau le plus bas du flux reel', () => {
    expect(levelForPolicy(REAL_STREAM, 'saver')).toBe(1);
  });

  it('best trouve le plus haut meme declare en dernier', () => {
    const levels: QualityLevel[] = [{ height: 240 }, { height: 1080 }];
    expect(levelForPolicy(levels, 'best')).toBe(1);
  });

  it('rend auto quand il n y a qu un seul niveau', () => {
    // Forcer l unique niveau ne changerait rien et priverait le
    // lecteur de son adaptation.
    expect(levelForPolicy([{ height: 720 }], 'best')).toBe(AUTO_LEVEL);
    expect(levelForPolicy([{ height: 720 }], 'saver')).toBe(AUTO_LEVEL);
  });

  it('rend auto pour une liste vide', () => {
    expect(levelForPolicy([], 'best')).toBe(AUTO_LEVEL);
  });
});

describe('startLevelForAuto', () => {
  it('prend le plus haut du flux reel, sans verrouiller', () => {
    expect(startLevelForAuto(REAL_STREAM)).toBe(0);
  });

  it('trouve le plus haut meme declare en dernier', () => {
    expect(startLevelForAuto([{ height: 240 }, { height: 1080 }])).toBe(1);
  });

  it('rend auto s il n y a rien a choisir', () => {
    expect(startLevelForAuto([{ height: 720 }])).toBe(AUTO_LEVEL);
    expect(startLevelForAuto([])).toBe(AUTO_LEVEL);
  });
});

describe('levelClosestToHeight', () => {
  const LADDER: QualityLevel[] = [
    { height: 1080 },
    { height: 720 },
    { height: 360 },
  ];

  it('retrouve une hauteur presente a l identique', () => {
    expect(levelClosestToHeight(LADDER, 720)).toBe(1);
  });

  it('choisit par le dessous quand la hauteur exacte manque', () => {
    // 576 demande, echelle 1080/720/360 : on donne 360, pas 720.
    // Monter trahirait l intention d economiser de la bande passante.
    expect(levelClosestToHeight(LADDER, 576)).toBe(2);
  });

  it('rend le plus bas quand tous les niveaux depassent la cible', () => {
    expect(levelClosestToHeight(LADDER, 240)).toBe(2);
  });

  it('rend le plus haut quand la cible depasse tous les niveaux', () => {
    expect(levelClosestToHeight(LADDER, 2160)).toBe(0);
  });

  it('reporte un choix du flux reel vers une autre echelle', () => {
    // Scenario utilisateur : 576p force sur 4TV News, puis zapping.
    expect(levelClosestToHeight(LADDER, 576)).toBe(2);
  });

  it('ignore les niveaux sans hauteur declaree', () => {
    const mixed: QualityLevel[] = [{ bitrate: 500_000 }, { height: 480 }];
    expect(levelClosestToHeight(mixed, 480)).toBe(1);
  });

  it('rend auto si aucun niveau ne declare de hauteur', () => {
    const noHeight: QualityLevel[] = [{ bitrate: 500_000 }, { bitrate: 900_000 }];
    expect(levelClosestToHeight(noHeight, 720)).toBe(AUTO_LEVEL);
  });

  it('rend auto pour une liste vide ou une cible absurde', () => {
    expect(levelClosestToHeight([], 720)).toBe(AUTO_LEVEL);
    expect(levelClosestToHeight(LADDER, 0)).toBe(AUTO_LEVEL);
    expect(levelClosestToHeight(LADDER, -1)).toBe(AUTO_LEVEL);
  });
});

describe('qualityLabel', () => {
  it('affiche la hauteur suivie de p', () => {
    expect(qualityLabel({ height: 576, bitrate: 2_340_800 }, 0)).toBe('576p');
    expect(qualityLabel({ height: 240, bitrate: 690_800 }, 1)).toBe('240p');
  });

  it('se rabat sur le debit quand la hauteur manque', () => {
    // Virgule decimale : l interface est francophone par defaut.
    expect(qualityLabel({ bitrate: 2_340_800 }, 0)).toBe('2,3 Mb/s');
  });

  it('se rabat sur la position quand rien n est declare', () => {
    // Numerotation a partir de 1 : l index technique ne parle a personne.
    expect(qualityLabel({}, 0)).toBe('#1');
    expect(qualityLabel({ height: 0, bitrate: 0 }, 2)).toBe('#3');
  });
});
