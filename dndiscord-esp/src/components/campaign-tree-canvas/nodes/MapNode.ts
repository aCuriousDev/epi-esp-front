import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';
import { ICON_MAP } from '../constants/nodeIcons';

export interface CellCoord {
  x: number;
  z: number;
}

export interface MapNodeData extends BaseNodeData {
  type: 'map';
  title?: string;
  selectedMap?: string;
  /** Point d'apparition des joueurs (coordonnées de la grille) */
  spawnPoint?: CellCoord;
  /** Cases de sortie de la carte */
  exitCells?: CellCoord[];
  /** Cases de pièges */
  trapCells?: CellCoord[];
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

    const outputPort = this.createSinglePort(
      'output',
      new draw2d.layout.locator.XYRelPortLocator(105, 50)
    );
    outputPort.setName('output');
  }

  // ── Setters ──────────────────────────────────────────────────────────────

  public updateMap(mapId: string): void {
    (this.nodeData as MapNodeData).selectedMap = mapId;
    this.setUserData(this.nodeData);
  }

  public updateSpawnPoint(pt: CellCoord | undefined): void {
    (this.nodeData as MapNodeData).spawnPoint = pt;
    this.setUserData(this.nodeData);
  }

  public updateExitCells(cells: CellCoord[]): void {
    (this.nodeData as MapNodeData).exitCells = cells;
    this.setUserData(this.nodeData);
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
      // Restore map-specific fields that are not covered by the base class
      if (data?.selectedMap !== undefined)  (this.nodeData as MapNodeData).selectedMap = data.selectedMap;
      if (data?.spawnPoint  !== undefined)  (this.nodeData as MapNodeData).spawnPoint  = data.spawnPoint;
      if (data?.exitCells   !== undefined)  (this.nodeData as MapNodeData).exitCells   = data.exitCells;
      if (data?.trapCells   !== undefined)  (this.nodeData as MapNodeData).trapCells   = data.trapCells;
      this.setUserData(this.nodeData);
    }
  }
}
