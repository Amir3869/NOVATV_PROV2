import React from 'react';
import { SectionHeader } from '@/design-system/components/SectionHeader';
import { cn } from '@/utils/cn';

/**
 * Rangée horizontale d'affiches, une par catégorie (Films / Séries).
 *
 * Le titre de la catégorie reste lisible ; « Tout voir » ouvre la
 * grille de cette seule catégorie. On ne dessine qu'un aperçu
 * (l'appelant tranche la liste) pour ne pas monter 2 000 cartes.
 */
export function CatalogRail({
  title,
  subtitle,
  onSeeAll,
  seeAllLabel,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        onSeeAll={onSeeAll}
        seeAllLabel={seeAllLabel}
        className="mb-3"
      />
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none md:gap-4 -mx-4 px-4">
        {children}
      </div>
    </section>
  );
}
