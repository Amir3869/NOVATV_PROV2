# NOVA TV — Documentation générale

> Document de référence technique et produit. Il décrit l'état réel du repository, puis distingue clairement les évolutions prévues.
>
> Dernière mise à jour documentaire : 15 septembre 2026
> Commit audité : `6b08ec8`
> Documents associés : `README.md`, `PROGRESSION.md`, `package.json`

---

## 1. Vision du produit

### 1.1 Positionnement

**NOVA TV est un lecteur IPTV local.** L'utilisateur apporte sa propre source Xtream Codes ou M3U. NOVA TV organise les chaînes, films, séries et programmes EPG dans une interface orientée streaming.

Le produit public est nommé :

```text
NOVA TV — lecteur IPTV
```

NOVA TV ne fournit aucun catalogue éditorial, ne vend pas d'abonnement IPTV, ne relaie pas les flux et ne possède pas actuellement de service de compte en ligne.

### 1.2 Cibles

Les cibles prioritaires sont :

1. téléphone Android ;
2. Android TV / Google TV ;
3. Firestick / Fire TV.

Le Web sert principalement au développement et à la vitrine. Il permet de visualiser l'interface et de tester le code, mais le produit final visé est l'APK Android.

Une suite est envisagée pour :

- Samsung Tizen ;
- iPhone/iPad ;
- Apple TV ;
- éventuellement d'autres plateformes TV.

Ces plateformes ne font pas partie de l'implémentation actuelle.

### 1.3 Utilisateurs

Le produit vise un foyer pouvant partager un même appareil entre plusieurs profils :

- profils adultes ;
- profils enfants ;
- favoris distincts ;
- historique et reprise de lecture ;
- contrôle parental local.

L'accès à un profil adulte doit être protégé par un PIN parental global.

---

## 2. État réel au 15 septembre 2026

Le repository est un prototype avancé en pré-production. Les sources, le stockage, le player Web et l'intégration Android sont présents.

La production n'est pas encore validée car plusieurs points restent à tester sur des sources et des appareils réels.

### 2.1 Validations automatisées observées

| Validation | Résultat de l'audit |
|---|---|
| `npm run typecheck` | Réussi |
| `npm run build` | Réussi, export statique généré |
| `npm run lint` | Échec : 5 erreurs React Compiler et 1 avertissement |
| `npm test -- --reporter=dot` | 828 tests réussis, 1 échec |
| `npm ci` | Échec, lockfile désynchronisé |

Les validations ont été exécutées avec Node `20.20.2`, alors que `package.json` exige Node `>=22.0.0`. Une validation de release doit être rejouée avec Node 22 ou supérieur.

### 2.2 Éléments non démontrables par le repository

> **Non vérifié :** Firestick, Android TV, télécommande, APK release signé, fournisseurs IPTV réels, compatibilité CORS, codecs, DRM, interruption réseau prolongée, performances GPU et catalogues de très grande taille.

---

## 3. Périmètre fonctionnel actuel

### 3.1 Présent dans le code

- onboarding ;
- sources Xtream Codes ;
- sources M3U ;
- EPG/XMLTV ;
- sélection de catégories ;
- synchronisation avec progression ;
- annulation de certaines opérations ;
- TV DIRECT ;
- FILMS ;
- SERIES ;
- saisons et épisodes ;
- player Web ;
- player VOD natif Android ;
- profils ;
- PIN local ;
- favoris ;
- historique ;
- reprise de lecture ;
- listes personnalisées ;
- recherche ;
- thèmes ;
- traduction custom ;
- pages légales ;
- paramètres.

### 3.2 Partiel ou à stabiliser

- sécurité réelle des secrets ;
- isolation de la reprise par profil ;
- demande de PIN vers un profil adulte ;
- recherche tolérante aux fautes ;
- synchronisation sur sources réelles ;
- reconnexion streaming ;
- player natif après commandes rapprochées ;
- catalogue volumineux ;
- EPG réel ;
- navigation TV ;
- design global ;
- états et messages multilingues ;
- compatibilité Firestick et Android TV.

### 3.3 Absent ou hors périmètre actuel

- backend NOVA TV ;
- compte en ligne ;
- synchronisation multi-appareils ;
- DRM ;
- téléchargement hors ligne ;
- Chromecast ;
- AirPlay ;
- Samsung Tizen ;
- application iOS finalisée ;
- application Apple TV ;
- licence premium active ;
- proxy vidéo ou relais de flux.

---

## 4. Stack réellement utilisée

| Domaine | Implémentation actuelle |
|---|---|
| Framework | Next.js `16.2.6` App Router |
| Rendu | Export statique avec `output: 'export'` |
| Langage | TypeScript `5.9.3` strict |
| UI | React `19.2.6` |
| Styles | Tailwind CSS `4.1.17` et CSS global |
| État | Zustand `5.0.15` |
| Base locale | IndexedDB custom, sans Dexie |
| Persistance secondaire | Zustand persist dans localStorage |
| Player Web | hls.js `1.7.1`, mpegts.js `1.8.2`, `<video>` |
| Player Android | Media3/ExoPlayer `1.5.1` |
| Empaquetage | Capacitor `8.5.0` |
| Tests | Vitest `4.1.11` |
| Recherche | Filtrage local, Fuse.js déclaré mais non branché |
| Traductions | Système custom, pas i18next |
| Virtualisation | `VirtualGrid` interne, pas React Virtual |

### 4.1 Dépendances à réévaluer

Une analyse statique a identifié des dépendances déclarées mais non importées directement par l'application, notamment :

- `date-fns` ;
- `framer-motion` ;
- `fuse.js` ;
- plusieurs paquets Radix.

Elles devront être conservées uniquement si un usage concret est décidé.

---

## 5. Architecture applicative

### 5.1 Routes

```text
/                       Accueil
/welcome                Onboarding
/playlists              Sources et synchronisation
/live                   TV DIRECT
/movies                 Films
/series                 Séries
/player                 Player
/profiles               Profils
/favorites              Favoris
/history                Historique
/search                 Recherche
/epg                    Guide des programmes
/lists                  Listes personnalisées
/settings               Réglages
/legal/licenses         Licences
/legal/privacy          Confidentialité
/legal/terms            Conditions
```

Les fiches dynamiques utilisent des paramètres de requête car les identifiants de contenus ne sont connus qu'après synchronisation :

```text
/movies?id=...
/series?id=...
/live?id=...
/player?type=live&id=...
```

### 5.2 Dossiers principaux

```text
src/app/                  Entrées de routes
src/features/             Fonctionnalités et pages métier
src/design-system/        Composants UI partagés
src/services/             Services métier
src/store/                Store Zustand
src/lib/                  Stockage et utilitaires
src/hooks/                Hooks partagés
src/types/                Modèle de domaine
android/                  Projet Capacitor Android
```

### 5.3 Absence de backend

Il n'existe pas actuellement :

- de route API NOVA TV ;
- de serveur applicatif ;
- de base distante ;
- de compte utilisateur ;
- de proxy de contenu.

Les appels aux fournisseurs IPTV partent directement depuis l'application. Sur Android, la configuration Capacitor déclare l'utilisation des capacités natives nécessaires aux requêtes, mais les mécanismes CORS et vidéo doivent encore être validés sur les fournisseurs réels.

---

## 6. Stockage et modèle de données

### 6.1 IndexedDB

Fichier :

```text
src/lib/catalogStore.ts
```

Configuration actuelle :

```text
Base : novatv-catalog
Version : 1
Store : catalog
Clé : current
```

L'enregistrement contient :

- chaînes ;
- catégories live ;
- films ;
- séries ;
- saisons ;
- épisodes ;
- programmes EPG.

Le catalogue est chargé en mémoire et réécrit intégralement lors des sauvegardes planifiées.

Ce modèle est simple et adapté à la première stabilisation, mais il devra être mesuré avec de très gros catalogues.

### 6.2 localStorage et Zustand

La clé principale est :

```text
novatv-storage
```

Elle contient notamment :

- profils ;
- sources ;
- préférences ;
- favoris ;
- historique ;
- progression ;
- listes ;
- organisation des catégories ;
- verrous parentaux ;
- état d'onboarding.

### 6.3 Secrets

`src/lib/secureStore.ts` fournit une abstraction de stockage des secrets. Le backend actuel écrit cependant les valeurs dans `localStorage` en clair.

Cette abstraction devra être conservée afin de pouvoir remplacer le backend par un mécanisme Android sécurisé, idéalement basé sur le Keystore, sans réécrire les écrans.

### 6.4 PIN parental

`src/lib/pin.ts` hache les PIN avec PBKDF2 lorsque Web Crypto est disponible. Un fallback moins robuste existe pour les environnements sans `crypto.subtle`.

Décision fonctionnelle :

```text
Un PIN parental global protège l'accès aux profils adultes.
```

Le changement de profil devra vérifier le PIN avant d'activer un profil adulte.

---

## 7. Sources IPTV

### 7.1 Xtream Codes

Fichiers principaux :

```text
src/services/xtream/xtreamService.ts
src/services/xtream/xtreamSync.ts
src/services/xtream/xtreamCredentials.ts
```

Le service gère notamment :

- URL serveur ;
- identifiant ;
- mot de passe ;
- catégories live ;
- chaînes ;
- catégories VOD ;
- films ;
- séries ;
- détails film ;
- détails série ;
- épisodes ;
- EPG court ;
- délais réseau ;
- annulation ;
- erreurs utilisateur.

Les identifiants Xtream sont transmis dans les URLs imposées par l'API du fournisseur. Ils peuvent également apparaître dans les URLs de flux.

### 7.2 M3U

Fichiers principaux :

```text
src/services/m3u/m3uParser.ts
src/services/m3u/m3uSync.ts
```

Le parser et la synchronisation sont présents et testés unitairement.

Points restant à valider :

- grande liste réelle ;
- URL HTTP ;
- URL HTTPS ;
- fichier local ;
- catégories atypiques ;
- logos défaillants ;
- interface pendant l'import ;
- interruption et reprise.

### 7.3 EPG

Fichiers principaux :

```text
src/services/epg/epgService.ts
src/services/epg/epgSync.ts
src/features/epg/EPGPage.tsx
src/services/player/playerEpg.ts
```

Le code prévoit l'association entre programmes et chaînes, mais l'EPG réel, les fuseaux horaires et les formats atypiques restent à tester.

### 7.4 HTTP et HTTPS

NOVA TV accepte les sources HTTP et HTTPS.

- HTTPS chiffre les échanges ;
- HTTP reste nécessaire pour certains fournisseurs IPTV ;
- l'interface ne bloque pas HTTP ;
- aucun avertissement utilisateur n'est actuellement retenu comme exigence ;
- la documentation conserve néanmoins la distinction de sécurité.

---

## 8. Player vidéo

### 8.1 Player Web

Fichiers principaux :

```text
src/features/player/PlayerPage.tsx
src/features/player/useVideoPlayer.ts
src/services/player/playbackEngine.ts
```

Le player gère :

- HLS ;
- MPEG-TS ;
- événements vidéo ;
- chargement ;
- buffering ;
- erreurs ;
- play/pause ;
- volume ;
- seek ;
- qualité ;
- audio ;
- sous-titres ;
- progression ;
- reprise ;
- EPG ;
- zapping ;
- épisode suivant.

### 8.2 Player Android

Fichiers principaux :

```text
src/services/player/nativeVodPlayer.ts
android/app/src/main/java/com/novatv/player/NativeVodPlayerPlugin.java
android/app/src/main/java/com/novatv/player/MainActivity.java
```

La VOD Android utilise ExoPlayer/Media3 avec une surface native placée sous la WebView. Le direct reste piloté par le player Web.

Une course potentielle existe entre la résolution de `play()` et l'initialisation du player sur le thread UI. Ce point doit être testé puis sécurisé.

### 8.3 Non vérifié

- codecs réels ;
- AC-3/E-AC-3 sur plusieurs appareils ;
- reprise après interruption réseau ;
- Firestick ;
- Android TV ;
- changement rapide de média ;
- commandes simultanées ;
- DRM.

---

## 9. Design et expérience utilisateur

La prochaine phase est une refonte globale Design + UX + UI.

Elle ne se limite pas au player ou à quatre pages. Elle couvre :

- barre de navigation ;
- navigation générale ;
- boutons ;
- cartes ;
- catégories ;
- recherche ;
- réglages ;
- profils ;
- sources ;
- onboarding ;
- TV DIRECT ;
- FILMS ;
- SERIES ;
- EPG ;
- player ;
- favoris ;
- historique ;
- listes ;
- états de chargement, erreur et vide ;
- responsive ;
- focus et télécommande.

### 9.1 Cohérence TV DIRECT / FILMS / SERIES

Ces pages doivent partager :

- une hiérarchie commune ;
- une toolbar cohérente ;
- des conventions de catégories ;
- des cartes adaptées au type de contenu ;
- les mêmes actions principales ;
- les mêmes états ;
- une navigation similaire ;
- une logique cohérente de favoris et de reprise.

Elles conservent leurs spécificités :

- TV DIRECT : chaînes, EPG et zapping ;
- FILMS : affiches, métadonnées, lecture et films similaires ;
- SERIES : saisons, épisodes, reprise et progression.

### 9.2 Méthode design

Avant de modifier le code :

1. analyser les composants existants ;
2. définir les problèmes UX ;
3. proposer plusieurs directions visuelles ;
4. générer des images de suggestion ;
5. choisir une direction ;
6. établir une mini-charte UI ;
7. modifier le design system ;
8. implémenter écran par écran ;
9. tester mobile, TV et télécommande.

---

## 10. Plateformes

| Plateforme | Rôle | État |
|---|---|---|
| Web | Développement et vitrine | Présent |
| Téléphone Android | Priorité | Projet Capacitor présent, validation reproductible à documenter |
| Android TV | Priorité | À tester sur appareil réel |
| Firestick | Priorité | À tester sur appareil réel |
| Samsung Tizen | Suite | Non implémenté |
| iOS/iPadOS | Suite | Non implémenté comme produit final |
| Apple TV | Suite | Projet natif distinct à étudier |
| LG webOS | Hors périmètre actuel | Non ciblé |

La présence du dossier Android et des plugins natifs ne constitue pas à elle seule une validation de la compatibilité TV.

---

## 11. Sécurité

Les risques prioritaires identifiés sont :

- secrets Xtream en clair dans localStorage ;
- `allowBackup=true` ;
- debugging WebView activé dans la configuration actuelle ;
- cleartext et mixed content autorisés ;
- headers de sécurité déclarés mais non branchés dans l'export statique ;
- credentials présents dans des URLs de fournisseurs ;
- fallback PIN moins robuste ;
- absence de backend central pour révoquer ou protéger les secrets.

Ces points sont à traiter avant une distribution publique, tout en maintenant la compatibilité avec les fournisseurs HTTP lorsque nécessaire.

---

## 12. Tests et qualité

### 12.1 Tests actuels

Les tests Vitest couvrent notamment :

- catalogue ;
- synchronisation Xtream ;
- synchronisation M3U ;
- EPG ;
- player ;
- profils ;
- PIN ;
- listes ;
- organisation des catégories ;
- onboarding.

### 12.2 Défauts connus

- lint rouge dans `PlayerPage.tsx` ;
- avertissement de dépendance dans `useVideoPlayer.ts` ;
- test rouge dans `sourceIdentity.test.ts` ;
- lockfile désynchronisé ;
- validation exécutée avec Node 20 au lieu de Node 22+ ;
- absence de suite E2E complète ;
- absence de tests appareils réels versionnés dans le repository.

### 12.3 Qualité attendue avant release

```text
TypeScript vert
Lint vert
Tests unitaires verts
Build statique reproductible
E2E critiques verts
APK release reproductible
Validation téléphone Android
Validation Android TV
Validation Firestick
Validation télécommande
Documentation à jour
```

---

## 13. Méthode de travail du projet

Le flux de travail retenu est :

```text
Comprendre
→ auditer
→ planifier
→ valider la proposition
→ modifier
→ tester en local
→ vérifier
→ livrer les fichiers modifiés
→ commit
→ push
```

Lorsqu'un fichier sera livré :

1. le fichier principal sera ouvert dans le workspace ;
2. les autres fichiers modifiés seront listés ;
3. les éventuels fichiers créés ou supprimés seront indiqués ;
4. les commandes Windows/VS Code nécessaires seront fournies ;
5. les validations locales effectuées seront indiquées.

Aucun commit ou push ne doit être effectué sans accord explicite.

---

## 14. Décisions actuelles

| Date | Décision |
|---|---|
| 15/09/2026 | Nom public : NOVA TV — lecteur IPTV |
| 15/09/2026 | Web limité au développement et à la vitrine |
| 15/09/2026 | Priorités : téléphone Android, Android TV, Firestick |
| 15/09/2026 | HTTP et HTTPS acceptés pour compatibilité IPTV |
| 15/09/2026 | Pas d'avertissement HTTP obligatoire dans l'interface |
| 15/09/2026 | PIN parental global pour accéder aux profils adultes |
| 15/09/2026 | Design et UX/UI avant les travaux de stabilisation suivants |
| 15/09/2026 | M3U réel avant Xtream réel pour les validations |
| 15/09/2026 | Samsung Tizen et iOS après la cible Android |

---

## 15. Points non vérifiés

- APK release signé ;
- Firestick ;
- Android TV ;
- télécommande ;
- fournisseurs IPTV réels ;
- CORS ;
- codecs et DRM ;
- interruption réseau ;
- performance de très gros catalogues ;
- sauvegarde et restauration Android ;
- publication dans les stores ;
- efficacité réelle des headers de sécurité ;
- validation visuelle finale du nouveau design.
