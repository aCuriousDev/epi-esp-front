import { Component, createEffect, createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { MapNode, MapNodeData, CellCoord, ExitCell } from './nodes/MapNode';
import { CampaignNode } from './nodes/CampaignNode';
import { fetchMine, loadMap, type MapMeta, type SavedCellData, type SavedMapData } from '@/services/mapRepository';
import { getApiUrl } from '@/services/config';
import { AuthService } from '@/services/auth.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type EditorMode = 'spawn' | 'exit-next' | 'exit-end' | 'trap' | 'erase';

// MapMeta imported from mapRepository

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Charge les cellules d'une map pour la prévisualisation.
 * - ID legacy → localStorage (synchrone, pas de cache ajouté)
 * - UUID DB   → GET API direct, sans passer par le cache localStorage
 *               (pas de raison de polluer localStorage juste pour une preview)
 */
async function loadCellsForPreview(mapId: string): Promise<SavedCellData[]> {
  const local = loadMap(mapId);
  if (local) return local.cells;

  if (!UUID_RE.test(mapId)) return [];

  try {
    const token = AuthService.getToken();
    if (!token) return [];

    // Tenter d'abord les maps de campagne, puis les maps user
    for (const url of [
      // on n'a pas le campaignId ici — on tente directement les maps user
      `${getApiUrl()}/api/maps/mine/${mapId}`,
    ]) {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const record = await res.json() as { data?: string };
        if (record.data) {
          const parsed = JSON.parse(record.data) as SavedMapData;
          return parsed.cells ?? [];
        }
      }
    }
  } catch {
    // preview non disponible — grille vide
  }
  return [];
}
interface Bounds  { minX: number; minZ: number; w: number; h: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL_MIN  = 16;
const CELL_MAX  = 52;
const H_RESERVE = 240; // px reserved for board chrome (header + toolbar + footer)

const MODE_CFG: Record<EditorMode, { label: string; clr: string; bg: string; border: string; hint: string }> = {
  spawn:      { label: '⊙ Spawn',       clr: '#22c55e', bg: 'rgba(34,197,94,0.15)',   border: '#22c55e', hint: 'Cliquez pour définir le point d\'apparition des joueurs.' },
  'exit-next':{ label: '⬆ Sortie →',   clr: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  border: '#fbbf24', hint: 'Case de sortie → continue au bloc suivant dans le scénario.' },
  'exit-end': { label: '⛔ Sortie fin', clr: '#f87171', bg: 'rgba(248,113,113,0.15)', border: '#f87171', hint: 'Case de sortie → fin immédiate du scénario.' },
  trap:       { label: '✕ Piège',       clr: '#ef4444', bg: 'rgba(239,68,68,0.15)',   border: '#ef4444', hint: 'Cliquez (ou glissez) pour marquer les cases de pièges.' },
  erase:      { label: '✦ Effacer',     clr: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: '#475569', hint: 'Cliquez pour effacer le marqueur de cette case.' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ck(c: CellCoord) { return `${c.x},${c.z}`; }

function hasCoord(arr: CellCoord[], c: CellCoord) {
  return arr.some(a => a.x === c.x && a.z === c.z);
}

function toggle(arr: CellCoord[], c: CellCoord): CellCoord[] {
  return hasCoord(arr, c)
    ? arr.filter(a => !(a.x === c.x && a.z === c.z))
    : [...arr, c];
}

/**
 * Place ou retire une case de sortie typée.
 * - Si la case est absente → on l'ajoute avec l'exitType donné.
 * - Si la case a le même type → on la retire (toggle off).
 * - Si la case a un type différent → on remplace (change le type).
 */
function toggleExit(arr: ExitCell[], c: CellCoord, exitType: 'next' | 'end'): ExitCell[] {
  const existing = arr.find(a => a.x === c.x && a.z === c.z);
  if (!existing) return [...arr, { ...c, exitType }];
  if (existing.exitType === exitType) return arr.filter(a => !(a.x === c.x && a.z === c.z));
  return arr.map(a => a.x === c.x && a.z === c.z ? { ...a, exitType } : a);
}

// The Map Editor always creates a GRID_SIZE×GRID_SIZE grid (10×10).
// We must always start at (0,0) so the logic overlay aligns with the real game grid.
const MAP_GRID_SIZE = 10;

function calcBounds(cells: SavedCellData[]): Bounds {
  if (!cells.length) return { minX: 0, minZ: 0, w: MAP_GRID_SIZE, h: MAP_GRID_SIZE };
  const xs = cells.map(c => c.x);
  const zs = cells.map(c => c.z);
  return {
    minX: 0,
    minZ: 0,
    // Respect the full map extent — always at least MAP_GRID_SIZE in each axis
    w: Math.max(MAP_GRID_SIZE, Math.max(...xs) + 1),
    h: Math.max(MAP_GRID_SIZE, Math.max(...zs) + 1),
  };
}

function baseCellColor(cell: SavedCellData | undefined): string {
  if (!cell) return '#1a2a3a'; // empty floor tile (game default — walkable, no asset)
  const t = (cell.ground?.assetType ?? cell.stackedAssets[0]?.assetType ?? '').toLowerCase();
  if (t.includes('water'))                                               return '#0d2040';
  if (t.includes('wall') || t.includes('brick') || t.includes('stone')) return '#241a0e';
  return '#1a2a3a'; // generic floor
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function renderGrid(
  canvas: HTMLCanvasElement,
  cells: SavedCellData[],
  b: Bounds,
  cs: number,
  spawn: CellCoord | undefined,
  exits: ExitCell[],
  traps: CellCoord[],
  hover: CellCoord | null,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cellMap = new Map<string, SavedCellData>();
  for (const c of cells) cellMap.set(ck(c), c);

  const exitMap = new Map<string, ExitCell>(exits.map(e => [ck(e), e]));
  const trapSet = new Set(traps.map(ck));

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let gz = 0; gz < b.h; gz++) {
    for (let gx = 0; gx < b.w; gx++) {
      const wx = b.minX + gx;
      const wz = b.minZ + gz;
      const k  = `${wx},${wz}`;
      const px = gx * cs;
      const py = gz * cs;
      const cell = cellMap.get(k);

      // ── Base cell ──
      ctx.fillStyle = baseCellColor(cell);
      ctx.fillRect(px, py, cs, cs);

      // ── Occupied cell overlay (has stacked assets) ──
      if (cell && cell.stackedAssets.length > 0) {
        ctx.fillStyle = 'rgba(6,182,212,0.18)';
        ctx.fillRect(px, py, cs, cs);
        // Small object indicator dot in top-right corner
        const dotR = Math.max(2, cs * 0.12);
        const dotX = px + cs - dotR - 2;
        const dotY = py + dotR + 2;
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Grid line ──
      ctx.strokeStyle = '#1e2d4a';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, cs, cs);

      // ── Exit overlay ──
      if (exitMap.has(k)) {
        const exit   = exitMap.get(k)!;
        const isEnd  = exit.exitType === 'end';
        const clr    = isEnd ? '#f87171' : '#fbbf24';
        const clrBg  = isEnd ? 'rgba(248,113,113,0.35)' : 'rgba(251,191,36,0.35)';
        ctx.fillStyle = clrBg;
        ctx.fillRect(px, py, cs, cs);
        ctx.strokeStyle = clr;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
        const mx  = px + cs / 2;
        const tip = py + cs * 0.20;
        const bot = py + cs * 0.76;
        const hw  = cs * 0.18;
        ctx.strokeStyle = clr; ctx.lineWidth = 2;
        if (isEnd) {
          // ⛔ croix pour fin
          const m = cs * 0.22;
          ctx.beginPath();
          ctx.moveTo(px + m, py + m);      ctx.lineTo(px + cs - m, py + cs - m);
          ctx.moveTo(px + cs - m, py + m); ctx.lineTo(px + m, py + cs - m);
          ctx.stroke();
        } else {
          // ⬆ flèche vers le haut pour suite
          ctx.beginPath();
          ctx.moveTo(mx, tip); ctx.lineTo(mx, bot);
          ctx.moveTo(mx - hw, tip + hw * 1.3); ctx.lineTo(mx, tip);
          ctx.lineTo(mx + hw, tip + hw * 1.3);
          ctx.stroke();
        }
      }

      // ── Trap overlay ──
      if (trapSet.has(k)) {
        ctx.fillStyle = 'rgba(239,68,68,0.35)';
        ctx.fillRect(px, py, cs, cs);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
        const m = cs * 0.25;
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + m, py + m);      ctx.lineTo(px + cs - m, py + cs - m);
        ctx.moveTo(px + cs - m, py + m); ctx.lineTo(px + m, py + cs - m);
        ctx.stroke();
      }

      // ── Spawn ──
      const isSpawn = spawn && spawn.x === wx && spawn.z === wz;
      if (isSpawn) {
        const cx = px + cs / 2;
        const cy = py + cs / 2;
        const r  = Math.max(6, cs * 0.33);
        ctx.fillStyle = 'rgba(34,197,94,0.22)';
        ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, r * 0.28), 0, Math.PI * 2); ctx.fill();
      }

      // ── Hover highlight ──
      if (hover && hover.x === wx && hover.z === wz) {
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.fillRect(px, py, cs, cs);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 1, py + 1, cs - 2, cs - 2);
      }
    }
  }
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const fieldStyle = {
  width: '100%',
  background: '#1e1e1e',
  border: '1px solid #3c3c3f',
  'border-radius': '4px',
  color: '#d4d4d4',
  padding: '0.5rem 0.75rem',
  'font-family': 'inherit',
  'font-size': '0.9rem',
};

const labelStyle = {
  display: 'block',
  'margin-bottom': '0.5rem',
  'font-weight': '500',
  'font-size': '0.9rem',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface MapNodeEditorProps {
  node: MapNode;
  handleUpdateNode: (node: CampaignNode) => void;
}

const MapNodeEditor: Component<MapNodeEditorProps> = (props) => {
  const data = props.node.getData() as MapNodeData;

  // ── Signals ──────────────────────────────────────────────────────────────
  const [title,      setTitle     ] = createSignal(data.title       ?? '');
  const [selMap,     setSelMap    ] = createSignal(data.selectedMap ?? '');
  const [maps,       setMaps      ] = createSignal<MapMeta[]>([]);
  const [cells,      setCells     ] = createSignal<SavedCellData[]>([]);
  const [mode,       setMode      ] = createSignal<EditorMode>('spawn');
  const [spawn,      setSpawn     ] = createSignal<CellCoord | undefined>(data.spawnPoint);
  const [exits,      setExits     ] = createSignal<ExitCell[]>(
    // Migration : les anciennes cartes sans exitType reçoivent 'next' par défaut
    (data.exitCells ?? []).map(e => ({ ...e, exitType: (e as ExitCell).exitType ?? 'next' }))
  );
  const [traps,      setTraps     ] = createSignal<CellCoord[]>(data.trapCells  ?? []);
  const [hover,      setHover     ] = createSignal<CellCoord | null>(null);
  const [painting,   setPainting  ] = createSignal(false);
  const [showBoard,  setShowBoard ] = createSignal(false);
  const [ready,      setReady     ] = createSignal(false);

  let boardCanvasEl: HTMLCanvasElement | undefined;

  // ── Derived ───────────────────────────────────────────────────────────────
  const b  = createMemo(() => calcBounds(cells()));

  // Cell size auto-fit to current viewport
  const cs = createMemo(() => {
    const _b     = b();
    const availW = window.innerWidth  - 80;
    const availH = window.innerHeight - H_RESERVE;
    return Math.max(CELL_MIN, Math.min(CELL_MAX,
      Math.min(Math.floor(availW / _b.w), Math.floor(availH / _b.h)),
    ));
  });

  const cw          = createMemo(() => b().w * cs());
  const ch          = createMemo(() => b().h * cs());
  const hasGrid     = createMemo(() => cells().length > 0);
  const isConfigured = createMemo(() => !!spawn() || exits().length > 0 || traps().length > 0);
  const currentMeta  = createMemo(() => maps().find(m => m.id === selMap()));

  // ── Mount ─────────────────────────────────────────────────────────────────
  onMount(async () => {
    const maps = await fetchMine();
    setMaps(maps);
    if (data.selectedMap) {
      setCells(await loadCellsForPreview(data.selectedMap));
    }
    setReady(true);
  });

  // ── Board canvas redraw ──────────────────────────────────────────────────
  // Reads all reactive deps so the canvas redraws on any relevant change.
  createEffect(() => {
    if (!showBoard() || !ready()) return;
    const _b = b(), _cs = cs(), _cw = cw(), _ch = ch();
    const _s = spawn(), _e = exits(), _t = traps(), _h = hover();
    if (!boardCanvasEl || !hasGrid()) return;
    if (boardCanvasEl.width !== _cw || boardCanvasEl.height !== _ch) {
      boardCanvasEl.width  = _cw;
      boardCanvasEl.height = _ch;
    }
    renderGrid(boardCanvasEl, cells(), _b, _cs, _s, _e, _t, _h);
  });

  // ── Grid coordinate from mouse event ─────────────────────────────────────
  const getCoord = (e: MouseEvent): CellCoord | null => {
    if (!boardCanvasEl) return null;
    const rect = boardCanvasEl.getBoundingClientRect();
    const gx   = Math.floor((e.clientX - rect.left) / cs());
    const gz   = Math.floor((e.clientY - rect.top)  / cs());
    const _b   = b();
    if (gx < 0 || gx >= _b.w || gz < 0 || gz >= _b.h) return null;
    return { x: _b.minX + gx, z: _b.minZ + gz };
  };

  // ── Apply current mode to a cell ─────────────────────────────────────────
  const applyMode = (c: CellCoord) => {
    const m = mode();
    if (m === 'spawn') {
      const cur  = spawn();
      const next = cur && cur.x === c.x && cur.z === c.z ? undefined : c;
      setSpawn(next); props.node.updateSpawnPoint(next);

    } else if (m === 'exit-next') {
      const next = toggleExit(exits(), c, 'next');
      setExits(next); props.node.updateExitCells(next);

    } else if (m === 'exit-end') {
      const next = toggleExit(exits(), c, 'end');
      setExits(next); props.node.updateExitCells(next);

    } else if (m === 'trap') {
      const next = toggle(traps(), c);
      setTraps(next); props.node.updateTrapCells(next);

    } else {
      if (spawn() && spawn()!.x === c.x && spawn()!.z === c.z) {
        setSpawn(undefined); props.node.updateSpawnPoint(undefined);
      }
      const ne: ExitCell[] = exits().filter(a => !(a.x === c.x && a.z === c.z));
      const nt = traps().filter(a => !(a.x === c.x && a.z === c.z));
      setExits(ne); props.node.updateExitCells(ne);
      setTraps(nt); props.node.updateTrapCells(nt);
    }
    props.handleUpdateNode(props.node);
  };

  // ── Canvas mouse events ───────────────────────────────────────────────────
  const onMouseDown  = (e: MouseEvent) => { setPainting(true);  const c = getCoord(e); if (c) applyMode(c); };
  const onMouseMove  = (e: MouseEvent) => { const c = getCoord(e); setHover(c); if (painting() && c) applyMode(c); };
  const onMouseUp    = () => setPainting(false);
  const onMouseLeave = () => { setHover(null); setPainting(false); };

  // ── Map selection ─────────────────────────────────────────────────────────
  const handleSelectMap = async (mapId: string) => {
    setSelMap(mapId);
    const mapName = maps().find(m => m.id === mapId)?.name;
    props.node.updateMap(mapId, mapName);
    setSpawn(undefined); props.node.updateSpawnPoint(undefined);
    setExits([] as ExitCell[]); props.node.updateExitCells([]);
    setTraps([]);        props.node.updateTrapCells([]);
    setCells(mapId ? await loadCellsForPreview(mapId) : []);
    props.handleUpdateNode(props.node);
  };

  // ── Title ─────────────────────────────────────────────────────────────────
  const handleUpdateTitle = (v: string) => {
    setTitle(v); props.node.updateTitle(v);
  };

  // ── Board open / close ────────────────────────────────────────────────────
  const openBoard  = () => { setMode('spawn'); setShowBoard(true); };
  const closeBoard = () => { setHover(null); setPainting(false); setShowBoard(false); };

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Title ──────────────────────────────────────────────────────── */}
      <div style={{ 'margin-bottom': '1.25rem' }}>
        <label style={labelStyle}>🏷️ Titre du bloc :</label>
        <input
          type="text"
          value={title()}
          onInput={e => handleUpdateTitle(e.currentTarget.value)}
          onKeyDown={e => e.stopPropagation()}
          onBlur={() => props.handleUpdateNode(props.node)}
          placeholder="Nom affiché sur le canvas..."
          style={fieldStyle}
        />
      </div>

      {/* ── Map selector ───────────────────────────────────────────────── */}
      <div style={{ 'margin-bottom': '1.25rem' }}>
        <label style={labelStyle}>🗺️ Carte :</label>
        <Show
          when={maps().length > 0}
          fallback={
            <div style={{ background: '#10151f', border: '1px dashed #2a3a6a', 'border-radius': '6px', padding: '0.75rem', 'text-align': 'center' }}>
              <p style={{ margin: '0 0 0.2rem', 'font-size': '0.85rem', color: '#5a7090' }}>Aucune carte sauvegardée</p>
              <p style={{ margin: 0, 'font-size': '0.78rem', color: '#344566' }}>
                Créez-en une depuis le <strong style={{ color: '#4a6090' }}>Map Editor</strong>
              </p>
            </div>
          }
        >
          <select
            value={selMap()}
            onChange={e => handleSelectMap(e.currentTarget.value)}
            style={{ ...fieldStyle, cursor: 'pointer' }}
          >
            <option value="">— Sélectionner une carte —</option>
            <For each={maps()}>
              {m => <option value={m.id}>{m.name}</option>}
            </For>
          </select>
        </Show>
      </div>

      {/* ── Map info + action ──────────────────────────────────────────── */}
      <Show when={selMap()}>

        {/* Carte vide */}
        <Show when={!hasGrid()}>
          <div style={{ background: '#10151f', border: '1px dashed #2a3060', 'border-radius': '6px', padding: '0.75rem', 'text-align': 'center', 'margin-bottom': '1rem' }}>
            <p style={{ margin: 0, 'font-size': '0.82rem', color: '#5a6a8a' }}>
              Cette carte ne contient aucune case — éditez-la dans le Map Editor.
            </p>
          </div>
        </Show>

        {/* Carte prête */}
        <Show when={hasGrid()}>

          {/* Info chip */}
          <div style={{
            background: '#0d1625',
            border: '1px solid #1a2a4a',
            'border-radius': '8px',
            padding: '0.6rem 0.75rem',
            'margin-bottom': '0.85rem',
            display: 'flex',
            'align-items': 'center',
            gap: '0.65rem',
          }}>
            <span style={{ 'font-size': '1.15rem' }}>🗺️</span>
            <div style={{ flex: 1, 'min-width': 0 }}>
              <p style={{ margin: '0 0 0.1rem', 'font-size': '0.85rem', color: '#a0c4ff', 'font-weight': '600', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
                {currentMeta()?.name ?? selMap()}
              </p>
              <p style={{ margin: 0, 'font-size': '0.73rem', color: '#3a5a80' }}>
                {cells().length} case{cells().length !== 1 ? 's' : ''}
                {currentMeta() && <> · {fmtDate(currentMeta()!.updatedAt)}</>}
              </p>
            </div>
            <Show when={isConfigured()}>
              <span style={{
                'font-size': '0.68rem', color: '#22c55e',
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.3)',
                'border-radius': '4px', padding: '0.15rem 0.45rem',
                'white-space': 'nowrap',
              }}>
                Configurée
              </span>
            </Show>
          </div>

          {/* Summary (when already configured) */}
          <Show when={isConfigured()}>
            <div style={{
              background: '#0b1422',
              border: '1px solid #182438',
              'border-radius': '6px',
              padding: '0.4rem 0.65rem',
              display: 'flex',
              gap: '0.6rem 1.1rem',
              'flex-wrap': 'wrap',
              'margin-bottom': '0.85rem',
              'font-size': '0.76rem',
            }}>
              <span style={{ color: spawn() ? '#22c55e' : '#2a4a3a' }}>
                ⊙ {spawn() ? `Spawn (${spawn()!.x}, ${spawn()!.z})` : '—'}
              </span>
              <span style={{ color: exits().filter(e => e.exitType === 'next').length > 0 ? '#fbbf24' : '#3a3020' }}>
                ⬆ {exits().filter(e => e.exitType === 'next').length} →suite
              </span>
              <span style={{ color: exits().filter(e => e.exitType === 'end').length > 0 ? '#f87171' : '#3a2020' }}>
                ⛔ {exits().filter(e => e.exitType === 'end').length} fin
              </span>
              <span style={{ color: traps().length > 0 ? '#ef4444' : '#3a2020' }}>
                ✕ {traps().length} piège{traps().length !== 1 ? 's' : ''}
              </span>
            </div>
          </Show>

          {/* Open Board button */}
          <button
            onClick={openBoard}
            style={{
              width: '100%',
              padding: '0.6rem 1rem',
              background: isConfigured() ? 'rgba(25,55,120,0.55)' : 'rgba(20,90,55,0.55)',
              border: `1px solid ${isConfigured() ? '#2a4a9a' : '#186644'}`,
              'border-radius': '8px',
              color: isConfigured() ? '#7aabff' : '#4ade80',
              cursor: 'pointer',
              'font-size': '0.88rem',
              'font-weight': '600',
              transition: 'background 0.15s, border-color 0.15s',
              'letter-spacing': '0.02em',
            }}
          >
            {isConfigured() ? '✏️ Éditer la carte' : '⚡ Instancier la carte'}
          </button>

        </Show>
      </Show>

      {/* ── Note ────────────────────────────────────────────────────────── */}
      <p style={{ margin: '1.25rem 0 0', 'font-size': '0.73rem', color: '#2d3a4a', 'line-height': 1.4 }}>
        💡 Les cartes se créent dans le <strong style={{ color: '#3a5070' }}>Map Editor</strong> (menu principal).
      </p>

      {/* ═══════════════════════════════════════════════════════════════════
          Board Overlay — full-screen map logic editor
          ═══════════════════════════════════════════════════════════════════ */}
      <Show when={showBoard() && hasGrid()}>
        <Portal mount={document.body}>

          {/* Backdrop */}
          <div
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(2,6,18,0.9)',
              'backdrop-filter': 'blur(6px)',
              'z-index': 9998,
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
            }}
            onClick={e => { if (e.target === e.currentTarget) closeBoard(); }}
          >

            {/* Panel */}
            <div style={{
              background: '#0c1220',
              border: '1px solid #1e2d50',
              'border-radius': '16px',
              'box-shadow': '0 24px 80px rgba(0,0,12,0.85)',
              display: 'flex',
              'flex-direction': 'column',
              'max-width': '90vw',
              'max-height': '92vh',
              overflow: 'hidden',
            }}>

              {/* ── Header ──────────────────────────────────────────── */}
              <div style={{
                display: 'flex', 'align-items': 'center', gap: '0.75rem',
                padding: '1rem 1.25rem 0.85rem',
                'border-bottom': '1px solid #141e35',
              }}>
                <span style={{ 'font-size': '1.25rem' }}>🗺️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 0.1rem', 'font-size': '1rem', 'font-weight': '700', color: '#c8daff' }}>
                    {currentMeta()?.name ?? 'Carte'}
                  </p>
                  <p style={{ margin: 0, 'font-size': '0.73rem', color: '#3a5a80' }}>
                    Placement des actions · grille {b().w}×{b().h}
                  </p>
                </div>
                <button
                  onClick={closeBoard}
                  style={{
                    background: 'transparent',
                    border: '1px solid #1e2d50',
                    'border-radius': '8px',
                    color: '#4a6a90',
                    padding: '0.35rem 0.75rem',
                    cursor: 'pointer',
                    'font-size': '1rem',
                    'line-height': 1,
                    transition: 'border-color 0.12s, color 0.12s',
                  }}
                  title="Fermer"
                >✕</button>
              </div>

              {/* ── Mode toolbar ─────────────────────────────────────── */}
              <div style={{
                display: 'flex', gap: '0.5rem',
                padding: '0.75rem 1.25rem 0.5rem',
                'align-items': 'center',
                'flex-wrap': 'wrap',
                'border-bottom': '1px solid #0e1828',
              }}>
                <For each={(['spawn', 'exit-next', 'exit-end', 'trap', 'erase'] as EditorMode[])}>
                  {(m) => {
                    const cfg    = MODE_CFG[m];
                    const active = () => mode() === m;
                    return (
                      <button
                        onClick={() => setMode(m)}
                        style={{
                          padding: '0.4rem 1rem',
                          background: active() ? cfg.bg : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${active() ? cfg.border : '#1e2d50'}`,
                          'border-radius': '8px',
                          color: active() ? cfg.clr : '#445570',
                          cursor: 'pointer',
                          'font-size': '0.83rem',
                          'font-weight': active() ? '700' : '400',
                          transition: 'all 0.12s',
                          'white-space': 'nowrap',
                        }}
                      >
                        {cfg.label}
                      </button>
                    );
                  }}
                </For>
                <span style={{
                  'font-size': '0.76rem',
                  color: MODE_CFG[mode()].clr,
                  opacity: 0.75,
                  'margin-left': '0.35rem',
                  flex: '1',
                  'min-width': '160px',
                }}>
                  {MODE_CFG[mode()].hint}
                </span>
              </div>

              {/* ── Canvas area ─────────────────────────────────────── */}
              <div style={{ padding: '1rem 1.25rem', overflow: 'auto', flex: '1' }}>
                <div style={{
                  background: '#060c18',
                  border: '1px solid #111e36',
                  'border-radius': '8px',
                  display: 'inline-block',
                  'line-height': 0,
                }}>
                  <canvas
                    ref={el => { boardCanvasEl = el; }}
                    width={cw()}
                    height={ch()}
                    style={{ display: 'block', cursor: 'crosshair', 'user-select': 'none' }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                  />
                </div>
              </div>

              {/* ── Footer ──────────────────────────────────────────── */}
              <div style={{
                display: 'flex', 'align-items': 'center', gap: '1.5rem',
                padding: '0.75rem 1.25rem 1rem',
                'border-top': '1px solid #141e35',
              }}>
                {/* Legend */}
                <div style={{ display: 'flex', gap: '1rem', flex: 1, 'flex-wrap': 'wrap' }}>
                  <span style={{ 'font-size': '0.74rem', color: '#22c55e' }}>● Spawn</span>
                  <span style={{ 'font-size': '0.74rem', color: '#fbbf24' }}>⬆ Sortie →suite</span>
                  <span style={{ 'font-size': '0.74rem', color: '#f87171' }}>⛔ Sortie fin</span>
                  <span style={{ 'font-size': '0.74rem', color: '#ef4444' }}>✕ Piège</span>
                  <span style={{ 'font-size': '0.74rem', color: '#22d3ee' }}>◆ Objet</span>
                </div>

                {/* Live counters */}
                <div style={{ display: 'flex', gap: '0.85rem', 'font-size': '0.78rem', 'white-space': 'nowrap' }}>
                  <span style={{ color: spawn() ? '#22c55e' : '#243a2e' }}>
                    ⊙ {spawn() ? `(${spawn()!.x}, ${spawn()!.z})` : '—'}
                  </span>
                  <span style={{ color: exits().filter(e => e.exitType === 'next').length > 0 ? '#fbbf24' : '#3a3010' }}>
                    ⬆ {exits().filter(e => e.exitType === 'next').length} →suite
                  </span>
                  <span style={{ color: exits().filter(e => e.exitType === 'end').length > 0 ? '#f87171' : '#3a1010' }}>
                    ⛔ {exits().filter(e => e.exitType === 'end').length} fin
                  </span>
                  <span style={{ color: traps().length > 0 ? '#ef4444' : '#3a1010' }}>
                    ✕ {traps().length} piège{traps().length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Validate */}
                <button
                  onClick={closeBoard}
                  style={{
                    padding: '0.5rem 1.75rem',
                    background: 'rgba(20,90,55,0.7)',
                    border: '1px solid #186644',
                    'border-radius': '8px',
                    color: '#4ade80',
                    cursor: 'pointer',
                    'font-size': '0.88rem',
                    'font-weight': '600',
                    transition: 'background 0.15s',
                    'white-space': 'nowrap',
                  }}
                >
                  ✓ Valider
                </button>
              </div>

            </div>
          </div>
        </Portal>
      </Show>

    </div>
  );
};

export default MapNodeEditor;
