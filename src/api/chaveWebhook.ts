import type { Club, Category, MatchState, TournamentState } from '@/types/tournament';
import { CATEGORY_FIXED_BYE_ONE_BASED } from '@/data/initialData';

/** Converte célula do servidor (id ou NOME MAIÚSCULO) para o `club.id` usado na app. */
function normalizeSeedCell(raw: string | null, clubs: Club[]): string | null {
  if (raw === null) return null;
  const s = String(raw).trim();
  if (!s) return '';
  const byId = clubs.find(c => c.id === s || c.id.toLowerCase() === s.toLowerCase());
  if (byId) return byId.id;
  const upper = s.toUpperCase();
  const byName = clubs.find(c => c.name.trim().toUpperCase() === upper);
  if (byName) return byName.id;
  return s;
}

export function normalizeChaveSeedsForApp(seeds: (string | null)[], clubs: Club[]): (string | null)[] {
  return seeds.map(cell => {
    if (cell === null) return null;
    return normalizeSeedCell(String(cell), clubs);
  });
}

/** Mantém `null` (BYE fixo); cada id de clube não vazio aparece no máximo uma vez (primeira posição ganha). */
function parseBoolLoose(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true')) return true;
  return false;
}

/** Monta `MatchState` a partir de objeto vindo do servidor / n8n. */
export function matchStateFromRow(m: Record<string, unknown>): MatchState {
  return {
    score1: String(m.score1 ?? ''),
    score2: String(m.score2 ?? ''),
    winner: String(m.winner ?? ''),
    datetime: String(m.datetime ?? ''),
    inProgress: parseBoolLoose(m.inProgress ?? m.em_andamento ?? m.emAndamento),
    court: String(m.court ?? m.quadra ?? ''),
  };
}

export function dedupeClubSeeds(seeds: (string | null)[]): (string | null)[] {
  const seen = new Set<string>();
  return seeds.map(cell => {
    if (cell === null) return null;
    const id = String(cell).trim();
    if (!id) return '';
    if (seen.has(id)) return '';
    seen.add(id);
    return id;
  });
}

async function parseJsonBodySafely(
  res: Response,
  opts?: { emptyFallback?: unknown; invalidJsonMessage?: string }
): Promise<unknown> {
  const raw = await res.text();
  if (!raw.trim()) return opts?.emptyFallback ?? {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(opts?.invalidJsonMessage ?? 'Resposta inválida do servidor (JSON malformado).');
  }
}

function extractWebhookErrorMessage(raw: string): string {
  const txt = raw.trim();
  if (!txt) return '';
  try {
    const data = JSON.parse(txt) as Record<string, unknown>;
    const parts = [data.message, data.error, data.hint]
      .filter(v => typeof v === 'string' && v.trim().length > 0)
      .map(v => String(v).trim());
    if (parts.length > 0) return parts.join(' ');
  } catch {
    /* noop */
  }
  return txt.length > 260 ? `${txt.slice(0, 260)}...` : txt;
}

const DEFAULT_LOAD = 'https://webhook.mrarbitragem.com.br/webhook/chave';
const DEFAULT_SAVE = 'https://webhook.mrarbitragem.com.br/webhook/save_chave';
const DEV_LOAD = '/api/webhook-chave';
const DEV_SAVE = '/api/webhook-save-chave';

export function getLoadChaveUrl(): string {
  const v = import.meta.env.VITE_LOAD_CHAVE_WEBHOOK_URL?.trim();
  if (v) return v;
  if (import.meta.env.DEV) return DEV_LOAD;
  return DEFAULT_LOAD;
}

export function getSaveChaveUrl(): string {
  const v = import.meta.env.VITE_SAVE_CHAVE_WEBHOOK_URL?.trim();
  if (v) return v;
  if (import.meta.env.DEV) return DEV_SAVE;
  return DEFAULT_SAVE;
}

/** Resposta esperada do POST load_chave (campos opcionais). */
export type ChaveLoadPayload = {
  seeds?: (string | null)[];
  matchResults?: Record<string, MatchState>;
  roundDefaults?: Record<string, string>;
};

export type ChaveSavePayload = {
  categoriaId: string;
  seeds: (string | null)[];
  roundDefaults: Record<string, string>;
};

/**
 * Id no POST ao n8n/MySQL (`categoria_chave.categoria_id`).
 * A coluna da 40+ é **`40+`**. Qualquer valor que cairia em só **`40`** no fio é forçado para **`40+`**.
 * Subs: `sub-12`→`sub12`…; `50`/`60` na app → `50+`/`60+` na BD.
 */
const CHAVE_APP_ID_TO_DB: Readonly<Record<string, string>> = {
  '40': '40+',
  'sub-12': 'sub12',
  'sub-14': 'sub14',
  'sub-16': 'sub16',
  'sub-18': 'sub18',
  '50': '50+',
  '60': '60+',
};

/** Resposta em lote / `categoria_id` na linha → id canónico da app. */
const CHAVE_DB_ID_TO_APP: Readonly<Record<string, string>> = {
  '40': '40+',
  sub12: 'sub-12',
  sub14: 'sub-14',
  sub16: 'sub-16',
  sub18: 'sub-18',
  '50+': '50',
  '60+': '60',
};

export function chaveCategoriaIdForWebhook(appCategoriaId: string): string {
  const id = String(appCategoriaId).trim();
  let out = CHAVE_APP_ID_TO_DB[id] ?? id;
  /** Nunca enviar `40` sozinho — corresponde à categoria 40+ na BD (`40+`). */
  if (out === '40') out = '40+';
  return out;
}

/**
 * Corpo POST para o webhook `chave` / `save_chave`.
 * Muitos fluxos n8n usam `$json.body` no MySQL; o Webhook por vezes só expõe os campos na raiz — duplicamos em `body` para o `IN (...)` receber os ids.
 */
function envelopeChaveLoadSingle(webhookCategoriaId: string): Record<string, unknown> {
  const cid = webhookCategoriaId;
  return {
    categoriaId: cid,
    categoria_id: cid,
    body: { categoriaId: cid, categoria_id: cid },
  };
}

function envelopeChaveLoadBulk(webhookIds: readonly string[]): Record<string, unknown> {
  const ids = [...webhookIds];
  return {
    categoriaIds: ids,
    categoria_ids: ids,
    body: { categoriaIds: ids, categoria_ids: ids },
  };
}

/** Expande lista só com clubes (ordem do sorteio) para `slots` posições com `null` nos BYE fixos. */
function expandCompactFixedByeSeeds(
  slots: number,
  byePositionsOneBased: readonly number[],
  compact: (string | null)[]
): (string | null)[] | null {
  const byeSet = new Set(byePositionsOneBased);
  const clubSlotCount = slots - byeSet.size;
  if (compact.length !== clubSlotCount) return null;
  const out: (string | null)[] = [];
  let ci = 0;
  for (let i = 0; i < slots; i++) {
    const pos1 = i + 1;
    if (byeSet.has(pos1)) out.push(null);
    else {
      const cell = compact[ci++];
      out.push(cell === null ? null : String(cell));
    }
  }
  return out;
}

function resolveSeedsForMerge(cat: Category, seeds: (string | null)[] | undefined): (string | null)[] | undefined {
  if (!seeds?.length) return undefined;
  if (seeds.length === cat.slots) return seeds;
  const layout = CATEGORY_FIXED_BYE_ONE_BASED[cat.id];
  if (!layout) return undefined;
  const expanded = expandCompactFixedByeSeeds(cat.slots, layout, seeds);
  return expanded ?? undefined;
}

/** Coluna MySQL JSON por vezes vem como string; n8n pode mandar já como objeto/array. */
function coerceJsonField(raw: unknown): unknown {
  if (raw == null) return undefined;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return undefined;
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return undefined;
    }
  }
  return raw;
}

function pickSeedsArray(o: Record<string, unknown>): unknown[] | undefined {
  if (Array.isArray(o.seeds)) return o.seeds as unknown[];
  const fromSnake = coerceJsonField(o.seeds_json);
  if (Array.isArray(fromSnake)) return fromSnake;
  return undefined;
}

function pickMatchResultsRecord(o: Record<string, unknown>): Record<string, unknown> | undefined {
  const raw = o.matchResults ?? o.match_results ?? coerceJsonField(o.match_results_json);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return undefined;
}

function pickRoundDefaultsRecord(o: Record<string, unknown>): Record<string, unknown> | undefined {
  const raw = o.roundDefaults ?? o.round_defaults ?? coerceJsonField(o.round_defaults_json);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return undefined;
}

function buildChavePayloadFromRow(o: Record<string, unknown>): ChaveLoadPayload {
  const out: ChaveLoadPayload = {};
  const seedsArr = pickSeedsArray(o);
  if (seedsArr) {
    out.seeds = seedsArr.map((cell: unknown) => {
      if (cell === null) return null;
      return String(cell ?? '');
    }) as (string | null)[];
  }
  const mr = pickMatchResultsRecord(o);
  if (mr) {
    const merged: Record<string, MatchState> = {};
    for (const [k, v] of Object.entries(mr)) {
      if (!v || typeof v !== 'object') continue;
      merged[k] = matchStateFromRow(v as Record<string, unknown>);
    }
    out.matchResults = merged;
  }
  const rd = pickRoundDefaultsRecord(o);
  if (rd) {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(rd)) {
      flat[k] = String(v ?? '');
    }
    out.roundDefaults = flat;
  }
  return out;
}

/**
 * Aceita vários formatos (app / n8n / MySQL) com o mesmo contrato final:
 * - `seeds` / `seeds_json`; `body` ou `json` (n8n); `data` objeto ou array; raiz com tudo
 */
export function parseChaveLoadResponse(data: unknown): ChaveLoadPayload {
  if (data == null) return {};
  if (Array.isArray(data)) {
    if (data.length === 0) return {};
    return parseChaveLoadResponse(data[0]);
  }
  if (typeof data !== 'object') return {};
  const root = data as Record<string, unknown>;

  if (root.json != null && typeof root.json === 'object' && !Array.isArray(root.json)) {
    return parseChaveLoadResponse(root.json);
  }

  const candidates: Record<string, unknown>[] = [];

  const push = (x: unknown) => {
    if (x != null && typeof x === 'object' && !Array.isArray(x)) {
      candidates.push(x as Record<string, unknown>);
    }
  };

  push(root);
  push(root.body);

  const d = root.data;
  if (d != null && typeof d === 'object') {
    if (Array.isArray(d)) {
      for (const row of d) push(row);
    } else {
      push(d);
    }
  }

  for (const o of candidates) {
    const p = buildChavePayloadFromRow(o);
    if (chavePatchHasData(p)) return p;
  }
  return {};
}

export function chavePatchHasData(p: ChaveLoadPayload): boolean {
  if (p.seeds != null && Array.isArray(p.seeds) && p.seeds.length > 0) return true;
  if (p.matchResults && Object.keys(p.matchResults).length > 0) return true;
  if (p.roundDefaults && Object.keys(p.roundDefaults).length > 0) return true;
  return false;
}

/** Alinha `categoria_id` da BD / chaves JSON com o id da categoria na app. */
function resolveCanonicalChaveCategoryId(requested: Set<string>, rawFromServer: string): string | null {
  let k = String(rawFromServer).trim();
  if (!k) return null;
  if (requested.has(k)) return k;
  /** BD / JSON por vezes usa maiúsculas (`C`) e a app usa `c`. */
  const lower = k.toLowerCase();
  if (lower !== k && requested.has(lower)) return lower;
  try {
    if (k.includes('%')) {
      const dec = decodeURIComponent(k);
      if (dec !== k && requested.has(dec)) return dec;
    }
  } catch {
    /* ignore */
  }
  const mapped = CHAVE_DB_ID_TO_APP[k];
  if (mapped && requested.has(mapped)) return mapped;
  return null;
}

/**
 * Resposta em lote ao POST `{ categoriaIds: [...] }` no mesmo webhook `chave`.
 * Formatos aceites:
 * - `{ chaves: { "c": { ... }, "40+": { ... } } }` — cada valor como resposta de `parseChaveLoadResponse`
 * - `[{ categoriaId: "c", ... }, ...]` ou `{ data: [ ... ] }`
 */
export function parseChaveBulkResponse(data: unknown, requestedIds: readonly string[]): Record<string, ChaveLoadPayload> {
  const out: Record<string, ChaveLoadPayload> = {};
  const req = new Set(requestedIds.map(s => String(s).trim()).filter(Boolean));
  if (req.size === 0) return out;

  if (data == null) return out;

  const root = typeof data === 'object' && !Array.isArray(data) && data !== null ? (data as Record<string, unknown>) : null;

  /** Objeto `chaves` (n8n) — pode omitir algumas categorias ou usar chaves escapadas diferentes de `data`. */
  if (root && 'chaves' in root) {
    const ch = root.chaves;
    if (ch && typeof ch === 'object' && !Array.isArray(ch)) {
      for (const [id, val] of Object.entries(ch as Record<string, unknown>)) {
        const canon = resolveCanonicalChaveCategoryId(req, id);
        if (!canon) continue;
        const patch = parseChaveLoadResponse(val);
        if (chavePatchHasData(patch)) out[canon] = patch;
      }
    }
  }

  const rows: unknown[] = Array.isArray(data)
    ? (data as unknown[])
    : root && Array.isArray(root.data)
      ? (root.data as unknown[])
      : [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const rawId = String(o.categoriaId ?? o.categoria_id ?? '').trim();
    const canon = resolveCanonicalChaveCategoryId(req, rawId);
    if (!canon) continue;
    const patch = parseChaveLoadResponse(row);
    if (!chavePatchHasData(patch)) continue;
    const prev = out[canon];
    if (!prev || !chavePatchHasData(prev)) out[canon] = patch;
  }

  /** Resposta única plana (sem `chaves`, sem array `data`). */
  if (rows.length === 0 && root && !('chaves' in root)) {
    const rawId = String(root.categoriaId ?? root.categoria_id ?? '').trim();
    const canon = resolveCanonicalChaveCategoryId(req, rawId);
    if (canon) {
      const patch = parseChaveLoadResponse(data);
      if (chavePatchHasData(patch)) {
        const prev = out[canon];
        if (!prev || !chavePatchHasData(prev)) out[canon] = patch;
      }
    }
  }

  return out;
}

async function fetchChaveCategoriesBulk(categoriaIds: readonly string[]): Promise<Record<string, ChaveLoadPayload>> {
  const ids = [...new Set(categoriaIds.map(id => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) return {};
  const webhookIds = [...new Set(ids.map(chaveCategoriaIdForWebhook))];
  const url = getLoadChaveUrl();
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(envelopeChaveLoadBulk(webhookIds)),
    });
  } catch {
    return {};
  }
  if (!res.ok) return {};
  let data: unknown;
  try {
    data = await parseJsonBodySafely(res, { emptyFallback: {} });
  } catch {
    return {};
  }
  return parseChaveBulkResponse(data, ids);
}

/**
 * Funde em `base` as chaves pedidas.
 * Com **mais de uma** categoria: tenta **um único POST** `{ categoriaIds }` para o n8n executar um fluxo com vários MySQL;
 * se a resposta não trouxer dados úteis por categoria, faz fallback **um POST por categoria** (comportamento antigo).
 * Defina `VITE_CHAVE_LOAD_SEQUENTIAL_ONLY=1` para **nunca** tentar o lote.
 */
export async function fetchAndMergeChavesForIds(
  base: TournamentState,
  categoriaIds: readonly string[],
  mergeOptions?: MergeChaveOptions
): Promise<TournamentState> {
  const ids = [...new Set(categoriaIds.map(id => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) return base;

  const sequentialOnly = import.meta.env.VITE_CHAVE_LOAD_SEQUENTIAL_ONLY === '1';

  if (ids.length === 1) {
    try {
      const patch = await fetchChaveCategory(ids[0]);
      return mergeChaveIntoState(base, ids[0], patch, mergeOptions);
    } catch {
      return base;
    }
  }

  if (!sequentialOnly) {
    const bulk = await fetchChaveCategoriesBulk(ids);
    const fromBulk = ids.filter(id => bulk[id] && chavePatchHasData(bulk[id]!));
    if (fromBulk.length > 0) {
      let acc = base;
      for (const id of fromBulk) {
        acc = mergeChaveIntoState(acc, id, bulk[id]!, mergeOptions);
      }
      if (fromBulk.length === ids.length) return acc;
      for (const id of ids) {
        if (fromBulk.includes(id)) continue;
        try {
          const patch = await fetchChaveCategory(id);
          acc = mergeChaveIntoState(acc, id, patch, mergeOptions);
        } catch {
          /* mantém acc */
        }
      }
      return acc;
    }
  }

  let acc = base;
  for (const id of ids) {
    try {
      const patch = await fetchChaveCategory(id);
      acc = mergeChaveIntoState(acc, id, patch, mergeOptions);
    } catch {
      /* mantém acc */
    }
  }
  return acc;
}

export async function fetchChaveCategory(categoriaId: string): Promise<ChaveLoadPayload> {
  const url = getLoadChaveUrl();
  const webhookId = chaveCategoriaIdForWebhook(categoriaId);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(envelopeChaveLoadSingle(webhookId)),
    });
  } catch {
    throw new Error('Rede ou CORS ao carregar a chave.');
  }
  if (!res.ok) {
    throw new Error(`Falha ao carregar chave (${res.status}).`);
  }
  const data = await parseJsonBodySafely(res, {
    emptyFallback: {},
    invalidJsonMessage: 'Resposta inválida do webhook chave (JSON malformado).',
  });
  let patch = parseChaveLoadResponse(data);
  /** Alguns fluxos n8n devolvem o mesmo envelope `{ chaves: { … } }` no POST com um só `categoriaId`. */
  if (!chavePatchHasData(patch) && data && typeof data === 'object' && data !== null && 'chaves' in data) {
    const bulk = parseChaveBulkResponse(data, [categoriaId]);
    const fromBulk = bulk[categoriaId];
    if (fromBulk && chavePatchHasData(fromBulk)) patch = fromBulk;
  }
  return patch;
}

export async function saveChaveCategory(payload: ChaveSavePayload): Promise<void> {
  const url = getSaveChaveUrl();
  const cid = chaveCategoriaIdForWebhook(payload.categoriaId);
  const body = {
    categoriaId: cid,
    categoria_id: cid,
    seeds: payload.seeds,
    roundDefaults: payload.roundDefaults,
    body: {
      categoriaId: cid,
      categoria_id: cid,
      seeds: payload.seeds,
      roundDefaults: payload.roundDefaults,
    },
  };
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Rede ou CORS ao gravar a chave.');
  }
  if (!res.ok) {
    let details = '';
    try {
      details = extractWebhookErrorMessage(await res.text());
    } catch {
      details = '';
    }
    throw new Error(details ? `Falha ao gravar chave (${res.status}): ${details}` : `Falha ao gravar chave (${res.status}).`);
  }
}

export type MergeChaveOptions = {
  /**
   * Após sorteio oficial: `matchResults` passa a ser **só** o que vier no patch (objeto vazio = limpa resultados locais).
   * Sem isto, resultados antigos são fundidos com os novos e podem ficar em jogos errados.
   */
  resetMatchResultsToPatch?: boolean;
};

function matchResultsFromPatch(patch: ChaveLoadPayload): Record<string, MatchState> {
  const mr = patch.matchResults;
  if (!mr || !Object.keys(mr).length) return {};
  const out: Record<string, MatchState> = {};
  for (const [k, v] of Object.entries(mr)) {
    if (!v || typeof v !== 'object') continue;
    out[k] = matchStateFromRow(v as unknown as Record<string, unknown>);
  }
  return out;
}

/** Aplica dados do servidor numa categoria (só campos presentes e seeds com comprimento certo). */
export function mergeChaveIntoState(
  prev: TournamentState,
  categoryId: string,
  patch: ChaveLoadPayload,
  options?: MergeChaveOptions
): TournamentState {
  const resetMr = options?.resetMatchResultsToPatch === true;
  const target = prev.categories.find(c => c.id === categoryId);
  const resolvedSeeds = target ? resolveSeedsForMerge(target, patch.seeds) : undefined;
  const willSeeds = !!(target && resolvedSeeds && resolvedSeeds.length === target.slots);
  const hasMr = !!(patch.matchResults && Object.keys(patch.matchResults).length > 0);
  const hasRd = !!(patch.roundDefaults && Object.keys(patch.roundDefaults).length > 0);
  /** Servidor enviou `matchResults: {}` — não há linhas em `jogo`; o cliente não deve manter `inProgress` antigo do localStorage. */
  const explicitEmptyMatchResults =
    patch.matchResults !== undefined &&
    typeof patch.matchResults === 'object' &&
    !Array.isArray(patch.matchResults) &&
    Object.keys(patch.matchResults).length === 0;

  if (!willSeeds && !hasMr && !hasRd && !resetMr && !explicitEmptyMatchResults) return prev;

  const cats = prev.categories.map(cat => {
    if (cat.id !== categoryId) return cat;
    let next = { ...cat };

    if (willSeeds && resolvedSeeds!.length === cat.slots) {
      const rawSeeds = [...resolvedSeeds!] as (string | null)[];
      next = { ...next, seeds: dedupeClubSeeds(normalizeChaveSeedsForApp(rawSeeds, prev.clubs)) };
    }

    if (resetMr) {
      next = { ...next, matchResults: matchResultsFromPatch(patch) };
    } else if (hasMr) {
      next = {
        ...next,
        matchResults: { ...next.matchResults, ...matchResultsFromPatch(patch) },
      };
    } else if (explicitEmptyMatchResults) {
      next = {
        ...next,
        matchResults: Object.fromEntries(
          Object.entries(next.matchResults).map(([id, st]) => [id, { ...st, inProgress: false }])
        ),
      };
    }

    if (patch.roundDefaults && Object.keys(patch.roundDefaults).length > 0) {
      next = {
        ...next,
        roundDefaults: { ...next.roundDefaults, ...patch.roundDefaults },
      };
    }

    return next;
  });

  return { ...prev, categories: cats };
}
