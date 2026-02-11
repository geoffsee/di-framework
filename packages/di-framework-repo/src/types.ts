export type EntityId = string | number;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export type PaginatedResult<T> = Page<T>;
