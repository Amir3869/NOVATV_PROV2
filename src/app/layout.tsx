import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { ClientLayout } from '@/features/layout/ClientLayout';

/**
 * Police Geist, servie depuis le paquet npm `geist`.
 *
 * L'import précédent passait par `next/font/google`, qui télécharge les
 * fichiers depuis les serveurs de Google au moment du build. Deux
 * problèmes : le proxy d'entreprise bloque `fonts.googleapis.com` (la
 * police n'était donc jamais appliquée, l'interface retombait sur la
 * police système), et l'application empaquetée en APK Fire TV doit
 * pouvoir démarrer sans réseau.
 *
 * Le paquet `geist` contient les fichiers `.woff2` en local : ils sont
 * copiés dans le bundle au build, plus aucun appel extérieur.
 * `GeistSans.variable` expose la variable CSS `--font-geist-sans`.
 */

export const metadata: Metadata = {
  title: {
    default: 'Nova TV — Lecteur IPTV premium',
    template: '%s · Nova TV',
  },
  description:
    'Lecteur premium pour vos sources IPTV. Connectez votre abonnement Xtream Codes ou votre fichier M3U et retrouvez vos contenus dans une interface moderne.',
  applicationName: 'Nova TV',
  // `manifest` décrit l'application aux systèmes d'exploitation :
  // nom, icônes, couleurs. Utilisé à l'installation sur l'écran d'accueil.
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  // L'application est un outil personnel, pas un site à indexer.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Colore la barre d'état du système avec l'accent Nova.
  themeColor: '#C8102E',
  width: 'device-width',
  initialScale: 1,
  // `viewportFit: cover` fait passer l'interface sous les encoches
  // et barres arrondies ; la classe .safe-area-pb protège le contenu.
  viewportFit: 'cover',
};

/**
 * Script exécuté avant le premier rendu, pour éviter le flash de thème.
 *
 * Le problème : la page HTML est produite sur le serveur, qui ignore le
 * thème choisi (il est enregistré dans le navigateur). Sans précaution,
 * l'application s'affiche en sombre, puis React démarre et repeint en
 * clair — un éclair blanc désagréable à chaque ouverture.
 *
 * La parade classique : un script court, exécuté avant l'affichage, qui
 * lit la préférence enregistrée et pose la bonne classe tout de suite.
 * Il est volontairement enveloppé dans un try/catch : si `localStorage`
 * est inaccessible (navigation privée stricte, cookies bloqués), on
 * retombe silencieusement sur le réglage système plutôt que de casser
 * la page.
 */
const themeInitScript = `
(function () {
  try {
    var theme = 'system';
    var raw = localStorage.getItem('novatv-storage');
    if (raw) {
      var saved = JSON.parse(raw);
      var t = saved && saved.state && saved.state.preferences && saved.state.preferences.theme;
      if (t === 'light' || t === 'dark' || t === 'system') theme = t;
    }
    var dark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    root.classList.add(dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';

    // Effet de verre : même parade que pour le thème. Sans cette ligne les
    // panneaux s'afficheraient floutés, puis deviendraient opaques dès que
    // React reprend la main — un clignotement visible à chaque ouverture.
    var glass = null;
    var g = saved && saved.state && saved.state.preferences
      && saved.state.preferences.glassEnabled;
    if (g === true || g === false) glass = g;

    // Sans choix explicite, on suit l'appareil : ni verre ni transitions
    // sur un téléviseur, où le flou recalculé à chaque image et les
    // transitions font saccader le défilement. Seule la détection par
    // user-agent est reprise ici, ce script devant rester minuscule et
    // s'exécuter avant tout affichage. Elle est volontairement plus
    // courte que detectTV() de useDeviceType, qui prendra le relais dès
    // que React démarre. (Pas de backtick dans ce commentaire : il
    // refermerait le gabarit JavaScript qui contient ce script.)
    var isTvAgent = /\\b(AFT[A-Z0-9]{1,5}|Android\\s?TV|GoogleTV|SMART-TV|SmartTV|Tizen|Web0S|WebOS|BRAVIA|HbbTV|NetCast|VIDAA|Roku)\\b/i.test(navigator.userAgent);

    var isAndroidPhone = /Android/i.test(navigator.userAgent) && !isTvAgent;
    if (glass === null) glass = !isTvAgent && !isAndroidPhone;
    if (!glass) root.setAttribute('data-glass', 'off');

    // Barres système Samsung : la WebView passe dessous (SDK 36).
    // Classe lue par globals.css (--safe-top / --safe-bottom).
    // Aligné sur isAndroidPhoneAgent() dans src/lib/safeArea.ts.
    if (/Android/i.test(navigator.userAgent) && !isTvAgent) {
      root.classList.add('android-phone');
    }

    // Animations : même parade anti-clignotement. Sans cette ligne, les
    // transitions joueraient pendant le premier affichage avant d'être
    // coupées — précisément ce qu'on cherche à éviter sur téléviseur.
    var motion = null;
    var m = saved && saved.state && saved.state.preferences
      && saved.state.preferences.animationsEnabled;
    if (m === true || m === false) motion = m;

    // Priorité : choix explicite, puis réglage système, puis appareil.
    if (motion === null) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        motion = false;
      } else {
        motion = !isTvAgent;
      }
    }
    root.setAttribute('data-motion', motion ? 'on' : 'off');

    // Langue déclarée du document. Sans cette ligne, <html lang> reste
    // figé à 'fr' : un lecteur d'écran prononcerait l'anglais avec
    // l'accent français, et le correcteur orthographique se tromperait
    // de dictionnaire.
    //
    // Le HTML étant pré-généré au build (output: 'export'), il ne peut
    // pas connaître la langue du visiteur. On la corrige donc ici,
    // avant le premier affichage.
    //
    // La liste des langues est recopiée à la main : ce script doit
    // rester autonome, il s'exécute avant tout module JavaScript et ne
    // peut donc pas importer LOCALES. À tenir en phase avec
    // src/i18n/types.ts en cas d'ajout d'une langue.
    var lang = null;
    var l = saved && saved.state && saved.state.preferences
      && saved.state.preferences.language;
    if (l === 'fr' || l === 'en' || l === 'es' || l === 'ar') lang = l;

    // Aucun choix enregistré : on devine d'après le système. Même
    // logique que detectLocale(), qui prendra le relais côté React.
    if (lang === null) {
      var tags = navigator.languages || [navigator.language || ''];
      for (var i = 0; i < tags.length; i++) {
        var base = String(tags[i]).toLowerCase().split('-')[0];
        if (base === 'fr' || base === 'en' || base === 'es' || base === 'ar') {
          lang = base;
          break;
        }
      }
    }
    root.lang = lang || 'fr';

    // L'attribut dir n'est pas posé ici : useLocaleDocument, monté dans
    // ClientLayout, s'en charge dès que React démarre. Ce script ne
    // traite que ce qui doit être juste AVANT le premier affichage.
    // (Pas de backtick dans ce commentaire : il vit dans un gabarit.)
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` : le script ci-dessus modifie la classe
    // et la langue de <html> avant que React ne prenne la main. React
    // constaterait sinon un écart entre le HTML reçu du serveur et ce
    // qu'il attend, et afficherait un avertissement. L'écart est ici
    // voulu et limité à ces attributs.
    //
    // `lang="fr"` reste la valeur de départ : c'est celle du HTML
    // pré-généré, corrigée par le script dès le premier affichage.
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/* Les couleurs viennent des jetons de `globals.css`, pas de classes
          figées : c'est ce qui permet au thème clair de s'appliquer. */}
      <body className={`${GeistSans.variable} font-sans antialiased`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
