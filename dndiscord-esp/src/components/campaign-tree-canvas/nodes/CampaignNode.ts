import draw2d from 'draw2d';
import { tokens } from "@/styles/design-tokens";

export interface BaseNodeData {
  id: string;
  type: string;
  [key: string]: any;
}

export abstract class CampaignNode extends draw2d.shape.composite.Group {
  protected nodeData: BaseNodeData;
  protected nodeWidth: number = 220;
  protected nodeHeight: number = 100;
  protected background!: draw2d.shape.basic.Rectangle;

  public x: number;
  public y: number;

  constructor(x: number, y: number, data: BaseNodeData) {
    super();
    this.x = x;
    this.y = y;
    this.nodeData = data;

    // Les sous-classes définissent leurs dimensions via setDimensions()
    // avant que le background soit créé
    this.initDimensions();
    this.setDimension(this.nodeWidth, this.nodeHeight);

    // Créer le background avec les bonnes dimensions
    this.background = this.createBackground();
    this.add(this.background, new draw2d.layout.locator.XYAbsPortLocator(0, 0));

    this.createVisualElements();
    this.createPorts();

    this.setUserData(data);
    this.installEditPolicy(new draw2d.policy.figure.RectangleSelectionFeedbackPolicy());
  }

  /**
   * Hook pour que les sous-classes définissent leurs dimensions
   * AVANT la création du background. Override si besoin.
   */
  protected initDimensions(): void {}

  /**
   * Créer le rectangle de fond — override pour personnaliser la couleur
   */
  protected createBackground(): draw2d.shape.basic.Rectangle {
    return new draw2d.shape.basic.Rectangle({
      width: this.nodeWidth,
      height: this.nodeHeight,
      bgColor: '#2d2d30',
      color: '#3c3c3f',
      stroke: 2,
      radius: 8,
    });
  }

  protected abstract createVisualElements(): void;
  protected abstract createPorts(): void;

  public getData(): BaseNodeData {
    return this.nodeData;
  }

  public getPersistentAttributes(): any {
    return { ...super.getPersistentAttributes(), nodeData: this.nodeData };
  }

  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) this.nodeData = memento.nodeData;
  }
}