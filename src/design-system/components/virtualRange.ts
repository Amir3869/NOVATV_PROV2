/**
 * Calcul de la fenêtre visible d'une grille catalogue.
 *
 * Isolé de React pour le tester sans jsdom : un décalage d'une ligne
 * ferait disparaître des affiches ou en dessiner des milliers.
 */

/** Colonnes alignées sur les `grid-cols-*` des pages Films / Séries. */
export function catalogColumnCount(viewportWidth: number): number {
  if (viewportWidth >= 1280) return 6;
  if (viewportWidth >= 1024) return 5;
  if (viewportWidth >= 768) return 4;
  return 3;
}

export interface VisibleRangeInput {
  itemCount: number;
  columns: number;
  rowStride: number;
  scrollTop: number;
  viewportHeight: number;
  /** Position du haut de la grille dans le contenu scrollable. */
  origin: number;
  overscan: number;
}

export interface VisibleRange {
  start: number;
  end: number;
  paddingTop: number;
  totalHeight: number;
}

export function visibleItemRange(input: VisibleRangeInput): VisibleRange {
  const columns = Math.max(1, Math.floor(input.columns) || 1);
  const stride = Math.max(1, input.rowStride);
  const rows = Math.ceil(input.itemCount / columns);
  const totalHeight = rows * stride;

  if (input.itemCount <= 0) {
    return { start: 0, end: 0, paddingTop: 0, totalHeight: 0 };
  }

  const viewStart = input.scrollTop - input.origin;
  const viewEnd = viewStart + Math.max(0, input.viewportHeight);
  const firstRow = Math.max(0, Math.floor(viewStart / stride) - input.overscan);
  const lastRowExclusive = Math.min(rows, Math.ceil(viewEnd / stride) + input.overscan);

  return {
    start: firstRow * columns,
    end: Math.min(input.itemCount, lastRowExclusive * columns),
    paddingTop: firstRow * stride,
    totalHeight,
  };
}
