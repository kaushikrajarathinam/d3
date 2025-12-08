# CMPM 121 D3 Project

## Basic Gameplay

For this, I wrote in main.ts so the core of the game is a Leaflet map centered on the classroom location. I used a fixed cell size (1e-4) and drawCell + redrawCells to return a full grid of rectangles around the map center, so it looks like the map is tiled in squares. Each cell's token is generated deterministically with spawnToken, which makes luck([i, j "spawn"]), and either returns 1 or nothing. The getToken function first checks achangedCells map for any player modified state, and then falls back to regular behavior. Tokens are visible without clicking because drawcells creates a permanent tooltip ahowing the value. Interactions happen through clickCell, which works if the target is close to the user of around 3 cell radius. This functon handles the picking up of the toekn, crafting a equal-value tokens into a new value of double the amount and updating the message on screen. Finally checkWin detects when teh player is holding a token of atleast value 16, and then sends the win message. These are the functions I outlined for part A as my basic gameplay.

## D3.b: Globe-spanning Gameplay

For this, i extended the game so the player can move across a world sized grid instead of being fixed in place. I anchored the coords system at (0,0) abd ysed latLngTocell + celltoLatLng so movement happens in discrete grid steps. I put some movement buttons that shift the player one cell in all 4 directions and recenters the map upon clicking. Token spawns are now different, still use luck, but they now spawn as 2 and 4s to be similar to the 2048, B requirement met where I made cells forget their state if they are moved off the map. The win condition is raised to 128.

## D3.c: Object persistence

## D3.d: Gameplay Across Real-world Space and Time
