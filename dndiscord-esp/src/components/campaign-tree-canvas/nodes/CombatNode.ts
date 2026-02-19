import draw2d from 'draw2d';
import { tokens } from "@/styles/design-tokens";
import { CampaignNode, BaseNodeData } from './CampaignNode';

export interface CombatNodeData extends BaseNodeData {
  type: 'combat';
  enemies?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

export class CombatNode extends CampaignNode {
  private enemiesLabel!: draw2d.shape.basic.Label;
  private difficultyLabel!: draw2d.shape.basic.Label;

  constructor(x: number, y: number, data: CombatNodeData) {
    super(x, y, data);
  }

  protected initDimensions(): void {
    this.nodeWidth = 240;
    this.nodeHeight = 120;
    this.background.setBackgroundColor(tokens.nodes.combat.fill);
    this.background.setColor(tokens.nodes.combat.stroke);
  }

  override createBackground(): void {
    this.background =  new draw2d.shape.basic.Rectangle({
      width: this.nodeWidth,
      height: this.nodeHeight,
      bgColor: '#4a1a1a',
      color: '#8b0000',
      stroke: 2,
      radius: 8,
    });
  }

  override createVisualElements(): void {
    const combatData = this.nodeData as CombatNodeData;

    this.enemiesLabel = new draw2d.shape.basic.Label({
      text: `⚔️ Ennemis: ${(combatData.enemies || []).length}`,
      fontSize: 12,
      fontColor: tokens.text.high,
      color: tokens.text.high
    });
    this.add(this.enemiesLabel, new draw2d.layout.locator.XYRelPortLocator(50, 25));

    this.difficultyLabel = new draw2d.shape.basic.Label({
      text: this.getDifficultyIcon(combatData.difficulty || 'medium'),
      fontSize: 14,
      fontColor: tokens.status.danger,
      color: tokens.status.danger,
      bold: true
    });
    this.add(this.difficultyLabel, new draw2d.layout.locator.XYRelPortLocator(50, 58));
  }

  protected createPorts(): void {
    const inputPort = this.createPort(
      'input',
      new draw2d.layout.locator.XYRelPortLocator(50, 0)
    );
    inputPort.setName('input');

    const victoryPort = this.createPort(
      'output',
      new draw2d.layout.locator.XYRelPortLocator(33, 100)
    );
    victoryPort.setName('victory');

    const defeatPort = this.createPort(
      'output',
      new draw2d.layout.locator.XYRelPortLocator(66, 100)
    );
    defeatPort.setName('defeat');
  }

  private getDifficultyIcon(difficulty: string): string {
    return { easy: '★☆☆', medium: '★★☆', hard: '★★★' }[difficulty] ?? '★★☆';
  }

  public updateEnemies(enemies: string[]): void {
    (this.nodeData as CombatNodeData).enemies = enemies;
    this.enemiesLabel.setText(`⚔️ Ennemis: ${enemies.length}`);
    this.setUserData(this.nodeData);
  }

  public updateDifficulty(difficulty: 'easy' | 'medium' | 'hard'): void {
    (this.nodeData as CombatNodeData).difficulty = difficulty;
    this.difficultyLabel.setText(this.getDifficultyIcon(difficulty));
    this.setUserData(this.nodeData);
  }
}