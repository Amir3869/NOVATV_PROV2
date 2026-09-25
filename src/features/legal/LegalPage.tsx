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
  { name: 'Next.js', license: 'MIT', url: 'https://github.com/vercel/next.js/blob/canary/license.md' },
  { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react/blob/main/LICENSE' },
  { name: 'React DOM', license: 'MIT', url: 'https://github.com/facebook/react/blob/main/LICENSE' },
  { name: 'Zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand/blob/main/LICENSE' },
  { name: 'Radix UI', license: 'MIT', url: 'https://github.com/radix-ui/primitives/blob/main/LICENSE' },
  { name: 'Framer Motion', license: 'MIT', url: 'https://github.com/motiondivision/motion/blob/main/LICENSE.md' },
  { name: 'date-fns', license: 'MIT', url: 'https://github.com/date-fns/date-fns/blob/main/LICENSE.md' },
  { name: 'clsx', license: 'MIT', url: 'https://github.com/lukeed/clsx/blob/master/license' },
  { name: 'tailwind-merge', license: 'MIT', url: 'https://github.com/dcastil/tailwind-merge/blob/main/LICENSE.md' },
  { name: 'react-hot-toast', license: 'MIT', url: 'https://github.com/timolins/react-hot-toast/blob/main/LICENSE' },
  { name: 'Fuse.js', license: 'Apache-2.0', url: 'https://github.com/krisk/Fuse/blob/master/LICENSE' },
  { name: 'hls.js', license: 'Apache-2.0', url: 'https://github.com/video-dev/hls.js/blob/master/LICENSE' },
  { name: 'mpegts.js', license: 'Apache-2.0', url: 'https://github.com/xqq/mpegts.js/blob/master/LICENSE' },
  { name: 'Lucide', license: 'ISC', url: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE' },
  { name: 'Geist', license: 'SIL OFL 1.1', url: 'https://github.com/vercel/geist-font/blob/main/LICENSE.txt' },
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
      { titleKey: 'legal.privacyPublisherTitle', bodyKey: 'legal.privacyPublisher' },
      { titleKey: 'legal.privacyStoredTitle', bodyKey: 'legal.privacyStored' },
      { titleKey: 'legal.privacyNetworkTitle', bodyKey: 'legal.privacyNetwork' },
      { titleKey: 'legal.privacyPasswordTitle', bodyKey: 'legal.privacyPassword' },
      { titleKey: 'legal.privacyProvidersTitle', bodyKey: 'legal.privacyProviders' },
      { titleKey: 'legal.privacyRightsTitle', bodyKey: 'legal.privacyRights' },
      { titleKey: 'legal.privacyRetentionTitle', bodyKey: 'legal.privacyRetention' },
      { titleKey: 'legal.privacyChildrenTitle', bodyKey: 'legal.privacyChildren' },
      { titleKey: 'legal.privacySecurityTitle', bodyKey: 'legal.privacySecurity' },
      { titleKey: 'legal.privacyDeleteTitle', bodyKey: 'legal.privacyDelete' },
      { titleKey: 'legal.privacyChangesTitle', bodyKey: 'legal.privacyChanges' },
      { titleKey: 'legal.privacyComplaintTitle', bodyKey: 'legal.privacyComplaint' },
    ],
  },
  terms: {
    titleKey: 'legal.termsTitle',
    introKey: 'legal.termsIntro',
    sections: [
      { titleKey: 'legal.termsAcceptanceTitle', bodyKey: 'legal.termsAcceptance' },
      { titleKey: 'legal.termsNoContentTitle', bodyKey: 'legal.termsNoContent' },
      { titleKey: 'legal.termsUserTitle', bodyKey: 'legal.termsUser' },
      { titleKey: 'legal.termsNoBypassTitle', bodyKey: 'legal.termsNoBypass' },
      { titleKey: 'legal.termsEligibilityTitle', bodyKey: 'legal.termsEligibility' },
      { titleKey: 'legal.termsAvailabilityTitle', bodyKey: 'legal.termsAvailability' },
      { titleKey: 'legal.termsWarrantyTitle', bodyKey: 'legal.termsWarranty' },
      { titleKey: 'legal.termsIntellectualPropertyTitle', bodyKey: 'legal.termsIntellectualProperty' },
      { titleKey: 'legal.termsChangesTitle', bodyKey: 'legal.termsChanges' },
      { titleKey: 'legal.termsLawTitle', bodyKey: 'legal.termsLaw' },
      { titleKey: 'legal.termsContactTitle', bodyKey: 'legal.termsContact' },
    ],
  },
  licenses: {
    titleKey: 'legal.licensesTitle',
    introKey: 'legal.licensesIntro',
    sections: [
      { titleKey: 'legal.licensesNoticeTitle', bodyKey: 'legal.licensesNotice' },
      { titleKey: 'legal.licensesFontsTitle', bodyKey: 'legal.licensesFonts' },
      { titleKey: 'legal.licensesIconsTitle', bodyKey: 'legal.licensesIcons' },
      { titleKey: 'legal.licensesSourcesTitle', bodyKey: 'legal.licensesSources' },
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
    <div className="legal-page library-page min-h-screen mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:px-8 lg:px-10 space-y-6">
      {/* `Link` et non `router.back()` : on peut arriver ici par un lien
          direct ou un signet, auquel cas il n'y a aucune page précédente
          et le bouton Retour ne ferait rien. La destination est fixe. */}
      <div className="flex justify-center">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 rounded-lg text-sm text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('legal.back')}
        </Link>
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-black text-white sm:text-3xl">{t(doc.titleKey)}</h1>
        <p className="text-xs text-white/40">{t('legal.updated')}</p>
      </div>

      <GlassCard variant="glass" padding="md" className="text-center">
        <p className="text-sm leading-relaxed text-white/70">{t(doc.introKey)}</p>
      </GlassCard>

      <div className="space-y-4">
        {doc.sections.map(({ titleKey, bodyKey }) => (
          <GlassCard key={titleKey} variant="glass" padding="md">
            <h2 className="mb-2 text-center text-sm font-bold text-white">{t(titleKey)}</h2>
            <p className="text-start text-sm leading-relaxed text-white/60">{t(bodyKey)}</p>
          </GlassCard>
        ))}
      </div>
      {/* La liste des bibliothèques n'apparaît que sur la page des
          licences : c'est une énumération de noms propres, elle ne se
          traduit pas et n'a rien à faire sur les deux autres pages. */}
      {documentId === 'licenses' && (
        <GlassCard variant="glass" padding="none" className="overflow-hidden">
          <ul className="divide-y divide-white/5">
            {LIBRARIES.map(({ name, license, url }) => (
              <li key={name} className="flex items-center justify-between gap-4 px-4 py-3">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate rounded text-sm text-white/80 underline decoration-white/20 underline-offset-4 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {name}
                </a>
                <span className="shrink-0 text-xs font-mono text-white/40">{license}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
