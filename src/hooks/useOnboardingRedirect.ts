'use client';

/**
 * Envoie vers le parcours de premier lancement tant qu'il n'a pas été
 * suivi.
 *
 * ─── Pourquoi un hook et pas un test dans chaque page ──────────────
 *
 * Il y a seize routes. Les tester une par une, c'est seize occasions
 * d'en oublier une — et une page oubliée laisse entrer quelqu'un qui
 * n'a ni profil ni source, donc sur des écrans vides. Le contrôle est
 * donc fait une seule fois, dans `ClientLayout`, qui enveloppe tout.
 */

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useHydrated } from '@/hooks/useHydrated';
import { normalizePathname } from '@/utils/pathname';

/**
 * Routes accessibles sans avoir suivi le parcours.
 *
 * Les pages légales en font partie : mentions, confidentialité et
 * licences doivent rester consultables sans condition. Enfermer
 * quelqu'un dans un parcours dont il ne peut pas lire les conditions
 * serait absurde.
 */
const PUBLIC_ROUTES = ['/welcome', '/legal/terms', '/legal/privacy', '/legal/licenses'];

export function useOnboardingRedirect(): void {
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarded = useAppStore((s) => s.isOnboarded);

  /**
   * Les préférences sont relues du stockage après le premier rendu.
   * Avant cela, `isOnboarded` vaut `false` par défaut — mais cela ne
   * veut pas dire que le parcours n'a pas été suivi : on ne sait
   * simplement pas encore. Rediriger tout de suite renverrait vers
   * l'accueil quelqu'un qui l'a déjà terminé, à chaque rechargement.
   */
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (isOnboarded) return;
    // Même piège que dans ClientLayout : avec `trailingSlash: true`,
    // `pathname` vaut `/welcome/`. Sans normalisation, la route publique
    // n'était pas reconnue et le hook redirigeait `/welcome/` vers
    // `/welcome` en boucle.
    if (PUBLIC_ROUTES.includes(normalizePathname(pathname))) return;

    // `replace` et non `push` : le parcours ne doit pas s'empiler dans
    // l'historique, sinon le bouton « retour » du navigateur ramènerait
    // sur la page dont on vient d'être écarté.
    router.replace('/welcome');
  }, [hydrated, isOnboarded, pathname, router]);
}
