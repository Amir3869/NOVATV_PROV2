# NOVA TV — lecteur IPTV

**NOVA TV** est un lecteur IPTV local : l'utilisateur connecte sa propre source Xtream Codes ou M3U, puis retrouve ses chaînes, films, séries et programmes EPG dans une interface pensée pour Android.

NOVA TV ne fournit aucun contenu, ne vend aucun abonnement et ne relaie aucun flux par un serveur appartenant au projet. L'utilisateur est responsable des sources qu'il ajoute et de leur légalité.

> **Important :** le Web sert au développement et à la vitrine. Le produit cible est l'application Android distribuée dans un APK.

---

## État réel du projet

Le repository correspond à un **prototype avancé en pré-production**. Il ne s'agit plus d'une simple maquette : les services de synchronisation, le stockage local, le player Web et l'intégration Android sont présents.

L'application n'est toutefois pas encore déclarée prête pour une diffusion publique. Les validations sur fournisseurs IPTV réels, Firestick, Android TV, télécommande, codecs et APK release doivent encore être formalisées.

État audité le 15 septembre 2026 :

- branche : `main` ;
- commit audité : `6b08ec8` ;
- `npm run typecheck` : réussi lors de l'audit ;
- `npm run build` : réussi, export statique généré ;
- `npm run lint` : 5 erreurs React Compiler dans `PlayerPage.tsx` et 1 avertissement dans `useVideoPlayer.ts` ;
- tests : 828 réussis sur 829, avec un échec dans `sourceIdentity.test.ts` ;
- `npm ci` : impossible tant que `package.json` et `package-lock.json` restent désynchronisés ;
- validation officielle : Node.js 22 ou supérieur requis.

Les résultats ci-dessus ont été obtenus avec Node `20.20.2`, qui ne respecte pas encore la contrainte du projet. Ils doivent être rejoués avec Node 22+ avant une validation de release.

---

## Démarrage

### Prérequis

- Node.js `>=22.0.0` ;
- npm ;
- Android Studio uniquement pour construire ou synchroniser l'APK ;
- une source IPTV dont l'utilisation est autorisée pour les tests.

### Installation

Le lockfile doit d'abord être réaligné avec `package.json`. Tant que ce n'est pas fait, `npm ci` peut échouer.

```bash
npm ci
```

### Commandes disponibles

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run cap:sync
npm run cap:open
```

Le serveur de développement est destiné à l'aperçu Web. Le build statique est exporté dans `out/` pour Capacitor.

---

## Architecture réelle

```text
src/app/                  Routes Next.js App Router
src/features/             Écrans et logique métier par domaine
src/design-system/        Composants réutilisables et tokens UI
src/services/             Xtream, M3U, EPG, catalogue et player
src/store/                État applicatif Zustand
src/lib/                  Stockage, PIN, noms et utilitaires
src/hooks/                Hooks React et plateforme
src/types/                Modèles TypeScript
android/                  Projet Capacitor Android
```

Flux de données :

```text
Interface
   ↓
Zustand
   ├── localStorage : profils, sources, favoris, historique,
   │                  préférences et listes
   └── IndexedDB : catalogue et EPG
          ↓
Services Xtream / M3U / XMLTV
          ↓
Player Web ou ExoPlayer natif Android
```

L'application est exportée statiquement avec Next.js : il n'existe actuellement ni backend NOVA TV, ni route API, ni base distante.

---

## Routes disponibles

```text
/                       Accueil
/welcome                Onboarding
/playlists              Sources IPTV et synchronisation
/live                   TV DIRECT
/movies                 Films et fiches film via query string
/series                 Séries, saisons et épisodes
/player                 Player via query string
/profiles               Profils
/favorites              Favoris
/history                Historique et reprises
/search                 Recherche
/epg                    Guide des programmes
/lists                  Listes personnalisées
/settings               Réglages
/legal/licenses         Licences
/legal/privacy          Confidentialité
/legal/terms            Conditions d'utilisation
```

Les contenus utilisent des paramètres d'URL, par exemple :

```text
/player?type=live&id=...
/player?type=movie&id=...
/player?type=episode&id=...
```

---

## Fonctionnalités présentes

### Sources et catalogue

- Xtream Codes ;
- M3U distant ou local selon le parcours ;
- catégories ;
- chaînes ;
- films ;
- séries ;
- saisons et épisodes ;
- EPG/XMLTV ;
- sélection de catégories ;
- progression d'import ;
- annulation de certaines synchronisations ;
- gestion de délais et d'erreurs réseau.

### Navigation et contenu

- TV DIRECT avec catégories, favoris, récents et EPG ;
- FILMS avec rails, grille, liste, recherche et fiches détaillées ;
- SERIES avec rails, reprise, saisons et épisodes ;
- recherche locale ;
- favoris ;
- historique ;
- listes personnalisées ;
- reprise de lecture ;
- renommage et organisation de catégories ;
- profils multiples ;
- thèmes clair et sombre ;
- traductions custom FR/EN/ES et éléments arabes présents.

### Player

- player Web basé sur `<video>`, `hls.js` et `mpegts.js` ;
- ExoPlayer/Media3 natif pour la VOD Android ;
- play/pause, volume, mute et seek ;
- reprise VOD ;
- qualité HLS lorsqu'elle est exposée ;
- pistes audio et sous-titres lorsque le moteur les expose ;
- EPG ;
- zapping ;
- épisode suivant ;
- vitesse ;
- sleep timer ;
- verrouillage des contrôles ;
- mode immersif et maintien de l'écran actif.

---

## Fonctionnalités partielles ou à valider

- fonctionnement avec des portails Xtream réels ;
- import M3U de grande taille ;
- EPG réel et gestion des fuseaux ;
- reprise strictement isolée par profil ;
- contrôle parental au changement vers un profil adulte ;
- stockage sécurisé des mots de passe ;
- reconnexion après interruption réseau ;
- compatibilité des codecs et pistes audio ;
- player natif après enchaînement rapide de commandes ;
- navigation D-pad ;
- Firestick et Android TV ;
- performance sur catalogues de plusieurs dizaines de milliers d'entrées ;
- expérience complète avec télécommande.

---

## Stockage et sécurité

Le catalogue et l'EPG sont stockés dans une base IndexedDB custom :

```text
Base : novatv-catalog
Store : catalog
Enregistrement : current
```

Le reste de l'état applicatif est persisté dans `localStorage` via Zustand.

Le `secureStore` sépare les mots de passe Xtream de l'état principal, mais son backend actuel utilise `localStorage` en clair. Cette abstraction devra évoluer avant une diffusion publique.

Le PIN parental est haché avec PBKDF2 lorsque Web Crypto est disponible. Un fallback moins robuste existe pour les environnements qui ne fournissent pas `crypto.subtle`.

NOVA TV accepte les sources HTTP et HTTPS. HTTPS chiffre les échanges, mais certains fournisseurs IPTV ne proposent que HTTP. Le support HTTP est conservé pour la compatibilité, sans présenter HTTP comme un transport sécurisé.

Avant une release publique, les points suivants doivent être traités :

- stockage des secrets ;
- sauvegarde Android ;
- debugging WebView ;
- cleartext et mixed content ;
- en-têtes de sécurité sur l'hébergement Web ;
- politique de logs ;
- exposition des credentials dans les URLs imposées par certains portails Xtream.

---

## Plateformes

| Plateforme | Rôle | État |
|---|---|---|
| Web | Développement et vitrine | Présent, visionnage non ciblé comme produit final |
| Téléphone Android | Produit prioritaire | Projet Capacitor et code natif présents |
| Android TV / Google TV | Produit prioritaire | À valider sur appareil et télécommande |
| Firestick / Fire TV | Produit prioritaire | À valider sur appareil réel |
| Samsung Tizen | Suite prévue | Non implémenté |
| iPhone / iPad | Suite prévue | Non implémenté comme produit final |
| Apple TV | Suite prévue | Projet natif distinct à étudier |
| LG webOS | Hors périmètre actuel | Non ciblé |

> **Non vérifié :** APK release signé, Firestick, Android TV, télécommande, codecs, DRM, CORS de fournisseurs réels et publication sur les stores.

---

## Design et prochaine phase

La prochaine phase est une refonte globale design et UX/UI avant les travaux de stabilisation plus profonds.

Elle couvrira :

- navigation principale ;
- barre de navigation ;
- boutons et composants ;
- TV DIRECT ;
- FILMS ;
- SERIES ;
- EPG ;
- player ;
- profils ;
- sources ;
- réglages ;
- favoris, historique et listes ;
- onboarding ;
- états de chargement, vide et erreur ;
- responsive mobile ;
- lecture et focus TV.

TV DIRECT, FILMS et SERIES doivent partager une logique de navigation cohérente : catégories, recherche, cartes, favoris, reprise, états et actions principales. Le contenu et les interactions spécifiques à chaque type restent distincts.

Les propositions visuelles seront générées et validées avant toute modification du code d'interface.

---

## Documentation du projet

- [`DOCUMENTATION.md`](./DOCUMENTATION.md) : vision, architecture réelle, périmètre et conventions ;
- [`PROGRESSION.md`](./PROGRESSION.md) : état actuel, validations, priorités et roadmap ;
- `package.json` : scripts, dépendances et contrainte Node ;
- `capacitor.config.ts` : configuration Capacitor ;
- `android/` : projet Android et plugins natifs.

---

## Licence et responsabilité

Projet privé. NOVA TV est un lecteur. L'utilisateur doit utiliser uniquement des sources auxquelles il est légalement autorisé à accéder.
