import { describe, it, expect } from 'vitest';
import {
  parseChaveLoadResponse,
  dedupeClubSeeds,
  matchStateFromRow,
  mergeChaveIntoState,
} from './chaveWebhook';
import type { TournamentState } from '@/types/tournament';

describe('parseChaveLoadResponse', () => {
  it('lê seeds na raiz (resposta plana)', () => {
    const p = parseChaveLoadResponse({ seeds: ['a', 'b'], roundDefaults: {}, matchResults: {} });
    expect(p.seeds).toEqual(['a', 'b']);
  });

  it('lê seeds em body (eco / n8n)', () => {
    const p = parseChaveLoadResponse({
      categoriaId: '40+',
      body: { seeds: ['x', 'y'], roundDefaults: {}, matchResults: {} },
    });
    expect(p.seeds).toEqual(['x', 'y']);
  });

  it('não deixa data: {} esconder seeds na raiz', () => {
    const p = parseChaveLoadResponse({
      data: {},
      seeds: ['p', 'q'],
      roundDefaults: {},
      matchResults: {},
    });
    expect(p.seeds).toEqual(['p', 'q']);
  });

  it('desembrulha json (n8n)', () => {
    const p = parseChaveLoadResponse({
      json: { seeds: ['m'], roundDefaults: {}, matchResults: {} },
    });
    expect(p.seeds).toEqual(['m']);
  });
});

describe('dedupeClubSeeds', () => {
  it('mantém a primeira ocorrência e limpa duplicatas; preserva null e vazio', () => {
    expect(dedupeClubSeeds(['a', 'b', 'a', null, '', 'b'])).toEqual(['a', 'b', '', null, '', '']);
  });
});

describe('mergeChaveIntoState', () => {
  it('com matchResults vazio explícito do servidor, limpa inProgress local (evita «Em andamento» fantasma)', () => {
    const prev: TournamentState = {
      event: { title: 'T', local: 'L', arbitroGeral: 'A' },
      pointsByPlace: {},
      clubs: [],
      categoryOrder: ['p'],
      categories: [
        {
          id: 'p',
          name: 'Prof',
          slots: 8,
          seeds: Array(8).fill(''),
          importedPlacements: [],
          roundDefaults: {},
          matchResults: {
            'R1-m1': {
              score1: '',
              score2: '',
              winner: '',
              datetime: '',
              inProgress: true,
              court: '1',
            },
          },
        },
      ],
    };
    const patch = parseChaveLoadResponse({
      seeds: ['1', '2', '3', '4', '5', '6', '7', '8'],
      roundDefaults: {},
      matchResults: {},
    });
    const next = mergeChaveIntoState(prev, 'p', patch);
    expect(next.categories[0].matchResults['R1-m1']?.inProgress).toBe(false);
    expect(next.categories[0].matchResults['R1-m1']?.court).toBe('1');
  });

  it('sem mergeRoundDefaultsFromPatch, não sobrescreve horários locais já preenchidos', () => {
    const prev: TournamentState = {
      event: { title: 'T', local: 'L', arbitroGeral: 'A' },
      pointsByPlace: {},
      clubs: [],
      categoryOrder: ['sub-14'],
      categories: [
        {
          id: 'sub-14',
          name: 'Sub 14',
          slots: 8,
          seeds: Array(8).fill(''),
          importedPlacements: [],
          roundDefaults: { 'main:R1': '2026-04-22T10:00' },
          matchResults: {},
        },
      ],
    };
    const patch = parseChaveLoadResponse({
      seeds: ['1', '2', '3', '4', '5', '6', '7', '8'],
      roundDefaults: { 'main:R1': '2026-04-23T15:00' },
      matchResults: {},
    });
    const next = mergeChaveIntoState(prev, 'sub-14', patch);
    expect(next.categories[0].roundDefaults['main:R1']).toBe('2026-04-22T10:00');
  });

  it('mergeRoundDefaultsFromPatch true substitui/fundir roundDefaults com o patch', () => {
    const prev: TournamentState = {
      event: { title: 'T', local: 'L', arbitroGeral: 'A' },
      pointsByPlace: {},
      clubs: [],
      categoryOrder: ['sub-14'],
      categories: [
        {
          id: 'sub-14',
          name: 'Sub 14',
          slots: 8,
          seeds: Array(8).fill(''),
          importedPlacements: [],
          roundDefaults: { 'main:R1': '2026-04-22T10:00' },
          matchResults: {},
        },
      ],
    };
    const patch = parseChaveLoadResponse({
      seeds: ['1', '2', '3', '4', '5', '6', '7', '8'],
      roundDefaults: { 'main:R1': '2026-04-23T15:00' },
      matchResults: {},
    });
    const next = mergeChaveIntoState(prev, 'sub-14', patch, { mergeRoundDefaultsFromPatch: true });
    expect(next.categories[0].roundDefaults['main:R1']).toBe('2026-04-23T15:00');
  });

  it('fusão passiva preenche só chaves de horário ainda vazias', () => {
    const prev: TournamentState = {
      event: { title: 'T', local: 'L', arbitroGeral: 'A' },
      pointsByPlace: {},
      clubs: [],
      categoryOrder: ['p'],
      categories: [
        {
          id: 'p',
          name: 'Prof',
          slots: 8,
          seeds: Array(8).fill(''),
          importedPlacements: [],
          roundDefaults: { 'main:R1': '2026-04-22T10:00' },
          matchResults: {},
        },
      ],
    };
    const patch = parseChaveLoadResponse({
      seeds: ['1', '2', '3', '4', '5', '6', '7', '8'],
      roundDefaults: { 'main:R1': '2026-04-23T15:00', 'main:R2': '2026-04-24T09:00' },
      matchResults: {},
    });
    const next = mergeChaveIntoState(prev, 'p', patch);
    expect(next.categories[0].roundDefaults['main:R1']).toBe('2026-04-22T10:00');
    expect(next.categories[0].roundDefaults['main:R2']).toBe('2026-04-24T09:00');
  });
});

describe('matchStateFromRow', () => {
  it('lê inProgress e quadra/court', () => {
    expect(
      matchStateFromRow({
        score1: '1',
        score2: '0',
        winner: '1',
        datetime: '',
        inProgress: true,
        court: 'A',
      })
    ).toMatchObject({ inProgress: true, court: 'A' });
    expect(matchStateFromRow({ quadra: '2', em_andamento: 1 })).toMatchObject({ inProgress: true, court: '2' });
  });
});
