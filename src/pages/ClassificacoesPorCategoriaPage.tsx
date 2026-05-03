import { useTournament } from '@/context/TournamentContext';
import { ClassificationTable } from '@/components/ClassificationTable';
import { PrintPageHeader } from '@/components/PrintPageHeader';
import { PartialClassificationNotice } from '@/components/PartialClassificationNotice';
import { countRealSeeds, getComputedClassification } from '@/utils/bracketEngine';

export function ClassificacoesPorCategoriaPage() {
  const { state, getCategory } = useTournament();

  return (
    <div className="page page-classificacoes-por-categoria">
      <PrintPageHeader
        event={state.event}
        categoryLabel="Todas as categorias — posições e pontos"
      />
      <div className="hero card main">
        <div>
          <span className="badge main">Por categoria</span>
          <h1>Classificação em cada categoria</h1>
        </div>
        <div className="grid-stats grid-stats-single">
          <div className="stat">
            <small>Categorias</small>
            <strong>{state.categoryOrder.length}</strong>
          </div>
        </div>
      </div>

      <PartialClassificationNotice />

      <div className="stack classificacoes-por-categoria-list">
        {state.categoryOrder.map(id => {
          const category = getCategory(id);
          const totalPlaces = countRealSeeds(category.seeds);
          const rows = getComputedClassification(category, state.clubs);
          const hasData = totalPlaces > 0 && rows.length > 0;

          return (
            <section key={id} className="classificacoes-categoria-section">
              <h2 className="classificacoes-categoria-title">Categoria {category.name}</h2>
              {hasData ? (
                <ClassificationTable
                  category={category}
                  clubs={state.clubs}
                  heading="Posições e pontos"
                />
              ) : (
                <p className="helper">
                  Ainda não há classificação nesta categoria (sorteio ou resultados em falta).
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
