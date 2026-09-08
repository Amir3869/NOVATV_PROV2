/**
 * Insets des barres système (Android téléphone / tablette).
 *
 * `viewport-fit: cover` fait passer la WebView sous la barre d'état et
 * la barre de navigation Samsung. `env(safe-area-inset-*)` y vaut
 * souvent 0 : sans plancher, le header passe sous l'heure / le wifi,
 * et Terminer / Retour passent sous ○ / III.
 *
 * Sur téléviseur (Firestick) on ne pose PAS ce plancher : pas de barre
 * 3 boutons, un padding fictif laisserait un bandeau vide.
 *
 * La classe `html.android-phone` est posée avant le premier affichage
 * (script de `layout.tsx`). La regex TV doit rester alignée avec
 * `detectTV()` dans `useDeviceType.ts`.
 */

/** Plancher barre d'état Samsung (heure, wifi, notifications), en px. */
export const ANDROID_PHONE_SAFE_TOP_MIN_PX = 40;

/** Plancher barre 3 boutons Samsung, en px. */
export const ANDROID_PHONE_SAFE_BOTTOM_MIN_PX = 48;

const TV_UA =
  /\b(AFT[A-Z0-9]{1,5}|Android\s?TV|GoogleTV|Google TV|SMART-TV|SmartTV|Tizen|Web0S|WebOS|BRAVIA|HbbTV|NetCast|Philips.*TV|VIDAA|Roku)\b/i;

/** Téléphone ou tablette Android, pas une box TV. */
export function isAndroidPhoneAgent(ua: string): boolean {
  if (!/Android/i.test(ua)) return false;
  if (TV_UA.test(ua)) return false;
  return true;
}
