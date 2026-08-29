# NOVA TV — Documentation générale

> **Document de référence du projet.** Il décrit la vision, le périmètre, le stack technique, l'architecture cible et les conventions.
> Il évolue quand une décision de fond change — pas à chaque tâche. Le suivi quotidien est dans `PROGRESSION.md`.
>
> **Version 1.0** — 17 août 2026
> Documents liés : `AUDIT_NOVA_IPTV.md` (état initial, figé) · `PROGRESSION.md` (avancement)

---

## 1. Vision

### 1.1 En une phrase

**Nova TV est un lecteur IPTV haut de gamme.** L'utilisateur apporte son propre abonnement (Xtream Codes ou fichier M3U) et obtient une expérience de navigation moderne, au niveau de Netflix ou Disney+, sur tous ses écrans.

### 1.2 Le problème résolu

Les lecteurs IPTV existants — IPTV Smarters Pro, TiviMate, GSE — fonctionnent, mais leurs interfaces sont datées, chargées, souvent laides. L'utilisateur paie un abonnement correct et le consomme à travers une interface qui ressemble à un logiciel de 2010.

**Nova TV ne vend pas de contenu. Nova TV vend l'expérience.**

### 1.3 Ce que Nova TV est, et n'est pas

| ✅ Nova TV EST | ❌ Nova TV N'EST PAS |
|---|---|
| Un lecteur (un « contenant ») | Un fournisseur de contenu |
| Une interface premium | Un revendeur d'abonnements |
| Un outil où l'utilisateur branche SA source | Un service qui héberge ou relaie des flux |
| Une app installée sur l'appareil | Un service en ligne avec des comptes serveur |

**Position juridique.** Nova TV est un logiciel de lecture, au même titre que VLC. Aucune donnée ne transite par une infrastructure appartenant à l'éditeur. Aucun flux n'est hébergé, relayé ni mis en cache côté serveur. L'utilisateur est seul responsable de la légalité de la source qu'il connecte, et un avertissement le lui rappelle à l'ajout d'une source.

### 1.4 Référence concurrentielle

**IPTV Smarters Pro** est la référence fonctionnelle assumée. Nova TV vise la parité fonctionnelle avec une exécution visuelle très supérieure.

Inspirations visuelles : **Netflix** (rails horizontaux, bannière héro, densité maîtrisée) et **Disney+** (profils, transitions, sensation premium).

### 1.5 Trajectoire

| Étape | Statut |
|---|---|
| Projet personnel | Aujourd'hui |
| Produit commercial | Objectif à terme |
| Accès payant à l'application (jamais au contenu) | Prévu, techniquement anticipé, non activé en v1 |

Aucune échéance externe. Le rythme est fixé par la disponibilité du porteur (~35 h/semaine).

---

## 2. Utilisateurs

### 2.1 Profil type

Une personne de 15 à 50 ans, à l'aise avec les applications de streaming grand public sans être technicienne. Elle possède déjà un abonnement IPTV et veut simplement le brancher et regarder. Elle consomme **live TV et VOD à parts égales**, à tout moment de la journée, et change d'écran selon le contexte : téléphone dans les transports, PC au bureau, télévision le soir.

### 2.2 Le foyer

Environ **2 adultes et 3 enfants ou adolescents** partagent l'appareil. Les **profils multiples sont donc une fonctionnalité centrale**, pas un gadget. Le contrôle parental est fortement souhaité (sans être bloquant pour la v1).

### 2.3 Parcours de première ouverture

```
Lancement
   ↓
Écran d'accueil — choix du mode de connexion
   ↓
   ├── Xtream Codes  → URL du serveur + identifiant + mot de passe
   ├── Fichier M3U   → URL distante ou fichier local
   └── Mode démo     → données d'exemple, clairement identifiées comme telles
   ↓
Import et indexation (barre de progression réelle)
   ↓
Tout fonctionne — accueil peuplé avec le contenu de l'utilisateur
```

**Règle absolue :** aucune étape inutile. Pas de création de compte, pas d'e-mail, pas de validation. De l'ouverture au visionnage, l'objectif est **moins d'une minute**.

---

## 3. Périmètre

### 3.1 Dans la v1

- Sources **Xtream Codes** et **M3U / M3U8** (distant ou fichier local)
- **EPG** au format XMLTV (guide des programmes)
- Live TV, Films, Séries avec saisons et épisodes
- Profils multiples, code PIN local, contrôle parental
- Favoris, listes personnalisées, historique, reprise de lecture
- Recherche unifiée tolérante aux fautes de frappe
- Multilingue **FR / EN / ES**
- Thèmes **clair et sombre**
- Navigation télécommande complète
- **APK** Android · Android TV · Fire TV
- Version web (**développement et vitrine uniquement**)

### 3.2 Hors v1, prévu ensuite

- Application iOS / iPad (Capacitor)
- Application Apple TV (**projet Swift natif distinct** — voir §7.4)
- Synchronisation multi-appareils (réservée aux comptes premium)
- Système de licence payante activé
- Téléchargement hors ligne
- Chromecast et AirPlay

### 3.3 Exclu explicitement

| Exclusion | Raison |
|---|---|
| Vente d'abonnements IPTV | Ce n'est pas le modèle, et c'est le risque juridique majeur |
| Hébergement ou relais de flux côté serveur | Ferait de l'éditeur un intermédiaire technique |
| Catalogue fourni par l'éditeur | Nova TV est un contenant, pas un contenu |
| **Utilisation du web pour regarder** | **Décision du porteur — le web reste un outil de développement** |
| Contournement de DRM ou de protection | Interdit, sans exception |
| Smart TV Samsung Tizen / LG webOS | Moteurs de navigateur trop anciens (voir §7.4) |

---

## 4. Stack technique

### 4.1 Vue d'ensemble

| Couche | Technologie | Justification |
|---|---|---|
| Framework | **Next.js 16** (App Router, export statique) | Conserve tout le code existant ; l'export statique produit les fichiers dont Capacitor a besoin |
| Langage | **TypeScript 5.9** strict | Déjà en place, 0 erreur de type |
| UI | **React 19** | Déjà en place |
| Styles | **Tailwind CSS 4** | Déjà en place |
| État | **Zustand 5** | Déjà en place, léger et suffisant |
| Stockage | **Dexie** (IndexedDB) | Remplace localStorage : plusieurs Go au lieu de 5 Mo |
| Listes longues | **@tanstack/react-virtual** | Indispensable au-delà de quelques milliers d'entrées |
| Lecteur web | **hls.js** + **mpegts.js** | Développement, vitrine, secours |
| Lecteur APK | **ExoPlayer / Media3** via Capacitor | Le meilleur lecteur Android : HLS, DASH, sous-titres, en-têtes HTTP, 4K |
| Recherche | **Fuse.js** | Déjà installé, jamais branché — tolérance aux fautes |
| Traductions | **i18next** + `react-i18next` | Compatible export statique |
| Empaquetage | **Capacitor 6** | Réutilise ~95 % du code web |
| Tests | **Vitest** + **Playwright** | Standards de l'écosystème |
| Hébergement vitrine | **Cloudflare Pages** | Gratuit, bande passante illimitée |

### 4.2 Ce qui est retiré du projet

| Élément | Raison |
|---|---|
| `drizzle-orm`, `drizzle-kit`, `pg`, `dotenv` | Aucun serveur, aucune base distante |
| `src/db/` en entier | Code mort, sans objet dans une app locale |
| `src/app/api/` | Aucune route serveur nécessaire |
| `react-player` | Remplacé par `hls.js` / `mpegts.js` / ExoPlayer |
| `@radix-ui/*` (11 paquets) | Jamais importés — à réévaluer si un besoin réel apparaît |
| `framer-motion`, `date-fns` | Jamais importés — décision reportée |

### 4.3 Notions techniques expliquées

**Export statique.** Normalement, Next.js a besoin d'un serveur Node.js qui tourne en permanence. L'export statique transforme le site en simples fichiers HTML, CSS et JavaScript, comme un dossier de photos. Aucun serveur nécessaire. C'est exactement ce qu'il faut pour glisser l'application dans un APK.

**IndexedDB.** Une véritable base de données intégrée au navigateur et aux WebView Android. Contrairement au `localStorage` (limité à 5-10 Mo et lent), elle stocke plusieurs gigaoctets, gère les index et les recherches rapides. **Dexie** est une bibliothèque qui la rend simple à utiliser.

**Virtualisation.** Avec 50 000 chaînes, créer 50 000 éléments visuels ferait planter l'appareil. La virtualisation n'affiche que les ~20 lignes réellement visibles à l'écran et recycle les mêmes éléments au défilement. L'utilisateur ne voit aucune différence, la mémoire reste constante.

**HLS et MPEG-TS.** Deux façons de transporter la vidéo. **HLS** (fichiers `.m3u8`) découpe le flux en petits morceaux et adapte la qualité au débit disponible — c'est le standard moderne. **MPEG-TS** (`.ts`) est plus ancien, envoie un flux continu sans s'adapter au réseau. Les serveurs Xtream servent du `.ts` par défaut et peuvent servir du `.m3u8`. Aucun navigateur ne lit le `.ts` nativement, d'où `mpegts.js`.

**Capacitor.** Un outil qui emballe une application web dans une véritable application mobile. Le code web tourne dans une WebView (un navigateur invisible intégré), et Capacitor donne accès aux fonctions natives de l'appareil : lecteur vidéo natif, stockage, plein écran, gestion de la télécommande.

**ExoPlayer / Media3.** Le lecteur vidéo officiel d'Android, développé par Google. Bien plus performant que la balise vidéo d'un navigateur, notamment en 4K et sur les appareils modestes comme le Firestick.

**CORS.** Une règle de sécurité des navigateurs : un site ne peut pas contacter un autre serveur sans autorisation explicite de celui-ci. Les serveurs IPTV n'autorisent personne, donc la lecture depuis un navigateur échoue souvent. **Les applications natives ne sont pas soumises à cette règle** — c'est une raison de plus pour que l'APK soit le produit réel.

---

## 5. Architecture

### 5.1 Principe fondateur

**Tout est local. Rien ne remonte à un serveur.**

```
┌──────────────────────────────────────────────────┐
│              APPAREIL DE L'UTILISATEUR            │
│                                                   │
│   Interface Nova TV (Next.js statique)            │
│              ↓                                    │
│   Zustand — état de l'interface                   │
│              ↓                                    │
│   Dexie / IndexedDB — chaînes, EPG, favoris…      │
│              ↓                                    │
│   Services — Xtream · M3U · XMLTV                 │
│              ↓                                    │
│   Lecteur — ExoPlayer (APK) / hls.js (web)        │
└───────────────────────┬──────────────────────────┘
                        │  connexion directe
                        ▼
        Serveur IPTV de l'utilisateur (tiers)

     ❌ Aucun serveur Nova TV sur ce chemin
```

### 5.2 Organisation du code

Le découpage actuel est bon et sera conservé :

```
src/
├── app/            Routes — coquilles de 5 lignes
├── features/       Une page métier = un dossier
├── design-system/  Composants réutilisables + jetons de style
├── services/       Xtream · M3U · XMLTV (à brancher)
├── store/          État global Zustand
├── db/local/       Dexie — à créer
├── player/         Abstraction du lecteur — à créer
├── i18n/           Traductions — à créer
├── hooks/          Hooks partagés
├── types/          Modèle de domaine (déjà excellent)
└── utils/          Utilitaires
```

**Règle :** `app/` ne contient jamais de logique. `features/` compose. `design-system/` ne connaît rien du métier.

### 5.3 Abstraction du lecteur

Un contrat unique, deux implémentations. L'interface ne sait jamais quel moteur tourne derrière.

```
        Interface de contrôles Nova TV
                     ↓
        Contrat commun : load / play / pause / seek /
        volume / pistes / qualité / événements
                ↙          ↘
    Web (hls.js,          APK (ExoPlayer
     mpegts.js)            via Capacitor)
```

**Point ouvert :** les plugins Capacitor existants affichent la vidéo en plein écran natif, ce qui masque l'interface Nova TV. Garder les contrôles personnalisés demandera probablement un plugin maison. Décision en Phase 5.

### 5.4 Modèle de données local

`src/types/index.ts` (387 lignes) est déjà solide et sert de base.

| Table Dexie | Contenu | Index |
|---|---|---|
| `sources` | Sources IPTV configurées | `id` |
| `channels` | Chaînes live | `id`, `sourceId`, `categoryId`, `name` |
| `movies` | Films | `id`, `sourceId`, `categoryId`, `name` |
| `series` | Séries, saisons, épisodes | `id`, `sourceId`, `categoryId` |
| `categories` | Catégories, tous types | `id`, `sourceId`, `type` |
| `epg` | Programmes | `channelId`, `start`, `stop` |
| `profiles` | Profils du foyer | `id` |
| `favorites` | Favoris | `profileId`, `itemId` |
| `history` | Historique et reprise | `profileId`, `itemId`, `updatedAt` |
| `lists` | Listes personnalisées | `profileId`, `id` |

**Sécurité locale :** les identifiants IPTV sont chiffrés (Web Crypto API, AES-GCM) avant écriture. Jamais en clair, jamais journalisés, jamais affichés en entier dans l'interface.

### 5.5 Import d'une source volumineuse

Cible : **20 000 à 50 000 chaînes**.

1. Téléchargement du M3U ou appel de l'API Xtream
2. Analyse dans un **Web Worker** (fil séparé : l'interface reste fluide)
3. Écriture par lots de 500 dans Dexie
4. Barre de progression **réelle**, annulable
5. Indexation pour la recherche

L'utilisateur peut ne sélectionner que certaines catégories pour réduire le volume.

---

## 6. Design

### 6.1 Identité

Conservée depuis le code existant, à affiner ensemble.

| Élément | Valeur |
|---|---|
| Fond principal | `#050505` |
| Accent | `#C8102E` (rouge Nova) |
| Effet signature | Verre dépoli (`backdrop-blur`) — **désactivable**, coûteux sur TV |
| Typographie | Geist Sans / Geist Mono |

**Nom :** `NOVA TV` ou `Nova Player`. Le mot « IPTV » est écarté des noms publics — les boutiques d'applications rejettent régulièrement les apps sur ce seul critère.

### 6.2 Thèmes clair et sombre

Les deux sont requis. Toutes les couleurs passent par des variables CSS ; aucune couleur codée en dur dans les composants. Sombre par défaut (usage TV et soirée).

### 6.3 Les trois modes d'affichage

| Mode | Cible | Règles |
|---|---|---|
| **Mobile** | Téléphone, tablette | Navigation basse, zones tactiles ≥ 44 px, zones sûres iOS |
| **Bureau** | PC | Barre latérale, survol, raccourcis clavier |
| **TV** | Android TV, Fire TV | **Texte ×1,5 · cibles ≥ 48 px · marge de sécurité 5 % · focus très visible · blur désactivé** |

La détection actuelle (`largeur ≥ 1920 → TV`) est fausse et sera remplacée par une détection via l'identifiant du navigateur (`Android TV`, `AFT` pour Fire TV, `Google TV`) et l'absence de pointeur précis.

### 6.4 Règles de navigation à la télécommande

Non négociables :

1. **Un élément focalisé est toujours visible** — défilement automatique systématique
2. **Le focus ne se perd jamais** — chaque écran a une cible par défaut
3. **La touche Retour recule d'un écran** — elle ne quitte jamais l'application sans confirmation
4. **Le déplacement suit la logique visuelle**, pas l'ordre du code
5. **Les touches média** (Lecture, Pause, Suivant) sont prises en charge

### 6.5 États obligatoires

Chaque écran affichant des données doit gérer quatre situations : **chargement** (squelette animé), **vide** (message clair + action proposée), **erreur** (cause compréhensible + bouton Réessayer), **succès**.

Un écran qui n'a pas ses quatre états n'est pas terminé.

---

## 7. Plateformes

### 7.1 Priorités

| Rang | Plateforme | Forme | Statut |
|---|---|---|---|
| 1 | Android TV / Fire TV | APK | **Cible principale** |
| 2 | Android téléphone/tablette | APK | Cible principale |
| 3 | Web | Site statique | **Développement et vitrine uniquement** |
| 4 | iOS / iPadOS | Capacitor | Après la v1 |
| 5 | Apple TV | Swift natif | Projet distinct |

### 7.2 Le rôle du web

Décision du porteur : **on ne regarde pas la télévision dans un navigateur.** Le web sert à développer (aperçu instantané pendant le codage), à tester le design et à présenter le produit. La lecture réelle se fait dans l'APK.

Cette décision élimine le problème CORS et supprime tout besoin de relais serveur — donc tout risque juridique lié.

### 7.3 Matériel de test disponible

Téléphone Android · iPhone · iPad · Apple TV · **Firestick** · PC · **Android TV**.

Couverture excellente. Le Firestick est le juge de paix : c'est l'appareil le plus contraint (RAM limitée), donc la référence pour les performances.

### 7.4 Limites assumées

**Apple TV.** tvOS n'a **aucun navigateur**. Ni PWA ni Capacitor n'y fonctionnent. Une application Swift native écrite de zéro est la seule voie — un second projet complet. Hors périmètre jusqu'à ce que la traction le justifie.

**Samsung Tizen et LG webOS.** Les modèles d'avant 2020 embarquent des moteurs très anciens (Tizen 2015 ≈ Chrome 47). Next.js 16 et React 19 ne s'y exécuteront pas. Les supporter coûterait plus cher que le reste du projet. **Exclus.**

**DRM (Widevine, FairPlay).** Si des sources utilisent des flux chiffrés, la lecture demandera une intégration DRM spécifique — projet séparé, non planifié. À vérifier lors des premiers tests réels.

---

## 8. Conventions de code

### 8.1 Règles

- **TypeScript strict.** Le type `any` est interdit. `tsc --noEmit` doit rester à zéro erreur.
- **Aucune donnée fictive présentée comme réelle.** Le mode démo est explicitement étiqueté.
- **Aucun secret dans le code.** Aucune clé, aucun identifiant, aucun mot de passe en dur.
- **Composants < 300 lignes.** Au-delà, on découpe.
- **Les quatre états** sur tout écran affichant des données.
- **Aucune couleur codée en dur** — uniquement les jetons de style.
- **Textes traduits** — aucune chaîne écrite en dur dans un composant.
- **Accessible à la télécommande** — tout élément interactif est atteignable et visible.

### 8.2 Nommage

| Type | Convention | Exemple |
|---|---|---|
| Composants | PascalCase | `MediaCard.tsx` |
| Hooks | camelCase, préfixe `use` | `useDeviceType.ts` |
| Utilitaires | camelCase | `formatDuration.ts` |
| Types | PascalCase | `Channel`, `Playlist` |
| Constantes | MAJUSCULES | `MAX_BATCH_SIZE` |

### 8.3 Git

- Une branche par phase : `fix/p0-securite`, `feat/stockage-local`, `feat/lecteur`…
- Jamais de commit direct sur `main`
- Messages en français, à l'impératif : « Corrige le hook conditionnel dans Navigation »
- Un commit = un changement cohérent et réversible

### 8.4 Méthode de travail

1. Le code est écrit, le résultat visible en direct dans la prévisualisation
2. Seuls les **fichiers modifiés et le résultat** sont présentés — pas de pavés de code dans la conversation
3. Le porteur récupère les fichiers dans VS Code et teste sur ses appareils
4. `PROGRESSION.md` est mis à jour à chaque session ou sur demande
5. Rien n'est supprimé sans confirmation explicite

---

## 9. Points ouverts

| # | Sujet | À trancher |
|---|---|---|
| 1 | Contrôles vidéo dans l'APK | Plein écran natif (simple, perd le design) ou plugin maison (garde le design, +3-4 j) — **Phase 5** |
| 2 | DRM | À vérifier lors des premiers tests avec une source réelle |
| 3 | Dépendances inutilisées | `@radix-ui`, `framer-motion`, `date-fns` : retirer ou brancher — après compréhension des besoins |
| 4 | Charte graphique | À formaliser ensemble, sur la base de l'existant |
| 5 | Licence premium | Couche préparée en v1, activation ultérieure |
| 6 | Structure juridique et CGU | Avant toute diffusion publique |

---

## 10. Glossaire

| Terme | Signification |
|---|---|
| **APK** | Fichier d'installation d'une application Android |
| **Capacitor** | Outil qui transforme une application web en application native |
| **Dexie** | Bibliothèque simplifiant l'usage d'IndexedDB |
| **EPG** | Guide électronique des programmes (qui passe, quand) |
| **ExoPlayer / Media3** | Lecteur vidéo officiel d'Android |
| **HLS** | Streaming adaptatif moderne, fichiers `.m3u8` |
| **IndexedDB** | Base de données intégrée au navigateur, plusieurs Go |
| **M3U / M3U8** | Fichier texte listant des chaînes et leurs adresses |
| **MPEG-TS** | Format de flux plus ancien, fichiers `.ts` |
| **Virtualisation** | N'afficher que les éléments visibles d'une longue liste |
| **WebView** | Navigateur invisible intégré à une application native |
| **Xtream Codes** | Interface standard des serveurs IPTV (chaînes, films, séries, EPG) |
| **XMLTV** | Format de fichier standard pour l'EPG |
