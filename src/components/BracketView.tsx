import { EvaluatedMatch, BlockResult } from '@/types/tournament';
import { bracketLayout } from '@/utils/bracketEngine';
import { formatDateTime } from '@/utils/helpers';
import { ClubFlagMedia } from '@/components/ClubFlagMedia';
import { visibleMatchCode } from '@/utils/bracketEngine';

interface BracketViewProps {
  rounds: EvaluatedMatch[][];
  kind: 'main' | 'dispute';
  scopeKey: string;
  finalTitle?: string;
  finalPlace?: number;
  isAdmin?: boolean;
  selectedMatchId?: string;
  onMatchClick?: (matchId: string) => void;
}

function RenderFlag({ entrant }: { entrant: { flag?: string; clubId?: string; name: string } }) {
  return <ClubFlagMedia flag={entrant.flag} name={entrant.name} boxClassName="flag" />;
}

function isWinnerPlaceholderName(name: string): boolean {
  return name.startsWith('Venc.');
}

/** Em impressão mostra «Aguardando» em vez de «Venc. M…». */
function PrintSwapVencName({ text }: { text: string }) {
  if (isWinnerPlaceholderName(text)) {
    return (
      <>
        <span className="team-name-screen">{text}</span>
        <span className="team-name-print-await">Aguardando</span>
      </>
    );
  }
  return <>{text}</>;
}

function TeamNameCell({
  name,
  dim,
  winner,
}: {
  name: string;
  dim: boolean;
  winner: boolean;
}) {
  const venc = isWinnerPlaceholderName(name);
  return (
    <div className={`team-name ${dim ? 'dim' : ''} ${winner ? 'winner' : ''}`}>
      {venc ? (
        <>
          <span className="team-name-screen">{name}</span>
          <span className="team-name-print-await">Aguardando</span>
        </>
      ) : (
        name
      )}
    </div>
  );
}

function MatchCardContent({ match }: { match: EvaluatedMatch }) {
  const leftWin = match.winnerChoice === '1';
  const rightWin = match.winnerChoice === '2';
  const codeLabel = visibleMatchCode(match);
  const dateLabel =
    match.playable && String(match.effectiveDate || '').trim()
      ? formatDateTime(match.effectiveDate)
      : '';
  const showFooter = !!match.playable || !!codeLabel.trim();

  return (
    <>
      <div className="team-line">
        <RenderFlag entrant={match.left} />
        <TeamNameCell name={match.left.name} dim={!match.left.clubId} winner={leftWin} />
        <div className={`score ${leftWin ? 'win' : ''}`}>
          {match.playable ? match.saved.score1 : ''}
        </div>
      </div>
      <div className="team-line">
        <RenderFlag entrant={match.right} />
        <TeamNameCell name={match.right.name} dim={!match.right.clubId} winner={rightWin} />
        <div className={`score ${rightWin ? 'win' : ''}`}>
          {match.playable ? match.saved.score2 : ''}
        </div>
      </div>
      {showFooter && (
        <div className="match-footer">
          <span className="match-code">{codeLabel}</span>
          <span className="match-date">{dateLabel}</span>
        </div>
      )}
    </>
  );
}

function Connectors({ rounds, layout }: { rounds: EvaluatedMatch[][]; layout: ReturnType<typeof bracketLayout> }) {
  const lines: React.ReactNode[] = [];
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((match, idx) => {
      const next = rounds[r + 1][Math.floor(idx / 2)];
      if (!next) return;
      const a = layout.positions[match.id];
      const b = layout.positions[next.id];
      const x1 = a.x + a.w;
      const xMid = x1 + layout.connW / 2;
      const y1 = a.cy;
      const y2 = b.cy;
      const x2 = b.x;
      const key = `${match.id}-${next.id}`;
      lines.push(
        <g key={key}>
          <line x1={x1} y1={y1} x2={xMid} y2={y1} stroke="#c9d6e3" strokeWidth={2} />
          <line x1={xMid} y1={y1} x2={xMid} y2={y2} stroke="#c9d6e3" strokeWidth={2} />
          <line x1={xMid} y1={y2} x2={x2} y2={y2} stroke="#c9d6e3" strokeWidth={2} />
        </g>
      );
    });
  }
  return <>{lines}</>;
}

export function BracketView({ rounds, kind, scopeKey, finalTitle, finalPlace, isAdmin, selectedMatchId, onMatchClick }: BracketViewProps) {
  if (!rounds || !rounds.length) {
    return <div className="empty-state">Sem confrontos para exibir nesta etapa.</div>;
  }

  const layout = bracketLayout(rounds);
  const matches = rounds.flat();
  const finalMatch = rounds[rounds.length - 1][0];
  const finalPos = layout.positions[finalMatch.id];

  const getClubName = (clubId: string) => {
    return finalMatch.winnerClubId ? (finalMatch.winnerChoice === '1' ? finalMatch.left.name : finalMatch.right.name) : 'Aguardando resultado';
  };

  const championName = finalMatch.winnerClubId ? getClubName(finalMatch.winnerClubId) : 'Aguardando resultado';
  const placementText = finalPlace ? `${finalPlace}º Lugar` : 'Campeão';
  const hasSecondaryPlace = kind === 'dispute' && !!finalPlace;
  const secondaryPlace = hasSecondaryPlace ? finalPlace + 1 : 0;
  const secondaryName = hasSecondaryPlace
    ? finalMatch.loserClubId
      ? finalMatch.winnerChoice === '1'
        ? finalMatch.right.name
        : finalMatch.left.name
      : 'Aguardando resultado'
    : '';

  return (
    <div className="bracket-inner" style={{ width: layout.width, height: layout.height }}>
      {/* Round labels */}
      <div className="round-labels">
        {rounds.map((round, r) => {
          const x = r * (layout.cardW + layout.connW);
          const label = round[0]?.roundLabel || `Rodada ${r + 1}`;
          return (
            <div key={r} className="round-label" style={{ left: x, width: layout.cardW }}>
              {label}
            </div>
          );
        })}
      </div>

      {/* SVG connectors */}
      <svg className="svg-layer" width={layout.width} height={layout.height}>
        <Connectors rounds={rounds} layout={layout} />
      </svg>

      {/* Match cards */}
      {matches.map(match => {
        const pos = layout.positions[match.id];
        const selected = selectedMatchId === match.id ? 'selected' : '';
        const clickable = isAdmin && match.playable ? 'clickable' : '';
        const auto = !match.playable ? 'auto' : '';
        return (
          <div
            key={match.id}
            className={`match-card ${clickable} ${selected} ${auto}`}
            style={{ left: pos.x, top: pos.y }}
            onClick={() => {
              if (isAdmin && match.playable && onMatchClick) {
                onMatchClick(match.id);
              }
            }}
          >
            <MatchCardContent match={match} />
          </div>
        );
      })}

      {/* Final box */}
      <div
        className={kind === 'dispute' ? 'final-box dispute' : 'final-box'}
        style={{ left: finalPos.x + layout.cardW + 52, top: finalPos.y - 6 }}
      >
        <div className="kicker">{finalTitle || 'Resultado final'}</div>
        <div className="champ">
          <PrintSwapVencName text={championName} />
        </div>
        <div className="place">{placementText}</div>
        {hasSecondaryPlace && (
          <div className="runner-up">
            <div className="runner-up-name">
              <PrintSwapVencName text={secondaryName} />
            </div>
            <div className="runner-up-place">{secondaryPlace}º Lugar</div>
          </div>
        )}
      </div>
    </div>
  );
}

interface BlockViewProps {
  block: BlockResult;
  isAdmin?: boolean;
  selectedMatchId?: string;
  onMatchClick?: (matchId: string) => void;
}

export function BlockView({ block, isAdmin, selectedMatchId, onMatchClick }: BlockViewProps) {
  if (block.singleRef) {
    const name = block.finalBox?.championName || 'Aguardando';
    return (
      <div className="bracket-section">
        <div className="block-title-strip">
          <strong>{block.title}</strong>
          <span>Posição definida automaticamente.</span>
        </div>
        <div className="classification">
          <table className="table">
            <tbody>
              <tr>
                <td className="num">{block.startPlace}º</td>
                <td>{name}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!block.rounds?.length) return null;

  return (
    <>
      <div className="bracket-section">
        <div className="block-title-strip">
          <strong>{block.title}</strong>
          <span>Colocação: perdedores da chave principal.</span>
        </div>
        <div className="bracket-box dispute">
          <BracketView
            rounds={block.rounds}
            kind="dispute"
            scopeKey={block.key}
            finalPlace={block.startPlace}
            finalTitle={block.title}
            isAdmin={isAdmin}
            selectedMatchId={selectedMatchId}
            onMatchClick={onMatchClick}
          />
        </div>
      </div>
      {block.footerPlacementFromMatch && (() => {
        const m = block.rounds.flat().find(x => x.id === block.footerPlacementFromMatch?.matchId);
        if (!m) return null;
        const loserName =
          m.loserClubId && (m.left.clubId === m.loserClubId ? m.left.name : m.right.clubId === m.loserClubId ? m.right.name : null);
        const place = block.footerPlacementFromMatch.place;
        return (
          <div className="bracket-section">
            <div className="block-title-strip">
              <strong>{place}º lugar</strong>
              <span>{block.footerPlacementFromMatch.subtitle}</span>
            </div>
            <div className="classification">
              <table className="table">
                <tbody>
                  <tr>
                    <td className="num">{place}º</td>
                    <td>{loserName || 'Aguardando resultado'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      {block.children.map(child => (
        <BlockView
          key={child.key}
          block={child}
          isAdmin={isAdmin}
          selectedMatchId={selectedMatchId}
          onMatchClick={onMatchClick}
        />
      ))}
    </>
  );
}
