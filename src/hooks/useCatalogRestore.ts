'use client';

import { useEffect, useState } from 'react';
import { restoreCatalog } from '@/store/useAppStore';

/**
 * Recharge le catalogue enregistré au démarrage de l'application.
 *
 * ─── Le problème que cela règle ────────────────────────────────────
 *
 * Jusqu'ici, le catalogue n'était enregistré nulle part. On importait
 * sa source, l'accueil se remplissait, puis le moindre rechargement de
 * page — ou la simple fermeture de l'application sur le téléviseur —
 * ramenait l'écran « aucun contenu chargé ». Il fallait retourner dans
 * les réglages et resynchroniser à la main, à chaque fois.
 *
 * Rédhibitoire sur une télévision, où l'application est fermée et
 * rouverte plusieurs fois par jour.
 *
 * ─── Pourquoi un hook séparé ───────────────────────────────────────
 *
 * La relecture d'IndexedDB est asynchrone, alors que celle de
 * `localStorage` est immédiate. Les deux ne peuvent donc pas être
 * attendues de la même manière : `useHydrated` couvre `localStorage`,
 * ce hook couvre le catalogue.
 *
 * ─── Ce que renvoie le hook ────────────────────────────────────────
 *
 * `false` tant que la relecture est en cours, `true` une fois
 * terminée — qu'un catalogue ait été trouvé ou non. C'est un signal de
 * « on sait maintenant », pas de « il y a du contenu ».
 *
 * La distinction est ce qui évite d'annoncer « aucun contenu » à
 * quelqu'un dont le catalogue est simplement en cours de lecture. La
 * règle est la même que pour `useHydrated` : tant que l'on ne sait
 * pas, on affiche un chargement, jamais un écran vide.
 */
export function useCatalogRestore(): boolean {
  const [done, setDone] = useState(false);

  useEffect(() => {
    let annule = false;

    // `restoreCatalog` ne lève jamais : elle renvoie `false` quand il
    // n'y a rien à restaurer ou que le stockage est indisponible. Le
    // `catch` reste par sécurité — un hook ne doit en aucun cas
    // empêcher l'application de démarrer.
    restoreCatalog()
      .catch(() => false)
      .finally(() => {
        // Le composant a pu être démonté entre-temps, en développement
        // notamment, où React monte les effets deux fois. Écrire dans
        // l'état après démontage provoquerait un avertissement.
        if (!annule) setDone(true);
      });

    return () => {
      annule = true;
    };
  }, []);

  return done;
}
