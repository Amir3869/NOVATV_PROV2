import { describe, it, expect } from 'vitest';

import {
  CATEGORY_KINDS,
  categoryPrefix,
  countSelected,
  emptyCatalog,
  emptySelection,
  expandWithChildren,
  filterCategories,
  groupCategories,
  isCategorySelected,
  isSelectionEmpty,
  normalizeSelection,
  reconcileSelection,
  runWithConcurrency,
  selectionOrAll,
  setCategories,
  toggleCategory,
} from './categorySelection';
import type { XtreamCategory } from './xtreamService';

/** Fabrique une catégorie de test, seuls le nom et l'identifiant comptent. */
function cat(categoryId: string, categoryName: string): XtreamCategory {
  return { categoryId, categoryName, parentId: 0 };
}

describe('emptySelection / emptyCatalog', () => {
  it('part de trois listes vides', () => {
    expect(emptySelection()).toEqual({ live: [], vod: [], series: [] });
    expect(emptyCatalog()).toEqual({ live: [], vod: [], series: [] });
  });

  it('rend un objet neuf à chaque appel', () => {
    // Un objet partagé se ferait modifier par le premier appelant.
    const a = emptySelection();
    const b = emptySelection();
    a.live.push('1');
    expect(b.live).toEqual([]);
  });

  it('couvre exactement les trois familles connues', () => {
    expect(CATEGORY_KINDS).toEqual(['live', 'vod', 'series']);
    expect(Object.keys(emptySelection()).sort()).toEqual([...CATEGORY_KINDS].sort());
  });
});

describe('countSelected / isSelectionEmpty', () => {
  it('additionne les trois familles', () => {
    const selection = { live: ['1', '2'], vod: ['3'], series: [] };
    expect(countSelected(selection)).toBe(3);
    expect(isSelectionEmpty(selection)).toBe(false);
  });

  it('considère vide une sélection sans aucune case cochée', () => {
    expect(countSelected(emptySelection())).toBe(0);
    expect(isSelectionEmpty(emptySelection())).toBe(true);
  });

  it('ne considère pas vide une sélection portant sur les seuls films', () => {
    // Un abonnement peut n'avoir que de la VOD : l'import doit rester
    // possible.
    expect(isSelectionEmpty({ live: [], vod: ['7'], series: [] })).toBe(false);
  });
});

describe('toggleCategory', () => {
  it('coche une catégorie absente', () => {
    const next = toggleCategory(emptySelection(), 'live', '42');
    expect(next.live).toEqual(['42']);
  });

  it('décoche une catégorie présente', () => {
    const next = toggleCategory({ live: ['1', '42', '7'], vod: [], series: [] }, 'live', '42');
    expect(next.live).toEqual(['1', '7']);
  });

  it('ne touche pas les autres familles', () => {
    const before = { live: [], vod: ['9'], series: ['3'] };
    const after = toggleCategory(before, 'live', '1');
    expect(after.vod).toBe(before.vod);
    expect(after.series).toBe(before.series);
  });

  it('ne modifie jamais la sélection reçue', () => {
    // React compare les références : muter sur place figerait l'affichage.
    const before = emptySelection();
    const after = toggleCategory(before, 'live', '1');
    expect(before.live).toEqual([]);
    expect(after).not.toBe(before);
  });
});

describe('setCategories', () => {
  it('coche tout un lot', () => {
    const next = setCategories(emptySelection(), 'vod', ['1', '2', '3'], true);
    expect(next.vod).toEqual(['1', '2', '3']);
  });

  it('décoche tout un lot', () => {
    const next = setCategories(
      { live: [], vod: ['1', '2', '3', '4'], series: [] },
      'vod',
      ['2', '3'],
      false
    );
    expect(next.vod).toEqual(['1', '4']);
  });

  it("n'introduit pas de doublon quand une partie du lot est déjà cochée", () => {
    const next = setCategories({ live: ['1'], vod: [], series: [] }, 'live', ['1', '2'], true);
    expect(next.live).toEqual(['1', '2']);
  });

  it('rend la même sélection quand il n’y a rien à ajouter', () => {
    // Évite un redessin inutile de la liste.
    const before = { live: ['1', '2'], vod: [], series: [] };
    expect(setCategories(before, 'live', ['1', '2'], true)).toBe(before);
  });

  it('accepte un lot vide sans rien changer', () => {
    const before = { live: ['1'], vod: [], series: [] };
    expect(setCategories(before, 'live', [], true)).toBe(before);
    expect(setCategories(before, 'live', [], false).live).toEqual(['1']);
  });
});

describe('isCategorySelected', () => {
  it('répond juste pour chaque famille', () => {
    const selection = { live: ['1'], vod: ['1'], series: [] };
    expect(isCategorySelected(selection, 'live', '1')).toBe(true);
    expect(isCategorySelected(selection, 'series', '1')).toBe(false);
  });
});

describe('reconcileSelection', () => {
  it('retire les catégories disparues du serveur', () => {
    // Cas réel : le fournisseur renumérote ses catégories.
    const selection = { live: ['1', '99'], vod: [], series: [] };
    const catalog = { ...emptyCatalog(), live: [cat('1', 'FR TF1')] };
    expect(reconcileSelection(selection, catalog).live).toEqual(['1']);
  });

  it('conserve les catégories toujours proposées', () => {
    const selection = { live: ['1'], vod: ['5'], series: ['8'] };
    const catalog = {
      live: [cat('1', 'FR TF1')],
      vod: [cat('5', 'FR Films')],
      series: [cat('8', 'FR Séries')],
    };
    expect(reconcileSelection(selection, catalog)).toEqual(selection);
  });

  it('vide la sélection quand le serveur ne propose plus rien', () => {
    const selection = { live: ['1', '2'], vod: ['3'], series: [] };
    expect(reconcileSelection(selection, emptyCatalog())).toEqual(emptySelection());
  });
});

describe('normalizeSelection', () => {
  it('accepte une sélection bien formée', () => {
    expect(normalizeSelection({ live: ['1'], vod: [], series: ['2'] })).toEqual({
      live: ['1'],
      vod: [],
      series: ['2'],
    });
  });

  it('rend null pour ce qui ne ressemble à rien', () => {
    // « Pas de sélection » signifie « tout », et non « rien ».
    expect(normalizeSelection(null)).toBeNull();
    expect(normalizeSelection(undefined)).toBeNull();
    expect(normalizeSelection('live')).toBeNull();
    expect(normalizeSelection(42)).toBeNull();
    expect(normalizeSelection({})).toBeNull();
    expect(normalizeSelection({ autre: ['1'] })).toBeNull();
  });

  it('écarte les entrées qui ne sont pas des chaînes non vides', () => {
    const result = normalizeSelection({ live: ['1', 2, null, '', { id: '3' }, '4'] });
    expect(result?.live).toEqual(['1', '4']);
  });

  it('supprime les doublons', () => {
    expect(normalizeSelection({ vod: ['7', '7', '8'] })?.vod).toEqual(['7', '8']);
  });

  it('complète les familles absentes par des listes vides', () => {
    // Une version future pourrait n'enregistrer que ce qui est coché.
    expect(normalizeSelection({ live: ['1'] })).toEqual({ live: ['1'], vod: [], series: [] });
  });

  it("rend null pour un tableau, qui n'a pas la forme attendue", () => {
    expect(normalizeSelection(['1', '2'])).toBeNull();
  });
});

describe('selectionOrAll', () => {
  it('rend undefined en l’absence de sélection', () => {
    // undefined est exactement ce qu'attend getLiveStreams pour « tout ».
    expect(selectionOrAll(null, 'live')).toBeUndefined();
    expect(selectionOrAll(undefined, 'vod')).toBeUndefined();
  });

  it('rend la liste des identifiants cochés', () => {
    const selection = { live: ['1', '2'], vod: [], series: [] };
    expect(selectionOrAll(selection, 'live')).toEqual(['1', '2']);
  });

  it('distingue « aucune catégorie » de « toutes les catégories »', () => {
    // Le point le plus délicat du fichier : [] veut dire « ne rien
    // télécharger », undefined veut dire « tout télécharger ».
    expect(selectionOrAll(emptySelection(), 'vod')).toEqual([]);
    expect(selectionOrAll(null, 'vod')).toBeUndefined();
  });
});

describe('filterCategories', () => {
  const list = [cat('1', 'FR | Cinéma'), cat('2', 'AR Sport HD'), cat('3', 'UK Documentary')];

  it('trouve sans tenir compte de la casse', () => {
    expect(filterCategories(list, 'sport').map((c) => c.categoryId)).toEqual(['2']);
  });

  it('trouve sans tenir compte des accents', () => {
    // « cinema » doit trouver « Cinéma ».
    expect(filterCategories(list, 'cinema').map((c) => c.categoryId)).toEqual(['1']);
    expect(filterCategories(list, 'CINÉMA').map((c) => c.categoryId)).toEqual(['1']);
  });

  it('rend la liste inchangée pour une requête vide', () => {
    expect(filterCategories(list, '')).toBe(list);
    expect(filterCategories(list, '   ')).toBe(list);
  });

  it('rend une liste vide quand rien ne correspond', () => {
    expect(filterCategories(list, 'zzz')).toEqual([]);
  });
});

describe('categoryPrefix', () => {
  it('reconnaît les formats de préfixe courants', () => {
    expect(categoryPrefix('FR | TF1 HD')).toBe('FR');
    expect(categoryPrefix('AR Sport HD')).toBe('AR');
    expect(categoryPrefix('US- Movies')).toBe('US');
    expect(categoryPrefix('UK: Documentary')).toBe('UK');
    expect(categoryPrefix('BE4K Sports')).toBe('BE4K');
  });

  it('refuse les mots ordinaires', () => {
    // « The » n'est pas un code de pays : regrouper dessus n'aurait
    // aucun sens pour l'utilisateur.
    expect(categoryPrefix('The Best Movies')).toBeNull();
    expect(categoryPrefix('Cinéma Français')).toBeNull();
  });

  it('refuse un préfixe purement numérique', () => {
    expect(categoryPrefix('24 Hours News')).toBeNull();
  });

  it('refuse un préfixe trop court ou trop long', () => {
    expect(categoryPrefix('F | Truc')).toBeNull();
    expect(categoryPrefix('FRANCE Sport')).toBeNull();
  });

  it('refuse un nom réduit à son seul préfixe', () => {
    expect(categoryPrefix('VIP')).toBeNull();
    expect(categoryPrefix('  VIP  ')).toBeNull();
  });

  it('refuse une chaîne vide', () => {
    expect(categoryPrefix('')).toBeNull();
    expect(categoryPrefix('   ')).toBeNull();
  });
});

describe('groupCategories', () => {
  it('regroupe par préfixe en gardant l’ordre du serveur', () => {
    const groups = groupCategories([
      cat('1', 'FR | TF1'),
      cat('2', 'AR Sport'),
      cat('3', 'FR | M6'),
      cat('4', 'AR Music'),
    ]);
    expect(groups.map((g) => g.prefix)).toEqual(['FR', 'AR']);
    expect(groups[0].categories.map((c) => c.categoryId)).toEqual(['1', '3']);
    expect(groups[1].categories.map((c) => c.categoryId)).toEqual(['2', '4']);
  });

  it('place les noms sans préfixe dans un groupe final', () => {
    const groups = groupCategories([
      cat('1', 'FR | TF1'),
      cat('2', 'Cinéma Français'),
      cat('3', 'FR | M6'),
    ]);
    expect(groups.map((g) => g.prefix)).toEqual(['FR', null]);
    expect(groups[1].categories.map((c) => c.categoryId)).toEqual(['2']);
  });

  it('ne crée pas de groupe pour un préfixe unique', () => {
    // Sinon l'écran afficherait des dizaines d'en-têtes d'une ligne.
    const groups = groupCategories([cat('1', 'FR | TF1'), cat('2', 'DE Sport')]);
    expect(groups.map((g) => g.prefix)).toEqual([null]);
    expect(groups[0].categories.map((c) => c.categoryId)).toEqual(['1', '2']);
  });

  it('remet les préfixes solitaires à leur place d’origine', () => {
    const groups = groupCategories([
      cat('1', 'DE Sport'),
      cat('2', 'FR | TF1'),
      cat('3', 'Autre chose'),
      cat('4', 'FR | M6'),
    ]);
    expect(groups.map((g) => g.prefix)).toEqual(['FR', null]);
    expect(groups[1].categories.map((c) => c.categoryId)).toEqual(['1', '3']);
  });

  it('rend une liste vide pour une entrée vide', () => {
    expect(groupCategories([])).toEqual([]);
  });
});

describe('runWithConcurrency', () => {
  it('préserve l’ordre des résultats', async () => {
    // Les tâches finissent dans le désordre, les résultats non.
    const delays = [30, 5, 20, 1];
    const results = await runWithConcurrency(delays, 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return `${i}:${ms}`;
    });
    expect(results).toEqual(['0:30', '1:5', '2:20', '3:1']);
  });

  it('ne dépasse jamais la limite de requêtes simultanées', async () => {
    // Le portail peut refuser un compte qui ouvre trop de connexions.
    let running = 0;
    let peak = 0;
    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return null;
    });
    expect(peak).toBe(3);
  });

  it('traite tous les éléments', async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      seen.push(n);
      return n;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('rend une liste vide sans rien appeler', async () => {
    let calls = 0;
    const results = await runWithConcurrency([], 3, async () => {
      calls += 1;
      return 1;
    });
    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });

  it('propage le premier échec', async () => {
    await expect(
      runWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('portail injoignable');
        return n;
      })
    ).rejects.toThrow('portail injoignable');
  });

  it('accepte une limite plus grande que le nombre de tâches', async () => {
    const results = await runWithConcurrency([1, 2], 10, async (n) => n * 2);
    expect(results).toEqual([2, 4]);
  });

  it('traite une limite nulle comme une exécution séquentielle', async () => {
    // Une limite absurde ne doit pas bloquer indéfiniment.
    const results = await runWithConcurrency([1, 2, 3], 0, async (n) => n);
    expect(results).toEqual([1, 2, 3]);
  });
});
