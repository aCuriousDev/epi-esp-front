import { PaginationModel } from "./PaginationModel";

export class PaginatedResponseModel<T> {
    data: T[] = [];
    pagination?: PaginationModel;
}
  