import { Repository, DataSource } from "typeorm";
import { User } from "../entities/User";
import logger from "../utils/logger";

export class UserRepository {
  private repo: Repository<User>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(User);
  }

  /**
   * Find a user by username
   */
  async findUserByUsername(username: string): Promise<User | null> {
    logger.info(`[UserRepository] Finding user by username: ${username}`);
    const user = await this.repo.findOneBy({ username });
    if (user) {
      logger.info(`[UserRepository] User found: ${JSON.stringify(user)}`);
    } else {
      logger.warn(`[UserRepository] No user found with username: ${username}`);
    }
    return user;
  }

  /**
   * Create a new user
   */
  async createUser(user: Partial<User>): Promise<User | null> {
    try {
      logger.info(`[UserRepository] Creating user: ${JSON.stringify(user)}`);
      const newUser = await this.repo.save(user);
      logger.info(
        `[UserRepository] User created successfully: ${JSON.stringify(newUser)}`
      );
      return newUser;
    } catch (error) {
      const foundUser: User | null = await this.findUserByUsername(
        user?.username as string
      );
      if (foundUser) {
        await this.deleteUser(foundUser.id);
        logger.info(
          `[UserService] Database user rolled back: ${foundUser.username}`
        );
      }
      logger.error(`[UserRepository] Error creating user:`, { error });
    }

    return null;
  }

  /**
   * Find a user by ID
   */
  async findUserById(id: number): Promise<User | null> {
    logger.info(`[UserRepository] Finding user by ID: ${id}`);
    const user = await this.repo.findOneBy({ id });
    if (user) {
      logger.info(`[UserRepository] User found: ${JSON.stringify(user)}`);
    } else {
      logger.warn(`[UserRepository] No user found with ID: ${id}`);
    }
    return user;
  }

  /**
   * Update a user's information
   */
  async updateUser(
    id: number,
    updatedData: Partial<User>
  ): Promise<User | null> {
    try {
      logger.info(
        `[UserRepository] Updating user with ID: ${id}, Data: ${JSON.stringify(
          updatedData
        )}`
      );
      await this.repo.update(id, updatedData);

      logger.info(`[UserRepository] Getting user with ID: ${id}`);
      const updatedUser = await this.findUserById(id);
      if (!updatedUser) {
        logger.error(`[UserRepository] User with ID: ${id} not found`);
        throw new Error(`User with ID ${id} not found`);
      }

      logger.info(
        `[UserRepository] User updated successfully: ${JSON.stringify(
          updatedUser
        )}`
      );
      return updatedUser;
    } catch (error) {
      const foundUser: User | null = await this.findUserById(id);
      if (foundUser) {
        await this.deleteUser(foundUser.id);
        logger.info(
          `[UserService] Database user rolled back: ${foundUser.username}`
        );
      }
      logger.error(`[UserRepository] Error updating user:`, { error });
    }

    return null;
  }

  /**
   * Delete a user by ID
   */
  async deleteUser(id: number): Promise<void> {
    try {
      logger.info(`[UserRepository] Deleting user with ID: ${id}`);
      const result = await this.repo.delete(id);
      if (result.affected === 0) {
        logger.error(`[UserRepository] Failed to delete user with ID: ${id}`);
        throw new Error(`User with ID ${id} not found`);
      }
      logger.info(`[UserRepository] User with ID: ${id} deleted successfully`);
    } catch (error) {
      logger.error(`[UserRepository] Error deleting user:`, { error });
    }
  }

  /**
   * Retrieve all users
   */
  async getAllUsers(): Promise<User[]> {
    logger.info(`[UserRepository] Retrieving all users`);
    const users = await this.repo.find();
    logger.info(`[UserRepository] Retrieved ${users.length} users`);
    return users;
  }

  /**
   * Retrieve users with pagination
   */
  async getUsersWithPagination(
    skip: number,
    take: number
  ): Promise<{ data: User[]; count: number }> {
    logger.info(
      `[UserRepository] Retrieving users with pagination: skip=${skip}, take=${take}`
    );
    const [data, count] = await this.repo.findAndCount({
      skip,
      take,
    });
    logger.info(
      `[UserRepository] Retrieved ${data.length} users, Total count: ${count}`
    );
    return { data, count };
  }
}
