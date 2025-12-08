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
