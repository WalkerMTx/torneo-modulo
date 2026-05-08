import { useState, useEffect } from 'react';
import { LayoutGrid, RefreshCw, Check } from 'lucide-react';
import { db } from '../../../firebase';
import {
    collection, query, onSnapshot, doc,
    writeBatch, updateDoc, getDocs,
} from 'firebase/firestore';

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Badge de posición en la tabla
function PosBadge({ pos }) {
    if (pos === 0) return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-black">1</span>
    );
    if (pos === 1) return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-300 text-white text-xs font-black">2</span>
    );
    if (pos === 2) return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/70 text-white text-xs font-black">3</span>
    );
    return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">{pos + 1}</span>
    );
}

// Tarjeta de partido (Round Robin)
function MatchPill({ match, onSetWinner, onClearWinner, isAdmin }) {
    const [pending, setPending] = useState(null);
    const hasWinner = !!match.winner;

    const handleClick = (playerId) => {
        if (!isAdmin || hasWinner) return;
        setPending(playerId);
    };

    const confirm = async () => {
        setPending(null);
        await onSetWinner(match, pending);
    };

    return (
        <div className={`bg-white rounded-xl border shadow-sm transition-all overflow-hidden ${
            hasWinner ? 'border-green-100' :
            pending ? 'border-orange-300 ring-2 ring-orange-200/60 shadow-md' :
            'border-gray-200 hover:border-gray-300'
        }`}>
            <div className="flex items-center">
                {/* Jugador 1 */}
                <button
                    onClick={() => handleClick(match.player1.id)}
                    disabled={!isAdmin || hasWinner}
                    className={`flex-1 px-3 py-2.5 text-sm font-semibold text-left transition-colors ${
                        match.winner === match.player1.id ? 'bg-green-50 text-green-700' :
                        hasWinner ? 'text-gray-400 bg-gray-50/50' :
                        pending === match.player1.id ? 'bg-orange-50 text-orange-700' :
                        isAdmin ? 'text-gray-800 hover:bg-gray-50' : 'text-gray-800 cursor-default'
                    }`}
                >
                    {match.player1.name}
                    {match.winner === match.player1.id && (
                        <Check size={12} className="inline ml-1 text-green-500" />
                    )}
                </button>

                {/* VS */}
                <div className="px-2 text-xs text-gray-300 font-bold flex-shrink-0">vs</div>

                {/* Jugador 2 */}
                <button
                    onClick={() => handleClick(match.player2.id)}
                    disabled={!isAdmin || hasWinner}
                    className={`flex-1 px-3 py-2.5 text-sm font-semibold text-right transition-colors ${
                        match.winner === match.player2.id ? 'bg-green-50 text-green-700' :
                        hasWinner ? 'text-gray-400 bg-gray-50/50' :
                        pending === match.player2.id ? 'bg-orange-50 text-orange-700' :
                        isAdmin ? 'text-gray-800 hover:bg-gray-50' : 'text-gray-800 cursor-default'
                    }`}
                >
                    {match.winner === match.player2.id && (
                        <Check size={12} className="inline mr-1 text-green-500" />
                    )}
                    {match.player2.name}
                </button>
            </div>

            {/* Confirmación inline */}
            {pending && !hasWinner && (
                <div className="bg-orange-50 border-t border-orange-200 px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-orange-700 font-semibold truncate">
                        ¿Ganador: <strong>{pending === match.player1.id ? match.player1.name : match.player2.name}</strong>?
                    </span>
                    <div className="flex gap-1.5 flex-shrink-0">
                        <button
                            onClick={confirm}
                            className="px-2.5 py-1 bg-green-500 text-white rounded-lg text-[10px] font-black hover:bg-green-600"
                        >
                            Sí
                        </button>
                        <button
                            onClick={() => setPending(null)}
                            className="px-2.5 py-1 bg-white border border-gray-200 text-gray-500 rounded-lg text-[10px] font-black hover:bg-gray-100"
                        >
                            No
                        </button>
                    </div>
                </div>
            )}

            {/* Deshacer resultado */}
            {hasWinner && (
                <div className="bg-green-50/60 border-t border-green-100 px-3 py-1 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                        <Check size={9} /> Finalizado
                    </span>
                    {isAdmin && (
                        <button
                            onClick={() => onClearWinner(match)}
                            className="text-[9px] text-gray-400 hover:text-red-500 underline transition-colors"
                        >
                            Deshacer
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default function RoundRobinView({ tournament, isAdmin }) {
    const [players, setPlayers] = useState([]);
    const [matches, setMatches] = useState([]);
    const [generating, setGenerating] = useState(false);

    // Versión en vivo del torneo (para leer tournament.groups actualizado)
    const liveTournament = tournament;

    useEffect(() => {
        if (!tournament?.id) return;
        const q = query(collection(db, `tournaments/${tournament.id}/players`));
        return onSnapshot(q, snap => {
            setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, [tournament?.id]);

    useEffect(() => {
        if (!tournament?.id) { setMatches([]); return; }
        const q = query(collection(db, `tournaments/${tournament.id}/matches`));
        return onSnapshot(q, snap => {
            setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
    }, [tournament?.id]);

    const generateGroups = async () => {
        if (players.length < 3) { alert('Mínimo 3 jugadores para fases de grupos.'); return; }
        if (!confirm('Esto reiniciará los grupos y todos los partidos. ¿Continuar?')) return;

        setGenerating(true);
        try {
            // 1. Borrar partidos existentes
            const existing = await getDocs(collection(db, `tournaments/${tournament.id}/matches`));
            if (!existing.empty) {
                const delBatch = writeBatch(db);
                existing.docs.forEach(d => delBatch.delete(d.ref));
                await delBatch.commit();
            }

            // 2. Distribuir jugadores en grupos
            const batch = writeBatch(db);
            const shuffled = [...players].sort(() => Math.random() - 0.5);
            const playersPerGroup = 4;
            const groupCount = Math.ceil(shuffled.length / playersPerGroup);
            const newGroups = {};

            shuffled.forEach((p, i) => {
                const gName = String.fromCharCode(65 + (i % groupCount));
                if (!newGroups[gName]) newGroups[gName] = [];
                newGroups[gName].push({ id: p.id, name: p.name });
            });

            // 3. Guardar grupos en el documento del torneo
            batch.update(doc(db, 'tournaments', tournament.id), { groups: newGroups });

            // 4. Generar partidos todos vs todos por grupo
            Object.entries(newGroups).forEach(([gName, gPlayers]) => {
                for (let i = 0; i < gPlayers.length; i++) {
                    for (let j = i + 1; j < gPlayers.length; j++) {
                        const mRef = doc(collection(db, `tournaments/${tournament.id}/matches`));
                        batch.set(mRef, {
                            type: 'round_robin',
                            groupId: gName,
                            round: 1,
                            player1: gPlayers[i],
                            player2: gPlayers[j],
                            winner: null,
                            status: 'pending',
                        });
                    }
                }
            });

            await batch.commit();
        } catch (e) {
            console.error('Error generando grupos:', e);
            alert('Error al generar grupos. Inténtalo de nuevo.');
        } finally {
            setGenerating(false);
        }
    };

    const handleSetWinner = async (match, winnerId) => {
        try {
            await updateDoc(doc(db, `tournaments/${tournament.id}/matches`, match.id), {
                winner: winnerId,
                status: 'completed',
            });
        } catch (e) { console.error(e); }
    };

    const handleClearWinner = async (match) => {
        try {
            await updateDoc(doc(db, `tournaments/${tournament.id}/matches`, match.id), {
                winner: null,
                status: 'pending',
            });
        } catch (e) { console.error(e); }
    };

    // Calcular tabla de posiciones
    const getStandings = () => {
        if (!liveTournament?.groups) return {};
        const standings = {};
        Object.keys(liveTournament.groups).forEach(g => {
            standings[g] = {};
            liveTournament.groups[g].forEach(p => {
                standings[g][p.id] = { name: p.name, played: 0, won: 0, lost: 0, points: 0 };
            });
        });
        matches
            .filter(m => m.type === 'round_robin' && m.winner)
            .forEach(m => {
                const g = standings[m.groupId];
                if (!g) return;
                const loserId = m.winner === m.player1.id ? m.player2.id : m.player1.id;
                if (g[m.winner]) { g[m.winner].played++; g[m.winner].won++; g[m.winner].points += 2; }
                if (g[loserId]) { g[loserId].played++; g[loserId].lost++; g[loserId].points += 0; }
            });
        return standings;
    };

    const standings = getStandings();
    const hasGroups = liveTournament?.groups && Object.keys(liveTournament.groups).length > 0;

    if (!tournament) {
        return (
            <div className="text-center py-20 text-gray-400">
                <p>Selecciona un torneo.</p>
            </div>
        );
    }

    return (
        <div className="py-2">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Fase de Grupos</h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {hasGroups
                            ? `${Object.keys(liveTournament.groups).length} grupo${Object.keys(liveTournament.groups).length !== 1 ? 's' : ''} activo${Object.keys(liveTournament.groups).length !== 1 ? 's' : ''}`
                            : isAdmin ? 'Genera los grupos para empezar' : 'Los grupos aún no se han sorteado'}
                    </p>
                </div>
                {isAdmin && (
                    <button
                        onClick={generateGroups}
                        disabled={generating || players.length < 3}
                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 shadow-sm text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                        {generating ? 'Generando…' : hasGroups ? 'Regenerar Grupos' : 'Generar Grupos'}
                    </button>
                )}
            </div>

            {/* Sin grupos */}
            {!hasGroups ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <LayoutGrid className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <h3 className="font-semibold text-gray-600 mb-1">No hay grupos generados</h3>
                    <p className="text-sm text-gray-400 mb-5">
                        {isAdmin
                            ? (players.length < 3
                                ? `Se necesitan al menos 3 jugadores (hay ${players.length})`
                                : `${players.length} jugadores listos para sortear`)
                            : 'El sorteo de grupos aún no se ha realizado.'}
                    </p>
                    {isAdmin && players.length >= 3 && (
                        <button
                            onClick={generateGroups}
                            className="bg-[#276767] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1e5555] transition-colors shadow-lg shadow-[#276767]/20"
                        >
                            Generar Grupos
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(liveTournament.groups).sort().map(([gName, gPlayers]) => {
                        const gStandings = gPlayers
                            .map(p => standings[gName]?.[p.id] ?? { name: p.name, played: 0, won: 0, lost: 0, points: 0 })
                            .sort((a, b) => b.points - a.points || b.won - a.won);

                        const gMatches = matches.filter(m => m.groupId === gName && m.type === 'round_robin');
                        const played = gMatches.filter(m => m.winner).length;
                        const total = gMatches.length;

                        return (
                            <div key={gName} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                {/* Header grupo */}
                                <div className="bg-gradient-to-r from-[#276767]/5 to-transparent px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-[#276767] text-white flex items-center justify-center font-black text-lg">
                                            {gName}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 leading-tight">Grupo {gName}</h3>
                                            <p className="text-xs text-gray-400">{gPlayers.length} jugadores</p>
                                        </div>
                                    </div>
                                    {/* Barra de progreso */}
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-gray-400 font-medium mb-1">{played}/{total} partidos</p>
                                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#83CB53] rounded-full transition-all"
                                                style={{ width: total > 0 ? `${(played / total) * 100}%` : '0%' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Tabla de posiciones */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-50">
                                                <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider w-8">#</th>
                                                <th className="text-left px-3 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Jugador</th>
                                                <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">PJ</th>
                                                <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">PG</th>
                                                <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">PP</th>
                                                <th className="text-center px-3 py-3 text-xs font-bold text-[#276767] uppercase tracking-wider">PTS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {gStandings.map((stats, idx) => (
                                                <tr key={stats.name} className={`transition-colors ${idx === 0 ? 'bg-amber-50/40' : 'hover:bg-gray-50/60'}`}>
                                                    <td className="px-6 py-3">
                                                        <PosBadge pos={idx} />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded-full bg-[#276767]/10 text-[#276767] flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                                                {initials(stats.name)}
                                                            </div>
                                                            <span className="font-semibold text-gray-900">{stats.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-center text-gray-500">{stats.played}</td>
                                                    <td className="px-3 py-3 text-center text-gray-500">{stats.won}</td>
                                                    <td className="px-3 py-3 text-center text-gray-500">{stats.lost}</td>
                                                    <td className="px-3 py-3 text-center">
                                                        <span className={`font-black text-base ${idx === 0 ? 'text-amber-600' : 'text-[#276767]'}`}>
                                                            {stats.points}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Partidos */}
                                {gMatches.length > 0 && (
                                    <div className="px-6 py-5 bg-gray-50/30 border-t border-gray-100">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Partidos del Grupo</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                            {gMatches.map(m => (
                                                <MatchPill
                                                    key={m.id}
                                                    match={m}
                                                    isAdmin={isAdmin}
                                                    onSetWinner={handleSetWinner}
                                                    onClearWinner={handleClearWinner}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
