import draw2d from 'draw2d';

/**
 * Interface de base pour tous les types de nodes
 */
export interface BaseNodeData {
  id: string;
  type: string;
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

  protected background: draw2d.shape.basic.Rectangle = new draw2d.shape.basic.Rectangle({
    width: this.nodeWidth,
    height: this.nodeHeight,
    bgColor: '#2d2d30',
    color: '#3c3c3f',
    stroke: 1,
    radius: 8,
  });
  
  public x: number;
  public y: number;
  
  constructor(x: number, y: number, data: BaseNodeData) {
    super();
    
    this.x = x;
    this.y = y;
    this.nodeData = data;
    
    // Définir la taille du groupe
    this.setDimension(this.nodeWidth, this.nodeHeight);
    
    this.add(this.background, new draw2d.layout.locator.XYAbsPortLocator(0, 0));
    
    // Les classes enfants vont créer leurs propres éléments visuels
    this.createVisualElements();
    
    
    // Créer les ports
    this.createPorts();
    
    // Stocker les données
    this.setUserData(data);
    
    // Rendre sélectionnable
    this.installEditPolicy(new draw2d.policy.figure.RectangleSelectionFeedbackPolicy());
  }
  
  /**
   * Méthode abstraite - chaque type de node définit ses propres éléments visuels
   * (rectangle, texte, icônes, etc.)
   */
  protected abstract createVisualElements(): void;
  
  /**
   * Méthode abstraite - chaque type de node définit ses propres ports
   */
  protected abstract createPorts(): void;
  
  /**
   * Récupérer les données du node
   */
  public getData(): BaseNodeData {
    return this.nodeData;
  }
  
  /**
   * Sérialisation
   */
  public getPersistentAttributes(): any {
    const attrs = super.getPersistentAttributes();
    return {
      ...attrs,
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