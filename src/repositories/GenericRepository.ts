import { DataSource, ObjectLiteral, Repository } from "typeorm";
import { IRepository } from "./IRepository";
import logger from "../utils/logger";

export abstract class GenericRepository<T extends ObjectLiteral>
  implements IRepository<T>
{
  protected repo: Repository<T>;

  constructor(datasource: DataSource, entityClass: { new (): T }) {
    this.repo = datasource.getRepository(entityClass);
  }

  async createEntity(entity: T): Promise<T | null> {
    try {
      return await this.repo.save(entity);
    } catch (error) {
      logger.error(`[UserRepository] Error creating entity:`, { error });
    }

    return null;
  }

  async findEntityById(id: number): Promise<T | null> {
    try {
      const entity = await this.repo.findOneBy({ id } as any);
      if (!entity) {
        logger.info(
          `[GenericRepository] Entity found: ${JSON.stringify(entity)}`
        );
        throw new Error("Entity not found");
      }

      return entity;
    } catch (error) {
      logger.error(`[GenericRepository] Error finding entity:`, { error });
    }
    return null;
  }

  async updateEntity(id: number, updatedData: Partial<T>): Promise<T | null> {
    try {
      await this.repo.update(id, updatedData);

      const updatedEntity = await this.findEntityById(id);
      if (!updatedEntity) {
        logger.error(`[GenericRepository] Entity with ID: ${id} not found`);
        throw new Error(`Entity with ID ${id} not found`);
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

  async deleteEntity(id: number): Promise<boolean> {
    try {
      const result = await this.repo.delete(id);
      if (result.affected === 0) {
        logger.error(
          `[GenericRepository] Failed to delete entity with ID: ${id}`
        );
        throw new Error(`Entity with ID ${id} not found`);
      }
      return true;
    } catch (error) {
      logger.error(`[GenericRepository] Error deleting entity:`, { error });
    }
    return false;
  }

  async getAllEntities(): Promise<T[]> {
    return await this.repo.find();
  }

  async getEntitiesWithPagination(
    skip: number,
    take: number
  ): Promise<{ data: T[]; count: number }> {
    const [data, count] = await this.repo.findAndCount({
      skip,
      take,
    });
    return { data, count };
  }
}
