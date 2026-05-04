import { useTournament } from '@/context/TournamentContext';
import { getOverallRows, isClubDisqualifiedInCategory } from '@/utils/bracketEngine';
import { PartialClassificationNotice } from '@/components/PartialClassificationNotice';

export function GeralPage() {
  const { state, getCategory } = useTournament();
  const rows = getOverallRows(state);
  const hasPoints = rows.some(r => r.total > 0);

  return (
    <div className="page page-classificacao-geral">
      <div className="hero card main">
        <div>
          <span className="badge main">Classificação geral</span>
          <h1>Pontuação geral dos clubes</h1>
        </div>
        <div className="grid-stats">
          <div className="stat"><small>Clubes cadastrados</small><strong>{rows.length}</strong></div>
          <div className="stat"><small>Clubes pontuando</small><strong>{rows.filter(r => r.total > 0).length}</strong></div>
          <div className="stat"><small>Pontos do 1º lugar</small><strong>{state.pointsByPlace['1']}</strong></div>
        </div>
      </div>

      <PartialClassificationNotice />

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
                <tr key={row.clubId} className={idx < 3 ? `podium podium-${idx + 1}` : ''}>
                  <td className="num">{idx + 1}º</td>
                  <td>{row.name}</td>
                  {state.categoryOrder.map(id => (
                    <td key={id}>
                      {isClubDisqualifiedInCategory(state, id, row.clubId)
                        ? 'Desclassif.'
                        : row.perCat[id] !== undefined
                          ? row.perCat[id]
                          : ''}
                    </td>
                  ))}
                  <td><strong>{row.total || ''}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="classification-congrats">
        Parabéns a todos os clubes e atletas participantes pelo empenho, respeito e espírito
        desportivo demonstrados ao longo da competição.
      </div>
    </div>
  );
}
