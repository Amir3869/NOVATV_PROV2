import { describe, it, expect } from 'vitest';
import {
  VIDEO_FIT_MODES,
  DEFAULT_VIDEO_FIT,
  videoFitClassName,
  isVideoFitMode,
  nextVideoFit,
  type VideoFitMode,
} from './videoFit';

describe('VIDEO_FIT_MODES', () => {
  it('propose exactement les trois modes retenus', () => {
    expect(VIDEO_FIT_MODES).toEqual(['contain', 'cover', 'fill']);
  });

  it('place « Ajusté » en tête, pour un accès en un cran de télécommande', () => {
    expect(VIDEO_FIT_MODES[0]).toBe('contain');
  });

  it('a pour défaut un mode réellement présent dans la liste', () => {
    // Un défaut absent de la liste ne serait sélectionnable nulle part
    // dans le menu : l'utilisateur verrait zéro ligne cochée.
    expect(VIDEO_FIT_MODES).toContain(DEFAULT_VIDEO_FIT);
  });

  it('choisit « Ajusté » par défaut : aucune perte d’image', () => {
    expect(DEFAULT_VIDEO_FIT).toBe('contain');
  });
});

describe('videoFitClassName', () => {
  it('rend la classe Tailwind de chaque mode', () => {
    expect(videoFitClassName('contain')).toBe('object-contain');
    expect(videoFitClassName('cover')).toBe('object-cover');
    expect(videoFitClassName('fill')).toBe('object-fill');
  });

  it('rend une classe pour chacun des modes annoncés', () => {
    // Ajouter un mode à la liste sans lui donner de classe casserait
    // l'affichage en silence : la balise vidéo perdrait tout ajustement.
    for (const mode of VIDEO_FIT_MODES) {
      expect(videoFitClassName(mode)).toMatch(/^object-/);
    }
  });

  it('retombe sur la classe du défaut si le mode est inconnu', () => {
    const bogus = 'zoom-x2' as VideoFitMode;
    expect(videoFitClassName(bogus)).toBe('object-contain');
  });

  it('n’assemble jamais la classe à l’exécution', () => {
    // Tailwind ne génère que les classes qu'il trouve écrites en toutes
    // lettres dans le source. Ce test vérifie la sortie, pas
    // l'implémentation, mais il documente la contrainte : si quelqu'un
    // remplace la table par `'object-' + mode`, les classes cesseront
    // d'être produites et l'image ne s'ajustera plus en production.
    const produced = VIDEO_FIT_MODES.map(videoFitClassName);
    expect(new Set(produced).size).toBe(VIDEO_FIT_MODES.length);
  });
});

describe('isVideoFitMode', () => {
  it('accepte les trois modes connus', () => {
    expect(isVideoFitMode('contain')).toBe(true);
    expect(isVideoFitMode('cover')).toBe(true);
    expect(isVideoFitMode('fill')).toBe(true);
  });

  it('refuse une valeur CSS proche mais non retenue', () => {
    // `scale-down` et `none` sont des valeurs `object-fit` valides en
    // CSS, mais elles ne font pas partie des modes offerts.
    expect(isVideoFitMode('scale-down')).toBe(false);
    expect(isVideoFitMode('none')).toBe(false);
  });

  it('refuse ce qui n’est pas une chaîne', () => {
    // Cas réels d'une préférence enregistrée par une ancienne version.
    expect(isVideoFitMode(undefined)).toBe(false);
    expect(isVideoFitMode(null)).toBe(false);
    expect(isVideoFitMode(0)).toBe(false);
    expect(isVideoFitMode(true)).toBe(false);
    expect(isVideoFitMode({})).toBe(false);
    expect(isVideoFitMode(['contain'])).toBe(false);
  });

  it('refuse une casse différente', () => {
    // Les valeurs CSS sont en minuscules ; accepter 'Contain' laisserait
    // passer une valeur qui ne produirait aucune classe.
    expect(isVideoFitMode('Contain')).toBe(false);
    expect(isVideoFitMode('COVER')).toBe(false);
  });

  it('refuse la chaîne vide', () => {
    expect(isVideoFitMode('')).toBe(false);
  });
});

describe('nextVideoFit', () => {
  it('avance d’un cran dans l’ordre du menu', () => {
    expect(nextVideoFit('contain')).toBe('cover');
    expect(nextVideoFit('cover')).toBe('fill');
  });

  it('revient au premier après le dernier', () => {
    expect(nextVideoFit('fill')).toBe('contain');
  });

  it('parcourt tous les modes puis boucle', () => {
    let mode: VideoFitMode = DEFAULT_VIDEO_FIT;
    const seen: VideoFitMode[] = [mode];
    for (let i = 0; i < VIDEO_FIT_MODES.length - 1; i += 1) {
      mode = nextVideoFit(mode);
      seen.push(mode);
    }
    expect(new Set(seen).size).toBe(VIDEO_FIT_MODES.length);
    expect(nextVideoFit(mode)).toBe(DEFAULT_VIDEO_FIT);
  });

  it('ramène au premier mode si l’entrée est inconnue', () => {
    const bogus = 'zoom-x2' as VideoFitMode;
    expect(nextVideoFit(bogus)).toBe('contain');
  });
});
