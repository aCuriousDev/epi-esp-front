import draw2d from 'draw2d';
import { tokens } from "@/styles/design-tokens";

/**
 * Interface de base pour tous les types de nodes
 */
export interface BaseNodeData {
  id: string;
  type: string;
  title?: string;
  [key: string]: any;
}

/**
 * CampaignNode - Classe de base pour tous les types de nodes
 * Utilise un Group pour permettre une composition flexible
 */
export abstract class CampaignNode extends draw2d.shape.composite.Group {
  protected nodeData: BaseNodeData;
  protected nodeWidth: number = 220;
  protected nodeHeight: number = 100;

  protected background: draw2d.shape.basic.Rectangle;
  protected titleLabel!: draw2d.shape.basic.Label;

  public x: number;
  public y: number;

  constructor(x: number, y: number, data: BaseNodeData) {
    super();

    this.x = x;
    this.y = y;
    this.nodeData = data;

    // Définir la taille du groupe
    this.setDimension(this.nodeWidth, this.nodeHeight);
    this.background = new draw2d.shape.basic.Rectangle({
      width: this.nodeWidth,
      height: this.nodeHeight,
      bgColor: '#2d2d30',
      color: '#3c3c3f',
      stroke: 1,
      radius: 8,
    });
    this.createBackground();
    this.add(this.background, new draw2d.layout.locator.XYAbsPortLocator(0, 0));

    this.createVisualElements();

    // Label de titre commun à tous les nodes
    this.titleLabel = new draw2d.shape.basic.Label({
      text: this.truncate(data.title ?? '', 28),
      fontSize: 12,
      fontColor: '#d4d4d4',
      color: 'none',
    });
    this.add(this.titleLabel, new draw2d.layout.locator.CenterLocator());

    // Créer les ports
    this.createPorts();

    // Stocker les données
    this.setUserData(data);

    // Rendre sélectionnable
    this.installEditPolicy(new draw2d.policy.figure.RectangleSelectionFeedbackPolicy());
  }

  /**
   * Tronque un texte si nécessaire
   */
  protected truncate(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '…';
  }

  /**
   * Méthode abstraite - chaque type de node définit ses propres éléments visuels
   * (rectangle, texte, icônes, etc.)
   */
  public createVisualElements(): void {}

  /**
   * Méthode abstraite - chaque type de node définit ses propres ports
   */
  protected abstract createPorts(): void;

  /** Méthode pour modifier le fond */
  public createBackground(): void {}

  /**
   * Met à jour le titre affiché sur le canvas
   */
  public updateTitle(newTitle: string): void {
    this.nodeData.title = newTitle;
    this.titleLabel.setText(this.truncate(newTitle, 28));
    this.setUserData(this.nodeData);
  }

  /**
   * Crée un port limité à une seule connexion (OneToOne).
   */
  protected createSinglePort(type: string, locator: any): any {
    const port = this.createPort(type, locator);
    port.setMaxFanOut(1);
    return port;
  }

  /**
   * Récupérer les données du node
   */
  public getData(): BaseNodeData {
    return this.nodeData;
  }

  /**
   * Override createCommand pour utiliser CommandDelete au lieu de CommandDeleteGroup.
   * CommandDelete gère la suppression des connexions automatiquement,
   * contrairement à CommandDeleteGroup qui ne le fait pas.
   */
  public createCommand(request: any): any {
    if (request?.getPolicy() === draw2d.command.CommandType.DELETE) {
      if (!this.isDeleteable()) return null;
      return new draw2d.command.CommandDelete(this);
    }
    return super.createCommand(request);
  }

  /**
   * Sérialisation
   */
  public getPersistentAttributes(): any {
    const attrs = super.getPersistentAttributes();
    return {
      ...attrs,
      type: (this.constructor as any).NAME,
      nodeData: this.nodeData
    };
  }

  /**
   * Désérialisation
   */
  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      this.nodeData = memento.nodeData;
    }
  }
}
