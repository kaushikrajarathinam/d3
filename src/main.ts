// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// CONFIG
const CLASSROOM = leaflet.latLng(36.997936938057016, -122.05703507501151);
const CELL_SIZE = 1e-4;
const NEAR_RADIUS = 3;
const SPAWN_CHANCE = 0.25;
const WIN_VALUE = 16;
const GRID_RANGE = 25; // how many cells in each direction from center

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

statusPanelDiv.textContent = "Click a nearby cell with a token to pick it up.";

// HELPERS
function key(i: number, j: number) {
  return `${i},${j}`;
}

function latLngToCell(lat: number, lng: number): CellIndex {
  return {
    i: Math.floor(lat / CELL_SIZE),
    j: Math.floor(lng / CELL_SIZE),
  };
}

const PLAYER_CELL = latLngToCell(CLASSROOM.lat, CLASSROOM.lng);

function inRange(i: number, j: number) {
  const di = Math.abs(i - PLAYER_CELL.i);
  const dj = Math.abs(j - PLAYER_CELL.j);
  return Math.max(di, dj) <= NEAR_RADIUS;
}

function spawnToken(i: number, j: number): number | null {
  const r = luck([i, j, "spawn"].toString());
  return r < SPAWN_CHANCE ? 1 : null;
}

function getToken(i: number, j: number): number | null {
  const k = key(i, j);
  if (changedCells.has(k)) return changedCells.get(k) ?? null;
  return spawnToken(i, j);
}

function setToken(i: number, j: number, value: number | null) {
  changedCells.set(key(i, j), value);
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
    updateHeldUI();
    setStatus(`Picked up token value ${held}.`);
    redrawCells();
    checkWin();
    return;
  }

  if (cellValue === held && cellValue !== null) {
    const newValue = held * 2;
    held = newValue;
    setToken(i, j, null);
    updateHeldUI();
    setStatus(`Crafted token value ${newValue}.`);
    redrawCells();
    checkWin();
  } else if (cellValue === null) {
    setStatus("You can only combine with a matching token.");
  } else {
    setStatus(`Cannot combine ${held} with ${cellValue}.`);
  }
}

// RENDERING
function drawCell(i: number, j: number): leaflet.Layer {
  const lat0 = i * CELL_SIZE;
  const lat1 = (i + 1) * CELL_SIZE;
  const lng0 = j * CELL_SIZE;
  const lng1 = (j + 1) * CELL_SIZE;

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

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      cellLayers.push(drawCell(i, j));
    }
  }
}

// MAP SETUP
const map = leaflet.map(mapDiv, {
  center: CLASSROOM,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
