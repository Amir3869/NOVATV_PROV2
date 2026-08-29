import { describe, it, expect } from 'vitest';
import {
  clamp01,
  ratioFromPointer,
  valueFromRatio,
  percentFromValue,
  sliderKeyIntent,
  applySliderIntent,
} from './sliderMath';

describe('clamp01', () => {
  it('laisse passer une valeur interne', () => {
    expect(clamp01(0.42)).toBe(0.42);
  });

  it('ramene une valeur negative a zero', () => {
    expect(clamp01(-3)).toBe(0);
  });

  it('ramene une valeur trop grande a un', () => {
    expect(clamp01(12)).toBe(1);
  });

  it('traite NaN comme zero', () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it('accepte exactement les bornes', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });
});

describe('ratioFromPointer', () => {
  it('donne le milieu quand le pointeur est au centre', () => {
    expect(ratioFromPointer(150, 100, 100)).toBe(0.5);
  });

  it('donne zero au bord gauche', () => {
    expect(ratioFromPointer(100, 100, 100)).toBe(0);
  });

  it('donne un au bord droit', () => {
    expect(ratioFromPointer(200, 100, 100)).toBe(1);
  });

  it('borne un glissement parti hors de la barre a gauche', () => {
    expect(ratioFromPointer(20, 100, 100)).toBe(0);
  });

  it('borne un glissement parti hors de la barre a droite', () => {
    expect(ratioFromPointer(900, 100, 100)).toBe(1);
  });

  it('renvoie zero si la barre n a pas encore de largeur', () => {
    expect(ratioFromPointer(150, 100, 0)).toBe(0);
  });

  it('renvoie zero sur une largeur negative', () => {
    expect(ratioFromPointer(150, 100, -50)).toBe(0);
  });
});

describe('valueFromRatio', () => {
  it('convertit un ratio en secondes', () => {
    expect(valueFromRatio(0.25, 200)).toBe(50);
  });

  it('renvoie zero quand la duree est inconnue', () => {
    expect(valueFromRatio(0.5, 0)).toBe(0);
  });

  it('borne un ratio aberrant', () => {
    expect(valueFromRatio(4, 100)).toBe(100);
  });
});

describe('percentFromValue', () => {
  it('calcule un pourcentage simple', () => {
    expect(percentFromValue(30, 120)).toBe(25);
  });

  it('renvoie zero quand la duree est nulle plutot que NaN', () => {
    expect(percentFromValue(30, 0)).toBe(0);
  });

  it('ne depasse jamais cent', () => {
    expect(percentFromValue(500, 100)).toBe(100);
  });

  it('ne descend jamais sous zero', () => {
    expect(percentFromValue(-10, 100)).toBe(0);
  });

  it('resiste a une position NaN', () => {
    expect(percentFromValue(Number.NaN, 100)).toBe(0);
  });
});

describe('sliderKeyIntent', () => {
  it('avance vers la droite', () => {
    expect(sliderKeyIntent('ArrowRight', 10)).toEqual({ kind: 'delta', amount: 10 });
  });

  it('recule vers la gauche', () => {
    expect(sliderKeyIntent('ArrowLeft', 10)).toEqual({ kind: 'delta', amount: -10 });
  });

  it('avance par bonds avec PageUp', () => {
    expect(sliderKeyIntent('PageUp', 10)).toEqual({ kind: 'delta', amount: 50 });
  });

  it('recule par bonds avec PageDown', () => {
    expect(sliderKeyIntent('PageDown', 10)).toEqual({ kind: 'delta', amount: -50 });
  });

  it('saute au debut avec Home', () => {
    expect(sliderKeyIntent('Home', 10)).toEqual({ kind: 'absolute', ratio: 0 });
  });

  it('saute a la fin avec End', () => {
    expect(sliderKeyIntent('End', 10)).toEqual({ kind: 'absolute', ratio: 1 });
  });

  it('ignore les fleches verticales, reservees au volume', () => {
    expect(sliderKeyIntent('ArrowUp', 10)).toBeNull();
    expect(sliderKeyIntent('ArrowDown', 10)).toBeNull();
  });

  it('ignore une touche quelconque', () => {
    expect(sliderKeyIntent('a', 10)).toBeNull();
    expect(sliderKeyIntent('Enter', 10)).toBeNull();
  });

  it('respecte un pas different', () => {
    expect(sliderKeyIntent('ArrowRight', 5)).toEqual({ kind: 'delta', amount: 5 });
  });
});

describe('applySliderIntent', () => {
  it('ajoute le pas a la valeur courante', () => {
    expect(applySliderIntent({ kind: 'delta', amount: 10 }, 30, 100)).toBe(40);
  });

  it('retire le pas a la valeur courante', () => {
    expect(applySliderIntent({ kind: 'delta', amount: -10 }, 30, 100)).toBe(20);
  });

  it('ne recule pas avant le debut', () => {
    expect(applySliderIntent({ kind: 'delta', amount: -10 }, 3, 100)).toBe(0);
  });

  it('ne depasse pas la fin', () => {
    expect(applySliderIntent({ kind: 'delta', amount: 10 }, 95, 100)).toBe(100);
  });

  it('saute au debut', () => {
    expect(applySliderIntent({ kind: 'absolute', ratio: 0 }, 55, 100)).toBe(0);
  });

  it('saute a la fin', () => {
    expect(applySliderIntent({ kind: 'absolute', ratio: 1 }, 55, 100)).toBe(100);
  });

  it('renvoie zero quand le maximum est inconnu', () => {
    expect(applySliderIntent({ kind: 'delta', amount: 10 }, 0, 0)).toBe(0);
  });
});
