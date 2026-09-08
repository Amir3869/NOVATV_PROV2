/**
 * Identifiant du profil à utiliser pour les listes, favoris, épingles.
 *
 * `activeProfileId` peut rester `null` après l'onboarding : le profil
 * est créé (`profile-${Date.now()}`) sans être activé. Les listes
 * créées tombaient alors sur le repli `profile-1`, et le filtre
 * `=== activeProfileId` n'en montrait aucune.
 *
 * Ordre : profil actif s'il existe, sinon le premier profil, sinon
 * `profile-1` (création avant qu'un profil n'existe).
 */
export function resolveProfileId(
  activeProfileId: string | null,
  firstProfileId: string | undefined | null
): string {
  return activeProfileId ?? firstProfileId ?? 'profile-1';
}
