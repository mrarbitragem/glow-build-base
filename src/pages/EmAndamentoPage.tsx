import { useMemo, useEffect, useState } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { evaluateStructure, collectMatches, visibleMatchCode } from '@/utils/bracketEngine';
import { ClubFlagMedia } from '@/components/ClubFlagMedia';
import type { EvaluatedMatch } from '@/types/tournament';

type LiveRow = { categoryId: string; categoryName: string; match: EvaluatedMatch };

export function EmAndamentoPage() {
  const { state, ui, reloadChaveFromServer } = useTournament();
  const [now, setNow] = useState(() => new Date());

  /** Ao abrir «Em Andamento», funde `matchResults` do servidor em todas as categorias (não só a do separador). */
  useEffect(() => {
    if (ui.page !== 'emAndamento') return;
    const order =
      state.categoryOrder?.length > 0 ? state.categoryOrder : state.categories.map(c => c.id);
    let cancelled = false;
    void (async () => {
      for (const cid of order) {
        if (cancelled) return;
        try {
          await reloadChaveFromServer(cid);
        } catch {
          /* rede / 404: mantém estado local */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ui.page, reloadChaveFromServer]);

  useEffect(() => {
    if (ui.page !== 'emAndamento') return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [ui.page]);

  const liveRows = useMemo((): LiveRow[] => {
    const order =
      state.categoryOrder?.length > 0 ? state.categoryOrder : state.categories.map(c => c.id);
    const rows: LiveRow[] = [];
    for (const cid of order) {
      const cat = state.categories.find(c => c.id === cid);
      if (!cat) continue;
      const struct = evaluateStructure(cat, state.clubs);
      const all: EvaluatedMatch[] = [...struct.mainRounds.flat()];
      struct.placementBlocks.forEach(block => collectMatches(block, all));
      for (const m of all) {
        // Não exigir `playable`: jogo pode estar «ao vivo» antes dos dois lados estarem definidos na chave.
        if (m.saved.inProgress) {
          rows.push({ categoryId: cat.id, categoryName: cat.name, match: m });
        }
      }
    }
    return rows;
  }, [state.categories, state.categoryOrder, state.clubs]);

  return (
    <div className="page">
      <div className="hero card em-andamento-hero">
        <div>
          <span className="badge em-andamento">Em andamento</span>
          <h1>Jogos em andamento</h1>
          <p className="helper em-andamento-intro">
            Jogos em curso em <strong>todas as categorias</strong>, com a respectiva quadra.
          </p>
        </div>
        <div className="live-now-clock" aria-live="polite">
          {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {liveRows.length === 0 ? (
        <div className="card panel empty-positions-hint">
          <p className="helper">
            Nenhum jogo em andamento em nenhuma categoria.
          </p>
        </div>
      ) : (
        <div className="live-match-list">
          {liveRows.map(({ categoryId, categoryName, match: m }) => {
            const code = visibleMatchCode(m);
            const scopeLabel = m.scope === 'main' ? 'Chave principal' : 'Chave de posições';
            return (
              <div key={`${categoryId}-${m.id}`} className="card panel live-match-card">
                <div className="live-match-category">{categoryName}</div>
                <div className="live-match-kicker">{scopeLabel}</div>
                {code ? <div className="live-match-code">{code}</div> : null}
                <div className="live-match-teams">
                  <div className="live-team">
                    <ClubFlagMedia flag={m.left.flag} name={m.left.name} boxClassName="flag" />
                    <span className="live-team-name">{m.left.name}</span>
                  </div>
                  <span className="live-vs">x</span>
                  <div className="live-team">
                    <ClubFlagMedia flag={m.right.flag} name={m.right.name} boxClassName="flag" />
                    <span className="live-team-name">{m.right.name}</span>
                  </div>
                </div>
                <div className="live-court-row">
                  <span className="live-court-label">Quadra</span>
                  <strong className="live-court-value">{m.saved.court?.trim() ? m.saved.court.trim() : '—'}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
