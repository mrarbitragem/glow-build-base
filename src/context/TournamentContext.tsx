import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { TournamentState, UIState, Category, MatchState, PageType, AdminPanel, AdminMode, Club } from '@/types/tournament';
import { saveJogoToWebhook } from '@/api/jogoWebhook';
import { fetchClubsFromWebhook } from '@/api/clubsWebhook';
import {
  fetchChaveCategory,
  fetchAndMergeChavesForIds,
  mergeChaveIntoState,
  normalizeChaveSeedsForApp,
  dedupeClubSeeds,
  saveChaveCategory,
} from '@/api/chaveWebhook';
import {
  INITIAL_DATA,
  STORAGE_KEY,
  buildEmptySeedsForDraw,
  CATEGORY_FIXED_BYE_ONE_BASED,
  sanitizeEightSlotSevenClubCategorySeeds,
} from '@/data/initialData';
import { countRealSeeds } from '@/utils/bracketEngine';
import { deepClone, slugify, fileToDataUrl } from '@/utils/helpers';
import { normalizeClubFlagSrc } from '@/utils/clubFlag';

const PLACEMENT_PREF_KEY = 'interclubes-show-positions';

/**
 * Após `select_club`, pedir `load_chave` em lote só a estas categorias (menos carga no n8n).
 * A `c` estava de fora: após o sync de clubes a chave C nunca fundia com a BD até mudar de separador.
 */
const CHAVE_IDS_AFTER_CLUB_SYNC: readonly string[] = ['40+', 'c', 'd', 'iniciante', '50', 'sub-12', '60'];

function defaultCategoryIdOnBoot(): string {
  const s = loadState();
  const ids = s.categoryOrder?.length ? s.categoryOrder : s.categories.map(c => c.id);
  return ids[0] ?? 'profissional';
}

/** Garante categorias do arranque (ex. `40+`) se um backup antigo as tiver omitido. */
function mergeMissingCategoriesFromBootstrap(s: TournamentState): TournamentState {
  const have = new Set(s.categories.map(c => c.id));
  const missing = INITIAL_DATA.categories.filter(ic => !have.has(ic.id));
  if (missing.length === 0) return s;
  const newCats = [...s.categories, ...missing.map(ic => deepClone(ic))];
  const order = s.categoryOrder?.length ? [...s.categoryOrder] : newCats.map(c => c.id);
  for (const ic of missing) {
    if (!order.includes(ic.id)) order.push(ic.id);
  }
  return { ...s, categories: newCats, categoryOrder: order };
}

const TWELVE_CLUB_16_IDS = ['d', 'iniciante', '50'] as const;
const TEN_CLUB_B_STYLE_16_IDS = ['b'] as const;

/**
 * D, Iniciante e 50+: backups em localStorage podem ter `seeds` de 16 posições só com `''` (sem clubes).
 * Repõe o arranque do INITIAL_DATA para a chave principal e a mini 9–12 voltarem a avaliar.
 */
function repairEmptyTwelveClubCategorySeeds(s: TournamentState): TournamentState {
  return {
    ...s,
    categories: s.categories.map(cat => {
      if (cat.slots !== 16 || !TWELVE_CLUB_16_IDS.includes(cat.id as (typeof TWELVE_CLUB_16_IDS)[number])) return cat;
      const boot = INITIAL_DATA.categories.find(c => c.id === cat.id);
      if (!boot?.seeds?.length) return cat;
      if (!Array.isArray(cat.seeds) || cat.seeds.length !== 16) {
        return { ...cat, seeds: dedupeClubSeeds(deepClone(boot.seeds) as (string | null)[]) };
      }
      if (countRealSeeds(cat.seeds) > 0) return cat;
      return { ...cat, seeds: dedupeClubSeeds(deepClone(boot.seeds) as (string | null)[]) };
    }),
  };
}

/** Sub 12: localStorage antigo pode ter 8 vagas sem clubes — repõe arranque com BYE fixo na posição 2. */
function repairEmptySubTwelveSeeds(s: TournamentState): TournamentState {
  const boot = INITIAL_DATA.categories.find(c => c.id === 'sub-12');
  if (!boot?.seeds?.length) return s;
  return {
    ...s,
    categories: s.categories.map(cat => {
      if (cat.id !== 'sub-12' || cat.slots !== 8) return cat;
      if (!Array.isArray(cat.seeds) || cat.seeds.length !== 8) {
        return {
          ...cat,
          seeds: dedupeClubSeeds(sanitizeEightSlotSevenClubCategorySeeds('sub-12', deepClone(boot.seeds) as (string | null)[])),
        };
      }
      if (countRealSeeds(cat.seeds) > 0) {
        return {
          ...cat,
          seeds: dedupeClubSeeds(sanitizeEightSlotSevenClubCategorySeeds('sub-12', [...cat.seeds] as (string | null)[])),
        };
      }
      return {
        ...cat,
        seeds: dedupeClubSeeds(sanitizeEightSlotSevenClubCategorySeeds('sub-12', deepClone(boot.seeds) as (string | null)[])),
      };
    }),
  };
}

/** Sub 16: garante o mesmo desenho da Sub 12 (7 clubes em 8, BYE fixo só na posição 2). */
function repairSubSixteenSeeds(s: TournamentState): TournamentState {
  const boot = INITIAL_DATA.categories.find(c => c.id === 'sub-16');
  if (!boot?.seeds?.length) return s;
  return {
    ...s,
    categories: s.categories.map(cat => {
      if (cat.id !== 'sub-16' || cat.slots !== 8) return cat;
      // Estado inválido/antigo: volta ao arranque oficial da categoria.
      if (!Array.isArray(cat.seeds) || cat.seeds.length !== 8) {
        return {
          ...cat,
          seeds: dedupeClubSeeds(sanitizeEightSlotSevenClubCategorySeeds('sub-16', deepClone(boot.seeds) as (string | null)[])),
        };
      }
      // Sem clubes reais: repõe o layout base (garante BYE fixo no slot 2).
      if (countRealSeeds(cat.seeds) === 0) {
        return {
          ...cat,
          seeds: dedupeClubSeeds(sanitizeEightSlotSevenClubCategorySeeds('sub-16', deepClone(boot.seeds) as (string | null)[])),
        };
      }
      return {
        ...cat,
        seeds: dedupeClubSeeds(sanitizeEightSlotSevenClubCategorySeeds('sub-16', [...cat.seeds] as (string | null)[])),
      };
    }),
  };
}

/** 60+: garante BYEs fixos do layout 9 em 16 (inclui posição 14). */
function repairSixtyFixedByes(s: TournamentState): TournamentState {
  const byePositions = CATEGORY_FIXED_BYE_ONE_BASED['60'];
  if (!byePositions?.length) return s;
  const byeIdx = new Set(byePositions.map(p => p - 1));
  return {
    ...s,
    categories: s.categories.map(cat => {
      if (cat.id !== '60' || cat.slots !== 16) return cat;
      const seeds = [...cat.seeds];
      let changed = false;
      for (const idx of byeIdx) {
        if (seeds[idx] !== null) {
          seeds[idx] = null;
          changed = true;
        }
      }
      return changed ? { ...cat, seeds } : cat;
    }),
  };
}

/** B: estado antigo sem clubes — repõe arranque (vagas vazias + BYE). */
function repairEmptyTenClubSixteenSeeds(s: TournamentState): TournamentState {
  return {
    ...s,
    categories: s.categories.map(cat => {
      if (cat.slots !== 16 || !TEN_CLUB_B_STYLE_16_IDS.includes(cat.id as (typeof TEN_CLUB_B_STYLE_16_IDS)[number]))
        return cat;
      const boot = INITIAL_DATA.categories.find(c => c.id === cat.id);
      if (!boot?.seeds?.length) return cat;
      if (!Array.isArray(cat.seeds) || cat.seeds.length !== 16) {
        return { ...cat, seeds: dedupeClubSeeds(deepClone(boot.seeds) as (string | null)[]) };
      }
      if (countRealSeeds(cat.seeds) > 0) return cat;
      return { ...cat, seeds: dedupeClubSeeds(deepClone(boot.seeds) as (string | null)[]) };
    }),
  };
}

/** Migração: Sub 14 passa a seguir a A (16 slots com BYEs fixos da chave de 9 clubes). */
function repairSubFourteenFormat(s: TournamentState): TournamentState {
  const boot = INITIAL_DATA.categories.find(c => c.id === 'sub-14');
  if (!boot?.seeds?.length) return s;
  return {
    ...s,
    categories: s.categories.map(cat => {
      if (cat.id !== 'sub-14') return cat;
      if (cat.slots !== boot.slots) {
        return {
          ...cat,
          slots: boot.slots,
          seeds: dedupeClubSeeds(deepClone(boot.seeds) as (string | null)[]),
          importedPlacements: [],
          roundDefaults: {},
          matchResults: {},
        };
      }
      if (!Array.isArray(cat.seeds) || cat.seeds.length !== boot.slots) {
        return { ...cat, seeds: dedupeClubSeeds(deepClone(boot.seeds) as (string | null)[]) };
      }
      return cat;
    }),
  };
}

/** Migração: Sub 18 passa a seguir a Profissional (8 slots sem BYE fixo). */
function repairSubEighteenFormat(s: TournamentState): TournamentState {
  const boot = INITIAL_DATA.categories.find(c => c.id === 'sub-18');
  if (!boot?.seeds?.length) return s;
  return {
    ...s,
    categories: s.categories.map(cat => {
      if (cat.id !== 'sub-18') return cat;
      if (cat.slots !== boot.slots) {
        return {
          ...cat,
          slots: boot.slots,
          seeds: dedupeClubSeeds(deepClone(boot.seeds) as (string | null)[]),
          importedPlacements: [],
          roundDefaults: {},
          matchResults: {},
        };
      }
      if (!Array.isArray(cat.seeds) || cat.seeds.length !== boot.slots) {
        return { ...cat, seeds: dedupeClubSeeds(deepClone(boot.seeds) as (string | null)[]) };
      }
      return cat;
    }),
  };
}

function readShowPlacementPref(): boolean {
  try {
    return localStorage.getItem(PLACEMENT_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

function normalizeState(s: TournamentState): TournamentState {
  if (typeof s.event?.title === 'string' && s.event.title.trim() === '4º Interclubes de Beach Tennis FBT') {
    s.event.title = '5º Interclubes de Beach Tennis FBT';
  }
  if (
    typeof s.event?.local === 'string' &&
    (s.event.local.trim() === '' || s.event.local.trim() === 'VAMO, Brasília - DF')
  ) {
    s.event.local = 'Arena BRB, Brasília - DF';
  }
  s.clubs = (s.clubs || []).map(club => ({
    ...club,
    flag: normalizeClubFlagSrc(typeof club.flag === 'string' ? club.flag : ''),
  }));
  s.categories = (s.categories || []).map(cat => {
    const merged = {
      importedPlacements: [],
      roundDefaults: {},
      matchResults: {},
      ...cat,
    };
    return { ...merged, seeds: dedupeClubSeeds((merged.seeds || []) as (string | null)[]) };
  });
  s.categoryOrder = s.categoryOrder?.length ? s.categoryOrder : s.categories.map(c => c.id);
  return repairSubEighteenFormat(
    repairSubFourteenFormat(
      repairSubSixteenSeeds(
        repairSixtyFixedByes(
          repairEmptySubTwelveSeeds(repairEmptyTenClubSixteenSeeds(repairEmptyTwelveClubCategorySeeds(s)))
        )
      )
    )
  );
}

function loadState(): TournamentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return mergeMissingCategoriesFromBootstrap(normalizeState(deepClone(INITIAL_DATA)));
    }
    const parsed = JSON.parse(raw) as Partial<TournamentState>;
    /** Clubes vêm sempre do webhook n8n — não reidratamos lista persistida (evita dados velhos sobre a BD). */
    const bootstrapClubs = deepClone(INITIAL_DATA.clubs);
    const merged = normalizeState({
      ...deepClone(INITIAL_DATA),
      ...parsed,
      clubs: bootstrapClubs,
    });
    return mergeMissingCategoriesFromBootstrap(merged);
  } catch {
    return mergeMissingCategoriesFromBootstrap(normalizeState(deepClone(INITIAL_DATA)));
  }
}

function saveState(state: TournamentState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface TournamentContextType {
  state: TournamentState;
  ui: UIState;
  setPage: (page: PageType) => void;
  setCategory: (id: string) => void;
  setAdminPanel: (panel: AdminPanel) => void;
  setAdminMode: (mode: AdminMode) => void;
  setShowPlacementBrackets: (v: boolean) => void;
  selectMatch: (id: string) => void;
  openMatchModal: () => void;
  closeMatchModal: () => void;
  doLogin: (user: string, pass: string) => boolean;
  logout: () => void;
  setShowLogin: (v: boolean) => void;
  updateEvent: (key: string, value: string) => void;
  setMatchPatch: (categoryId: string, matchId: string, patch: Partial<MatchState>) => void;
  /** Desmarca «em andamento» em todos os jogos de todas as categorias e grava no webhook por confronto. */
  clearAllMatchesInProgress: () => void;
  clearMatch: (categoryId: string, matchId: string) => void;
  setRoundDefault: (categoryId: string, scheduleKey: string, value: string) => void;
  setSlotClub: (categoryId: string, idx: number, clubId: string) => void;
  saveCategorySeeds: (categoryId: string, seeds: (string | null)[]) => Promise<void>;
  addClub: (name: string, flag: string) => void;
  replaceClubs: (clubs: Club[]) => void;
  editClub: (id: string, newName: string) => void;
  changeClubFlag: (id: string, flag: string) => void;
  removeClub: (id: string) => void;
  exportBackup: () => void;
  importBackup: (data: string) => boolean;
  resetAll: () => void;
  getCategory: (id: string) => Category;
  /** Recarrega uma categoria do `load_chave`. `afterOfficialDraw` limpa/fundir resultados só com o que vier no servidor. `mergeRoundDefaultsFromPatch` traz horários da BD (omitir em polling). */
  reloadChaveFromServer: (
    categoryId: string,
    opts?: { afterOfficialDraw?: boolean; mergeRoundDefaultsFromPatch?: boolean }
  ) => Promise<void>;
  /** Recarrega todas as categorias após sorteio (limpa resultados conforme o servidor em cada uma). */
  reloadAllChavesAfterOfficialDraw: () => Promise<void>;
  /** Busca clubes no n8n, atualiza estado e funde chaves (ver `CHAVE_IDS_AFTER_CLUB_SYNC`) com o load_chave. */
  refreshClubsFromWebhook: () => Promise<void>;
  /**
   * Todas as categorias: chave vazia (BYEs fixos mantidos), sem resultados nem horários de rodada.
   * Opcionalmente grava cada categoria no `save_chave` (n8n/MySQL).
   */
  clearAllChavesForSorteio: (opts?: { saveToServer?: boolean }) => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TournamentState>(loadState);
  const stateRef = useRef(state);
  /** Invalida `refreshClubsFromWebhook` em voo (Strict Mode / desmontagem). */
  const clubsSyncGenRef = useRef(0);
  const [ui, setUi] = useState<UIState>({
    page: 'principal',
    categoryId: defaultCategoryIdOnBoot(),
    adminMode: 'main',
    adminPanel: 'operacao',
    selectedMatchId: '',
    matchModalOpen: false,
    isAdmin: false,
    showLogin: false,
    loginError: '',
    showPlacementBrackets: readShowPlacementPref()
  });
  const uiRef = useRef(ui);
  useEffect(() => {
    uiRef.current = ui;
  }, [ui]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshClubsFromWebhook = useCallback(async () => {
    const myGen = ++clubsSyncGenRef.current;
    const remote = await fetchClubsFromWebhook();
    if (!remote.clubs.length) {
      throw new Error('Servidor de clubes respondeu sem registros.');
    }
    if (clubsSyncGenRef.current !== myGen) return;
    const prev = stateRef.current;
    const next = remote.clubs
      .map(c => ({
        id: String(c.id).trim(),
        name: String(c.name).trim().toUpperCase(),
        flag: normalizeClubFlagSrc(typeof c.flag === 'string' ? c.flag : ''),
      }))
      .filter(c => c.id && c.name);
    const ev = remote.event;
    /** Só substitui `clubs` aqui — não limpar `seeds` antes do `load_chave`, senão apaga-se a C (e outras) antes de aplicar `seeds_json` do n8n. */
    const withRemoteClubs: TournamentState = {
      ...prev,
      clubs: next,
      event: ev
        ? {
            title: ev.title ?? prev.event.title,
            local: ev.local ?? prev.event.local,
            arbitroGeral: ev.arbitroGeral ?? prev.event.arbitroGeral,
          }
        : prev.event,
      categories: prev.categories.map(cat => ({ ...cat, importedPlacements: [] })),
    };
    const merged = await fetchAndMergeChavesForIds(withRemoteClubs, [...CHAVE_IDS_AFTER_CLUB_SYNC]);
    /** Depois das chaves: alinha nomes/ids com `select_club`; só limpa vagas que ainda não correspondem a nenhum clube. */
    const sanitized: TournamentState = {
      ...merged,
      categories: merged.categories.map(cat => ({
        ...cat,
        seeds: dedupeClubSeeds(
          normalizeChaveSeedsForApp(cat.seeds as (string | null)[], merged.clubs).map(seed => {
            if (seed === null) return null;
            if (typeof seed !== 'string' || !seed.trim()) return seed;
            return merged.clubs.some(cl => cl.id === seed) ? seed : '';
          })
        ),
      })),
    };
    if (clubsSyncGenRef.current !== myGen) return;
    saveState(sanitized);
    setState(sanitized);

    /** Reaplica a chave do separador visível: após `select_club` a lista muda e o 1º merge (ex. 40+) pode ter ficado só com nomes/branco até haver ids na BD. */
    const curId = uiRef.current.categoryId;
    if (curId) {
      void (async () => {
        try {
          const patch = await fetchChaveCategory(curId);
          if (clubsSyncGenRef.current !== myGen) return;
          setState(prev => {
            const next = mergeChaveIntoState(prev, curId, patch);
            if (next === prev) return prev;
            saveState(next);
            return next;
          });
        } catch {
          /* igual ao efeito por categoria */
        }
      })();
    }
  }, []);

  /** Clubes sempre a partir do webhook n8n ao abrir o app. */
  useEffect(() => {
    void refreshClubsFromWebhook().catch(() => {
      /* sem rede / CORS: mantém clubes do bootstrap (INITIAL_DATA) até conseguir sincronizar */
    });
    return () => {
      clubsSyncGenRef.current += 1;
    };
  }, [refreshClubsFromWebhook]);

  /** Ao voltar ao separador, alinha de novo com a BD. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(t);
      t = setTimeout(() => {
        void refreshClubsFromWebhook().catch(() => {});
      }, 500);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshClubsFromWebhook]);

  const updateState = useCallback((updater: (s: TournamentState) => TournamentState) => {
    setState(prev => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const id = ui.categoryId;
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const patch = await fetchChaveCategory(id);
        if (cancelled) return;
        setState(prev => {
          const next = mergeChaveIntoState(prev, id, patch);
          if (next === prev) return prev;
          saveState(next);
          return next;
        });
      } catch {
        /* sem servidor ou 404: mantém estado local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ui.categoryId]);

  const getCategory = useCallback((id: string): Category => {
    return state.categories.find(c => c.id === id) || state.categories[0];
  }, [state.categories]);

  const setPage = useCallback((page: PageType) => {
    if (page === 'admin' && !ui.isAdmin) {
      setUi(prev => ({ ...prev, showLogin: true }));
      return;
    }
    setUi(prev => ({
      ...prev,
      page,
      ...(page !== 'admin' ? { matchModalOpen: false, selectedMatchId: '' } : {})
    }));
  }, [ui.isAdmin]);

  const setCategory = useCallback((id: string) => {
    setUi(prev => ({ ...prev, categoryId: id, selectedMatchId: '', matchModalOpen: false }));
  }, []);

  const setAdminPanel = useCallback((panel: AdminPanel) => {
    setUi(prev => ({ ...prev, adminPanel: panel }));
  }, []);

  const setAdminMode = useCallback((mode: AdminMode) => {
    setUi(prev => ({ ...prev, adminMode: mode, selectedMatchId: '' }));
  }, []);

  const setShowPlacementBrackets = useCallback((v: boolean) => {
    try {
      localStorage.setItem(PLACEMENT_PREF_KEY, v ? '1' : '0');
    } catch { /* ignore */ }
    setUi(prev => ({ ...prev, showPlacementBrackets: v }));
  }, []);

  const selectMatch = useCallback((id: string) => {
    setUi(prev => ({ ...prev, selectedMatchId: id }));
  }, []);

  const openMatchModal = useCallback(() => {
    setUi(prev => ({ ...prev, matchModalOpen: true }));
  }, []);

  const closeMatchModal = useCallback(() => {
    setUi(prev => ({ ...prev, matchModalOpen: false }));
  }, []);

  const doLogin = useCallback((user: string, pass: string): boolean => {
    if (user === 'mrarbitragem' && pass === '14253600@') {
      setUi(prev => ({ ...prev, isAdmin: true, showLogin: false, loginError: '', page: 'admin' }));
      return true;
    }
    setUi(prev => ({ ...prev, loginError: 'Credenciais inválidas.' }));
    return false;
  }, []);

  const logout = useCallback(() => {
    setUi(prev => ({
      ...prev,
      isAdmin: false,
      page: 'principal',
      matchModalOpen: false,
      selectedMatchId: '',
    }));
  }, []);

  const setShowLogin = useCallback((v: boolean) => {
    setUi(prev => ({ ...prev, showLogin: v, loginError: '' }));
  }, []);

  const updateEvent = useCallback((key: string, value: string) => {
    updateState(s => ({ ...s, event: { ...s.event, [key]: value } }));
  }, [updateState]);

  const setMatchPatch = useCallback((categoryId: string, matchId: string, patch: Partial<MatchState>) => {
    updateState(s => {
      const cat = s.categories.find(c => c.id === categoryId);
      if (!cat) return s;
      const cats = s.categories.map(c => {
        if (c.id !== categoryId) return c;
        const merged: MatchState = {
          score1: '',
          score2: '',
          winner: '',
          datetime: '',
          inProgress: false,
          court: '',
          ...c.matchResults[matchId],
          ...patch,
        };
        queueMicrotask(() => {
          void saveJogoToWebhook({
            categoriaId: categoryId,
            matchId,
            ...merged,
          }).catch(() => {
            /* falha silenciosa: estado já está no localStorage; pode-se ligar toast depois */
          });
        });
        return {
          ...c,
          matchResults: {
            ...c.matchResults,
            [matchId]: merged,
          },
        };
      });
      return { ...s, categories: cats };
    });
  }, [updateState]);

  const clearAllMatchesInProgress = useCallback(() => {
    updateState(prev => {
      const saves: { categoryId: string; matchId: string; merged: MatchState }[] = [];
      const nextCats = prev.categories.map(cat => {
        const newMr = { ...cat.matchResults };
        let touched = false;
        for (const [mid, st] of Object.entries(newMr)) {
          if (!st?.inProgress) continue;
          const merged: MatchState = {
            score1: '',
            score2: '',
            winner: '',
            datetime: '',
            court: '',
            ...st,
            inProgress: false,
          };
          newMr[mid] = merged;
          touched = true;
          saves.push({ categoryId: cat.id, matchId: mid, merged });
        }
        return touched ? { ...cat, matchResults: newMr } : cat;
      });

      if (saves.length === 0) return prev;

      queueMicrotask(() => {
        for (const { categoryId, matchId, merged } of saves) {
          void saveJogoToWebhook({
            categoriaId: categoryId,
            matchId,
            ...merged,
          }).catch(() => {});
        }
      });

      return { ...prev, categories: nextCats };
    });
  }, [updateState]);

  const clearMatch = useCallback((categoryId: string, matchId: string) => {
    updateState(s => {
      const cats = s.categories.map(cat => {
        if (cat.id !== categoryId) return cat;
        const results = { ...cat.matchResults };
        delete results[matchId];
        return { ...cat, matchResults: results };
      });
      return { ...s, categories: cats };
    });
  }, [updateState]);

  const setRoundDefault = useCallback((categoryId: string, scheduleKey: string, value: string) => {
    updateState(s => {
      const cats = s.categories.map(cat => {
        if (cat.id !== categoryId) return cat;
        return { ...cat, roundDefaults: { ...cat.roundDefaults, [scheduleKey]: value } };
      });
      const cat = cats.find(c => c.id === categoryId);
      if (cat) {
        const rd = { ...cat.roundDefaults };
        queueMicrotask(() => {
          void saveChaveCategory({
            categoriaId: categoryId,
            seeds: [...cat.seeds],
            roundDefaults: rd,
          }).catch(() => {});
        });
      }
      return { ...s, categories: cats };
    });
  }, [updateState]);

  const setSlotClub = useCallback((categoryId: string, idx: number, clubId: string) => {
    const trimmed = (clubId || '').trim();
    updateState(s => {
      const cat = s.categories.find(c => c.id === categoryId);
      if (!cat) return s;
      const cats = s.categories.map(c => {
        if (c.id !== categoryId) return c;
        const seeds = [...c.seeds];
        const currentAtIdx = seeds[idx];
        if (trimmed) {
          const existingIdx = seeds.findIndex((seed, j) => j !== idx && seed === trimmed);
          if (existingIdx >= 0) {
            // Permite reorganizar a chave cheia sem limpar slot antes: troca as posições.
            seeds[existingIdx] = typeof currentAtIdx === 'string' ? currentAtIdx : '';
          }
        }
        seeds[idx] = trimmed || '';
        return { ...c, seeds };
      });
      const nextCat = cats.find(c => c.id === categoryId);
      if (nextCat) {
        queueMicrotask(() => {
          void saveChaveCategory({
            categoriaId: categoryId,
            seeds: [...nextCat.seeds],
            roundDefaults: { ...nextCat.roundDefaults },
          }).catch(() => {});
        });
      }
      return { ...s, categories: cats };
    });
  }, [updateState]);

  const saveCategorySeeds = useCallback(async (categoryId: string, seeds: (string | null)[]) => {
    const current = stateRef.current;
    const cat = current.categories.find(c => c.id === categoryId);
    if (!cat) throw new Error('Categoria não encontrada.');

    const nextSeeds = cat.seeds.map((seed, idx) => {
      if (seed === null) return null;
      const raw = seeds[idx];
      return typeof raw === 'string' ? raw.trim() : '';
    });

    await saveChaveCategory({
      categoriaId: categoryId,
      seeds: [...nextSeeds],
      roundDefaults: { ...cat.roundDefaults },
    });

    setState(prev => {
      const cats = prev.categories.map(c => (c.id === categoryId ? { ...c, seeds: [...nextSeeds] } : c));
      const next = { ...prev, categories: cats };
      saveState(next);
      return next;
    });
  }, []);

  const replaceClubs = useCallback((clubs: Club[]) => {
    const next = clubs.map(c => ({
      id: String(c.id).trim(),
      name: String(c.name).trim().toUpperCase(),
      flag: normalizeClubFlagSrc(typeof c.flag === 'string' ? c.flag : ''),
    })).filter(c => c.id && c.name);
    updateState(s => ({
      ...s,
      clubs: next,
      categories: s.categories.map(cat => ({
        ...cat,
        seeds: cat.seeds.map(seed => (typeof seed === 'string' && seed && !next.some(cl => cl.id === seed) ? '' : seed)),
        importedPlacements: [],
      })),
    }));
  }, [updateState]);

  const addClub = useCallback((name: string, flag: string) => {
    updateState(s => {
      const nm = name.trim().toUpperCase();
      if (!nm) return s;
      const idBase = slugify(nm);
      let id = idBase;
      let i = 2;
      while (s.clubs.some(c => c.id === id)) { id = `${idBase}-${i++}`; }
      return { ...s, clubs: [...s.clubs, { id, name: nm, flag }] };
    });
  }, [updateState]);

  const editClub = useCallback((id: string, newName: string) => {
    updateState(s => ({
      ...s,
      clubs: s.clubs.map(c => c.id === id ? { ...c, name: newName.trim().toUpperCase() } : c)
    }));
  }, [updateState]);

  const changeClubFlag = useCallback((id: string, flag: string) => {
    updateState(s => ({
      ...s,
      clubs: s.clubs.map(c => c.id === id ? { ...c, flag } : c)
    }));
  }, [updateState]);

  const removeClub = useCallback((id: string) => {
    updateState(s => ({
      ...s,
      clubs: s.clubs.filter(c => c.id !== id),
      categories: s.categories.map(cat => ({
        ...cat,
        seeds: cat.seeds.map(seed => seed === id ? '' : seed),
        importedPlacements: []
      }))
    }));
  }, [updateState]);

  const exportBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `interclubes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [state]);

  const importBackup = useCallback((data: string): boolean => {
    try {
      const parsed = normalizeState(JSON.parse(data));
      setState(parsed);
      saveState(parsed);
      setUi(prev => ({ ...prev, matchModalOpen: false, selectedMatchId: '' }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetAll = useCallback(() => {
    const fresh = normalizeState(deepClone(INITIAL_DATA));
    setState(fresh);
    saveState(fresh);
    setUi(prev => ({ ...prev, selectedMatchId: '', matchModalOpen: false }));
  }, []);

  const reloadChaveFromServer = useCallback(
    async (
      categoryId: string,
      opts?: { afterOfficialDraw?: boolean; mergeRoundDefaultsFromPatch?: boolean }
    ) => {
      const patch = await fetchChaveCategory(categoryId);
      setState(prev => {
        const next = mergeChaveIntoState(prev, categoryId, patch, {
          resetMatchResultsToPatch: opts?.afterOfficialDraw === true,
          mergeRoundDefaultsFromPatch: opts?.mergeRoundDefaultsFromPatch === true,
        });
        if (next === prev) return prev;
        saveState(next);
        return next;
      });
    },
    []
  );

  const reloadAllChavesAfterOfficialDraw = useCallback(async () => {
    const base = stateRef.current;
    const ids = [...new Set([...(base.categoryOrder || []), ...base.categories.map(c => c.id)])];
    const acc = await fetchAndMergeChavesForIds(base, ids, {
      resetMatchResultsToPatch: true,
      mergeRoundDefaultsFromPatch: true,
    });
    saveState(acc);
    setState(acc);
  }, []);

  const clearAllChavesForSorteio = useCallback(async (opts?: { saveToServer?: boolean }) => {
    const base = stateRef.current;
    const next: TournamentState = {
      ...base,
      categories: base.categories.map(cat => ({
        ...cat,
        seeds: buildEmptySeedsForDraw(cat.id, cat.slots),
        matchResults: {},
        roundDefaults: {},
        importedPlacements: [],
      })),
    };
    saveState(next);
    setState(next);

    if (opts?.saveToServer) {
      const failed: { id: string; message: string }[] = [];
      for (const cat of next.categories) {
        try {
          await saveChaveCategory({
            categoriaId: cat.id,
            seeds: [...cat.seeds],
            roundDefaults: {},
          });
        } catch (e) {
          failed.push({
            id: cat.id,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
      if (failed.length > 0) {
        const detail = failed.map(f => `${f.id}: ${f.message}`).join(' | ');
        throw new Error(`Falha ao gravar no servidor (algumas categorias): ${detail}`);
      }
    }
  }, []);

  return (
    <TournamentContext.Provider value={{
      state, ui, setPage, setCategory, setAdminPanel, setAdminMode, setShowPlacementBrackets,
      selectMatch, openMatchModal, closeMatchModal, doLogin, logout, setShowLogin,
      updateEvent, setMatchPatch, clearAllMatchesInProgress, clearMatch, setRoundDefault, setSlotClub,
      saveCategorySeeds,
      addClub, replaceClubs, editClub, changeClubFlag, removeClub, exportBackup, importBackup, resetAll, getCategory,
      reloadChaveFromServer, reloadAllChavesAfterOfficialDraw,
      refreshClubsFromWebhook, clearAllChavesForSorteio,
    }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
}
