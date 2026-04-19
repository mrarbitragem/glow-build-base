import { Category, Club } from '@/types/tournament';
import { getComputedClassification, countRealSeeds } from '@/utils/bracketEngine';
import { INITIAL_DATA } from '@/data/initialData';

interface Props {
  category: Category;
  clubs: Club[];
}

export function ClassificationTable({ category, clubs }: Props) {
  const rows = getComputedClassification(category, clubs);
  const rowMap = new Map(rows.map(r => [r.place, r]));
  const totalPlaces = countRealSeeds(category.seeds);

  if (!totalPlaces) return null;

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
            const points = INITIAL_DATA.pointsByPlace[String(place)] || '';
            return (
              <tr key={place}>
                <td className="num">{place}º</td>
                <td>{row ? row.name : ''}</td>
                <td>{row ? points : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
