import draw2d from 'draw2d';

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
  protected nodeWidth: number = 240;
  protected nodeHeight: number = 110;

  protected background: draw2d.shape.basic.Rectangle;
  protected titleLabel!: draw2d.shape.basic.Label;

  public x: number;
  public y: number;

  constructor(x: number, y: number, data: BaseNodeData) {
    super();

    this.x = x;
    this.y = y;
    this.nodeData = data;

    // Permet aux sous-classes d'ajuster les dimensions avant le layout
    this.initDimensions();

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

    // ── Icône SVG Lucide en haut à gauche ─────────────────────────────────────
    // draw2d.SVGFigure accepte un SVG complet avec width/height.
    // Les attributs stroke/fill doivent être portés par chaque élément enfant
    // (draw2d n'hérite pas les attrs du <svg> parent).
    const iconSvg = this.getIconSvg();
    if (iconSvg) {
      const iconFig = new draw2d.SVGFigure({ svg: iconSvg, resizeable: false });
      iconFig.setWidth(20);
      iconFig.setHeight(20);
      this.add(iconFig, new draw2d.layout.locator.XYAbsPortLocator(8, 7));
    }

    // ── Label de titre — centré, grand et en gras ────────────────────────────
    this.titleLabel = new draw2d.shape.basic.Label({
      text: this.truncate(data.title ?? '', 22),
      fontSize: 16,
      fontColor: '#ffffff',
      bold: true,
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
   * Permet aux sous-classes d'ajuster nodeWidth / nodeHeight avant que le layout
   * ne soit calculé. Appelée au tout début du constructeur.
   */
  protected initDimensions(): void {}

  /**
   * Retourne la chaîne SVG (icône Lucide) affichée en haut à gauche du node.
   * Chaque sous-classe surcharge cette méthode.
   * Le SVG doit contenir width="20" height="20" et les attrs stroke/fill
   * sur chaque enfant (pas hérités du parent <svg>).
   */
  protected getIconSvg(): string { return ''; }

  /**
   * Tronque un texte si nécessaire
   */
  protected truncate(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '…';
  }

  /**
   * Hook visuel — chaque sous-classe peut ajouter ses propres éléments draw2d.
   */
  public createVisualElements(): void {}

  /**
   * Chaque type de node définit ses propres ports.
   */
  protected abstract createPorts(): void;

  /** Surcharge le fond par défaut (gris). */
  public createBackground(): void {}

  /**
   * Met à jour le titre affiché sur le canvas.
   */
  public updateTitle(newTitle: string): void {
    this.nodeData.title = newTitle;
    this.titleLabel.setText(this.truncate(newTitle, 22));
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
   * Récupérer les données du node.
   */
  public getData(): BaseNodeData {
    return this.nodeData;
  }

  /**
   * Override createCommand pour utiliser CommandDelete au lieu de CommandDeleteGroup.
   * CommandDelete gère la suppression des connexions automatiquement.
   */
  public createCommand(request: any): any {
    if (request?.getPolicy() === draw2d.command.CommandType.DELETE) {
      if (!this.isDeleteable()) return null;
      return new draw2d.command.CommandDelete(this);
    }
    return super.createCommand(request);
  }

  /** Sérialisation */
  public getPersistentAttributes(): any {
    const attrs = super.getPersistentAttributes();
    return {
      ...attrs,
      type: (this.constructor as any).NAME,
      nodeData: this.nodeData
    };
  }

  /** Désérialisation */
  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      this.nodeData = memento.nodeData;
    }
  }
}
