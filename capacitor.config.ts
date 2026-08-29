import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuration Capacitor — Nova TV
 *
 * Capacitor emballe l'application web (les fichiers figés produits par
 * `npm run build` dans le dossier `out/`) à l'intérieur d'une application
 * Android native. Concrètement : Android ouvre une « WebView » — un
 * navigateur sans barre d'adresse ni onglets, occupant tout l'écran — et
 * y charge nos fichiers depuis le stockage interne du téléphone ou de la
 * box, jamais depuis Internet.
 *
 * Conséquence importante : l'application fonctionne hors ligne par
 * construction. Seuls les flux vidéo et le guide des programmes vont
 * chercher le réseau.
 */
const config: CapacitorConfig = {
  /**
   * Identifiant unique de l'application sur tout l'écosystème Android.
   *
   * C'est la clé d'identité de l'APK : le Play Store, le système Android
   * et le lanceur de la TV s'en servent pour distinguer Nova TV de toute
   * autre application. Il est gravé dans l'APK à la compilation.
   *
   * ATTENTION — il est DÉFINITIF une fois l'application publiée. Le
   * changer plus tard équivaut à publier une application différente :
   * les utilisateurs ne recevraient pas la mise à jour et perdraient
   * leurs données. Le format est un nom de domaine inversé, en
   * minuscules, sans tiret ni accent.
   */
  appId: 'com.novatv.player',

  /**
   * Nom affiché sous l'icône, dans le lanceur et dans les réglages
   * Android. Contrairement à `appId`, il peut changer à tout moment.
   */
  appName: 'Nova TV',

  /**
   * Dossier contenant l'application web à embarquer.
   *
   * Doit correspondre à `distDir` dans `next.config.ts` — ici `out`.
   * Si les deux divergent, Capacitor copie un dossier vide et
   * l'application affiche une page blanche au démarrage.
   */
  webDir: 'out',

  /**
   * Copie automatiquement les fichiers web dans le projet Android à
   * chaque `cap sync`. Laissé à `false` : on préfère lancer la copie
   * explicitement, pour savoir précisément ce qui part dans l'APK.
   */
  android: {
    /**
     * Autorise la WebView à charger des ressources en HTTP simple
     * (non chiffré) alors que la page elle-même est servie en HTTPS.
     *
     * Indispensable ici : une grande partie des portails Xtream Codes
     * et des flux IPTV sont encore en `http://`. Sans cette option,
     * Android bloque silencieusement ces requêtes et l'utilisateur
     * voit un lecteur qui ne démarre jamais, sans message d'erreur.
     *
     * C'est un assouplissement de sécurité assumé : il est imposé par
     * les serveurs de l'utilisateur, que nous ne contrôlons pas.
     */
    allowMixedContent: true,

    /**
     * Désactive le débogage à distance de la WebView depuis Chrome.
     *
     * Passer à `true` temporairement permet d'inspecter la console de
     * l'application depuis `chrome://inspect` sur le PC — très utile
     * pour diagnostiquer un flux qui refuse de se lancer sur la
     * Firestick. À laisser sur `false` pour toute version distribuée.
     */
    webContentsDebuggingEnabled: false,
  },

  server: {
    /**
     * Protocole utilisé par la WebView pour servir les fichiers locaux.
     *
     * En `https`, l'application s'exécute dans un contexte dit
     * « sécurisé ». C'est une exigence d'Android pour autoriser
     * certaines fonctions du navigateur, et cela évite qu'un flux en
     * HTTP simple soit considéré comme venant de la même origine que
     * l'application.
     */
    androidScheme: 'https',
  },

  plugins: {
    /**
     * LE point décisif de cette configuration.
     *
     * Un navigateur interdit à une page d'appeler un serveur qui n'est
     * pas le sien, sauf si ce serveur l'autorise explicitement par des
     * en-têtes appelés CORS. Les portails Xtream Codes n'envoient jamais
     * ces en-têtes : ils n'ont pas été conçus pour être appelés depuis
     * un navigateur. Résultat, dans un navigateur classique, toute
     * requête vers `player_api.php` est bloquée — c'est une règle du
     * navigateur, pas un défaut de notre code.
     *
     * Activer CapacitorHttp remplace la fonction `fetch` du navigateur
     * par un appel HTTP natif Android, exécuté hors du navigateur. Sans
     * navigateur dans la boucle, la règle CORS ne s'applique plus.
     *
     * Le remplacement est transparent : `xtreamService`, `epgSync` et
     * `m3uSync` continuent d'appeler `fetch` sans modification. Aucune
     * ligne de code applicatif à changer.
     *
     * Limite connue : cette redirection ne concerne que `fetch` et
     * `XMLHttpRequest`. Elle ne s'applique PAS aux requêtes émises par
     * la balise <video>, ni par hls.js ou mpegts.js, qui utilisent leurs
     * propres mécanismes. Pour la lecture vidéo elle-même, c'est la
     * WebView Android qui décide — et elle est bien plus permissive que
     * Chrome sur poste de travail.
     */
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
