# Torneo Modulo

Modulo de torneos extraido de la app Milligan Club.

Incluye:

- Cuadro de llaves visual.
- Inscripciones y gestion de jugadores.
- Round robin / fase de grupos.
- Marcador de tenis con tie-break, super tie-break y saque automatico.
- Utilidades puras de scoring en `src/tournaments/utils/tennisScore.js`.

## Import principal

```js
import {
  BracketsView,
  CreateTournamentModal,
  InscripcionesView,
  RoundRobinView,
  TournamentProvider,
  useTournament
} from './src/tournaments';
```

## Nota de integracion

Esta primera version conserva algunas dependencias de la app original, especialmente:

- Firebase/local shim.
- Tailwind CSS.
- Estructura de datos de torneos, jugadores y partidos.

El siguiente paso recomendado es convertir las llamadas directas a datos en adaptadores por props para usar el modulo en cualquier pagina sin depender de la app principal.
