import { useTournament } from '@/context/TournamentContext';
import { evaluateStructure, countRealSeeds } from '@/utils/bracketEngine';
import { BlockView } from '@/components/BracketView';
import { ClassificationTable } from '@/components/ClassificationTable';

export function DisputasPage() {
  const { state, ui, getCategory } = useTournament();
  const category = getCategory(ui.categoryId);
  const struct = evaluateStructure(category, state.clubs);
  const blocks = struct.placementBlocks.filter(b => b.startPlace >= 3);

  return (
    <div className="page">
      <div className="hero card dispute">
        <div>
          <span className="badge dispute">Disputa de posições</span>
          <h1>Categoria {category.name}</h1>
          <div className="meta">Blocos de definição de posições organizados conforme o tamanho real de cada chave.</div>
        </div>
        <div className="grid-stats grid-stats-single">
          <div className="stat"><small>Clubes na categoria</small><strong>{countRealSeeds(category.seeds)}</strong></div>
        </div>
      </div>

      {blocks.map(block => (
        <BlockView key={block.key} block={block} />
      ))}

      <ClassificationTable category={category} clubs={state.clubs} />
    </div>
  );
}
