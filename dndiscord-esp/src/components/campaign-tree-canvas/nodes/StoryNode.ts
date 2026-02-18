import draw2d from 'draw2d';
import { tokens } from "@/styles/design-tokens";
import { CampaignNode, BaseNodeData } from './CampaignNode';

export interface StoryNodeData extends BaseNodeData {
  type: 'story';
  text?: string;
  choices?: string[];
}

export class StoryNode extends CampaignNode {
  private textLabel!: draw2d.shape.basic.Label;

  constructor(x: number, y: number, data: StoryNodeData) {
    super(x, y, data);
  }

  protected createVisualElements(): void {
    const storyData = this.nodeData as StoryNodeData;

    this.textLabel = new draw2d.shape.basic.Label({
      text: this.truncateText(storyData?.text ?? '', 35),
      fontSize: 12,
      fontColor: tokens.nodes.story.text,
      color: tokens.nodes.story.text
    });

    this.add(this.textLabel, new draw2d.layout.locator.CenterLocator());
  }

  protected createPorts(): void {
    const storyData = this.nodeData as StoryNodeData;
    // Port d'entrée (haut, centré)
    const inputPort = this.createPort(
      'input',
      new draw2d.layout.locator.XYRelPortLocator(-5, 50)
    );
    inputPort.setName('input');

    this.createOutputPorts(storyData.choices ?? [])
   
  }

    private createOutputPorts(choices: string[]): void {
    if (choices.length === 0) {
      // Un seul port centré à droite
      const port = this.createPort(
        'output',
        new draw2d.layout.locator.XYRelPortLocator(100, 50)
      );
      port.setName('output');
      return;
    }

    // Répartition verticale centrée sur le côté droit
    // Ex: 1 choix → 50%, 2 choix → 33% / 66%, 3 choix → 25% / 50% / 75%
    choices.forEach((_, index) => {
      const yPercent = ((index + 1) / (choices.length + 1)) * 100;

      const port = this.createPort(
        'output',
        new draw2d.layout.locator.XYRelPortLocator(105, yPercent)
      );
      port.setName(`choice-${index}`);
    });
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
  }

  public updateText(newText: string): void {
    (this.nodeData as StoryNodeData).text = newText;
    this.textLabel.setText(this.truncateText(newText, 35));
    this.setUserData(this.nodeData);
  }

  public updateChoices(newChoices: string[]): void {
    (this.nodeData as StoryNodeData).choices = newChoices;

    // Supprimer les anciens ports de sortie
    this.getOutputPorts().each((_: number, port: any) => this.removePort(port));

    if (newChoices.length === 0) {
      const p = this.createPort(
        'output',
        new draw2d.layout.locator.XYAbsPortLocator(this.nodeWidth / 2, this.nodeHeight)
      );
      p.setName('output');
    } else {
      newChoices.forEach((_, index) => {
        const spacing = this.nodeWidth / (newChoices.length + 1);
        const p = this.createPort(
          'output',
          new draw2d.layout.locator.XYAbsPortLocator(spacing * (index + 1), this.nodeHeight)
        );
        p.setName(`choice-${index}`);
      });
    }

    this.setUserData(this.nodeData);
  }

  public getPersistentAttributes(): any {
    return { ...super.getPersistentAttributes(), nodeData: this.nodeData };
  }

  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      const storyData = this.nodeData as StoryNodeData;
      this.updateText(storyData?.text ?? '');
      if (storyData.choices) this.updateChoices(storyData.choices);
    }
  }
}