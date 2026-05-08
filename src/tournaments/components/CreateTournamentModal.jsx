import { useState } from 'react';
import { Trophy, X } from 'lucide-react';

export default function CreateTournamentModal({ isOpen, onClose, onCreate }) {
    const [formData, setFormData] = useState({
        name: '',
        mode: 'elimination', // 'round_robin' or 'elimination'
        type: 'singles', // 'singles' or 'doubles'
        category: 'Libre', // 'A', 'B', 'C', 'Libre'
        matchRules: {
            bestOfSets: 3,
            finalSetMode: 'standard'
        }
    });

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onCreate(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Trophy className="text-orange-500" size={24} />
                        Nuevo Torneo
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Nombre del Torneo</label>
                        <input
                            type="text"
                            required
                            placeholder="Ej. Torneo Apertura 2024"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Modalidad</label>
                            <div className="space-y-2">
                                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.mode === 'elimination' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="elimination"
                                        checked={formData.mode === 'elimination'}
                                        onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                                        className="text-orange-600 focus:ring-orange-500"
                                    />
                                    <span className="text-sm font-medium">Eliminación Directa (Llaves)</span>
                                </label>
                                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.mode === 'round_robin' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="round_robin"
                                        checked={formData.mode === 'round_robin'}
                                        onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                                        className="text-orange-600 focus:ring-orange-500"
                                    />
                                    <span className="text-sm font-medium">Round Robin (Grupos)</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Juego</label>
                            <div className="space-y-2">
                                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.type === 'singles' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        name="type"
                                        value="singles"
                                        checked={formData.type === 'singles'}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium">Singles (Individual)</span>
                                </label>
                                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.type === 'doubles' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        name="type"
                                        value="doubles"
                                        checked={formData.type === 'doubles'}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium">Dobles (Parejas)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Categoría</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all appearance-none bg-white"
                        >
                            <option value="Libre">Libre / Open</option>
                            <option value="3ra">3ra Categoría</option>
                            <option value="4ta">4ta Categoría</option>
                            <option value="5ta">5ta Categoría</option>
                            <option value="Damas">Damas</option>
                            <option value="Mixto">Dobles Mixtos</option>
                            <option value="Kids">Kids / Junior</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Sets del Partido</label>
                            <div className="grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
                                {[3, 5].map((sets) => (
                                    <button
                                        key={sets}
                                        type="button"
                                        onClick={() => setFormData({
                                            ...formData,
                                            matchRules: { ...formData.matchRules, bestOfSets: sets }
                                        })}
                                        className={`rounded-lg px-3 py-2 text-sm font-black transition-colors ${formData.matchRules.bestOfSets === sets ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                    >
                                        Mejor de {sets}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Set Decisivo</label>
                            <select
                                value={formData.matchRules.finalSetMode}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    matchRules: { ...formData.matchRules, finalSetMode: e.target.value }
                                })}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all appearance-none bg-white"
                            >
                                <option value="standard">Set normal con tie-break</option>
                                <option value="super_tiebreak">Super tie-break a 10</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all transform hover:scale-[1.02]"
                        >
                            Crear Torneo
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
