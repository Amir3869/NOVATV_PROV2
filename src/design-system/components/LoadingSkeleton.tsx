import React from 'react';
import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
  rounded?: boolean;
}

export function Skeleton({ className, rounded = false }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-white/5',
        rounded ? 'rounded-full' : 'rounded-lg',
        className
      )}
    />
  );
}

export function MediaCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-[2/3] w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function ChannelCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/3">
      <Skeleton className="w-16 h-10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative w-full h-[70vh] bg-surface-2 animate-pulse">
      <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-16 w-96" />
        <div className="flex gap-3">
          <Skeleton className="h-12 w-36 rounded-xl" />
          <Skeleton className="h-12 w-36 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function SectionSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-40">
            <MediaCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Gabarit d'une page de détail (film, série, chaîne).
 *
 * Ces pages cherchent un élément précis dans le catalogue. Avant que
 * les données enregistrées soient relues, le catalogue est vide, donc
 * la recherche échoue et la page annonçait « Film introuvable » alors
 * que le film existe. On montre ce gabarit à la place.
 */
export function DetailSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="relative w-full h-[45vh] bg-surface-2 animate-pulse" />
      <div className="px-4 md:px-8 lg:px-10 py-8 space-y-6">
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <div className="flex gap-3">
          <Skeleton className="h-11 w-36 rounded-xl" />
          <Skeleton className="h-11 w-11 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-2/3 max-w-md" />
        </div>
        <SectionSkeleton count={6} />
      </div>
    </div>
  );
}

/**
 * Gabarit générique d'une page de liste : un titre puis des lignes.
 * Sert aux écrans sans grille d'affiches (historique, listes, sources).
 */
export function ListPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <ChannelCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Gabarit générique d'une grille d'affiches (films, séries, favoris).
 */
export function GridPageSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="min-h-screen px-4 md:px-8 lg:px-10 py-6 space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <MediaCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
