import { describe, it, expect } from 'vitest';
import {
  buildChannelEpgMap,
  buildPlayerEpgView,
  formatClockTime,
  remainingMinutes,
} from './playerEpg';
import type { EPGProgram } from '@/types';

/**
 * Fabrique un programme sur des heures locales.
 *
 * Les dates sont construites par composantes plutôt qu'écrites en ISO
 * avec un « Z » : un test qui fige un fuseau échoue dès qu'il tourne
 * ailleurs. Ici l'heure attendue est celle de la machine, comme pour
 * l'utilisateur.
 */
function makeProgram(
  channelId: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  title: string
): EPGProgram {
  const start = new Date(2026, 7, 25, startHour, startMinute, 0, 0);
  const stop = new Date(2026, 7, 25, endHour, endMinute, 0, 0);
  return {
    id: `${channelId}-${title}`,
    channelId,
    title,
    start: start.toISOString(),
    stop: stop.toISOString(),
  };
}

const at = (h: number, m: number, s = 0) => new Date(2026, 7, 25, h, m, s, 0);

describe('formatClockTime', () => {
  it('rend une heure sur deux chiffres', () => {
    const iso = new Date(2026, 7, 25, 20, 45).toISOString();
    expect(formatClockTime(iso, 'fr-FR')).toBe('20:45');
  });

  it('respecte la langue : un anglophone lit 12 heures', () => {
    const iso = new Date(2026, 7, 25, 20, 45).toISOString();
    expect(formatClockTime(iso, 'en-US')).toMatch(/8:45/);
  });

  it('rend une chaine vide plutot que Invalid Date', () => {
    expect(formatClockTime('pas-une-date', 'fr-FR')).toBe('');
  });
});

describe('remainingMinutes', () => {
  const program = makeProgram('ch1', 20, 0, 20, 45, 'Le 20 Heures');

  it('arrondit au superieur : il reste 1 min tant que la fin n est pas passee', () => {
    expect(remainingMinutes(program, at(20, 44, 1))).toBe(1);
  });

  it('compte les minutes pleines', () => {
    expect(remainingMinutes(program, at(20, 26))).toBe(19);
  });

  it('rend null une fois le programme termine', () => {
    expect(remainingMinutes(program, at(20, 45))).toBeNull();
  });

  it('rend null sur une date illisible', () => {
    const casse: EPGProgram = { ...program, stop: 'n importe quoi' };
    expect(remainingMinutes(casse, at(20, 26))).toBeNull();
  });
});

describe('buildPlayerEpgView', () => {
  const programs: EPGProgram[] = [
    makeProgram('ch1', 19, 0, 20, 0, 'Journal'),
    makeProgram('ch1', 20, 0, 20, 45, 'Le 20 Heures'),
    makeProgram('ch1', 20, 45, 20, 55, 'Meteo'),
    makeProgram('ch2', 20, 0, 21, 0, 'Autre chaine'),
  ];

  it('assemble le bandeau du programme en cours', () => {
    const vue = buildPlayerEpgView(programs, 'ch1', 'fr-FR', at(20, 26));

    expect(vue).not.toBeNull();
    expect(vue!.title).toBe('Le 20 Heures');
    expect(vue!.startLabel).toBe('20:00');
    expect(vue!.endLabel).toBe('20:45');
    expect(vue!.remainingMinutes).toBe(19);
  });

  it('calcule un avancement coherent avec l heure', () => {
    // 26 min ecoulees sur 45 : 57,8 % arrondi a 58.
    const vue = buildPlayerEpgView(programs, 'ch1', 'fr-FR', at(20, 26));
    expect(vue!.percent).toBe(58);
  });

  it('borne l avancement entre 0 et 100', () => {
    const debut = buildPlayerEpgView(programs, 'ch1', 'fr-FR', at(20, 0));
    expect(debut!.percent).toBe(0);

    const presqueFini = buildPlayerEpgView(programs, 'ch1', 'fr-FR', at(20, 44, 59));
    expect(presqueFini!.percent).toBeLessThanOrEqual(100);
    expect(presqueFini!.percent).toBeGreaterThan(95);
  });

  it('annonce le programme suivant', () => {
    const vue = buildPlayerEpgView(programs, 'ch1', 'fr-FR', at(20, 26));
    expect(vue!.nextTitle).toBe('Meteo');
    expect(vue!.nextStartLabel).toBe('20:45');
  });

  it('accepte un guide qui s arrete apres l emission en cours', () => {
    const sansSuite = programs.filter((p) => p.title !== 'Meteo');
    const vue = buildPlayerEpgView(sansSuite, 'ch1', 'fr-FR', at(20, 26));

    expect(vue!.title).toBe('Le 20 Heures');
    expect(vue!.nextTitle).toBeNull();
    expect(vue!.nextStartLabel).toBeNull();
  });

  it('ne melange pas les chaines', () => {
    const vue = buildPlayerEpgView(programs, 'ch2', 'fr-FR', at(20, 26));
    expect(vue!.title).toBe('Autre chaine');
  });

  it('rend null quand la chaine n a aucun programme', () => {
    expect(buildPlayerEpgView(programs, 'ch9', 'fr-FR', at(20, 26))).toBeNull();
  });

  it('rend null en dehors de toute plage horaire', () => {
    expect(buildPlayerEpgView(programs, 'ch1', 'fr-FR', at(3, 0))).toBeNull();
  });

  it('rend null sans guide du tout : cas courant, pas une erreur', () => {
    expect(buildPlayerEpgView([], 'ch1', 'fr-FR', at(20, 26))).toBeNull();
  });

  it('rend null sans identifiant de chaine', () => {
    expect(buildPlayerEpgView(programs, '', 'fr-FR', at(20, 26))).toBeNull();
  });

  it('ignore un programme aux dates inexploitables', () => {
    const casse: EPGProgram[] = [
      { ...makeProgram('ch1', 20, 0, 20, 45, 'Casse'), stop: 'illisible' },
    ];
    expect(buildPlayerEpgView(casse, 'ch1', 'fr-FR', at(20, 26))).toBeNull();
  });

  it('ignore un programme dont la fin precede le debut', () => {
    const inverse: EPGProgram[] = [makeProgram('ch1', 21, 0, 20, 0, 'Inverse')];
    expect(buildPlayerEpgView(inverse, 'ch1', 'fr-FR', at(20, 26))).toBeNull();
  });
});


describe('buildChannelEpgMap', () => {
  const programs: EPGProgram[] = [
    makeProgram('ch1', 19, 0, 20, 0, 'Journal'),
    makeProgram('ch1', 20, 0, 20, 45, 'Le 20 Heures'),
    makeProgram('ch1', 20, 45, 20, 55, 'Meteo'),
    makeProgram('ch2', 20, 0, 21, 0, 'Match'),
    makeProgram('ch3', 22, 0, 23, 0, 'Plus tard'),
  ];

  it('ne retient que l emission a l antenne de chaque chaine', () => {
    const map = buildChannelEpgMap(programs, at(20, 26));

    expect(map.get('ch1')?.title).toBe('Le 20 Heures');
    expect(map.get('ch2')?.title).toBe('Match');
  });

  it('omet les chaines sans emission en cours', () => {
    const map = buildChannelEpgMap(programs, at(20, 26));

    // `ch3` ne commence qu'a 22 h : absente, et non presente a null.
    expect(map.has('ch3')).toBe(false);
    expect(map.size).toBe(2);
  });

  it('calcule l avancement et le temps restant', () => {
    const ch1 = buildChannelEpgMap(programs, at(20, 26)).get('ch1');

    expect(ch1?.percent).toBe(58);
    expect(ch1?.remainingMinutes).toBe(19);
  });

  it('borne l avancement entre 0 et 100', () => {
    for (const instant of [at(20, 0), at(20, 22), at(20, 44, 59)]) {
      const p = buildChannelEpgMap(programs, instant).get('ch1')!.percent;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });

  it('rend une carte vide sans aucun guide', () => {
    expect(buildChannelEpgMap([], at(20, 26)).size).toBe(0);
  });

  it('ignore les programmes aux dates inexploitables', () => {
    const casse: EPGProgram[] = [
      { ...makeProgram('ch1', 20, 0, 20, 45, 'Illisible'), start: 'n importe quoi' },
      { ...makeProgram('ch2', 20, 0, 20, 45, 'Inverse'), stop: makeProgram('ch2', 19, 0, 19, 30, 'x').start },
      makeProgram('ch4', 20, 0, 20, 45, 'Correct'),
    ];
    const map = buildChannelEpgMap(casse, at(20, 26));

    expect(map.has('ch1')).toBe(false);
    expect(map.has('ch2')).toBe(false);
    expect(map.get('ch4')?.title).toBe('Correct');
  });

  it('donne le meme resultat que le calcul chaine par chaine', () => {
    const map = buildChannelEpgMap(programs, at(20, 26));
    const vue = buildPlayerEpgView(programs, 'ch1', 'fr-FR', at(20, 26));

    expect(map.get('ch1')?.title).toBe(vue?.title);
    expect(map.get('ch1')?.percent).toBe(vue?.percent);
    expect(map.get('ch1')?.remainingMinutes).toBe(vue?.remainingMinutes);
  });

  it('traverse un gros guide en une seule passe', () => {
    // 900 chaines x 12 programmes : l'ordre de grandeur d'un bouquet
    // reel. Le panneau se redessine a chaque frappe dans la recherche,
    // ce calcul ne doit donc pas dependre du nombre de lignes affichees.
    const gros: EPGProgram[] = [];
    for (let c = 0; c < 900; c++) {
      for (let h = 12; h < 24; h++) {
        gros.push(makeProgram(`ch${c}`, h, 0, h + 1 > 23 ? 23 : h + 1, h + 1 > 23 ? 59 : 0, `P${c}-${h}`));
      }
    }

    const debut = performance.now();
    const map = buildChannelEpgMap(gros, at(20, 26));
    const duree = performance.now() - debut;

    expect(map.size).toBe(900);
    expect(map.get('ch42')?.title).toBe('P42-20');
    expect(duree).toBeLessThan(500);
  });
});
