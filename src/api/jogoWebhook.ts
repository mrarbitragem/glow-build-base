import type { MatchState } from '@/types/tournament';
import { chaveCategoriaIdForWebhook } from '@/api/chaveWebhook';

const DEFAULT_WEBHOOK = 'https://webhook.mrarbitragem.com.br/webhook/jogo';
const DEV_PROXY_PATH = '/api/webhook-jogo';

export function getJogoWebhookUrl(): string {
  const fromEnv = import.meta.env.VITE_JOGO_WEBHOOK_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return DEV_PROXY_PATH;
  return DEFAULT_WEBHOOK;
}

export type JogoSavePayload = {
  categoriaId: string;
  matchId: string;
} & MatchState;

export async function saveJogoToWebhook(payload: JogoSavePayload): Promise<void> {
  const url = getJogoWebhookUrl();
  const body = {
    categoriaId: chaveCategoriaIdForWebhook(payload.categoriaId),
    matchId: payload.matchId,
    score1: payload.score1 ?? '',
    score2: payload.score2 ?? '',
    winner: payload.winner ?? '',
    datetime: payload.datetime ?? '',
  };
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Rede ou CORS ao gravar o jogo.');
  }
  if (!res.ok) {
    throw new Error(`Falha ao gravar jogo (${res.status}).`);
  }
}
