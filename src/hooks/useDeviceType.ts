'use client';

import { useSyncExternalStore } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'tv';
export type Orientation = 'portrait' | 'landscape';

interface DeviceInfo {
  deviceType: DeviceType;
  orientation: Orientation;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTV: boolean;
  width: number;
  height: number;
  hasTouch: boolean;
  hasHover: boolean;
  prefersReducedMotion: boolean;
  /**
   * `false` tant que la détection réelle n'a pas eu lieu (premier rendu
   * serveur et hydratation). Permet à un composant d'éviter d'afficher
   * une mise en page provisoire fausse.
   */
  isReady: boolean;
}

/**
 * Détecte un téléviseur ou un boîtier TV.
 *
 * L'ancienne règle était « largeur >= 1920 donc TV ». Elle est fausse
 * dans les deux sens :
 *   - un PC en 1920x1080 ou un écran 4K était traité comme un téléviseur ;
 *   - un Fire TV Stick, dont la WebView rapporte souvent 960 ou 1280
 *     points CSS, ne l'était pas — alors que c'est la cible principale.
 *
 * On interroge donc l'identifiant du navigateur, qui nomme explicitement
 * ces appareils, et on complète par une vérification de pointeur : un
 * téléviseur piloté à la télécommande n'a ni souris ni écran tactile.
 */
function detectTV(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;

  // AFT* = Amazon Fire TV (AFTMM, AFTKA, AFTSS, AFTT...).
  // Chaque modèle a son propre code, d'où le préfixe générique.
  const knownTvAgents =
    /\b(AFT[A-Z0-9]{1,5}|Android\s?TV|GoogleTV|Google TV|SMART-TV|SmartTV|Tizen|Web0S|WebOS|BRAVIA|HbbTV|NetCast|Philips.*TV|VIDAA|Roku)\b/i;

  if (knownTvAgents.test(ua)) return true;

  // Repli : télécommande = aucun pointeur précis ni survol possible.
  // Sur un téléphone, `pointer: coarse` est vrai mais `any-pointer: fine`
  // reste faux ; on écarte donc le tactile explicitement.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const noPointer = window.matchMedia('(pointer: none)').matches;
    const noHover = window.matchMedia('(hover: none)').matches;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (noPointer && noHover && !hasTouch && window.innerWidth >= 960) return true;
  }

  return false;
}

function getDeviceType(width: number): DeviceType {
  if (detectTV()) return 'tv';
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

function getOrientation(width: number, height: number): Orientation {
  return width >= height ? 'landscape' : 'portrait';
}

/**
 * Valeur utilisée pour le rendu serveur ET le premier rendu client.
 *
 * Elle doit être identique des deux côtés : si le HTML produit par le
 * serveur diffère de celui calculé par le navigateur à l'hydratation,
 * React signale une erreur et peut réafficher toute la page.
 * C'est pourquoi on ne lit jamais `window` à l'initialisation de l'état.
 */
const SSR_DEFAULT: DeviceInfo = {
  deviceType: 'desktop',
  orientation: 'landscape',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTV: false,
  width: 1280,
  height: 720,
  hasTouch: false,
  hasHover: true,
  prefersReducedMotion: false,
  isReady: false,
};

function readDeviceInfo(): DeviceInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const deviceType = getDeviceType(width);
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTV = deviceType === 'tv';

  return {
    deviceType,
    orientation: getOrientation(width, height),
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isTV,
    width,
    height,
    hasTouch,
    hasHover: !hasTouch && !isTV,
    prefersReducedMotion,
    isReady: true,
  };
}

/**
 * ---------------------------------------------------------------------
 * Réservoir partagé (« store »)
 * ---------------------------------------------------------------------
 *
 * La taille de la fenêtre n'appartient pas à React : c'est une donnée du
 * navigateur qui change toute seule. React fournit une fonction faite
 * pour ce cas précis, `useSyncExternalStore`. Elle demande trois choses :
 *
 *   1. subscribe   — comment prévenir React que la valeur a changé ;
 *   2. getSnapshot — la valeur actuelle, côté navigateur ;
 *   3. getServerSnapshot — la valeur à utiliser côté serveur.
 *
 * Deux avantages sur l'ancien couple useState + useEffect :
 *
 *   - React lit la vraie taille dès le premier rendu client, sans
 *     repasser par un second rendu (plus de « cascade de rendus », que
 *     le linter React signalait à juste titre) ;
 *   - un seul jeu d'écouteurs est partagé par tous les composants qui
 *     appellent le hook, au lieu d'un jeu par composant.
 *
 * Point important : `getSnapshot` doit renvoyer le MÊME objet tant que
 * rien n'a changé. Si on recalculait un objet neuf à chaque appel, React
 * le verrait comme différent et boucherait à l'infini. D'où le cache
 * `cachedInfo`, remplacé uniquement quand une valeur utile a bougé.
 */

let cachedInfo: DeviceInfo = SSR_DEFAULT;
let isSubscribed = false;

const listeners = new Set<() => void>();

function sameInfo(a: DeviceInfo, b: DeviceInfo): boolean {
  return (
    a.deviceType === b.deviceType &&
    a.orientation === b.orientation &&
    a.width === b.width &&
    a.height === b.height &&
    a.hasTouch === b.hasTouch &&
    a.prefersReducedMotion === b.prefersReducedMotion &&
    a.isReady === b.isReady
  );
}

function refresh(): void {
  const next = readDeviceInfo();
  if (sameInfo(cachedInfo, next)) return;
  cachedInfo = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  // Les écouteurs du navigateur ne sont posés qu'une fois, au premier
  // abonné, et retirés au départ du dernier. L'ancienne version oubliait
  // de retirer celui de matchMedia : à chaque montage de composant un
  // écouteur de plus restait actif et retenait l'ancien composant en
  // mémoire. Invisible sur un PC, pénalisant sur un Firestick laissé
  // allumé plusieurs heures.
  if (!isSubscribed) {
    isSubscribed = true;
    cachedInfo = readDeviceInfo();

    let frame = 0;
    const update = () => {
      // Un redimensionnement émet des dizaines d'événements par seconde.
      // On ne recalcule qu'une fois par image affichée.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    };

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerQuery = window.matchMedia('(pointer: none)');

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    motionQuery.addEventListener('change', update);
    pointerQuery.addEventListener('change', update);

    teardown = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      motionQuery.removeEventListener('change', update);
      pointerQuery.removeEventListener('change', update);
      isSubscribed = false;
      teardown = null;
    };
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) teardown?.();
  };
}

let teardown: (() => void) | null = null;

function getSnapshot(): DeviceInfo {
  // Avant le premier abonnement (rendu initial), on renvoie la valeur
  // par défaut : identique à celle du serveur, donc pas de désaccord
  // d'hydratation.
  return isSubscribed ? cachedInfo : SSR_DEFAULT;
}

function getServerSnapshot(): DeviceInfo {
  return SSR_DEFAULT;
}

export function useDeviceType(): DeviceInfo {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useResponsiveValue<T>(values: {
  mobile?: T;
  tablet?: T;
  desktop?: T;
  tv?: T;
  default: T;
}): T {
  const { deviceType } = useDeviceType();
  return (values[deviceType] ?? values.default) as T;
}

export function useGridColumns(): number {
  const { deviceType } = useDeviceType();
  const map: Record<DeviceType, number> = {
    mobile: 2,
    tablet: 3,
    desktop: 5,
    // Sur téléviseur on affiche MOINS de colonnes, pas plus :
    // l'écran est grand mais regardé à 3 mètres. Les vignettes doivent
    // donc être plus grandes, et chaque déplacement de la télécommande
    // doit rester lisible.
    tv: 5,
  };
  return map[deviceType];
}
