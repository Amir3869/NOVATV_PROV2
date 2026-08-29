'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GlassCard } from '@/design-system/components/GlassCard';
import { useTranslation, type MessageKey } from '@/i18n';

/**
 * Les trois pages légales : confidentialité, conditions d'utilisation et
 * licences.
 *
 * Un seul composant pour les trois. Elles ont exactement la même forme —
 * un titre, une phrase d'introduction, puis des paragraphes titrés — et
 * les dupliquer voudrait dire corriger trois fichiers à chaque retouche
 * de mise en page.
 *
 * Aucun texte n'est écrit en dur ici : tout passe par les clés `legal.*`,
 * traduites dans les quatre langues. Un texte légal affiché en français à
 * un utilisateur arabophone n'aurait aucune valeur pour lui.
 */

export type LegalDocument = 'privacy' | 'terms' | 'licenses';

/**
 * Une bibliothèque tierce et sa licence.
 *
 * Les licences sont relevées dans le `package.json` de chaque paquet
 * installé, jamais de mémoire. Annoncer « MIT » pour une bibliothèque qui
 * n'est pas sous MIT est une erreur juridique, pas une approximation.
 */
const LIBRARIES = [
  { name: 'Next.js', license: 'MIT' },
  { name: 'React', license: 'MIT' },
  { name: 'React DOM', license: 'MIT' },
  { name: 'Zustand', license: 'MIT' },
  { name: 'Radix UI', license: 'MIT' },
  { name: 'Framer Motion', license: 'MIT' },
  { name: 'date-fns', license: 'MIT' },
  { name: 'clsx', license: 'MIT' },
  { name: 'tailwind-merge', license: 'MIT' },
  { name: 'react-hot-toast', license: 'MIT' },
  { name: 'Fuse.js', license: 'Apache-2.0' },
  { name: 'hls.js', license: 'Apache-2.0' },
  { name: 'mpegts.js', license: 'Apache-2.0' },
  { name: 'Lucide', license: 'ISC' },
  { name: 'Geist', license: 'SIL OFL 1.1' },
] as const;

/**
 * Contenu de chaque document : une clé de titre, une clé d'introduction,
 * puis la liste des paragraphes sous forme de paires titre/texte.
 *
 * Déclaré hors du composant pour que la liste ne soit pas reconstruite à
 * chaque rendu, et typé avec `satisfies` pour qu'une clé mal orthographiée
 * soit refusée par TypeScript au lieu d'afficher une clé brute à l'écran.
 */
const DOCUMENTS = {
  privacy: {
    titleKey: 'legal.privacyTitle',
    introKey: 'legal.privacyIntro',
    sections: [
      { titleKey: 'legal.privacyStoredTitle', bodyKey: 'legal.privacyStored' },
      { titleKey: 'legal.privacyNetworkTitle', bodyKey: 'legal.privacyNetwork' },
      { titleKey: 'legal.privacyPasswordTitle', bodyKey: 'legal.privacyPassword' },
      { titleKey: 'legal.privacyDeleteTitle', bodyKey: 'legal.privacyDelete' },
    ],
  },
  terms: {
    titleKey: 'legal.termsTitle',
    introKey: 'legal.termsIntro',
    sections: [
      { titleKey: 'legal.termsNoContentTitle', bodyKey: 'legal.termsNoContent' },
      { titleKey: 'legal.termsUserTitle', bodyKey: 'legal.termsUser' },
      { titleKey: 'legal.termsNoBypassTitle', bodyKey: 'legal.termsNoBypass' },
      { titleKey: 'legal.termsWarrantyTitle', bodyKey: 'legal.termsWarranty' },
    ],
  },
  licenses: {
    titleKey: 'legal.licensesTitle',
    introKey: 'legal.licensesIntro',
    sections: [
      { titleKey: 'legal.licensesFontsTitle', bodyKey: 'legal.licensesFonts' },
      { titleKey: 'legal.licensesIconsTitle', bodyKey: 'legal.licensesIcons' },
    ],
  },
} as const satisfies Record<
  LegalDocument,
  {
    titleKey: MessageKey;
    introKey: MessageKey;
    sections: ReadonlyArray<{ titleKey: MessageKey; bodyKey: MessageKey }>;
  }
>;

export function LegalPage({ document: documentId }: { document: LegalDocument }) {
  const { t } = useTranslation();
  const doc = DOCUMENTS[documentId];

  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-6 max-w-2xl">
      {/* `Link` et non `router.back()` : on peut arriver ici par un lien
          direct ou un signet, auquel cas il n'y a aucune page précédente
          et le bouton Retour ne ferait rien. La destination est fixe. */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('legal.back')}
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-black text-white">{t(doc.titleKey)}</h1>
        <p className="text-xs text-white/40">{t('legal.updated')}</p>
      </div>

      <GlassCard variant="glass" padding="md">
        <p className="text-sm text-white/70 leading-relaxed">{t(doc.introKey)}</p>
      </GlassCard>

      <div className="space-y-4">
        {doc.sections.map(({ titleKey, bodyKey }) => (
          <GlassCard key={titleKey} variant="glass" padding="md">
            <h2 className="text-sm font-bold text-white mb-2">{t(titleKey)}</h2>
            <p className="text-sm text-white/60 leading-relaxed">{t(bodyKey)}</p>
          </GlassCard>
        ))}
      </div>

      {/* La liste des bibliothèques n'apparaît que sur la page des
          licences : c'est une énumération de noms propres, elle ne se
          traduit pas et n'a rien à faire sur les deux autres pages. */}
      {documentId === 'licenses' && (
        <GlassCard variant="glass" padding="none" className="overflow-hidden">
          <ul className="divide-y divide-white/5">
            {LIBRARIES.map(({ name, license }) => (
              <li key={name} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-white/80">{name}</span>
                <span className="text-xs text-white/40 font-mono">{license}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
