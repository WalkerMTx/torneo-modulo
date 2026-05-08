import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CircleDot, ExternalLink, Eye, GitBranch, RotateCcw, Trophy, X } from 'lucide-react';
import { db } from '../../../firebase';
import { collection, query, onSnapshot, doc, writeBatch, getDocs, updateDoc } from 'firebase/firestore';
import { emptyScore, formatScore, getMatchRules, nextServerSide, playerSide, pointLabel, rulesLabel, scoreModeLabel, scorePoint, subtractPoint, wonSets } from '../utils/tennisScore';

const ROUND_LABELS = ['Ronda 64', 'Ronda 32', 'Octavos', 'Cuartos', 'Semifinal', 'Final'];
const MATCH_CARD_WIDTH = 260;
const MATCH_CARD_HEIGHT = 224;
const FIRST_ROUND_GAP = 28;
const CONNECTOR_WIDTH = 72;
const ROUND_HEADER_HEIGHT = 72;

function bracketSlotHeight(roundIndex) {
    return (MATCH_CARD_HEIGHT + FIRST_ROUND_GAP) * Math.pow(2, roundIndex);
}

function bracketMatchTop(matchPosition, roundIndex) {
    const slotHeight = bracketSlotHeight(roundIndex);
    return Math.round((matchPosition + 0.5) * slotHeight - MATCH_CARD_HEIGHT / 2);
}

function ConnectorLines({ roundIndex, position }) {
    const slotHeight = bracketSlotHeight(roundIndex);
    const verticalHeight = slotHeight / 2;
    const isTopMatch = position % 2 === 0;

    return (
        <div className="pointer-events-none absolute left-full top-0 hidden h-full md:block" style={{ width: CONNECTOR_WIDTH }}>
            <span className="absolute left-0 top-1/2 h-px w-6 bg-[#cbd5d1]" />
            <span
                className="absolute left-6 w-px bg-[#cbd5d1]"
                style={{
                    top: isTopMatch ? '50%' : `calc(50% - ${verticalHeight}px)`,
                    height: verticalHeight
                }}
            />
            {isTopMatch && <span className="absolute left-6 h-px bg-[#cbd5d1]" style={{ top: `calc(50% + ${verticalHeight}px)`, width: CONNECTOR_WIDTH - 24 }} />}
        </div>
    );
}

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map((part) => part[0]).join('').toUpperCase().slice(0, 2);
}

function makeBracket(players, tournamentId) {
    const seeds = players.slice(0, 64).map((player, index) => ({
        id: player.id,
        name: player.name,
        seed: player.seed || index + 1
    }));
    const totalRounds = 6;
    const matches = [];

    for (let round = 1; round <= totalRounds; round += 1) {
        const count = 64 / Math.pow(2, round);
        for (let index = 0; index < count; index += 1) {
            const id = `${tournamentId}_r${round}_m${index}`;
            matches.push({
                id,
                round,
                position: index,
                nextMatchId: round < totalRounds ? `${tournamentId}_r${round + 1}_m${Math.floor(index / 2)}` : null,
                nextMatchSlot: round < totalRounds ? (index % 2 === 0 ? 'player1' : 'player2') : null,
                player1: round === 1 ? seeds[index * 2] : null,
                player2: round === 1 ? seeds[index * 2 + 1] : null,
                scoreState: emptyScore(),
                score: null,
                winner: null,
                status: 'pending',
                serverSide: index % 2 === 0 ? 'p1' : 'p2'
            });
        }
    }

    return matches;
}

function MatchCard({ match, onOpen, onOpenDisplay }) {
    const score = match.scoreState || emptyScore();
    const winnerSide = match.winner ? playerSide(match, match.winner) : null;
    const waiting = !match.player1 || !match.player2;
    const scoreLabel = formatScore(score) || 'Sin marcador';

    const row = (player, side) => {
        const winner = winnerSide === side;
        return (
            <div className={`flex items-center gap-2 px-3 py-2.5 ${winner ? 'bg-emerald-50 text-emerald-900' : waiting ? 'text-gray-300' : 'text-gray-800'}`}>
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black ${winner ? 'bg-emerald-500 text-white' : 'bg-[#276767]/10 text-[#276767]'}`}>
                    {winner ? <Check size={13} /> : initials(player?.name)}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                        {match.serverSide === side && <CircleDot size={12} className="flex-shrink-0 text-orange-500" />}
                        <span className="truncate">{player?.name || 'Por definir'}</span>
                    </p>
                    {player?.seed && <p className="text-[10px] text-gray-400">Seed #{player.seed}</p>}
                </div>
                {winner && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                        Gana
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className={`relative flex h-[224px] w-[260px] flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${match.winner ? 'border-emerald-200' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Partido {match.position + 1}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${match.winner ? 'bg-emerald-100 text-emerald-700' : waiting ? 'bg-gray-100 text-gray-400' : 'bg-orange-100 text-orange-700'}`}>
                    {match.winner ? 'Finalizado' : waiting ? 'Pendiente' : 'En juego'}
                </span>
            </div>
            <div className="flex-1">
                {row(match.player1, 'p1')}
                <div className="h-px bg-gray-100 mx-3" />
                {row(match.player2, 'p2')}
            </div>
            <div className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-2">
                <button
                    type="button"
                    onClick={() => onOpen(match)}
                    disabled={waiting}
                    title={scoreLabel}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#276767] px-3 py-2 text-xs font-black text-white transition hover:bg-[#1d5252] disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <Eye size={13} /> Ver detalles
                </button>
                <button
                    type="button"
                    onClick={() => onOpenDisplay(match)}
                    disabled={waiting}
                    className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-[#276767] transition hover:bg-[#276767] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    title="Abrir display"
                >
                    <ExternalLink size={13} />
                </button>
            </div>
        </div>
    );
}

function ScoreModal({ match, isAdmin, rules, onPoint, onSubtract, onReset, onSetServer, onClose }) {
    const score = match.scoreState || emptyScore();
    const matchFinished = !!match.winner;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 bg-[#f8f4eb] px-5 py-4">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#276767]">{isAdmin ? 'Marcador de tenis' : 'Detalle del partido'}</p>
                        <h3 className="text-lg font-black text-gray-900">{match.player1?.name} vs {match.player2?.name}</h3>
                        <p className="mt-1 text-xs font-semibold text-gray-500">{rulesLabel(rules)} · {scoreModeLabel(score)}</p>
                    </div>
                    <button onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-white hover:text-gray-700">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5">
                    <div className="mb-4 grid grid-cols-[1fr_56px_56px_56px] gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                        <span>Jugador / saque</span>
                        <span className="text-center">Sets</span>
                        <span className="text-center">Games</span>
                        <span className="text-center">Puntos</span>
                    </div>
                    {['p1', 'p2'].map((side) => {
                        const player = side === 'p1' ? match.player1 : match.player2;
                        const currentSet = score.sets[score.sets.length - 1] || { p1: 0, p2: 0 };
                        return (
                            <div key={side} className="mb-3 grid grid-cols-[1fr_56px_56px_56px] items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                                <div className="min-w-0">
                                    <p className="flex items-center gap-2 truncate font-black text-gray-900">
                                        {match.serverSide === side && <CircleDot size={14} className="flex-shrink-0 text-orange-500" />}
                                        <span className="truncate">{player?.name}</span>
                                    </p>
                                    <p className="text-xs text-gray-400">Sets: {formatScore(score)}</p>
                                </div>
                                <span className="text-center text-xl font-black text-[#276767]">{wonSets(score, side)}</span>
                                <span className="text-center text-xl font-black text-gray-800">{currentSet[side]}</span>
                                <span className="text-center text-xl font-black text-orange-500">{matchFinished ? '-' : pointLabel(score, side)}</span>
                                {isAdmin && (
                                    <div className="col-span-4 grid grid-cols-[0.36fr_0.42fr_1fr] gap-2">
                                        <button
                                            onClick={() => onSetServer(match, side)}
                                            disabled={match.serverSide === side}
                                            className="rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-orange-600 shadow-sm transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Saca
                                        </button>
                                        <button
                                            onClick={() => onSubtract(match)}
                                            disabled={!score.history?.length}
                                            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-gray-600 shadow-sm transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            - Punto
                                        </button>
                                        <button
                                            onClick={() => onPoint(match, side)}
                                            disabled={matchFinished}
                                            className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-white shadow-lg shadow-black/10 transition hover:bg-[#276767] disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            + Punto para {player?.name}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {match.winner && (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <p className="text-sm font-black text-emerald-800">
                                Ganador: {match.winner === match.player1?.id ? match.player1?.name : match.player2?.name}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-emerald-700">Avanza automaticamente a la siguiente ronda.</p>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 border-t border-gray-100 px-5 pb-5 pt-4">
                    {isAdmin && (
                        <button onClick={() => onReset(match)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-black text-gray-600 hover:bg-gray-50">
                            <RotateCcw size={15} /> Reiniciar partido
                        </button>
                    )}
                    <button onClick={onClose} className="flex-1 rounded-xl bg-[#276767] px-4 py-3 text-sm font-black text-white hover:bg-[#1d5252]">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function BracketsView({ tournament, isAdmin }) {
    const [players, setPlayers] = useState([]);
    const [matches, setMatches] = useState([]);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [generating, setGenerating] = useState(false);
    const matchRules = useMemo(() => getMatchRules(tournament), [tournament]);

    useEffect(() => {
        if (!tournament?.id) return undefined;
        const q = query(collection(db, `tournaments/${tournament.id}/players`));
        return onSnapshot(q, (snap) => {
            setPlayers(snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (a.seed || 999) - (b.seed || 999)));
        });
    }, [tournament?.id]);

    useEffect(() => {
        if (!tournament?.id) return undefined;
        const q = query(collection(db, `tournaments/${tournament.id}/matches`));
        return onSnapshot(q, (snap) => {
            const rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
            setMatches(rows.sort((a, b) => a.round - b.round || a.position - b.position));
        });
    }, [tournament?.id]);

    const generateBracket = useCallback(async (force = false) => {
        if (!tournament?.id || players.length < 64 || generating) return;
        if (force && !confirm('Esto reiniciara el cuadro completo y borrara los resultados. Continuar?')) return;
        setGenerating(true);
        try {
            const existing = await getDocs(collection(db, `tournaments/${tournament.id}/matches`));
            const batch = writeBatch(db);
            existing.docs.forEach((item) => batch.delete(item.ref));
            makeBracket(players, tournament.id).forEach((match) => {
                batch.set(doc(db, `tournaments/${tournament.id}/matches`, match.id), match);
            });
            await batch.commit();
        } finally {
            setGenerating(false);
        }
    }, [generating, players, tournament?.id]);

    useEffect(() => {
        if (players.length >= 64 && matches.length === 0) generateBracket(false);
    }, [generateBracket, players.length, matches.length]);

    const applyPoint = async (match, side) => {
        const currentServer = match.serverSide || 'p1';
        const scoreInput = { ...(match.scoreState || emptyScore()), serverSide: currentServer };
        const nextScore = scorePoint(scoreInput, side, matchRules);
        const serverSide = nextServerSide(scoreInput, nextScore, currentServer);
        nextScore.serverSide = serverSide;
        const updates = { scoreState: nextScore, score: formatScore(nextScore), serverSide };

        if (nextScore.completed) {
            const winner = nextScore.winnerSide === 'p1' ? match.player1 : match.player2;
            updates.winner = winner.id;
            updates.status = 'completed';
            if (match.nextMatchId) {
                const nextMatch = matches.find((item) => item.id === match.nextMatchId);
                if (nextMatch) {
                    await updateDoc(doc(db, `tournaments/${tournament.id}/matches`, nextMatch.id), {
                        [match.nextMatchSlot]: { id: winner.id, name: winner.name, seed: winner.seed }
                    });
                }
            }
        }

        await updateDoc(doc(db, `tournaments/${tournament.id}/matches`, match.id), updates);
        setSelectedMatch((current) => current?.id === match.id ? { ...current, ...updates } : current);
    };

    const subtractLastPoint = async (match) => {
        const nextScore = subtractPoint(match.scoreState || emptyScore());
        await updateDoc(doc(db, `tournaments/${tournament.id}/matches`, match.id), {
            scoreState: nextScore,
            score: formatScore(nextScore),
            winner: null,
            status: 'pending',
            serverSide: nextScore.serverSide || match.serverSide || 'p1'
        });
        setSelectedMatch((current) => current?.id === match.id ? { ...current, scoreState: nextScore, score: formatScore(nextScore), winner: null, status: 'pending', serverSide: nextScore.serverSide || match.serverSide || 'p1' } : current);
    };

    const resetMatch = async (match) => {
        await updateDoc(doc(db, `tournaments/${tournament.id}/matches`, match.id), {
            scoreState: emptyScore(),
            score: null,
            winner: null,
            status: 'pending',
            serverSide: match.serverSide || 'p1'
        });
        setSelectedMatch((current) => current?.id === match.id ? { ...current, scoreState: emptyScore(), score: null, winner: null, status: 'pending' } : current);
    };

    async function setServer(match, side) {
        const scoreState = { ...(match.scoreState || emptyScore()), serverSide: side };
        const updates = { serverSide: side, scoreState };
        await updateDoc(doc(db, `tournaments/${tournament.id}/matches`, match.id), updates);
        setSelectedMatch((current) => current?.id === match.id ? { ...current, ...updates } : current);
    }

    const openDisplay = async (match) => {
        const url = `${window.location.origin}/scoreboard/${tournament.id}/${match.id}`;
        try {
            await navigator.clipboard?.writeText(url);
        } catch (_error) {
            // The display still opens even if clipboard permission is blocked.
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const rounds = useMemo(() => {
        return Array.from({ length: 6 }, (_, index) => {
            const round = index + 1;
            return matches.filter((match) => match.round === round).sort((a, b) => a.position - b.position);
        });
    }, [matches]);

    const bracketHeight = useMemo(() => {
        const firstRoundCount = rounds[0]?.length || 0;
        if (!firstRoundCount) return 0;
        return Math.round(firstRoundCount * bracketSlotHeight(0) - FIRST_ROUND_GAP);
    }, [rounds]);

    const champion = matches.find((match) => match.round === 6 && match.winner);
    const championPlayer = champion?.winner === champion?.player1?.id ? champion?.player1 : champion?.player2;

    if (!tournament) {
        return <div className="py-20 text-center text-gray-400">Selecciona un torneo para ver el cuadro.</div>;
    }

    return (
        <div className="py-2">
            {selectedMatch && (
                <ScoreModal
                    match={matches.find((match) => match.id === selectedMatch.id) || selectedMatch}
                    isAdmin={isAdmin}
                    rules={matchRules}
                    onPoint={applyPoint}
                    onSubtract={subtractLastPoint}
                    onReset={resetMatch}
                    onSetServer={setServer}
                    onClose={() => setSelectedMatch(null)}
                />
            )}

            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-500">64 jugadores · puntuacion real</p>
                    <h2 className="text-2xl font-black text-gray-900">Cuadro Milligan Open</h2>
                    <p className="mt-1 text-sm text-gray-500">Suma puntos como en tenis, con tie-break y super tie-break segun reglas del torneo.</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => generateBracket(true)}
                        disabled={generating || players.length < 64}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40"
                    >
                        <RotateCcw size={15} className={generating ? 'animate-spin' : ''} />
                        Reiniciar cuadro
                    </button>
                )}
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Participantes</p>
                    <p className="mt-1 text-2xl font-black text-gray-900">{players.length}/64</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Partidos</p>
                    <p className="mt-1 text-2xl font-black text-gray-900">{matches.filter((match) => match.winner).length}/63</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Formato</p>
                    <p className="mt-1 text-lg font-black text-gray-900">{rulesLabel(matchRules)}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Campeon</p>
                    <p className="mt-1 truncate text-2xl font-black text-amber-900">{championPlayer?.name || 'Pendiente'}</p>
                </div>
            </div>

            {matches.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
                    <GitBranch className="mx-auto mb-3 text-gray-300" size={48} />
                    <h3 className="font-black text-gray-700">Preparando cuadro de 64</h3>
                    <p className="mt-1 text-sm text-gray-400">Se necesitan 64 participantes cargados para generar el torneo.</p>
                </div>
            ) : (
                <div className="-mx-2 overflow-x-auto px-2 pb-4">
                    <div className="min-w-max rounded-2xl bg-[#f7faf8] p-4">
                        <div className="flex">
                            {rounds.map((roundMatches, roundIndex) => (
                                <div
                                    key={roundIndex}
                                    className="flex-shrink-0 pr-[72px]"
                                    style={{ width: MATCH_CARD_WIDTH + CONNECTOR_WIDTH }}
                                >
                                    <div className="flex flex-col justify-center rounded-xl border border-gray-100 bg-white px-4 shadow-sm" style={{ height: ROUND_HEADER_HEIGHT }}>
                                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#276767]">{ROUND_LABELS[roundIndex]}</span>
                                        <p className="text-sm font-bold text-gray-400">{roundMatches.filter((match) => match.winner).length}/{roundMatches.length} finalizados</p>
                                    </div>
                                </div>
                            ))}
                            <div className="w-[220px] flex-shrink-0">
                                <div className="flex flex-col justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 shadow-sm" style={{ height: ROUND_HEADER_HEIGHT }}>
                                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700">Campeon</span>
                                    <p className="text-sm font-bold text-amber-900">{championPlayer?.name ? 'Definido' : 'Pendiente'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="relative mt-4" style={{ height: bracketHeight }}>
                        {rounds.map((roundMatches, roundIndex) => (
                            <div
                                key={roundIndex}
                                className="absolute top-0"
                                style={{
                                    left: roundIndex * (MATCH_CARD_WIDTH + CONNECTOR_WIDTH),
                                    width: MATCH_CARD_WIDTH
                                }}
                            >
                                    {roundMatches.map((match) => (
                                        <div
                                            key={match.id}
                                            className="absolute"
                                            style={{ top: bracketMatchTop(match.position, roundIndex), left: 0 }}
                                        >
                                            <MatchCard match={match} onOpen={setSelectedMatch} onOpenDisplay={openDisplay} />
                                            {roundIndex < rounds.length - 1 && <ConnectorLines roundIndex={roundIndex} position={match.position} />}
                                        </div>
                                    ))}
                            </div>
                        ))}
                        <div
                            className="absolute"
                            style={{
                                left: rounds.length * (MATCH_CARD_WIDTH + CONNECTOR_WIDTH),
                                top: bracketHeight / 2 - 56
                            }}
                        >
                            <span className="pointer-events-none absolute -left-[72px] top-1/2 hidden h-px w-[72px] bg-[#cbd5d1] md:block" />
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-white">
                                    <Trophy size={20} />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Campeon</p>
                                <p className="mt-1 truncate text-lg font-black text-amber-950">{championPlayer?.name || 'Pendiente'}</p>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            )}

            {!isAdmin && (
                <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
                    Los resultados solo pueden ser editados por administradores.
                </div>
            )}
        </div>
    );
}
