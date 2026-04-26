import { FilterTypeEnum } from "./FilterTypeEnum";

export class FilterModel {
  public column?: string;
  public filterType?: FilterTypeEnum;
  public isDate?: boolean;
  public isNull?: boolean = false;
  public value?: string | number;
}
