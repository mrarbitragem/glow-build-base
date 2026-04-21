import type { Club, EvaluatedMatch } from '@/types/tournament';
import { hasExplicitResult, visibleMatchCode } from '@/utils/bracketEngine';
import { ClubFlagMedia } from '@/components/ClubFlagMedia';

export interface DirectNinthPlaceCardProps {
  /** A, Sub 14 e 60+: um item (9º). Índice 0 → 9º; entradas `null` = ainda não há jogo jogável na R1. */
  matches: (EvaluatedMatch | null)[];
  clubs: Club[];
  isAdmin?: boolean;
  selectedMatchId?: string;
  onDefiningMatchClick?: (matchId: string) => void;
}

function loserEntrant(match: EvaluatedMatch, clubs: Club[]) {
  if (!match.loserClubId) return null;
  if (match.left.clubId && match.left.clubId === match.loserClubId) return match.left;
  if (match.right.clubId && match.right.clubId === match.loserClubId) return match.right;
  const club = clubs.find(c => c.id === match.loserClubId);
  if (club) return { name: club.name, flag: club.flag };
  return { name: match.loserClubId, flag: '' };
}

function PlaceSlot({
  place,
  match,
  clubs,
  isAdmin,
  selectedMatchId,
  onDefiningMatchClick,
}: {
  place: number;
  match: EvaluatedMatch | null;
  clubs: Club[];
  isAdmin?: boolean;
  selectedMatchId?: string;
  onDefiningMatchClick?: (matchId: string) => void;
}) {
  const jogo = match ? visibleMatchCode(match) : '';
  const resolved = !!(match && hasExplicitResult(match) && match.loserClubId);
  const loser = match && resolved ? loserEntrant(match, clubs) : null;
  const clickable = !!(isAdmin && match && onDefiningMatchClick);
  const active = !!(match && selectedMatchId && match.id === selectedMatchId);

  const open = () => {
    if (match && onDefiningMatchClick) onDefiningMatchClick(match.id);
  };

  const showNineClubStyle = place === 9;

  return (
    <div
      className={`ninth-place-body${clickable ? ' ninth-place-body--clickable' : ''}${active ? ' ninth-place-body--active' : ''}`}
      onClick={clickable ? open : undefined}
      onKeyDown={
        clickable
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
              }
            }
          : undefined
      }
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {clickable && (
        <p className="helper ninth-place-hint">
          Clique aqui para abrir o confronto do {place}º lugar e lançar ou alterar o resultado.
        </p>
      )}

      {!showNineClubStyle && (
        <div className="ninth-place-slot-head">
          <span className="helper ninth-place-slot-sub">
            {match
              ? `Perdedor do jogo 2${jogo ? ` (${jogo})` : ''}.`
              : 'Perdedor do jogo 2, quando existir na chave.'}
          </span>
        </div>
      )}

      {showNineClubStyle ? (
        <>
          {!match ? (
            <div className="ninth-place-status-row">
              <span className="ninth-place-status-place">9º</span>
              <span className="ninth-place-status-text">Aguardando resultado</span>
            </div>
          ) : resolved && loser ? (
            <div className="ninth-place-status-row ninth-place-status-row--resolved">
              <span className="ninth-place-status-place">9º</span>
              <div className="ninth-place-status-club">
                <ClubFlagMedia flag={loser.flag || ''} name={loser.name} boxClassName="flag" />
                <strong>{loser.name}</strong>
              </div>
            </div>
          ) : (
            <>
              <div className="ninth-place-status-row">
                <span className="ninth-place-status-place">9º</span>
                <span className="ninth-place-status-text">Aguardando resultado</span>
              </div>
              <div className="ninth-place-pair" aria-hidden={!match.playable}>
                <div className="ninth-place-pair-line">
                  <ClubFlagMedia flag={match.left.flag} name={match.left.name} boxClassName="flag" />
                  <span>{match.left.name}</span>
                </div>
                <div className="ninth-place-pair-line">
                  <ClubFlagMedia flag={match.right.flag} name={match.right.name} boxClassName="flag" />
                  <span>{match.right.name}</span>
                </div>
              </div>
            </>
          )}
        </>
      ) : !match ? (
        <p className="helper ninth-place-pending">
          Ainda não há confronto jogável para o jogo 2 na 1ª rodada.
        </p>
      ) : resolved && loser ? (
        <div className="classification ninth-place-classif">
          <table className="table">
            <tbody>
              <tr>
                <td className="num">{place}º</td>
                <td>
                  <div className="ninth-place-club-row">
                    <ClubFlagMedia flag={loser.flag || ''} name={loser.name} boxClassName="flag" />
                    <strong>{loser.name}</strong>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <p className="helper ninth-place-pending">
            Resultado pendente. O perdedor {jogo ? `de «${jogo}»` : 'deste confronto'} ficará em {place}º lugar.
          </p>
          <div className="ninth-place-pair" aria-hidden={!match.playable}>
            <div className="ninth-place-pair-line">
              <ClubFlagMedia flag={match.left.flag} name={match.left.name} boxClassName="flag" />
              <span>{match.left.name}</span>
            </div>
            <div className="ninth-place-pair-line">
              <ClubFlagMedia flag={match.right.flag} name={match.right.name} boxClassName="flag" />
              <span>{match.right.name}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function DirectNinthPlaceCard({
  matches,
  clubs,
  isAdmin,
  selectedMatchId,
  onDefiningMatchClick,
}: DirectNinthPlaceCardProps) {
  if (!matches.length) return null;

  return (
    <div className="bracket-section ninth-place-section">
      <div className="block-title-strip">
        <strong>9º lugar</strong>
        <span>Perdedor do jogo 1</span>
      </div>
      <div className="ninth-place-slots">
        {matches.map((m, i) => (
          <PlaceSlot
            key={i}
            place={9 + i}
            match={m}
            clubs={clubs}
            isAdmin={isAdmin}
            selectedMatchId={selectedMatchId}
            onDefiningMatchClick={onDefiningMatchClick}
          />
        ))}
      </div>
    </div>
  );
}
