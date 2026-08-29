import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTheme, applyTheme } from './useTheme';

describe('resolveTheme', () => {
  it('impose le thème clair quand il est choisi, même système en sombre', () => {
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('impose le thème sombre quand il est choisi, même système en clair', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('suit le système en mode automatique', () => {
    // C'est la valeur par défaut : basculer son téléphone en sombre le soir
    // doit suivre sans réglage manuel.
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
  });

  it('pose la classe attendue sur <html>', () => {
    // Tout le thème repose sur cette classe : `globals.css` redéfinit
    // `--color-white` et les surfaces sous `html.light`.
    applyTheme('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('retire la classe précédente au changement', () => {
    // Sans le retrait, les deux classes coexisteraient et le résultat
    // dépendrait de l'ordre des règles CSS.
    applyTheme('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('renseigne color-scheme pour les éléments dessinés par le navigateur', () => {
    // Barres de défilement, listes déroulantes, champs de formulaire :
    // sans cette propriété ils resteraient sombres en thème clair.
    applyTheme('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    applyTheme('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
