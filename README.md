# Nova TV

**Lecteur IPTV premium.** L'utilisateur connecte sa propre source — identifiants Xtream Codes ou fichier M3U — et retrouve ses contenus dans une interface moderne, sur téléphone, Android TV et Fire TV.

> **Nova TV ne fournit aucun contenu.** L'application est un lecteur, au même titre que VLC. Aucun flux n'est hébergé, relayé ni mis en cache. L'utilisateur est seul responsable de la légalité des sources qu'il connecte.

---

## État du projet

🚧 **En développement — v0.1.0.** Non fonctionnel en l'état.

L'interface existe et se parcourt, mais elle affiche des **données de démonstration**. Aucune connexion à une source IPTV réelle n'est encore implémentée.

Avancement détaillé : [`PROGRESSION.md`](./PROGRESSION.md)

---

## Démarrage

**Prérequis :** Node.js 20 ou plus.

```bash
npm install
npm run dev
```

L'application est disponible sur <http://localhost:3000>.

### Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement, rechargement automatique |
| `npm run build` | Build de production |
| `npm start` | Sert le build de production |
| `npm run lint` | Analyse le code (doit renvoyer 0 erreur, 0 avertissement) |
| `npm run typecheck` | Vérifie les types TypeScript (doit être silencieux) |

> ⚠️ **Ne jamais utiliser `npx <binaire>` dans ce dossier.** `npx` télécharge une version parallèle des outils et modifie des fichiers suivis par Git. Toujours passer par `npm run <script>` ou `./node_modules/.bin/<binaire>`.

---

## Architecture

Application **100 % locale**. Pas de serveur, pas de base distante, pas de compte en ligne.

```
Appareil de l'utilisateur
├── Interface          Next.js + React + Tailwind
├── Données            IndexedDB (Dexie) — Phase 3
├── Sources IPTV       Xtream Codes / M3U — Phase 4
└── Lecture vidéo      hls.js + mpegts.js (web)
                       ExoPlayer natif (APK) — Phase 5
```

Les identifiants IPTV sont saisis dans l'application, chiffrés (AES-GCM via Web Crypto), puis stockés sur l'appareil. Ils ne transitent par aucune infrastructure tierce.

### Arborescence

```
src/
├── app/            Routes Next.js (App Router) — pages de 5-6 lignes
├── features/       Un dossier par écran, la logique vit ici
├── design-system/  Composants réutilisables + tokens de style
├── services/       Xtream, M3U, EPG (pas encore branchés)
├── store/          État global (Zustand)
├── types/          Modèle de domaine TypeScript
├── hooks/          Hooks React partagés
├── utils/          Fonctions utilitaires
└── mocks/          Données de démonstration (à retirer en Phase 4)
```

---

## Plateformes visées

| Plateforme | Forme | Statut |
|---|---|---|
| Fire TV / Firestick | APK | Cible principale |
| Android TV / Google TV | APK | Cible principale |
| Téléphone / tablette Android | APK | Cible principale |
| Navigateur web | Web | Développement et vitrine |
| iOS / iPadOS | Capacitor | Après la v1 |
| Apple TV, Tizen, webOS | — | Hors périmètre |

---

## Conventions

- **TypeScript strict.** `any` interdit, `npm run typecheck` doit rester silencieux.
- **Composants sous 300 lignes.** Au-delà, découper.
- **Quatre états obligatoires** par écran : chargement, erreur, vide, contenu.
- **Aucune couleur ni texte écrit en dur.** Passer par les tokens et le système de traduction.
- **Tout élément interactif doit être atteignable à la télécommande** (D-pad), avec un focus visible.
- **Aucun secret dans le code.** Voir [`.env.example`](.env.example).

---

## Sécurité

Vulnérabilités connues (`npm audit`) : **3 de sévérité haute**, toutes internes à Next.js 16.2.6 (`postcss`, `sharp`).

Elles ne sont **pas corrigeables sans monter Next.js en version majeure**, ce qui sera fait de façon contrôlée. Aucune n'est exploitable ici : `sharp` sert à l'optimisation d'images côté serveur, désactivée dans ce projet.

**Non vérifié :** l'impact réel de ces vulnérabilités sur un build statique n'a pas été audité en profondeur.

---

## Documentation

| Document | Contenu |
|---|---|
| [`DOCUMENTATION.md`](./DOCUMENTATION.md) | Vision, périmètre, stack, architecture, glossaire |
| [`PROGRESSION.md`](./PROGRESSION.md) | Avancement, phases, décisions datées |
| [`AUDIT_NOVA_IPTV.md`](../AUDIT_NOVA_IPTV.md) | Audit de l'état initial (figé) |

---

## Licence

Projet privé. Tous droits réservés.
