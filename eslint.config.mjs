import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,

  {
    rules: {
      /**
       * `@next/next/no-img-element` — désactivée volontairement.
       *
       * Cette règle recommande `next/image` à la place de `<img>`.
       * Elle ne s'applique pas à Nova TV :
       *
       *  1. `next/image` exige un serveur Node pour retailler les images.
       *     L'APK Android est un export statique : il n'y a pas de serveur.
       *  2. Les logos de chaînes et jaquettes viennent des serveurs IPTV
       *     de l'utilisateur. Leurs domaines sont inconnus à l'avance, donc
       *     impossibles à déclarer dans une liste d'autorisation.
       *  3. Faire transiter ces images par notre infrastructure
       *     contredirait la position juridique du projet : Nova TV ne
       *     relaie aucun contenu.
       *
       * La performance des images est traitée en Phase 6 (chargement
       * différé, dimensions explicites, cache local).
       */
      "@next/next/no-img-element": "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    "android/**",
    "ios/**",
  ]),
]);
