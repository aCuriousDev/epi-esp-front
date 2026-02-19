import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';

export interface ChoicesNodeData extends BaseNodeData {
  type: 'choices';
  text?: string;
  choices?: string[];
}

export class ChoicesNode extends CampaignNode {
  private textLabel: draw2d.shape.basic.Label;

  constructor(x: number, y: number, data: ChoicesNodeData) {
    super(x, y, data);


    this.textLabel = new draw2d.shape.basic.Label({
    text: this.truncateText(data?.text ?? '', 35),
    fontSize: 12,
    fontColor: '#d4d4d4',
    color: '#a29797',
    });

    this.add(this.textLabel, new draw2d.layout.locator.CenterLocator());
  }
  //#region NODE VISUAL DEFINITION
  // override createVisualElements(): void {
  //   const storyData = this.nodeData as ChoicesNodeData;

  //   this.textLabel = new draw2d.shape.basic.Label({
  //     text: this.truncateText(storyData?.text ?? '', 35),
  //     fontSize: 12,
  //     fontColor: '#d4d4d4',
  //     color: '#f02424',
  //   });

  //   this.add(this.textLabel, new draw2d.layout.locator.CenterLocator());
  // }

  protected createPorts(): void {
    const storyData = this.nodeData as ChoicesNodeData;
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

  //#endregion
  //#region Node Logical Definition
  private truncateText(text: string, maxLength: number): string {
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
  }

  public updateText(newText: string): void {
    console.log("UpdateChoixeText");
    (this.nodeData as ChoicesNodeData).text = newText;
    this.textLabel.setText(this.truncateText(newText, 35));
    this.setUserData(this.nodeData);
  }


  public updateChoices(newChoices: string[]): void {
     console.log("UpdateChoixes");
    (this.nodeData as ChoicesNodeData).choices = newChoices;
    console.log(this.getOutputPorts())
    // Supprimer les anciens ports de sortie
    this.getOutputPorts().each((_: number, port: any) => this.removePort(port));
    this.createOutputPorts(newChoices)
    this.setUserData(this.nodeData);
    this.repaint()
  }

  //#endregion
  public getPersistentAttributes(): any {
    return { ...super.getPersistentAttributes(), nodeData: this.nodeData };
  }

  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      const storyData = this.nodeData as ChoicesNodeData;
      this.updateText(storyData?.text ?? '');
      if (storyData.choices) this.updateChoices(storyData.choices);
    }
  }
}