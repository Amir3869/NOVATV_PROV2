import { describe, expect, it } from 'vitest';
import { AVATAR_GRID_COLUMNS, moveAvatarFocus } from './AvatarPicker';

/**
 * Tests du déplacement du focus dans la grille de choix d'avatar.
 *
 * La grille est en 4 × 2 (huit avatars, `AVATAR_GRID_COLUMNS` = 4).
 * Ce fichier ne teste que la fonction pure `moveAvatarFocus` : le projet
 * n'a pas encore de banc de test de composants, et c'est justement pour
 * pouvoir vérifier ces bornes sans navigateur qu'on a extrait cette
 * fonction du composant.
 */
const AVATAR_COUNT = 8;

describe('moveAvatarFocus — déplacement dans la grille 4×2', () => {
  it("la flèche droite avance d'une colonne, et reste bornée à droite", () => {
    expect(moveAvatarFocus(0, 'ArrowRight', AVATAR_COUNT)).toBe(1);
    expect(moveAvatarFocus(6, 'ArrowRight', AVATAR_COUNT)).toBe(7);
    // Dernière cellule : ne pas sortir de la grille.
    expect(moveAvatarFocus(7, 'ArrowRight', AVATAR_COUNT)).toBe(7);
  });

  it("la flèche gauche recule d'une colonne, et reste bornée à gauche", () => {
    expect(moveAvatarFocus(3, 'ArrowLeft', AVATAR_COUNT)).toBe(2);
    expect(moveAvatarFocus(0, 'ArrowLeft', AVATAR_COUNT)).toBe(0);
  });

  it("la flèche haut remonte d'une rangée (4 cellules), bornée en haut", () => {
    expect(moveAvatarFocus(4, 'ArrowUp', AVATAR_COUNT)).toBe(0);
    expect(moveAvatarFocus(0, 'ArrowUp', AVATAR_COUNT)).toBe(0);
  });

  it("la flèche bas descend d'une rangée (4 cellules), bornée en bas", () => {
    // De la rangée du haut vers celle du bas : +4 cellules.
    expect(moveAvatarFocus(3, 'ArrowDown', AVATAR_COUNT)).toBe(7);
    // Déjà en dernière rangée : rester sur place, sans bond en diagonale.
    expect(moveAvatarFocus(4, 'ArrowDown', AVATAR_COUNT)).toBe(4);
    expect(moveAvatarFocus(7, 'ArrowDown', AVATAR_COUNT)).toBe(7);
  });

  it("la flèche haut ne remonte pas au-dessus de la première rangée", () => {
    // De la rangée du bas vers celle du haut : -4 cellules.
    expect(moveAvatarFocus(4, 'ArrowUp', AVATAR_COUNT)).toBe(0);
    // Déjà en première rangée : rester sur place.
    expect(moveAvatarFocus(1, 'ArrowUp', AVATAR_COUNT)).toBe(1);
  });

  it('une touche inconnue ne déplace pas le focus', () => {
    expect(moveAvatarFocus(2, 'Enter', AVATAR_COUNT)).toBe(2);
    expect(moveAvatarFocus(2, 'Tab', AVATAR_COUNT)).toBe(2);
    expect(moveAvatarFocus(2, 'Escape', AVATAR_COUNT)).toBe(2);
  });

  it('protège une grille vide (aucune cellule)', () => {
    expect(moveAvatarFocus(0, 'ArrowRight', 0)).toBe(0);
  });

  it('respecte le nombre de colonnes configuré', () => {
    // Grille en 5 colonnes : la flèche bas saute de 5 cellules.
    expect(moveAvatarFocus(0, 'ArrowDown', 10, 5)).toBe(5);
  });

  it('le nombre de colonnes par défaut est 4 (grille 4×2)', () => {
    expect(AVATAR_GRID_COLUMNS).toBe(4);
  });
});
