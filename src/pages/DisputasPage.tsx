import { useTournament } from '@/context/TournamentContext';
import { evaluateStructure, countRealSeeds, categorySkipsNineThroughSixteenPlacement } from '@/utils/bracketEngine';
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
          <span className="badge dispute">Chave de posições</span>
          <h1>Categoria {category.name}</h1>
          {ui.showPlacementBrackets && (
            <p className="helper dispute-intro">
              {categorySkipsNineThroughSixteenPlacement(category.id) ? (
                category.id === 'b' ? (
                  <>
                    Na categoria <strong>B</strong>, o bloco <strong>9º e 10º</strong> segue o mesmo critério das outras
                    colocações (perdedores da chave principal). Não há mini-chave de 9º a 16º; mantém-se a disputa de{' '}
                    <strong>5º a 8º</strong> entre perdedores das quartas, e as faixas acima conforme a chave.
                  </>
                ) : category.id === 'c' || category.id === '40+' ? (
                  <>
                    Na categoria <strong>{category.name}</strong> (11 clubes), o bloco <strong>9º ao 11º</strong> usa os
                    três primeiros jogos jogáveis da 1ª rodada da chave principal como <strong>JOGO1</strong>,{' '}
                    <strong>JOGO2</strong> e <strong>JOGO3</strong>. Na 1ª rodada da mini-chave, o perdedor do JOGO1 entra
                    contra <strong>BYE</strong> e <strong>avança para a 2ª rodada</strong>; o perdedor do JOGO2 defronta o
                    perdedor do JOGO3. O <strong>11º lugar</strong> é o <strong>perdedor do jogo 11</strong>. Não há
                    mini-chave geral de 9º a 16º na R1 da principal; mantém-se <strong>5º a 8º</strong> entre perdedores das
                    quartas, e as faixas acima.
                  </>
                ) : (
                  <>
                    Nesta categoria (9 clubes em chave de 16), o <strong>9º lugar</strong> é o perdedor do{' '}
                    <strong>primeiro jogo jogável da 1ª rodada</strong> (o que recebe «JOGO1» na ordem da tabela). Não
                    há mini-chave de 9º a 16º; mantém-se a disputa de <strong>5º a 8º</strong> entre perdedores das
                    quartas, e as faixas acima conforme a chave.
                  </>
                )
              ) : (
                <>
                  Cada bloco reúne perdedores de uma fase da chave principal; definem as faixas de classificação (por
                  exemplo 5º ao 8º ou 9º ao 12º).
                </>
              )}
            </p>
          )}
        </div>
        <div className="grid-stats grid-stats-single">
          <div className="stat"><small>Clubes na categoria</small><strong>{countRealSeeds(category.seeds)}</strong></div>
        </div>
      </div>

      {!ui.showPlacementBrackets ? (
        <div className="card panel empty-positions-hint">
          <p className="helper">
            {ui.isAdmin
              ? 'A publicação dedicada a «Posições» está desligada. Para editar agenda e resultados use Admin → área «Posições» ou «Chaves» (bloco de posições quando a opção está desligada). Ative em Admin → Operação se quiser esta página pública também.'
              : 'A chave de posições está no menu «Chaves», abaixo da chave principal.'}
          </p>
        </div>
      ) : blocks.length > 0 ? (
        blocks.map(block => (
          <BlockView key={block.key} block={block} />
        ))
      ) : (
        <div className="card panel empty-positions-hint">
          <p className="helper">
            Ainda não há mini-chaves de posição nesta categoria. Confirme o sorteio e os clubes em cada vaga.
          </p>
        </div>
      )}

      <ClassificationTable category={category} clubs={state.clubs} />
    </div>
  );
}
