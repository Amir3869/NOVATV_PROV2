import { describe, it, expect, beforeEach } from 'vitest';
import { resolveGlass, applyGlass } from './useGlass';

/**
 * `resolveGlass` est le cœur de la décision : elle tranche entre ce que
 * l'utilisateur a demandé et ce que l'appareil supporte confortablement.
 * Étant une fonction pure, elle se teste sans navigateur ni composant.
 */
describe('resolveGlass', () => {
  it('respecte un choix explicite « activé », même sur téléviseur', () => {
    // Le point important du réglage : l'utilisateur reste maître. S'il
    // veut le verre sur sa TV malgré le coût, il l'obtient.
    expect(resolveGlass(true, true)).toBe(true);
    expect(resolveGlass(true, false)).toBe(true);
  });

  it('respecte un choix explicite « désactivé », même sur téléphone', () => {
    expect(resolveGlass(false, false)).toBe(false);
    expect(resolveGlass(false, true)).toBe(false);
  });

  it('sans choix, active le verre hors téléviseur', () => {
    expect(resolveGlass(null, false)).toBe(true);
  });

  it('sans choix, désactive le verre sur téléviseur', () => {
    // Comportement d'usine visé : une première ouverture fluide sur
    // Fire TV Stick, où le flou recalculé à chaque image fait saccader.
    expect(resolveGlass(null, true)).toBe(false);
  });
});

describe('applyGlass', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-glass');
  });

  it("pose l'attribut quand le verre est coupé", () => {
    applyGlass(false);
    expect(document.documentElement.getAttribute('data-glass')).toBe('off');
  });

  it("retire l'attribut quand le verre est actif", () => {
    applyGlass(false);
    applyGlass(true);
    expect(document.documentElement.hasAttribute('data-glass')).toBe(false);
  });

  it('est idempotent : deux appels identiques laissent le même état', () => {
    applyGlass(false);
    applyGlass(false);
    expect(document.documentElement.getAttribute('data-glass')).toBe('off');
  });
});
