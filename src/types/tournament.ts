export interface Club {
  id: string;
  name: string;
  flag: string;
}

export interface Category {
  id: string;
  name: string;
  slots: number;
  seeds: (string | null)[];
  importedPlacements: unknown[];
  roundDefaults: Record<string, string>;
  matchResults: Record<string, MatchState>;
}

export interface EventInfo {
  title: string;
  local: string;
  arbitroGeral: string;
}

export interface TournamentState {
  event: EventInfo;
  pointsByPlace: Record<string, number>;
  clubs: Club[];
  categories: Category[];
  categoryOrder: string[];
}

export interface MatchState {
  score1: string;
  score2: string;
  winner: string;
  datetime: string;
  /** Partida marcada como em curso (várias por categoria na página «Em Andamento»). */
  inProgress: boolean;
  /** Quadra onde o confronto ocorre (texto livre). */
  court: string;
}

export interface Entrant {
  type: 'club' | 'bye' | 'placeholder';
  clubId: string;
  name: string;
  flag: string;
  potential: number;
  bye: boolean;
  actual: boolean;
}

export interface MatchRef {
  type: 'slot' | 'winner' | 'loser' | 'entry';
  index?: number;
  matchId?: string;
  entrant?: Entrant;
}

export interface MatchDef {
  id: string;
  left: MatchRef;
  right: MatchRef;
  scope: string;
  title?: string;
  roundIndex: number;
  roundLabel: string;
  matchIndex: number;
  scheduleKey: string;
}

export interface EvaluatedMatch extends Omit<MatchDef, 'left' | 'right'> {
  saved: MatchState;
  left: Entrant;
  right: Entrant;
  playable: boolean;
  winnerPotential: number;
  loserPotential: number;
  winnerChoice: string;
  winnerClubId: string;
  loserClubId: string;
  code: string;
  shortCode: string;
  effectiveDate: string;
}

export interface Placement {
  place: number;
  clubId: string;
}

export interface BlockResult {
  key: string;
  title: string;
  startPlace: number;
  singleRef?: MatchRef;
  rounds: EvaluatedMatch[][];
  finalBox: { championName: string; clubId: string; place: number } | null;
  children: BlockResult[];
  championRef?: MatchRef;
  finalLoserRef?: MatchRef;
  size?: number;
  roundCount?: number;
  /** Colocação direta extra derivada do perdedor de uma partida específica dentro do bloco. */
  footerPlacementFromMatch?: {
    place: number;
    matchId: string;
    subtitle: string;
  };
}

export interface StructureResult {
  mainRounds: EvaluatedMatch[][];
  placementBlocks: BlockResult[];
  placements: Placement[];
  totalGames: number;
  /**
   * A, Sub 14 e 60+ (9 clubes): 1º jogo jogável da R1 define o 9º direto; 1 item (ou null).
   * Na B (10 clubes) não é usado — 9º/10º vêm da disputa na chave de posições.
   * Na C e 40+ (11 clubes) não é usado — 9º/10º/11º vêm da mini-chave dedicada.
   * Na D, Iniciante e 50+ (`id` `50`, 12 clubes) não é usado — 9º–12º vêm da mini-chave dedicada.
   */
  directPlacesFromR1Playables?: (EvaluatedMatch | null)[] | undefined;
}

export interface ClassificationRow {
  place: number;
  clubId: string;
  name: string;
}

export interface OverallRow {
  clubId: string;
  name: string;
  total: number;
  perCat: Record<string, number>;
}

export type PageType = 'principal' | 'disputas' | 'emAndamento' | 'geral' | 'admin';
export type AdminPanel = 'operacao' | 'clubes' | 'categoria';
export type AdminMode = 'main' | 'disputas';

export interface UIState {
  page: PageType;
  categoryId: string;
  adminMode: AdminMode;
  adminPanel: AdminPanel;
  selectedMatchId: string;
  matchModalOpen: boolean;
  isAdmin: boolean;
  showLogin: boolean;
  loginError: string;
  /** Quando false: esconde chaves de posição no site público (menu «Posições» e bloco em «Chaves»). No admin continuam visíveis para agenda e resultados. */
  showPlacementBrackets: boolean;
}
