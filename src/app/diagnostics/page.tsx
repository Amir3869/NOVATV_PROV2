import { Suspense } from 'react';
import { DiagnosticPage } from '@/features/diagnostics/DiagnosticPage';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';

export default function DiagnosticsRoute() {
  return (
    <Suspense fallback={<ListPageSkeleton rows={5} />}>
      <DiagnosticPage />
    </Suspense>
  );
}
