import { Category, Club } from '@/types/tournament';
import { getComputedClassification, countRealSeeds, getEffectivePointsForPlacedClub } from '@/utils/bracketEngine';
import { useTournament } from '@/context/TournamentContext';

interface Props {
  category: Category;
  clubs: Club[];
}

export function ClassificationTable({ category, clubs }: Props) {
  const { state } = useTournament();
  const rows = getComputedClassification(category, clubs);
  const rowMap = new Map(rows.map(r => [r.place, r]));
  const totalPlaces = countRealSeeds(category.seeds);
  const overrideMap = state.categoryClubPointsOverride?.[category.id];

  if (!totalPlaces || rows.length === 0) return null;

  return (
    <div className="classification">
      <h3>Classificação da categoria</h3>
      <table className="table">
        <thead>
          <tr><th>Posição</th><th>Clube</th><th>Pontos</th></tr>
        </thead>
        <tbody>
          {Array.from({ length: totalPlaces }, (_, index) => {
            const place = index + 1;
            const row = rowMap.get(place);
            const hasOverride = !!(
              row &&
              overrideMap &&
              Object.prototype.hasOwnProperty.call(overrideMap, row.clubId)
            );
            const eff = row ? getEffectivePointsForPlacedClub(state, category.id, row.clubId, place) : 0;
            const pointsCell = (() => {
              if (!row) return '';
              if (!hasOverride && !eff) return '';
              return `${eff}${hasOverride ? ' (aj.)' : ''}`;
            })();
            return (
              <tr key={place}>
                <td className="num">{place}º</td>
                <td>{row ? row.name : ''}</td>
                <td>{pointsCell}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
