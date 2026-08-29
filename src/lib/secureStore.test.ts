import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  secureStore,
  setSecretBackend,
  createMemoryBackend,
  playlistSecretId,
  type SecretBackend,
} from './secureStore';

let previous: SecretBackend;

beforeEach(() => {
  // Chaque test part d'un rangement vide et isolé : sans cela un
  // secret écrit par un test serait lu par le suivant, et l'ordre
  // d'exécution changerait le résultat.
  previous = setSecretBackend(createMemoryBackend());
});

afterEach(() => {
  setSecretBackend(previous);
});

describe('playlistSecretId', () => {
  it("construit un identifiant stable à partir de l'identifiant de source", () => {
    expect(playlistSecretId('abc')).toBe('playlist:abc:password');
  });

  it('donne deux identifiants distincts pour deux sources', () => {
    expect(playlistSecretId('a')).not.toBe(playlistSecretId('b'));
  });
});

describe('secureStore', () => {
  it("renvoie null pour un secret qui n'existe pas", async () => {
    expect(await secureStore.get('inconnu')).toBeNull();
  });

  it('enregistre puis relit une valeur', async () => {
    await secureStore.set('cle', 'valeur');
    expect(await secureStore.get('cle')).toBe('valeur');
  });

  it('écrase une valeur existante', async () => {
    await secureStore.set('cle', 'ancienne');
    await secureStore.set('cle', 'nouvelle');
    expect(await secureStore.get('cle')).toBe('nouvelle');
  });

  it('supprime une valeur', async () => {
    await secureStore.set('cle', 'valeur');
    await secureStore.remove('cle');
    expect(await secureStore.get('cle')).toBeNull();
  });

  it('supprimer une clé absente ne lève pas d’erreur', async () => {
    await expect(secureStore.remove('jamais-ecrite')).resolves.toBeUndefined();
  });

  it('clear efface tout', async () => {
    await secureStore.set('a', '1');
    await secureStore.set('b', '2');
    await secureStore.clear();
    expect(await secureStore.get('a')).toBeNull();
    expect(await secureStore.get('b')).toBeNull();
  });
});

describe('secureStore — raccourcis de source', () => {
  it('enregistre et relit le mot de passe d’une source', async () => {
    await secureStore.setPlaylistPassword('src-1', 'motdepasse');
    expect(await secureStore.getPlaylistPassword('src-1')).toBe('motdepasse');
  });

  it('isole les mots de passe de deux sources', async () => {
    await secureStore.setPlaylistPassword('src-1', 'aaa');
    await secureStore.setPlaylistPassword('src-2', 'bbb');
    expect(await secureStore.getPlaylistPassword('src-1')).toBe('aaa');
    expect(await secureStore.getPlaylistPassword('src-2')).toBe('bbb');
  });

  it('supprimer une source ne touche pas les autres', async () => {
    await secureStore.setPlaylistPassword('src-1', 'aaa');
    await secureStore.setPlaylistPassword('src-2', 'bbb');
    await secureStore.removePlaylistPassword('src-1');
    expect(await secureStore.getPlaylistPassword('src-1')).toBeNull();
    expect(await secureStore.getPlaylistPassword('src-2')).toBe('bbb');
  });

  it('accepte un mot de passe contenant des caractères spéciaux', async () => {
    const tordu = 'p@ss:w/rd?&=#éà "quotes"';
    await secureStore.setPlaylistPassword('src-1', tordu);
    expect(await secureStore.getPlaylistPassword('src-1')).toBe(tordu);
  });
});

describe('setSecretBackend', () => {
  it('renvoie le moteur précédent pour permettre une restauration', async () => {
    const a = createMemoryBackend();
    const b = createMemoryBackend();
    const before = setSecretBackend(a);
    const returned = setSecretBackend(b);
    expect(returned).toBe(a);
    setSecretBackend(before);
  });

  it('le changement de moteur redirige bien les lectures', async () => {
    await secureStore.set('cle', 'moteur-1');
    setSecretBackend(createMemoryBackend());
    expect(await secureStore.get('cle')).toBeNull();
  });
});
