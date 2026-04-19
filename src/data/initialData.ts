import { TournamentState } from '@/types/tournament';

/**
 * Monta o vetor de seeds: `null` = BYE fixo na posição do sorteio (1..N), `''` = vaga para clube.
 * Tamanho da chave = menor potência de 2 ≥ número de clubes (8 ou 16 neste sistema).
 */
function seedsWithFixedByes(slotCount: number, byePositionsOneBased: readonly number[]): (string | null)[] {
  const seeds: (string | null)[] = Array.from({ length: slotCount }, () => '');
  for (const p of byePositionsOneBased) {
    if (p >= 1 && p <= slotCount) seeds[p - 1] = null;
  }
  return seeds;
}

/** 9 clubes em chave de 16 — 7 BYE */
const BYE_16_X9 = [2, 6, 7, 10, 11, 14, 15] as const;
/** 10 clubes — chave B (6 BYE nas posições 1-based abaixo) */
const BYE_16_B = [2, 6, 7, 10, 11, 15] as const;
/** 11 clubes em chave de 16 — 5 BYE (C, 40+, etc.) */
const BYE_16_X11 = [2, 6, 7, 11, 15] as const;

/** Categoria C: 11 clubes; BYE nas posições 1-based 2, 6, 7, 11, 15. */
const SEEDS_CATEGORY_C: (string | null)[] = [
  'nacao-beach',
  null,
  'kale-praia',
  'iate-clube',
  'vamo-beach',
  null,
  null,
  'mbtc',
  'apcef',
  'cota-mil',
  null,
  'aabr',
  'the-club',
  'garden',
  null,
  'life-beach',
];

/**
 * 40+: mesmos BYE e desenho que a C (11 clubes).
 * Arranque com os mesmos ids da C até o `chave` (MySQL `categoria_id` = `40`) substituir pelo sorteio oficial.
 */
const SEEDS_CATEGORY_40: (string | null)[] = [...SEEDS_CATEGORY_C];

/** 12 clubes em chave de 16 — 4 BYE (posições 1-based 2, 6, 11, 15) */
const BYE_16_X12 = [2, 6, 11, 15] as const;

/** Categoria D: 12 clubes; BYE nas posições 1-based 2, 6, 11, 15 (índices 0-based 1,5,10,14 = null). */
const SEEDS_CATEGORY_D: (string | null)[] = [
  'asbac',
  null,
  'aeronautica',
  'aabr',
  'iate-clube',
  null,
  'kale-praia',
  'the-club',
  'mbtc',
  'vamo-beach',
  null,
  'life-beach',
  'garden',
  'cota-mil',
  null,
  'apcef',
];

/** Iniciante: mesmo desenho 12×16 e BYE que a D (só arranque; sorteio oficial substitui). */
const SEEDS_CATEGORY_INICIANTE: (string | null)[] = [...SEEDS_CATEGORY_D];

/** 50+ (`id` `50`): mesmo desenho 12×16 e BYE que a D. */
const SEEDS_CATEGORY_50: (string | null)[] = [...SEEDS_CATEGORY_D];

/** 60+ (`id` `60`): 10 clubes — mesmos BYE e desenho que a B (`BYE_16_B`). */
const SEEDS_CATEGORY_60: (string | null)[] = [
  'iate-clube',
  null,
  'kale-praia',
  'aabr',
  'vamo-beach',
  null,
  null,
  'mbtc',
  'the-club',
  null,
  null,
  'nacao-beach',
  'garden',
  'cota-mil',
  null,
  'apcef',
];

/** 6 clubes em chave de 8 — 2 BYE nas posições 1-based 2 e 7 (Sub 12 e Sub 16). */
const BYE_8_X6 = [2, 7] as const;

/** Sub 12: 6 clubes; BYE nas posições 2 e 7; 5º/6º = perdedores do Jogo 1 e Jogo 2 da R1. */
const SEEDS_CATEGORY_SUB12: (string | null)[] = [
  'iate-clube',
  null,
  'kale-praia',
  'aabr',
  'mbtc',
  'vamo-beach',
  null,
  'garden',
];

/**
 * Posições 1-based com BYE fixo (igual a `seedsWithFixedByes`).
 * Usado para expandir `seeds` compactos do servidor (só os clubes, sem nulls) para o vetor completo da app.
 */
export const CATEGORY_FIXED_BYE_ONE_BASED: Partial<Record<string, readonly number[]>> = {
  a: BYE_16_X9,
  b: BYE_16_B,
  c: BYE_16_X11,
  d: BYE_16_X12,
  iniciante: BYE_16_X12,
  'sub-12': BYE_8_X6,
  'sub-16': BYE_8_X6,
  'sub-18': BYE_16_X9,
  '40+': BYE_16_X11,
  '50': BYE_16_X12,
  /** 10 clubes em 16 — igual à B. */
  '60': BYE_16_B,
};

export const INITIAL_DATA: TournamentState = {
  event: {
    title: "4º Interclubes de Beach Tennis FBT",
    local: "VAMO, Brasília - DF",
    arbitroGeral: "Marciel Ribeiro"
  },
  pointsByPlace: {
    "1": 40, "2": 36, "3": 32, "4": 30, "5": 28, "6": 26, "7": 24, "8": 22,
    "9": 20, "10": 18, "11": 15, "12": 13, "13": 11
  },
  /** Só arranque / offline até o webhook `select_club` devolver a lista real. */
  clubs: [
    { id: "iate-clube", name: "IATE CLUBE", flag: "" },
    { id: "nacao-beach", name: "NAÇÃO BEACH", flag: "" },
    { id: "aeronautica", name: "AERONAUTICA", flag: "" },
    { id: "kale-praia", name: "KALE PRAIA", flag: "" },
    { id: "the-club", name: "THE CLUB", flag: "" },
    { id: "aabr", name: "AABR", flag: "" },
    { id: "mbtc", name: "MBTC", flag: "" },
    { id: "vamo-beach", name: "VAMO BEACH", flag: "" },
    { id: "life-beach", name: "LIFE BEACH", flag: "" },
    { id: "garden", name: "GARDEN", flag: "" },
    { id: "cota-mil", name: "COTA MIL", flag: "" },
    { id: "apcef", name: "APCEF", flag: "" },
    { id: "asbac", name: "ASBAC", flag: "" }
  ],
  categories: [
    {
      id: "profissional",
      name: "Profissional",
      slots: 8,
      seeds: ["aeronautica", "aabr", "", "", "", "", "", ""],
      importedPlacements: [],
      roundDefaults: {},
      matchResults: {},
    },
    { id: "a", name: "A", slots: 16, seeds: seedsWithFixedByes(16, BYE_16_X9), importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "b", name: "B", slots: 16, seeds: seedsWithFixedByes(16, BYE_16_B), importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "c", name: "C", slots: 16, seeds: [...SEEDS_CATEGORY_C], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "d", name: "D", slots: 16, seeds: [...SEEDS_CATEGORY_D], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "iniciante", name: "Iniciante", slots: 16, seeds: [...SEEDS_CATEGORY_INICIANTE], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "sub-12", name: "Sub 12", slots: 8, seeds: [...SEEDS_CATEGORY_SUB12], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "sub-14", name: "Sub 14", slots: 8, seeds: Array.from({ length: 8 }, () => ""), importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "sub-16", name: "Sub 16", slots: 8, seeds: seedsWithFixedByes(8, BYE_8_X6), importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "sub-18", name: "Sub 18", slots: 16, seeds: seedsWithFixedByes(16, BYE_16_X9), importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "40+", name: "40+", slots: 16, seeds: [...SEEDS_CATEGORY_40], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "50", name: "50+", slots: 16, seeds: [...SEEDS_CATEGORY_50], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "60", name: "60+", slots: 16, seeds: [...SEEDS_CATEGORY_60], importedPlacements: [], roundDefaults: {}, matchResults: {} }
  ],
  categoryOrder: ["profissional", "a", "b", "c", "d", "iniciante", "sub-12", "sub-14", "sub-16", "sub-18", "40+", "50", "60"]
};

export const STORAGE_KEY = 'interclubes-local-html-v11';
