import draw2d from 'draw2d';
import { tokens } from "@/styles/design-tokens";
import { CampaignNode, BaseNodeData } from './CampaignNode';
import { ICON_COMBAT } from '../constants/nodeIcons';

export interface VillainPlacement {
  characterId: string;
  position: { x: number; y: number };
}

export interface CombatNodeData extends BaseNodeData {
  type: 'combat';
  title?: string;
  selectedMap?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  villains?: VillainPlacement[];
}

export class CombatNode extends CampaignNode {
  static NAME = 'CombatNode';

  constructor(x: number, y: number, data: CombatNodeData) {
    super(x, y, data);
  }

  protected initDimensions(): void {
    this.nodeWidth = 240;
    this.nodeHeight = 120;
  }

  protected getIconSvg(): string { return ICON_COMBAT; }

  override createBackground(): void {
    this.background.setBackgroundColor(tokens.nodes.combat.fill);
    this.background.setColor(tokens.nodes.combat.stroke);
  }

  protected createPorts(): void {
    // Port d'entrée à gauche — même layout que Scene/Choices
    const inputPort = this.createSinglePort(
      'input',
      new draw2d.layout.locator.XYRelPortLocator(-5, 50)
    );
    inputPort.setName('input');

    // Port victoire — droite haut
    const victoryPort = this.createSinglePort(
      'output',
      new draw2d.layout.locator.XYRelPortLocator(105, 33)
    );
    victoryPort.setName('victory');

    // Port défaite — droite bas
    const defeatPort = this.createSinglePort(
      'output',
      new draw2d.layout.locator.XYRelPortLocator(105, 66)
    );
    defeatPort.setName('defeat');
  }

  public updateMap(mapId: string): void {
    (this.nodeData as CombatNodeData).selectedMap = mapId;
    this.setUserData(this.nodeData);
  }

  public updateDifficulty(difficulty: 'easy' | 'medium' | 'hard'): void {
    (this.nodeData as CombatNodeData).difficulty = difficulty;
    this.setUserData(this.nodeData);
  }

  public updateVillains(villains: VillainPlacement[]): void {
    (this.nodeData as CombatNodeData).villains = villains;
    this.setUserData(this.nodeData);
  }

  public getPersistentAttributes(): any {
    return { ...super.getPersistentAttributes(), nodeData: this.nodeData };
  }

  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      const data = this.nodeData as CombatNodeData;
      this.updateTitle(data?.title ?? '');
    }
  }
}
