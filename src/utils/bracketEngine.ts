import {
  Category, Club, Entrant, EvaluatedMatch, MatchDef, MatchRef, MatchState,
  BlockResult, StructureResult, Placement, ClassificationRow, OverallRow, TournamentState
} from '@/types/tournament';
import { CATEGORY_FIXED_BYE_ONE_BASED } from '@/data/initialData';
import { nextPow2, parseNum, displayGameCode, formatDateTime } from '@/utils/helpers';

function defaultMatchState(): MatchState {
  return { score1: '', score2: '', winner: '', datetime: '', inProgress: false, court: '' };
}

function getMatchState(category: Category, matchId: string): MatchState {
  return { ...defaultMatchState(), ...(category.matchResults[matchId] || {}) };
}

function getMatchEffectiveDate(category: Category, match: MatchDef): string {
  const saved = getMatchState(category, match.id);
  return saved.datetime || category.roundDefaults[match.scheduleKey] || '';
}

function mainRoundCount(slots: number): number {
  return Math.log2(slots);
}

function getMainRoundLabel(slots: number, roundIndex: number): string {
  const total = mainRoundCount(slots);
  const labelsMap: Record<number, string[]> = {
    1: ['Final'],
    2: ['Semifinal', 'Final'],
    3: ['Quartas de final', 'Semifinal', 'Final'],
    4: ['Oitavas de final', 'Quartas de final', 'Semifinal', 'Final']
  };
  const labels = labelsMap[total] || Array.from({ length: total }, (_, idx) => `Rodada ${idx + 1}`);
  return labels[roundIndex] || `Rodada ${roundIndex + 1}`;
}

function makeEntrantFromClub(clubId: string, clubs: Club[]): Entrant {
  if (!clubId) return { type: 'bye', clubId: '', name: 'BYE', flag: '', potential: 0, bye: true, actual: false };
  const club = clubs.find(c => c.id === clubId);
  return { type: 'club', clubId, name: club ? club.name : clubId, flag: club ? club.flag : '', potential: 1, bye: false, actual: true };
}

function roundStartPlace(totalRounds: number, roundIndex: number): number {
  return Math.pow(2, totalRounds - roundIndex - 1) + 1;
}

/** D, Iniciante e 50+ (`id` `50`): 12 clubes em chave de 16 com mini 9º–12º dedicada (não usam a mini genérica 9–16 da R1). */
export function categoryHasTwelveClubNineToTwelvePlayoff(categoryId: string): boolean {
  return categoryId === 'd' || categoryId === 'iniciante' || categoryId === '50';
}

/** Sem mini-chave de perdedores da R1 (faixa 9–16): A e Sub 18 (9 clubes), B (10), C e 40+ (11 — mini 9–11), D / Iniciante / 50+ (12 — mini 9–12 dedicada). */
const CATEGORIES_SKIP_MAIN_R1_PLACEMENT_BLOCK = new Set([
  'a',
  'sub-18',
  'b',
  'c',
  '40+',
  'd',
  'iniciante',
  '50',
]);

/** Quantos lugares vêm direto do 1º jogo jogável da R1 (só A e Sub 18). Na B, 9º/10º saem da disputa entre perd. JOGO 1 e JOGO 2. */
function directLowerPlaceSlotsFromR1Count(categoryId: string): number {
  if (categoryId === 'a' || categoryId === 'sub-18') return 1;
  return 0;
}

export function categorySkipsNineThroughSixteenPlacement(categoryId: string): boolean {
  return CATEGORIES_SKIP_MAIN_R1_PLACEMENT_BLOCK.has(categoryId);
}

function firstNPlayableR1Matches(mainMatches: EvaluatedMatch[][], n: number): (EvaluatedMatch | null)[] {
  const r1 = mainMatches[0] || [];
  const playables = r1.filter(m => m.playable);
  const out: (EvaluatedMatch | null)[] = [];
  for (let i = 0; i < n; i++) out.push(playables[i] ?? null);
  return out;
}

/**
 * Primeiros dois confrontos da R1 em que **ambos** os slots são de clube (nenhum BYE no par).
 * Usa `CATEGORY_FIXED_BYE_ONE_BASED` da categoria (ex.: B → JOGO1 / JOGO2 corretos para o sorteio atual).
 */
function firstTwoMainR1MatchNumbersOneBased(byePositionsOneBased: readonly number[]): [number, number] | null {
  const bye0 = new Set(byePositionsOneBased.map(p => p - 1));
  const nums: number[] = [];
  for (let mi = 0; mi < 8; mi++) {
    const a = mi * 2;
    const b = a + 1;
    if (bye0.has(a) || bye0.has(b)) continue;
    nums.push(mi + 1);
    if (nums.length === 2) return [nums[0], nums[1]];
  }
  return null;
}

function placementTitle(start: number, end: number): string {
  if (start === end) return `${start}º Lugar`;
  if (end === start + 1) return `${start}º e ${end}º`;
  return `${start}º ao ${end}º`;
}

function inferWinner(saved: MatchState, left: Entrant, right: Entrant, playable: boolean): string {
  if (left.potential > 0 && right.potential === 0) return '1';
  if (right.potential > 0 && left.potential === 0) return '2';
  if (!playable) return '';
  if (saved.winner === '1' || saved.winner === '2') return saved.winner;
  const s1 = parseNum(saved.score1), s2 = parseNum(saved.score2);
  if ((saved.score1 !== '' || saved.score2 !== '') && s1 !== s2) {
    return s1 > s2 ? '1' : '2';
  }
  return '';
}

export function hasExplicitResult(match: EvaluatedMatch | null): boolean {
  const saved = match?.saved || {} as MatchState;
  return saved.winner === '1' || saved.winner === '2' || String(saved.score1 || '').trim() !== '' || String(saved.score2 || '').trim() !== '';
}

export function countRealSeeds(seeds: (string | null)[]): number {
  return seeds.filter(Boolean).length;
}

export function evaluateStructure(category: Category, clubs: Club[]): StructureResult {
  const mainRounds: MatchDef[][] = [];
  const defMap: Record<string, MatchDef> = {};
  const cache: Record<string, EvaluatedMatch> = {};
  let gameCounter = 0;
  const slots = category.slots;
  const totalRounds = mainRoundCount(slots);

  // Build main round definitions
  let refs: MatchDef[] = [];
  for (let i = 0; i < slots; i += 2) {
    refs.push({
      id: `${category.id}-main-r1-m${(i / 2) + 1}`,
      left: { type: 'slot', index: i },
      right: { type: 'slot', index: i + 1 },
      scope: 'main',
      roundIndex: 0,
      roundLabel: getMainRoundLabel(slots, 0),
      matchIndex: i / 2,
      scheduleKey: 'main:R1'
    });
  }
  mainRounds.push(refs);
  let previous = refs;
  for (let r = 1; r < totalRounds; r++) {
    const current: MatchDef[] = [];
    for (let i = 0; i < previous.length; i += 2) {
      current.push({
        id: `${category.id}-main-r${r + 1}-m${(i / 2) + 1}`,
        left: { type: 'winner', matchId: previous[i].id },
        right: { type: 'winner', matchId: previous[i + 1].id },
        scope: 'main',
        roundIndex: r,
        roundLabel: getMainRoundLabel(slots, r),
        matchIndex: i / 2,
        scheduleKey: `main:R${r + 1}`
      });
    }
    mainRounds.push(current);
    previous = current;
  }
  mainRounds.flat().forEach(d => defMap[d.id] = d);

  function evaluateRef(ref: MatchRef): Entrant {
    if (ref.type === 'slot') {
      return makeEntrantFromClub(category.seeds[ref.index!] || '', clubs);
    }
    if (ref.type === 'winner') {
      const src = evaluateMatch(ref.matchId!);
      if (src.winnerClubId) return makeEntrantFromClub(src.winnerClubId, clubs);
      return { type: 'placeholder', clubId: '', name: `Venc. ${src.code || src.shortCode}`, flag: '', potential: src.winnerPotential, bye: false, actual: false };
    }
    if (ref.type === 'loser') {
      const src = evaluateMatch(ref.matchId!);
      if (src.loserClubId) return makeEntrantFromClub(src.loserClubId, clubs);
      return { type: 'placeholder', clubId: '', name: `Perd. ${src.code || src.shortCode}`, flag: '', potential: src.loserPotential, bye: false, actual: false };
    }
    if (ref.type === 'entry') {
      return ref.entrant ? { ...ref.entrant } : { type: 'bye', clubId: '', name: 'BYE', flag: '', potential: 0, bye: true, actual: false };
    }
    return { type: 'bye', clubId: '', name: 'BYE', flag: '', potential: 0, bye: true, actual: false };
  }

  function evaluateMatch(matchId: string): EvaluatedMatch {
    if (cache[matchId]) return cache[matchId];
    const def = defMap[matchId];
    const left = evaluateRef(def.left);
    const right = evaluateRef(def.right);
    const saved = getMatchState(category, matchId);
    const playable = left.potential > 0 && right.potential > 0;
    const winnerChoice = inferWinner(saved, left, right, playable);
    const winnerPotential = (left.potential > 0 || right.potential > 0) ? 1 : 0;
    const loserPotential = playable ? 1 : 0;
    const winnerClubId = winnerChoice === '1' && left.clubId ? left.clubId : winnerChoice === '2' && right.clubId ? right.clubId : '';
    const loserClubId = winnerChoice === '1' && right.clubId ? right.clubId : winnerChoice === '2' && left.clubId ? left.clubId : '';
    const shortCode = `M${matchId.split('-').pop()?.replace('m', '')}`;
    const evaluated: EvaluatedMatch = {
      ...def,
      saved,
      left, right, playable, winnerPotential, loserPotential, winnerChoice, winnerClubId, loserClubId,
      code: '', shortCode,
      effectiveDate: getMatchEffectiveDate(category, def)
    };
    cache[matchId] = evaluated;
    return evaluated;
  }

  const mainMatches = mainRounds.map(round => round.map(def => evaluateMatch(def.id)));

  mainMatches.forEach(round => {
    round.forEach(match => {
      if (match.playable) {
        gameCounter += 1;
        match.code = `JOGO${gameCounter}`;
      } else {
        match.code = '';
      }
    });
  });

  const staticByeEntryRef: MatchRef = {
    type: 'entry',
    entrant: { type: 'bye', clubId: '', name: 'BYE', flag: '', potential: 0, bye: true, actual: false },
  };

  // Placement blocks
  function evaluateBlock(block: {
    key: string;
    title: string;
    startPlace: number;
    entries: MatchRef[];
    size: number;
    roundCount: number;
    skipLoserChildren?: boolean;
  }): BlockResult {
    const rounds: MatchDef[][] = [];
    const localDefs: Record<string, MatchDef> = {};
    const bTotalRounds = block.roundCount;
    let current: MatchDef[] = [];
    for (let i = 0; i < block.size; i += 2) {
      current.push({
        id: `${block.key}-r1-m${(i / 2) + 1}`,
        left: block.entries[i] || { type: 'entry', entrant: { type: 'bye', clubId: '', name: 'BYE', flag: '', potential: 0, bye: true, actual: false } },
        right: block.entries[i + 1] || { type: 'entry', entrant: { type: 'bye', clubId: '', name: 'BYE', flag: '', potential: 0, bye: true, actual: false } },
        scope: block.key,
        title: block.title,
        roundIndex: 0,
        roundLabel: 'Rodada 1',
        matchIndex: i / 2,
        scheduleKey: `${block.key}:R1`
      });
    }
    rounds.push(current);
    let prev = current;
    for (let r = 1; r < bTotalRounds; r++) {
      const next: MatchDef[] = [];
      for (let i = 0; i < prev.length; i += 2) {
        next.push({
          id: `${block.key}-r${r + 1}-m${(i / 2) + 1}`,
          left: { type: 'winner', matchId: prev[i].id },
          right: { type: 'winner', matchId: prev[i + 1].id },
          scope: block.key,
          title: block.title,
          roundIndex: r,
          roundLabel: `Rodada ${r + 1}`,
          matchIndex: i / 2,
          scheduleKey: `${block.key}:R${r + 1}`
        });
      }
      rounds.push(next);
      prev = next;
    }
    rounds.flat().forEach(d => localDefs[d.id] = d);

    const localCache: Record<string, EvaluatedMatch> = {};
    function localRef(ref: MatchRef): Entrant {
      if (ref.type === 'winner') {
        const src = localMatch(ref.matchId!);
        if (src.winnerClubId) return makeEntrantFromClub(src.winnerClubId, clubs);
        return { type: 'placeholder', clubId: '', name: `Venc. ${src.code || src.shortCode}`, flag: '', potential: src.winnerPotential, bye: false, actual: false };
      }
      if (ref.type === 'loser') {
        const src = localMatch(ref.matchId!);
        if (src.loserClubId) return makeEntrantFromClub(src.loserClubId, clubs);
        return { type: 'placeholder', clubId: '', name: `Perd. ${src.code || src.shortCode}`, flag: '', potential: src.loserPotential, bye: false, actual: false };
      }
      if (ref.type === 'entry') {
        return ref.entrant ? { ...ref.entrant } : { type: 'bye', clubId: '', name: 'BYE', flag: '', potential: 0, bye: true, actual: false };
      }
      return evaluateRef(ref);
    }
    function localMatch(id: string): EvaluatedMatch {
      if (localCache[id]) return localCache[id];
      const def = localDefs[id];
      const left = localRef(def.left);
      const right = localRef(def.right);
      const saved = getMatchState(category, id);
      const playable = left.potential > 0 && right.potential > 0;
      const winnerChoice = inferWinner(saved, left, right, playable);
      const winnerPotential = (left.potential > 0 || right.potential > 0) ? 1 : 0;
      const loserPotential = playable ? 1 : 0;
      const m: EvaluatedMatch = {
        ...def, left, right, playable, winnerPotential, loserPotential, winnerChoice,
        winnerClubId: winnerChoice === '1' && left.clubId ? left.clubId : winnerChoice === '2' && right.clubId ? right.clubId : '',
        loserClubId: winnerChoice === '1' && right.clubId ? right.clubId : winnerChoice === '2' && left.clubId ? left.clubId : '',
        shortCode: '', code: '', saved,
        effectiveDate: getMatchEffectiveDate(category, def)
      };
      localCache[id] = m;
      return m;
    }

    const evalRounds = rounds.map(round => round.map(def => localMatch(def.id)));
    evalRounds.forEach(round => {
      round.forEach(match => {
        if (match.playable) {
          gameCounter += 1;
          match.code = `JOGO${gameCounter}`;
          match.shortCode = match.code;
        } else {
          match.code = '';
          match.shortCode = match.id.split('-').pop()?.toUpperCase() || '';
        }
      });
    });

    const childBlocks: BlockResult[] = [];
    if (!block.skipLoserChildren) {
      for (let r = 0; r < evalRounds.length - 1; r++) {
        const losers = evalRounds[r].map(m => ({ type: 'loser' as const, matchId: m.id }));
        if (losers.length >= 2) {
          const childStart = block.startPlace + Math.pow(2, evalRounds.length - r - 1);
          childBlocks.push(buildPlacementBlock(`${block.key}-c${r + 1}`, losers, childStart, localRef));
        } else if (losers.length === 1) {
          const p = block.startPlace + Math.pow(2, evalRounds.length - r - 1);
          childBlocks.push({
            key: `${block.key}-leaf${r + 1}`,
            title: placementTitle(p, p),
            startPlace: p,
            singleRef: losers[0],
            rounds: [], finalBox: null, children: []
          });
        }
      }
    }
    childBlocks.sort((a, b) => a.startPlace - b.startPlace);

    const lastRound = evalRounds[evalRounds.length - 1];
    const lastMatch = lastRound[0];
    const champEntrant = localRef({ type: 'winner', matchId: lastMatch.id });

    return {
      key: block.key,
      title: block.title,
      startPlace: block.startPlace,
      rounds: evalRounds,
      size: block.size,
      roundCount: block.roundCount,
      children: childBlocks,
      championRef: { type: 'winner', matchId: lastMatch.id },
      finalLoserRef: { type: 'loser', matchId: lastMatch.id },
      finalBox: {
        championName: champEntrant.name,
        clubId: champEntrant.clubId || '',
        place: block.startPlace
      }
    };
  }

  function makeBlockKey(prefix: string, start: number): string {
    return `${category.id}-${prefix}-${start}`;
  }

  function buildPlacementBlock(
    prefix: string,
    entrantRefs: MatchRef[],
    startPlace: number,
    resolver?: (ref: MatchRef) => Entrant,
    titleOverride?: string,
    skipLoserChildren?: boolean
  ): BlockResult {
    const actualCount = entrantRefs.length;
    const size = nextPow2(actualCount);
    const resolveEntrant = resolver || evaluateRef;
    const entries: MatchRef[] = entrantRefs.map(ref => {
      if (ref.type === 'entry' && ref.entrant) {
        return { type: 'entry' as const, entrant: { ...ref.entrant } };
      }
      return { type: 'entry' as const, entrant: resolveEntrant(ref) };
    });
    while (entries.length < size) {
      entries.push({ type: 'entry', entrant: { type: 'bye', clubId: '', name: 'BYE', flag: '', potential: 0, bye: true, actual: false } });
    }
    return evaluateBlock({
      key: makeBlockKey(prefix, startPlace),
      title: titleOverride ?? placementTitle(startPlace, startPlace + actualCount - 1),
      startPlace,
      entries,
      size,
      roundCount: Math.log2(size),
      skipLoserChildren: skipLoserChildren === true,
    });
  }

  const placementBlocks: BlockResult[] = [];
  const skipNineThroughSixteenBlock = CATEGORIES_SKIP_MAIN_R1_PLACEMENT_BLOCK.has(category.id);

  /** B: disputa 9º entre perdedores dos dois primeiros pares «só clubes» da R1 (= JOGO1 e JOGO2 com 10 clubes). Sempre que existir desenho BYE da B, não depende de já haver 2 jogos jogáveis. */
  if (category.id === 'b' && slots === 16) {
    const byes = CATEGORY_FIXED_BYE_ONE_BASED['b'];
    const pair = byes ? firstTwoMainR1MatchNumbersOneBased(byes) : null;
    if (pair) {
      const r1 = mainMatches[0];
      const [n1, n2] = pair;
      const ma = r1[n1 - 1];
      const mb = r1[n2 - 1];
      if (ma && mb) {
        placementBlocks.push(
          buildPlacementBlock(
            'place-b9-playoff',
            [
              { type: 'loser', matchId: ma.id },
              { type: 'loser', matchId: mb.id },
            ],
            9
          )
        );
      }
    }
  }

  /**
   * C e 40+ (11 clubes em 16): mesma mini 9º–11º — R1 = perd. JOGO1×BYE | perd. JOGO2×perd. JOGO3;
   * final = 9º e 10º; 11º = perdedor do jogo 11 (2º jogo da R1 desta mini-chave).
   */
  if ((category.id === 'c' || category.id === '40+') && slots === 16) {
    const j = firstNPlayableR1Matches(mainMatches, 3);
    const m1 = j[0];
    const m2 = j[1];
    const m3 = j[2];
    if (m1 && m2 && m3) {
      const cBlock = buildPlacementBlock(
        'place-c9-11-playoff',
        [
          { type: 'loser', matchId: m1.id },
          staticByeEntryRef,
          { type: 'loser', matchId: m2.id },
          { type: 'loser', matchId: m3.id },
        ],
        9,
        undefined,
        '9º ao 11º',
        true
      );
      const r1b = cBlock.rounds[0]?.[1];
      if (r1b) cBlock.footer11thFromMatchId = r1b.id;
      placementBlocks.push(cBlock);
    }
  }

  /**
   * D, Iniciante e 50+ (12 clubes em 16): mini 9º–12º — R1 = perd. JOGO1×perd. JOGO2 | perd. JOGO3×perd. JOGO4;
   * final = 9º e 10º; 11º e 12º = perdedores dos dois jogos da 1ª rodada desta mini (sub-chave automática).
   */
  if (categoryHasTwelveClubNineToTwelvePlayoff(category.id) && slots === 16) {
    const j = firstNPlayableR1Matches(mainMatches, 4);
    const m1 = j[0];
    const m2 = j[1];
    const m3 = j[2];
    const m4 = j[3];
    if (m1 && m2 && m3 && m4) {
      placementBlocks.push(
        buildPlacementBlock(
          'place-d9-12-playoff',
          [
            { type: 'loser', matchId: m1.id },
            { type: 'loser', matchId: m2.id },
            { type: 'loser', matchId: m3.id },
            { type: 'loser', matchId: m4.id },
          ],
          9,
          undefined,
          '9º ao 12º',
          false
        )
      );
    }
  }

  /**
   * Sub 12 (6 clubes em 8): BYE fixos 2 e 7; 5º e 6º = perdedor do Jogo 1 × perdedor do Jogo 2 (2 primeiros jogos jogáveis da R1).
   * Não se usa a mini geral de perdedores da R1 (4 vagas).
   */
  if (category.id === 'sub-12' && slots === 8) {
    const j = firstNPlayableR1Matches(mainMatches, 2);
    const m1 = j[0];
    const m2 = j[1];
    if (m1 && m2) {
      placementBlocks.push(
        buildPlacementBlock(
          'place-sub12-5-6-playoff',
          [
            { type: 'loser', matchId: m1.id },
            { type: 'loser', matchId: m2.id },
          ],
          5,
          undefined,
          '5º e 6º',
          true
        )
      );
    }
  }

  const skipSub12R1FullLosersBlock = category.id === 'sub-12' && slots === 8;

  for (let r = 0; r < mainMatches.length - 1; r++) {
    if ((skipNineThroughSixteenBlock && r === 0) || (skipSub12R1FullLosersBlock && r === 0)) continue;
    /** Todas as partidas da rodada na principal — assim a mini-chave de posição existe antes de haver confronto/jogáveis (horários no scheduleKey). */
    const losers = mainMatches[r].map(m => ({ type: 'loser' as const, matchId: m.id }));
    if (losers.length >= 2) {
      const startPlace = roundStartPlace(totalRounds, r);
      placementBlocks.push(buildPlacementBlock(`place-r${r + 1}`, losers, startPlace));
    } else if (losers.length === 1) {
      const sp = roundStartPlace(totalRounds, r);
      placementBlocks.push({
        key: makeBlockKey(`place-r${r + 1}`, sp),
        title: placementTitle(sp, sp),
        startPlace: sp,
        singleRef: losers[0],
        rounds: [], finalBox: null, children: []
      });
    }
  }

  // Collect placements
  function collectBlockPlacements(block: BlockResult, acc: Placement[]) {
    if (block.singleRef) return;
    if (!block.rounds || !block.rounds.length) return;
    const finalMatch = block.rounds[block.rounds.length - 1][0];
    if (hasExplicitResult(finalMatch) && finalMatch.winnerClubId) acc.push({ place: block.startPlace, clubId: finalMatch.winnerClubId });
    if (hasExplicitResult(finalMatch) && finalMatch.loserClubId) acc.push({ place: block.startPlace + 1, clubId: finalMatch.loserClubId });
    block.children.forEach(child => collectBlockPlacements(child, acc));
    if (block.footer11thFromMatchId) {
      const m11 = block.rounds.flat().find(x => x.id === block.footer11thFromMatchId);
      if (m11 && hasExplicitResult(m11) && m11.loserClubId) {
        acc.push({ place: 11, clubId: m11.loserClubId });
      }
    }
  }

  const placements: Placement[] = [];
  const finalMatch = mainMatches[mainMatches.length - 1][0];
  if (hasExplicitResult(finalMatch) && finalMatch.winnerClubId) placements.push({ place: 1, clubId: finalMatch.winnerClubId });
  if (hasExplicitResult(finalMatch) && finalMatch.loserClubId) placements.push({ place: 2, clubId: finalMatch.loserClubId });

  placementBlocks.forEach(block => collectBlockPlacements(block, placements));

  const r1DirectCount = directLowerPlaceSlotsFromR1Count(category.id);
  const directPlacesFromR1Playables =
    r1DirectCount > 0 ? firstNPlayableR1Matches(mainMatches, r1DirectCount) : undefined;
  if (directPlacesFromR1Playables) {
    directPlacesFromR1Playables.forEach((m, idx) => {
      const place = 9 + idx;
      if (m && hasExplicitResult(m) && m.loserClubId) placements.push({ place, clubId: m.loserClubId });
    });
  }

  return { mainRounds: mainMatches, placementBlocks, placements, totalGames: gameCounter, directPlacesFromR1Playables };
}

export function getComputedClassification(category: Category, clubs: Club[]): ClassificationRow[] {
  const struct = evaluateStructure(category, clubs);
  const byPlace = new Map<number, ClassificationRow>();
  const used = new Set<string>();
  struct.placements
    .filter(item => item.clubId)
    .sort((a, b) => a.place - b.place)
    .forEach(item => {
      if (used.has(item.clubId) || byPlace.has(item.place)) return;
      used.add(item.clubId);
      const club = clubs.find(c => c.id === item.clubId);
      byPlace.set(item.place, { place: item.place, clubId: item.clubId, name: club?.name || item.clubId });
    });
  return Array.from(byPlace.values()).sort((a, b) => a.place - b.place);
}

export function getOverallRows(state: TournamentState): OverallRow[] {
  const totals: Record<string, OverallRow> = {};
  state.clubs.forEach(club => {
    totals[club.id] = { clubId: club.id, name: club.name, total: 0, perCat: {} };
  });
  state.categories.forEach(cat => {
    const ranking = getComputedClassification(cat, state.clubs);
    ranking.forEach(row => {
      if (!totals[row.clubId]) {
        totals[row.clubId] = { clubId: row.clubId, name: row.name, total: 0, perCat: {} };
      }
      const points = state.pointsByPlace[String(row.place)] || 0;
      if (!points) return;
      totals[row.clubId].perCat[cat.id] = points;
      totals[row.clubId].total += points;
    });
  });
  return Object.values(totals).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export function visibleMatchCode(match: EvaluatedMatch): string {
  return match && match.playable ? displayGameCode(match.code || match.shortCode || '') : '';
}

export function scheduleLabel(match: EvaluatedMatch): string {
  if (!match) return '';
  if (match.scope === 'main') return match.roundLabel;
  return `${match.title || match.scope} · ${match.roundLabel}`;
}

export function collectMatches(block: BlockResult, acc: EvaluatedMatch[]) {
  if (block.rounds && block.rounds.length) block.rounds.flat().forEach(m => acc.push(m));
  block.children?.forEach(child => collectMatches(child, acc));
}

export interface BracketLayoutResult {
  positions: Record<string, { x: number; y: number; w: number; h: number; cy: number }>;
  width: number;
  height: number;
  cardW: number;
  cardH: number;
  connW: number;
}

export function bracketLayout(rounds: EvaluatedMatch[][]): BracketLayoutResult {
  const cardW = 230, cardH = 80, connW = 70, topPad = 10, pitch = 94;
  const totalRounds = rounds.length;
  const leafCount = rounds[0] ? rounds[0].length * 2 : 2;
  const height = topPad + (leafCount * pitch);
  const width = totalRounds * cardW + (totalRounds - 1) * connW + 260;
  const positions: Record<string, { x: number; y: number; w: number; h: number; cy: number }> = {};
  rounds.forEach((round, r) => {
    const block = Math.pow(2, r + 1);
    round.forEach((match, idx) => {
      const centerY = topPad + (((idx * block) + block / 2 - 0.5) * pitch);
      const x = r * (cardW + connW);
      const y = centerY - cardH / 2;
      positions[match.id] = { x, y, w: cardW, h: cardH, cy: centerY };
    });
  });
  return { positions, width, height, cardW, cardH, connW };
}
