import { TournamentState } from '@/types/tournament';

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
    { id: "profissional", name: "Profissional", slots: 16, seeds: ["nacao-beach", null, "life-beach", "kale-praia", "garden", null, null, "aeronautica", "mbtc", null, null, "iate-clube", "aabr", null, null, "vamo-beach"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "a", name: "A", slots: 16, seeds: ["nacao-beach", null, "aabr", "the-club", "iate-clube", null, null, "aeronautica", "life-beach", "mbtc", null, "garden", "kale-praia", "cota-mil", null, "vamo-beach"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "b", name: "B", slots: 16, seeds: ["iate-clube", null, "apcef", "cota-mil", "life-beach", null, "the-club", "kale-praia", "garden", "aeronautica", null, "aabr", "vamo-beach", "nacao-beach", null, "mbtc"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "c", name: "C", slots: 16, seeds: ["nacao-beach", null, "kale-praia", "iate-clube", "vamo-beach", "asbac", "aeronautica", "mbtc", "apcef", "cota-mil", null, "aabr", "the-club", "garden", null, "life-beach"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "d", name: "D", slots: 16, seeds: ["nacao-beach", null, "the-club", "asbac", "garden", "aeronautica", "apcef", "mbtc", "cota-mil", "iate-clube", null, "kale-praia", "life-beach", "aabr", null, "vamo-beach"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "iniciante", name: "Iniciante", slots: 16, seeds: ["mbtc", null, "iate-clube", "the-club", "nacao-beach", "apcef", "cota-mil", "vamo-beach", "garden", "aeronautica", null, "kale-praia", "life-beach", "asbac", null, "aabr"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "sub-12", name: "Sub 12", slots: 16, seeds: ["nacao-beach", null, "mbtc", "garden", "vamo-beach", null, null, "aabr", "iate-clube", null, null, "aeronautica", "kale-praia", null, null, "life-beach"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "sub-14", name: "Sub 14", slots: 8, seeds: ["aabr", "vamo-beach", "mbtc", "aeronautica", "nacao-beach", "garden", "life-beach", "iate-clube"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "sub-16", name: "Sub 16", slots: 8, seeds: ["vamo-beach", null, "aeronautica", "aabr", "kale-praia", "nacao-beach", "life-beach", "iate-clube"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "sub-18", name: "Sub 18", slots: 8, seeds: ["aabr", "kale-praia", "vamo-beach", "nacao-beach", "life-beach", "aeronautica", "mbtc", "iate-clube"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "40", name: "40+", slots: 16, seeds: ["nacao-beach", null, "aeronautica", "kale-praia", "the-club", null, null, "aabr", "mbtc", null, null, "vamo-beach", "life-beach", "iate-clube", null, "garden"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "50", name: "50+", slots: 16, seeds: ["iate-clube", null, "the-club", "mbtc", "kale-praia", null, null, "garden", "vamo-beach", "cota-mil", null, "aeronautica", "life-beach", "nacao-beach", null, "aabr"], importedPlacements: [], roundDefaults: {}, matchResults: {} },
    { id: "60", name: "60+", slots: 16, seeds: ["iate-clube", null, "nacao-beach", "garden", "aeronautica", null, null, "the-club", "life-beach", null, null, "aabr", "cota-mil", "kale-praia", null, "mbtc"], importedPlacements: [], roundDefaults: {}, matchResults: {} }
  ],
  categoryOrder: ["profissional", "a", "b", "c", "d", "iniciante", "sub-12", "sub-14", "sub-16", "sub-18", "40", "50", "60"]
};

export const STORAGE_KEY = 'interclubes-local-html-v6';
