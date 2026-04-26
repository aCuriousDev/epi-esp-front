import { FilterModel } from "./FilterModel";

export class PaginatedRequestDto {
    filters?: FilterModel[] = [];
    actualPage: number = 1;
    itemPerPage: number = 10;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc' = 'asc';
  }