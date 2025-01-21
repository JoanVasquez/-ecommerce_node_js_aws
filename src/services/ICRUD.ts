export interface ICRUD<T> {
  save(entity: T): Promise<T | null>;
  findById(id: number): Promise<T | null>;
  update(id: number, updatedData: Partial<T>): Promise<T | null>;
  delete(id: number): Promise<boolean>;
  findAll(): Promise<T[]>;
  findWithPagination(
    skip: number,
    take: number
  ): Promise<{ data: T[]; count: number }>;
}
