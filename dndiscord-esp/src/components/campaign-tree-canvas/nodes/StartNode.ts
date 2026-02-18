import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';

export interface StartNodeData extends BaseNodeData {
  type: 'start';
}


export class StartNode extends CampaignNode {
  constructor(x: number, y: number) {
    super(x, y, {
      id: 'start-node',
      type: 'start',
    });
  }

  protected initDimensions(): void {
    this.nodeWidth = 160;
    this.nodeHeight = 80;
  }

  protected createBackground(): draw2d.shape.basic.Rectangle {
    return new draw2d.shape.basic.Rectangle({
      width: this.nodeWidth,
      height: this.nodeHeight,
      bgColor: '#1a3a1a',
      color: '#2d7a2d',
      stroke: 2,
      radius: 20, // Forme en pilule
    });
  }

  protected createVisualElements(): void {
    const label = new draw2d.shape.basic.Label({
      text: '▶ Début',
      fontSize: 16,
      fontColor: '#88ff88',
      color: '#88ff88',
      bold: true,
    });
    this.add(label, new draw2d.layout.locator.CenterLocator());
  }

  protected createPorts(): void {
    // Uniquement un port de sortie (bas, centré)
    const outputPort = this.createPort(
      'output',
      new draw2d.layout.locator.XYRelPortLocator(103, 50)
    );
    outputPort.setName('start-output');
  }

  /**
   * Bloquer la suppression via la touche Delete ou le menu contextuel
   */
  public isDeleteable(): boolean {
    return false;
  }

  /**
   * Bloquer le drag hors du canvas (optionnel : empêcher de le déplacer)
   */
  public isDraggable(): boolean {
    return false; // On garde le drag pour pouvoir le repositionner
  }
}