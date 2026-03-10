import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';

export interface MapNodeData extends BaseNodeData {
  type: 'map';
  title?: string;
  selectedMap?: string;
}

export class MapNode extends CampaignNode {
  static NAME = 'MapNode';

  constructor(x: number, y: number, data: MapNodeData) {
    super(x, y, data);
    // titleLabel est géré par la classe de base (CampaignNode)
  }

  override createBackground(): void {
    this.background = new draw2d.shape.basic.Rectangle({
      width: this.nodeWidth,
      height: this.nodeHeight,
      bgColor: '#1a2a4a',
      color: '#2a4a8a',
      stroke: 2,
      radius: 8,
    });
  }

  protected createPorts(): void {
    // Port d'entrée à gauche
    const inputPort = this.createSinglePort(
      'input',
      new draw2d.layout.locator.XYRelPortLocator(-5, 50)
    );
    inputPort.setName('input');

    // Port de sortie à droite
    const outputPort = this.createSinglePort(
      'output',
      new draw2d.layout.locator.XYRelPortLocator(105, 50)
    );
    outputPort.setName('output');
  }

  public updateMap(mapId: string): void {
    (this.nodeData as MapNodeData).selectedMap = mapId;
    this.setUserData(this.nodeData);
  }

  public getPersistentAttributes(): any {
    return { ...super.getPersistentAttributes(), nodeData: this.nodeData };
  }

  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      const data = this.nodeData as MapNodeData;
      this.updateTitle(data?.title ?? '');
    }
  }
}
