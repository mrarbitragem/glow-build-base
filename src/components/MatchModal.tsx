import { useTournament } from '@/context/TournamentContext';
import { EvaluatedMatch } from '@/types/tournament';
import { evaluateStructure, collectMatches, visibleMatchCode, scheduleLabel } from '@/utils/bracketEngine';

export function MatchModal() {
  const { state, ui, closeMatchModal, setMatchPatch, clearMatch, setRoundDefault, getCategory } = useTournament();

  if (ui.page !== 'admin' || !ui.matchModalOpen) return null;

  const category = getCategory(ui.categoryId);
  const struct = evaluateStructure(category, state.clubs);
  const all: EvaluatedMatch[] = [...struct.mainRounds.flat()];
  struct.placementBlocks.forEach(block => collectMatches(block, all));
  const match = all.find(m => m.id === ui.selectedMatchId);

  if (!match || !match.playable) return null;

  const saved = match.saved;
  const titleCode = visibleMatchCode(match);
  const title = `${titleCode ? `${titleCode} · ` : ''}${match.left.name} x ${match.right.name}`;

  return (
    <div className="modal-backdrop" onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal-backdrop')) closeMatchModal();
    }}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-kicker">{match.scope === 'main' ? 'Chaves' : 'Chave de posições'}</div>
            <h3>{title}</h3>
          </div>
          <button className="icon-btn" onClick={closeMatchModal}>×</button>
        </div>
        <div className="stack">
          <div className="field">
            <label className="label">Horário padrão da rodada ({scheduleLabel(match)})</label>
            <input
              type="datetime-local"
              className="input"
              value={category.roundDefaults[match.scheduleKey] || ''}
              onChange={e => setRoundDefault(category.id, match.scheduleKey, e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Horário específico do confronto</label>
            <input
              type="datetime-local"
              className="input"
              value={saved.datetime || ''}
              onChange={e => setMatchPatch(category.id, match.id, { datetime: e.target.value })}
            />
          </div>
          <div className="row">
            <div className="field">
              <label className="label">{match.left.name}</label>
              <input
                className="input"
                value={saved.score1}
                onChange={e => setMatchPatch(category.id, match.id, { score1: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="label">{match.right.name}</label>
              <input
                className="input"
                value={saved.score2}
                onChange={e => setMatchPatch(category.id, match.id, { score2: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label className="label">Vencedor</label>
            <select
              className="select"
              value={saved.winner}
              onChange={e => setMatchPatch(category.id, match.id, { winner: e.target.value })}
            >
              <option value="">Selecione</option>
              <option value="1">{match.left.name}</option>
              <option value="2">{match.right.name}</option>
            </select>
          </div>
          <div className="footer-actions">
            <button className="btn secondary" onClick={() => clearMatch(category.id, match.id)}>Limpar confronto</button>
            <button className="btn" onClick={closeMatchModal}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
