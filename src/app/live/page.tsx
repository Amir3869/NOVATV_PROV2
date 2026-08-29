'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LiveTVPage } from '@/features/live-tv/LiveTVPage';
import { ChannelDetailPage } from '@/features/live-tv/ChannelDetailPage';
import { ListPageSkeleton } from '@/design-system/components/LoadingSkeleton';

/**
 * Liste des chaînes, ou fiche d'une chaîne si `?id=` est présent.
 *
 * Pourquoi une seule route pour les deux : l'APK embarque des fichiers
 * HTML figés, produits par `output: 'export'`. Ce mode exige de connaître
 * toutes les adresses à la compilation, ce qui est impossible ici — les
 * identifiants viennent de l'abonnement de l'utilisateur, découvert au
 * premier lancement.
 *
 * Un paramètre d'URL contourne la difficulté : `/live?id=abc` reste une
 * seule page pour le compilateur, et le navigateur lit l'identifiant à
 * l'ouverture. Le motif est déjà celui du lecteur (`/player?type=…&id=…`).
 */
function LiveRouter() {
  const params = useSearchParams();
  const id = params.get('id');

  if (id) return <ChannelDetailPage channelId={id} />;
  return <LiveTVPage />;
}

export default function Page() {
  // `useSearchParams` impose une frontière de chargement : sans elle, la
  // compilation échoue en réclamant un `Suspense`.
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <LiveRouter />
    </Suspense>
  );
}
