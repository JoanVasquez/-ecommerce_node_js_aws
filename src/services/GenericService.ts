import { IRepository } from "../repositories/IRepository";
import { cacheModel } from "../utils/cacheModel";
import logger from "../utils/logger";
import { ICRUD } from "./ICRUD";

export abstract class GenericService<T> implements ICRUD<T> {
  constructor(protected genericRepository: IRepository<T>) {}

  async save(entity: T, cacheModel?: cacheModel): Promise<T | null> {
    logger.info(`[GenericService] Saving entity: ${JSON.stringify(entity)}`);
    return await this.genericRepository.createEntity(entity, cacheModel);
  }

  async findById(id: number, cacheModel?: cacheModel): Promise<T | null> {
    logger.info(`[GenericService] Finding entity by ID: ${id}`);
    return await this.genericRepository.findEntityById(id, cacheModel);
  }

  async update(
    id: number,
    updatedData: Partial<T>,
    cacheModel?: cacheModel
  ): Promise<T | null> {
    logger.info(
      `[GenericService] Updating entity with ID: ${id} with data: ${JSON.stringify(
        updatedData
      )}`
    );
    return await this.genericRepository.updateEntity(
      id,
      updatedData,
      cacheModel
    );
  }

  async delete(id: number, cacheModel?: cacheModel): Promise<boolean> {
    logger.info(`[GenericService] Deleting entity with ID: ${id}`);
    return await this.genericRepository.deleteEntity(id, cacheModel);
  }

  async findAll(cacheModel?: cacheModel): Promise<T[]> {
    logger.info(`[GenericService] Finding all entities`);
    return await this.genericRepository.getAllEntities(cacheModel);
  }

  async findWithPagination(
    skip: number,
    take: number,
    cacheModel?: cacheModel
  ): Promise<{ data: T[]; count: number }> {
    logger.info(
      `[GenericService] Finding entities with pagination: skip=${skip}, take=${take}`
    );
    return await this.genericRepository.getEntitiesWithPagination(
      skip,
      take,
      cacheModel
    );
  }
}
