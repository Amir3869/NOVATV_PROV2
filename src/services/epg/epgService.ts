/**
 * Guide des programmes (EPG) au format XMLTV — Nova TV
 *
 * XMLTV est un format XML standard décrivant des chaînes et leurs
 * programmes :
 *
 *   <channel id="tf1.fr">
 *     <display-name>TF1</display-name>
 *   </channel>
 *   <programme channel="tf1.fr" start="20240101200000 +0100"
 *                               stop="20240101213000 +0100">
 *     <title>Journal</title>
 *   </programme>
 *
 * Deux difficultés propres à ce format :
 *
 * 1. **Le fuseau horaire est facultatif.** Beaucoup de fournisseurs
 *    l'omettent. Il ne faut alors surtout pas supposer UTC : un
 *    programme à 20 h 00 s'afficherait à 21 h 00 en France l'hiver, et
 *    22 h 00 l'été. Sans indication, on interprète l'heure comme
 *    **locale**, ce qui est le comportement attendu par l'utilisateur.
 *
 * 2. **Les fichiers sont volumineux** : un EPG de 7 jours pour 15 000
 *    chaînes dépasse couramment 100 Mo. L'analyse se fait donc par
 *    lots, en rendant la main à l'interface entre chaque lot.
 */

export interface ParsedEPGChannel {
  id: string;
  displayName: string;
  icon?: string;
  url?: string;
}

export interface ParsedEPGProgram {
  channelId: string;
  title: string;
  start: Date;
  stop: Date;
  description?: string;
  category?: string;
  icon?: string;
  episodeNum?: string;
  rating?: string;
}

export interface EPGParseResult {
  channels: ParsedEPGChannel[];
  programs: ParsedEPGProgram[];
  errors: string[];
}

export interface EPGParseOptions {
  /** Nombre d'éléments traités avant de rendre la main à l'interface. */
  chunkSize?: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  /**
   * Ignore les programmes terminés depuis plus de N heures.
   * Évite de conserver une semaine de passé inutile.
   * `0` désactive le filtre.
   */
  dropOlderThanHours?: number;
  /**
   * Ignore les programmes commençant au-delà de N jours.
   *
   * Symétrique de `dropOlderThanHours`, mais côté futur. Un portail
   * renvoie couramment 7 à 14 jours de guide ; sur un boîtier TV à
   * faible mémoire, tout conserver finit par faire tuer l'application
   * par le système.
   *
   * Le décompte va jusqu'à MINUIT du dernier jour, pas à l'heure près :
   * « 3 jours » demandé à 22 h doit couvrir trois soirées entières, pas
   * s'arrêter au milieu de la troisième.
   *
   * `0` désactive le filtre.
   */
  keepAheadDays?: number;
}

/**
 * Instant de fin du N-ième jour à venir, minuit local.
 *
 * `keepAheadDays = 1` renvoie la fin d'aujourd'hui, `2` la fin de
 * demain. Exportée pour être testable : la logique de date est le genre
 * de calcul qui se casse discrètement aux changements d'heure.
 */
export function endOfDayAhead(days: number, from: Date = new Date()): Date {
  const end = new Date(from);
  // setDate gère le débordement de mois et d'année tout seul.
  end.setDate(end.getDate() + Math.max(0, days - 1));
  // Minuit à la FIN du jour visé, donc le début du jour suivant.
  end.setHours(24, 0, 0, 0);
  return end;
}

/** Au-delà, on cesse d'accumuler les messages : ils seraient illisibles. */
const MAX_ERRORS = 50;

/**
 * Analyse un contenu XMLTV.
 *
 * Nécessite `DOMParser`, donc un environnement navigateur. Côté serveur
 * (rendu Next.js), la fonction renvoie une erreur explicite plutôt que
 * de planter.
 */
export async function parseXMLTV(
  xmlContent: string,
  options: EPGParseOptions = {}
): Promise<EPGParseResult> {
  const {
    chunkSize = 2000,
    onProgress,
    signal,
    dropOlderThanHours = 0,
    keepAheadDays = 0,
  } = options;

  const result: EPGParseResult = { channels: [], programs: [], errors: [] };

  if (typeof DOMParser === 'undefined') {
    result.errors.push(
      "Le guide des programmes ne peut être analysé que dans le navigateur."
    );
    return result;
  }

  if (!xmlContent.trim()) {
    result.errors.push('Le fichier du guide des programmes est vide.');
    return result;
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
  } catch (err) {
    result.errors.push(
      `Le fichier du guide n'a pas pu être lu : ${err instanceof Error ? err.message : String(err)}`
    );
    return result;
  }

  // En cas de XML mal formé, DOMParser n'échoue pas : il insère un
  // élément <parsererror> dans le document.
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    result.errors.push(
      "Le fichier du guide des programmes est corrompu ou incomplet."
    );
    return result;
  }

  // `>` limite la recherche aux enfants directs de <tv>. Sans cela, un
  // élément <channel> imbriqué ailleurs serait ramassé par erreur.
  const channelEls = Array.from(doc.querySelectorAll('tv > channel, channel'));
  const programEls = Array.from(doc.querySelectorAll('tv > programme, programme'));
  const total = channelEls.length + programEls.length;

  if (total === 0) {
    result.errors.push(
      "Aucune chaîne ni programme trouvé. Ce fichier n'est peut-être pas un guide XMLTV."
    );
    return result;
  }

  let processed = 0;

  const yieldToUI = async () => {
    if (signal?.aborted) {
      throw new DOMException('Import du guide annulé.', 'AbortError');
    }
    onProgress?.(processed / total);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };

  // --- Chaînes ---
  const seenChannelIds = new Set<string>();

  for (let i = 0; i < channelEls.length; i++) {
    const el = channelEls[i];
    const id = el.getAttribute('id')?.trim();

    if (id && !seenChannelIds.has(id)) {
      seenChannelIds.add(id);

      // Une chaîne peut avoir plusieurs <display-name> (langues,
      // abréviations). On prend le premier non vide.
      let displayName = '';
      for (const nameEl of Array.from(el.querySelectorAll('display-name'))) {
        const text = nameEl.textContent?.trim();
        if (text) {
          displayName = text;
          break;
        }
      }

      result.channels.push({
        id,
        // Une chaîne sans nom lisible reste utile : son identifiant
        // permet quand même de rattacher les programmes.
        displayName: displayName || id,
        icon: el.querySelector('icon')?.getAttribute('src')?.trim() || undefined,
        url: el.querySelector('url')?.textContent?.trim() || undefined,
      });
    }

    processed++;
    if (processed % chunkSize === 0) await yieldToUI();
  }

  // --- Programmes ---
  const cutoff =
    dropOlderThanHours > 0 ? Date.now() - dropOlderThanHours * 3_600_000 : null;

  // Plafond côté futur. Calculé une seule fois : le parcours peut durer
  // plusieurs secondes sur un gros fichier, et un plafond qui glisse
  // pendant l'analyse produirait des résultats non reproductibles.
  const horizon = keepAheadDays > 0 ? endOfDayAhead(keepAheadDays).getTime() : null;

  for (let i = 0; i < programEls.length; i++) {
    const el = programEls[i];

    const channelId = el.getAttribute('channel')?.trim();
    const startStr = el.getAttribute('start');
    const stopStr = el.getAttribute('stop');

    let title = '';
    for (const titleEl of Array.from(el.querySelectorAll('title'))) {
      const text = titleEl.textContent?.trim();
      if (text) {
        title = text;
        break;
      }
    }

    if (channelId && startStr && title) {
      const start = parseXMLTVDate(startStr);

      // L'attribut `stop` est facultatif dans la spécification XMLTV.
      // L'ancienne version rejetait le programme s'il manquait. On
      // suppose plutôt une durée d'une heure, quitte à la corriger
      // ensuite avec le début du programme suivant.
      let stop = stopStr ? parseXMLTVDate(stopStr) : null;
      if (start && !stop) {
        stop = new Date(start.getTime() + 3_600_000);
      }

      if (!start || !stop) {
        if (result.errors.length < MAX_ERRORS) {
          result.errors.push(`Programme « ${title} » : date illisible, ignoré.`);
        }
      } else if (stop.getTime() <= start.getTime()) {
        // Un programme qui finit avant de commencer casserait
        // l'affichage de la grille horaire.
        if (result.errors.length < MAX_ERRORS) {
          result.errors.push(`Programme « ${title} » : horaires incohérents, ignoré.`);
        }
      } else if (cutoff !== null && stop.getTime() < cutoff) {
        // Trop ancien : ignoré silencieusement, ce n'est pas une erreur.
      } else if (horizon !== null && start.getTime() >= horizon) {
        // Au-delà de l'horizon demandé. On teste le DÉBUT : un programme
        // commencé avant minuit et qui déborde sur le jour suivant doit
        // rester visible, sinon la dernière soirée se coupe en plein
        // milieu du film.
      } else {
        result.programs.push({
          channelId,
          title,
          start,
          stop,
          description: el.querySelector('desc')?.textContent?.trim() || undefined,
          category: el.querySelector('category')?.textContent?.trim() || undefined,
          icon: el.querySelector('icon')?.getAttribute('src')?.trim() || undefined,
          episodeNum: el.querySelector('episode-num')?.textContent?.trim() || undefined,
          rating: el.querySelector('rating value')?.textContent?.trim() || undefined,
        });
      }
    }

    processed++;
    if (processed % chunkSize === 0) await yieldToUI();
  }

  onProgress?.(1);

  if (result.errors.length >= MAX_ERRORS) {
    result.errors.push('… autres erreurs non listées.');
  }

  return result;
}

/**
 * Convertit une date XMLTV en objet `Date`.
 *
 * Formats acceptés :
 *   20240101120000 +0100   — complet, avec décalage
 *   20240101120000 +01:00  — décalage avec deux-points
 *   20240101120000 UTC     — décalage textuel
 *   20240101120000         — sans décalage : interprété en heure locale
 *   202401011200           — secondes omises
 *   2024010112             — minutes et secondes omises
 *
 * Le cas « sans décalage » est le piège principal. L'ancienne version
 * ajoutait `+0000`, décalant tous les programmes d'une à deux heures en
 * France. La spécification XMLTV indique qu'en l'absence de décalage,
 * l'heure doit être considérée comme locale.
 */
export function parseXMLTVDate(input: string): Date | null {
  const clean = input.trim();
  if (!clean) return null;

  // Les composants après l'année sont facultatifs.
  const match = clean.match(
    /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:\s*([+-]\d{2}:?\d{2}|Z|UTC|GMT))?$/i
  );
  if (!match) return null;

  const [, y, mo, d, h, mi, s, tz] = match;

  const year = Number(y);
  const month = mo ? Number(mo) : 1;
  const day = d ? Number(d) : 1;
  const hour = h ? Number(h) : 0;
  const minute = mi ? Number(mi) : 0;
  const second = s ? Number(s) : 0;

  // Le format n'interdit pas d'écrire un mois 13 ou une heure 25 ;
  // `Date` les accepterait en débordant sur la période suivante, ce qui
  // produirait un programme placé n'importe où dans la grille.
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  let date: Date;

  if (!tz) {
    // Aucun décalage : heure locale de l'appareil.
    date = new Date(year, month - 1, day, hour, minute, second);
  } else {
    const upper = tz.toUpperCase();
    let offsetMinutes = 0;

    if (upper !== 'Z' && upper !== 'UTC' && upper !== 'GMT') {
      const sign = tz[0] === '-' ? -1 : 1;
      const digits = tz.slice(1).replace(':', '');
      const offsetHours = Number(digits.slice(0, 2));
      const offsetMins = Number(digits.slice(2, 4));
      if (!Number.isFinite(offsetHours) || !Number.isFinite(offsetMins)) return null;
      if (offsetHours > 14 || offsetMins > 59) return null;
      offsetMinutes = sign * (offsetHours * 60 + offsetMins);
    }

    // `Date.UTC` évite toute interférence avec le fuseau de l'appareil.
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
    date = new Date(utcMs - offsetMinutes * 60_000);
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Rapproche les chaînes de la playlist des chaînes du guide.
 *
 * Rapprochement en trois passes, de la plus fiable à la plus permissive :
 *   1. identifiant `tvg-id` exact ;
 *   2. identifiant en ignorant la casse ;
 *   3. nom affiché, normalisé (accents, ponctuation, « HD », « FHD »…).
 *
 * Correctif de performance : l'ancienne version faisait un `find()` dans
 * la liste du guide **pour chaque chaîne**, soit 20 000 × 15 000
 * comparaisons dans un cas réaliste — mesuré à 2,5 s d'interface figée
 * sur un PC, bien davantage sur un Fire TV Stick. On construit
 * désormais des index (`Map`) une seule fois, ce qui rend la recherche
 * immédiate.
 */
export function matchChannelsWithEPG(
  playlistChannels: Array<{ id: string; name: string; tvgId?: string }>,
  epgChannels: ParsedEPGChannel[]
): Map<string, string> {
  const mapping = new Map<string, string>();

  const byExactId = new Map<string, string>();
  const byLowerId = new Map<string, string>();
  const byNormalizedName = new Map<string, string>();

  for (const epgCh of epgChannels) {
    if (!byExactId.has(epgCh.id)) byExactId.set(epgCh.id, epgCh.id);

    const lowerId = epgCh.id.toLowerCase();
    if (!byLowerId.has(lowerId)) byLowerId.set(lowerId, epgCh.id);

    const normalized = normalizeChannelName(epgCh.displayName);
    // `has` d'abord : en cas de doublon, on garde la première chaîne
    // rencontrée, l'ordre du fichier faisant foi.
    if (normalized && !byNormalizedName.has(normalized)) {
      byNormalizedName.set(normalized, epgCh.id);
    }
  }

  for (const ch of playlistChannels) {
    const tvgId = ch.tvgId?.trim();

    if (tvgId) {
      const exact = byExactId.get(tvgId);
      if (exact) {
        mapping.set(ch.id, exact);
        continue;
      }
      const lower = byLowerId.get(tvgId.toLowerCase());
      if (lower) {
        mapping.set(ch.id, lower);
        continue;
      }
    }

    const byName = byNormalizedName.get(normalizeChannelName(ch.name));
    if (byName) mapping.set(ch.id, byName);
  }

  return mapping;
}

/**
 * Normalise un nom de chaîne pour la comparaison.
 *
 * « TF1 HD », « tf1  hd » et « TF-1 » doivent se rapprocher.
 * Les suffixes de qualité sont retirés : ils désignent la même chaîne.
 */
function normalizeChannelName(name: string): string {
  return name
    .toLowerCase()
    // Sépare les lettres de leurs accents, puis retire les accents.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(uhd|4k|fhd|hd|sd|hevc|h265|h264|raw|backup)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Télécharge puis analyse un guide XMLTV distant.
 *
 * Un EPG complet peut peser plus de 100 Mo : le délai d'attente est
 * volontairement large.
 */
export async function fetchAndParseXMLTV(
  url: string,
  options: EPGParseOptions = {}
): Promise<EPGParseResult> {
  const timeout = AbortSignal.timeout(120_000);
  const signal =
    options.signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([timeout, options.signal])
      : timeout;

  let resp: Response;
  try {
    resp = await fetch(url, { signal });
  } catch (err) {
    if (err instanceof DOMException && options.signal?.aborted) {
      throw new Error('Téléchargement du guide annulé.');
    }
    throw new Error(
      "Impossible de télécharger le guide des programmes. Vérifiez votre connexion."
    );
  }

  if (!resp.ok) {
    throw new Error(
      `Le serveur du guide a répondu par une erreur (${resp.status}).`
    );
  }

  const text = await resp.text();
  return parseXMLTV(text, options);
}

/**
 * Programme en cours et programmes suivants d'une chaîne.
 * Utilisé par la fiche chaîne et le bandeau du lecteur.
 */
export function getCurrentAndNext(
  programs: ParsedEPGProgram[],
  channelId: string,
  now: Date = new Date(),
  nextCount = 3
): { current: ParsedEPGProgram | null; next: ParsedEPGProgram[] } {
  const nowMs = now.getTime();

  const channelPrograms = programs
    .filter((p) => p.channelId === channelId)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const current =
    channelPrograms.find(
      (p) => p.start.getTime() <= nowMs && p.stop.getTime() > nowMs
    ) ?? null;

  const next = channelPrograms
    .filter((p) => p.start.getTime() > nowMs)
    .slice(0, nextCount);

  return { current, next };
}
