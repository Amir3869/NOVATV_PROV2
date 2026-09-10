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
 *
 * ── Fluidité ──
 * Recalculer React à chaque pixel de scroll faisait saccader et
 * recyclait les images trop tôt (« affiches qui s'entremêlent »).
 * On ne publie un nouveau rendu que si la fenêtre d'items change.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { catalogColumnCount, visibleItemRange, type VisibleRange } from './virtualRange';

function scrollRoot(): HTMLElement | Window {
  if (typeof document === 'undefined') return window;
  return document.getElementById('contenu-principal') ?? window;
}

function sameRange(a: VisibleRange, b: VisibleRange): boolean {
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.paddingTop === b.paddingTop &&
    a.totalHeight === b.totalHeight
  );
}

export function VirtualGrid<T>({
  items,
  getKey,
  renderItem,
  layout = 'grid',
  overscan = 6,
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
  const metricsRef = useRef({
    origin: 0,
    viewportHeight: 800,
    viewportWidth: 1024,
    rowStride: layout === 'list' ? 96 : 240,
    scrollTop: 0,
  });
  const itemCount = items.length;

  const [range, setRange] = useState<VisibleRange>(() =>
    visibleItemRange({
      itemCount,
      columns: layout === 'list' ? 1 : 3,
      rowStride: layout === 'list' ? 96 : 240,
      scrollTop: 0,
      viewportHeight: 800,
      origin: 0,
      overscan,
    })
  );

  const publish = useCallback(() => {
    const m = metricsRef.current;
    const next = visibleItemRange({
      itemCount,
      columns: layout === 'list' ? 1 : catalogColumnCount(m.viewportWidth),
      rowStride: m.rowStride,
      scrollTop: m.scrollTop,
      viewportHeight: m.viewportHeight,
      origin: m.origin,
      overscan,
    });
    setRange((prev) => (sameRange(prev, next) ? prev : next));
  }, [itemCount, layout, overscan]);

  const measureLayout = useCallback(() => {
    const root = scrollRoot();
    const wrap = wrapRef.current;
    if (!wrap) {
      publish();
      return;
    }
    const m = metricsRef.current;

    if (root === window) {
      m.scrollTop = window.scrollY;
      m.viewportHeight = window.innerHeight;
      m.origin = wrap.getBoundingClientRect().top + window.scrollY;
    } else {
      const el = root as HTMLElement;
      const rootBox = el.getBoundingClientRect();
      const wrapBox = wrap.getBoundingClientRect();
      m.scrollTop = el.scrollTop;
      m.viewportHeight = el.clientHeight;
      m.origin = wrapBox.top - rootBox.top + el.scrollTop;
    }
    m.viewportWidth = window.innerWidth;

    const sample = wrap.querySelector('[data-virtual-cell]') as HTMLElement | null;
    if (sample) {
      const gap = layout === 'list' ? 12 : window.innerWidth >= 768 ? 40 : 32;
      const next = Math.round(sample.getBoundingClientRect().height + gap);
      // Un écart de 1 px au scroll ne doit pas tout recalculer.
      if (next > 40 && Math.abs(next - m.rowStride) >= 4) {
        m.rowStride = next;
      }
    }
    publish();
  }, [layout, publish]);

  useEffect(() => {
    const root = scrollRoot();
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const current = scrollRoot();
        metricsRef.current.scrollTop =
          current === window ? window.scrollY : (current as HTMLElement).scrollTop;
        publish();
      });
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measureLayout);
    const start = window.requestAnimationFrame(() => measureLayout());
    return () => {
      window.cancelAnimationFrame(start);
      if (frame) window.cancelAnimationFrame(frame);
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measureLayout);
    };
  }, [measureLayout, publish]);

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
