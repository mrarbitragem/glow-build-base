import { useTournament } from '@/context/TournamentContext';
import { getOverallRows } from '@/utils/bracketEngine';
import { INITIAL_DATA } from '@/data/initialData';

export function GeralPage() {
  const { state, getCategory } = useTournament();
  const rows = getOverallRows(state);
  const hasPoints = rows.some(r => r.total > 0);

  return (
    <div className="page">
      <div className="hero card main">
        <div>
          <span className="badge main">Classificação geral</span>
          <h1>Pontuação geral dos clubes</h1>
        </div>
        <div className="grid-stats">
          <div className="stat"><small>Clubes cadastrados</small><strong>{rows.length}</strong></div>
          <div className="stat"><small>Clubes pontuando</small><strong>{rows.filter(r => r.total > 0).length}</strong></div>
          <div className="stat"><small>Pontos do 1º lugar</small><strong>{INITIAL_DATA.pointsByPlace['1']}</strong></div>
        </div>
      </div>

      <div className="card panel">
        {!hasPoints && <div className="empty-state" />}
        <div style={{ overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Pos.</th>
                <th>Clube</th>
                {state.categoryOrder.map(id => (
                  <th key={id}>{getCategory(id).name}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.clubId}>
                  <td className="num">{idx + 1}º</td>
                  <td>{row.name}</td>
                  {state.categoryOrder.map(id => (
                    <td key={id}>{row.perCat[id] || ''}</td>
                  ))}
                  <td><strong>{row.total || ''}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
