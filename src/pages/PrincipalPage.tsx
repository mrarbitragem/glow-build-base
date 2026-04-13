import { useTournament } from '@/context/TournamentContext';
import { evaluateStructure, countRealSeeds } from '@/utils/bracketEngine';
import { BracketView } from '@/components/BracketView';
import { ClassificationTable } from '@/components/ClassificationTable';

export function PrincipalPage() {
  const { state, ui, getCategory } = useTournament();
  const category = getCategory(ui.categoryId);
  const struct = evaluateStructure(category, state.clubs);
  const realClubs = countRealSeeds(category.seeds);

  return (
    <div className="page">
      <div className="hero card main">
        <div>
          <span className="badge main">Chave principal</span>
          <h1>{state.event.title} · {category.name}</h1>
          <div className="meta">{state.event.local} · Árbitro Geral: {state.event.arbitroGeral}</div>
        </div>
        <div className="grid-stats grid-stats-single">
          <div className="stat"><small>Clubes na categoria</small><strong>{realClubs}</strong></div>
        </div>
      </div>

      <div className="section-head">
        <div>
          <div className="section-title">Chave principal</div>
          <div className="section-sub">A numeração JOGO considera apenas confrontos reais. Jogos com BYE não exibem código nem agenda.</div>
        </div>
      </div>

      <div className="bracket-box main">
        <BracketView
          rounds={struct.mainRounds}
          kind="main"
          scopeKey="main"
          finalTitle="Campeão da categoria"
        />
      </div>

      <ClassificationTable category={category} clubs={state.clubs} />
    </div>
  );
}
