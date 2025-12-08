// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// CONFIG
const CELL_SIZE = 1e-4;
const NEAR_RADIUS = 3;
const SPAWN_CHANCE = 0.25;
const WIN_VALUE = 128; // increased target here
const GRID_RANGE = 25;
const NULL_ISLAND = leaflet.latLng(0, 0);

// TYPES / STATE
type CellIndex = { i: number; j: number };

const changedCells = new Map<string, number | null>();
let held: number | null = null;
let won = false;

let cellLayers: leaflet.Layer[] = [];

// DOM
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

controlPanelDiv.innerHTML = `
  <div>Held token: <span id="held-token">none</span></div>
  <div>Target value: <span id="target-value">${WIN_VALUE}</span></div>
`;

// movement buttons
const moveDiv = document.createElement("div");
moveDiv.id = "move-buttons";
moveDiv.textContent = "Move: ";
controlPanelDiv.appendChild(moveDiv);

function addMoveButton(label: string, di: number, dj: number) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.onclick = () => movePlayer(di, dj);
  moveDiv.appendChild(btn);
}

addMoveButton("↑", 1, 0);
addMoveButton("↓", -1, 0);
addMoveButton("←", 0, -1);
addMoveButton("→", 0, 1);

statusPanelDiv.textContent =
  "Use the arrows to move; click nearby cells with tokens to pick up, drop, or combine.";

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

// spawn 2 or 4
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
}

// “forget” modifications that go offscreen
function trimChangedCells(
  iMin: number,
  iMax: number,
  jMin: number,
  jMax: number,
) {
  for (const k of Array.from(changedCells.keys())) {
    const [si, sj] = k.split(",").map(Number);
    if (si < iMin || si > iMax || sj < jMin || sj > jMax) {
      changedCells.delete(k);
    }
  }
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

// MOVEMENT
function movePlayer(di: number, dj: number) {
  const pc = getPlayerCell();
  const newI = pc.i + di;
  const newJ = pc.j + dj;
  const newPos = cellToLatLng(newI, newJ);
  player.setLatLng(newPos);
  map.panTo(newPos);
  redrawCells();
}

// CELL INTERACTION
function clickCell(i: number, j: number) {
  if (!inRange(i, j)) {
    setStatus("That cell is too far away.");
    return;
  }

  const cellValue = getToken(i, j);

  // not holding anything: pick up if there is a token
  if (held === null) {
    if (cellValue === null) {
      setStatus("No token here.");
      return;
    }
    held = cellValue;
    setToken(i, j, null);
    updateHeldUI();
    setStatus(`Picked up token value ${held}.`);
    redrawCells();
    checkWin();
    return;
  }

  // holding something, cell empty -->drop it
  if (cellValue === null) {
    setToken(i, j, held);
    setStatus(`Placed token value ${held}.`);
    held = null;
    updateHeldUI();
    redrawCells();
    return;
  }

  // holding something, cell has same value-->combine
  if (cellValue === held) {
    const newValue = held * 2;
    setToken(i, j, newValue);
    held = null;
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

  const rect = leaflet.rectangle(
    [
      [lat0, lng0],
      [lat1, lng1],
    ],
    {
      color: "#777",
      weight: 1,
      fillColor: hasToken ? "#88ccff" : "#eeeeee",
      fillOpacity: hasToken ? 0.5 : 0.15,
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

  trimChangedCells(iMin, iMax, jMin, jMax);

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      cellLayers.push(drawCell(i, j));
    }
  }
}

// MAP SETUP
const CLASSROOM = leaflet.latLng(36.997936938057016, -122.05703507501151);

const map = leaflet.map(mapDiv, {
  center: CLASSROOM,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: true, // scroll to look around without moving player
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

map.on("moveend", redrawCells);

map.whenReady(() => {
  redrawCells();
  updateHeldUI();
});
