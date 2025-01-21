export interface IRepository<T> {
  createEntity(entity: T): Promise<T | null>;
  findEntityById(id: number): Promise<T | null>;
  updateEntity(id: number, updatedData: Partial<T>): Promise<T | null>;
  deleteEntity(id: number): Promise<boolean>;
  getAllEntities(): Promise<T[]>;
  getEntitiesWithPagination(
    skip: number,
    take: number
  ): Promise<{ data: T[]; count: number }>;
}
