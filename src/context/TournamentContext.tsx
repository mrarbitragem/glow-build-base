import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { TournamentState, UIState, Category, MatchState, PageType, AdminPanel, AdminMode } from '@/types/tournament';
import { INITIAL_DATA, STORAGE_KEY } from '@/data/initialData';
import { deepClone, slugify, fileToDataUrl } from '@/utils/helpers';

function normalizeState(s: TournamentState): TournamentState {
  s.clubs = (s.clubs || []).map(club => ({ flag: '', ...club }));
  s.categories = (s.categories || []).map(cat => ({
    importedPlacements: [],
    roundDefaults: {},
    matchResults: {},
    ...cat
  }));
  s.categoryOrder = s.categoryOrder?.length ? s.categoryOrder : s.categories.map(c => c.id);
  return s;
}

function loadState(): TournamentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeState(deepClone(INITIAL_DATA));
    return normalizeState({ ...deepClone(INITIAL_DATA), ...JSON.parse(raw) });
  } catch {
    return normalizeState(deepClone(INITIAL_DATA));
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
  selectMatch: (id: string) => void;
  openMatchModal: () => void;
  closeMatchModal: () => void;
  doLogin: (user: string, pass: string) => boolean;
  logout: () => void;
  setShowLogin: (v: boolean) => void;
  updateEvent: (key: string, value: string) => void;
  setMatchPatch: (categoryId: string, matchId: string, patch: Partial<MatchState>) => void;
  clearMatch: (categoryId: string, matchId: string) => void;
  setRoundDefault: (categoryId: string, scheduleKey: string, value: string) => void;
  setSlotClub: (categoryId: string, idx: number, clubId: string) => void;
  addClub: (name: string, flag: string) => void;
  editClub: (id: string, newName: string) => void;
  changeClubFlag: (id: string, flag: string) => void;
  removeClub: (id: string) => void;
  exportBackup: () => void;
  importBackup: (data: string) => boolean;
  resetAll: () => void;
  getCategory: (id: string) => Category;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TournamentState>(loadState);
  const [ui, setUi] = useState<UIState>({
    page: 'principal',
    categoryId: loadState().categoryOrder[0],
    adminMode: 'main',
    adminPanel: 'operacao',
    selectedMatchId: '',
    matchModalOpen: false,
    isAdmin: false,
    showLogin: false,
    loginError: ''
  });

  const updateState = useCallback((updater: (s: TournamentState) => TournamentState) => {
    setState(prev => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

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
    setUi(prev => ({ ...prev, isAdmin: false, page: 'principal' }));
  }, []);

  const setShowLogin = useCallback((v: boolean) => {
    setUi(prev => ({ ...prev, showLogin: v, loginError: '' }));
  }, []);

  const updateEvent = useCallback((key: string, value: string) => {
    updateState(s => ({ ...s, event: { ...s.event, [key]: value } }));
  }, [updateState]);

  const setMatchPatch = useCallback((categoryId: string, matchId: string, patch: Partial<MatchState>) => {
    updateState(s => {
      const cats = s.categories.map(cat => {
        if (cat.id !== categoryId) return cat;
        return {
          ...cat,
          matchResults: {
            ...cat.matchResults,
            [matchId]: { score1: '', score2: '', winner: '', datetime: '', ...cat.matchResults[matchId], ...patch }
          }
        };
      });
      return { ...s, categories: cats };
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
      return { ...s, categories: cats };
    });
  }, [updateState]);

  const setSlotClub = useCallback((categoryId: string, idx: number, clubId: string) => {
    updateState(s => {
      const cats = s.categories.map(cat => {
        if (cat.id !== categoryId) return cat;
        const seeds = [...cat.seeds];
        seeds[idx] = clubId || '';
        return { ...cat, seeds };
      });
      return { ...s, categories: cats };
    });
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

  return (
    <TournamentContext.Provider value={{
      state, ui, setPage, setCategory, setAdminPanel, setAdminMode,
      selectMatch, openMatchModal, closeMatchModal, doLogin, logout, setShowLogin,
      updateEvent, setMatchPatch, clearMatch, setRoundDefault, setSlotClub,
      addClub, editClub, changeClubFlag, removeClub, exportBackup, importBackup, resetAll, getCategory
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
