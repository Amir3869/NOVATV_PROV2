/**
 * Analyseur de fichiers M3U / M3U8 — Nova TV
 *
 * Un fichier M3U est une liste de chaînes en texte brut. Chaque chaîne
 * occupe au moins deux lignes :
 *
 *   #EXTINF:-1 tvg-id="TF1.fr" tvg-logo="http://.../tf1.png" group-title="FR",TF1
 *   http://serveur:8080/live/user/pass/1234.ts
 *
 * La première décrit la chaîne, la seconde donne l'adresse du flux.
 * Des lignes d'options peuvent s'intercaler entre les deux.
 *
 * Le traitement se fait par lots pour ne jamais figer l'interface :
 * un fichier de 50 000 chaînes analysé d'un bloc bloquerait l'écran
 * plusieurs secondes.
 */

import type { M3UEntry } from '@/types';

const EXTINF_REGEX = /^#EXTINF:(-?\d+(?:\.\d+)?)/;
const ATTR_REGEX = /([\w-]+)="([^"]*)"/g;

/** Protocoles acceptés pour une adresse de flux. */
const VALID_URL_START = /^(https?:\/\/|rtmps?:\/\/|rtsp:\/\/|udp:\/\/|file:\/\/|\/)/i;

export interface ParseResult {
  entries: M3UEntry[];
  errors: string[];
  lineCount: number;
  duration: number;
}

export interface ParseOptions {
  /** Nombre de lignes traitées avant de rendre la main à l'interface. */
  chunkSize?: number;
  /** Appelée régulièrement : progression de 0 à 1, et nombre d'entrées. */
  onProgress?: (progress: number, entriesFound: number) => void;
  /** Permet d'annuler un import long depuis l'interface. */
  signal?: AbortSignal;
}

interface RawLine {
  text: string;
  /** Numéro de ligne dans le fichier d'origine, pour des erreurs utiles. */
  lineNumber: number;
}

/**
 * Analyse un contenu M3U et renvoie la liste des chaînes trouvées.
 */
export async function parseM3U(
  content: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const { chunkSize = 2000, onProgress, signal } = options;

  const startTime = Date.now();
  const entries: M3UEntry[] = [];
  const errors: string[] = [];

  // On conserve le numéro de ligne d'origine AVANT de filtrer les lignes
  // vides. Sans cela, les messages d'erreur désignent la mauvaise ligne
  // et deviennent inutilisables pour corriger un fichier.
  const lines: RawLine[] = [];
  const rawLines = content.split(/\r?\n/);
  for (let n = 0; n < rawLines.length; n++) {
    const text = rawLines[n].trim();
    if (text) lines.push({ text, lineNumber: n + 1 });
  }

  if (lines.length === 0) {
    return { entries, errors: ['Le fichier est vide.'], lineCount: 0, duration: 0 };
  }

  if (!lines[0].text.startsWith('#EXTM3U')) {
    errors.push(
      "Le fichier ne commence pas par #EXTM3U — il ne s'agit peut-être pas d'une playlist M3U."
    );
  }

  let i = 0;

  while (i < lines.length) {
    if (signal?.aborted) {
      throw new DOMException("Import annulé par l'utilisateur.", 'AbortError');
    }

    const chunkEnd = Math.min(i + chunkSize, lines.length);

    while (i < chunkEnd) {
      const current = lines[i];

      if (!current.text.startsWith('#EXTINF:')) {
        i++;
        continue;
      }

      // Cherche l'adresse du flux après la ligne #EXTINF.
      //
      // Correctif : on ne peut pas supposer qu'elle suit immédiatement.
      // De nombreuses playlists insèrent des options entre les deux :
      //   #EXTINF:-1 ...,TF1
      //   #EXTVLCOPT:http-user-agent=Mozilla/5.0
      //   #EXTVLCOPT:http-referrer=http://exemple.fr/
      //   http://serveur:8080/live/...
      //
      // L'ancienne version s'arrêtait dès que la ligne suivante
      // commençait par « # » et perdait la chaîne. Sur certaines
      // playlists, cela revenait à en ignorer la totalité.
      let urlIndex = i + 1;
      while (urlIndex < lines.length && lines[urlIndex].text.startsWith('#')) {
        // Une nouvelle #EXTINF signifie que la précédente n'a pas d'adresse.
        if (lines[urlIndex].text.startsWith('#EXTINF:')) break;
        urlIndex++;
      }

      const urlLine =
        urlIndex < lines.length && !lines[urlIndex].text.startsWith('#')
          ? lines[urlIndex]
          : undefined;

      if (!urlLine) {
        errors.push(`Ligne ${current.lineNumber} : chaîne sans adresse de flux, ignorée.`);
        i++;
        continue;
      }

      try {
        const entry = parseExtinfLine(current.text, urlLine.text);
        if (entry) {
          entries.push(entry);
        } else {
          errors.push(`Ligne ${current.lineNumber} : entrée invalide, ignorée.`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Ligne ${current.lineNumber} : ${message}`);
      }

      // On reprend APRÈS l'adresse du flux.
      //
      // Correctif : l'ancienne version faisait `j++` à l'intérieur d'une
      // boucle `for` qui incrémentait déjà `j`. Le décalage n'était
      // appliqué que si l'entrée était valide, et il était perdu au
      // passage d'un lot au suivant. Un `while` avec un index explicite
      // supprime toute ambiguïté.
      i = urlIndex + 1;
    }

    onProgress?.(i / lines.length, entries.length);

    if (i < lines.length) {
      // Rend la main au navigateur pour qu'il redessine l'écran.
      // `setTimeout(0)` est plafonné à ~4 ms par les navigateurs ;
      // avec de gros lots, l'attente cumulée reste négligeable.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  onProgress?.(1, entries.length);

  return {
    entries,
    errors,
    lineCount: lines.length,
    duration: Date.now() - startTime,
  };
}

function parseExtinfLine(extinf: string, urlLine: string): M3UEntry | null {
  const match = EXTINF_REGEX.exec(extinf);
  if (!match) return null;

  const parsedDuration = parseFloat(match[1]);
  const duration = Number.isFinite(parsedDuration) ? parsedDuration : -1;

  const attrs: Record<string, string> = {};
  let attrMatch: RegExpExecArray | null;

  // `lastIndex` doit être remis à zéro : le drapeau /g rend l'expression
  // régulière « à mémoire », et sans cette remise à zéro une analyse sur
  // deux repartirait du milieu de la ligne précédente.
  ATTR_REGEX.lastIndex = 0;
  while ((attrMatch = ATTR_REGEX.exec(extinf)) !== null) {
    attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
  }

  // Le nom se trouve après la dernière virgule. On prend garde à ne pas
  // confondre avec une virgule figurant dans une valeur d'attribut
  // (ex. group-title="Sport, France") : on ne cherche donc la virgule
  // qu'après le dernier guillemet fermant.
  const lastQuote = extinf.lastIndexOf('"');
  const searchFrom = lastQuote >= 0 ? lastQuote : 0;
  const commaIdx = extinf.indexOf(',', searchFrom);
  const name = commaIdx >= 0 ? extinf.slice(commaIdx + 1).trim() : '';

  const finalName = name || attrs['tvg-name'] || '';
  if (!finalName) return null;

  const url = urlLine.trim();
  if (!VALID_URL_START.test(url)) return null;

  return {
    name: finalName,
    streamUrl: url,
    tvgId: attrs['tvg-id'] || undefined,
    tvgName: attrs['tvg-name'] || undefined,
    tvgLogo: attrs['tvg-logo'] || undefined,
    groupTitle: attrs['group-title'] || undefined,
    tvgCountry: attrs['tvg-country'] || undefined,
    tvgLanguage: attrs['tvg-language'] || undefined,
    duration: duration > 0 ? duration : undefined,
    raw: extinf,
  };
}

/**
 * Télécharge puis analyse une playlist M3U distante.
 *
 * ⚠️ Dans un navigateur, cet appel échouera si le serveur IPTV n'autorise
 * pas les requêtes croisées (CORS). C'est l'une des raisons pour
 * lesquelles l'APK est la cible finale : une application native n'est
 * pas soumise à cette restriction.
 */
export async function fetchAndParseM3U(
  url: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const resp = await fetch(url, { signal: options.signal });
  if (!resp.ok) {
    throw new Error(`Le serveur a répondu ${resp.status} (${resp.statusText}).`);
  }
  const text = await resp.text();
  return parseM3U(text, options);
}

/** Regroupe les chaînes par catégorie (attribut group-title). */
export function groupByCategory(entries: M3UEntry[]): Map<string, M3UEntry[]> {
  const map = new Map<string, M3UEntry[]>();
  for (const entry of entries) {
    const group = entry.groupTitle || 'Sans catégorie';
    const existing = map.get(group) ?? [];
    existing.push(entry);
    map.set(group, existing);
  }
  return map;
}
