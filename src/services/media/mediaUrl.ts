/**
 * Normalisation des visuels distants fournis par des portails IPTV.
 *
 * Les catalogues réels contiennent parfois des URLs relatives, des doubles
 * slashs dans le chemin, des schémas recopiés deux fois ou une faute juste
 * après une adresse IP. On corrige uniquement les erreurs mécaniques sûres ;
 * on ne réécrit jamais le chemin métier d'une image.
 */
export function normalizeMediaUrl(
  raw: string | null | undefined,
  baseUrl?: string,
): string | undefined {
  if (!raw?.trim()) return undefined;

  let value = raw.trim();

  // Accepte une valeur accidentellement copiée comme un lien Markdown.
  const markdown = value.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/i);
  if (markdown) value = markdown[2];

  // Répare les schémas recopiés deux fois : hthttp:// -> http://.
  value = value.replace(/^hthttps?:\/\//i, (match) => match.slice(2));

  // Une faute fréquente sur les portails à adresse IP : "1.2.3.4m/path".
  // Le suffixe m n'est pas un nom d'hôte valide dans ce contexte ; il est
  // retiré seulement quand l'hôte précédent est bien une IPv4 complète.
  value = value.replace(
    /^(https?:\/\/\d{1,3}(?:\.\d{1,3}){3})m(?=\/)/i,
    '$1',
  );

  try {
    const fallbackBase = baseUrl?.trim()
      ? `${baseUrl.replace(/\/$/, '')}/`
      : undefined;
    const parsed = new URL(value, fallbackBase);
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/');
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Retourne les variantes à essayer dans l'ordre.
 *
 * L'URL HTTP reste prioritaire : certains CDN IPTV ne servent que HTTP.
 * HTTPS est un secours utile pour les portails qui exposent les deux
 * protocoles, notamment lorsque la WebView bloque le contenu mixte.
 */
export function mediaUrlCandidates(
  raw: string | null | undefined,
  baseUrl?: string,
): string[] {
  const normalized = normalizeMediaUrl(raw, baseUrl);
  if (!normalized) return [];

  const candidates = [normalized];
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
      candidates.push(parsed.toString());
    }
  } catch {
    // normalizeMediaUrl a déjà validé l'URL ; ce garde-fou protège les
    // environnements WebView anciens qui ont un parseur URL incomplet.
  }

  return [...new Set(candidates)];
}
