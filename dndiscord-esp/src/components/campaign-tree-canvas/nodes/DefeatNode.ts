import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';
import { ICON_DEFEAT } from '../constants/nodeIcons';

export interface DefeatNodeData extends BaseNodeData {
  type: 'defeat';
  title?: string;
}

export class DefeatNode extends CampaignNode {
  static NAME = 'DefeatNode';

  constructor(x: number, y: number, data: DefeatNodeData) {
    super(x, y, data);
  }

  protected getIconSvg(): string { return ICON_DEFEAT; }

  override createBackground(): void {
    this.background = new draw2d.shape.basic.Rectangle({
      width: this.nodeWidth,
      height: this.nodeHeight,
      bgColor: '#1a0505',
      color: '#dc2626',
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
      const data = this.nodeData as DefeatNodeData;
      this.updateTitle(data?.title ?? '');
    }
  }
}
