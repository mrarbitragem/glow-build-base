import { describe, it, expect } from 'vitest';
import { parseClubsWebhookPayload } from './clubsWebhook';

describe('parseClubsWebhookPayload', () => {
  it('parses plain club array', () => {
    const { clubs, event } = parseClubsWebhookPayload([
      { id: 'a', name: 'Club A', flag: '' },
    ]);
    expect(clubs).toEqual([{ id: 'a', name: 'CLUB A', flag: '' }]);
    expect(event).toBeUndefined();
  });

  it('reads nested event', () => {
    const { clubs, event } = parseClubsWebhookPayload({
      clubs: [{ id: 'x', name: 'X', flag: '' }],
      event: { title: 'Torneio', local: 'DF', arbitroGeral: 'João' },
    });
    expect(clubs).toHaveLength(1);
    expect(event).toEqual({ title: 'Torneio', local: 'DF', arbitroGeral: 'João' });
  });

  it('reads flat MySQL-style keys on row', () => {
    const { event } = parseClubsWebhookPayload([
      {
        clubs: [{ id: 'x', name: 'X', flag: '' }],
        nome_evento: 'Interclubes',
        local_evento: 'Brasília',
        arbitro_geral: 'Maria',
      },
    ]);
    expect(event).toEqual({
      title: 'Interclubes',
      local: 'Brasília',
      arbitroGeral: 'Maria',
    });
  });
});
