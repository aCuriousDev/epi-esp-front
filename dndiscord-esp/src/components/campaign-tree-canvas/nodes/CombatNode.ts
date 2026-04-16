import draw2d from 'draw2d';
import { tokens } from "@/styles/design-tokens";
import { CampaignNode, BaseNodeData } from './CampaignNode';

export interface CombatNodeData extends BaseNodeData {
  type: 'combat';
  enemies?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}


/**
 * CombatNode - Node pour les combats
 * Visuel différent du StoryNode (couleur rouge, icône d'épée, etc.)
 */
export class CombatNode extends CampaignNode {
  private enemiesLabel: draw2d.shape.basic.Label = new draw2d.shape.basic.Label({
    text: '⚔️ Ennemis: 0',
    fontSize: 12});
  private difficultyLabel: draw2d.shape.basic.Label = new draw2d.shape.basic.Label({
    text: '★★☆',
    fontSize: 14,
    bold: true
  });
  
  
  constructor(x: number, y: number, data: CombatNodeData) {
    // On peut avoir une taille différente pour les combats
    super(x, y, data);
    this.nodeWidth = 240;
    this.nodeHeight = 120;
    this.background.setBackgroundColor(tokens.nodes.combat.fill);
    this.background.setColor(tokens.nodes.combat.stroke);
  }
  
  /**
   * Créer les éléments visuels spécifiques au CombatNode
   */
  protected createVisualElements(): void {
    const combatData = this.nodeData as CombatNodeData;

    

    // 1. Label pour les ennemis
    this.enemiesLabel = new draw2d.shape.basic.Label({
      text: `⚔️ Ennemis: ${(combatData.enemies || []).length}`,
      fontSize: 12,
      fontColor: tokens.text.high,
      color: tokens.text.high
    });
    
    // Positionner en haut
    this.add(this.enemiesLabel, new draw2d.layout.locator.XYAbsPortLocator(120, 30));
    
    // 2. Label pour la difficulté
    const difficultyText = this.getDifficultyIcon(combatData.difficulty || 'medium');
    this.difficultyLabel = new draw2d.shape.basic.Label({
      text: difficultyText,
      fontSize: 14,
      fontColor: tokens.status.danger,
      color: tokens.status.danger,
      bold: true
    });
    
    // Positionner en bas
    this.add(this.difficultyLabel, new draw2d.layout.locator.XYAbsPortLocator(120, 70));
  }
  
  /**
   * Créer les ports spécifiques au CombatNode
   */
  protected createPorts(): void {
    // Port d'entrée
    const inputPort = this.createPort(
      'input',
      new draw2d.layout.locator.XYAbsPortLocator(this.nodeWidth / 2, 0)
    );
    inputPort.setName('input');
    
    // Deux ports de sortie : Victoire et Défaite
    const victoryPort = this.createPort(
      'output',
      new draw2d.layout.locator.XYAbsPortLocator(this.nodeWidth / 3, this.nodeHeight)
    );
    victoryPort.setName('victory');
    
    const defeatPort = this.createPort(
      'output',
      new draw2d.layout.locator.XYAbsPortLocator((this.nodeWidth / 3) * 2, this.nodeHeight)
    );
    defeatPort.setName('defeat');
  }
  
  /**
   * Dessiner le fond du node en ROUGE pour les combats
   */
  public setCanvas(canvas: any): void {
    super.setCanvas(canvas);

  }
  
  /**
   * Obtenir l'icône de difficulté
   */
  private getDifficultyIcon(difficulty: string): string {
    switch (difficulty) {
      case 'easy': return '★☆☆';
      case 'medium': return '★★☆';
      case 'hard': return '★★★';
      default: return '★★☆';
    }
  }
  
  /**
   * Mettre à jour les ennemis
   */
  public updateEnemies(enemies: string[]): void {
    const combatData = this.nodeData as CombatNodeData;
    combatData.enemies = enemies;
    this.enemiesLabel.setText(`⚔️ Ennemis: ${enemies.length}`);
    this.setUserData(this.nodeData);
  }
  
  /**
   * Mettre à jour la difficulté
   */
  public updateDifficulty(difficulty: 'easy' | 'medium' | 'hard'): void {
    const combatData = this.nodeData as CombatNodeData;
    combatData.difficulty = difficulty;
    this.difficultyLabel.setText(this.getDifficultyIcon(difficulty));
    this.setUserData(this.nodeData);
  }
}