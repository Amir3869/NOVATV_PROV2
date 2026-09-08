import { describe, it, expect } from 'vitest';
import { resolveProfileId } from './profileScope';

describe('resolveProfileId', () => {
  it('privilégie le profil actif', () => {
    expect(resolveProfileId('p-actif', 'p-premier')).toBe('p-actif');
  });

  it('se rabat sur le premier profil si aucun n’est actif', () => {
    expect(resolveProfileId(null, 'p-premier')).toBe('p-premier');
  });

  it('garde profile-1 seulement s’il n’existe aucun profil', () => {
    expect(resolveProfileId(null, undefined)).toBe('profile-1');
    expect(resolveProfileId(null, null)).toBe('profile-1');
  });
});
