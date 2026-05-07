import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';
import { ICON_VICTORY } from '../constants/nodeIcons';

export interface VictoryNodeData extends BaseNodeData {
  type: 'victory';
  title?: string;
}

export class VictoryNode extends CampaignNode {
  static NAME = 'VictoryNode';

  constructor(x: number, y: number, data: VictoryNodeData) {
    super(x, y, data);
  }

  protected getIconSvg(): string { return ICON_VICTORY; }

  override createBackground(): void {
    this.background = new draw2d.shape.basic.Rectangle({
      width: this.nodeWidth,
      height: this.nodeHeight,
      bgColor: '#1a1400',
      color: '#f59e0b',
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
    // Nœud terminal — aucun port de sortie
  }

  public getPersistentAttributes(): any {
    return { ...super.getPersistentAttributes(), nodeData: this.nodeData };
  }

  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      const data = this.nodeData as VictoryNodeData;
      this.updateTitle(data?.title ?? '');
    }
  }
}
