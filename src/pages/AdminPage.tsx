import { useRef, useEffect, useState, useCallback } from 'react';
import { useTournament } from '@/context/TournamentContext';
import {
  evaluateStructure,
  countRealSeeds,
  scheduleLabel,
  collectMatches,
  categoryHasTwelveClubNineToTwelvePlayoff,
  visibleMatchCode,
} from '@/utils/bracketEngine';
import { BracketView, BlockView } from '@/components/BracketView';
import { DirectNinthPlaceCard } from '@/components/DirectNinthPlaceCard';
import { ClubFlagMedia } from '@/components/ClubFlagMedia';
import { fileToDataUrl } from '@/utils/helpers';
import { BlockResult, EvaluatedMatch } from '@/types/tournament';

type ProgramacaoRow = {
  dateKey: string;
  timeLabel: string;
  roundLabel: string;
  categoryName: string;
  gameLabel: string;
  categorySort: number;
  gameSort: number;
  leftName: string;
  rightName: string;
  resultLabel: string;
};

function AdminSidebar() {
  const {
    state,
    ui,
    getCategory,
    setAdminPanel,
    setAdminMode,
    updateEvent,
    saveCategorySeeds,
    addClub,
    editClub,
    changeClubFlag,
    removeClub,
    exportBackup,
    importBackup,
    resetAll,
    setRoundDefault,
    setShowPlacementBrackets,
    clearAllMatchesInProgress,
    reloadChaveFromServer,
    reloadAllChavesAfterOfficialDraw,
    refreshClubsFromWebhook,
    clearAllChavesForSorteio,
  } = useTournament();
  const category = getCategory(ui.categoryId);
  const clubNameRef = useRef<HTMLInputElement>(null);
  const clubFlagRef = useRef<HTMLInputElement>(null);
  const [clubsRemoteLoading, setClubsRemoteLoading] = useState(false);
  const [clubsRemoteError, setClubsRemoteError] = useState<string | null>(null);
  const [chaveSyncBusy, setChaveSyncBusy] = useState(false);
  const [chaveSyncError, setChaveSyncError] = useState<string | null>(null);
  const [sorteioClearBusy, setSorteioClearBusy] = useState(false);
  const [sorteioClearError, setSorteioClearError] = useState<string | null>(null);
  const [categoryDraftSeeds, setCategoryDraftSeeds] = useState<(string | null)[]>(category.seeds);
  const [categorySaveBusy, setCategorySaveBusy] = useState(false);
  const [categorySaveError, setCategorySaveError] = useState<string | null>(null);
  const [categorySaveOk, setCategorySaveOk] = useState<string | null>(null);
  const [programacaoDate, setProgramacaoDate] = useState(() => new Date().toISOString().slice(0, 10));

  const handleReloadChaveThis = async (afterOfficialDraw: boolean) => {
    const label = category.name;
    if (
      afterOfficialDraw &&
      !confirm(
        `Categoria «${label}»: substituir a chave e os resultados de jogos pelos dados do servidor? (O que não vier na base será apagado nesta categoria.)`
      )
    ) {
      return;
    }
    setChaveSyncBusy(true);
    setChaveSyncError(null);
    try {
      await reloadChaveFromServer(ui.categoryId, { afterOfficialDraw });
    } catch (e) {
      setChaveSyncError(e instanceof Error ? e.message : 'Não foi possível recarregar a chave.');
    } finally {
      setChaveSyncBusy(false);
    }
  };

  const handleClearAllChavesLocal = async () => {
    if (
      !confirm(
        'Limpar todas as chaves neste navegador? Posições de clube ficam vazias (BYEs fixos mantidos) e apagam-se resultados e horários de rodada em todas as categorias.'
      )
    ) {
      return;
    }
    setSorteioClearBusy(true);
    setSorteioClearError(null);
    try {
      await clearAllChavesForSorteio({ saveToServer: false });
    } catch (e) {
      setSorteioClearError(e instanceof Error ? e.message : 'Não foi possível limpar as chaves.');
    } finally {
      setSorteioClearBusy(false);
    }
  };

  const handleClearAllChavesAndServer = async () => {
    if (
      !confirm(
        'Gravar chaves vazias em TODAS as categorias no servidor (save_chave) e limpar o estado local? Isto apaga posições, resultados e horários de rodada na base, para abrir ao sorteio.'
      )
    ) {
      return;
    }
    setSorteioClearBusy(true);
    setSorteioClearError(null);
    try {
      await clearAllChavesForSorteio({ saveToServer: true });
    } catch (e) {
      setSorteioClearError(e instanceof Error ? e.message : 'Não foi possível gravar as chaves vazias.');
    } finally {
      setSorteioClearBusy(false);
    }
  };

  const handleReloadAllChavesAfterDraw = async () => {
    if (
      !confirm(
        'Recarregar todas as categorias a partir do servidor (como após o sorteio oficial)? Os resultados de cada categoria passam a coincidir com o que a base devolver; o que não existir no servidor será removido.'
      )
    ) {
      return;
    }
    setChaveSyncBusy(true);
    setChaveSyncError(null);
    try {
      await reloadAllChavesAfterOfficialDraw();
    } catch (e) {
      setChaveSyncError(e instanceof Error ? e.message : 'Não foi possível recarregar as chaves.');
    } finally {
      setChaveSyncBusy(false);
    }
  };

  const loadClubsFromServer = useCallback(async () => {
    setClubsRemoteLoading(true);
    setClubsRemoteError(null);
    try {
      await refreshClubsFromWebhook();
    } catch (e) {
      setClubsRemoteError(e instanceof Error ? e.message : 'Não foi possível carregar os clubes.');
    } finally {
      setClubsRemoteLoading(false);
    }
  }, [refreshClubsFromWebhook]);

  useEffect(() => {
    if (ui.adminPanel !== 'clubes') return;
    void loadClubsFromServer();
  }, [ui.adminPanel, loadClubsFromServer]);

  const struct = evaluateStructure(category, state.clubs);
  const categorySeedsDirty =
    categoryDraftSeeds.length !== category.seeds.length ||
    categoryDraftSeeds.some((seed, idx) => seed !== category.seeds[idx]);
  const slotR1GameByIndex = (() => {
    const out = new Map<number, number>();
    let game = 0;
    for (let i = 0; i < category.slots; i += 2) {
      const a = categoryDraftSeeds[i];
      const b = categoryDraftSeeds[i + 1];
      if (a === null || b === null) continue;
      game += 1;
      out.set(i, game);
      out.set(i + 1, game);
    }
    return out;
  })();

  useEffect(() => {
    setCategoryDraftSeeds([...category.seeds]);
    setCategorySaveError(null);
    setCategorySaveOk(null);
  }, [category.id, category.seeds]);

  const handleDraftSlotChange = (idx: number, clubId: string) => {
    const trimmed = (clubId || '').trim();
    setCategoryDraftSeeds(prev => {
      const seeds = [...prev];
      if (seeds[idx] === null) return seeds;
      const currentAtIdx = seeds[idx];
      if (trimmed) {
        const existingIdx = seeds.findIndex((seed, j) => j !== idx && seed === trimmed);
        if (existingIdx >= 0) {
          seeds[existingIdx] = typeof currentAtIdx === 'string' ? currentAtIdx : '';
        }
      }
      seeds[idx] = trimmed || '';
      return seeds;
    });
    setCategorySaveError(null);
    setCategorySaveOk(null);
  };

  const handleSaveCategorySeeds = async () => {
    setCategorySaveBusy(true);
    setCategorySaveError(null);
    setCategorySaveOk(null);
    try {
      await saveCategorySeeds(category.id, categoryDraftSeeds);
      setCategorySaveOk('Posições enviadas com sucesso.');
    } catch (e) {
      setCategorySaveError(e instanceof Error ? e.message : 'Não foi possível enviar as posições.');
    } finally {
      setCategorySaveBusy(false);
    }
  };

  const handleDiscardCategoryDraft = () => {
    if (!categorySeedsDirty) return;
    if (!confirm('Descartar as alterações nesta categoria e voltar ao que está salvo?')) return;
    setCategoryDraftSeeds([...category.seeds]);
    setCategorySaveError(null);
    setCategorySaveOk(null);
  };

  // Collect visible rounds for schedule manager
  const scheduleMatches: EvaluatedMatch[] = [];
  scheduleMatches.push(...struct.mainRounds.flat());
  const walkPlacement = (block: BlockResult) => {
    if (block.rounds?.length) scheduleMatches.push(...block.rounds.flat());
    block.children.forEach(walkPlacement);
  };
  struct.placementBlocks.filter(b => b.startPlace >= 3).forEach(walkPlacement);
  const seen = new Set<string>();
  const visibleRounds = scheduleMatches.filter(m => {
    if (seen.has(m.scheduleKey)) return false;
    seen.add(m.scheduleKey);
    return true;
  }).map(m => ({
    scheduleKey: m.scheduleKey,
    label: scheduleLabel(m),
    value: category.roundDefaults[m.scheduleKey] || ''
  }));

  const handleAddClub = async () => {
    const name = clubNameRef.current?.value || '';
    const file = clubFlagRef.current?.files?.[0];
    let flag = '';
    if (file) {
      try { flag = await fileToDataUrl(file); } catch {}
    }
    addClub(name, flag);
    if (clubNameRef.current) clubNameRef.current.value = '';
    if (clubFlagRef.current) clubFlagRef.current.value = '';
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const success = importBackup(reader.result as string);
      alert(success ? 'Backup importado com sucesso.' : 'Arquivo inválido.');
    };
    reader.readAsText(file);
  };

  const parseDateTimeParts = (raw: string): { dateKey: string; timeLabel: string } | null => {
    const t = String(raw || '').trim();
    if (!t) return null;
    const m = t.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
    if (m) return { dateKey: m[1], timeLabel: m[2] };
    const dt = new Date(t);
    if (Number.isNaN(dt.getTime())) return null;
    return {
      dateKey: dt.toISOString().slice(0, 10),
      timeLabel: dt.toTimeString().slice(0, 5),
    };
  };

  const escapeHtml = (v: string): string =>
    String(v)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const shortRoundLabel = (label: string): string => {
    return String(label || '')
      .replace(/Oitavas de final/gi, 'O.F')
      .replace(/Quartas de final/gi, 'Q.F')
      .replace(/Semifinal(?:es)?/gi, 'SF')
      .replace(/\bFinal\b/gi, 'F')
      .replace(/\bRodada\s*(\d+)/gi, 'R$1');
  };

  const buildProgramacaoRowsForDate = (dateKey: string): ProgramacaoRow[] => {
    const rows: ProgramacaoRow[] = [];
    const order = state.categoryOrder?.length ? state.categoryOrder : state.categories.map(c => c.id);
    const categorySortById = new Map(order.map((id, idx) => [id, idx]));
    for (const cid of order) {
      const cat = state.categories.find(c => c.id === cid);
      if (!cat) continue;
      const struct = evaluateStructure(cat, state.clubs);
      const all: EvaluatedMatch[] = [...struct.mainRounds.flat()];
      struct.placementBlocks.forEach(block => collectMatches(block, all));
      for (const m of all) {
        const dtParts = parseDateTimeParts(m.effectiveDate || '');
        if (!dtParts || dtParts.dateKey !== dateKey) continue;
        if (m.left.bye || m.right.bye) continue;
        const code = visibleMatchCode(m);
        const gameNumberMatch = (code || '').match(/(\d+)/);
        const gameNumber = gameNumberMatch ? Number(gameNumberMatch[1]) : Number.POSITIVE_INFINITY;
        const gameLabel = Number.isFinite(gameNumber) ? `J${gameNumber}` : (code || m.id);
        const s1 = String(m.saved.score1 ?? '').trim();
        const s2 = String(m.saved.score2 ?? '').trim();
        rows.push({
          dateKey: dtParts.dateKey,
          timeLabel: dtParts.timeLabel,
          roundLabel: shortRoundLabel(scheduleLabel(m)),
          categoryName: cat.name,
          gameLabel,
          categorySort: categorySortById.get(cat.id) ?? 999,
          gameSort: Number.isFinite(gameNumber) ? gameNumber : 9999,
          leftName: m.left.name || 'Aguardando',
          rightName: m.right.name || 'Aguardando',
          resultLabel: s1 || s2 ? `${s1 || ''} x ${s2 || ''}` : '',
        });
      }
    }
    rows.sort((a, b) => {
      const t = a.timeLabel.localeCompare(b.timeLabel);
      if (t !== 0) return t;
      const c = a.categorySort - b.categorySort;
      if (c !== 0) return c;
      const g = a.gameSort - b.gameSort;
      if (g !== 0) return g;
      return a.gameLabel.localeCompare(b.gameLabel, 'pt-BR');
    });
    return rows;
  };

  const handlePrintProgramacaoDia = () => {
    const dateKey = programacaoDate;
    if (!dateKey) {
      alert('Escolha uma data para imprimir a programação.');
      return;
    }
    const rows = buildProgramacaoRowsForDate(dateKey);
    if (rows.length === 0) {
      alert('Não há jogos programados para esta data.');
      return;
    }

    const dateLabel = (() => {
      const d = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(d.getTime())) return dateKey;
      const wd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
      return `${d.toLocaleDateString('pt-BR')} - ${wd.charAt(0).toUpperCase()}${wd.slice(1)}`;
    })();

    const htmlRows = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.timeLabel)}</td>
        <td>${escapeHtml(r.roundLabel)}</td>
        <td>${escapeHtml(r.categoryName)}</td>
        <td>${escapeHtml(r.gameLabel)}</td>
        <td class="confronto-cell">
          <span class="confronto-left">${escapeHtml(r.leftName)}</span>
          <span class="confronto-x">X</span>
          <span class="confronto-right">${escapeHtml(r.rightName)}</span>
        </td>
        <td>${escapeHtml(r.resultLabel)}</td>
      </tr>
    `).join('');

    const mrLogoUrl = `${window.location.origin}/images/logo-mr.png`;
    const w = window.open('', '_blank', 'width=1120,height=900');
    if (!w) {
      alert('Não foi possível abrir a janela de impressão. Verifique bloqueador de pop-up.');
      return;
    }
    w.document.write(`
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Programação do dia - ${state.event.title}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; margin: 18px; color: #111; }
          .head h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
          .head p { margin: 3px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #bbb; padding: 6px 8px; font-size: 12px; vertical-align: top; }
          th { background: #f3f3f3; text-align: left; }
          .confronto-head { text-align: center; }
          .confronto-cell {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
            align-items: center;
            gap: 8px;
            text-align: center;
          }
          .confronto-left {
            text-align: right;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .confronto-right {
            text-align: left;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .confronto-x { font-weight: 700; }
          thead { display: table-header-group; }
          .print-footer-mr {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-top: 1px solid #ccc;
            padding: 4px 8px 2px;
            background: #fff;
            font-size: 12px;
            line-height: 1.2;
            color: #333;
          }
          .print-footer-mr-logo {
            height: 14px;
            width: auto;
            display: block;
            object-fit: contain;
          }
          @media print {
            @page { margin: 14mm 10mm 14mm 10mm; }
            body { margin: 0; padding-top: 24mm; padding-bottom: 16mm; }
            .print-running-head {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              z-index: 9999;
              padding: 3.5mm 10mm 2.5mm;
              background: #fff;
              border-bottom: 1px solid #ccc;
            }
            .print-running-head h1 { margin: 0; font-size: 14px; text-transform: uppercase; line-height: 1.12; }
            .print-running-head p { margin: 1px 0; font-size: 10.5px; line-height: 1.15; }
            .print-footer-mr {
              padding: 2px 10mm 1px;
            }
          }
        </style>
      </head>
      <body>
        <div class="head print-running-head">
          <h1>${escapeHtml(state.event.title)}</h1>
          <p><strong>Local de Jogos:</strong> ${escapeHtml(state.event.local)}</p>
          <p><strong>Programação do dia:</strong> ${escapeHtml(dateLabel)}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Rodada</th>
              <th>Categoria</th>
              <th>Jogo</th>
              <th class="confronto-head">Confronto</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
        <div class="print-footer-mr" aria-hidden="true">
          <span>Desenvolvido por</span>
          <img src="${escapeHtml(mrLogoUrl)}" alt="" class="print-footer-mr-logo" />
        </div>
      </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const tabs: [string, string][] = [['operacao', 'Operação'], ['clubes', 'Clubes'], ['categoria', 'Categoria']];

  return (
    <div className="card panel admin-sidebar">
      <div className="admin-tabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={`seg-btn ${ui.adminPanel === id ? 'active' : ''}`} onClick={() => setAdminPanel(id as any)}>
            {label}
          </button>
        ))}
      </div>

      {ui.adminPanel === 'operacao' && (
        <div className="stack">
          <h3>Operação</h3>
          <div className="helper">Painel principal da operação local.</div>
          <div className="field">
            <label className="label">Título</label>
            <input className="input" value={state.event.title} onChange={e => updateEvent('title', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Local</label>
            <input className="input" value={state.event.local} onChange={e => updateEvent('local', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Árbitro Geral</label>
            <input className="input" value={state.event.arbitroGeral} onChange={e => updateEvent('arbitroGeral', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Área da chave</label>
            <div className="footer-actions">
              <button className={`btn ${ui.adminMode === 'main' ? '' : 'secondary'}`} onClick={() => setAdminMode('main')}>Chaves</button>
              <button className={`btn ${ui.adminMode === 'disputas' ? '' : 'secondary'}`} onClick={() => setAdminMode('disputas')}>Posições</button>
            </div>
          </div>

          <div className="field">
            <label className="label">Jogos em andamento</label>
            <div className="helper">
              Remove a marcação «em andamento» em <strong>todas as categorias</strong> (página «Em Andamento» e registo por jogo no servidor). Placar, vencedor, horário e quadra mantêm-se.
            </div>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                if (
                  !confirm(
                    'Remover «em andamento» de todos os jogos em todas as categorias? Esta ação não apaga placares nem quem venceu.'
                  )
                ) {
                  return;
                }
                clearAllMatchesInProgress();
              }}
            >
              Limpar todos os jogos em andamento
            </button>
          </div>

          <div className="field">
            <label className="label">Sorteio / chaves no servidor</label>
            <div className="helper">
              Depois de gravar o sorteio na base (n8n / MySQL), use os botões abaixo. A categoria é a que está selecionada no topo do site (ex.: B).
            </div>
            <div className="footer-actions" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn secondary small"
                disabled={chaveSyncBusy}
                onClick={() => void handleReloadChaveThis(false)}
              >
                Atualizar só esta chave
              </button>
              <button
                type="button"
                className="btn secondary small"
                disabled={chaveSyncBusy}
                onClick={() => void handleReloadChaveThis(true)}
              >
                Sorteio: esta categoria
              </button>
              <button
                type="button"
                className="btn small"
                disabled={chaveSyncBusy}
                onClick={() => void handleReloadAllChavesAfterDraw()}
              >
                Sorteio: todas as categorias
              </button>
            </div>
            {chaveSyncError && (
              <div className="error" role="alert" style={{ marginTop: 8 }}>
                {chaveSyncError}
              </div>
            )}
          </div>

          <div className="field">
            <label className="label">Preparar publicação (sorteio)</label>
            <div className="helper">
              Limpa <strong>todas as categorias</strong>: só vagas vazias (mantém BYEs fixos de cada chave), zera
              <strong> resultados</strong> e <strong>horários de rodada</strong> na app e (com o 2.º botão) em
              <code> categoria_chave</code>. Se após F5 ainda aparecerem placares antigos, a tabela
              <code> jogo</code> ainda tem registos; apague ou zere aí para um sorteio totalmente limpo.
            </div>
            <div className="footer-actions" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn secondary small"
                disabled={sorteioClearBusy}
                onClick={() => void handleClearAllChavesLocal()}
              >
                {sorteioClearBusy ? 'A processar…' : 'Só limpar (este navegador)'}
              </button>
              <button
                type="button"
                className="btn small"
                disabled={sorteioClearBusy}
                onClick={() => void handleClearAllChavesAndServer()}
              >
                {sorteioClearBusy ? 'A processar…' : 'Limpar e gravar no servidor'}
              </button>
            </div>
            {sorteioClearError && (
              <div className="error" role="alert" style={{ marginTop: 8 }}>
                {sorteioClearError}
              </div>
            )}
          </div>

          <div className="field">
            <label className="label">Chaves de posição (público + agenda)</label>
            <div className="round-schedule-item" style={{ alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="show-placement"
                checked={ui.showPlacementBrackets}
                onChange={e => setShowPlacementBrackets(e.target.checked)}
              />
              <label htmlFor="show-placement" className="label" style={{ fontWeight: 500, margin: 0, cursor: 'pointer' }}>
                Exibir chaves de posição na página «Posições» e permitir agendar rodadas de posição
              </label>
            </div>
            <div className="helper">
              Desligado: o menu «Posições» some e a página pública fica sem as mini-chaves. No admin, a área «Posições» e os horários por rodada das posições continuam disponíveis.
            </div>
          </div>

          {visibleRounds.length > 0 && (
            <div className="stack">
              <div className="helper">Programe a rodada inteira aqui.</div>
              <div className="round-schedule-list">
                {visibleRounds.map(r => (
                  <div key={r.scheduleKey} className="round-schedule-item">
                    <div>
                      <strong>{r.label}</strong>
                      <div className="helper">Mesmo horário para todos os jogos desta rodada (mesmo scheduleKey), inclusive antes de existirem confrontos definidos.</div>
                    </div>
                    <input
                      type="datetime-local"
                      className="input"
                      value={r.value}
                      onChange={e => setRoundDefault(category.id, r.scheduleKey, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label className="label">Impressão de programação do dia</label>
            <div className="helper">
              Gera uma folha única com jogos de todas as categorias para a data escolhida.
            </div>
            <div className="footer-actions" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="date"
                className="input"
                style={{ maxWidth: 220 }}
                value={programacaoDate}
                onChange={e => setProgramacaoDate(e.target.value)}
              />
              <button type="button" className="btn secondary" onClick={handlePrintProgramacaoDia}>
                Imprimir programação do dia
              </button>
            </div>
          </div>

          <div className="footer-actions">
            <button className="btn secondary" onClick={exportBackup}>Exportar backup</button>
            <label className="btn ghost" style={{ cursor: 'pointer' }}>
              Importar backup
              <input type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImport} />
            </label>
            <button className="btn danger" onClick={() => { if (confirm('Tem certeza que deseja resetar o sistema local?')) resetAll(); }}>Resetar tudo</button>
          </div>
        </div>
      )}

      {ui.adminPanel === 'clubes' && (
        <div className="stack">
          <h3>Clubes</h3>
          <div className="helper">
            A lista oficial de clubes vem sempre do n8n (webhook «select_club» / MySQL): ao abrir o site, ao voltar a este separador no browser e ao abrir esta aba. Em seguida a app pede ao «chave» só a categoria 40+; nas outras abas, cada mudança de separador recarrega essa categoria. Vagas de sorteio com id que não exista na base ficam em branco. Se a resposta incluir metadados do evento (objeto «event» com «title», «local», «arbitroGeral» ou campos planos «event_title», «event_local», «event_arbitro_geral» / «nome_evento»), a topbar passa a usar esses valores.
          </div>
          <div className="footer-actions" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn secondary" disabled={clubsRemoteLoading} onClick={() => void loadClubsFromServer()}>
              {clubsRemoteLoading ? 'Carregando…' : 'Atualizar do servidor'}
            </button>
          </div>
          {clubsRemoteError && (
            <div className="error" role="alert">{clubsRemoteError}</div>
          )}
          <div className="helper">Cadastro local (opcional): adicione clube só neste navegador; não grava no MySQL.</div>
          <div className="field">
            <label className="label">Nome do clube</label>
            <input ref={clubNameRef} className="input" placeholder="Ex.: IATE CLUBE" />
          </div>
          <div className="field">
            <label className="label">Bandeira do clube</label>
            <input ref={clubFlagRef} type="file" accept="image/*" className="input" />
          </div>
          <button className="btn" onClick={handleAddClub}>Adicionar clube</button>
          <div className="stack">
            {state.clubs.map(club => (
              <div key={club.id} className="club-item">
                <ClubFlagMedia flag={club.flag} name={club.name} boxClassName="flag large" />
                <div className="name">
                  <strong>{club.name}</strong>
                  <div className="helper">Cadastro central</div>
                </div>
                <button className="btn secondary small" onClick={() => {
                  const newName = prompt('Nome do clube:', club.name);
                  if (newName !== null) editClub(club.id, newName);
                }}>Renomear</button>
                <label className="btn ghost small upload-btn">
                  Bandeira
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const flag = await fileToDataUrl(file);
                      changeClubFlag(club.id, flag);
                    } catch { alert('Não foi possível carregar a imagem.'); }
                  }} />
                </label>
                <button className="btn danger small" onClick={() => { if (confirm('Remover clube do cadastro?')) removeClub(club.id); }}>Remover</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {ui.adminPanel === 'categoria' && (
        <div className="stack">
          <h3>Categoria</h3>
          <div className="helper">
            Nesta categoria, você só resgata clubes do cadastro central.
            «Definir clube…» são vagas do sorteio; «BYE (fixo na chave)» reproduce o tamanho da chave (quantidade de clubes que você definiu). Cada clube só pode ocupar uma posição — não é possível repetir o mesmo time na categoria (evita enfrentar a si mesmo).
          </div>
          <div className="helper">
            Altere as posições livremente e use «Enviar posições da chave» no final para gravar tudo de uma vez.
          </div>
          <div className="field">
            <label className="label">Categoria em edição</label>
            <input className="input" disabled value={category.name} />
          </div>
          {categorySeedsDirty && (
            <div className="admin-pending-notice" role="status" aria-live="polite">
              <strong>Alterações pendentes</strong> — a chave ainda não foi enviada ao servidor. Preencha as posições
              e clique em «Enviar posições da chave» ou desfaça.
            </div>
          )}
          <div className="slot-grid">
            {Array.from({ length: category.slots }).map((_, idx) => {
              const raw = categoryDraftSeeds[idx];
              const isFixedBye = raw === null;
              const clubId = typeof raw === 'string' ? raw : '';
              return (
                <div key={idx} className="slot-item">
                  <div className="name">Posição {idx + 1}</div>
                  {isFixedBye ? (
                    <select className="select" disabled value="__fixed_bye__">
                      <option value="__fixed_bye__">BYE (fixo na chave)</option>
                    </select>
                  ) : (
                    <select
                      className="select"
                      value={clubId}
                      onChange={e => handleDraftSlotChange(idx, e.target.value)}
                    >
                      <option value="">Definir clube…</option>
                      {state.clubs.map(club => {
                        const usedElsewhere = categoryDraftSeeds.some(
                          (seed, si) => si !== idx && typeof seed === 'string' && seed === club.id
                        );
                        const disabled = usedElsewhere && club.id !== clubId;
                        return (
                          <option key={club.id} value={club.id} disabled={disabled}>
                            {club.name}
                            {disabled ? ' (outra posição)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                  {slotR1GameByIndex.has(idx) && (
                    <div className="helper">Jogo {slotR1GameByIndex.get(idx)}</div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="footer-actions">
            <button
              type="button"
              className="btn"
              disabled={categorySaveBusy || !categorySeedsDirty}
              onClick={() => void handleSaveCategorySeeds()}
            >
              {categorySaveBusy ? 'Enviando…' : 'Enviar posições da chave'}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={categorySaveBusy || !categorySeedsDirty}
              onClick={handleDiscardCategoryDraft}
            >
              Desfazer alterações
            </button>
          </div>
          {categorySaveError && (
            <div className="error" role="alert">{categorySaveError}</div>
          )}
          {categorySaveOk && (
            <div className="helper">{categorySaveOk}</div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminCanvas() {
  const { state, ui, getCategory, selectMatch, openMatchModal } = useTournament();
  const category = getCategory(ui.categoryId);
  const struct = evaluateStructure(category, state.clubs);
  const bNinthPlayoffBlock =
    category.id === 'b'
      ? struct.placementBlocks.find(b => b.key.includes('place-b9-playoff'))
      : undefined;
  const c911PlayoffBlock =
    category.id === 'c' || category.id === '40+'
      ? struct.placementBlocks.find(b => b.key.includes('place-c9-11-playoff'))
      : undefined;
  const mini912TwelveClubBlock = categoryHasTwelveClubNineToTwelvePlayoff(category.id)
    ? struct.placementBlocks.find(b => b.key.includes('place-d9-12-playoff'))
    : undefined;
  const sub12FiveSixBlock =
    category.id === 'sub-12' || category.id === 'sub-16'
      ? struct.placementBlocks.find(b => b.key.includes(`place-${category.id}-5-8-playoff`))
      : undefined;
  const filteredPlacementBlocks = struct.placementBlocks.filter(
    b =>
      b.startPlace >= 3 &&
      !(bNinthPlayoffBlock && b.key === bNinthPlayoffBlock.key) &&
      !(c911PlayoffBlock && b.key === c911PlayoffBlock.key) &&
      !(mini912TwelveClubBlock && b.key === mini912TwelveClubBlock.key) &&
      !(sub12FiveSixBlock && b.key === sub12FiveSixBlock.key)
  );
  const printedAt = new Date().toLocaleString('pt-BR');
  const seededClubs = countRealSeeds(category.seeds);
  const mainBracketPrintGte8 = seededClubs >= 8;

  const handleMatchClick = (matchId: string) => {
    selectMatch(matchId);
    openMatchModal();
  };

  return (
    <div className={`card panel canvas-panel ${ui.adminMode === 'main' ? 'admin-print-main' : 'admin-print-disputes'}`}>
      <div className="canvas-head">
        <div>
          <h3>Chave desenhada · {category.name}</h3>
          <div className="helper">
            {ui.adminMode === 'main'
              ? 'Chaves (título). Clique no confronto para registrar resultado.'
              : 'Chave de posições. Clique no confronto para data, horário e resultado.'}
          </div>
        </div>
        <div className="canvas-badges">
          <span className="mini-badge">{ui.adminMode === 'main' ? 'Chaves' : 'Posições'}</span>
          <span className="mini-badge">{seededClubs} clubes</span>
        </div>
      </div>

      {ui.adminMode === 'main' ? (
        <>
          <div className="admin-print-sheet1-main">
            <div className="print-header">
              <div className="print-event-title">{state.event.title}</div>
              <div className="print-header-grid print-header-grid--primary">
                <div><strong>LOCAL</strong> {state.event.local}</div>
                <div><strong>ÁRBITRO GERAL</strong> {state.event.arbitroGeral}</div>
              </div>
              <div className="print-header-meta">
                <span>
                  <strong>CATEGORIA</strong> {category.name}
                </span>
                <span>
                  <strong>IMPRESSO</strong> {printedAt}
                </span>
              </div>
            </div>
            <div className={`bracket-box main${mainBracketPrintGte8 ? ' bracket-print-gte8' : ''}`}>
              <BracketView
                rounds={struct.mainRounds}
                kind="main"
                scopeKey="main"
                finalTitle="Campeão da categoria"
                isAdmin
                selectedMatchId={ui.selectedMatchId}
                onMatchClick={handleMatchClick}
              />
            </div>
          </div>
          <div className="admin-print-after-main">
            {struct.directPlacesFromR1Playables !== undefined && (
              <DirectNinthPlaceCard
                matches={struct.directPlacesFromR1Playables}
                clubs={state.clubs}
                isAdmin
                selectedMatchId={ui.selectedMatchId}
                onDefiningMatchClick={handleMatchClick}
              />
            )}
            {bNinthPlayoffBlock && (
              <BlockView
                block={bNinthPlayoffBlock}
                isAdmin
                selectedMatchId={ui.selectedMatchId}
                onMatchClick={handleMatchClick}
              />
            )}
            {c911PlayoffBlock && (
              <BlockView
                block={c911PlayoffBlock}
                isAdmin
                selectedMatchId={ui.selectedMatchId}
                onMatchClick={handleMatchClick}
              />
            )}
            {mini912TwelveClubBlock && (
              <BlockView
                block={mini912TwelveClubBlock}
                isAdmin
                selectedMatchId={ui.selectedMatchId}
                onMatchClick={handleMatchClick}
              />
            )}
            {sub12FiveSixBlock && (
              <BlockView
                block={sub12FiveSixBlock}
                isAdmin
                selectedMatchId={ui.selectedMatchId}
                onMatchClick={handleMatchClick}
              />
            )}
            {!ui.showPlacementBrackets &&
              filteredPlacementBlocks.map(block => (
                <BlockView
                  key={block.key}
                  block={block}
                  isAdmin
                  selectedMatchId={ui.selectedMatchId}
                  onMatchClick={handleMatchClick}
                />
              ))}
          </div>
        </>
      ) : (
        <>
          <div className="print-header">
            <div className="print-event-title">{state.event.title}</div>
            <div className="print-header-grid print-header-grid--primary">
              <div><strong>LOCAL</strong> {state.event.local}</div>
              <div><strong>ÁRBITRO GERAL</strong> {state.event.arbitroGeral}</div>
            </div>
            <div className="print-header-meta">
              <span>
                <strong>CATEGORIA</strong> {category.name}
              </span>
              <span>
                <strong>IMPRESSO</strong> {printedAt}
              </span>
            </div>
          </div>
          {!ui.showPlacementBrackets && (
            <p className="helper" style={{ marginBottom: 8 }}>
              Página pública «Posições» oculta: visitantes não veem o separador «Posições». Aqui a chave segue disponível para agenda e resultados.
            </p>
          )}
          {bNinthPlayoffBlock && (
            <BlockView
              block={bNinthPlayoffBlock}
              isAdmin
              selectedMatchId={ui.selectedMatchId}
              onMatchClick={handleMatchClick}
            />
          )}
          {c911PlayoffBlock && (
            <BlockView
              block={c911PlayoffBlock}
              isAdmin
              selectedMatchId={ui.selectedMatchId}
              onMatchClick={handleMatchClick}
            />
          )}
          {mini912TwelveClubBlock && (
            <BlockView
              block={mini912TwelveClubBlock}
              isAdmin
              selectedMatchId={ui.selectedMatchId}
              onMatchClick={handleMatchClick}
            />
          )}
          {sub12FiveSixBlock && (
            <BlockView
              block={sub12FiveSixBlock}
              isAdmin
              selectedMatchId={ui.selectedMatchId}
              onMatchClick={handleMatchClick}
            />
          )}
          {filteredPlacementBlocks.length > 0 ? (
            filteredPlacementBlocks.map(block => (
              <BlockView
                key={block.key}
                block={block}
                isAdmin
                selectedMatchId={ui.selectedMatchId}
                onMatchClick={handleMatchClick}
              />
            ))
          ) : !bNinthPlayoffBlock && !c911PlayoffBlock && !mini912TwelveClubBlock && !sub12FiveSixBlock ? (
            <p className="helper">
              Ainda não há mini-chaves de posição nesta categoria. Confirme o sorteio e os clubes em cada vaga.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export function AdminPage() {
  return (
    <div className="page">
      <div className="admin-layout">
        <AdminSidebar />
        <AdminCanvas />
      </div>
    </div>
  );
}
