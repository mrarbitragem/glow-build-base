import type { Club, EventInfo } from '@/types/tournament';
import { normalizeClubFlagSrc } from '@/utils/clubFlag';

/**
 * Lista canónica de clubes vem da BD via n8n (`select_club`).
 * A app chama isto ao iniciar, ao voltar ao separador e no admin «Atualizar do servidor»;
 * depois funde as chaves de todas as categorias com o webhook `chave`.
 *
 * Opcionalmente o mesmo fluxo pode devolver metadados do evento (título, local, árbitro)
 * para preencher a topbar — ver `pickEventPatch`.
 */

/** Chamada direta (produção ou quando VITE_CLUBS_WEBHOOK_URL aponta para URL absoluta). */
const DEFAULT_WEBHOOK = 'https://webhook.mrarbitragem.com.br/webhook/select_club';

/** No `npm run dev`, mesmo host/porta do Vite — o proxy em vite.config repassa ao n8n. */
const DEV_PROXY_PATH = '/api/webhook-select-club';

export function getClubsWebhookUrl(): string {
  const fromEnv = import.meta.env.VITE_CLUBS_WEBHOOK_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return DEV_PROXY_PATH;
  return DEFAULT_WEBHOOK;
}

export type ClubsWebhookResult = {
  clubs: Club[];
  /** Campos opcionais vindos da BD / n8n para `state.event`. */
  event?: Partial<EventInfo>;
};

function mergeEventParts(
  acc: Partial<EventInfo> | undefined,
  part: Partial<EventInfo> | undefined
): Partial<EventInfo> | undefined {
  if (!part || Object.keys(part).length === 0) return acc;
  return { ...acc, ...part };
}

/** Aceita objeto aninhado `event` ou chaves planas estilo MySQL/n8n. */
function pickEventShallow(o: Record<string, unknown>): Partial<EventInfo> | undefined {
  const patch: Partial<EventInfo> = {};
  const title = o.title ?? o.event_title ?? o.eventTitle ?? o.titulo ?? o.nome_evento;
  if (title != null && String(title).trim()) patch.title = String(title).trim();
  const local = o.local ?? o.event_local ?? o.eventLocal ?? o.local_evento;
  if (local != null && String(local).trim()) patch.local = String(local).trim();
  const ar =
    o.arbitroGeral ?? o.arbitro_geral ?? o.event_arbitro_geral ?? o.event_arbitro ?? o.arbitro;
  if (ar != null && String(ar).trim()) patch.arbitroGeral = String(ar).trim();
  return Object.keys(patch).length > 0 ? patch : undefined;
}

function pickEventPatch(o: Record<string, unknown>): Partial<EventInfo> | undefined {
  if (o.event && typeof o.event === 'object' && !Array.isArray(o.event)) {
    const nested = pickEventShallow(o.event as Record<string, unknown>);
    if (nested && Object.keys(nested).length > 0) return nested;
  }
  return pickEventShallow(o);
}

function absorbUnknownEvent(
  acc: Partial<EventInfo> | undefined,
  raw: unknown
): Partial<EventInfo> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return acc;
  return mergeEventParts(acc, pickEventPatch(raw as Record<string, unknown>));
}

function parseClubRows(list: unknown[]): Club[] {
  const out: Club[] = [];
  list.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const o = item as Record<string, unknown>;
    const id = o.id != null ? String(o.id).trim() : '';
    const name = o.name != null ? String(o.name).trim() : '';
    const flag = normalizeClubFlagSrc(o.flag != null ? String(o.flag) : '');
    if (!id || !name) return;
    out.push({ id, name: name.toUpperCase(), flag: flag || '' });
  });
  return out;
}

/**
 * Interpreta o JSON do `select_club` (vários formatos n8n) e opcionalmente extrai `event`.
 */
export function parseClubsWebhookPayload(data: unknown): ClubsWebhookResult {
  let event: Partial<EventInfo> | undefined = absorbUnknownEvent(undefined, data);

  let list: unknown = data;

  if (!Array.isArray(list) && list && typeof list === 'object' && 'data' in list) {
    const wrap = list as Record<string, unknown>;
    const inner = wrap.data;
    event = absorbUnknownEvent(event, wrap);
    if (Array.isArray(inner)) {
      list = inner;
    } else if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      event = absorbUnknownEvent(event, inner);
      const row = inner as Record<string, unknown>;
      if (Array.isArray(row.clubs)) list = row.clubs;
      else if (Array.isArray(row.data)) list = row.data;
      else list = inner;
    }
  }

  /** n8n: às vezes `[{ clubs: [...] }]` ou um único objeto com `clubs`. */
  if (Array.isArray(list) && list.length === 1 && list[0] && typeof list[0] === 'object' && !Array.isArray(list[0])) {
    const row = list[0] as Record<string, unknown>;
    event = absorbUnknownEvent(event, row);
    if (Array.isArray(row.clubs)) list = row.clubs;
    else if (Array.isArray(row.data)) list = row.data;
  }

  if (list && typeof list === 'object' && !Array.isArray(list) && Array.isArray((list as Record<string, unknown>).clubs)) {
    event = absorbUnknownEvent(event, list);
    list = (list as { clubs: unknown[] }).clubs;
  }

  if (!Array.isArray(list)) {
    throw new Error('Resposta inválida: esperado um array JSON de clubes.');
  }

  const clubs = parseClubRows(list);
  if (clubs.length === 0 && list.length > 0) {
    throw new Error('Resposta inválida: nenhum clube com id e name válidos.');
  }

  return {
    clubs,
    event: event && Object.keys(event).length > 0 ? event : undefined,
  };
}

export async function fetchClubsFromWebhook(): Promise<ClubsWebhookResult> {
  const url = getClubsWebhookUrl();
  let res: Response;
  try {
    // n8n costuma registrar o Webhook como POST; GET devolve 404 neste host.
    res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    const devHint = import.meta.env.DEV
      ? ' Reinicie o Vite (`npm run dev`) se acabou de atualizar o projeto.'
      : ' Em produção, o domínio do site precisa permitir CORS no n8n ou expor um proxy na mesma origem; defina VITE_CLUBS_WEBHOOK_URL para essa rota.';
    throw new Error(`Rede ou CORS bloqueou a chamada ao servidor de clubes.${devHint}`);
  }
  if (!res.ok) {
    throw new Error(`Falha ao buscar clubes (${res.status}).`);
  }
  const data: unknown = await res.json();
  return parseClubsWebhookPayload(data);
}
