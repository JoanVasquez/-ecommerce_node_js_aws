import { DataSource, ObjectLiteral, Repository } from "typeorm";
import { IRepository } from "./IRepository";
import logger from "../utils/logger";
import { cacheModel } from "../utils/cacheModel";
import { cache } from "../utils/cacheConfig";

export abstract class GenericRepository<T extends ObjectLiteral>
  implements IRepository<T>
{
  protected repo: Repository<T>;

  constructor(datasource: DataSource, entityClass: { new (): T }) {
    this.repo = datasource.getRepository(entityClass);
  }

  async createEntity(entity: T, cacheModel?: cacheModel): Promise<T | null> {
    try {
      const savedEntity = await this.repo.save(entity);

      if (cacheModel) {
        const cacheEntity = await cache.get(cacheModel.key);

        if (!cacheEntity) {
          await cache.set(
            cacheModel.key,
            JSON.stringify(entity),
            cacheModel.expiration
          );
        }
      }
      return savedEntity;
    } catch (error) {
      logger.error(`[UserRepository] Error creating entity:`, { error });
    }

    return null;
  }

  async findEntityById(id: number, cacheModel?: cacheModel): Promise<T | null> {
    try {
      if (cacheModel) {
        const cacheEntity = await cache.get(cacheModel.key);
        if (cacheEntity) {
          return JSON.parse(cacheEntity);
        }
      }

      const entity = await this.repo.findOneBy({ id } as any);
      if (!entity) {
        logger.info(
          `[GenericRepository] Entity found: ${JSON.stringify(entity)}`
        );
        throw new Error("Entity not found");
      }

      if (cacheModel) {
        await cache.set(
          cacheModel.key,
          JSON.stringify(entity),
          cacheModel.expiration
        );
      }

      return entity;
    } catch (error) {
      logger.error(`[GenericRepository] Error finding entity:`, { error });
    }
    return null;
  }

  async updateEntity(
    id: number,
    updatedData: Partial<T>,
    cacheModel?: cacheModel
  ): Promise<T | null> {
    try {
      await this.repo.update(id, updatedData);

      const updatedEntity = await this.findEntityById(id);
      if (!updatedEntity) {
        logger.error(`[GenericRepository] Entity with ID: ${id} not found`);
        throw new Error(`Entity with ID ${id} not found`);
      }

      if (cacheModel) {
        await cache.set(
          cacheModel.key,
          JSON.stringify(updatedEntity),
          cacheModel.expiration
        );
      }

      return updatedEntity;
    } catch (error) {
      const foundEntity: T | null = await this.findEntityById(id);
      if (foundEntity) {
        await this.deleteEntity(foundEntity.id);
        logger.info(
          `[GenericRepository] Database entity rolled back: ${JSON.stringify(
            foundEntity
          )}`
        );
      }
      logger.error(`[GenericRepository] Error updating entity:`, { error });
    }

    return null;
  }

  async deleteEntity(id: number, cacheModel?: cacheModel): Promise<boolean> {
    try {
      const result = await this.repo.delete(id);
      if (result.affected === 0) {
        logger.error(
          `[GenericRepository] Failed to delete entity with ID: ${id}`
        );
        throw new Error(`Entity with ID ${id} not found`);
      }

      if (cacheModel) {
        await cache.delete(cacheModel.key);
      }

      return true;
    } catch (error) {
      logger.error(`[GenericRepository] Error deleting entity:`, { error });
    }
    return false;
  }

  async getAllEntities(cacheModel?: cacheModel): Promise<T[]> {
    if (cacheModel) {
      const cacheEntities = await cache.get(cacheModel.key);
      if (cacheEntities) {
        return JSON.parse(cacheEntities);
      }
    }

    const entities = await this.repo.find();

    if (cacheModel) {
      await cache.set(
        cacheModel.key,
        JSON.stringify(entities),
        cacheModel.expiration
      );
    }

    return entities;
  }

  async getEntitiesWithPagination(
    skip: number,
    take: number,
    cacheModel?: cacheModel
  ): Promise<{ data: T[]; count: number }> {
    if (cacheModel) {
      const cacheEntities = await cache.get(cacheModel.key);
      if (cacheEntities) {
        return JSON.parse(cacheEntities);
      }
    }
    const [data, count] = await this.repo.findAndCount({
      skip,
      take,
    });
    return { data, count };
  }
}
