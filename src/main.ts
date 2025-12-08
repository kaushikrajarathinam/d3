// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// CONFIG - fixed
const CELL_SIZE = 1e-4;
const NEAR_RADIUS = 3;
const SPAWN_CHANCE = 0.25;
const WIN_VALUE = 2048;
const GRID_RANGE = 15;
const NULL_ISLAND = leaflet.latLng(0, 0);

// STORAGE KEYS
const STORAGE_CELLS = "worldOfBits.cells";
const STORAGE_HELD = "worldOfBits.held";
const STORAGE_PLAYER = "worldOfBits.player";
const STORAGE_MOVEMENT = "worldOfBits.movement";

// TYPES / STATE
type CellIndex = { i: number; j: number };
type MovementMode = "buttons" | "geo";

const changedCells = new Map<string, number | null>();
let held: number | null = null;
let won = false;

let cellLayers: leaflet.Layer[] = [];

// track current movement mode; default to "geo"
let currentMode: MovementMode = "geo";

// DOM
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";

// CONTROL PANEL MENU
Object.assign(controlPanelDiv.style, {
  position: "absolute",
  top: "8px",
  left: "8px",
  zIndex: "1000",
  display: "flex",
  flexDirection: "column",
  rowGap: "4px",
  padding: "6px 8px",
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  borderRadius: "4px",
  fontFamily: "sans-serif",
  fontSize: "12px",
});
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
Object.assign(statusPanelDiv.style, {
  position: "absolute",
  left: "8px",
  bottom: "8px",
  zIndex: "900",
  padding: "6px 8px",
  maxWidth: "320px",
  backgroundColor: "rgba(255, 255, 255, 0.9)",
  borderRadius: "4px",
  fontFamily: "sans-serif",
  fontSize: "12px",
});
document.body.append(statusPanelDiv);

controlPanelDiv.innerHTML = `
  <div>Held token: <span id="held-token">none</span></div>
  <div>Target value: <span id="target-value">${WIN_VALUE}</span></div>
`;

// movement buttons container
const moveDiv = document.createElement("div");
moveDiv.id = "move-buttons";
moveDiv.style.marginTop = "4px";
moveDiv.style.display = "flex";
moveDiv.style.alignItems = "center";
moveDiv.style.flexWrap = "wrap";
moveDiv.style.columnGap = "2px";

const moveLabel = document.createElement("span");
moveLabel.textContent = "Move:";
moveDiv.appendChild(moveLabel);

controlPanelDiv.appendChild(moveDiv);

// toggle movement mode button
const toggleButton = document.createElement("button");
toggleButton.id = "movement-toggle";
toggleButton.style.marginTop = "4px";
controlPanelDiv.appendChild(toggleButton);

// new game button
const newGameButton = document.createElement("button");
newGameButton.id = "new-game";
newGameButton.textContent = "New Game";
newGameButton.style.marginTop = "4px";
newGameButton.onclick = () => {
  if (!confirm("Start a new game and clear saved progress?")) return;
  localStorage.removeItem(STORAGE_CELLS);
  localStorage.removeItem(STORAGE_HELD);
  localStorage.removeItem(STORAGE_PLAYER);
  localStorage.removeItem(STORAGE_MOVEMENT);
  changedCells.clear();
  held = null;
  won = false;
  updateHeldUI();
  applyPlayerPosition(CLASSROOM);
  setStatus("New game started.");
  redrawCells();
};
controlPanelDiv.appendChild(newGameButton);

// STATUS DEFAULT MESSAGE
statusPanelDiv.textContent =
  "Move with geolocation (default) or buttons; click nearby cells to pick up, drop, or combine tokens.";

// ---- BUTTON HELPER + BUTTON CREATION ----
function addMoveButton(label: string, di: number, dj: number) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.style.marginLeft = "2px";
  btn.onclick = () => movement.step(di, dj);
  moveDiv.appendChild(btn);
}

addMoveButton("↑", 1, 0);
addMoveButton("↓", -1, 0);
addMoveButton("←", 0, -1);
addMoveButton("→", 0, 1);

// HELPERS
function key(i: number, j: number) {
  return `${i},${j}`;
}

function latLngToCell(lat: number, lng: number): CellIndex {
  return {
    i: Math.floor((lat - NULL_ISLAND.lat) / CELL_SIZE),
    j: Math.floor((lng - NULL_ISLAND.lng) / CELL_SIZE),
  };
}

function cellToLatLng(i: number, j: number): leaflet.LatLng {
  return leaflet.latLng(
    NULL_ISLAND.lat + (i + 0.5) * CELL_SIZE,
    NULL_ISLAND.lng + (j + 0.5) * CELL_SIZE,
  );
}

// MAP + PLAYER SETUP
const CLASSROOM = leaflet.latLng(36.997936938057016, -122.05703507501151);

const map = leaflet.map(mapDiv, {
  center: CLASSROOM,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: true,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const player = leaflet.marker(CLASSROOM);
player.bindTooltip("That's you!");
player.addTo(map);

// POSITION HELPERS
function getPlayerCell(): CellIndex {
  const p = player.getLatLng();
  return latLngToCell(p.lat, p.lng);
}

function inRange(i: number, j: number) {
  const pc = getPlayerCell();
  const di = Math.abs(i - pc.i);
  const dj = Math.abs(j - pc.j);
  return Math.max(di, dj) <= NEAR_RADIUS;
}

function applyPlayerPosition(pos: leaflet.LatLng) {
  player.setLatLng(pos);
  map.setView(pos, map.getZoom(), { animate: false });
  savePlayerPosition(pos);
}

function movePlayerByStep(di: number, dj: number) {
  const pc = getPlayerCell();
  const newI = pc.i + di;
  const newJ = pc.j + dj;
  const newPos = cellToLatLng(newI, newJ);
  applyPlayerPosition(newPos);
}

function movePlayerToGeo(lat: number, lng: number) {
  const cell = latLngToCell(lat, lng);
  const snapped = cellToLatLng(cell.i, cell.j);
  applyPlayerPosition(snapped);
}

// TOKEN SPAWNING / STATE
function spawnToken(i: number, j: number): number | null {
  const r = luck([i, j, "spawn"].toString());
  if (r >= SPAWN_CHANCE) return null;
  const fourChance = SPAWN_CHANCE * 0.2;
  return r < fourChance ? 4 : 2;
}

function getToken(i: number, j: number): number | null {
  const k = key(i, j);
  if (changedCells.has(k)) return changedCells.get(k) ?? null;
  return spawnToken(i, j);
}

function setToken(i: number, j: number, value: number | null) {
  changedCells.set(key(i, j), value);
  saveCells();
}

function setStatus(msg: string) {
  statusPanelDiv.textContent = msg;
}

function updateHeldUI() {
  const span = document.getElementById("held-token");
  if (!span) return;
  span.textContent = held === null ? "none" : held.toString();
}

function checkWin() {
  if (!won && held !== null && held >= WIN_VALUE) {
    won = true;
    const msg = `You crafted a token of value ${held}. You win!`;
    setStatus(msg);
    alert(msg);
  }
}

// PERSISTENCE
function saveCells() {
  const payload: Array<{ key: string; value: number | null }> = [];
  for (const [k, v] of changedCells.entries()) {
    payload.push({ key: k, value: v });
  }
  try {
    localStorage.setItem(STORAGE_CELLS, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

function loadCells() {
  try {
    const raw = localStorage.getItem(STORAGE_CELLS);
    if (!raw) return;
    const payload = JSON.parse(raw) as Array<
      { key: string; value: number | null }
    >;
    changedCells.clear();
    for (const entry of payload) {
      changedCells.set(entry.key, entry.value);
    }
  } catch {
    // ignore parse errors
  }
}

function saveHeld() {
  try {
    localStorage.setItem(STORAGE_HELD, JSON.stringify(held));
  } catch {
    // ignore storage errors
  }
}

function loadHeld() {
  try {
    const raw = localStorage.getItem(STORAGE_HELD);
    if (!raw) return;
    const v = JSON.parse(raw) as number | null;
    held = v ?? null;
  } catch {
    held = null;
  }
}

function savePlayerPosition(pos: leaflet.LatLng) {
  try {
    localStorage.setItem(
      STORAGE_PLAYER,
      JSON.stringify({ lat: pos.lat, lng: pos.lng }),
    );
  } catch {
    // ignore storage errors
  }
}

function loadPlayerPosition(): leaflet.LatLng | null {
  try {
    const raw = localStorage.getItem(STORAGE_PLAYER);
    if (!raw) return null;
    const p = JSON.parse(raw) as { lat: number; lng: number } | null;
    if (!p) return null;
    return leaflet.latLng(p.lat, p.lng);
  } catch {
    return null;
  }
}

function saveMovementMode(mode: MovementMode) {
  try {
    localStorage.setItem(STORAGE_MOVEMENT, mode);
  } catch {
    // ignore storage errors
  }
}

function loadMovementMode(): MovementMode | null {
  const raw = localStorage.getItem(STORAGE_MOVEMENT);
  if (raw === "geo" || raw === "buttons") return raw;
  return null;
}

// CELL INTERACTION
function clickCell(i: number, j: number) {
  if (!inRange(i, j)) {
    setStatus("That cell is too far away.");
    return;
  }

  const cellValue = getToken(i, j);

  if (held === null) {
    if (cellValue === null) {
      setStatus("No token here.");
      return;
    }
    held = cellValue;
    setToken(i, j, null);
    saveHeld();
    updateHeldUI();
    setStatus(`Picked up token value ${held}.`);
    redrawCells();
    checkWin();
    return;
  }

  if (cellValue === null) {
    setToken(i, j, held);
    setStatus(`Placed token value ${held}.`);
    held = null;
    saveHeld();
    updateHeldUI();
    redrawCells();
    return;
  }

  if (cellValue === held) {
    const newValue = held * 2;
    setToken(i, j, newValue);
    held = null;
    saveHeld();
    updateHeldUI();
    setStatus(`Combined into token value ${newValue}.`);
    redrawCells();
    checkWin();
    return;
  }

  setStatus(`Cannot combine held ${held} with cell ${cellValue}.`);
}

// RENDERING
function drawCell(i: number, j: number): leaflet.Layer {
  const lat0 = NULL_ISLAND.lat + i * CELL_SIZE;
  const lat1 = NULL_ISLAND.lat + (i + 1) * CELL_SIZE;
  const lng0 = NULL_ISLAND.lng + j * CELL_SIZE;
  const lng1 = NULL_ISLAND.lng + (j + 1) * CELL_SIZE;

  const value = getToken(i, j);
  const hasToken = value !== null;
  const isNear = hasToken && inRange(i, j);

  const rect = leaflet.rectangle(
    [
      [lat0, lng0],
      [lat1, lng1],
    ],
    {
      color: "#777",
      weight: 1,
      fillColor: hasToken ? (isNear ? "#ffcc88" : "#88ccff") : "#eeeeee",
      fillOpacity: hasToken ? (isNear ? 0.8 : 0.5) : 0.15,
    },
  );

  if (hasToken) {
    rect.bindTooltip(String(value), {
      permanent: true,
      direction: "center",
      className: "cell-label",
    });
  }

  rect.on("click", () => clickCell(i, j));
  rect.addTo(map);
  return rect;
}

function redrawCells() {
  for (const layer of cellLayers) map.removeLayer(layer);
  cellLayers = [];

  const center = map.getCenter();
  const centerCell = latLngToCell(center.lat, center.lng);

  const iMin = centerCell.i - GRID_RANGE;
  const iMax = centerCell.i + GRID_RANGE;
  const jMin = centerCell.j - GRID_RANGE;
  const jMax = centerCell.j + GRID_RANGE;

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      cellLayers.push(drawCell(i, j));
    }
  }
}

// MOVEMENT FACADE
interface MovementFacade {
  step(di: number, dj: number): void;
  useButtons(): void;
  useGeolocation(): void;
}

function createMovementFacade(): MovementFacade {
  let mode: MovementMode = "buttons"; // internal default; we control real mode via currentMode
  let geoWatchId: number | null = null;

  function stopGeo() {
    if (geoWatchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
    }
  }

  function startGeo() {
    if (!("geolocation" in navigator)) {
      setStatus("Geolocation is not available in this browser.");
      return;
    }
    stopGeo();
    geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        movePlayerToGeo(pos.coords.latitude, pos.coords.longitude);
        redrawCells();
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setStatus("Geolocation error; falling back to buttons.");
        movement.useButtons();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  }

  return {
    step(di, dj) {
      if (mode !== "buttons") return;
      movePlayerByStep(di, dj);
      redrawCells();
    },

    useButtons() {
      mode = "buttons";
      currentMode = "buttons";
      stopGeo();
      moveDiv.style.display = "";
      toggleButton.textContent = "Use Geolocation";
      saveMovementMode(currentMode);
      setStatus("Button movement enabled.");
    },

    useGeolocation() {
      mode = "geo";
      currentMode = "geo";
      moveDiv.style.display = "none";
      toggleButton.textContent = "Use Buttons";
      saveMovementMode(currentMode);
      setStatus("Geolocation movement enabled.");
      startGeo();
    },
  };
}

// attach facade now that map/player exist
const movement = createMovementFacade();

// toggle movement mode button behavior
toggleButton.onclick = () => {
  if (currentMode === "geo") {
    movement.useButtons();
  } else {
    movement.useGeolocation();
  }
};

// redraw when map moves
map.on("moveend", redrawCells);

// INITIAL LOAD
map.whenReady(() => {
  loadCells();
  loadHeld();
  updateHeldUI();

  const savedPos = loadPlayerPosition();
  if (savedPos) {
    applyPlayerPosition(savedPos);
  } else {
    applyPlayerPosition(CLASSROOM);
  }

  redrawCells();

  // Always start in geolocation mode first
  movement.useGeolocation();
});
