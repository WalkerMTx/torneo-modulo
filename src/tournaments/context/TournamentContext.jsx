import { createContext, useContext, useEffect, useState } from 'react';
import { localStore, makeId } from '../../../local/localStore';

const TournamentContext = createContext();

const PLAYER_NAMES = [
    'Alejandro Ramos', 'Mateo Salazar', 'Diego Herrera', 'Nicolas Vargas', 'Sebastian Leon', 'Gabriel Rojas', 'Lucas Medina', 'Emilio Castro',
    'Santiago Paredes', 'Andres Navarro', 'Tomas Valdez', 'Daniel Ibarra', 'Joaquin Campos', 'Martin Espinoza', 'Rodrigo Silva', 'Franco Caceres',
    'Pablo Miranda', 'Ignacio Torres', 'Bruno Figueroa', 'Adrian Molina', 'Rafael Soto', 'Cristian Luna', 'Mauricio Peña', 'Fernando Arias',
    'Oscar Benites', 'Alonso Quiroz', 'Hugo Villanueva', 'Marcos Delgado', 'Renato Fuentes', 'Esteban Ponce', 'Gonzalo Vega', 'Camilo Reyes',
    'Valeria Costa', 'Luciana Bravo', 'Camila Ortega', 'Fernanda Rivas', 'Maria Paz', 'Sofia Aguirre', 'Isabella Cardenas', 'Antonella Mora',
    'Daniela Hidalgo', 'Paula Carranza', 'Regina Palacios', 'Bianca Seminario', 'Ximena Robles', 'Alessandra Vidal', 'Micaela Gallo', 'Natalia Acosta',
    'Elena Cornejo', 'Claudia Montoya', 'Ana Lucia', 'Mariana Flores', 'Andrea Bustamante', 'Victoria Nieto', 'Catalina Merino', 'Renata Velasco',
    'Jimena Prado', 'Mafer Linares', 'Carolina Pastor', 'Gabriela Lozano', 'Romina Cabrera', 'Fiorella Vera', 'Clara Zamora', 'Lucia Solis'
];

const ensureMilligan64 = () => {
    const tournaments = localStore.collection('tournaments');
    let tournament = tournaments.find((item) => item.id === 'milligan-open-64');
    if (!tournament) {
        tournament = {
            id: 'milligan-open-64',
            name: 'Milligan Open 64',
            category: 'Libre',
            type: 'singles',
            mode: 'elimination',
            status: 'in_progress',
            date: new Date().toISOString().slice(0, 10),
            createdAt: new Date().toISOString(),
            capacity: 64,
            matchRules: {
                bestOfSets: 3,
                finalSetMode: 'standard'
            }
        };
        localStore.upsert('tournaments', tournament);
    }

    const playersKey = `tournaments_${tournament.id}_players`;
    const currentPlayers = localStore.collection(playersKey);
    if (currentPlayers.length < 64) {
        const existingNames = new Set(currentPlayers.map((player) => player.name));
        const missingPlayers = PLAYER_NAMES
            .filter((name) => !existingNames.has(name))
            .slice(0, 64 - currentPlayers.length)
            .map((name, index) => ({
                id: `seed_${String(currentPlayers.length + index + 1).padStart(2, '0')}`,
                name,
                seed: currentPlayers.length + index + 1,
                registeredAt: new Date().toISOString(),
                paymentStatus: 'paid',
                addedByAdmin: true
            }));
        localStore.setCollection(playersKey, [...currentPlayers, ...missingPlayers]);
    }
};

export function TournamentProvider({ children }) {
    const [tournaments, setTournaments] = useState(localStore.collection('tournaments'));

    useEffect(() => {
        ensureMilligan64();
        const refresh = () => {
            const rows = localStore.collection('tournaments').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setTournaments(rows);
        };
        refresh();
        window.addEventListener('milligan-local-change', refresh);
        return () => window.removeEventListener('milligan-local-change', refresh);
    }, []);

    const addTournament = async (data) => {
        const item = localStore.upsert('tournaments', {
            ...data,
            id: makeId('tournament'),
            createdAt: new Date().toISOString(),
            status: 'draft'
        });
        return { success: true, id: item.id };
    };

    const updateTournament = async (id, updates) => {
        localStore.patch('tournaments', id, updates);
        return { success: true };
    };

    const deleteTournament = async (id) => {
        localStore.remove('tournaments', id);
        return { success: true };
    };

    const addTournamentPlayer = async (tournamentId, playerData) => {
        const collectionName = `tournaments_${tournamentId}_players`;
        localStore.upsert(collectionName, { ...playerData, id: makeId('player') });
        return { success: true };
    };

    return (
        <TournamentContext.Provider value={{
            tournaments,
            addTournament,
            updateTournament,
            deleteTournament,
            addTournamentPlayer
        }}>
            {children}
        </TournamentContext.Provider>
    );
}

export const useTournament = () => useContext(TournamentContext);
