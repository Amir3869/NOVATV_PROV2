# NOVA TV — Suivi de progression

> Suivi de l'état réel du repository et des prochaines étapes.
>
> Dernière mise à jour : 15 septembre 2026
> Commit audité : `6b08ec8`
> Branche : `main`

---

## 1. Statut global

NOVA TV est un **prototype avancé en pré-production**.

Le projet contient désormais :

- une application Next.js exportée statiquement ;
- une architecture App Router ;
- des sources Xtream et M3U ;
- une synchronisation EPG ;
- un stockage IndexedDB custom ;
- des profils et un contrôle parental local ;
- des favoris, listes, historique et reprise ;
- un player Web réel ;
- un player VOD natif Android avec ExoPlayer ;
- un projet Capacitor Android ;
- des pages TV DIRECT, FILMS, SERIES, EPG, player et réglages.

Le projet n'est pas encore une release de production. Les principales raisons sont :

- secrets locaux non chiffrés ;
- lint en échec ;
- un test unitaire rouge ;
- lockfile désynchronisé ;
- validation des sources réelles incomplète ;
- Firestick et Android TV non validés dans le repository ;
- navigation télécommande non démontrée ;
- design global encore à améliorer ;
- absence de suite E2E complète.

---

## 2. Résultats de validation de l'audit

| Commande | Résultat | Commentaire |
|---|---|---|
| `npm run typecheck` | ✅ Réussi | Validation effectuée avec Node 20.20.2 |
| `npm run build` | ✅ Réussi | Export statique généré |
| `npm run lint` | ❌ Échec | 5 erreurs React Compiler + 1 avertissement |
| `npm test -- --reporter=dot` | ⚠️ 828/829 | Échec dans `sourceIdentity.test.ts` |
| `npm ci` | ❌ Échec | `package.json` et lockfile désynchronisés |

> Le projet exige Node.js `>=22.0.0`, mais l'audit a été exécuté avec Node `20.20.2`. Les validations doivent être rejouées sous Node 22+.

### Défauts lint connus

- `src/features/player/PlayerPage.tsx:335` ;
- `src/features/player/PlayerPage.tsx:350` ;
- `src/features/player/PlayerPage.tsx:653` ;
- `src/features/player/PlayerPage.tsx:840` ;
- `src/features/player/PlayerPage.tsx:848` ;
- avertissement de dépendance dans `src/features/player/useVideoPlayer.ts:757`.

### Test rouge connu

```text
src/services/playlists/sourceIdentity.test.ts:98
```

Le test concerne la normalisation d'URLs M3U et doit être clarifié avant correction : le slash final se trouve dans une valeur de requête.

---

## 3. Légende

- ✅ Présent dans le code et suffisamment structuré ;
- ⚠️ Présent mais partiel ou non validé en conditions réelles ;
- ❌ Absent ou non commencé ;
- 🧪 À tester sur source, appareil ou matériel réel ;
- 🔐 Risque de sécurité ;
- 🎨 Travail design/UX/UI.

---

## 4. Fonctionnalités terminées au niveau du code

### Architecture et application

- [x] Next.js App Router ;
- [x] export statique ;
- [x] routes principales ;
- [x] séparation `app`, `features`, `services`, `store`, `lib` ;
- [x] TypeScript strict sans erreur de type observée ;
- [x] projet Capacitor Android présent ;
- [x] plugins Android enregistrés.

### Sources

- [x] service Xtream ;
- [x] synchronisation Xtream ;
- [x] parser M3U ;
- [x] synchronisation M3U ;
- [x] catégories ;
- [x] chaînes ;
- [x] films ;
- [x] séries ;
- [x] saisons et épisodes ;
- [x] EPG/XMLTV ;
- [x] progression d'import ;
- [x] annulation de certaines opérations ;
- [x] gestion des erreurs et timeouts au niveau service.

### Stockage

- [x] IndexedDB custom pour catalogue et EPG ;
- [x] restauration du catalogue ;
- [x] persistance Zustand ;
- [x] migrations d'état ;
- [x] profils ;
- [x] favoris ;
- [x] historique ;
- [x] listes personnalisées ;
- [x] préférences ;
- [x] organisation des catégories.

### Interface

- [x] accueil ;
- [x] onboarding ;
- [x] TV DIRECT ;
- [x] FILMS ;
- [x] SERIES ;
- [x] EPG ;
- [x] player ;
- [x] profils ;
- [x] favoris ;
- [x] historique ;
- [x] recherche ;
- [x] listes ;
- [x] sources ;
- [x] réglages ;
- [x] pages légales ;
- [x] skeletons et états vides sur plusieurs écrans ;
- [x] thème clair et sombre ;
- [x] traductions custom.

### Player

- [x] `<video>` Web ;
- [x] hls.js ;
- [x] mpegts.js ;
- [x] play/pause ;
- [x] volume et mute ;
- [x] seek VOD ;
- [x] progression ;
- [x] reprise ;
- [x] qualité lorsqu'elle est exposée ;
- [x] audio et sous-titres lorsqu'ils sont exposés ;
- [x] EPG ;
- [x] zapping ;
- [x] épisode suivant ;
- [x] vitesse ;
- [x] sleep timer ;
- [x] verrouillage des contrôles ;
- [x] ExoPlayer/Media3 natif pour VOD Android ;
- [x] mode immersif et wake lock présents dans le code.

---

## 5. Fonctionnalités partielles

### Sources IPTV

- [x] code Xtream présent ;
- [x] code M3U présent ;
- [x] code EPG présent ;
- [ ] validation complète avec source M3U réelle ;
- [ ] validation complète avec Xtream réel ;
- [ ] validation des comptes expirés ;
- [ ] validation des serveurs HTTP instables ;
- [ ] validation des fuseaux EPG ;
- [ ] import M3U dans un Web Worker ;
- [ ] stratégie complète de reprise après interruption.

### Sécurité

- [x] abstraction `secureStore` ;
- [x] PIN haché lorsque Web Crypto est disponible ;
- [ ] stockage sécurisé réel des mots de passe ;
- [ ] PIN demandé avant passage vers un profil adulte ;
- [ ] progression isolée strictement par profil ;
- [ ] configuration release sans debugging WebView ;
- [ ] politique de backup Android ;
- [ ] headers de sécurité effectivement appliqués ;
- [ ] analyse complète de l'exposition des credentials dans les URLs.

### Player

- [x] player Web réel ;
- [x] player VOD natif présent ;
- [ ] reconnexion progressive après coupure ;
- [ ] validation codecs ;
- [ ] validation AC-3/E-AC-3 ;
- [ ] validation commandes natives rapprochées ;
- [ ] validation Firestick ;
- [ ] validation Android TV ;
- [ ] validation DRM hors périmètre.

### Design et UX

- [x] design system de base ;
- [x] composants réutilisables ;
- [x] pages TV DIRECT, FILMS, SERIES et player ;
- [ ] direction artistique globale validée ;
- [ ] refonte de la barre de navigation ;
- [ ] harmonisation des boutons et cartes ;
- [ ] harmonisation TV DIRECT/FILMS/SERIES ;
- [ ] refonte réglages, profils et sources ;
- [ ] amélioration EPG ;
- [ ] amélioration du player ;
- [ ] revue complète des états vides et erreurs ;
- [ ] génération et validation de références visuelles ;
- [ ] validation mobile et TV.

---

## 6. Problèmes prioritaires

### P1 — avant production

- [ ] corriger les erreurs ESLint de `PlayerPage.tsx` ;
- [ ] corriger la dépendance de `useVideoPlayer.ts` ;
- [ ] clarifier et corriger le test `sourceIdentity` ;
- [ ] réaligner `package.json` et `package-lock.json` ;
- [ ] utiliser Node 22+ pour la validation officielle ;
- [ ] protéger le passage vers un profil adulte par PIN ;
- [ ] isoler la progression par profil ;
- [ ] traiter la course possible du player natif ;
- [ ] remplacer les CTA inertes ;
- [ ] tester M3U, Xtream et EPG réels ;
- [ ] valider Android TV, Firestick et télécommande.

### P2 — important

- [ ] évaluer le catalogue monolithique IndexedDB ;
- [ ] réduire les réécritures intégrales ;
- [ ] étudier un Web Worker M3U ;
- [ ] renforcer le fallback PIN ;
- [ ] remplacer les erreurs de stockage silencieuses par un état diagnostiquable ;
- [ ] brancher ou retirer Fuse.js ;
- [ ] optimiser les images et le cache ;
- [ ] compléter les traductions ;
- [ ] ajouter les error boundaries App Router ;
- [ ] compléter la recherche persistante.

### P3 — amélioration

- [ ] animations et transitions ;
- [ ] micro-interactions ;
- [ ] charte graphique formalisée ;
- [ ] documentation utilisateur ;
- [ ] nettoyage des dépendances inutilisées ;
- [ ] amélioration de la vitrine Web ;
- [ ] préparation Samsung Tizen et iOS après stabilisation Android.

---

## 7. Roadmap validée : design-first

### Phase 0 — Documentation réelle

Objectif : aligner les trois documents sur le code existant.

- [x] auditer le repository ;
- [x] comparer README, DOCUMENTATION et PROGRESSION ;
- [x] identifier les fonctionnalités réelles ;
- [x] identifier les affirmations obsolètes ;
- [x] documenter les validations et limites connues.

### Phase 1 — Design global, UX et UI

Objectif : stabiliser l'expérience avant les travaux de durcissement suivants.

Périmètre :

- [ ] navigation principale ;
- [ ] barre de navigation ;
- [ ] boutons ;
- [ ] cartes ;
- [ ] catégories ;
- [ ] recherche ;
- [ ] réglages ;
- [ ] profils ;
- [ ] sources ;
- [ ] onboarding ;
- [ ] TV DIRECT ;
- [ ] FILMS ;
- [ ] SERIES ;
- [ ] EPG ;
- [ ] player ;
- [ ] favoris ;
- [ ] historique ;
- [ ] listes ;
- [ ] états de chargement ;
- [ ] états vides ;
- [ ] états d'erreur ;
- [ ] responsive ;
- [ ] focus TV ;
- [ ] génération de propositions visuelles ;
- [ ] validation d'une direction artistique.

Méthode :

```text
Analyse
→ questions UX
→ suggestions
→ références visuelles
→ validation
→ modification du design system
→ implémentation écran par écran
→ tests visuels
```

### Phase 2 — Sécurité et P1

- [ ] stockage sécurisé des secrets ;
- [ ] PIN parental global ;
- [ ] isolation par profil ;
- [ ] configuration Android release ;
- [ ] cleartext et mixed content documentés ;
- [ ] lint vert ;
- [ ] test unitaire vert ;
- [ ] lockfile reproductible ;
- [ ] player natif sécurisé ;
- [ ] suppression des CTA inertes.

### Phase 3 — Validation des sources

Ordre prévu :

1. source M3U autorisée ;
2. EPG associé ;
3. TV DIRECT ;
4. player live ;
5. APK Android ;
6. source Xtream autorisée ;
7. films ;
8. séries ;
9. épisodes ;
10. reprise et erreurs réseau.

### Phase 4 — Android TV et Firestick

- [ ] APK release ;
- [ ] lanceur TV ;
- [ ] focus initial ;
- [ ] navigation D-pad ;
- [ ] scroll automatique ;
- [ ] touche Retour ;
- [ ] contrôles player télécommande ;
- [ ] tailles et marges TV ;
- [ ] limitation des effets GPU ;
- [ ] test téléphone ;
- [ ] test Android TV ;
- [ ] test Firestick.

### Phase 5 — Tests complets

- [ ] corriger tous les tests unitaires ;
- [ ] lint sans erreur ;
- [ ] build Node 22+ ;
- [ ] tests E2E ;
- [ ] tests M3U ;
- [ ] tests Xtream ;
- [ ] tests EPG ;
- [ ] tests player ;
- [ ] tests profils ;
- [ ] tests interruption réseau ;
- [ ] tests Android ;
- [ ] tests TV ;
- [ ] tests télécommande ;
- [ ] rapport de régression.

### Phase 6 — Production et maintenance

- [ ] APK release signé ;
- [ ] clé de signature hors repository ;
- [ ] configuration sécurité release ;
- [ ] documentation utilisateur ;
- [ ] checklist de publication ;
- [ ] version stable ;
- [ ] maintenance dépendances ;
- [ ] préparation Samsung Tizen et iOS.

---

## 8. Plateformes et validations

| Plateforme | Priorité | État dans le repository |
|---|---:|---|
| Web | Développement/vitrine | Présent |
| Téléphone Android | 1 | Code Capacitor présent, validation terrain à documenter |
| Android TV | 1 | Non vérifié |
| Firestick | 1 | Non vérifié |
| Samsung Tizen | Suite | Non commencé |
| iPhone/iPad | Suite | Non commencé comme produit final |
| Apple TV | Suite | Non commencé |

> Les informations de validation manuelle sur appareils doivent être ajoutées séparément avec l'appareil, la version Android, la version APK, le scénario et le résultat. Le repository ne permet pas de les déduire.

---

## 9. Décisions de travail

| Date | Décision |
|---|---|
| 15/09/2026 | Mettre à jour README, DOCUMENTATION et PROGRESSION |
| 15/09/2026 | Utiliser l'état réel du code comme référence |
| 15/09/2026 | Nom public : NOVA TV — lecteur IPTV |
| 15/09/2026 | Web réservé au développement et à la vitrine |
| 15/09/2026 | Priorité : téléphone Android, Android TV, Firestick |
| 15/09/2026 | Accepter HTTP et HTTPS sans avertissement obligatoire dans l'interface |
| 15/09/2026 | Utiliser un PIN parental global pour les profils adultes |
| 15/09/2026 | Mettre le design et l'UX/UI avant les autres phases de stabilisation |
| 15/09/2026 | Tester une source M3U avant une source Xtream |

---

## 10. Points non vérifiés

- APK release signé ;
- Firestick ;
- Android TV ;
- télécommande réelle ;
- flux IPTV réels ;
- CORS ;
- codecs ;
- DRM ;
- coupure réseau ;
- très gros catalogues ;
- restauration Android ;
- publication store ;
- sécurité effective des headers ;
- validation finale du nouveau design.
