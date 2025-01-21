import { Repository, DataSource } from "typeorm";
import { cache } from "../utils/cacheConfig";
import { User } from "../entities/User";
import logger from "../utils/logger";
import { GenericRepository } from "./GenericRepository";
import { cacheModel } from "../utils/cacheModel";

export class UserRepository extends GenericRepository<User> {
  constructor(dataSource: DataSource) {
    super(dataSource, User);
  }

  async findUserByUsername(
    username: string,
    cacheModel?: cacheModel
  ): Promise<User | null> {
    try {
      if (cacheModel) {
        const cacheEntity = await cache.get(cacheModel.key);
        if (cacheEntity) {
          return JSON.parse(cacheEntity);
        }
      }

      const user = await this.repo.findOneBy({ username });
      if (!user) {
        logger.warn(
          `[UserRepository] No user found with username: ${username}`
        );
        throw new Error(`User with username ${username} not found`);
      }

      if (cacheModel) {
        await cache.set(
          cacheModel.key,
          JSON.stringify(user),
          cacheModel.expiration
        );
      }

      return user;
    } catch (error) {
      logger.error(`[UserRepository] Error finding user by username:`, {
        error,
      });
    }
    return null;
  }
}
