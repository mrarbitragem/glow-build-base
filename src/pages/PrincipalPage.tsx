import { useTournament } from '@/context/TournamentContext';
import { evaluateStructure, countRealSeeds, categoryHasTwelveClubNineToTwelvePlayoff } from '@/utils/bracketEngine';
import { BracketView, BlockView } from '@/components/BracketView';
import { DirectNinthPlaceCard } from '@/components/DirectNinthPlaceCard';
import { ClassificationTable } from '@/components/ClassificationTable';
import { PrintPageHeader } from '@/components/PrintPageHeader';

export function PrincipalPage() {
  const { state, ui, getCategory } = useTournament();
  const category = getCategory(ui.categoryId);
  const struct = evaluateStructure(category, state.clubs);
  const realClubs = countRealSeeds(category.seeds);
  const bNinthPlayoffBlock =
    category.id === 'b'
      ? struct.placementBlocks.find(b => b.key.includes('place-b9-playoff'))
      : undefined;
  const c911PlayoffBlock =
    category.id === 'c' || category.id === '40+'
      ? struct.placementBlocks.find(b => b.key.includes('place-c9-11-playoff'))
      : undefined;
  /** D, Iniciante e 50+: mesma mini 9º–12º (`place-d9-12-playoff` no prefixo interno). */
  const mini912TwelveClubBlock = categoryHasTwelveClubNineToTwelvePlayoff(category.id)
    ? struct.placementBlocks.find(b => b.key.includes('place-d9-12-playoff'))
    : undefined;
  const sub12FiveSixBlock =
    category.id === 'sub-12' || category.id === 'sub-16'
      ? struct.placementBlocks.find(b => b.key.includes(`place-${category.id}-5-8-playoff`))
      : undefined;
  const positionBlocks = struct.placementBlocks.filter(
    b =>
      b.startPlace >= 3 &&
      !(bNinthPlayoffBlock && b.key === bNinthPlayoffBlock.key) &&
      !(c911PlayoffBlock && b.key === c911PlayoffBlock.key) &&
      !(mini912TwelveClubBlock && b.key === mini912TwelveClubBlock.key) &&
      !(sub12FiveSixBlock && b.key === sub12FiveSixBlock.key)
  );
  const showPosUnderChaves = !ui.showPlacementBrackets;
  const mainBracketPrintGte8 = realClubs >= 8;

  return (
    <div className="page">
      <PrintPageHeader event={state.event} categoryLabel={category.name} />
      <div className="hero card main">
        <div>
          <span className="badge main">Chaves</span>
          <h1>Categoria {category.name}</h1>
        </div>
        <div className="grid-stats grid-stats-single">
          <div className="stat"><small>Clubes na categoria</small><strong>{realClubs}</strong></div>
        </div>
      </div>

      <div className="section-head">
        <div>
          <div className="section-title">Chave Principal</div>
        </div>
      </div>

      <div className={`bracket-box main${mainBracketPrintGte8 ? ' bracket-print-gte8' : ''}`}>
        <BracketView
          rounds={struct.mainRounds}
          kind="main"
          scopeKey="main"
          finalTitle="Campeão da categoria"
        />
      </div>

      {struct.directPlacesFromR1Playables !== undefined && (
        <DirectNinthPlaceCard matches={struct.directPlacesFromR1Playables} clubs={state.clubs} />
      )}

      {bNinthPlayoffBlock && <BlockView block={bNinthPlayoffBlock} />}

      {c911PlayoffBlock && <BlockView block={c911PlayoffBlock} />}

      {mini912TwelveClubBlock && <BlockView block={mini912TwelveClubBlock} />}

      {sub12FiveSixBlock && <BlockView block={sub12FiveSixBlock} />}

      {showPosUnderChaves && (
        <>
          <div className="section-head">
            <div>
              <div className="section-title">Chave de posições</div>
              <div className="section-sub">Disputas de colocação entre perdedores da chave de cima.</div>
            </div>
          </div>
          {positionBlocks.length > 0 ? (
            positionBlocks.map(block => <BlockView key={block.key} block={block} />)
          ) : (
            <div className="card panel empty-positions-hint">
              <p className="helper">
                As mini-chaves de posição passam a aparecer quando o sorteio e os clubes estiverem consistentes com o tamanho desta categoria.
              </p>
            </div>
          )}
        </>
      )}

      <ClassificationTable category={category} clubs={state.clubs} />
    </div>
  );
}
