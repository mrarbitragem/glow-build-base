import { describe, it, expect } from 'vitest';
import { parseChaveLoadResponse, dedupeClubSeeds } from './chaveWebhook';

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
