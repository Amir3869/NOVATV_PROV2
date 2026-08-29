# NOVA TV — Documentation de référence

> Document de cadrage du projet. Il décrit **ce qu'on construit, pour qui, avec quoi et selon quelles règles**.
> Il est destiné à être lu par quelqu'un qui n'a pas encore le projet en tête : chaque notion technique y est expliquée.
>
> Documents liés :
> - [`AUDIT_NOVA_IPTV.md`](../AUDIT_NOVA_IPTV.md) — audit initial du dépôt. **Figé**, conservé comme référence de base.
> - [`PROGRESSION.md`](./PROGRESSION.md) — tableau de bord vivant : phases, tâches, décisions datées.
> - [`README.md`](./README.md) — démarrage rapide et commandes.

---

## Sommaire

1. [Vision](#1-vision)
2. [Utilisateur cible](#2-utilisateur-cible)
3. [Périmètre](#3-périmètre)
4. [Position juridique](#4-position-juridique)
5. [Stack technique](#5-stack-technique)
6. [Architecture locale](#6-architecture-locale)
7. [Modèle de données](#7-modèle-de-données)
8. [Lecture vidéo](#8-lecture-vidéo)
9. [Design system](#9-design-system)
10. [Navigation télécommande et accessibilité](#10-navigation-télécommande-et-accessibilité)
11. [Multilingue](#11-multilingue)
12. [Conventions de code](#12-conventions-de-code)
13. [Arborescence](#13-arborescence)
14. [Plateformes cibles](#14-plateformes-cibles)
15. [Glossaire](#15-glossaire)

---

## 1. Vision

**NOVA TV** est un lecteur IPTV haut de gamme. Concurrent direct d'**IPTV Smarters Pro**, avec une exigence visuelle du niveau de Netflix ou Disney+.

La différence tient en une phrase :

> On vend **un support de lecture**, pas un service vidéo.

L'utilisateur arrive avec **ses propres identifiants** (compte Xtream Codes ou fichier M3U fourni par son fournisseur). L'application ne fournit aucun contenu, n'héberge aucun flux, ne revend aucun abonnement.

C'est exactement le modèle de VLC : un lecteur puissant qui ne fournit pas les fichiers.

### Ce qui doit faire la différence

| Axe | Objectif concret |
|---|---|
| **Beauté** | Interface au niveau des grandes plateformes. La concurrence IPTV est visuellement datée : c'est notre principal angle d'attaque. |
| **Vitesse** | Une liste de 50 000 chaînes doit s'ouvrir sans figer l'écran. Mesuré : l'analyseur M3U traite 50 000 chaînes en 210 ms. |
| **Télécommande** | Utilisable entièrement à la flèche + OK, sans jamais perdre le focus. |
| **Reprise** | On rouvre un film, il repart exactement où on s'était arrêté. |
| **Connexions lentes** | Doit rester utilisable en ADSL ou en 4G faible. |

---

## 2. Utilisateur cible

Une personne qui **possède déjà un abonnement IPTV** et qui est déçue par le lecteur fourni avec.

Trois profils types :

1. **Le foyer familial** — plusieurs personnes, plusieurs goûts. A besoin de profils séparés et d'un contrôle parental qui tienne.
2. **L'utilisateur de salon** — regarde sur un téléviseur via un Fire TV Stick, uniquement à la télécommande. **C'est la cible prioritaire.**
3. **Le nomade** — regarde sur téléphone, dans les transports, en réseau instable.

### Niveau technique supposé

Faible. L'utilisateur sait copier-coller une URL et un identifiant, rien de plus.

Conséquences directes sur l'interface :

- Jamais de jargon (« transcodage », « buffer », « codec ») dans un message visible.
- Tout message d'erreur dit **ce qui s'est passé** et **quoi faire** : « Le serveur n'a pas répondu. Vérifiez votre connexion, puis réessayez. »
- Ajouter une liste doit se faire en trois champs maximum.

---

## 3. Périmètre

### Version 1 — inclus

| Fonctionnalité | Description |
|---|---|
| Comptes Xtream Codes | Connexion par hôte, port, identifiant, mot de passe. |
| Listes M3U | Par URL distante ou fichier local. |
| TV en direct | Catégories, chaînes, zapping, EPG. |
| Films et séries | Fiches, saisons, épisodes, jaquettes. |
| EPG | Guide des programmes (voir glossaire). |
| Profils | Plusieurs utilisateurs sur un même appareil. |
| Contrôle parental | Code PIN, catégories verrouillées. |
| Favoris | Sur chaînes, films, séries, épisodes. |
| Historique et reprise | Position de lecture mémorisée. |
| Listes personnalisées | Collections créées par l'utilisateur. |
| Recherche | Sur tout le catalogue chargé, hors ligne. |
| Thèmes clair et sombre | **Les deux dès le départ.** |
| Multilingue | **Dès le départ**, pas ajouté après coup. |

### Version 1 — exclu

| Exclu | Raison |
|---|---|
| **Synchronisation multi-appareils** | Décision utilisateur. Supprime tout le backend : plus de serveur, plus de base distante, plus de comptes, plus d'hébergement à payer. |
| **Apple TV (tvOS)** | Pas de navigateur sur tvOS : ni PWA ni Capacitor n'y fonctionnent. Exigerait une application Swift native repartant de zéro. Projet séparé, ultérieur. |
| **iPhone / iPad** | Techniquement couverts par Capacitor, mais **compiler pour iOS exige un Mac**, non disponible. Hors périmètre pratique v1. |
| **Enregistrement des flux** | Zone juridique risquée, forte complexité. |
| **Tout hébergement de contenu** | Contraire au modèle. Définitif. |

---

## 4. Position juridique

Règles non négociables, valables pour toute contribution :

1. **Aucun flux hébergé.** L'application ne stocke ni ne relaie aucun contenu vidéo.
2. **Aucun flux fourni.** Pas de liste préremplie, pas de « chaînes offertes », pas de compte de démonstration pointant vers un vrai serveur.
3. **Aucun contournement de protection.** Pas de déchiffrement de DRM, pas de contournement de géoblocage, pas d'accès à un flux non autorisé.
4. **Aucun abonnement revendu.**
5. **Aucun secret en dur.** Aucune clé, aucun identifiant, aucun serveur réel dans le code ni dans l'historique git.

Conséquence technique concrète : les jaquettes viennent des serveurs de l'utilisateur et sont chargées **directement** par son appareil. Les faire transiter par une infrastructure à nous nous placerait dans la chaîne de distribution — exactement ce qu'on refuse. C'est aussi pourquoi la règle ESLint `@next/next/no-img-element` est désactivée : `next/image` imposerait un serveur intermédiaire et une liste blanche de domaines, impossible ici.

---

## 5. Stack technique

### Choix retenus

| Brique | Choix | Pourquoi |
|---|---|---|
| Cadre applicatif | **Next.js 16** (App Router) | Déjà en place. Sert d'outil de construction ; en v1 il produit un site statique, sans serveur. |
| Langage | **TypeScript strict** | Le compilateur signale les erreurs avant l'exécution. |
| Interface | **React 19** | Imposé par Next.js 16. |
| Style | **Tailwind CSS 4** | Styles écrits directement dans le balisage, pas de fichier CSS parallèle à maintenir. |
| Composants de base | **Radix UI** | Briques non stylées mais **accessibles** : gestion du clavier et du focus déjà correcte. |
| État global | **Zustand** | Bien plus simple que Redux. |
| Animations | **Framer Motion** | Transitions fluides ; désactivables (mouvement réduit, TV). |
| Recherche | **Fuse.js** | Recherche tolérante aux fautes, entièrement locale. |
| Stockage local | **IndexedDB** | Base de données du navigateur. Seule option tenant 50 000 chaînes (voir §6). |
| Lecture vidéo web | **hls.js + mpegts.js** | Voir §8. |
| Empaquetage mobile/TV | **Capacitor** | Transforme l'application web en APK Android installable. |
| Lecture vidéo native | **ExoPlayer** via `capacitor-video-player` | Lecteur natif Android, bien plus performant qu'une balise `<video>`. |

### Choix écartés

| Écarté | Raison |
|---|---|
| PostgreSQL, Drizzle, `pg` | Devenus inutiles sans synchronisation. Supprimés du dépôt (commit `da784db`). |
| Routes API, authentification, sessions | Idem : plus de serveur, plus rien à authentifier. |
| `react-player` | Ne gère pas le MPEG-TS, format majoritaire en IPTV. Remplacé par hls.js + mpegts.js. |
| React Native / Flutter | Réécriture complète. Le code web existant serait perdu. |
| Kotlin natif | Reste la **porte de sortie** si Capacitor sature sur Firestick. Arbitrage prévu en Phase 5 sur un prototype de 2 jours. |

---

## 6. Architecture locale

### Le principe

Il n'y a **aucun serveur**. L'application est un ensemble de fichiers HTML, CSS et JavaScript exécutés sur l'appareil. Toutes les données vivent sur cet appareil.

```
┌────────────────────────────────────────────────────┐
│                 APPAREIL UTILISATEUR               │
│                                                    │
│   Interface (React)                                │
│        │                                           │
│        ├──► État en mémoire (Zustand)              │
│        │                                           │
│        ├──► IndexedDB  ← chaînes, favoris,         │
│        │                 profils, historique       │
│        │                                           │
│        └──► Lecteur vidéo                          │
│                  │                                 │
└──────────────────┼─────────────────────────────────┘
                   │  appel direct, sans relais
                   ▼
        Serveur IPTV DE L'UTILISATEUR
```

### Pourquoi IndexedDB et pas `localStorage`

`localStorage` est le stockage simple du navigateur. Trois raisons le disqualifient :

1. **Taille** — plafonné à environ 5 Mo. Une liste de 50 000 chaînes en dépasse largement.
2. **Format** — ne stocke que du texte. Il faudrait tout convertir dans les deux sens à chaque lecture.
3. **Blocage** — il est *synchrone* : pendant qu'il lit, l'écran se fige.

**IndexedDB** est une vraie base de données intégrée au navigateur : plusieurs centaines de Mo, objets structurés, index de recherche, et fonctionnement *asynchrone* (l'interface reste réactive pendant la lecture).

`localStorage` reste utilisé pour les valeurs minuscules : thème choisi, langue, dernier profil actif.

### Le point dur : CORS

Un navigateur interdit à une page web d'appeler un serveur d'un autre domaine, sauf si ce serveur l'autorise explicitement. C'est le **CORS**. La plupart des serveurs IPTV ne l'autorisent pas.

Conséquence : **la version navigateur ne pourra pas charger toutes les listes.** Ce n'est pas un défaut à corriger, c'est une limite de sécurité du navigateur.

Une application native n'y est pas soumise. **C'est la raison principale pour laquelle l'APK Android est la cible finale**, et non le site web.

---

## 7. Modèle de données

Types définis dans [`src/types/index.ts`](./src/types/index.ts).

### Magasins IndexedDB prévus

| Magasin | Contenu | Clé | Index utiles |
|---|---|---|---|
| `playlists` | Sources ajoutées (Xtream ou M3U) | `id` | `type` |
| `channels` | Chaînes en direct | `id` | `playlistId`, `categoryId`, `name` |
| `movies` | Films | `id` | `playlistId`, `categoryId` |
| `series` | Séries | `id` | `playlistId`, `categoryId` |
| `episodes` | Épisodes | `id` | `seriesId`, `seasonNumber` |
| `categories` | Catégories, tous types | `id` | `playlistId`, `type` |
| `epg` | Programmes | `id` | `channelId`, `startTime` |
| `profiles` | Profils utilisateur | `id` | — |
| `favorites` | Favoris | `id` | `profileId`, `type` |
| `history` | Historique et reprise | `id` | `profileId`, `watchedAt` |
| `customLists` | Listes personnalisées | `id` | `profileId` |
| `preferences` | Réglages | `profileId` | — |

### Règles de conception

- **Tout est rattaché à `playlistId`.** Supprimer une source doit supprimer proprement tout ce qu'elle a apporté.
- **Tout ce qui est personnel est rattaché à `profileId`.** Les favoris d'un profil ne doivent jamais apparaître dans un autre.
- **Les identifiants du serveur IPTV sont stockés localement**, jamais transmis ailleurs qu'à ce serveur.
- **Aucun PIN en clair.** Les types portent `pinHash`, pas `pin`. Hachage prévu en **PBKDF2 via Web Crypto, avec sel** (Phase 3). Le PIN `1234` présent dans les données de démonstration a été retiré.

### Volumétrie de référence

| Élément | Ordre de grandeur |
|---|---|
| Liste IPTV classique | 10 000 à 80 000 entrées |
| Poids en IndexedDB | 50 à 300 Mo |
| Analyse M3U de 50 000 chaînes | 210 ms (mesuré) |
| Objectif d'ouverture d'écran | < 1 s sur Firestick |

---

## 8. Lecture vidéo

### Les formats en présence

Un serveur Xtream Codes délivre une chaîne à cette adresse :

```
http://hôte:port/live/identifiant/motdepasse/12345.ts
```

Deux formats possibles :

| Format | Extension | Lu nativement par un navigateur ? |
|---|---|---|
| **MPEG-TS** | `.ts` | **Non.** Ni Chrome, ni Safari, ni AVPlayer iOS (qui rejette `video/mp2t`). |
| **HLS** | `.m3u8` | Nativement sur Safari uniquement ; ailleurs, via hls.js. |

Le MPEG-TS est le **format par défaut** de la majorité des serveurs IPTV. Une balise `<video>` seule ne le lit pas.

D'où la règle : **`mpegts.js` est obligatoire, pas optionnel.** C'est ce qui a écarté `react-player`.

### Stratégie par plateforme

| Plateforme | Lecteur | Remarque |
|---|---|---|
| Navigateur, `.m3u8` | hls.js | Sauf Safari, qui gère nativement. |
| Navigateur, `.ts` | mpegts.js | Indispensable. |
| Android / Fire TV (APK) | **ExoPlayer** via Capacitor | Décodage matériel, gère MPEG-TS et HLS nativement. Nettement plus fluide sur Firestick. |

Note : ExoPlayer n'est pas déprécié, il a migré dans **AndroidX Media3**. Il gère HLS, DASH, SmoothStreaming, lecture locale et débit adaptatif.

### Capacités du plugin `capacitor-video-player`

| Fonction | Android | iOS | Web |
|---|---|---|---|
| Image dans l'image | ✅ | ✅ | — |
| Chromecast | ✅ | ❌ | ❌ |
| Sous-titres | ✅ | ✅ | partiel |
| En-têtes HTTP personnalisés | ✅ | ✅ | ❌ |
| Lecteur intégré (non plein écran) | ❌ | ❌ | ✅ |

Point à retenir : **en natif, la lecture est plein écran uniquement.** Un aperçu vidéo intégré dans une grille ne fonctionnera que sur le web. À prendre en compte dans les maquettes.

---

## 9. Design system

Jetons définis dans [`src/design-system/tokens/`](./src/design-system/tokens/).

### Identité

| Rôle | Valeur |
|---|---|
| Fond principal | `#050505` (noir profond) |
| Accent de marque | `#C8102E` (rouge premium) |
| Accent secondaire | `#DC143C` (rouge cinéma) |
| Texte principal | `#FFFFFF` |
| Texte secondaire | `#8E8E93` |

### Composants existants

`Badge`, `EmptyState`, `GlassCard`, `HeroBanner`, `LoadingSkeleton`, `MediaCard`, `Navigation`, `NovaLogo`, `ProgressBar`, `SearchBar`, `SectionHeader`.

### Trois règles d'affichage

**1. Tout écran a quatre états.** Chargement, contenu, vide, erreur. Aucun écran ne doit rester blanc sans explication.

**2. L'effet « verre » est désactivé sur téléviseur.** Le flou d'arrière-plan (`backdrop-filter`) est très coûteux à calculer. Sur un Fire TV Stick, il fait chuter la fluidité du défilement. Le hook expose `glassSupported`, faux sur TV et en mouvement réduit.

**3. Moins de colonnes sur téléviseur, pas plus.** Un écran de télévision est grand mais regardé à trois mètres. Grille retenue : mobile 2, tablette 3, ordinateur 5, **téléviseur 5** — avec des vignettes nettement plus grandes.

### Détection d'appareil

Implémentée dans [`src/hooks/useDeviceType.ts`](./src/hooks/useDeviceType.ts).

**Ne jamais déduire « téléviseur » d'une largeur d'écran.** L'ancienne règle « largeur ≥ 1920 donc TV » se trompait dans les deux sens : elle classait un PC 1080p en téléviseur, et **ratait le Fire TV Stick**, dont la WebView rapporte souvent 960 ou 1280 points CSS.

Ordre de décision retenu :

1. **Identifiant du navigateur** (`user-agent`) : `AFT[A-Z0-9]{1,5}` (tous les modèles Fire TV), `Android TV`, `GoogleTV`, `SMART-TV`, `Tizen`, `WebOS`, `BRAVIA`, `HbbTV`, `NetCast`, `Philips TV`, `VIDAA`, `Roku`.
2. **Repli par capacités** : `(pointer: none)` **et** `(hover: none)` **et** pas de tactile **et** largeur ≥ 960. Autrement dit : un appareil piloté à la télécommande n'a ni souris ni écran tactile.

---

## 10. Navigation télécommande et accessibilité

### Le modèle mental

Sur une télécommande, il n'y a pas de curseur. L'utilisateur a **quatre flèches, OK et Retour**. À tout instant, **un** élément a le focus. Les flèches déplacent ce focus, OK l'active.

### Règles

1. **Le focus est toujours visible.** Contour net, jamais seulement un changement de teinte. C'est le curseur de l'utilisateur : le perdre, c'est perdre l'application.
2. **Toujours un élément focalisé.** À l'ouverture d'un écran, le focus se pose sur un élément utile.
3. **Déplacement prévisible.** Flèche droite → élément visuellement à droite. Pas de saut inattendu.
4. **Retour remonte d'un niveau**, sans jamais quitter l'application par surprise.
5. **Zone de sécurité de 5 %.** Beaucoup de téléviseurs rognent les bords de l'image (*overscan*). Rien d'important dans cette marge.
6. **Cibles généreuses.** Un élément focalisable doit rester lisible à trois mètres.

### Accessibilité

- Contraste minimum **4,5:1** pour le texte.
- Tout contrôle a un nom accessible (`aria-label` si l'icône est seule).
- `prefers-reduced-motion` respecté : les animations se coupent.
- Application utilisable **entièrement au clavier** — c'est la meilleure répétition générale avant la télécommande.

---

## 11. Multilingue

**Dès le départ, pas après coup.** Rattraper l'internationalisation sur une application déjà écrite coûte plusieurs jours ; l'intégrer dès la première ligne ne coûte presque rien.

Règles :

- **Aucun texte visible écrit en dur dans un composant.** Tout passe par une clé de traduction.
- Langues de lancement : **français, anglais**. Structure prête pour l'arabe et l'espagnol.
- **Prévoir le RTL** (écriture de droite à gauche, pour l'arabe) dès la mise en page : utiliser les propriétés logiques CSS (`margin-inline-start` plutôt que `margin-left`).
- Dates et durées via `date-fns`, avec la locale active.
- Langue choisie à la première ouverture, modifiable dans les réglages.

---

## 12. Conventions de code

### Règles absolues

| Règle | Détail |
|---|---|
| **TypeScript strict** | Pas de `any`. Si un type est incertain, on le décrit. |
| **Aucun secret en dur** | Ni clé, ni identifiant, ni serveur réel. |
| **Aucune fausse donnée présentée comme réelle** | Les données de démonstration vivent dans `src/mocks/` et sont clairement nommées. |
| **Quatre états par écran** | Chargement, contenu, vide, erreur. |
| **Entrées validées** | Toute saisie utilisateur est vérifiée avant usage. |
| **Composants réutilisables** | Un composant utilisé deux fois va dans le design system. |

### ⚠️ Ne jamais utiliser `npx` dans ce dépôt

`npx next dev` a téléchargé une version parallèle de Next.js, échoué au démarrage, **et modifié des fichiers suivis par git** (`next-env.d.ts`, `package-lock.json`).

Toujours :

```bash
npm run dev                    # ou
./node_modules/.bin/next dev
```

Et vérifier que `node_modules/` existe avant de lancer un binaire local — il peut disparaître entre deux sessions. S'il manque : `npm install`, jamais `npx`.

### Contrôles avant chaque commit

```bash
./node_modules/.bin/tsc --noEmit    # types
./node_modules/.bin/eslint .        # style et règles React
npm run build                       # construction complète
```

Les trois doivent passer. Formulation interdite dans un compte rendu : « tout est bon ». On écrit ce qui a été vérifié, et explicitement **« Non vérifié : … »** pour le reste.

### Méthode de travail

- Une **branche dédiée** par lot de corrections (`fix/p0-securite`, `fix/p0-bugs`).
- Des changements **petits, testables, réversibles**.
- Avant toute modification : expliquer le changement, le justifier, lister les fichiers, signaler les risques.
- Rien d'important n'est supprimé sans confirmation explicite.

---

## 13. Arborescence

```
nova/
├── DOCUMENTATION.md          ← ce document
├── PROGRESSION.md            ← tableau de bord
├── README.md                 ← démarrage rapide
├── .env.example              ← modèle, aucune valeur réelle
├── eslint.config.mjs
├── next.config.ts            ← en-têtes de sécurité ; output:'export' commenté (Phase 9)
├── package.json
├── public/                   ← icônes, manifest.json
└── src/
    ├── app/                  ← les écrans (une route = un dossier)
    │   ├── epg/  favorites/  history/  lists/
    │   ├── live/       └── [id]/
    │   ├── movies/     └── [id]/
    │   ├── series/     └── [id]/
    │   ├── player/  playlists/  profiles/  search/  settings/
    │   └── layout.tsx
    ├── design-system/
    │   ├── components/       ← 11 composants réutilisables
    │   └── tokens/           ← couleurs, typographie, espacements
    ├── features/             ← logique métier, un dossier par domaine
    │   ├── custom-lists/  epg/  favorites/  history/  home/
    │   ├── layout/  live-tv/  movies/  player/  playlists/
    │   └── profiles/  search/  series/  settings/
    ├── hooks/
    │   └── useDeviceType.ts  ← détection appareil, orientation, capacités
    ├── mocks/                ← données de démonstration
    ├── services/             ← dialogue avec l'extérieur
    │   ├── epg/epgService.ts
    │   ├── m3u/m3uParser.ts
    │   └── xtream/xtreamService.ts
    └── types/index.ts        ← toutes les définitions de types
```

### Où placer un nouveau fichier

| Nature | Emplacement |
|---|---|
| Nouvel écran | `src/app/<route>/page.tsx` |
| Logique d'un écran | `src/features/<domaine>/` |
| Composant réutilisé ailleurs | `src/design-system/components/` |
| Appel réseau, analyse de données | `src/services/<domaine>/` |
| Type partagé | `src/types/index.ts` |

---

## 14. Plateformes cibles

| Plateforme | Statut v1 | Comment |
|---|---|---|
| **Fire TV Stick 4K** | **Cible prioritaire** | APK Capacitor, sideload. Matériel de test disponible. |
| **Android mobile** | Cible | APK Capacitor. Matériel de test disponible. |
| **Android TV** | Cible | Même APK. Présence dans le lanceur TV conditionnée à la déclaration **Leanback** dans le manifeste. |
| **Navigateur** | Support partiel | Limité par le CORS (§6). Sert surtout au développement. |
| **iPhone / iPad** | Techniquement possible, hors périmètre | Capacitor le permet, mais **compiler exige un Mac**, indisponible. |
| **Apple TV** | Hors périmètre | tvOS n'a pas de navigateur. Application Swift native à écrire de zéro. |
| **Samsung Tizen / LG WebOS** | Non évalué | Chaque constructeur impose son SDK et sa validation. **Aucune promesse tant que ce n'est pas vérifié.** |

Sur le sideload : installer un APK sur Fire TV ou Android TV est une pratique courante et documentée. Apparaître dans le lanceur TV dépend du support Leanback déclaré dans le manifeste Android.

---

## 15. Glossaire

| Terme | Explication |
|---|---|
| **IPTV** | Télévision diffusée par Internet plutôt que par antenne, câble ou satellite. |
| **Xtream Codes** | Type de serveur IPTV très répandu. On s'y connecte avec une adresse, un port, un identifiant et un mot de passe ; il répond par la liste des chaînes, films et séries. |
| **M3U / M3U8** | Fichier texte listant des chaînes. Chaque entrée tient sur deux lignes : une description `#EXTINF`, puis l'adresse du flux. |
| **`#EXTVLCOPT`** | Ligne d'option qu'un fichier M3U peut insérer **entre** la description et l'adresse. Un analyseur qui ne la prévoit pas perd la chaîne. C'était un bug réel du projet. |
| **EPG** | *Electronic Program Guide* — le guide des programmes : ce qui passe, sur quelle chaîne, à quelle heure. |
| **MPEG-TS** | Format de flux vidéo majoritaire en IPTV (`.ts`). **Aucun navigateur ne le lit nativement** ; il faut `mpegts.js`. |
| **HLS** | *HTTP Live Streaming* (`.m3u8`) — format d'Apple qui découpe la vidéo en petits segments et adapte la qualité au débit. |
| **DRM** | Verrou technique protégeant un contenu payant. **On n'y touche pas.** |
| **CORS** | Règle de sécurité du navigateur interdisant à une page d'appeler un serveur d'un autre domaine sans son accord. Principale limite de la version web. |
| **IndexedDB** | Base de données intégrée au navigateur. Grande capacité, objets structurés, ne bloque pas l'écran. |
| **`localStorage`** | Petit stockage texte du navigateur (~5 Mo). Réservé aux réglages minuscules. |
| **Capacitor** | Outil qui emballe une application web dans une application mobile installable (APK). |
| **WebView** | Navigateur sans habillage, intégré dans une application native. C'est lui qui affiche notre interface dans l'APK. |
| **ExoPlayer / Media3** | Lecteur vidéo natif d'Android. Décodage matériel, gère MPEG-TS et HLS. |
| **PWA** | Site web installable comme une application. Insuffisant ici à cause du CORS. |
| **Sideload** | Installer une application sans passer par une boutique officielle. |
| **Leanback** | Mode Android dédié aux téléviseurs. À déclarer dans le manifeste pour apparaître dans le lanceur TV. |
| **Overscan** | Rognage des bords de l'image par certains téléviseurs. D'où la marge de sécurité de 5 %. |
| **Hydratation** | Moment où React « réveille » un HTML déjà écrit. Si le calcul du navigateur diffère de celui du serveur, React réaffiche toute la page — d'où l'interdiction de lire `window` à l'initialisation d'un état. |
| **`useSyncExternalStore`** | Fonction React faite pour lire une valeur qui n'appartient pas à React (taille de fenêtre, réseau) sans provoquer de rendus en cascade. |
| **Fuite mémoire** | Mémoire jamais rendue. Ici : un écouteur d'événement jamais retiré. Invisible sur PC, pénalisant sur un Firestick allumé des heures. |
| **P0** | Priorité maximale : à corriger avant toute nouvelle fonctionnalité. |

---

*Document maintenu à jour au fil des phases. Toute décision structurante est également datée dans [`PROGRESSION.md`](./PROGRESSION.md).*
