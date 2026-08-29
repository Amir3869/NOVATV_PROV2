# NOVA TV — Progression

> Tableau de bord vivant. **Mis à jour à chaque session de travail.**
>
> Voir aussi : [`DOCUMENTATION.md`](./DOCUMENTATION.md) — vision, stack, architecture, glossaire.
> [`AUDIT_NOVA_IPTV.md`](../AUDIT_NOVA_IPTV.md) — audit initial, **figé**.

**Dernière mise à jour : 18 août 2026**

---

## 1. État général

| | |
|---|---|
| **Phase en cours** | Phase 2 — Correction des bugs P0 |
| **Branche** | `fix/p0-bugs` |
| **Dernier commit** | `87efc0f` |
| **Types (`tsc --noEmit`)** | ✅ 0 erreur |
| **Style (`eslint .`)** | ✅ 0 erreur |
| **Construction (`npm run build`)** | ✅ 15 pages |
| **Exécution (`next dev`)** | ✅ 16/16 routes en 200, y compris avec un user-agent Fire TV Stick et avec un catalogue vide |
| **Données de démonstration** | ✅ Supprimées — `src/mocks/` n'existe plus |
| **Navigation télécommande** | ✅ Focus visible, 0 contrôle inatteignable, 0 bouton anonyme, défilement suivant le focus — *non testé sur un Firestick réel* |
| **Thèmes** | ✅ Clair / sombre / suivi du système, sans flash au chargement |
| **Tests automatisés** | ✅ 71 tests (Vitest) — 38 EPG, 20 Xtream, 7 défilement, 6 thème |
| **Intégration continue** | ❌ Aucune — voir Phase 8 |
| **Vulnérabilités npm** | ⚠️ 3 *high*, internes à `next@16.2.6`. Dette assumée, voir §5 |

### Avancement des phases

| # | Phase | État |
|---|---|---|
| 1 | Sécurisation et nettoyage | ✅ Terminée |
| 2 | Correction des bugs P0 | 🔄 En cours |
| 3 | Stockage IndexedDB et PIN | ⬜ À faire |
| 4 | Connecteurs Xtream et M3U | ⬜ À faire |
| 5 | Lecteur vidéo + arbitrage Capacitor | ⬜ À faire |
| 6 | Interface, thèmes, performance images | ⬜ À faire |
| 7 | Multilingue | ⬜ À faire |
| 8 | Tests et intégration continue | ⬜ À faire |
| 9 | Export statique et APK | ⬜ À faire |

---

## 2. Phases détaillées

### ✅ Phase 1 — Sécurisation et nettoyage

Commit `da784db` sur `fix/p0-securite` — 26 fichiers (9 ajouts, 4 suppressions, 13 modifications).

- [x] Supprimer le code serveur devenu inutile — `src/db/index.ts`, `src/db/schema.ts`, `src/app/api/health/route.ts`, `drizzle.config.json`
      → *Validé : `npm run build` passe sans ces fichiers.*
- [x] Retirer les dépendances associées — `pg`, `drizzle-orm`, `drizzle-kit`, `@types/pg`, `dotenv`, `react-player`
      → *Validé : plus aucune référence, `npm ls` propre.*
- [x] Ajouter `.gitignore` — couvre `node_modules`, `.next/`, `out/`, `.env*`, builds `android/`/`ios/`, keystores, logs
      → *Validé : `git status` propre après une construction complète.*
- [x] Ajouter `.env.example` documenté, sans aucune valeur réelle
      → *Validé : relecture, aucun secret.*
- [x] Ajouter 4 en-têtes HTTP de sécurité — `next.config.ts`
      → *Validé : en-têtes présents dans la réponse.*
- [x] Remplacer `pin` par `pinHash` — `src/types/index.ts`
      → *Validé : `tsc --noEmit` 0 erreur.*
- [x] Retirer le PIN `1234` des données de démonstration — `src/mocks/data.ts`
      → *Validé : `grep` sans résultat.*
- [x] Corriger l'ordre des Hooks dans `BottomNav` — `src/design-system/components/Navigation.tsx`
      → *Validé : `eslint` 0 erreur.*
- [x] Corriger la cascade de rendus de `HeroBanner` — `src/design-system/components/HeroBanner.tsx`
      → *Validé : `eslint` 0 erreur.*
- [x] Remplacer `<a>` par `next/link` — `src/features/profiles/ProfilesPage.tsx`
- [x] Enrichir les métadonnées et le manifeste — `src/app/layout.tsx`, `public/`
- [x] Rédiger le `README.md`
- [x] Monter `postcss` à 8.5.26 — 7 vulnérabilités ramenées à 3

---

### 🔄 Phase 2 — Correction des bugs P0

Branche `fix/p0-bugs`, partie commitée en `c30afc2`.

- [x] **Détection de téléviseur** — `src/hooks/useDeviceType.ts`
      La règle « largeur ≥ 1920 donc TV » classait un PC 1080p en téléviseur **et ratait le Fire TV Stick** (WebView à 960/1280 pt CSS). Remplacée par une détection par user-agent + repli sur les capacités de pointeur.
      → *Validé : 16/16 routes en 200 avec un user-agent `AFTKA` (Fire TV Stick 4K).*
- [x] **Décalage d'hydratation** — `src/hooks/useDeviceType.ts`
      L'état initial lisait `window`, produisant un HTML serveur différent du premier rendu client.
      → *Validé : journal `next dev` sans avertissement d'hydratation.*
- [x] **Cascade de rendus** — `src/hooks/useDeviceType.ts`
      Passage à `useSyncExternalStore`. Supprime le `setState` dans un effet que le linter React 19 refusait, et partage un seul jeu d'écouteurs entre tous les composants.
      → *Validé : `eslint .` 0 erreur (l'erreur `react-hooks/set-state-in-effect` a disparu).*
- [x] **Fuite mémoire** — `src/hooks/useDeviceType.ts`
      Les écouteurs `matchMedia` n'étaient jamais retirés : un de plus à chaque montage de composant.
      → *Validé : relecture du code, les 4 écouteurs sont retirés au départ du dernier abonné.*
- [x] **Grille téléviseur 6 → 5 colonnes** — `src/hooks/useDeviceType.ts`
      → *Validé : aucun consommateur existant (`grep`), donc aucun risque de régression.*
- [x] **Analyseur M3U : lignes `#EXTVLCOPT`** — `src/services/m3u/m3uParser.ts`
      **Le bug le plus grave trouvé jusqu'ici.** L'analyseur abandonnait une chaîne dès que la ligne suivant `#EXTINF` commençait par `#`. Or beaucoup de playlists insèrent `#EXTVLCOPT:http-user-agent=…` entre les deux. Sur ces fichiers, **la totalité des chaînes était perdue**.
      → *Validé : ancien code 0/2 chaînes, nouveau code 2/2.*
- [x] **Analyseur M3U : numéros de ligne faux** — `src/services/m3u/m3uParser.ts`
      Les lignes vides étaient retirées avant numérotation : les messages d'erreur désignaient la mauvaise ligne.
      → *Validé : une erreur ligne 4 est bien signalée « Ligne 4 ».*
- [x] **Analyseur M3U : virgule dans un attribut** — `src/services/m3u/m3uParser.ts`
      → *Validé : `group-title="Sport, France"` donne bien le nom `BeIN Sports 1`.*
- [x] **Analyseur M3U : fichiers Windows, protocoles, annulation** — `src/services/m3u/m3uParser.ts`
      Support CRLF, protocoles `rtsp://`/`udp://`/`file://`, rappel de progression, `AbortSignal`.
      → *Validé : 18/18 cas de test, 50 000 chaînes analysées en 210 ms.*

**Correction apportée à l'audit :** le double `j++` signalé dans `AUDIT_NOVA_IPTV.md` **n'était pas un bug réel**. Vérification faite sur 5 000 chaînes : l'ancien code en retournait bien 5 000. Le `for` réévaluait `j` correctement. Le vrai défaut de cette fonction était ailleurs (`#EXTVLCOPT`). L'audit étant figé, la correction est consignée ici.

#### Reste à faire en Phase 2

- [x] Auditer `src/services/xtream/xtreamService.ts` — validation des entrées, gestion des erreurs réseau, délais d'attente
      → *Critère : aucune saisie utilisateur utilisée sans vérification ; toute erreur réseau produit un message actionnable.* **Réécrit — 33/33 tests.**
- [x] Auditer `src/services/epg/epgService.ts` — analyse XMLTV, fuseaux horaires
      → *Critère : un programme à cheval sur minuit s'affiche correctement.* **Réécrit — 23/23 tests.**
#### Défauts corrigés dans les deux services (Phase 2)

**`xtreamService.ts` — le format des réponses était mal typé.** L'API `player_api.php`
renvoie ses champs en `snake_case` (`stream_id`, `category_id`, `epg_channel_id`,
`stream_icon`, `tv_archive`…). L'ancien code les déclarait en `camelCase` sans aucune
conversion : à l'exécution, **tous ces champs valaient `undefined`**. TypeScript ne
pouvait rien signaler, puisqu'un `JSON.parse()` renvoie `any` — le type déclaré était
une promesse non vérifiée. Chaque champ est maintenant converti explicitement, avec
coercition tolérante (`category_id` arrive tantôt en nombre, tantôt en chaîne selon le
portail). Ajouts : classe `XtreamError` distinguant huit causes (`auth`, `network`,
`timeout`, `account_inactive`…) avec message utilisateur séparé du détail technique ;
détection des pages HTML d'erreur servies en HTTP 200 ; `encodeURIComponent` sur les
identifiants dans les URL de lecture (un mot de passe contenant `/` ou `?` cassait
l'URL) ; vérification `auth === 1` puis `status === 'Active'`.

**`epgService.ts` — deux défauts à impact visible.**

1. *Décalage horaire systématique.* La spécification XMLTV rend le fuseau facultatif, et
   beaucoup de fournisseurs l'omettent. L'ancien code ajoutait alors `+0000`, traitant
   l'heure comme UTC : en France, **tous les programmes étaient décalés d'une heure en
   hiver et de deux heures en été**. Sans indication de fuseau, l'heure est désormais
   interprétée comme locale, conformément à la spécification.
2. *Appariement quadratique.* `matchChannelsWithEPG` faisait un `find()` dans la liste du
   guide pour chaque chaîne de la playlist. Mesuré sur un cas réaliste de 20 000 chaînes
   × 15 000 entrées EPG : **2 559 ms d'interface figée** sur un PC de développement,
   nettement plus sur un Fire TV Stick. Remplacé par des index `Map` construits une seule
   fois : **35 ms, soit 73× plus rapide**, à résultat identique.

   Également : analyse par lots avec progression et annulation, attribut `stop` facultatif
   (durée d'une heure supposée), rejet des dates aberrantes (mois 13, heure 25),
   normalisation des noms pour le rapprochement (accents, ponctuation, suffixes
   `HD`/`FHD`/`4K`), et chemin explicite hors navigateur au lieu d'un échec silencieux.

*Vérifications : `tsc --noEmit` 0 erreur · `eslint .` 0 erreur · `npm run build` 15 pages ·
56 tests de comportement (23 EPG + 33 Xtream) exécutés hors dépôt.*
**Non vérifié : aucun des deux services n'a été confronté à un serveur Xtream réel** —
la forme exacte de `get_series_info` et `get_vod_info` reste à confirmer en Phase 4.

- [x] **Supprimer toutes les données de démonstration** — `src/mocks/data.ts` (14 exports,
      29 Ko) supprimé ; les 12 écrans qui l'importaient lisent le store ; `persist` passe
      en `version: 1` avec `migrate` pour effacer les mocks déjà écrits dans le
      `localStorage` des utilisateurs ; filtres, suggestions et historique de recherche
      dérivés du catalogue réel
      → *Critère : `grep -r "@/mocks\|MOCK_" src/` ne renvoie rien, 16/16 routes en 200
      avec un catalogue vide.* ✅
- [x] **Rendre l'application utilisable à la télécommande** — contour de focus épais
      (3 px blanc + halo rouge, lisible à 3 m) ; les 11 contrôles masqués derrière un
      survol apparaissent désormais au focus ; `<button>` sorti du `<a>` dans
      `ChannelCard` ; raccourcis clavier du lecteur (pavé directionnel, Entrée,
      Retour, touches média) ; `aria-label` sur les 25 boutons en icône seule ;
      lien « Aller au contenu principal »
      → *Critère : 0 bouton icône sans nom, 0 contrôle `group-hover` sans équivalent
      focus, 0 `<div onClick>`, vérifié par script.* ✅
      **Non testé sur un Firestick réel** — validation matérielle en Phase 5.
- [ ] Vérifier les quatre états (chargement / contenu / vide / erreur) sur les 13 écrans
      → *Critère : aucun écran blanc sans explication.*
- [ ] Passer en revue les composants du design system restants
      → *Critère : `eslint` 0 erreur, aucun `any`.*

---

### ⬜ Phase 3 — Stockage IndexedDB et PIN

- [ ] Choisir la couche d'accès (`idb` ou `Dexie`) et justifier le choix
- [ ] Créer le schéma des 12 magasins décrits dans `DOCUMENTATION.md` §7
      → *Critère : écrire puis relire 50 000 chaînes sans figer l'écran.*
- [ ] Écrire la migration de version du schéma
      → *Critère : une base d'ancienne version s'ouvre sans perte.*
- [ ] Implémenter le hachage de PIN — **PBKDF2 via Web Crypto, avec sel**
      → *Critère : aucun PIN en clair, ni en base ni en mémoire durable.*
- [ ] Implémenter la vérification du PIN et le verrouillage des catégories
      → *Critère : un profil enfant ne voit pas les catégories verrouillées.*
- [ ] Suppression en cascade d'une source
      → *Critère : supprimer une playlist ne laisse aucun orphelin.*

---

### ⬜ Phase 4 — Connecteurs Xtream et M3U

- [ ] Finaliser `xtreamService.ts` — authentification, catégories, chaînes, films, séries
      → *Critère : testé contre un vrai serveur fourni par l'utilisateur.*
- [ ] Brancher `m3uParser.ts` à l'interface (il n'est actuellement appelé nulle part)
      → *Critère : importer un fichier M3U réel remplit la grille.*
- [ ] Import depuis un fichier local
- [ ] Barre de progression d'import, annulable
      → *Critère : `onProgress` et `AbortSignal` déjà prêts dans le parseur.*
- [ ] Gestion explicite de l'échec CORS en navigateur
      → *Critère : message clair expliquant que l'APK n'a pas cette limite.*
- [ ] Actualisation d'une source existante sans perdre favoris ni historique

---

### ⬜ Phase 5 — Lecteur vidéo et arbitrage Capacitor

- [ ] Intégrer `hls.js` (`.m3u8`) et `mpegts.js` (`.ts`)
      → *Critère : les deux formats se lisent en navigateur.*
- [ ] Contrôles de lecture pilotables à la télécommande
- [ ] Reprise de lecture — enregistrer la position, la restaurer
      → *Critère : fermer puis rouvrir un film le reprend à la seconde près.*
- [ ] Sélection des pistes audio et sous-titres
- [ ] **Prototype d'arbitrage Capacitor — 2 jours**
      → *Critère de décision : si le Firestick 4K ne tient pas un flux 1080p fluide avec navigation réactive, bascule vers Kotlin natif. Résultat à consigner ici.*
- [ ] Brancher ExoPlayer via `capacitor-video-player` sur Android

---

### ⬜ Phase 6 — Interface, thèmes, performance

- [x] **Thème clair complet** — jetons de couleur (`surface-0..3`, `accent`,
      `line`) ; 161 couleurs figées converties ; `theme: 'light' | 'dark' | 'system'`
      avec suivi du réglage système ; script anti-flash ; sélecteur à trois choix
      dans Réglages ; opacités recalculées pour le thème clair
      → *Critère : contraste ≥ 4,5:1 sur les deux thèmes pour le texte courant,
      vérifié par le calcul WCAG (`/50` et au-delà). Les paliers `/30` et `/40`
      restent sous 4,5:1 dans les **deux** thèmes — ils étaient déjà hors norme
      avant, ils sont désormais au même niveau qu'en sombre. À reprendre avec la
      passe de contraste ci-dessous.* ✅
      **Non vérifié visuellement écran par écran** : aperçu comparatif dans
      `nova-themes-apercu.html`, à confronter aux 16 écrans réels.
- [ ] Passe de contraste sur les textes secondaires : remonter les `text-white/30`
      et `/40` porteurs d'information à `/60` minimum (les `/30`–`/40` sont
      acceptables pour du décoratif, pas pour du texte lu)
      → *Critère : tout texte porteur de sens ≥ 4,5:1 dans les deux thèmes.*
- [ ] Chargement différé des jaquettes + image de repli
      → *Critère : une grille de 200 vignettes défile sans à-coups sur Firestick.*
- [ ] Grille virtualisée pour les longues listes
      → *Critère : 50 000 entrées défilent sans chute de fluidité.*
- [ ] Vérifier le focus visible sur chaque écran
- [ ] Appliquer la marge de sécurité de 5 % (overscan)

---

### ⬜ Phase 7 — Multilingue

- [ ] Choisir la bibliothèque et la structure des fichiers de traduction
- [ ] Extraire **tous** les textes visibles vers des clés
      → *Critère : aucune chaîne visible en dur dans un composant.*
- [ ] Français et anglais complets
- [ ] Préparer le RTL (propriétés logiques CSS)
      → *Critère : forcer `dir="rtl"` ne casse aucune mise en page.*
- [ ] Sélecteur de langue au premier lancement et dans les réglages

---

### ⬜ Phase 8 — Tests et intégration continue

- [ ] Installer le lanceur de tests (Vitest)
- [ ] Tests unitaires de `m3uParser` — **les 18 cas déjà écrits sont à intégrer au dépôt**
- [ ] Tests unitaires de `xtreamService` et `epgService`
- [ ] Tests des couches IndexedDB
- [ ] Intégration continue GitHub Actions — `tsc`, `eslint`, `build`, `test`
      → *Critère : la CI échoue si l'un des quatre échoue.*

---

### ⬜ Phase 9 — Export statique et APK

- [ ] Ajouter `generateStaticParams` aux 3 routes dynamiques — `/live/[id]`, `/movies/[id]`, `/series/[id]`
      → *Bloquant connu : ces routes sont `ƒ` (rendues à la demande) et empêcheront `output: 'export'`.*
- [ ] Activer `output: 'export'` dans `next.config.ts` (bloc déjà présent, commenté)
      → *Critère : `npm run build` produit un dossier `out/` complet.*
- [ ] Initialiser Capacitor, générer le projet Android
- [ ] Déclarer le support **Leanback** dans le manifeste
      → *Critère : l'application apparaît dans le lanceur du Fire TV Stick.*
- [ ] Gérer les touches de télécommande au niveau natif
- [ ] Produire un APK signé
      → *Critère : installé et lancé sur le Firestick 4K de test.*

---

## 3. Journal des décisions

| Date | Décision | Motif |
|---|---|---|
| 2026-08-18 | **La garde `.on-accent` est enfermée dans `html.light`** | Le sélecteur `[class*="bg-accent"].text-white` cible tout élément dont une classe *contient* le texte « bg-accent », y compris les variantes `hover:bg-accent` et `group-hover:bg-accent`. Posé globalement, il forçait `--on-accent` sur des éléments qui ne sont pas sur fond rouge : en thème sombre, un texte censé être blanc devenait blanc sur fond sombre au repos mais perdait la teinte d'accent attendue, d'où l'effet « le rouge a disparu » signalé à l'essai. La règle n'a de raison d'être qu'en thème clair, où `--color-white` vaut presque noir ; elle y est désormais restreinte. |
| 2026-08-18 | **L'aperçu HTML statique est abandonné au profit de la prévisualisation live** | `nova-themes-apercu.html` était une capture du CSS compilé, sans une seule balise `<script>` : aucun bouton n'y était cliquable et le basculement de thème n'y fonctionnait pas. Présenté sans cet avertissement, il se lisait comme une application cassée. Le serveur de développement rend l'application réelle, interactive. |
| 2026-08-18 | **Le thème passe par une seule variable, `--color-white`** | Tailwind v4 ne compile pas `text-white/40` en couleur figée mais en `color-mix(in oklab, var(--color-white) 40%, transparent)` : la teinte est lue à l'exécution. Redéfinir cette variable sous `html.light` bascule les 659 occurrences de blanc sans toucher un seul composant. Le nom « white » devient trompeur en thème clair (il y vaut presque noir) ; le renommer serait un chantier à part. |
| 2026-08-18 | **Script anti-flash injecté dans `<head>`** | La page est produite sur le serveur, qui ignore le thème choisi — il est enregistré dans le navigateur. Sans ce script, l'application s'affiche en sombre puis repeint en clair à chaque ouverture. Le script lit la préférence et pose la classe avant le premier affichage. |
| 2026-08-18 | **Opacités relevées en thème clair** | L'œil ne perçoit pas les deux sens de la même façon : du blanc à 40 % sur noir donne un contraste de 3,81, du noir à 40 % sur blanc seulement 2,71. Sans rattrapage, tous les textes secondaires devenaient de vagues gris. Chaque palier a été recalculé par la formule de luminance WCAG pour égaler le thème sombre. |
| 2026-08-18 | **Défaut sur « suivre le système »** plutôt que sombre | Le réglage du téléviseur ou du téléphone bascule souvent en sombre le soir ; l'application doit suivre sans intervention. |
| 2026-08-18 | **Le défilement suit le focus via un écouteur unique** | Les 14 rangées `overflow-x-auto` auraient demandé 14 corrections identiques. Un seul écouteur `focusin` posé sur le `document` les couvre toutes, et couvrira les rangées à venir. `scrollIntoView` en mode `nearest` ne déplace que le strict nécessaire, ce qui le rend sans effet indésirable à la souris. |
| 2026-08-18 | **Suppression de `.scroll-x`** | Classe morte (aucun usage) qui imposait `scroll-snap-type: x mandatory`. L'aimantation entre en conflit avec le défilement au focus : la rangée se recale après coup sur une autre carte que celle sélectionnée. |
| 2026-08-18 | **Tout contrôle révélé au survol doit l'être au focus** | Une télécommande ne produit jamais d'événement `hover`. Le bouton lecture et le bouton favori des cartes étaient en `opacity-0 group-hover:opacity-100` : ils existaient dans le DOM, recevaient le focus, mais restaient invisibles — inutilisables sur Firestick, la cible n°1. Ajout de `group-focus-within` et `focus-visible`. |
| 2026-08-18 | **Contour de focus 3 px blanc + halo rouge** | Le liseré de 2 px d'origine convenait à un écran d'ordinateur à 50 cm. Sur un téléviseur regardé à 3 m, le repère indiquant où l'on se trouve doit être massif, sinon on navigue à l'aveugle. |
| 2026-08-18 | **`<button>` sorti du `<a>` dans `ChannelCard`** | Un bouton imbriqué dans un lien est du HTML invalide : le comportement du clic et de la touche Entrée dépend du navigateur. Le bouton favori devient un frère du lien. |
| 2026-08-18 | **Écoute clavier au niveau du `document` dans le lecteur** | Attacher les raccourcis à un élément précis n'aurait rien déclenché tant que cet élément n'a pas le focus. Le lecteur intercepte Entrée, espace, le pavé directionnel, les touches média, et `Escape`/`Backspace` (le bouton retour des télécommandes Fire TV et Android TV), en sortant d'abord du plein écran. La saisie de texte est exclue pour ne pas détourner les touches d'un champ. |
| 2026-08-18 | **Incrémenter `version` et fournir `migrate` en supprimant les mocks** | Le middleware `persist` de Zustand recopie l'état dans le `localStorage`. Retirer les données de démonstration du code ne les efface pas chez qui a déjà ouvert l'application : Zustand n'appelle `migrate` que si la version enregistrée diffère. `novatv-storage` passe de la version 0 (implicite) à 1. |
| 2026-08-18 | **Catégories, suggestions et historique de recherche dérivés du catalogue** | Des genres figés (`Science-Fiction`, `Drame`…) et des recherches récentes en dur (`Interstellar`, `PSG`, `Succession`) sont eux aussi des données de démonstration : ils proposent à l'utilisateur des filtres qui ne renverront jamais rien. |
| 2026-08-18 | **`liveCategories`, `seasons`, `episodes`, `epgPrograms` ajoutés au store** | Quatre écrans lisaient ces collections directement depuis les mocks ; sans emplacement dans le store, leur suppression aurait imposé des tableaux vides locaux, impossibles à alimenter en Phase 4. |
| 2026-08-18 | **Dépendances `useMemo` manquantes corrigées** | Tant que les données étaient des constantes de module, l'omission était sans effet. Désormais alimentées par le store, les listes seraient restées figées à l'état vide au chargement du catalogue : l'avertissement `exhaustive-deps` signalait un vrai bug. |
| 2026-08-18 | **`useSyncExternalStore` au lieu de `useState` + `useEffect`** dans `useDeviceType` | Le linter React 19 refuse un `setState` synchrone dans un effet (rendus en cascade). Cette API est faite pour lire une valeur extérieure à React ; elle supprime aussi le décalage d'hydratation et partage un seul jeu d'écouteurs. |
| 2026-08-18 | **Le double `j++` de l'audit n'est pas un bug** | Vérifié sur 5 000 chaînes : l'ancien code en retournait 5 000. Le vrai défaut de la fonction était le traitement des lignes `#EXTVLCOPT`. |
| 2026-08-18 | **Analyseur M3U : boucle `while` à index explicite** | Le `j++` à l'intérieur d'un `for` qui incrémente déjà `j` est ambigu à relire, même s'il fonctionnait. |
| 2026-08-18 | **`DOCUMENTATION.md` et `PROGRESSION.md` placés dans le dépôt** | Le README pointait vers `../DOCUMENTATION.md`, hors du dépôt git : les documents n'auraient pas été versionnés. Liens corrigés. |
| 2026-08-18 | Grille téléviseur à **5 colonnes**, pas 6 | Écran grand mais regardé à 3 m : les vignettes doivent grossir, pas se multiplier. |
| 2026-08-18 | **Ne jamais déduire « téléviseur » d'une largeur** | La règle ≥ 1920 classait un PC 1080p en TV et ratait le Firestick (960/1280 pt CSS). |
| 2026-08-18 | Effet « verre » **désactivé sur téléviseur** | `backdrop-filter` fait chuter la fluidité du défilement sur Firestick. |
| 2026-08-18 | **Ne pas lancer `npm audit fix --force`** | Forcerait `next@16.3.1`. Les 3 vulnérabilités restantes sont internes à Next. Dette documentée. |
| 2026-08-18 | Règle ESLint `no-img-element` **désactivée**, justification inscrite | `next/image` exige un serveur Node (incompatible export statique) et une liste blanche de domaines (impossible : serveurs des utilisateurs). Faire transiter ces images par notre infra contredirait la position juridique. |
| 2026-08-18 | Suppression du **backend complet** | La synchronisation multi-appareils est écartée : PostgreSQL, Drizzle, routes API, authentification et hébergement deviennent inutiles. Phase 3 initiale : 3 semaines → ~3 jours. |
| 2026-08-18 | **Capacitor** retenu pour démarrer | Réutilise le code web existant. Porte de sortie vers Kotlin natif via un prototype d'arbitrage en Phase 5. |
| 2026-08-18 | **`react-player` abandonné** | Ne gère pas le MPEG-TS, format majoritaire en IPTV. Remplacé par `hls.js` + `mpegts.js`. |
| 2026-08-18 | **Apple TV hors périmètre v1** | tvOS n'a pas de navigateur : ni PWA ni Capacitor. Exigerait une application Swift native. |
| 2026-08-18 | **iPhone / iPad hors périmètre pratique v1** | Compiler pour iOS exige un Mac, non disponible. |
| 2026-08-18 | Matériel de test : **Fire TV Stick 4K + mobile Android** | Définit les cibles prioritaires réellement vérifiables. |
| 2026-08-18 | Hachage de PIN : **PBKDF2 via Web Crypto, avec sel** | Aucune dépendance externe, disponible partout. Implémentation en Phase 3. |
| 2026-08-18 | **`xtreamService.ts` réécrit** | Réponses typées en `camelCase` alors que `player_api.php` renvoie du `snake_case` : ces champs valaient tous `undefined` à l'exécution. Conversion explicite, erreurs typées, encodage des URL. 33/33 tests. |
| 2026-08-18 | **`epgService.ts` réécrit** | Fuseau absent traité comme UTC (programmes décalés d'1 h en hiver, 2 h en été) et appariement quadratique (2 559 ms sur 20k×15k → 35 ms via index `Map`). 23/23 tests. |

---

## 4. Blocages et points ouverts

| Sujet | État | Détail |
|---|---|---|
| **CORS en navigateur** | Limite acceptée | La plupart des serveurs IPTV n'autorisent pas les appels croisés. La version web ne pourra pas charger toutes les listes. L'APK n'a pas cette limite — c'est la raison principale du choix APK. |
| **Firestick : puissance** | À trancher en Phase 5 | Prototype d'arbitrage de 2 jours. Si Capacitor ne tient pas, bascule Kotlin. |
| **Routes dynamiques** | Bloquant connu, Phase 9 | Les 3 routes `[id]` empêcheront `output: 'export'` sans `generateStaticParams`. |
| **Serveur IPTV de test** | Manquant | Impossible de valider `xtreamService` de bout en bout sans un vrai compte. **À fournir par l'utilisateur.** |
| **Tizen / WebOS** | Non évalué | Chaque constructeur impose son SDK et sa validation. Aucune promesse tant que ce n'est pas vérifié. |
| **`m3uParser` non branché** | Normal à ce stade | Corrigé et testé, mais appelé nulle part. Branchement en Phase 4. |

---

## 5. Checklist de mise en production

### Sécurité

- [ ] Aucun secret dans le code **ni dans l'historique git**
- [ ] Aucun PIN en clair, hachage PBKDF2 vérifié
- [ ] En-têtes HTTP de sécurité actifs *(fait en Phase 1)*
- [ ] Toute saisie utilisateur validée
- [ ] `npm audit` relu et chaque exception justifiée
- [ ] Keystore Android stocké hors du dépôt *(déjà couvert par `.gitignore`)*

### Qualité

- [ ] `tsc --noEmit` — 0 erreur
- [ ] `eslint .` — 0 erreur
- [ ] `npm run build` — succès
- [ ] Tests unitaires au vert
- [ ] CI configurée et bloquante

### Fonctionnel

- [ ] Compte Xtream réel : connexion, catégories, lecture
- [ ] Fichier M3U réel de plus de 10 000 chaînes : import complet
- [ ] Reprise de lecture exacte après fermeture
- [ ] Contrôle parental infranchissable sans le PIN
- [ ] Les 4 états présents sur les 13 écrans

### Plateforme

- [ ] APK installé et lancé sur **Fire TV Stick 4K**
- [ ] Navigation intégralement à la télécommande, focus jamais perdu
- [ ] Application visible dans le lanceur TV (Leanback)
- [ ] APK testé sur **mobile Android**
- [ ] Thèmes clair et sombre vérifiés sur les deux appareils
- [ ] Français et anglais complets, aucun texte en dur

### Juridique

- [ ] Aucune liste, aucun flux, aucun compte de démonstration réel livré
- [ ] Mentions légales : l'application est un lecteur, l'utilisateur fournit ses sources
- [ ] Conditions d'utilisation rédigées
- [ ] Politique de confidentialité — préciser que **rien ne sort de l'appareil**

---

*Prochaine session : Phase 2 — revue des quatre états sur les 13 écrans, puis composants restants du design system.*
