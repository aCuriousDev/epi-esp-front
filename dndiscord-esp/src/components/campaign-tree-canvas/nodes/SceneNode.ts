import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';
import { ICON_SCENE } from '../constants/nodeIcons';

export interface SceneNodeData extends BaseNodeData {
  type: 'scene';
  title?: string;
  text?: string;
}

export class SceneNode extends CampaignNode {
  static NAME = 'SceneNode';

  constructor(x: number, y: number, data: SceneNodeData) {
    super(x, y, data);
    // titleLabel + icône gérés par la classe de base (CampaignNode)
  }

  protected getIconSvg(): string { return ICON_SCENE; }

  override createBackground(): void {
    this.background = new draw2d.shape.basic.Rectangle({
      width: this.nodeWidth,
      height: this.nodeHeight,
      bgColor: '#1c1333',
      color: '#7c3aed',
      stroke: 2,
      radius: 8,
    });
  }

  protected createPorts(): void {
    // Port d'entrée — limité à 1 connexion (OneToOne)
    const inputPort = this.createSinglePort(
      'input',
      new draw2d.layout.locator.XYRelPortLocator(-5, 50)
    );
    inputPort.setName('input');

    // Port de sortie — limité à 1 connexion
    const outputPort = this.createSinglePort(
      'output',
      new draw2d.layout.locator.XYRelPortLocator(105, 50)
    );
    outputPort.setName('output');
  }

  public updateText(newText: string): void {
    (this.nodeData as SceneNodeData).text = newText;
    this.setUserData(this.nodeData);
  }

  public getPersistentAttributes(): any {
    return { ...super.getPersistentAttributes(), nodeData: this.nodeData };
  }

  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      const data = this.nodeData as SceneNodeData;
      this.updateTitle(data?.title ?? '');
    }
  }
}
