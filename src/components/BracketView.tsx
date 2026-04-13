import { EvaluatedMatch, BlockResult } from '@/types/tournament';
import { bracketLayout } from '@/utils/bracketEngine';
import { formatDateTime, initials } from '@/utils/helpers';
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
  const val = entrant.flag || '';
  if (val && val.startsWith('data:image')) {
    return (
      <div className="flag">
        <img src={val} alt={`Bandeira ${entrant.name}`} className="w-full h-full object-cover" />
      </div>
    );
  }
  if (val) {
    return <div className="flag">{val}</div>;
  }
  return <div className="flag placeholder">{initials(entrant.name)}</div>;
}

function MatchCardContent({ match }: { match: EvaluatedMatch }) {
  const leftWin = match.winnerChoice === '1';
  const rightWin = match.winnerChoice === '2';
  const showFooter = !!match.playable;
  const codeLabel = visibleMatchCode(match);
  const dateLabel = showFooter ? formatDateTime(match.effectiveDate) : '';

  return (
    <>
      <div className="team-line">
        <RenderFlag entrant={match.left} />
        <div className={`team-name ${!match.left.clubId ? 'dim' : ''} ${leftWin ? 'winner' : ''}`}>
          {match.left.name}
        </div>
        <div className={`score ${leftWin ? 'win' : ''}`}>
          {match.playable ? match.saved.score1 : ''}
        </div>
      </div>
      <div className="team-line">
        <RenderFlag entrant={match.right} />
        <div className={`team-name ${!match.right.clubId ? 'dim' : ''} ${rightWin ? 'winner' : ''}`}>
          {match.right.name}
        </div>
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
        <div className="champ">{championName}</div>
        <div className="place">{placementText}</div>
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

  const sub = block.startPlace >= 3 && block.startPlace < 9
    ? 'Confrontos de definição de posições'
    : 'Rodadas ajustadas conforme o tamanho real da chave';

  return (
    <>
      <div className="bracket-section">
        <div className="block-title-strip">
          <strong>{block.title}</strong>
          <span>{sub}</span>
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
