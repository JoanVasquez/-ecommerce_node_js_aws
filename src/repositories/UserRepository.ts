import { Repository, DataSource } from "typeorm";
import { cache } from "../utils/cache";
import { User } from "../entities/User";
import logger from "../utils/logger";
import { GenericRepository } from "./GenericRepository";

export class UserRepository extends GenericRepository<User> {
  constructor(dataSource: DataSource) {
    super(dataSource, User);
  }

  async findUserByUsername(username: string): Promise<User | null> {
    try {
      const user = await this.repo.findOneBy({ username });
      if (!user) {
        logger.warn(
          `[UserRepository] No user found with username: ${username}`
        );
        throw new Error(`User with username ${username} not found`);
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
