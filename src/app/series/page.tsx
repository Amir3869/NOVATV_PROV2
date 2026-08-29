'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SeriesListPage } from '@/features/series/SeriesListPage';
import { SeriesDetailPage } from '@/features/series/SeriesDetailPage';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';

/**
 * Catalogue des séries, ou fiche d'une série si `?id=` est présent.
 * Voir `src/app/live/page.tsx` pour la justification du paramètre d'URL.
 */
function SeriesRouter() {
  const params = useSearchParams();
  const id = params.get('id');

  if (id) return <SeriesDetailPage seriesId={id} />;
  return <SeriesListPage />;
}

export default function Page() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <SeriesRouter />
    </Suspense>
  );
}
