import draw2d from 'draw2d';
import { CampaignNode, BaseNodeData } from './CampaignNode';

export interface SceneNodeData extends BaseNodeData {
  type: 'scene';
  title?: string;
  text?:string;
}

export class SceneNode extends CampaignNode {
  static NAME = 'SceneNode';
  private titleLabel: draw2d.shape.basic.Label;

  constructor(x: number, y: number, data: SceneNodeData) {
    super(x, y, data);


    this.titleLabel = new draw2d.shape.basic.Label({
    text: this.truncateTitle(data?.title ?? '', 35),
    fontSize: 12,
    fontColor: '#d4d4d4',
    color: '#a29797',
    });

    this.add(this.titleLabel, new draw2d.layout.locator.CenterLocator());
  }
  //#region NODE VISUAL DEFINITION

  protected createPorts(): void {
    const storyData = this.nodeData as SceneNodeData;
    // Port d'entrée (haut, centré)
    const inputPort = this.createPort(
      'input',
      new draw2d.layout.locator.XYRelPortLocator(-5, 50)
    );
    inputPort.setName('input');

    this.createOutputPorts(storyData.scene ?? [])
   
  }

   private createOutputPorts(scene: string[]): void {
        // Un seul port centré à droite
        const port = this.createPort(
        'output',
        new draw2d.layout.locator.XYRelPortLocator(105, 50)
        );
        port.setName('output');
        return;
  }

  //#endregion
  //#region Node Logical Definition
  private truncateTitle(title: string, maxLength: number): string {
    return title.length <= maxLength ? title : title.substring(0, maxLength) + '...';
  }

  public updateTitle(newTitle: string): void {
    console.log("UpdateChoixeTitle");
    (this.nodeData as SceneNodeData).title = newTitle;
    this.titleLabel.setText(this.truncateTitle(newTitle, 35));
    this.setUserData(this.nodeData);
  }

  public updateText(newText:string) : void{
    console.log("UpdateText");
    (this.nodeData as SceneNodeData).text = newText;
    this.setUserData(this.nodeData);
  }

  //#endregion
  public getPersistentAttributes(): any {
    return { ...super.getPersistentAttributes(), nodeData: this.nodeData };
  }

  public setPersistentAttributes(memento: any): void {
    super.setPersistentAttributes(memento);
    if (memento.nodeData) {
      const storyData = this.nodeData as SceneNodeData;
      this.updateTitle(storyData?.title ?? '');
    }
  }
}