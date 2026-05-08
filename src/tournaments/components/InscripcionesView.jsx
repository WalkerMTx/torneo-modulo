import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Check, X, Users, Clock, Link2, UserCheck, MoreHorizontal, AlertTriangle, RefreshCw } from 'lucide-react';
import { db } from '../../../firebase';
import {
    collection, query, onSnapshot, deleteDoc, doc,
    updateDoc, addDoc, getDocs, orderBy,
} from 'firebase/firestore';

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function PayBadge({ status, onClick }) {
    const paid = status === 'paid';
    return (
        <button
            onClick={onClick}
            disabled={!onClick}
            title={paid ? 'Pagado' : 'Pendiente'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
                paid
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
            } ${onClick ? 'hover:scale-105 active:scale-95 cursor-pointer ' + (paid ? 'hover:bg-green-200' : 'hover:bg-amber-100') : 'cursor-default opacity-80'}`}
        >
            {paid ? <Check size={10} /> : <Clock size={10} />}
            {paid ? 'Pagado' : 'Pendiente'}
        </button>
    );
}

// ── Modal para vincular jugador manual con cuenta de la app ─────────────────
function LinkModal({ player, appUsers, onLink, onClose }) {
    const [linkSearch, setLinkSearch] = useState('');
    const [linking, setLinking] = useState(false);

    const filtered = appUsers.filter(u =>
        u.name?.toLowerCase().includes(linkSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(linkSearch.toLowerCase())
    );

    const handleLink = async (appUser) => {
        setLinking(true);
        await onLink(player, appUser);
        setLinking(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div>
                        <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                            <Link2 size={16} className="text-[#276767]" />
                            Vincular Cuenta
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Vinculando: <span className="font-bold text-gray-600">{player.name}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                        <X size={16} />
                    </button>
                </div>

                {/* Búsqueda */}
                <div className="px-4 pt-4 pb-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Buscar por nombre o correo…"
                            value={linkSearch}
                            onChange={e => setLinkSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#276767]/20 focus:border-[#276767]"
                        />
                    </div>
                </div>

                {/* Lista de usuarios */}
                <div className="max-h-64 overflow-y-auto px-2 pb-4">
                    {filtered.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-6">No se encontraron usuarios</p>
                    ) : filtered.map(u => (
                        <button
                            key={u.uid}
                            onClick={() => handleLink(u)}
                            disabled={linking}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#276767]/5 transition-colors text-left disabled:opacity-50"
                        >
                            {u.avatar ? (
                                <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-[#276767]/10 text-[#276767] flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {initials(u.name)}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-900 truncate">{u.name}</p>
                                <p className="text-xs text-gray-400 truncate">{u.email}</p>
                            </div>
                            <Link2 size={14} className="text-gray-300 flex-shrink-0" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Componente principal ────────────────────────────────────────────────────
export default function InscripcionesView({ tournament, isAdmin, user }) {
    const isDoubles = tournament?.type === 'doubles';

    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    // Formulario agregar
    const [isAdding, setIsAdding] = useState(false);
    const [addMode, setAddMode] = useState('app'); // 'app' | 'manual'
    const [newName, setNewName] = useState('');
    const [newName2, setNewName2] = useState('');
    const [saving, setSaving] = useState(false);
    const [enrolling, setEnrolling] = useState(false);

    // App users (para selección y vinculación)
    const [appUsers, setAppUsers] = useState([]);
    const [appUsersLoaded, setAppUsersLoaded] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [selectedAppUser, setSelectedAppUser] = useState(null);

    // Vinculación de jugador manual
    const [linkTarget, setLinkTarget] = useState(null);

    // Acciones admin sobre jugadores
    const [actionMenuOpen, setActionMenuOpen] = useState(null); // player.id abierto
    const [removeModal, setRemoveModal] = useState({ isOpen: false, player: null });
    const [removeReason, setRemoveReason] = useState('');
    const [removing, setRemoving] = useState(false);
    const [replaceModal, setReplaceModal] = useState({ isOpen: false, player: null });
    const [replaceSearch, setReplaceSearch] = useState('');
    const [replaceTarget, setReplaceTarget] = useState(null);
    const [replacing, setReplacing] = useState(false);

    // ── Escuchar jugadores del torneo ───────────────────────────────────────
    useEffect(() => {
        if (!tournament?.id) { setPlayers([]); return; }
        setLoading(true);
        const q = query(collection(db, `tournaments/${tournament.id}/players`));
        const unsub = onSnapshot(q, snap => {
            const list = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
            setPlayers(list);
            setLoading(false);
        });
        return unsub;
    }, [tournament?.id]);

    // ── Cargar usuarios de la app (solo admin, una vez) ─────────────────────
    const loadAppUsers = useCallback(async () => {
        if (appUsersLoaded || !isAdmin) return;
        try {
            const snap = await getDocs(query(collection(db, 'users'), orderBy('name')));
            setAppUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
            setAppUsersLoaded(true);
        } catch (e) {
            console.error('Error cargando usuarios:', e);
        }
    }, [appUsersLoaded, isAdmin]);

    // Cargar al abrir el panel de agregar
    useEffect(() => {
        if (isAdding && isAdmin) loadAppUsers();
    }, [isAdding, isAdmin, loadAppUsers]);

    // ── Agregar desde usuario de la app ─────────────────────────────────────
    const handleAddFromApp = async () => {
        if (!selectedAppUser || !tournament?.id) return;
        setSaving(true);
        try {
            await addDoc(collection(db, `tournaments/${tournament.id}/players`), {
                name: selectedAppUser.name,
                userId: selectedAppUser.uid,
                email: selectedAppUser.email || null,
                avatar: selectedAppUser.avatar || null,
                registeredAt: new Date().toISOString(),
                paymentStatus: 'pending',
                addedByAdmin: true,
            });
            closeAddForm();
        } catch (err) {
            console.error('Error al inscribir desde app:', err);
        } finally {
            setSaving(false);
        }
    };

    // ── Agregar de forma manual ──────────────────────────────────────────────
    const handleAddManual = async (e) => {
        e.preventDefault();
        if (!newName.trim() || !tournament?.id) return;
        const finalName = isDoubles && newName2.trim()
            ? `${newName.trim()} / ${newName2.trim()}`
            : newName.trim();
        setSaving(true);
        try {
            await addDoc(collection(db, `tournaments/${tournament.id}/players`), {
                name: finalName,
                registeredAt: new Date().toISOString(),
                paymentStatus: 'pending',
                addedByAdmin: true,
            });
            closeAddForm();
        } catch (err) {
            console.error('Error al inscribir manualmente:', err);
        } finally {
            setSaving(false);
        }
    };

    const closeAddForm = () => {
        setIsAdding(false);
        setNewName('');
        setNewName2('');
        setUserSearch('');
        setSelectedAppUser(null);
    };

    // ── Auto-inscripción del usuario logueado ───────────────────────────────
    const handleSelfEnroll = async () => {
        if (!tournament?.id || !user) return;
        setEnrolling(true);
        try {
            await addDoc(collection(db, `tournaments/${tournament.id}/players`), {
                name: user.name || user.email?.split('@')[0] || 'Jugador',
                userId: user.uid,
                email: user.email || null,
                avatar: user.avatar || null,
                registeredAt: new Date().toISOString(),
                paymentStatus: 'pending',
            });
        } catch (err) {
            console.error('Error al autoinscribirse:', err);
        } finally {
            setEnrolling(false);
        }
    };

    // ── Vincular jugador manual con cuenta de la app ─────────────────────────
    const handleLink = async (player, appUser) => {
        try {
            await updateDoc(doc(db, `tournaments/${tournament.id}/players`, player.id), {
                userId: appUser.uid,
                email: appUser.email || null,
                avatar: appUser.avatar || null,
                // Actualizar nombre solo si el actual parece ser un placeholder
                ...(player.name !== appUser.name ? { linkedFromName: player.name } : {}),
            });
            setLinkTarget(null);
        } catch (e) { console.error(e); }
    };

    const handleTogglePayment = async (player) => {
        try {
            await updateDoc(doc(db, `tournaments/${tournament.id}/players`, player.id), {
                paymentStatus: player.paymentStatus === 'paid' ? 'pending' : 'paid',
            });
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (playerId) => {
        try {
            await deleteDoc(doc(db, `tournaments/${tournament.id}/players`, playerId));
        } catch (e) { console.error(e); }
    };

    const handleRemoveWithReason = async () => {
        if (!removeModal.player) return;
        setRemoving(true);
        try {
            await deleteDoc(doc(db, `tournaments/${tournament.id}/players`, removeModal.player.id));
            setRemoveModal({ isOpen: false, player: null });
            setRemoveReason('');
        } catch (e) { console.error(e); }
        setRemoving(false);
    };

    const handleReplacePlayer = async () => {
        if (!replaceTarget || !replaceModal.player) return;
        setReplacing(true);
        try {
            await updateDoc(doc(db, `tournaments/${tournament.id}/players`, replaceModal.player.id), {
                name: replaceTarget.name,
                userId: replaceTarget.uid,
                email: replaceTarget.email || null,
                avatar: replaceTarget.avatar || null,
                replacedAt: new Date().toISOString(),
                replacedFrom: replaceModal.player.name,
            });
            setReplaceModal({ isOpen: false, player: null });
            setReplaceTarget(null);
            setReplaceSearch('');
        } catch (e) { console.error(e); }
        setReplacing(false);
    };

    // ── Filtros y cómputos ──────────────────────────────────────────────────
    const filtered = players.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase())
    );
    const paidCount = players.filter(p => p.paymentStatus === 'paid').length;
    const pendingCount = players.length - paidCount;
    const isEnrolled = players.some(p => p?.userId === user?.uid);
    const entryLabel = isDoubles ? 'pareja' : 'jugador';
    const entryLabelCap = isDoubles ? 'Pareja' : 'Jugador';

    // Usuarios disponibles (no ya inscritos por userId)
    const enrolledUserIds = players.filter(p => p.userId).map(p => p.userId);
    const availableUsers = appUsers.filter(u => !enrolledUserIds.includes(u.uid));
    const filteredAppUsers = availableUsers.filter(u =>
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
    );

    if (!tournament) {
        return (
            <div className="text-center py-20 text-gray-400">
                <p>Selecciona un torneo para ver las inscripciones.</p>
            </div>
        );
    }

    return (
        <div className="py-2">
            {/* Modal de vinculación */}
            {linkTarget && (
                <LinkModal
                    player={linkTarget}
                    appUsers={appUsers.filter(u => !enrolledUserIds.includes(u.uid) || u.uid === linkTarget.userId)}
                    onLink={handleLink}
                    onClose={() => setLinkTarget(null)}
                />
            )}

            {/* ── Modal: Retirar por incumplimiento ─────────────────────── */}
            {removeModal.isOpen && removeModal.player && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-amber-50">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                                    <AlertTriangle size={18} className="text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-900 text-base">Retirar jugador</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Por incumplimiento de las normas</p>
                                </div>
                            </div>
                            <button onClick={() => { setRemoveModal({ isOpen: false, player: null }); setRemoveReason(''); }} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#276767]/10 text-[#276767] flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {initials(removeModal.player.name)}
                                </div>
                                <span className="font-semibold text-gray-900 text-sm">{removeModal.player.name}</span>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Motivo (opcional)</label>
                                <textarea
                                    value={removeReason}
                                    onChange={e => setRemoveReason(e.target.value)}
                                    placeholder="Ej: No pagó la inscripción, no se presentó al torneo..."
                                    rows={3}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none"
                                />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleRemoveWithReason}
                                    disabled={removing}
                                    className="flex-1 flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-all"
                                >
                                    {removing ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <AlertTriangle size={15} />}
                                    {removing ? 'Retirando...' : 'Confirmar retiro'}
                                </button>
                                <button
                                    onClick={() => { setRemoveModal({ isOpen: false, player: null }); setRemoveReason(''); }}
                                    className="px-4 py-2.5 rounded-xl font-bold text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Reemplazar jugador ──────────────────────────────── */}
            {replaceModal.isOpen && replaceModal.player && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <RefreshCw size={16} className="text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-900 text-base">Reemplazar jugador</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">Reemplazando a <span className="font-bold text-gray-600">{replaceModal.player.name}</span></p>
                                </div>
                            </div>
                            <button onClick={() => { setReplaceModal({ isOpen: false, player: null }); setReplaceTarget(null); setReplaceSearch(''); }} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Buscar nuevo jugador por nombre..."
                                    value={replaceSearch}
                                    onChange={e => { setReplaceSearch(e.target.value); setReplaceTarget(null); }}
                                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                />
                            </div>
                            <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
                                {appUsers.filter(u =>
                                    !enrolledUserIds.includes(u.uid) &&
                                    u.uid !== replaceModal.player?.userId &&
                                    (u.name?.toLowerCase().includes(replaceSearch.toLowerCase()) || u.email?.toLowerCase().includes(replaceSearch.toLowerCase()))
                                ).length === 0 ? (
                                    <div className="py-8 text-center text-sm text-gray-400">No se encontraron usuarios disponibles</div>
                                ) : appUsers.filter(u =>
                                    !enrolledUserIds.includes(u.uid) &&
                                    u.uid !== replaceModal.player?.userId &&
                                    (u.name?.toLowerCase().includes(replaceSearch.toLowerCase()) || u.email?.toLowerCase().includes(replaceSearch.toLowerCase()))
                                ).map(u => {
                                    const isSel = replaceTarget?.uid === u.uid;
                                    return (
                                        <button key={u.uid} onClick={() => setReplaceTarget(isSel ? null : u)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${isSel ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-gray-50'}`}>
                                            {u.avatar ? (
                                                <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-[#276767]/10 text-[#276767] flex items-center justify-center text-xs font-bold flex-shrink-0">{initials(u.name)}</div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm text-gray-900 truncate">{u.name}</p>
                                                <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSel ? 'border-blue-500 bg-blue-500' : 'border-gray-200'}`}>
                                                {isSel && <Check size={10} className="text-white" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleReplacePlayer}
                                    disabled={!replaceTarget || replacing}
                                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                    {replacing ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <RefreshCw size={15} />}
                                    {replacing ? 'Reemplazando...' : replaceTarget ? `Poner a ${replaceTarget.name}` : 'Selecciona jugador'}
                                </button>
                                <button
                                    onClick={() => { setReplaceModal({ isOpen: false, player: null }); setReplaceTarget(null); setReplaceSearch(''); }}
                                    className="px-4 py-2.5 rounded-xl font-bold text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Inscripciones</h2>
                    {players.length > 0 && (
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-gray-400">
                                <strong className="text-gray-700">{players.length}</strong> {entryLabel}s
                            </span>
                            <span className="text-gray-200">|</span>
                            <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                                <Check size={11} /> {paidCount} pagados
                            </span>
                            {pendingCount > 0 && (
                                <>
                                    <span className="text-gray-200">|</span>
                                    <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                                        <Clock size={11} /> {pendingCount} pendientes
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {isAdmin && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {/* Búsqueda */}
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={15} />
                            <input
                                type="text"
                                placeholder={`Buscar ${entryLabel}…`}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#276767]/20 focus:border-[#276767] w-full sm:w-48 transition-all"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        {!isAdding && (
                            <button
                                onClick={() => { setIsAdding(true); setAddMode('app'); }}
                                className="flex items-center gap-2 bg-[#276767] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1e5555] transition-colors shadow-lg shadow-[#276767]/20 flex-shrink-0"
                            >
                                <Plus size={16} />
                                <span className="hidden sm:inline">Inscribir</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Panel de inscripción (Admin) ─────────────────────────────── */}
            {isAdding && isAdmin && (
                <div className="mb-5 bg-[#276767]/5 border border-[#276767]/20 rounded-2xl overflow-hidden">
                    {/* Tabs modo */}
                    <div className="flex border-b border-[#276767]/10">
                        <button
                            onClick={() => { setAddMode('app'); setSelectedAppUser(null); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors ${
                                addMode === 'app'
                                    ? 'bg-white text-[#276767] border-b-2 border-[#276767]'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/40'
                            }`}
                        >
                            <UserCheck size={15} />
                            Desde la App
                        </button>
                        <button
                            onClick={() => setAddMode('manual')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors ${
                                addMode === 'manual'
                                    ? 'bg-white text-[#276767] border-b-2 border-[#276767]'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/40'
                            }`}
                        >
                            <Plus size={15} />
                            Manual
                        </button>
                    </div>

                    <div className="p-4">
                        {/* ── Modo App: buscar usuario real ────────────────── */}
                        {addMode === 'app' && (
                            <div className="flex flex-col gap-3">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Buscar usuario por nombre o correo…"
                                        value={userSearch}
                                        onChange={e => { setUserSearch(e.target.value); setSelectedAppUser(null); }}
                                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#276767]/20 focus:border-[#276767] bg-white"
                                    />
                                </div>

                                {/* Lista de usuarios */}
                                <div className="max-h-52 overflow-y-auto rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
                                    {filteredAppUsers.length === 0 ? (
                                        <div className="py-8 text-center text-sm text-gray-400">
                                            {availableUsers.length === 0
                                                ? 'Todos los usuarios ya están inscritos'
                                                : 'No se encontraron coincidencias'}
                                        </div>
                                    ) : filteredAppUsers.map(u => {
                                        const isSelected = selectedAppUser?.uid === u.uid;
                                        return (
                                            <button
                                                key={u.uid}
                                                onClick={() => setSelectedAppUser(isSelected ? null : u)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                                    isSelected
                                                        ? 'bg-[#276767]/8 ring-1 ring-inset ring-[#276767]/20'
                                                        : 'hover:bg-gray-50'
                                                }`}
                                            >
                                                {u.avatar ? (
                                                    <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-[#276767]/10 text-[#276767] flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                        {initials(u.name)}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-gray-900 truncate">{u.name}</p>
                                                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                    isSelected ? 'border-[#276767] bg-[#276767]' : 'border-gray-200'
                                                }`}>
                                                    {isSelected && <Check size={11} className="text-white" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Acciones */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAddFromApp}
                                        disabled={!selectedAppUser || saving}
                                        className="flex-1 flex items-center justify-center gap-2 bg-[#276767] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1e5555] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        {saving ? (
                                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <UserCheck size={16} />
                                        )}
                                        {saving ? 'Inscribiendo…'
                                            : selectedAppUser ? `Inscribir a ${selectedAppUser.name}`
                                            : 'Selecciona un usuario'}
                                    </button>
                                    <button
                                        onClick={closeAddForm}
                                        className="px-4 py-2.5 rounded-xl font-bold text-sm text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Modo Manual ──────────────────────────────────── */}
                        {addMode === 'manual' && (
                            <form onSubmit={handleAddManual} className="flex flex-col gap-3">
                                {isDoubles ? (
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="w-8 h-8 rounded-full bg-[#276767] text-white flex items-center justify-center text-xs font-black flex-shrink-0">1</div>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newName}
                                                onChange={e => setNewName(e.target.value)}
                                                placeholder="Nombre del jugador 1…"
                                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#276767]/20 focus:border-[#276767] bg-white"
                                                required
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="w-8 h-8 rounded-full bg-orange-400 text-white flex items-center justify-center text-xs font-black flex-shrink-0">2</div>
                                            <input
                                                type="text"
                                                value={newName2}
                                                onChange={e => setNewName2(e.target.value)}
                                                placeholder="Nombre del jugador 2…"
                                                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#276767]/20 focus:border-[#276767] bg-white"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#276767]/10 text-[#276767] flex items-center justify-center font-bold text-sm flex-shrink-0">
                                            <Plus size={18} />
                                        </div>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            placeholder="Nombre del jugador…"
                                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#276767]/20 focus:border-[#276767] bg-white"
                                            required
                                        />
                                    </div>
                                )}

                                {isDoubles && newName.trim() && newName2.trim() && (
                                    <div className="text-xs text-[#276767] font-bold px-1 flex items-center gap-1.5">
                                        <Check size={12} /> Se registrará como: <span className="font-black">{newName.trim()} / {newName2.trim()}</span>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={saving || !newName.trim()}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#276767] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#1e5555] disabled:opacity-50 transition-all"
                                    >
                                        {saving ? (
                                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Check size={16} />
                                        )}
                                        {saving ? 'Guardando…' : isDoubles ? 'Agregar Pareja' : 'Agregar'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeAddForm}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-500 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all"
                                    >
                                        <X size={16} />
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ── VISTA ADMIN: tabla completa ─────────────────────────────── */}
            {isAdmin && (
                loading && !players.length ? (
                    <div className="text-center py-20">
                        <div className="inline-block w-8 h-8 border-4 border-[#276767]/20 border-t-[#276767] rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        {search ? (
                            <>
                                <h3 className="font-semibold text-gray-600 mb-1">Sin resultados</h3>
                                <p className="text-sm text-gray-400">No hay {entryLabel}s que coincidan con &quot;{search}&quot;</p>
                                <button onClick={() => setSearch('')} className="mt-3 text-sm text-[#276767] font-semibold hover:underline">Limpiar búsqueda</button>
                            </>
                        ) : (
                            <>
                                <h3 className="font-semibold text-gray-600 mb-1">Sin inscripciones</h3>
                                <p className="text-sm text-gray-400">Usa el botón &quot;Inscribir&quot; para agregar {entryLabel}s.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">#</th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{entryLabelCap}</th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Inscrito</th>
                                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Pago</th>
                                        <th className="py-3 px-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.map((player, idx) => (
                                        <tr key={player.id} className="group hover:bg-gray-50/60 transition-colors">
                                            <td className="py-3 px-4 text-sm text-gray-300 font-medium w-10">{idx + 1}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    {player.avatar ? (
                                                        <img src={player.avatar} alt={player.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-[#276767]/10" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-[#276767]/10 text-[#276767] flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                            {initials(player.name)}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <span className="font-semibold text-gray-900 block truncate">{player.name}</span>
                                                        {player.userId ? (
                                                            <span className="text-[10px] text-[#276767] font-semibold flex items-center gap-0.5">
                                                                <UserCheck size={9} /> Vinculado
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => { loadAppUsers(); setLinkTarget(player); }}
                                                                className="text-[10px] text-gray-400 hover:text-[#276767] flex items-center gap-0.5 transition-colors"
                                                            >
                                                                <Link2 size={9} /> Vincular cuenta
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 hidden sm:table-cell">
                                                <span className="text-xs text-gray-400">
                                                    {player.registeredAt
                                                        ? new Date(player.registeredAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
                                                        : '—'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <PayBadge status={player.paymentStatus} onClick={() => handleTogglePayment(player)} />
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="relative flex justify-end">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActionMenuOpen(actionMenuOpen === player.id ? null : player.id); }}
                                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                                                    >
                                                        <MoreHorizontal size={16} />
                                                    </button>
                                                    {actionMenuOpen === player.id && (
                                                        <>
                                                            <div className="fixed inset-0 z-10" onClick={() => setActionMenuOpen(null)} />
                                                            <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-52 py-1">
                                                                <button
                                                                    onClick={() => { setReplaceModal({ isOpen: true, player }); setActionMenuOpen(null); loadAppUsers(); }}
                                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                                                >
                                                                    <RefreshCw size={14} className="text-blue-500 flex-shrink-0" />
                                                                    Reemplazar jugador
                                                                </button>
                                                                <button
                                                                    onClick={() => { setRemoveModal({ isOpen: true, player }); setActionMenuOpen(null); }}
                                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                                                                >
                                                                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                                                                    Retirar por incumplimiento
                                                                </button>
                                                                <div className="my-1 border-t border-gray-100" />
                                                                <button
                                                                    onClick={() => { handleDelete(player.id); setActionMenuOpen(null); }}
                                                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                                                                >
                                                                    <X size={14} className="flex-shrink-0" />
                                                                    Eliminar del torneo
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {search && filtered.length !== players.length && (
                            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                                Mostrando {filtered.length} de {players.length} {entryLabel}s
                            </div>
                        )}
                    </div>
                )
            )}

            {/* ── VISTA CLIENTE: tarjetas visuales ────────────────────────── */}
            {!isAdmin && (
                <div className="space-y-5">

                    {/* Banner inscrito */}
                    {isEnrolled ? (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#276767] to-[#1a4f4f] p-5 text-white shadow-lg shadow-[#276767]/20">
                            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/5" />
                            <div className="absolute right-4 -bottom-8 w-24 h-24 rounded-full bg-white/5" />
                            <div className="relative flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/20">
                                    <Check size={26} className="text-white" strokeWidth={3} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/55 mb-0.5">Participación confirmada</p>
                                    <p className="text-xl font-black leading-tight">¡Estás inscrito!</p>
                                    <p className="text-sm text-white/65 mt-1 truncate">
                                        Puesto #{players.findIndex(p => p.userId === user?.uid) + 1} de {players.length} · {tournament.name}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : tournament.status !== 'completed' ? (
                        /* CTA inscripción */
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-6">
                            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-orange-100/50" />
                            <div className="relative flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                                <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <Users size={28} className="text-orange-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-black text-gray-900 text-lg leading-tight">¡Únete al torneo!</h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {players.length > 0
                                            ? `${players.length} ${entryLabel}${players.length !== 1 ? 's' : ''} ya inscrito${players.length !== 1 ? 's' : ''} · ¿Serás el próximo?`
                                            : 'Sé el primero en inscribirte.'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleSelfEnroll}
                                    disabled={enrolling}
                                    className="flex-shrink-0 inline-flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 active:scale-95 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50 w-full sm:w-auto"
                                >
                                    {enrolling ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Plus size={18} />}
                                    {enrolling ? 'Inscribiendo...' : 'Inscribirme al Torneo'}
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {/* Lista de participantes como tarjetas */}
                    {loading && !players.length ? (
                        <div className="text-center py-16">
                            <div className="inline-block w-8 h-8 border-4 border-[#276767]/20 border-t-[#276767] rounded-full animate-spin" />
                        </div>
                    ) : players.length === 0 ? (
                        <div className="text-center py-14 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <Users className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                            <h3 className="font-semibold text-gray-600 mb-1">Sin inscritos aún</h3>
                            <p className="text-sm text-gray-400">Sé el primero en apuntarte al torneo.</p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-black text-gray-800 text-base">Participantes</h3>
                                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                                    {players.length} {entryLabel}{players.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {players.map((player, idx) => {
                                    const isMe = player.userId === user?.uid;
                                    return (
                                        <div
                                            key={player.id}
                                            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all ${
                                                isMe
                                                    ? 'bg-gradient-to-r from-[#276767]/8 to-[#276767]/4 border-[#276767]/25 shadow-sm ring-1 ring-[#276767]/15'
                                                    : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                                            }`}
                                        >
                                            <span className={`text-xs font-black w-5 text-right leading-none flex-shrink-0 ${isMe ? 'text-[#276767]' : 'text-gray-300'}`}>
                                                {idx + 1}
                                            </span>
                                            {player.avatar ? (
                                                <img src={player.avatar} alt={player.name} className={`w-9 h-9 rounded-full object-cover flex-shrink-0 shadow-sm ${isMe ? 'ring-2 ring-[#276767]/40' : 'ring-1 ring-gray-100'}`} />
                                            ) : (
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                                                    isMe ? 'bg-[#276767] text-white shadow-md shadow-[#276767]/25' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {initials(player.name)}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm truncate leading-tight ${isMe ? 'text-[#276767]' : 'text-gray-900'}`}>
                                                    {player.name}
                                                </p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">
                                                    {player.registeredAt
                                                        ? new Date(player.registeredAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
                                                        : '—'}
                                                </p>
                                            </div>
                                            {isMe && (
                                                <span className="flex-shrink-0 px-2.5 py-1 rounded-full bg-[#276767] text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                                                    Tú
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
