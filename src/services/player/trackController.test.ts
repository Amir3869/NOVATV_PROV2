import { describe, it, expect, vi } from 'vitest';
import {
  trackLabel,
  hlsTrackSource,
  hasSelectableTracks,
  matchesLanguage,
  pickPreferredTrack,
  pickPlayableAudioTrack,
  applyTrackPreferences,
  type HlsLike,
  type TrackController,
  type TrackKind,
  type MediaTrack,
} from './trackController';

/**
 * Fausse instance hls.js.
 *
 * On n'instancie pas la vraie bibliothèque : elle exige un
 * `MediaSource` et un réseau. Seule la forme utilisée est reproduite,
 * relevée dans `node_modules/hls.js/dist/hls.d.ts`.
 */
function fakeHls(over: Partial<HlsLike> = {}): HlsLike {
  return {
    audioTracks: [],
    subtitleTracks: [],
    audioTrack: -1,
    subtitleTrack: -1,
    on: vi.fn(),
    off: vi.fn(),
    ...over,
  };
}

describe('trackLabel', () => {
  it('prefere le nom declare par le flux', () => {
    expect(trackLabel(0, 'audio', 'Français VFF', 'fr')).toBe('Français VFF');
  });

  it('traduit un code de langue en nom lisible', () => {
    // Intl.DisplayNames traduit dans la langue de l'interface.
    expect(trackLabel(0, 'audio', undefined, 'en', 'fr').toLowerCase()).toContain('anglais');
  });

  it('accepte un code de langue a trois lettres', () => {
    const label = trackLabel(0, 'audio', undefined, 'deu', 'fr');
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe('Audio 1');
  });

  it('numerote a partir de 1 quand rien n est declare', () => {
    // « Piste 0 » n'a de sens que pour un developpeur.
    expect(trackLabel(0, 'audio')).toBe('Audio 1');
    expect(trackLabel(2, 'subtitle')).toBe('Sous-titres 3');
  });

  it('ignore un nom vide ou fait d espaces', () => {
    expect(trackLabel(0, 'audio', '   ')).toBe('Audio 1');
  });

  it('retombe sur la numerotation si le code de langue est aberrant', () => {
    // Un nom mal range dans le champ langue ne doit pas s'afficher tel quel.
    expect(trackLabel(1, 'audio', undefined, 'commentaire audio')).toBe('Audio 2');
  });

  it('renvoie le code brut quand la langue est inconnue du navigateur', () => {
    expect(trackLabel(0, 'audio', undefined, 'zz')).toBe('zz');
  });
});

describe('hlsTrackSource', () => {
  it('convertit les pistes audio', () => {
    const hls = fakeHls({
      audioTracks: [
        { name: 'Français', lang: 'fr' },
        { name: 'English', lang: 'en' },
      ],
      audioTrack: 0,
    });
    const c = hlsTrackSource(hls).read();
    expect(c.audioTracks).toHaveLength(2);
    expect(c.audioTracks[0].label).toBe('Français');
    expect(c.activeAudioId).toBe('0');
  });

  it('utilise l index du tableau comme identifiant', () => {
    // Et non le champ `id` : c'est l'index que `hls.audioTrack = n`
    // attend. Les faire diverger selectionnerait la mauvaise piste.
    const hls = fakeHls({
      audioTracks: [
        { id: 42, name: 'A' },
        { id: 7, name: 'B' },
      ],
    });
    const c = hlsTrackSource(hls).read();
    expect(c.audioTracks.map((t) => t.id)).toEqual(['0', '1']);
  });

  it('traduit -1 en absence de sous-titres', () => {
    const hls = fakeHls({ subtitleTracks: [{ name: 'FR' }], subtitleTrack: -1 });
    expect(hlsTrackSource(hls).read().activeSubtitleId).toBeNull();
  });

  it('selectionne une piste audio', () => {
    const hls = fakeHls({ audioTracks: [{ name: 'A' }, { name: 'B' }] });
    hlsTrackSource(hls).read().selectAudio('1');
    expect(hls.audioTrack).toBe(1);
  });

  it('refuse un index hors bornes', () => {
    const hls = fakeHls({ audioTracks: [{ name: 'A' }], audioTrack: 0 });
    hlsTrackSource(hls).read().selectAudio('9');
    expect(hls.audioTrack).toBe(0);
  });

  it('refuse un identifiant qui n est pas un nombre', () => {
    const hls = fakeHls({ audioTracks: [{ name: 'A' }], audioTrack: 0 });
    hlsTrackSource(hls).read().selectAudio('abc');
    expect(hls.audioTrack).toBe(0);
  });

  it('desactive les sous-titres avec null', () => {
    const hls = fakeHls({ subtitleTracks: [{ name: 'FR' }], subtitleTrack: 0 });
    hlsTrackSource(hls).read().selectSubtitle(null);
    expect(hls.subtitleTrack).toBe(-1);
  });

  it('selectionne un sous-titre', () => {
    const hls = fakeHls({ subtitleTracks: [{ name: 'FR' }, { name: 'EN' }] });
    hlsTrackSource(hls).read().selectSubtitle('1');
    expect(hls.subtitleTrack).toBe(1);
  });

  it('s abonne aux quatre evenements de piste', () => {
    const hls = fakeHls();
    hlsTrackSource(hls).subscribe(() => {});
    // Sans abonnement, le menu resterait vide : les pistes arrivent
    // avec le manifeste, apres l'attachement.
    expect(hls.on).toHaveBeenCalledTimes(4);
  });

  it('se desabonne de tout ce qu il a ecoute', () => {
    const hls = fakeHls();
    const unsubscribe = hlsTrackSource(hls).subscribe(() => {});
    unsubscribe();
    expect(hls.off).toHaveBeenCalledTimes(4);
  });

  it('relit l etat courant a chaque appel', () => {
    const hls = fakeHls({ audioTracks: [{ name: 'A' }, { name: 'B' }], audioTrack: 0 });
    const source = hlsTrackSource(hls);
    expect(source.read().activeAudioId).toBe('0');
    hls.audioTrack = 1;
    expect(source.read().activeAudioId).toBe('1');
  });
});

describe('hasSelectableTracks', () => {
  const base: TrackController = {
    audioTracks: [],
    subtitleTracks: [],
    activeAudioId: null,
    activeSubtitleId: null,
    selectAudio: () => {},
    selectSubtitle: () => {},
  };

  it('refuse un controleur absent', () => {
    expect(hasSelectableTracks(null)).toBe(false);
  });

  it('refuse une piste audio unique sans sous-titre', () => {
    // Le menu n'offrirait aucun choix : le bouton doit disparaitre.
    expect(
      hasSelectableTracks({
        ...base,
        audioTracks: [{ id: '0', label: 'A', kind: 'audio' }],
      })
    ).toBe(false);
  });

  it('accepte deux pistes audio', () => {
    expect(
      hasSelectableTracks({
        ...base,
        audioTracks: [
          { id: '0', label: 'A', kind: 'audio' },
          { id: '1', label: 'B', kind: 'audio' },
        ],
      })
    ).toBe(true);
  });

  it('accepte un seul sous-titre avec une seule piste audio', () => {
    // Un sous-titre suffit : le choix « active / desactive » existe.
    expect(
      hasSelectableTracks({
        ...base,
        audioTracks: [{ id: '0', label: 'A', kind: 'audio' }],
        subtitleTracks: [{ id: '0', label: 'FR', kind: 'subtitle' }],
      })
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Sélection automatique au démarrage
 * ------------------------------------------------------------------ */

function track(
  id: string,
  kind: TrackKind,
  label: string,
  lang?: string
): MediaTrack {
  return { id, kind, label, lang };
}

describe('matchesLanguage', () => {
  it('reconnaît les trois codes normalisés du français', () => {
    for (const code of ['fr', 'fra', 'fre']) {
      expect(matchesLanguage(track('0', 'audio', 'Piste', code), 'fr')).toBe(true);
    }
  });

  it('ignore la région du code', () => {
    expect(matchesLanguage(track('0', 'audio', 'Piste', 'fr-FR'), 'fr')).toBe(true);
    expect(matchesLanguage(track('0', 'audio', 'Piste', 'en_US'), 'en')).toBe(true);
  });

  it('ne confond pas deux langues distinctes', () => {
    expect(matchesLanguage(track('0', 'audio', 'Piste', 'eng'), 'fr')).toBe(false);
    expect(matchesLanguage(track('0', 'audio', 'Piste', 'spa'), 'ar')).toBe(false);
  });

  it('se rabat sur le libellé quand le code manque', () => {
    expect(matchesLanguage(track('0', 'audio', 'Français VFF'), 'fr')).toBe(true);
    expect(matchesLanguage(track('0', 'audio', 'English'), 'en')).toBe(true);
  });

  it('compare le libellé mot à mot', () => {
    // Sans découpage en mots, « en » correspondrait à « Bien entendu ».
    expect(matchesLanguage(track('0', 'audio', 'Bien entendu'), 'en')).toBe(false);
  });

  it('rejette une préférence vide', () => {
    expect(matchesLanguage(track('0', 'audio', 'Piste', 'fr'), '')).toBe(false);
  });
});

describe('pickPreferredTrack', () => {
  const pistes = [
    track('0', 'subtitle', 'English', 'eng'),
    track('1', 'subtitle', 'Français', 'fra'),
  ];

  it('trouve la piste demandée où qu\'elle soit', () => {
    expect(pickPreferredTrack(pistes, 'fr', false)?.id).toBe('1');
    expect(pickPreferredTrack(pistes, 'en', false)?.id).toBe('0');
  });

  it('sans correspondance : rien pour l\'audio, la première pour les ST', () => {
    // Audio : la piste par défaut du flux est déjà la bonne, on n'y
    // touche pas. Sous-titres : l'utilisateur en a demandé, on en donne.
    expect(pickPreferredTrack(pistes, 'ar', false)).toBeNull();
    expect(pickPreferredTrack(pistes, 'ar', true)?.id).toBe('0');
  });

  it('renvoie null sur une liste vide, même avec repli', () => {
    expect(pickPreferredTrack([], 'fr', true)).toBeNull();
  });
});

describe('pickPlayableAudioTrack', () => {
  it('préfère l AAC de la langue demandée à un AC-3 de la même langue', () => {
    const pistes = [
      track('0', 'audio', 'Français AC3', 'fra'),
      track('1', 'audio', 'Français AAC', 'fra'),
    ];
    expect(pickPlayableAudioTrack(pistes, 'fr')?.id).toBe('1');
  });

  it('prend un AAC anglais plutôt qu un AC-3 français muet', () => {
    // Image sans son : mieux vaut une VO audible qu'une VF que la
    // WebView ne décode pas.
    const pistes = [
      track('0', 'audio', 'Français Dolby Digital', 'fra'),
      track('1', 'audio', 'English AAC', 'eng'),
    ];
    expect(pickPlayableAudioTrack(pistes, 'fr')?.id).toBe('1');
  });

  it('sans indice de codec, retombe sur la langue demandée', () => {
    const pistes = [
      track('0', 'audio', 'English', 'eng'),
      track('1', 'audio', 'Français', 'fra'),
    ];
    expect(pickPlayableAudioTrack(pistes, 'fr')?.id).toBe('1');
  });

  it('renvoie null sur une liste vide', () => {
    expect(pickPlayableAudioTrack([], 'fr')).toBeNull();
  });
});

describe('applyTrackPreferences', () => {
  function stub(audio: MediaTrack[], subs: MediaTrack[]) {
    const calls: string[] = [];
    const controller: TrackController = {
      audioTracks: audio,
      subtitleTracks: subs,
      activeAudioId: audio[0]?.id ?? null,
      activeSubtitleId: null,
      selectAudio: (id) => calls.push(`audio:${id}`),
      selectSubtitle: (id) => calls.push(`sub:${id}`),
    };
    return { controller, calls };
  }

  const AUDIO = [
    track('0', 'audio', 'English', 'eng'),
    track('1', 'audio', 'Français', 'fra'),
  ];
  const SUBS = [
    track('0', 'subtitle', 'English', 'eng'),
    track('1', 'subtitle', 'Français', 'fra'),
  ];

  it('sélectionne audio et sous-titres dans des langues différentes', () => {
    // Le cas d'usage central : film en VO anglaise, sous-titré français.
    const { controller, calls } = stub(AUDIO, SUBS);
    const done = applyTrackPreferences(controller, {
      audioLanguage: 'en',
      subtitleLanguage: 'fr',
      subtitlesEnabled: true,
    });
    expect(done).toBe(true);
    expect(calls).toContain('sub:1');
    // L'anglais est déjà la piste active : inutile de la réémettre.
    expect(calls).not.toContain('audio:0');
  });

  it('n\'active aucun sous-titre quand le réglage est éteint', () => {
    const { controller, calls } = stub(AUDIO, SUBS);
    applyTrackPreferences(controller, {
      audioLanguage: 'fr',
      subtitleLanguage: 'fr',
      subtitlesEnabled: false,
    });
    expect(calls).toEqual(['audio:1']);
  });

  it('ne réémet pas une sélection déjà active', () => {
    // Certains flux repartent du début du segment à chaque changement.
    const { controller, calls } = stub(AUDIO, SUBS);
    applyTrackPreferences(controller, {
      audioLanguage: 'en',
      subtitleLanguage: 'fr',
      subtitlesEnabled: false,
    });
    expect(calls).toEqual([]);
  });

  it('ignore une piste audio unique', () => {
    const { controller, calls } = stub([AUDIO[0]], SUBS);
    applyTrackPreferences(controller, {
      audioLanguage: 'fr',
      subtitleLanguage: 'fr',
      subtitlesEnabled: false,
    });
    expect(calls).toEqual([]);
  });

  it('signale que le manifeste n\'est pas encore lu', () => {
    // Cas réel : les pistes arrivent une à deux secondes après
    // l'attachement. L'appelant doit pouvoir réessayer.
    const { controller, calls } = stub([], []);
    const done = applyTrackPreferences(controller, {
      audioLanguage: 'fr',
      subtitleLanguage: 'fr',
      subtitlesEnabled: true,
    });
    expect(done).toBe(false);
    expect(calls).toEqual([]);
  });

  it('se rabat sur la première piste de sous-titres disponible', () => {
    const { controller, calls } = stub(AUDIO, [SUBS[0]]);
    applyTrackPreferences(controller, {
      audioLanguage: 'en',
      subtitleLanguage: 'ar',
      subtitlesEnabled: true,
    });
    expect(calls).toContain('sub:0');
  });

  it('bascule sur la piste AAC quand la langue demandée est en AC-3', () => {
    const codecs = [
      track('0', 'audio', 'Français AC3', 'fra'),
      track('1', 'audio', 'English AAC', 'eng'),
    ];
    const { controller, calls } = stub(codecs, []);
    applyTrackPreferences(controller, {
      audioLanguage: 'fr',
      subtitleLanguage: 'fr',
      subtitlesEnabled: false,
    });
    expect(calls).toEqual(['audio:1']);
  });
});
