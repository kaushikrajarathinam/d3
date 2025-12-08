# D3: 2048 Grass Edition

## Game Design Vision

Play the game of 2048 outside by waking and collecting tokens!

## Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## Assignments

### D3.a: Core mechanics (token collection and crafting)

#### Steps

- [x] Draw one grid cell near the player
- [x] Loop to draw full grid around player
- [x] Use `luck()` to spawn deterministic tokens
- [x] Show token values directly on the grid
- [x] Allow clicking only within 3-cell radius
- [x] Implement picking up a token
- [x] Display held token in UI
- [x] Implement crafting by combining equal tokens
- [x] Detect win when crafted value reaches target
- [x] Cleanup pass to simplify code

### D3.b: Globe-spanning gameplay

#### Steps

- [x] Add movement buttons to move player across the map
- [x] Use earth-spanning grid
- [x] Redraw grid as the map scrolls around the player
- [x] Spawn tokens anywhere using `luck()` (2 or 4 values to match 2048)
- [x] Keep interaction limited to nearby cells
- [x] pickup, drop, and combine actions while moving
- [x] win goal to higher value --> 128
- [x] Forget off-screen cell state
- [] Fix lag.
- [x] Cleanup code for readability

### D3.c: Object persistence

#### Steps

- [x] Keep using earth-spanning grid anchored at 0,0
- [x] Store only modified cells in a `Map` (`changedCells`)
- [x] Use `getToken` to merge default luck-based spawn with saved state
- [x] Redraw visible cells from scratch on every `moveend`
- [x] Stop trimming `changedCells` when cells go off-screen
- [x] Make cells remember crafted/cleared tokens when you scroll away and back
- [x] Keep movement buttons and interaction rules from previous
- [x] Raise win target again for D3.c playtesting
- [x] Cleanup pass and add comments showing memento.

### D3.d: Gameplay across real-world space and time

#### Steps

- [x] Add localStorage keys for cells, held token, player position, and movement mode
- [x] Save and load `changedCells` so crafted tokens persist across reloads
- [x] Save and load the held token value and show it in the UI
- [x] Save and load the player’s last position and restore it on page load
- [x] Define a `MovementFacade` interface (`step`, `useButtons`, `useGeolocation`)
- [x] Implement button-based movement using grid steps through the facade
- [x] Implement geolocation movement using `watchPosition` and snap to nearest cell
- [x] Add a toggle button to switch between button and geolocation modes and persist choice
- [x] Add a “New Game” button to clear saved state and reset the world
- [x] Make sure `redrawCells()` works with both movement modes and restored state
- [x] Added a new div block to render a nice clean box for all the buttons.
- [x] Make near by tiles highlighted orange.
