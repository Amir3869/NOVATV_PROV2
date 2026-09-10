import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  parseXMLTVDate,
  matchChannelsWithEPG,
  parseXMLTV,
  getCurrentAndNext,
  endOfDayAhead,
  type ParsedEPGChannel,
} from './epgService';

/**
 * Les tests de date dépendent du fuseau de la machine : un programme
 * « sans indication de fuseau » doit être lu en heure locale. On fixe
 * donc Europe/Paris pour que le résultat soit reproductible partout.
 */
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Europe/Paris';
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe('parseXMLTVDate — fuseaux horaires', () => {
  /**
   * Le défaut le plus visible de l'ancienne version. La spécification
   * XMLTV rend le décalage facultatif ; en son absence l'heure est
   * locale. L'ancien code ajoutait `+0000` : en France, tous les
   * programmes étaient décalés d'une heure en hiver et de deux en été.
   */
  it("interprète une heure sans fuseau comme locale (hiver)", () => {
    const d = parseXMLTVDate('20240101200000');
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(20);
  });

  it("interprète une heure sans fuseau comme locale (été)", () => {
    const d = parseXMLTVDate('20240715200000');
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(20);
  });

  it.each([
    ['20240101120000 +0100', '2024-01-01T11:00:00.000Z', 'décalage compact'],
    ['20240101120000 +01:00', '2024-01-01T11:00:00.000Z', 'décalage avec deux-points'],
    ['20240101120000 -0500', '2024-01-01T17:00:00.000Z', 'décalage négatif'],
    ['20240101120000 UTC', '2024-01-01T12:00:00.000Z', 'UTC textuel'],
    ['20240101120000 GMT', '2024-01-01T12:00:00.000Z', 'GMT textuel'],
    ['20240101120000 Z', '2024-01-01T12:00:00.000Z', 'Z'],
  ])('accepte %s (%s)', (input, expected) => {
    expect(parseXMLTVDate(input)?.toISOString()).toBe(expected);
  });

  it('accepte un horodatage sans les secondes', () => {
    const d = parseXMLTVDate('202401011200');
    expect(d?.getHours()).toBe(12);
    expect(d?.getMinutes()).toBe(0);
  });

  it('accepte un horodatage réduit à l’heure', () => {
    expect(parseXMLTVDate('2024010112')?.getHours()).toBe(12);
  });

  it.each([
    ['20241301120000', 'mois 13'],
    ['20240132120000', 'jour 32'],
    ['20240101250000', 'heure 25'],
    ['20240101126000', 'minute 60'],
    ['20240101120000 +9900', 'décalage aberrant'],
    ['', 'chaîne vide'],
    ['bonjour', 'texte'],
  ])('rejette %s (%s)', (input) => {
    expect(parseXMLTVDate(input)).toBeNull();
  });

  it('gère un programme à cheval sur minuit', () => {
    const start = parseXMLTVDate('20240101233000 +0100');
    const stop = parseXMLTVDate('20240102003000 +0100');
    expect(stop!.getTime() - start!.getTime()).toBe(3_600_000);
  });

  it("reste cohérent au passage à l'heure d'été", () => {
    // Nuit du 30 au 31 mars 2024 : 02 h 00 devient 03 h 00 en France.
    const before = parseXMLTVDate('20240331013000 +0100');
    const after = parseXMLTVDate('20240331033000 +0200');
    expect(after!.getTime() - before!.getTime()).toBe(3_600_000);
  });
});

describe('matchChannelsWithEPG', () => {
  const epg: ParsedEPGChannel[] = [
    { id: 'TF1.fr', displayName: 'TF1' },
    { id: 'M6.fr', displayName: 'M6 HD' },
    { id: 'C+.fr', displayName: 'Canal+' },
  ];

  it('rapproche par identifiant exact', () => {
    const m = matchChannelsWithEPG([{ id: 'a', name: 'TF1', tvgId: 'TF1.fr' }], epg);
    expect(m.get('a')).toBe('TF1.fr');
  });

  it("rapproche par identifiant en ignorant la casse", () => {
    const m = matchChannelsWithEPG([{ id: 'b', name: 'peu importe', tvgId: 'tf1.FR' }], epg);
    expect(m.get('b')).toBe('TF1.fr');
  });

  it('rapproche par nom en ignorant le suffixe de qualité', () => {
    const m = matchChannelsWithEPG([{ id: 'c', name: 'M6' }], epg);
    expect(m.get('c')).toBe('M6.fr');
  });

  it('rapproche par nom en ignorant ponctuation et casse', () => {
    const m = matchChannelsWithEPG([{ id: 'd', name: 'CANAL +' }], epg);
    expect(m.get('d')).toBe('C+.fr');
  });

  it("n'invente aucun rapprochement", () => {
    const m = matchChannelsWithEPG([{ id: 'e', name: 'Chaîne inexistante' }], epg);
    expect(m.has('e')).toBe(false);
  });

  it('rapproche par identifiant de flux Xtream', () => {
    const m = matchChannelsWithEPG(
      [{ id: 'f', name: 'TF1', streamId: 1042 }],
      [{ id: '1042', displayName: 'TF1 HD' }]
    );
    expect(m.get('f')).toBe('1042');
  });

  /**
   * Garde-fou de performance. L'ancienne version parcourait toute la
   * liste EPG pour chaque chaîne : 2 559 ms mesurées sur ce jeu de
   * données, soit une interface figée — bien pire sur un Fire TV Stick.
   * Les index `Map` ramènent l'opération à ~35 ms. Le seuil est
   * volontairement large (500 ms) pour ne pas rendre le test instable
   * sur une machine d'intégration lente, tout en détectant sans
   * ambiguïté un retour au comportement quadratique.
   */
  it('apparie 20 000 × 15 000 chaînes en un temps raisonnable', () => {
    const epgLarge: ParsedEPGChannel[] = Array.from({ length: 15_000 }, (_, i) => ({
      id: `ch${i}.fr`,
      displayName: `Chaine ${i}`,
    }));
    const playlist = Array.from({ length: 20_000 }, (_, i) => ({
      id: `p${i}`,
      name: `Chaine ${i}`,
      // 30 % sans identifiant : force le repli sur le nom.
      tvgId: i % 10 < 3 ? undefined : `ch${i}.fr`,
    }));

    const t0 = performance.now();
    const mapping = matchChannelsWithEPG(playlist, epgLarge);
    const elapsed = performance.now() - t0;

    expect(mapping.size).toBe(15_000);
    expect(elapsed).toBeLessThan(500);
  });
});

describe('parseXMLTV', () => {
  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="tf1.fr">
    <display-name>TF1</display-name>
    <icon src="http://exemple.tv/tf1.png" />
  </channel>
  <channel id="m6.fr">
    <display-name></display-name>
    <display-name>M6</display-name>
  </channel>
  <programme channel="tf1.fr" start="20240101200000 +0100" stop="20240101213000 +0100">
    <title>Journal</title>
    <desc>Le journal du soir.</desc>
    <category>Information</category>
  </programme>
  <programme channel="tf1.fr" start="20240101213000 +0100">
    <title>Sans heure de fin</title>
  </programme>
  <programme channel="tf1.fr" start="20240101230000 +0100" stop="20240101220000 +0100">
    <title>Horaires incoherents</title>
  </programme>
</tv>`;

  it('extrait les chaînes avec leur logo', async () => {
    const r = await parseXMLTV(XML);
    expect(r.channels).toHaveLength(2);
    expect(r.channels[0]).toMatchObject({
      id: 'tf1.fr',
      displayName: 'TF1',
      icon: 'http://exemple.tv/tf1.png',
    });
  });

  it('ignore un display-name vide et prend le suivant', async () => {
    const r = await parseXMLTV(XML);
    expect(r.channels[1].displayName).toBe('M6');
  });

  it('extrait les programmes valides', async () => {
    const r = await parseXMLTV(XML);
    const journal = r.programs.find((p) => p.title === 'Journal');
    expect(journal).toBeDefined();
    expect(journal!.description).toBe('Le journal du soir.');
    expect(journal!.category).toBe('Information');
  });

  it('lit l’affiche d’un programme via <icon>, <poster> ou <image>', async () => {
    const xml = `<?xml version="1.0"?>
<tv>
  <channel id="a"><display-name>A</display-name></channel>
  <programme channel="a" start="20240101200000 +0100" stop="20240101210000 +0100">
    <title>Icon</title>
    <icon src="http://art/icon.jpg" />
  </programme>
  <programme channel="a" start="20240101210000 +0100" stop="20240101220000 +0100">
    <title>Poster</title>
    <poster src="http://art/poster.jpg" />
  </programme>
  <programme channel="a" start="20240101220000 +0100" stop="20240101230000 +0100">
    <title>Image</title>
    <image>http://art/image.jpg</image>
  </programme>
</tv>`;
    const r = await parseXMLTV(xml);
    expect(r.programs.find((p) => p.title === 'Icon')?.icon).toBe('http://art/icon.jpg');
    expect(r.programs.find((p) => p.title === 'Poster')?.icon).toBe('http://art/poster.jpg');
    expect(r.programs.find((p) => p.title === 'Image')?.icon).toBe('http://art/image.jpg');
  });

  it("suppose une heure de durée quand l'attribut stop manque", async () => {
    const r = await parseXMLTV(XML);
    const p = r.programs.find((x) => x.title === 'Sans heure de fin');
    expect(p).toBeDefined();
    expect(p!.stop.getTime() - p!.start.getTime()).toBe(3_600_000);
  });

  it('écarte un programme dont la fin précède le début', async () => {
    const r = await parseXMLTV(XML);
    expect(r.programs.find((p) => p.title === 'Horaires incoherents')).toBeUndefined();
    expect(r.errors.some((e) => /incohérent/i.test(e))).toBe(true);
  });

  it('signale un fichier vide', async () => {
    const r = await parseXMLTV('   ');
    expect(r.errors).toHaveLength(1);
    expect(r.channels).toHaveLength(0);
  });

  it("signale un fichier qui n'est pas du XMLTV", async () => {
    const r = await parseXMLTV('<html><body>Erreur 502</body></html>');
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.programs).toHaveLength(0);
  });

  it('signale un XML corrompu', async () => {
    const r = await parseXMLTV('<tv><channel id="a"><oops</tv>');
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rend compte de la progression jusqu’à 1', async () => {
    const values: number[] = [];
    await parseXMLTV(XML, { chunkSize: 1, onProgress: (p) => values.push(p) });
    expect(values.length).toBeGreaterThan(0);
    expect(values[values.length - 1]).toBe(1);
  });

  it('peut être annulé', async () => {
    const big = `<tv>${'<channel id="x"><display-name>X</display-name></channel>'.repeat(500)}</tv>`;
    const controller = new AbortController();
    controller.abort();
    await expect(parseXMLTV(big, { chunkSize: 10, signal: controller.signal })).rejects.toThrow(
      /annul/i
    );
  });
});

describe('getCurrentAndNext', () => {
  const base = new Date('2024-01-01T20:00:00Z').getTime();
  const programs = [
    { channelId: 'a', title: 'P1', start: new Date(base), stop: new Date(base + 3_600_000) },
    {
      channelId: 'a',
      title: 'P2',
      start: new Date(base + 3_600_000),
      stop: new Date(base + 7_200_000),
    },
    {
      channelId: 'b',
      title: 'Autre chaîne',
      start: new Date(base),
      stop: new Date(base + 3_600_000),
    },
  ];

  it('identifie le programme en cours', () => {
    const { current } = getCurrentAndNext(programs, 'a', new Date(base + 600_000));
    expect(current?.title).toBe('P1');
  });

  it('liste les programmes suivants de la bonne chaîne', () => {
    const { next } = getCurrentAndNext(programs, 'a', new Date(base + 600_000));
    expect(next.map((p) => p.title)).toEqual(['P2']);
  });

  it('renvoie null hors de toute plage horaire', () => {
    const { current } = getCurrentAndNext(programs, 'a', new Date(base - 3_600_000));
    expect(current).toBeNull();
  });
});

/**
 * Reglage « Jours de guide TV ». Le guide vit en memoire seule : sans
 * plafond, un portail qui renvoie quatorze jours pour cinq cents
 * chaines fait tuer l\'application par le systeme sur un boitier TV.
 */
describe('endOfDayAhead', () => {
  it('1 jour va jusqu\'a minuit de ce soir', () => {
    const from = new Date(2024, 0, 15, 22, 30, 0);
    const end = endOfDayAhead(1, from);
    expect(end.getFullYear()).toBe(2024);
    expect(end.getMonth()).toBe(0);
    expect(end.getDate()).toBe(16);
    expect(end.getHours()).toBe(0);
  });

  it('3 jours va jusqu\'a minuit du surlendemain', () => {
    const from = new Date(2024, 0, 15, 22, 30, 0);
    const end = endOfDayAhead(3, from);
    expect(end.getDate()).toBe(18);
    expect(end.getHours()).toBe(0);
  });

  /**
   * Le point du cadrage : demander « 3 jours » a 22 h doit couvrir
   * trois soirees entieres. Un calcul en heures (maintenant + 72 h)
   * s\'arreterait a 22 h le troisieme jour et couperait le film du soir.
   */
  it('ne depend pas de l\'heure de la journee', () => {
    const tot = endOfDayAhead(3, new Date(2024, 0, 15, 1, 0, 0));
    const tard = endOfDayAhead(3, new Date(2024, 0, 15, 23, 59, 0));
    expect(tot.getTime()).toBe(tard.getTime());
  });

  it('franchit une fin de mois', () => {
    // 3 jours depuis le 30 janvier couvre les 30, 31 et 1er fevrier,
    // donc la borne tombe a minuit dans la nuit du 1er au 2.
    const end = endOfDayAhead(3, new Date(2024, 0, 30, 12, 0, 0));
    expect(end.getMonth()).toBe(1);
    expect(end.getDate()).toBe(2);
  });

  it('franchit une fin d\'annee', () => {
    const end = endOfDayAhead(2, new Date(2024, 11, 31, 12, 0, 0));
    expect(end.getFullYear()).toBe(2025);
    expect(end.getDate()).toBe(2);
  });

  it('traite 0 et les valeurs negatives comme aujourd\'hui', () => {
    const from = new Date(2024, 0, 15, 12, 0, 0);
    expect(endOfDayAhead(0, from).getDate()).toBe(16);
    expect(endOfDayAhead(-5, from).getDate()).toBe(16);
  });
});

describe('parseXMLTV — plafond keepAheadDays', () => {
  /**
   * Les dates sont calculees a partir de maintenant : le filtre compare
   * a l\'horloge reelle, un XML fige en 2024 serait entierement rejete.
   *
   * ─── Pourquoi l\'horloge est figee ─────────────────────────────────
   *
   * Ces tests construisent des programmes « dans 1 heure », « dans 30
   * heures », etc. Leur resultat depend donc de l\'heure qu\'il est
   * quand on les lance.
   *
   * Exemple concret du defaut corrige ici : a 23h30, « dans 1 heure »
   * tombe a 00h30 le LENDEMAIN. Le plafond « 1 jour » signifie « ce
   * qui commence avant le prochain minuit » : le programme etait donc
   * rejete, et l\'assertion `toContain('Bientot')` echouait. Le code
   * etait juste, le test se croyait a midi.
   *
   * `vi.setSystemTime` fixe un instant unique, 12h00 le mercredi
   * 15 janvier 2025, pour que le resultat ne depende plus du moment
   * de l\'execution.
   *
   * `toFake: ['Date']` limite volontairement la simulation a l\'objet
   * `Date`. Sans cette restriction vitest remplacerait aussi
   * `setTimeout`, or `parseXMLTV` s\'en sert pour rendre la main entre
   * deux lots : les promesses ne se resoudraient jamais et les tests
   * resteraient bloques.
   */
  const MIDI = new Date(2025, 0, 15, 12, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(MIDI);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const iso = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
      `${p(d.getHours())}${p(d.getMinutes())}00`
    );
  };
  const dansHeures = (h: number) => new Date(Date.now() + h * 3_600_000);

  const build = () => {
    const a = dansHeures(1);
    const b = dansHeures(1.5);
    const c = dansHeures(30);
    const d = dansHeures(31);
    const e = dansHeures(24 * 9);
    const f = dansHeures(24 * 9 + 1);
    return `<?xml version="1.0"?>
<tv>
  <channel id="c1"><display-name>C1</display-name></channel>
  <programme channel="c1" start="${iso(a)}" stop="${iso(b)}"><title>Bientot</title></programme>
  <programme channel="c1" start="${iso(c)}" stop="${iso(d)}"><title>Demain</title></programme>
  <programme channel="c1" start="${iso(e)}" stop="${iso(f)}"><title>Lointain</title></programme>
</tv>`;
  };

  it('sans plafond, garde tout — comportement historique', async () => {
    const r = await parseXMLTV(build());
    expect(r.programs).toHaveLength(3);
  });

  it('keepAheadDays a 0 desactive le filtre', async () => {
    const r = await parseXMLTV(build(), { keepAheadDays: 0 });
    expect(r.programs).toHaveLength(3);
  });

  it('a 1 jour, ne garde que ce qui commence avant minuit', async () => {
    const r = await parseXMLTV(build(), { keepAheadDays: 1 });
    const titres = r.programs.map((p) => p.title);
    expect(titres).toContain('Bientot');
    expect(titres).not.toContain('Lointain');
  });

  it('a 3 jours, garde demain mais pas la semaine prochaine', async () => {
    const r = await parseXMLTV(build(), { keepAheadDays: 3 });
    const titres = r.programs.map((p) => p.title);
    expect(titres).toContain('Bientot');
    expect(titres).toContain('Demain');
    expect(titres).not.toContain('Lointain');
  });

  it('a 7 jours, garde davantage qu\'a 1 jour', async () => {
    const court = await parseXMLTV(build(), { keepAheadDays: 1 });
    const long = await parseXMLTV(build(), { keepAheadDays: 7 });
    expect(long.programs.length).toBeGreaterThanOrEqual(court.programs.length);
  });

  /**
   * Un programme commence avant minuit et deborde sur le jour suivant.
   * On teste le DEBUT, pas la fin : couper ici amputerait la derniere
   * soiree en plein milieu du film.
   */
  it('garde un programme a cheval sur minuit', async () => {
    const debut = new Date();
    debut.setHours(23, 30, 0, 0);
    const fin = new Date(debut.getTime() + 2 * 3_600_000);
    const xml = `<?xml version="1.0"?>
<tv>
  <channel id="c1"><display-name>C1</display-name></channel>
  <programme channel="c1" start="${iso(debut)}" stop="${iso(fin)}"><title>A cheval</title></programme>
</tv>`;
    const r = await parseXMLTV(xml, { keepAheadDays: 1 });
    expect(r.programs.map((p) => p.title)).toContain('A cheval');
  });

  it('un programme rejete par le plafond n\'est pas une erreur', async () => {
    const r = await parseXMLTV(build(), { keepAheadDays: 1 });
    expect(r.errors).toHaveLength(0);
  });

  it('conserve les chaines meme si tous leurs programmes sont coupes', async () => {
    const r = await parseXMLTV(build(), { keepAheadDays: 1 });
    expect(r.channels).toHaveLength(1);
  });
});
