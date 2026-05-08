# Tournaments Feature

This folder contains the tournament module extracted from the main app structure.

## Contents

- `components/BracketsView.jsx`: elimination bracket, match scoring, serving state, display links.
- `components/InscripcionesView.jsx`: tournament registrations and player management.
- `components/RoundRobinView.jsx`: group phase generation and results.
- `components/CreateTournamentModal.jsx`: tournament creation form and match rules.
- `context/TournamentContext.jsx`: local tournament state provider.
- `utils/tennisScore.js`: tennis scoring rules, tie-breaks, super tie-breaks, serving helpers.

## Current App Dependencies

The module still depends on the app's Firebase/local shim and Tailwind styles:

- `src/firebase.js`
- `src/local/localStore.js`
- Tailwind utility classes

For a standalone GitHub package, the safest next step is to replace direct data calls with adapter props such as `loadPlayers`, `loadMatches`, `updateMatch`, and `createTournament`.
