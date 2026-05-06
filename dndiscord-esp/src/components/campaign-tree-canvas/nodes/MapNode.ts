import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';
import { ICON_MAP } from '../constants/nodeIcons';

export interface CellCoord {
  x: number;
  z: number;
}

/** Type d'une sortie : 'next' → bloc suivant dans l'arbre, 'end' → fin de scénario. */
export type ExitType = 'next' | 'end';

export interface ExitCell extends CellCoord {
  /** Comportement déclenché quand un joueur marche sur cette case sortie. */
  exitType: ExitType;
  /** Pour les sorties 'next' uniquement : index parmi les sorties 'next' (0-based).
   *  Détermine le port draw2d : exit-0, exit-1, etc. */
  exitIndex?: number;
}

export interface MapNodeData extends BaseNodeData {
  type: 'map';
  title?: string;
  selectedMap?: string;
  /** Nom lisible de la carte sélectionnée — stocké dans le nœud pour éviter
   *  un lookup localStorage côté joueur (qui n'a pas la map en local). */
  selectedMapName?: string;
  /** Point d'apparition des joueurs (coordonnées de la grille) */
  spawnPoint?: CellCoord;
  /** Cases de sortie de la carte (chaque case porte son type : suite ou fin) */
  exitCells?: ExitCell[];
  /** Cases de pièges */
  trapCells?: CellCoord[];
}

/** Réassigne exitIndex séquentiellement pour toutes les sorties 'next'. */
export function reindexExits(cells: ExitCell[]): ExitCell[] {
  let nextIdx = 0;
  return cells.map(c => c.exitType === 'next' ? { ...c, exitIndex: nextIdx++ } : c);
}

/** Retourne le nom du port draw2d correspondant à une ExitCell. */
export function exitPortName(cell: ExitCell): string {
  if (cell.exitType === 'end') return 'exit-end';
  return `exit-${cell.exitIndex ?? 0}`;
}

export class MapNode extends CampaignNode {
  static NAME = 'MapNode';

  constructor(x: number, y: number, data: MapNodeData) {
    super(x, y, data);
  }

  protected getIconSvg(): string { return ICON_MAP; }

  override createBackground(): void {
    this.background = new draw2d.shape.basic.Rectangle({
      width: this.nodeWidth,
      height: this.nodeHeight,
      bgColor: '#0a1830',
      color: '#1d4ed8',
      stroke: 2,
      radius: 8,
    });
  }

  protected createPorts(): void {
    const inputPort = this.createSinglePort(
      'input',
      new draw2d.layout.locator.XYRelPortLocator(-5, 50)
    );
    inputPort.setName('input');

    const data = this.nodeData as MapNodeData;
    this.createOutputPorts(data.exitCells ?? []);
  }

  // ── Port helpers ──────────────────────────────────────────────────────────

  /** Calcule la liste ordonnée des ports de sortie à partir des exitCells. */
  static computePortDefs(exitCells: ExitCell[]): Array<{ name: string }> {
    const nextCount = exitCells.filter(e => e.exitType === 'next').length;
    const hasEnd    = exitCells.some(e => e.exitType === 'end');
    const ports: Array<{ name: string }> = [];
    for (let i = 0; i < nextCount; i++) ports.push({ name: `exit-${i}` });
    if (hasEnd) ports.push({ name: 'exit-end' });
    if (ports.length === 0) ports.push({ name: 'output' }); // nœud non configuré
    return ports;
  }

  private createOutputPorts(exitCells: ExitCell[]): void {
    const defs = MapNode.computePortDefs(exitCells);
    defs.forEach((def, i) => {
      const yPercent = defs.length === 1 ? 50 : ((i + 1) / (defs.length + 1)) * 100;
      const port = this.createSinglePort(
        'output',
        new draw2d.layout.locator.XYRelPortLocator(105, yPercent)
      );
      port.setName(def.name);
    });
  }

  public updateExitPorts(exitCells: ExitCell[]): void {
    const defs = MapNode.computePortDefs(exitCells);
    const currentPorts: any[] = [];
    this.getOutputPorts().each((_: number, p: any) => currentPorts.push(p));
    const currentCount = currentPorts.length;
    const newCount     = defs.length;

    // Ajouter les ports manquants
    for (let i = currentCount; i < newCount; i++) {
      const port = this.createSinglePort(
        'output',
        new draw2d.layout.locator.XYRelPortLocator(105, 50)
      );
      port.setName(defs[i].name);
    }
    // Supprimer les ports en excès depuis la fin
    for (let i = currentCount - 1; i >= newCount; i--) {
      this.removePort(currentPorts[i]);
    }

    // Recollecte + repositionnement + renommage
    const allPorts: any[] = [];
    this.getOutputPorts().each((_: number, p: any) => allPorts.push(p));
    allPorts.forEach((port, i) => {
      const total    = allPorts.length;
      const yPercent = total <= 1 ? 50 : ((i + 1) / (total + 1)) * 100;
      port.setName(defs[i].name);
      port.setLocator(new draw2d.layout.locator.XYRelPortLocator(105, yPercent));
    });

    this.repaint();
  }

  // ── Setters ──────────────────────────────────────────────────────────────

  public updateMap(mapId: string, mapName?: string): void {
    const d = this.nodeData as MapNodeData;
    d.selectedMap = mapId;
    if (mapName !== undefined) d.selectedMapName = mapName;
    this.setUserData(this.nodeData);
  }

  public updateSpawnPoint(pt: CellCoord | undefined): void {
    (this.nodeData as MapNodeData).spawnPoint = pt;
    this.setUserData(this.nodeData);
  }

  public updateExitCells(cells: ExitCell[]): void {
    (this.nodeData as MapNodeData).exitCells = cells;
    this.setUserData(this.nodeData);
    this.updateExitPorts(cells);
  }

  public updateTrapCells(cells: CellCoord[]): void {
    (this.nodeData as MapNodeData).trapCells = cells;
    this.setUserData(this.nodeData);
  }

  // ── Serialization ─────────────────────────────────────────────────────────

  public getPersistentAttributes(): any {
    return { ...super.getPersistentAttributes(), nodeData: this.nodeData };
  }

  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      const data = this.nodeData as MapNodeData;
      this.updateTitle(data?.title ?? '');
      if (data?.selectedMap !== undefined)  (this.nodeData as MapNodeData).selectedMap = data.selectedMap;
      if (data?.spawnPoint  !== undefined)  (this.nodeData as MapNodeData).spawnPoint  = data.spawnPoint;
      if (data?.trapCells   !== undefined)  (this.nodeData as MapNodeData).trapCells   = data.trapCells;
      // Reconstruire les ports selon les exitCells (inclut migration : exit sans exitIndex → exit-0)
      if (data?.exitCells !== undefined) {
        const migrated = reindexExits(data.exitCells);
        (this.nodeData as MapNodeData).exitCells = migrated;
        this.updateExitPorts(migrated);
      }
      this.setUserData(this.nodeData);
    }
  }
}
