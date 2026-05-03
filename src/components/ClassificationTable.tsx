import { Category, Club } from '@/types/tournament';
import {
  getComputedClassification,
  countRealSeeds,
  getEffectivePointsForPlacedClub,
  isClubDisqualifiedInCategory,
} from '@/utils/bracketEngine';
import { useTournament } from '@/context/TournamentContext';

interface Props {
  category: Category;
  clubs: Club[];
  /** Título da secção (ex.: impressão logo após a chave principal). */
  heading?: string;
}

export function ClassificationTable({ category, clubs, heading = 'Classificação da categoria' }: Props) {
  const { state } = useTournament();
  const rows = getComputedClassification(category, clubs);
  const rowMap = new Map(rows.map(r => [r.place, r]));
  const totalPlaces = countRealSeeds(category.seeds);
  const overrideMap = state.categoryClubPointsOverride?.[category.id];

  if (!totalPlaces || rows.length === 0) return null;

  return (
    <div className="classification">
      <h3>{heading}</h3>
      <table className="table">
        <thead>
          <tr><th>Posição</th><th>Clube</th><th>Pontos</th></tr>
        </thead>
        <tbody>
          {Array.from({ length: totalPlaces }, (_, index) => {
            const place = index + 1;
            const row = rowMap.get(place);
            const dq = !!(row && isClubDisqualifiedInCategory(state, category.id, row.clubId));
            const hasOverride = !!(
              row &&
              overrideMap &&
              Object.prototype.hasOwnProperty.call(overrideMap, row.clubId)
            );
            const eff = row ? getEffectivePointsForPlacedClub(state, category.id, row.clubId, place) : 0;
            const pointsCell = (() => {
              if (!row) return '';
              if (dq) return 'Desclassificado';
              if (hasOverride) return `${eff} (aj.)`;
              if (eff > 0) return String(eff);
              return '0';
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
