'use client';

/**
 * Grille catalogue fenêtrée.
 *
 * Les pages Films / Séries montaient tout le catalogue (souvent des
 * milliers de cartes) d'un coup : le premier rendu bloquait le Samsung.
 * Ici on ne dessine que les lignes visibles, plus un overscan.
 *
 * Le scroll n'est pas sur la page : il est sur `#contenu-principal`
 * (ClientLayout). On s'abonne à cet ancêtre, pas à `window`.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { catalogColumnCount, visibleItemRange } from './virtualRange';

function scrollRoot(): HTMLElement | Window {
  if (typeof document === 'undefined') return window;
  return document.getElementById('contenu-principal') ?? window;
}

export function VirtualGrid<T>({
  items,
  getKey,
  renderItem,
  layout = 'grid',
  overscan = 3,
  className,
}: {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  layout?: 'grid' | 'list';
  overscan?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(1024);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [origin, setOrigin] = useState(0);
  const [rowStride, setRowStride] = useState(layout === 'list' ? 96 : 240);

  const columns = layout === 'list' ? 1 : catalogColumnCount(viewportWidth);

  const measure = useCallback(() => {
    const root = scrollRoot();
    const wrap = wrapRef.current;
    if (!wrap) return;

    if (root === window) {
      setScrollTop(window.scrollY);
      setViewportHeight(window.innerHeight);
      setOrigin(wrap.getBoundingClientRect().top + window.scrollY);
    } else {
      const el = root as HTMLElement;
      const rootBox = el.getBoundingClientRect();
      const wrapBox = wrap.getBoundingClientRect();
      setScrollTop(el.scrollTop);
      setViewportHeight(el.clientHeight);
      setOrigin(wrapBox.top - rootBox.top + el.scrollTop);
    }
    setViewportWidth(window.innerWidth);

    const sample = wrap.querySelector('[data-virtual-cell]') as HTMLElement | null;
    if (sample) {
      const gap = layout === 'list' ? 12 : window.innerWidth >= 768 ? 40 : 32;
      const next = Math.round(sample.getBoundingClientRect().height + gap);
      if (next > 40) setRowStride(next);
    }
  }, [layout]);

  useEffect(() => {
    const root = scrollRoot();
    const onScroll = () => measure();
    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const frame = window.requestAnimationFrame(() => measure());
    return () => {
      window.cancelAnimationFrame(frame);
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [measure, items.length]);

  const range = visibleItemRange({
    itemCount: items.length,
    columns,
    rowStride,
    scrollTop,
    viewportHeight,
    origin,
    overscan,
  });

  const slice = items.slice(range.start, range.end);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ height: range.totalHeight, position: 'relative' }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${range.paddingTop}px)`,
        }}
        className={
          layout === 'list'
            ? 'flex flex-col gap-3'
            : 'grid grid-cols-3 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-x-4 md:gap-y-10'
        }
      >
        {slice.map((item, i) => {
          const index = range.start + i;
          return (
            <div key={getKey(item, index)} data-virtual-cell>
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
