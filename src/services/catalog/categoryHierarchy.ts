/**
 * Normalisation commune des catégories Live TV, Films et Séries.
 *
 * Le moteur distingue trois situations :
 *
 *  - `native`   : le fournisseur a transmis une relation parent/enfant ;
 *  - `inferred` : la relation est explicitement visible dans le nom ou
 *                portée par un code de région répété ;
 *  - `flat`     : aucune relation suffisamment sûre n'a été trouvée.
 *
 * Les qualités vidéo ne deviennent jamais des parents. Elles sont
 * conservées comme métadonnées de la catégorie finale afin que l'EPG
 * puisse les ignorer sans perdre l'information affichable.
 */

export type CategoryRelation = 'native' | 'inferred' | 'flat';

export type CategoryFamily = 'live' | 'movie' | 'series';

export interface CategoryHierarchyInput {
  /** Identifiant final déjà scopé par la source et la famille. */
  id: string;
  /** Identifiant brut du fournisseur, utile pour parentId. */
  sourceId?: string;
  name: string;
  count?: number;
  /** Identifiant final du parent quand la source le connaît. */
  parentId?: string;
  /** Identifiant brut du parent quand la source le connaît. */
  parentSourceId?: string;
}

export interface CategoryHierarchyNode {
  id: string;
  /** Identifiant d'origine, absent pour un parent déduit du texte. */
  sourceId?: string;
  name: string;
  /** Nom fourni par la source, toujours conservé pour le secours plat. */
  originalName: string;
  parentId: string | null;
  childIds: string[];
  level: number;
  path: string[];
  count: number;
  relation: CategoryRelation;
  /** Code de langue ou de région détecté sur cette catégorie. */
  regionCode?: string;
  /** Qualités détectées sur le nom d'origine. */
  qualities: string[];
}

export interface BuildCategoryHierarchyOptions {
  playlistId?: string;
  family?: CategoryFamily;
}

/** Qualités techniques : elles ne doivent jamais devenir un parent. */
export const CATEGORY_QUALITY_TOKENS = new Set([
  'HD',
  'FHD',
  'UHD',
  '4K',
  '8K',
  'SD',
  'HDR',
  'HEVC',
  'H264',
  'H265',
]);

/**
 * Codes courants de langue, de pays ou de bouquet.
 *
 * La liste est volontairement explicite : un mot court comme `AR` ou
 * `US` ne doit pas être interprété comme un parent simplement parce
 * qu'il est en majuscules. Il faut aussi que la catégorie contienne un
 * autre segment et que le fournisseur utilise un schéma cohérent.
 */
export const CATEGORY_REGION_CODES = new Set([
  'FR',
  'AR',
  'ES',
  'US',
  'UK',
  'GB',
  'DE',
  'IT',
  'PT',
  'BR',
  'NL',
  'BE',
  'TR',
  'PL',
  'RU',
  'GR',
  'IN',
  'PK',
  'CA',
  'AU',
  'CH',
  'AT',
  'SE',
  'NO',
  'DK',
  'FI',
  'CZ',
  'RO',
  'HU',
  'BG',
  'UA',
  'IE',
  'NZ',
  'MX',
  'CL',
  'CO',
  'MA',
  'DZ',
  'TN',
  'EG',
  'SA',
  'AE',
  'QA',
  'JP',
  'KR',
  'CN',
  'TW',
  'TH',
  'VN',
  'ID',
  'MY',
  'PH',
  'ZA',
  'INT',
  'EU',
]);

const EXPLICIT_SEPARATOR = /\s*(?:\||>|›|»|::)\s*|\s+-\s+/;

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function tokens(value: string): string[] {
  return fold(value).split(/[\s/]+/).filter(Boolean);
}

function isQualityToken(token: string): boolean {
  return CATEGORY_QUALITY_TOKENS.has(token);
}

function qualityTokens(name: string): string[] {
  return [...new Set(tokens(name).filter(isQualityToken))];
}

function regionCode(name: string): string | undefined {
  const parts = tokens(name).filter((token) => !isQualityToken(token));
  return parts.find((token) => CATEGORY_REGION_CODES.has(token));
}

function cleanSegment(segment: string): string {
  return segment
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+(?:HD|FHD|UHD|4K|8K|SD|HDR|HEVC|H264|H265)$/i, '')
    .trim();
}

function explicitSegments(name: string): string[] | null {
  if (!EXPLICIT_SEPARATOR.test(name)) return null;
  const segments = name
    .split(EXPLICIT_SEPARATOR)
    .map(cleanSegment)
    .filter(Boolean);
  return segments.length > 1 ? segments : null;
}

/**
 * Déduit un chemin uniquement pour les schémas suffisamment lisibles.
 *
 * Les séparateurs explicites sont prioritaires. En leur absence, un code
 * de région placé au début ou à la fin peut former une famille (`AR
 * Sport`, `Sport ES`). Un préfixe quelconque comme `HD` ou `FHD` n'est
 * jamais utilisé pour créer un parent.
 */
export function categoryPathFromName(name: string): {
  path: string[];
  relation: CategoryRelation;
} {
  const explicit = explicitSegments(name);
  if (explicit) {
    return { path: explicit, relation: 'inferred' };
  }

  const original = name.trim();
  const parts = original.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { path: [original], relation: 'flat' };

  const first = fold(parts[0]);
  const last = fold(parts[parts.length - 1]);
  if (CATEGORY_REGION_CODES.has(first) && !isQualityToken(first)) {
    const leaf = cleanSegment(parts.slice(1).join(' '));
    if (leaf) return { path: [parts[0], leaf], relation: 'inferred' };
  }

  if (CATEGORY_REGION_CODES.has(last) && !isQualityToken(last)) {
    const leaf = cleanSegment(parts.slice(0, -1).join(' '));
    if (leaf) return { path: [parts[parts.length - 1], leaf], relation: 'inferred' };
  }

  return { path: [original], relation: 'flat' };
}

function stableSlug(value: string): string {
  const folded = fold(value)
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return folded || 'group';
}

function derivedId(
  playlistId: string | undefined,
  family: CategoryFamily | undefined,
  path: string[]
): string {
  const source = playlistId ?? 'source';
  const kind = family ?? 'catalog';
  return `${source}:${kind}:group:${path.map(stableSlug).join('--')}`;
}

function directParentByInput(
  input: CategoryHierarchyInput,
  bySourceId: Map<string, CategoryHierarchyInput>,
  byId: Map<string, CategoryHierarchyInput>
): string | null {
  if (input.parentId && byId.has(input.parentId)) return input.parentId;
  if (input.parentSourceId) return bySourceId.get(input.parentSourceId)?.id ?? null;
  return null;
}

/**
 * Construit un arbre stable tout en gardant une vue plate de secours.
 *
 * Les parents déduits sont synthétiques et clairement identifiables par
 * leur identifiant `:group:`. Ils ne remplacent jamais les catégories
 * d'origine : les feuilles conservent leur id et leur nom exacts.
 */
export function buildCategoryHierarchy(
  inputs: readonly CategoryHierarchyInput[],
  options: BuildCategoryHierarchyOptions = {}
): CategoryHierarchyNode[] {
  const unique = new Map<string, CategoryHierarchyInput>();
  for (const input of inputs) {
    const id = input.id.trim();
    const name = input.name.trim();
    if (!id || !name || unique.has(id)) continue;
    unique.set(id, { ...input, id, name, count: Math.max(0, input.count ?? 0) });
  }

  const sourceInputs = [...unique.values()];
  const bySourceId = new Map<string, CategoryHierarchyInput>();
  const byId = new Map<string, CategoryHierarchyInput>();
  for (const input of sourceInputs) {
    byId.set(input.id, input);
    if (input.sourceId) bySourceId.set(input.sourceId, input);
  }

  const nodes = new Map<string, CategoryHierarchyNode>();
  const order: string[] = [];

  const ensureSyntheticParent = (path: string[], index: number): string => {
    const parentPath = path.slice(0, index + 1);
    const id = derivedId(options.playlistId, options.family, parentPath);
    if (!nodes.has(id)) {
      const name = parentPath[parentPath.length - 1];
      nodes.set(id, {
        id,
        name,
        originalName: name,
        parentId: null,
        childIds: [],
        level: 0,
        path: parentPath,
        count: 0,
        relation: 'inferred',
        regionCode: regionCode(name),
        qualities: [],
      });
      order.push(id);
    }
    return id;
  };

  for (const input of sourceInputs) {
    const nativeParent = directParentByInput(input, bySourceId, byId);
    const parsed = categoryPathFromName(input.name);
    const parentId = nativeParent ?? (parsed.path.length > 1
      ? ensureSyntheticParent(parsed.path, parsed.path.length - 2)
      : null);

    const node: CategoryHierarchyNode = {
      id: input.id,
      sourceId: input.sourceId,
      name: input.name,
      originalName: input.name,
      parentId,
      childIds: [],
      level: 0,
      path: parsed.path,
      count: input.count ?? 0,
      relation: nativeParent ? 'native' : parsed.relation,
      regionCode: regionCode(input.name),
      qualities: qualityTokens(input.name),
    };
    nodes.set(input.id, node);
    order.push(input.id);
  }

  // Reconcile parent chains for explicit paths deeper than one level.
  for (const input of sourceInputs) {
    const node = nodes.get(input.id);
    if (!node || directParentByInput(input, bySourceId, byId)) continue;

    const parsed = categoryPathFromName(input.name);
    if (parsed.path.length < 2) continue;

    let parent: string | null = null;
    for (let index = 0; index < parsed.path.length - 1; index += 1) {
      const current = ensureSyntheticParent(parsed.path, index);
      if (parent) {
        const currentNode = nodes.get(current);
        if (currentNode && !currentNode.parentId) currentNode.parentId = parent;
      }
      parent = current;
    }
    node.parentId = parent;
  }

  // Rebuild relations and paths from the actual parent links.
  for (const node of nodes.values()) node.childIds = [];
  for (const node of nodes.values()) {
    if (node.parentId) {
      const parent = nodes.get(node.parentId);
      if (parent && !parent.childIds.includes(node.id)) parent.childIds.push(node.id);
      else node.parentId = null;
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: CategoryHierarchyNode, ancestors: string[]): void => {
    if (visiting.has(node.id)) {
      node.parentId = null;
      node.level = 0;
      node.path = [node.name];
      return;
    }
    if (visited.has(node.id)) return;

    visiting.add(node.id);
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) {
      visit(parent, ancestors);
      node.level = parent.level + 1;
      // `name` reste le libellé brut de la source (par exemple
      // `FR | NEWS`), tandis que `path` doit rester sémantique et
      // utiliser le dernier segment réellement détecté (`NEWS`).
      const leafLabel = node.path[node.path.length - 1] ?? node.name;
      node.path = [...parent.path, leafLabel];
    } else {
      node.level = 0;
      node.path = [node.name];
    }
    visiting.delete(node.id);
    visited.add(node.id);
  };

  for (const node of nodes.values()) visit(node, []);

  // Les compteurs des parents incluent les contenus de leurs enfants.
  // Les catégories natives peuvent aussi porter des contenus directs :
  // ils restent comptés une seule fois à leur propre niveau.
  const aggregate = (node: CategoryHierarchyNode, seen: Set<string>): number => {
    if (seen.has(node.id)) return node.count;
    seen.add(node.id);
    const own = node.count;
    const children = node.childIds
      .map((id) => nodes.get(id))
      .filter((child): child is CategoryHierarchyNode => Boolean(child))
      .reduce((sum, child) => sum + aggregate(child, seen), 0);
    node.count = own + children;
    return node.count;
  };

  for (const node of nodes.values()) {
    if (node.parentId === null) aggregate(node, new Set());
  }

  return order
    .filter((id, index) => order.indexOf(id) === index)
    .map((id) => nodes.get(id))
    .filter((node): node is CategoryHierarchyNode => Boolean(node));
}

export function descendantsOf(
  nodes: readonly CategoryHierarchyNode[],
  categoryId: string
): CategoryHierarchyNode[] {
  const byParent = new Map<string, CategoryHierarchyNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const bucket = byParent.get(node.parentId) ?? [];
    bucket.push(node);
    byParent.set(node.parentId, bucket);
  }

  const result: CategoryHierarchyNode[] = [];
  const visit = (id: string) => {
    for (const child of byParent.get(id) ?? []) {
      result.push(child);
      visit(child.id);
    }
  };
  visit(categoryId);
  return result;
}

export function categoryAndDescendants(
  nodes: readonly CategoryHierarchyNode[],
  categoryId: string
): CategoryHierarchyNode[] {
  const current = nodes.find((node) => node.id === categoryId);
  return current ? [current, ...descendantsOf(nodes, categoryId)] : [];
}
