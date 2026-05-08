export const POINTS = [0, 15, 30, 40];

export const DEFAULT_MATCH_RULES = {
    bestOfSets: 3,
    finalSetMode: 'standard'
};

const newRegularSet = () => ({ p1: 0, p2: 0 });
const newSuperTiebreakSet = () => ({ p1: 0, p2: 0, type: 'super_tiebreak', tiebreak: { p1: 0, p2: 0 } });

export function normalizeMatchRules(rules = {}) {
    const bestOfSets = Number(rules.bestOfSets) === 5 ? 5 : 3;
    return {
        bestOfSets,
        finalSetMode: rules.finalSetMode === 'super_tiebreak' ? 'super_tiebreak' : 'standard',
        tiebreakAt: 6,
        tiebreakTo: 7,
        superTiebreakTo: 10
    };
}

export function emptyScore() {
    return {
        sets: [newRegularSet()],
        points: { p1: 0, p2: 0 },
        completed: false
    };
}

export function rulesLabel(rules = {}) {
    const normalized = normalizeMatchRules(rules);
    const finalSet = normalized.finalSetMode === 'super_tiebreak' ? 'super tie-break a 10' : 'tie-break a 7 en 6-6';
    return `Mejor de ${normalized.bestOfSets} sets · ${finalSet}`;
}

export function getMatchRules(tournament = {}) {
    return normalizeMatchRules(tournament.matchRules || {
        bestOfSets: tournament.bestOfSets,
        finalSetMode: tournament.finalSetMode
    });
}

export function pointLabel(score, side) {
    const currentSet = score?.sets?.[score.sets.length - 1];
    if (isSuperTiebreakSet(currentSet) || isTiebreakSet(currentSet)) {
        return String(currentSet?.tiebreak?.[side] ?? 0);
    }

    const own = score?.points?.[side] ?? 0;
    const other = score?.points?.[side === 'p1' ? 'p2' : 'p1'] ?? 0;
    if (own === 4 && other === 3) return 'AD';
    return String(POINTS[Math.min(own, 3)] ?? own);
}

export function scoreModeLabel(score) {
    const currentSet = score?.sets?.[score.sets.length - 1];
    if (isSuperTiebreakSet(currentSet)) return 'Super TB';
    if (isTiebreakSet(currentSet)) return 'Tie-break';
    return 'Puntos';
}

export function isSuperTiebreakSet(set) {
    return set?.type === 'super_tiebreak';
}

export function isTiebreakSet(set) {
    return Boolean(set?.tiebreak) && !isSuperTiebreakSet(set);
}

export function isTiebreakComplete(set, target = 7) {
    const high = Math.max(set?.tiebreak?.p1 ?? 0, set?.tiebreak?.p2 ?? 0);
    const low = Math.min(set?.tiebreak?.p1 ?? 0, set?.tiebreak?.p2 ?? 0);
    return high >= target && high - low >= 2;
}

export function isSetComplete(set) {
    if (isSuperTiebreakSet(set)) return isTiebreakComplete(set, 10);
    if (isTiebreakSet(set)) return isTiebreakComplete(set, 7);

    const high = Math.max(set.p1, set.p2);
    const low = Math.min(set.p1, set.p2);
    return high >= 6 && high - low >= 2;
}

export function wonSets(score, side) {
    return (score?.sets || []).filter((set) => set[side] > set[side === 'p1' ? 'p2' : 'p1'] && isSetComplete(set)).length;
}

export function formatScore(score) {
    return (score?.sets || [])
        .filter((set) => set.p1 || set.p2 || isSetComplete(set))
        .map((set) => {
            if (isSuperTiebreakSet(set)) return `[${set.tiebreak?.p1 ?? 0}-${set.tiebreak?.p2 ?? 0}]`;
            if (isTiebreakSet(set)) {
                const loserPoints = Math.min(set.tiebreak?.p1 ?? 0, set.tiebreak?.p2 ?? 0);
                return `${set.p1}-${set.p2}(${loserPoints})`;
            }
            return `${set.p1}-${set.p2}`;
        })
        .join(', ') || '0-0';
}

export function scorePoint(scoreInput, side, rulesInput = {}) {
    const rules = normalizeMatchRules(rulesInput);
    const score = JSON.parse(JSON.stringify(scoreInput || emptyScore()));
    score.history = [...(score.history || []), {
        sets: JSON.parse(JSON.stringify(score.sets || [newRegularSet()])),
        points: { ...(score.points || { p1: 0, p2: 0 }) },
        completed: Boolean(score.completed),
        winnerSide: score.winnerSide || null,
        serverSide: score.serverSide || null
    }];

    const currentSet = score.sets[score.sets.length - 1] || newRegularSet();
    if (isSuperTiebreakSet(currentSet)) return scoreTiebreakPoint(score, side, rules.superTiebreakTo, rules);
    if (currentSet.p1 === rules.tiebreakAt && currentSet.p2 === rules.tiebreakAt) {
        currentSet.tiebreak = currentSet.tiebreak || { p1: 0, p2: 0 };
        return scoreTiebreakPoint(score, side, rules.tiebreakTo, rules);
    }

    const other = side === 'p1' ? 'p2' : 'p1';
    const ownPoint = score.points[side] ?? 0;
    const otherPoint = score.points[other] ?? 0;

    if (ownPoint >= 3 && otherPoint >= 3) {
        if (ownPoint === 4) return winGame(score, side, rules);
        if (otherPoint === 4) score.points[other] = 3;
        else score.points[side] = 4;
        return score;
    }

    if (ownPoint >= 3) return winGame(score, side, rules);
    score.points[side] = ownPoint + 1;
    return score;
}

export function subtractPoint(scoreInput) {
    const score = JSON.parse(JSON.stringify(scoreInput || emptyScore()));
    const previous = score.history?.[score.history.length - 1];
    if (!previous) return score;
    return {
        ...previous,
        history: score.history.slice(0, -1),
        serverSide: previous.serverSide || score.serverSide || null
    };
}

export function nextServerSide(previousScoreInput, nextScoreInput, currentServerSide = 'p1') {
    const previousScore = previousScoreInput || emptyScore();
    const nextScore = nextScoreInput || emptyScore();
    const server = currentServerSide === 'p2' ? 'p2' : 'p1';
    const previousSet = previousScore.sets?.[previousScore.sets.length - 1] || newRegularSet();
    const nextSet = nextScore.sets?.[nextScore.sets.length - 1] || newRegularSet();

    if (nextScore.completed) return server;

    if (isSuperTiebreakSet(previousSet) || isTiebreakSet(previousSet) || isSuperTiebreakSet(nextSet) || isTiebreakSet(nextSet)) {
        return nextTiebreakServer(previousSet, nextSet, server);
    }

    const gameFinished = previousSet.p1 !== nextSet.p1 || previousSet.p2 !== nextSet.p2 || previousScore.sets?.length !== nextScore.sets?.length;
    return gameFinished ? otherSide(server) : server;
}

function nextTiebreakServer(previousSet, nextSet, currentServerSide) {
    const previousPoints = tiebreakPointTotal(previousSet);
    const nextPoints = tiebreakPointTotal(nextSet);
    const firstServer = inferFirstTiebreakServer(currentServerSide, previousPoints + 1);
    if (isSetComplete(previousSet) || (nextSet && !nextSet.tiebreak && previousPoints > 0)) {
        return otherSide(firstServer);
    }
    if (nextPoints <= previousPoints) return currentServerSide;

    return serverForTiebreakPoint(firstServer, nextPoints + 1);
}

function tiebreakPointTotal(set) {
    return (set?.tiebreak?.p1 || 0) + (set?.tiebreak?.p2 || 0);
}

function inferFirstTiebreakServer(currentServerSide, pointNumber) {
    return serverForTiebreakPoint('p1', pointNumber) === currentServerSide ? 'p1' : 'p2';
}

function serverForTiebreakPoint(firstServerSide, pointNumber) {
    if (pointNumber <= 1) return firstServerSide;
    const block = Math.floor(pointNumber / 2);
    return block % 2 === 1 ? otherSide(firstServerSide) : firstServerSide;
}

function otherSide(side) {
    return side === 'p1' ? 'p2' : 'p1';
}

function scoreTiebreakPoint(score, side, target, rules) {
    const currentSet = score.sets[score.sets.length - 1];
    const other = side === 'p1' ? 'p2' : 'p1';
    currentSet.tiebreak = currentSet.tiebreak || { p1: 0, p2: 0 };
    currentSet.tiebreak[side] = (currentSet.tiebreak[side] || 0) + 1;

    if (currentSet.tiebreak[side] >= target && currentSet.tiebreak[side] - (currentSet.tiebreak[other] || 0) >= 2) {
        currentSet[side] = isSuperTiebreakSet(currentSet) ? 1 : 7;
        currentSet[other] = isSuperTiebreakSet(currentSet) ? 0 : 6;
        finishSet(score, side, rules);
    }

    return score;
}

function winGame(score, side, rules) {
    const currentSet = score.sets[score.sets.length - 1];
    currentSet[side] += 1;
    score.points = { p1: 0, p2: 0 };

    if (isSetComplete(currentSet)) finishSet(score, side, rules);

    return score;
}

function finishSet(score, side, rules) {
    if (wonSets(score, side) >= Math.ceil(rules.bestOfSets / 2)) {
        score.completed = true;
        score.winnerSide = side;
        return;
    }

    const nextSetNumber = score.sets.length + 1;
    const isFinalSet = nextSetNumber === rules.bestOfSets;
    score.sets.push(isFinalSet && rules.finalSetMode === 'super_tiebreak' ? newSuperTiebreakSet() : newRegularSet());
}

export function playerSide(match, playerId) {
    if (match?.player1?.id === playerId) return 'p1';
    if (match?.player2?.id === playerId) return 'p2';
    return null;
}
