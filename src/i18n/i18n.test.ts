import { describe, it, expect } from 'vitest';
import { fr } from './messages/fr';
import { en } from './messages/en';
import { es } from './messages/es';
import { ar } from './messages/ar';
import { LOCALES, LOCALE_NAMES, isLocale, isRTL, detectLocale } from './types';
import { formatMessage, translate, type MessageKey } from './index';

/**
 * Ces tests protègent surtout contre l'oubli : une traduction ajoutée
 * en français mais pas dans les trois autres langues, un marqueur
 * `{count}` perdu en route. Ce sont les erreurs qui passent le plus
 * facilement une relecture humaine.
 */

const DICTS = { fr, en, es, ar } as const;

/** Aplatit `{a:{b:'x'}}` en `['a.b']` pour comparer les jeux de clés. */
function flatKeys(dict: Record<string, Record<string, string>>): string[] {
  return Object.entries(dict)
    .flatMap(([section, entries]) => Object.keys(entries).map((k) => `${section}.${k}`))
    .sort();
}

/** Extrait les marqueurs `{x}` d'un texte. */
function placeholders(text: string): string[] {
  return (text.match(/\{(\w+)\}/g) ?? []).sort();
}

describe('dictionnaires', () => {
  const reference = flatKeys(fr as never);

  it('déclare autant de langues que de dictionnaires', () => {
    expect(Object.keys(DICTS).sort()).toEqual([...LOCALES].sort());
  });

  for (const [code, dict] of Object.entries(DICTS)) {
    it(`« ${code} » possède exactement les mêmes clés que le français`, () => {
      expect(flatKeys(dict as never)).toEqual(reference);
    });

    it(`« ${code} » n'a aucune valeur vide`, () => {
      const empties = Object.entries(dict as Record<string, Record<string, string>>)
        .flatMap(([section, entries]) =>
          Object.entries(entries)
            .filter(([, value]) => value.trim() === '')
            .map(([k]) => `${section}.${k}`),
        );
      expect(empties).toEqual([]);
    });

    it(`« ${code} » conserve les mêmes marqueurs que le français`, () => {
      const mismatches: string[] = [];
      for (const key of reference) {
        const [section, name] = key.split('.');
        const source = (fr as never as Record<string, Record<string, string>>)[section][name];
        const target = (dict as Record<string, Record<string, string>>)[section][name];
        if (placeholders(source).join() !== placeholders(target).join()) {
          mismatches.push(key);
        }
      }
      expect(mismatches).toEqual([]);
    });
  }

  it('nomme chaque langue dans le sélecteur', () => {
    for (const code of LOCALES) expect(LOCALE_NAMES[code]).toBeTruthy();
  });
});

describe('formatMessage', () => {
  it('remplace un marqueur par sa valeur', () => {
    expect(formatMessage('{count} chaînes', { count: 128 })).toBe('128 chaînes');
  });

  it('remplace plusieurs marqueurs', () => {
    expect(formatMessage('{a} sur {b}', { a: 3, b: 10 })).toBe('3 sur 10');
  });

  it('laisse le marqueur visible si la valeur manque', () => {
    // Un blanc passerait inaperçu ; « {count} » saute aux yeux.
    expect(formatMessage('{count} chaînes')).toBe('{count} chaînes');
    expect(formatMessage('{count} chaînes', { autre: 1 })).toBe('{count} chaînes');
  });

  it('accepte la valeur zéro', () => {
    expect(formatMessage('{count} éléments', { count: 0 })).toBe('0 éléments');
  });
});

describe('translate', () => {
  it('renvoie le texte de la langue demandée', () => {
    expect(translate('fr', 'nav.home')).toBe('Accueil');
    expect(translate('en', 'nav.home')).toBe('Home');
    expect(translate('es', 'nav.home')).toBe('Inicio');
    expect(translate('ar', 'nav.home')).toBe('الرئيسية');
  });

  it('interpole dans la langue demandée', () => {
    expect(translate('en', 'liveTV.channelCount', { count: 42 })).toBe('42 channels available');
    expect(translate('fr', 'liveTV.channelCount', { count: 42 })).toBe('42 chaînes disponibles');
  });

  it('retombe sur le français pour une langue inconnue', () => {
    expect(translate('de' as never, 'nav.home')).toBe('Accueil');
  });

  it('renvoie la clé brute si elle est absente partout', () => {
    // Repli de dernier recours : visible à l'écran, donc corrigeable.
    expect(translate('fr', 'nav.inexistant' as MessageKey)).toBe('nav.inexistant');
  });
});

describe('langues', () => {
  it('reconnaît les langues gérées', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });

  it("n'inverse la mise en page que pour l'arabe", () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('fr')).toBe(false);
    expect(isRTL('en')).toBe(false);
    expect(isRTL('es')).toBe(false);
  });

  it('déduit la langue du navigateur en ignorant la région', () => {
    expect(detectLocale(['fr-BE'])).toBe('fr');
    expect(detectLocale(['en-US', 'fr'])).toBe('en');
    expect(detectLocale(['ar-MA'])).toBe('ar');
  });

  it('retient la première langue connue de la liste', () => {
    expect(detectLocale(['de-DE', 'it', 'es-MX'])).toBe('es');
  });

  it('retombe sur le français si aucune ne correspond', () => {
    expect(detectLocale(['de', 'it'])).toBe('fr');
    expect(detectLocale([])).toBe('fr');
  });
});
