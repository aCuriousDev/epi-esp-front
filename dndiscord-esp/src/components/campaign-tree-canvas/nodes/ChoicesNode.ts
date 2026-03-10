import draw2d from 'draw2d';
import { tokens } from "@/styles/design-tokens";
import { CampaignNode, BaseNodeData } from './CampaignNode';

export interface ChoicesNodeData extends BaseNodeData {
  type: 'choices';
  title?: string;
  text?: string;
  choices?: string[];
}

export class ChoicesNode extends CampaignNode {
  static NAME = 'ChoicesNode';

  constructor(x: number, y: number, data: ChoicesNodeData) {
    super(x, y, data);


    this.textLabel = new draw2d.shape.basic.Label({
      text: this.truncateText(data?.text ?? '', 35),
      fontSize: 12,
      fontColor: tokens.nodes.story.text,
      color: tokens.nodes.story.text,
    });

    this.add(this.textLabel, new draw2d.layout.locator.CenterLocator());
  }

  protected createPorts(): void {
    const storyData = this.nodeData as ChoicesNodeData;
    // Port d'entrée — limité à 1 connexion (OneToOne)
    const inputPort = this.createSinglePort(
      'input',
      new draw2d.layout.locator.XYRelPortLocator(-5, 50)
    );
    inputPort.setName('input');

    this.createOutputPorts(storyData.choices ?? []);
  }

  private createOutputPorts(choices: string[]): void {
    if (choices.length === 0) {
      const port = this.createSinglePort(
        'output',
        new draw2d.layout.locator.XYRelPortLocator(100, 50)
      );
      port.setName('output');
      return;
    }

    choices.forEach((_, index) => {
      const yPercent = ((index + 1) / (choices.length + 1)) * 100;
      const port = this.createSinglePort(
        'output',
        new draw2d.layout.locator.XYRelPortLocator(105, yPercent)
      );
      port.setName(`choice-${index}`);
    });
  }

  public updateText(newText: string): void {
    (this.nodeData as ChoicesNodeData).text = newText;
    this.setUserData(this.nodeData);
  }

  public updateChoices(newChoices: string[]): void {
    (this.nodeData as ChoicesNodeData).choices = newChoices;

    // Snapshot des ports existants avant toute modification
    const currentPorts: any[] = [];
    this.getOutputPorts().each((_: number, port: any) => currentPorts.push(port));
    const currentCount = currentPorts.length;
    const newCount = newChoices.length === 0 ? 1 : newChoices.length;

    // ➕ Ajouter les ports manquants (position temporaire, recalculée ensuite)
    for (let i = currentCount; i < newCount; i++) {
      const port = this.createSinglePort(
        'output',
        new draw2d.layout.locator.XYRelPortLocator(105, 50)
      );
      port.setName(`choice-${i}`);
    }

    // ➖ Supprimer les ports en trop depuis la fin
    for (let i = currentCount - 1; i >= newCount; i--) {
      this.removePort(currentPorts[i]);
    }

    // Recollecte après add/remove
    const allPorts: any[] = [];
    this.getOutputPorts().each((_: number, port: any) => allPorts.push(port));

    // Recalculer les positions de TOUS les ports via setLocator — connexions préservées
    allPorts.forEach((port, index) => {
      const total = allPorts.length;
      const yPercent = total <= 1 ? 50 : ((index + 1) / (total + 1)) * 100;
      port.setName(newChoices.length === 0 ? 'output' : `choice-${index}`);
      port.setLocator(new draw2d.layout.locator.XYRelPortLocator(105, yPercent));
    });

    this.setUserData(this.nodeData);
    this.repaint();
  }

  public getPersistentAttributes(): any {
    return { ...super.getPersistentAttributes(), nodeData: this.nodeData };
  }

  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      const storyData = this.nodeData as ChoicesNodeData;
      this.updateTitle(storyData?.title ?? '');
      if (storyData.choices) this.updateChoices(storyData.choices);
    }
  }
}
