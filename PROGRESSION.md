# NOVA TV — Suivi de progression

> **Tableau de bord du projet, de l'état actuel au déploiement complet.**
> Mis à jour à chaque session de travail ou sur demande.
>
> Documents liés : `AUDIT_NOVA_IPTV.md` (état initial, figé) · `DOCUMENTATION.md` (référence technique)

**Dernière mise à jour :** 29 août 2026
**Commit audité :** `57f4e3e`
**Phase en cours :** mise à jour de la progression réelle du projet

---

## Vue d'ensemble

```
Avancement global : socle applicatif avancé — validation production non terminée

Phase  1  Sécurisation & nettoyage      ⚠️ partiel             ~2 j
Phase  2  Bugs bloquants                ✅ vérifié côté code    ~2 j
Phase  3  Stockage local                ⚠️ IndexedDB maison     ~4 j
Phase  4  Sources IPTV réelles           ⚠️ code présent, réel ❓ ~8 j
Phase  5  Lecteur vidéo                  ⚠️ web présent, réel ❓  ~9 j
Phase  6  Interface & performance        ⚠️ partiel              ~6 j
Phase  7  Multilingue & thèmes           ⚠️ partiel              ~4 j
Phase  8  Adaptation TV                  ⚠️ code présent, réel ❓  ~8 j
Phase  9  APK Capacitor                  ⚠️ config seulement      ~7 j
Phase 10  Tests, publication, suite      ⚠️ tests unitaires seuls ~6 j
                                                    ─────────
                                        Total ≈ 56 jours ouvrés
                                              ≈ 7 semaines à 35 h
```

**Note sur les 15 %.** L'audit initial estimait 20-25 % pour un produit web complet avec serveur. Le périmètre a changé — application locale, APK, multilingue, deux thèmes — donc le dénominateur a bougé. Le travail déjà fait (design system, types, structure) reste entièrement valable.

---

## Ce qui existe déjà et sera conservé

| Élément | État | Valeur |
|---|---|---|
| `src/types/index.ts` (387 l.) | ✅ Excellent | Modèle de domaine complet, réutilisable tel quel |
| `src/design-system/` (11 composants) | ✅ Bon | Base solide, quelques bugs à corriger |
| Structure `app/` → `features/` | ✅ Bon | Architecture saine, à conserver |
| 18 routes générées | ✅ Vérifié | Routes applicatives et légales présentes |
| `src/services/` (Xtream, M3U, XMLTV) | ⚠️ Présent, réel non vérifié | Services et synchronisations présents |
| `src/store/useAppStore.ts` | ⚠️ Fonctionnel | Catalogue séparé vers IndexedDB maison |
| Configuration TypeScript stricte | ✅ | 0 erreur de type |

---

## Ce qui est retiré du projet

| Élément | Motif | Phase |
|---|---|---|
| `src/db/` (Drizzle + Postgres) | Aucun serveur dans l'architecture locale | 1 |
| `src/app/api/` | Aucune route serveur nécessaire | 1 |
| `drizzle-orm`, `drizzle-kit`, `pg`, `dotenv` | Sans objet | 1 |
| `drizzle.config.json` | Contient des identifiants en dur | 1 |
| `react-player` | Remplacé par hls.js / mpegts.js / ExoPlayer | 5 |
| Mocks dans l'état initial | Fausses données présentées comme réelles | 4 |

⚠️ **Aucune suppression sans confirmation explicite au moment de l'exécution.**

---

## PHASE 1 — Sécurisation et nettoyage · ~2 jours

**Branche :** `fix/p0-securite` · **Objectif :** un dépôt propre, sans risque, prêt à recevoir du code.

- [x] `.gitignore` présent — à maintenir
- [x] `.env.example` présent
- [x] `README.md` présent
- [ ] Renommer le projet dans `package.json` (`nextjs-postgresql-template` → `nova-tv`)
- [x] Export statique et images non optimisées configurés
- [ ] En-têtes de sécurité à appliquer sur l’hébergement
- [x] `public/`, favicon, icônes et manifeste présents
- [ ] Supprimer `drizzle.config.json`, `src/db/`, `src/app/api/` ⚠️ *sur confirmation*
- [ ] Désinstaller les dépendances serveur
- [ ] Mettre en place la CI GitHub Actions (lint + typecheck + build)

**Validation :** `npm run lint`, `npm run typecheck`, `npm run build` passent · aucune erreur 404 · aucun secret versionnable.
**Risque :** très faible, aucune logique applicative touchée.

---

## PHASE 2 — Bugs bloquants · ~2 jours

**Branche :** `fix/p0-bugs` · **Objectif :** plus aucune erreur, plus aucun crash possible.

- [ ] `Navigation.tsx:190` — hook appelé après un retour anticipé (**risque de crash réel**)
- [ ] `ProfilesPage.tsx:118` — `<a href="/">` → `<Link>`
- [ ] Apostrophes non échappées (`PlaylistsPage`, `SettingsPage` ×3)
- [ ] `HeroBanner.tsx:28` — `setState` direct dans un effet
- [ ] Réécrire `useDeviceType` : détection TV correcte, fuite mémoire, throttle
- [ ] Ajouter `error.tsx`, `loading.tsx`, `not-found.tsx`, `global-error.tsx`
- [ ] Ajouter l'export `viewport` dans `layout.tsx`

**Validation :** `npx eslint .` → **0 erreur, 0 avertissement** · rotation d'écran mobile sans crash · 16 routes sans erreur console.

---

## PHASE 3 — Stockage local · ~4 jours

**Branche :** `feat/stockage-local` · **Objectif :** remplacer localStorage (5 Mo) par IndexedDB (plusieurs Go).

- [x] Stockage IndexedDB maison présent (Dexie non utilisé)
- [x] `src/lib/catalogStore.ts` gère le stockage du catalogue
- [ ] Chiffrement effectif des identifiants IPTV — le stockage actuel est en clair
- [ ] Adapter `useAppStore` : Zustand pour l'interface, Dexie pour les données
- [ ] Migration automatique depuis l'ancien localStorage
- [ ] Gestion complète de version et migration du schéma

**Validation :** 50 000 chaînes écrites et relues sans ralentissement · données conservées après fermeture · identifiants illisibles en clair dans l'inspecteur.
**Risque :** modéré — touche le cœur de l'état applicatif. À faire en commits séparés.

---

## PHASE 4 — Sources IPTV réelles · ~8 jours

**Branche :** `feat/sources-iptv` · **Objectif :** l'application se connecte enfin à une vraie source.

### Xtream Codes
- [x] `xtreamService` et `xtreamSync` présents et testés unitairement
- [ ] **Test de connexion réel** — remplacer le faux succès systématique
- [ ] Import : catégories, chaînes, films, séries
- [ ] Gestion des erreurs : identifiants invalides, serveur injoignable, compte expiré

### M3U
- [x] `m3uParser` et `m3uSync` présents et testés unitairement
- [ ] Import par URL et par fichier local
- [ ] Analyse dans un Web Worker (interface non figée)
- [ ] Écriture par lots de 500

### EPG
- [x] `epgService` et `epgSync` présents et testés unitairement
- [ ] Association programmes ↔ chaînes, gestion des fuseaux horaires
- [ ] Rafraîchissement automatique

### Interface
- [ ] Retirer les mocks de l'état initial ⚠️ *validé par le porteur, à faire ici*
- [ ] Mode démo explicitement étiqueté
- [ ] Écran de première ouverture (choix du mode de connexion)
- [ ] Boutons réellement fonctionnels : ajouter, synchroniser, modifier, supprimer
- [ ] Barre de progression réelle et annulable
- [ ] Les quatre états sur les 16 écrans

**Validation :** une source Xtream réelle s'importe · un mauvais mot de passe **échoue vraiment** · un M3U de 50 000 lignes s'importe sans figer l'interface · aucune donnée fictive.
**Risque :** élevé — nombreuses régressions visuelles attendues (les composants n'ont jamais vu de listes vides).

---

## PHASE 5 — Lecteur vidéo · ~9 jours

**Branche :** `feat/lecteur` · **Objectif :** la vidéo se lit réellement. **C'est la phase qui transforme la maquette en produit.**

### Abstraction
- [ ] Définir le contrat commun (`load`, `play`, `pause`, `seek`, `volume`, pistes, qualité, événements)

### Moteur web
- [x] `hls.js` et `mpegts.js` installés et utilisés par le lecteur web
- [ ] Détection automatique du format (`.m3u8` → HLS, `.ts` → MPEG-TS)
- [ ] HLS natif sur Safari
- [ ] Reconnexion automatique avec délai progressif
- [ ] Indicateur de mise en mémoire tampon
- [ ] Sélection de qualité, pistes audio, sous-titres

### Interface
- [x] `PlayerPage.tsx` utilise le lecteur vidéo réel
- [ ] Contrôles réellement câblés (ils ne pilotent aujourd'hui que du décor)
- [ ] Sauvegarde de position toutes les ~10 s
- [ ] Reprise de lecture · épisode suivant · zapping chaîne ±1
- [ ] Raccourcis clavier et touches média

### Natif
- [ ] Évaluer les plugins ExoPlayer existants
- [ ] ⚠️ **Décision :** plein écran natif (simple, perd le design) ou plugin maison (garde le design, +3-4 j)
- [ ] Brancher ExoPlayer derrière le contrat commun

**Validation :** lecture d'une chaîne live, d'un film, d'un épisode · reprise exacte après fermeture · coupure réseau récupérée sans plantage · **test sur Firestick concluant**.
**Risque :** élevé. DRM hors périmètre. Les performances Firestick sont le point de vérité.

---

## PHASE 6 — Interface et performance · ~6 jours

**Branche :** `feat/perf-ui`

- [ ] Virtualisation des longues listes (`@tanstack/react-virtual`)
- [ ] Optimisation des images (12 emplacements en `<img>` brut)
- [ ] Brancher réellement les préférences (`glassEnabled`, animations, qualité par défaut…)
- [ ] Brancher `fuse.js` (recherche tolérante aux fautes) + historique persisté
- [ ] Zones sûres iOS complètes
- [ ] Gestes tactiles du lecteur
- [ ] Verrouillage paysage en lecture

**Validation :** 50 000 chaînes défilent à 60 images/s · mémoire stable · recherche instantanée.

---

## PHASE 7 — Multilingue et thèmes · ~4 jours

**Branche :** `feat/i18n-themes`

- [ ] Installer `i18next` + `react-i18next`
- [ ] Extraire **toutes** les chaînes de caractères des composants
- [ ] Traductions FR, EN, ES (anglais = langue de secours)
- [ ] Détection de la langue système + choix manuel persisté
- [x] Variables CSS et thèmes clair/sombre présents
- [x] Thème clair présent — validation visuelle complète à poursuivre
- [x] Sélecteur clair / sombre / système présent

**Validation :** aucun texte en dur · les trois langues complètes · les deux thèmes lisibles partout.

---

## PHASE 8 — Adaptation TV · ~8 jours

**Branche :** `feat/tv`

- [x] Détection TV par identifiant navigateur présente — appareils réels non vérifiés
- [ ] Navigation directionnelle à la télécommande
- [ ] Défilement automatique vers l'élément focalisé (**obligatoire**)
- [ ] Focus par défaut sur chaque écran
- [ ] Touche Retour = reculer, jamais quitter sans confirmation
- [ ] Touches média
- [ ] Thème TV : texte ×1,5, cibles ≥ 48 px, marge de sécurité 5 %
- [ ] Désactivation automatique du flou (coûteux en GPU)
- [ ] Mode mémoire réduite

**Validation :** **parcours complet à la télécommande uniquement, sans souris**, sur Android TV et Firestick · focus jamais perdu, jamais hors écran.
**Risque :** élevé — aucune ligne d'accessibilité n'existe aujourd'hui (0 occurrence de `tabIndex`, `aria-`, `onKeyDown` dans tout le projet).

---

## PHASE 9 — APK Capacitor · ~7 jours

**Branche :** `feat/capacitor`

- [x] Next.js utilise déjà `output: 'export'`
- [x] Capacitor est configuré — projet Android non généré
- [ ] Générer le projet Android
- [ ] Icônes et écran de démarrage (téléphone + bannière TV)
- [ ] Déclarer le lancement TV (`LEANBACK_LAUNCHER`)
- [ ] Permissions minimales (Internet uniquement)
- [ ] Gestion du bouton Retour Android
- [ ] Maintien de l'écran allumé pendant la lecture
- [ ] Signature de l'APK ⚠️ *la clé ne doit jamais être versionnée*
- [ ] Build de production
- [ ] Installation et test : téléphone Android, Android TV, **Firestick**

**Validation :** l'APK s'installe et fonctionne sur les trois appareils · la lecture est fluide · l'app apparaît correctement dans le lanceur TV.

---

## PHASE 10 — Tests, publication et suite · ~6 jours

**Branche :** `feat/tests` puis `release/v1`

- [x] Vitest : 29 fichiers et 690 tests réussis
- [ ] Playwright : parcours critiques
- [ ] CI complète
- [ ] Vitrine web sur Cloudflare Pages (gratuit)
- [ ] Préparer la couche licence (**désactivée**, prête à brancher)
- [x] Pages de mentions légales, CGU et confidentialité présentes — revue finale à faire
- [ ] Documentation utilisateur
- [ ] Version 1.0.0 étiquetée

**Après la v1 :** iOS/iPad · synchronisation premium · activation de la licence · Chromecast · Apple TV (Swift natif) · téléchargement hors ligne.

---

## Journal des décisions

| Date | Décision | Conséquence |
|---|---|---|
| 17/08 | Lecteur uniquement, aucun abonnement vendu | Position juridique solide |
| 17/08 | **Pas de synchronisation multi-appareils en v1** | Backend, base et authentification **supprimés** — 3 semaines économisées |
| 17/08 | **APK = produit final ; web = développement et vitrine** | Problème CORS éliminé, aucun relais serveur, aucun risque juridique |
| 17/08 | 20 000 à 50 000 chaînes | IndexedDB + virtualisation ; pas de parsing en flux complexe |
| 17/08 | FR / EN / ES | Pas de droite-à-gauche |
| 17/08 | **ExoPlayer natif pour l'APK**, hls.js pour le web | Meilleure qualité sur TV, développement rapide |
| 17/08 | Licence premium préparée mais désactivée | ~1 jour maintenant, 3 économisés plus tard |
| 17/08 | Contrôle parental : souhaité, non bloquant | Phase 6 ou 7 |
| 17/08 | Design conservé et affiné | Aucune refonte visuelle |
| 17/08 | Nom public sans le mot « IPTV » | Évite les rejets en boutique d'applications |
| 17/08 | Aucun hébergement payant | 0 €/mois |

---

## En attente de décision

| # | Sujet | Échéance |
|---|---|---|
| 1 | Contrôles vidéo dans l'APK : natif ou plugin maison | Phase 5 |
| 2 | Présence de DRM sur les sources réelles | Premiers tests |
| 3 | Sort des dépendances inutilisées (`@radix-ui`, `framer-motion`, `date-fns`) | Phase 6 |
| 4 | Charte graphique formalisée | À définir ensemble |
| 5 | Nom définitif : Nova TV ou Nova Player | Avant Phase 9 |

---

## Journal des sessions

### Session 1 — 17 août 2026
- Audit complet du dépôt (68 fichiers, 6 586 lignes) → `AUDIT_NOVA_IPTV.md`
- Cadrage produit et technique via questions/réponses
- Bascule d'architecture : application locale, plus de serveur
- Rédaction de `DOCUMENTATION.md` et `PROGRESSION.md`
- Prévisualisation live mise en place (Next.js 16.2.6, port 3000)
- Incident : `npx` a modifié `next-env.d.ts` et `package-lock.json` → **restaurés par `git checkout`**, dépôt intact
- **Aucun fichier du projet modifié**

**Prochaine étape :** sécuriser les secrets IPTV, puis valider les sources et le lecteur avec des données réelles.
