'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MoviesPage } from '@/features/movies/MoviesPage';
import { MovieDetailPage } from '@/features/movies/MovieDetailPage';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';

/**
 * Catalogue des films, ou fiche d'un film si `?id=` est présent.
 * Voir `src/app/live/page.tsx` pour la justification du paramètre d'URL.
 */
function MoviesRouter() {
  const params = useSearchParams();
  const id = params.get('id');

  if (id) return <MovieDetailPage movieId={id} />;
  return <MoviesPage />;
}

export default function Page() {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <MoviesRouter />
    </Suspense>
  );
}
