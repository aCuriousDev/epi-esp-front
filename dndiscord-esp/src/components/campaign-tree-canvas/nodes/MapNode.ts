import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';
import { ICON_MAP } from '../constants/nodeIcons';

export interface CellCoord {
  x: number;
  z: number;
}

export interface ExitCell extends CellCoord {
  /** Index de cette sortie (0-based) — détermine le port draw2d : exit-0, exit-1, etc. */
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
  /** Cases de sortie de la carte */
  exitCells?: ExitCell[];
  /** Cases de pièges */
  trapCells?: CellCoord[];
}

/** Réassigne exitIndex séquentiellement sur toutes les sorties. */
export function reindexExits(cells: ExitCell[]): ExitCell[] {
  return cells.map((c, i) => ({ ...c, exitIndex: i }));
}

/** Retourne le nom du port draw2d correspondant à une ExitCell. */
export function exitPortName(cell: ExitCell): string {
  return `exit-${cell.exitIndex ?? 0}`;
}

export class MapNode extends CampaignNode {
  static NAME = 'MapNode';

  /** Labels draw2d accrochés au groupe pour identifier chaque port de sortie. */
  private _portLabels: any[] = [];

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
    if (exitCells.length === 0) return [{ name: 'output' }]; // nœud non configuré
    return exitCells.map((_, i) => ({ name: `exit-${i}` }));
  }

  private applyPortStyle(port: any): void {
    port.setBackgroundColor('#d97706');
    port.setColor('#f59e0b');
  }

  private clearPortLabels(): void {
    (this._portLabels ?? []).forEach(l => { try { this.remove(l); } catch (_) {} });
    this._portLabels = [];
  }

  private addPortLabel(text: string, yPercent: number): void {
    const label = new draw2d.shape.basic.Label({
      text,
      fontSize: 9,
      fontColor: '#ffffff',
      bgColor: 'none',
      stroke: 0,
      bold: false,
    });
    this.add(label, new draw2d.layout.locator.XYRelPortLocator(88, yPercent));
    this._portLabels.push(label);
  }

  private rebuildPortLabels(defs: Array<{ name: string }>, total: number): void {
    this.clearPortLabels();
    defs.forEach((_, i) => {
      const yPercent = total <= 1 ? 50 : ((i + 1) / (total + 1)) * 100;
      const text = defs.length === 1 ? '→' : `→${i + 1}`;
      this.addPortLabel(text, yPercent);
    });
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
      this.applyPortStyle(port);
    });
    this.rebuildPortLabels(defs, defs.length);
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

    // Recollecte + repositionnement + renommage + style
    const allPorts: any[] = [];
    this.getOutputPorts().each((_: number, p: any) => allPorts.push(p));
    allPorts.forEach((port, i) => {
      const total    = allPorts.length;
      const yPercent = total <= 1 ? 50 : ((i + 1) / (total + 1)) * 100;
      port.setName(defs[i].name);
      port.setLocator(new draw2d.layout.locator.XYRelPortLocator(105, yPercent));
      this.applyPortStyle(port);
    });

    this.rebuildPortLabels(defs, defs.length);
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
