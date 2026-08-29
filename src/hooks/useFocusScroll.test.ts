import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrollFocusIntoView } from './useFocusScroll';

/**
 * Ces tests couvrent la décision « faut-il faire défiler ? », pas le
 * défilement lui-même : aucun environnement de test ne calcule de mise en
 * page réelle, `scrollIntoView` y est une fonction vide. On vérifie donc
 * qu'elle est appelée, avec les bons arguments, et surtout qu'elle ne l'est
 * PAS dans les cas où le défilement gênerait.
 */

/** Crée un élément et force la réponse de `matches(':focus-visible')`. */
function element(tag: string, focusVisible: boolean): HTMLElement {
  const el = document.createElement(tag);
  el.matches = (selector: string) =>
    selector === ':focus-visible' ? focusVisible : false;
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
}

describe('scrollFocusIntoView', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('fait défiler jusqu’à un bouton atteint au clavier', () => {
    const el = element('button', true);
    expect(scrollFocusIntoView(el, false)).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalledOnce();
  });

  it('déplace du minimum nécessaire, horizontalement et verticalement', () => {
    // `nearest` est le cœur du correctif : une carte déjà visible ne bouge
    // pas, une carte hors écran entre juste assez. Avec `center` ou `start`
    // la rangée sauterait à chaque déplacement de focus.
    const el = element('button', true);
    scrollFocusIntoView(el, false);
    expect(el.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  });

  it('ne fait rien lors d’un focus à la souris ou au doigt', () => {
    // Sans ce garde-fou, cliquer sur une carte partiellement visible la
    // ferait glisser sous le curseur — désagréable et inattendu.
    const el = element('button', false);
    expect(scrollFocusIntoView(el, false)).toBe(false);
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('ignore le conteneur principal ciblé par le lien d’évitement', () => {
    // <main tabIndex={-1}> reçoit le focus à chaque usage du lien
    // d’évitement ; le faire défiler remonterait la page de force.
    const el = element('main', true);
    expect(scrollFocusIntoView(el, false)).toBe(false);
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('supprime l’animation quand le système demande moins de mouvement', () => {
    const el = element('button', true);
    scrollFocusIntoView(el, true);
    expect(el.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' })
    );
  });

  it('défile quand même si le moteur ignore :focus-visible', () => {
    // Certains navigateurs de téléviseur sont anciens et lèvent une
    // exception sur ce sélecteur. Défiler un peu trop vaut mieux que de
    // laisser le focus hors écran.
    const el = document.createElement('button');
    el.matches = () => {
      throw new SyntaxError('unknown pseudo-class :focus-visible');
    };
    el.scrollIntoView = vi.fn();
    expect(scrollFocusIntoView(el, false)).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalledOnce();
  });

  it('ne plante pas sur une cible absente ou non-élément', () => {
    // `event.target` peut valoir null, ou pointer le document lui-même.
    expect(scrollFocusIntoView(null, false)).toBe(false);
    expect(scrollFocusIntoView(document, false)).toBe(false);
  });
});
