import { describe, it, expect, beforeEach } from 'vitest';
import { resolveAnimations, applyAnimations } from './useAnimations';

/**
 * `resolveAnimations` arbitre entre trois sources d'information qui
 * peuvent se contredire : le choix de l'utilisateur, le réglage système
 * d'accessibilité, et le type d'appareil. L'ordre de priorité est la
 * partie du réglage la plus facile à casser par mégarde — d'où ces tests.
 */
describe('resolveAnimations', () => {
  describe('un choix explicite prime sur tout', () => {
    it('« activé » l\'emporte sur le réglage système', () => {
      // Cas important : la personne a coupé les animations dans Windows,
      // mais les veut dans Nova TV. Son choix le plus récent gagne.
      expect(resolveAnimations(true, false, true)).toBe(true);
    });

    it('« activé » l\'emporte sur le téléviseur', () => {
      expect(resolveAnimations(true, true, false)).toBe(true);
    });

    it('« désactivé » l\'emporte, même sans contre-indication', () => {
      expect(resolveAnimations(false, false, false)).toBe(false);
    });
  });

  describe('sans choix explicite', () => {
    it('obéit au réglage système « réduire les animations »', () => {
      expect(resolveAnimations(null, false, true)).toBe(false);
    });

    it('coupe sur téléviseur', () => {
      expect(resolveAnimations(null, true, false)).toBe(false);
    });

    it('active ailleurs', () => {
      expect(resolveAnimations(null, false, false)).toBe(true);
    });

    it('le système prime sur l\'appareil quand les deux coupent', () => {
      expect(resolveAnimations(null, true, true)).toBe(false);
    });
  });
});

describe('applyAnimations', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-motion');
  });

  it('marque explicitement l\'état actif', () => {
    // `data-motion="on"` n'est pas décoratif : c'est lui qui neutralise la
    // règle CSS `prefers-reduced-motion` quand l'utilisateur a rallumé
    // les animations dans l'application.
    applyAnimations(true);
    expect(document.documentElement.getAttribute('data-motion')).toBe('on');
  });

  it('marque l\'état coupé', () => {
    applyAnimations(false);
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
  });

  it('bascule proprement dans les deux sens', () => {
    applyAnimations(false);
    applyAnimations(true);
    expect(document.documentElement.getAttribute('data-motion')).toBe('on');
    applyAnimations(false);
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
  });
});
