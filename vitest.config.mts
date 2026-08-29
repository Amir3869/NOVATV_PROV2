import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Configuration des tests — Nova TV
 *
 * `environment: 'happy-dom'` fournit à Node les objets normalement
 * offerts par le navigateur (`DOMParser`, `document`…). Le service EPG
 * en a besoin pour analyser le XMLTV.
 *
 * Le fuseau est fixé à Europe/Paris : les tests de date vérifient
 * justement le comportement en heure locale, ils doivent donc être
 * reproductibles quelle que soit la machine.
 *
 * `setupFiles` répare `localStorage`, que Node 25 casse en installant
 * le sien — vide et sans `setItem` — par-dessus celui de happy-dom.
 * Voir `src/test/setup.ts` pour le détail.
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
