import { cacheModel } from "../utils/cacheModel";

export interface IRepository<T> {
  createEntity(entity: T, cacheModel?: cacheModel): Promise<T | null>;
  findEntityById(id: number, cacheModel?: cacheModel): Promise<T | null>;
  updateEntity(
    id: number,
    updatedData: Partial<T>,
    cacheModel?: cacheModel
  ): Promise<T | null>;
  deleteEntity(id: number, cacheModel?: cacheModel): Promise<boolean>;
  getAllEntities(cacheModel?: cacheModel): Promise<T[]>;
  getEntitiesWithPagination(
    skip: number,
    take: number,
    cacheModel?: cacheModel
  ): Promise<{ data: T[]; count: number }>;
}
