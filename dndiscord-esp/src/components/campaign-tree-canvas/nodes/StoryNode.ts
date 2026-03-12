import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';

export interface StoryNodeData extends BaseNodeData {
  type: 'story';
  text?: string;
  choices?: string[];
}


/**
 * StoryNode - Node pour les scènes narratives
 * Le rectangle est un vrai enfant du Group
 */
export class StoryNode extends CampaignNode {
  private textLabel: draw2d.shape.basic.Label = new draw2d.shape.basic.Label({
    text: '',
    fontSize: 12,
    fontColor: '#d4d4d4',
    color: '#d4d4d4'
  });
  
  constructor(x: number, y: number, data: StoryNodeData) {
    super(x, y, data);
  }
  
  /**
   * Créer les éléments visuels spécifiques au StoryNode
   */
  protected createVisualElements(): void {
    const storyData = this.nodeData as StoryNodeData;
    
    // Ajouter le rectangle au groupe en position (0,0)
    
    // 2. Créer le label de texte
    this.textLabel = new draw2d.shape.basic.Label({
      text: this.truncateText(storyData?.text ?? "", 35),
      fontSize: 12,
      fontColor: '#d4d4d4',
      color: '#d4d4d4'
    });
    
    // Ajouter le label au groupe (centré)
    // Il sera automatiquement AU-DESSUS du rectangle
    this.add(this.textLabel, new draw2d.layout.locator.CenterLocator());
  }
  
  /**
   * Créer les ports spécifiques au StoryNode
   */
  protected createPorts(): void {
    // Port d'entrée en haut (centré)
    // const inputPort = this.createPort(
    //   'input',
    //   new draw2d.layout.locator.XYAbsPortLocator(this.nodeWidth / 2, 0)
    // );
    // inputPort.setName('input');
    
    // // Ports de sortie en bas (basés sur les choix)
    // const storyData = this.nodeData as StoryNodeData;
    // const choices = storyData.choices || [];
    
    // if (choices.length === 0) {
    //   const outputPort = this.createPort(
    //     'output',
    //     new draw2d.layout.locator.XYAbsPortLocator(this.nodeWidth / 2, this.nodeHeight)
    //   );
    //   outputPort.setName('output');
    // } else {
    //   choices.forEach((choice, index) => {
    //     const spacing = this.nodeWidth / (choices.length + 1);
    //     const x = spacing * (index + 1);
        
    //     const outputPort = this.createPort(
    //       'output',
    //       new draw2d.layout.locator.XYAbsPortLocator(x, this.nodeHeight)
    //     );
    //     outputPort.setName(`choice-${index}`);
    //   });
    // }
  }
  
  /**
   * Tronquer le texte
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  /**
   * Mettre à jour le texte
   */
  public updateText(newText: string): void {
    const storyData = this.nodeData as StoryNodeData;
    storyData.text = newText;
    this.textLabel.setText(this.truncateText(newText, 35));
    this.setUserData(this.nodeData);
  }
  
  /**
   * Mettre à jour les choix
   */
  public updateChoices(newChoices: string[]): void {
    const storyData = this.nodeData as StoryNodeData;
    storyData.choices = newChoices;
    
    // Supprimer les anciens ports de sortie
    const outputPorts = this.getOutputPorts();
    outputPorts.each((i: number, port: any) => {
      this.removePort(port);
    });
    
    // Recréer les ports
    if (newChoices.length === 0) {
      const outputPort = this.createPort(
        'output',
        new draw2d.layout.locator.XYAbsPortLocator(this.nodeWidth / 2, this.nodeHeight)
      );
      outputPort.setName('output');
    } else {
      newChoices.forEach((choice, index) => {
        const spacing = this.nodeWidth / (newChoices.length + 1);
        const x = spacing * (index + 1);
        
        const outputPort = this.createPort(
          'output',
          new draw2d.layout.locator.XYAbsPortLocator(x, this.nodeHeight)
        );
        outputPort.setName(`choice-${index}`);
      });
    }
    
    this.setUserData(this.nodeData);
  }
  
  /**
   * Override de getPersistentAttributes
   */
  public getPersistentAttributes(): any {
    const attrs = super.getPersistentAttributes();
    return {
      ...attrs,
      nodeData: this.nodeData
    };
  }
  
  /**
   * Override de setPersistentAttributes
   */
  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      this.nodeData = memento.nodeData;
      const storyData = this.nodeData as StoryNodeData;
      this.updateText(storyData?.text ?? "");
      if (storyData.choices) {
        this.updateChoices(storyData.choices);
      }
    }
  }
}