'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { TopBar, BottomNav } from '@/design-system/components/Navigation';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useFocusScroll } from '@/hooks/useFocusScroll';
import { useAnimations } from '@/hooks/useAnimations';
import { useGlass } from '@/hooks/useGlass';
import { useTheme } from '@/hooks/useTheme';
import { useLocaleDocument } from '@/i18n';
import { useCatalogRestore } from '@/hooks/useCatalogRestore';
import { useOnboardingRedirect } from '@/hooks/useOnboardingRedirect';
import { ParentalProvider } from '@/features/parental/ParentalProvider';
import { isSamePath } from '@/utils/pathname';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { isMobile, isTV, isReady } = useDeviceType();
  const pathname = usePathname();

  /**
   * Le lecteur occupe l'écran entier, sans menu ni barre.
   *
   * Cliquer une chaîne doit donner l'image, pas une vidéo encadrée par
   * l'interface de l'application. On retire donc la barre latérale, la
   * barre du haut et la barre du bas sur cette seule route.
   *
   * À noter : ce n'est pas le « plein écran » du navigateur
   * (`requestFullscreen`), lequel exige un geste explicite de
   * l'utilisateur et ne peut pas être déclenché à l'ouverture d'une
   * page. Sur PC, les bordures du navigateur restent donc visibles
   * jusqu'à ce qu'on appuie sur le bouton plein écran du lecteur. Dans
   * l'application Android — la cible réelle — il n'y a pas de bordure :
   * l'affichage est complet dès l'ouverture.
   */
  /**
   * Le parcours de premier lancement occupe lui aussi l'écran entier.
   *
   * Afficher le menu pendant l'accueil proposerait de naviguer vers des
   * pages encore vides — et permettrait de sortir du parcours sans
   * l'avoir terminé.
   */
  /**
   * `trailingSlash: true` fait que le chemin réel est `/welcome/`, avec
   * une barre finale. Comparer à `/welcome` était donc toujours faux :
   * le menu, la barre du haut et la barre du bas s'affichaient
   * par-dessus l'écran de bienvenue. `isSamePath` ignore cette barre.
   */
  const isImmersive = isSamePath(pathname, '/player') || isSamePath(pathname, '/welcome');

  // Fait suivre le défilement horizontal quand on navigue à la télécommande.
  // Monté ici une seule fois : couvre toutes les rangées de l'application.
  useFocusScroll();

  // Applique le thème choisi (clair, sombre, ou suivi du système).
  useTheme();

  // Applique l'effet de verre dépoli. Sans choix explicite de
  // l'utilisateur, il est actif partout sauf sur téléviseur, où le flou
  // coûte trop cher en fluidité. `isReady` évite d'agir avant que la
  // détection d'appareil ait réellement eu lieu.
  useGlass(isTV, isReady);

  // Applique le réglage des animations. Sans choix explicite, il suit le
  // réglage système « réduire les animations », puis le type d'appareil.
  useAnimations(isTV, isReady);

  // Recharge le catalogue enregistre dans IndexedDB. Sans cela, chaque
  // rechargement de page repartait d'un catalogue vide et imposait une
  // resynchronisation manuelle. Monte ici pour ne se declencher qu'une
  // seule fois, quelle que soit la page ouverte en premier.
  useCatalogRestore();

  // Aligne <html lang> et <html dir> sur la langue choisie. `dir` retourne
  // toute la mise en page pour l'arabe ; `lang` sert aux lecteurs d'écran.
  useLocaleDocument();

  // Envoie vers /welcome tant que le parcours de premier lancement n'a
  // pas ete suivi. Monte ici pour couvrir les seize routes d'un coup.
  useOnboardingRedirect();

  return (
    <ParentalProvider>
      {/* Lien d'évitement : invisible tant qu'il n'a pas le focus, il
          permet de sauter le menu au lieu de le parcourir entièrement
          à chaque page. Première cible atteinte à la télécommande. */}
      <a
        href="#contenu-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-accent focus:text-[color:var(--on-accent)] focus:font-semibold"
      >
        Aller au contenu principal
      </a>

      <div className="flex h-screen w-full overflow-hidden">
        {/* Sidebar – hidden on mobile (uses drawer instead) */}
        

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Navigation principale horizontale */}
          {!isImmersive && <TopBar />}

          {/* Page content */}
          <main
            id="contenu-principal"
            tabIndex={-1}
            className={
              isImmersive
                ? 'flex-1 overflow-hidden'
                : 'flex-1 overflow-y-auto overflow-x-hidden pb-28 lg:pb-0'
            }
          >
            {children}
          </main>
        </div>
      </div>

      {!isImmersive && <BottomNav />}

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          // Les couleurs passent par les jetons CSS pour que la notification
          // suive le theme : figee en sombre, elle restait noire sur une
          // interface claire. `var()` est resolu par le navigateur au moment
          // de l'affichage, donc la bascule est immediate.
          style: {
            background: 'var(--surface-3)',
            color: 'var(--color-white)',
            border: '1px solid var(--line)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: 'var(--accent)',
              secondary: 'var(--on-accent)',
            },
          },
        }}
      />
    </ParentalProvider>
  );
}
