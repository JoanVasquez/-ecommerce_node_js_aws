import { UserRepository } from "../repositories/UserRepository";
import { AuthenticationService } from "./AuthenticationService";
import { PasswordService } from "./PasswordService";
import { cache } from "../utils/cache";
import { User } from "../entities/User";
import { encryptPassword } from "../utils/kmsConfig";
import { getCachedParameter } from "../utils/ssmConfig";
import {
  authenticate as cognitoAuthenticate,
  registerUser as cognitoRegisterUser,
  confirmUserRegistration as cognitoConfirmUserRegistration,
  initiatePasswordReset as cognitoInitiatePasswordReset,
  completePasswordReset as cognitoCompletePasswordReset,
} from "../utils/cognito";
import logger from "../utils/logger"; // Winston logger

export class UserService {
  private userRepository: UserRepository;
  private authService: AuthenticationService;
  private passwordService: PasswordService;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
    this.authService = new AuthenticationService();
    this.passwordService = new PasswordService();
  }

  async register(username: string, password: string, email: string) {
    let cognitoUserCreated = false;
    let databaseUserCreated = false;

    try {
      logger.info(`[UserService] Registering user: ${username}`);

      // Register user in Cognito
      await this.authService.registerUser(username, password, email);

      // Get the KMS Key ID from SSM
      const encryptedPassword = await this.passwordService.resetPassword(
        username,
        password
      );
      logger.info(
        `[UserService] Retrieved KMS Key ID for password encryption.`
      );

      // Store user details in the database
      const user = await this.userRepository.createUser({
        username,
        password: encryptedPassword,
        email,
      });
      databaseUserCreated = true; // Track that the database user was created
      logger.info(`[UserService] User created in database: ${username}`);

      await cache.set(`user:${username}`, JSON.stringify(user), 3600);
      logger.info(`[UserService] User cached successfully: ${username}`);

      return {
        message: "User registered successfully. Please confirm your email.",
      };
    } catch (error) {
      logger.error(`[UserService] Registration failed for user: ${username}`, {
        error,
      });

      // Rollback logic
      try {
        if (cognitoUserCreated) {
          logger.info(`[UserService] Rolling back Cognito user: ${username}`);
          await cache.delete(username);
          logger.info(`[UserService] Cognito user rolled back: ${username}`);
        }

        if (databaseUserCreated) {
          logger.info(`[UserService] Rolling back database user: ${username}`);
          const user = await this.userRepository.findUserByUsername(username);
          if (user) {
            await this.userRepository.deleteUser(user.id);
            logger.info(`[UserService] Database user rolled back: ${username}`);
          }
        }

        // Remove cache if any was set
        logger.info(`[UserService] Removing cache for user: ${username}`);
        await cache.delete(`user:${username}`);
        logger.info(`[UserService] Cache removed for user: ${username}`);
      } catch (rollbackError) {
        logger.error(
          `[UserService] Rollback failed for user: ${username}`,
          rollbackError
        );
      }

      throw new Error("Registration failed");
    }
  }

  async confirmRegistration(username: string, confirmationCode: string) {
    try {
      logger.info(
        `[UserService] Confirming registration for user: ${username}`
      );
      const response = await cognitoConfirmUserRegistration(
        username,
        confirmationCode
      );
      logger.info(`[UserService] User confirmed successfully: ${username}`);
      return response;
    } catch (error) {
      logger.error(`[UserService] Confirmation failed for user: ${username}`, {
        error,
      });
      throw new Error("User confirmation failed");
    }
  }

  async authenticate(username: string, password: string) {
    try {
      logger.info(
        `[UserService] Starting authentication for user: ${username}`
      );

      // Step 1: Authenticate with Cognito
      let token: string | undefined;
      try {
        token = await cognitoAuthenticate(username, password);
        if (!token) {
          logger.error(
            `[UserService] Cognito returned no token for user: ${username}`
          );
          throw new Error("Authentication token missing");
        }
        logger.info(
          `[UserService] Cognito authentication successful for user: ${username}`
        );
      } catch (authError) {
        logger.error(
          `[UserService] Cognito authentication failed for user: ${username}`,
          { error: authError }
        );
        throw new Error("Invalid username or password");
      }

      // Step 2: Retrieve user details (from cache or database)
      let user: User | null = null;

      try {
        // Attempt to retrieve the user from cache
        const cachedUser = await cache.get(`user:${username}`);
        if (cachedUser) {
          logger.info(`[UserService] User retrieved from cache: ${username}`);
          user = JSON.parse(cachedUser);
        } else {
          // Fetch user from the database if not cached
          logger.info(
            `[UserService] User not in cache. Fetching from database: ${username}`
          );
          user = await this.userRepository.findUserByUsername(username);
          if (user) {
            // Cache the user for future requests
            logger.info(`[UserService] Caching user: ${username}`);
            await cache.set(`user:${username}`, JSON.stringify(user), 3600);
          }
        }
      } catch (retrievalError) {
        logger.error(
          `[UserService] Error retrieving user details for username: ${username}`,
          { error: retrievalError }
        );
        throw new Error("Failed to retrieve user details");
      }

      // Step 3: Ensure user was found
      if (!user) {
        logger.warn(
          `[UserService] User not found in cache or database: ${username}`
        );
        throw new Error("User not found");
      }

      // Step 4: Return authentication result
      logger.info(`[UserService] User authenticated successfully: ${username}`);
      return { token, user };
    } catch (error) {
      // General error handling for authentication process
      logger.error(
        `[UserService] Authentication process failed for user: ${username}`,
        { error }
      );
      throw new Error("Authentication failed: Invalid username or password");
    }
  }

  async initiatePasswordReset(username: string) {
    try {
      logger.info(
        `[UserService] Initiating password reset for user: ${username}`
      );

      const response = await cognitoInitiatePasswordReset(username);

      logger.info(
        `[UserService] Password reset initiated successfully for user: ${username}`
      );
      return {
        message: "Password reset initiated. Check your email for the code.",
        response,
      };
    } catch (error) {
      logger.error(
        `[UserService] Failed to initiate password reset for user: ${username}`,
        { error }
      );
      throw new Error("Failed to initiate password reset");
    }
  }

  async completePasswordReset(
    username: string,
    newPassword: string,
    confirmationCode: string
  ) {
    try {
      logger.info(
        `[UserService] Starting password reset for user: ${username}`
      );

      // Validate inputs
      if (!username || !newPassword || !confirmationCode) {
        logger.warn(
          `[UserService] Missing required fields for password reset.`
        );
        throw new Error(
          "Missing required fields: username, newPassword, or confirmationCode"
        );
      }

      // Step 1: Complete password reset in Cognito
      let response: any;
      try {
        response = await cognitoCompletePasswordReset(
          username,
          newPassword,
          confirmationCode
        );
        logger.info(
          `[UserService] Cognito password reset completed for user: ${username}`
        );
      } catch (cognitoError) {
        logger.error(
          `[UserService] Failed to complete Cognito password reset for user: ${username}`,
          { error: cognitoError }
        );
        throw new Error("Failed to complete Cognito password reset");
      }

      // Step 2: Encrypt the new password using KMS
      let encryptedPassword: string;
      try {
        const kmsKeyId = await getCachedParameter("/myapp/kms-key-id");
        logger.info(
          `[UserService] Retrieved KMS Key ID for password encryption.`
        );
        encryptedPassword = await encryptPassword(newPassword, kmsKeyId);
        logger.info(
          `[UserService] Password encrypted successfully for user: ${username}`
        );
      } catch (encryptionError) {
        logger.error(
          `[UserService] Failed to encrypt new password for user: ${username}`,
          { error: encryptionError }
        );
        throw new Error("Failed to encrypt new password");
      }

      // Step 3: Update the user's password in the repository
      let user: User | null;
      try {
        user = await this.userRepository.findUserByUsername(username);
        if (!user) {
          logger.warn(
            `[UserService] User not found in repository: ${username}`
          );
          throw new Error("User not found in the repository");
        }

        await this.userRepository.updateUser(user.id, {
          password: encryptedPassword,
        });
        logger.info(
          `[UserService] Password updated in the database for user: ${username}`
        );
      } catch (dbError) {
        logger.error(
          `[UserService] Failed to update password in the repository for user: ${username}`,
          { error: dbError }
        );
        throw new Error("Failed to update password in the repository");
      }

      // Step 4: Clear any cached data for the user
      try {
        await cache.delete(`user:${username}`);
        await cache.delete(`user:id:${user?.id}`);
        logger.info(`[UserService] Cache cleared for user: ${username}`);
      } catch (cacheError) {
        logger.warn(
          `[UserService] Failed to clear cache for user: ${username}`,
          {
            error: cacheError,
          }
        );
      }

      // Return success response
      logger.info(
        `[UserService] Password reset successfully completed for user: ${username}`
      );
      return {
        message: "Password reset successfully completed.",
        response,
      };
    } catch (error) {
      logger.error(
        `[UserService] Failed to complete password reset for user: ${username}`,
        { error }
      );
      throw new Error("Failed to complete password reset");
    }
  }

  async getUserById(id: number, cacheTTL: number = 3600): Promise<User | null> {
    const cacheKey = `user:id:${id}`;
    logger.info(`[UserService] Fetching user by ID: ${id}`);

    try {
      // Attempt to fetch the user from the cache
      const cachedUser = await cache.get(cacheKey);
      if (cachedUser) {
        logger.info(`[UserService] User retrieved from cache by ID: ${id}`);
        return JSON.parse(cachedUser);
      }
    } catch (cacheError) {
      logger.warn(
        `[UserService] Failed to fetch user from cache by ID: ${id}`,
        {
          error: cacheError,
        }
      );
      // Allow the process to continue by querying the database
    }

    try {
      // Fetch the user from the database if not in the cache
      const user = await this.userRepository.findUserById(id);
      if (!user) {
        logger.warn(`[UserService] User not found in database by ID: ${id}`);
        return null; // Return null if the user is not found
      }

      logger.info(`[UserService] User retrieved from database by ID: ${id}`);

      // Attempt to update the cache
      try {
        await cache.set(cacheKey, JSON.stringify(user), cacheTTL);
        logger.info(`[UserService] User cached successfully by ID: ${id}`);
      } catch (cacheSetError) {
        logger.warn(`[UserService] Failed to cache user by ID: ${id}`, {
          error: cacheSetError,
        });
      }

      return user;
    } catch (dbError) {
      logger.error(
        `[UserService] Failed to fetch user from database by ID: ${id}`,
        {
          error: dbError,
        }
      );
      throw new Error("Failed to fetch user by ID");
    }
  }

  async updateUser(
    id: number,
    updatedData: Partial<User>,
    cacheTTL: number = 3600
  ): Promise<User | null> {
    try {
      // Validate input
      if (!updatedData || Object.keys(updatedData).length === 0) {
        logger.warn(
          `[UserService] No data provided for user update. ID: ${id}`
        );
        throw new Error("No data provided for update");
      }

      logger.info(`[UserService] Updating user with ID: ${id}`);

      // Step 1: Update user in the repository
      const updatedUser = await this.userRepository.updateUser(id, updatedData);

      if (!updatedUser) {
        logger.warn(`[UserService] User not found or update failed. ID: ${id}`);
        return null;
      }

      logger.info(
        `[UserService] User updated successfully in repository. ID: ${id}`
      );

      // Step 2: Update the cache
      try {
        await cache.set(
          `user:${updatedUser.username}`,
          JSON.stringify(updatedUser),
          cacheTTL
        );
        await cache.set(`user:id:${id}`, JSON.stringify(updatedUser), cacheTTL);
        logger.info(
          `[UserService] Cache updated successfully for user ID: ${id}`
        );
      } catch (cacheError) {
        logger.warn(`[UserService] Failed to update cache for user ID: ${id}`, {
          error: cacheError,
        });
        // Optionally: Invalidate cache keys if updating them fails
        await cache.delete(`user:${updatedUser.username}`);
        await cache.delete(`user:id:${id}`);
      }

      return updatedUser;
    } catch (error) {
      logger.error(`[UserService] Failed to update user with ID: ${id}`, {
        error,
      });
      throw new Error("Failed to update user");
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      logger.info(
        `[UserService] Starting deletion process for user with ID: ${id}`
      );

      // Validate input
      if (!id || typeof id !== "number") {
        logger.warn(
          `[UserService] Invalid user ID provided for deletion: ${id}`
        );
        throw new Error("Invalid user ID");
      }

      // Step 1: Retrieve user details
      const user = await this.userRepository.findUserById(id);
      if (!user) {
        logger.warn(`[UserService] User not found with ID: ${id}`);
        throw new Error(`User with ID ${id} not found`);
      }
      logger.info(
        `[UserService] User found for deletion: ${user.username} (ID: ${id})`
      );

      // Step 2: Delete user from repository
      try {
        await this.userRepository.deleteUser(id);
        logger.info(
          `[UserService] User deleted from repository successfully. ID: ${id}`
        );
      } catch (dbError) {
        logger.error(
          `[UserService] Failed to delete user from repository. ID: ${id}`,
          { error: dbError }
        );
        throw new Error("Failed to delete user from repository");
      }

      // Step 3: Remove user from cache
      try {
        await cache.delete(`user:${user.username}`);
        await cache.delete(`user:id:${id}`);
        logger.info(
          `[UserService] Cache cleared successfully for user ID: ${id}`
        );
      } catch (cacheError) {
        logger.warn(`[UserService] Failed to clear cache for user ID: ${id}`, {
          error: cacheError,
        });
      }
    } catch (error) {
      logger.error(`[UserService] Deletion process failed for user ID: ${id}`, {
        error,
      });
      throw new Error("Failed to delete user");
    }
  }

  async getAllUsers(cacheTTL: number = 3600): Promise<User[]> {
    const cacheKey = `users:all`;
    logger.info(`[UserService] Fetching all users`);

    try {
      // Attempt to retrieve users from cache
      const cachedUsers = await cache.get(cacheKey);
      if (cachedUsers) {
        logger.info(`[UserService] Users retrieved from cache`);
        return JSON.parse(cachedUsers);
      }
    } catch (cacheError) {
      logger.warn(`[UserService] Failed to retrieve users from cache`, {
        error: cacheError,
      });
      // Continue to fetch from the database
    }

    try {
      // Fetch users from the database
      const users = await this.userRepository.getAllUsers();
      logger.info(`[UserService] Users retrieved from database`);

      // Attempt to cache the retrieved users
      try {
        await cache.set(cacheKey, JSON.stringify(users), cacheTTL);
        logger.info(`[UserService] Users cached successfully`);
      } catch (cacheSetError) {
        logger.warn(`[UserService] Failed to cache users`, {
          error: cacheSetError,
        });
      }

      return users;
    } catch (dbError) {
      logger.error(`[UserService] Failed to retrieve users from database`, {
        error: dbError,
      });
      throw new Error("Failed to fetch users from database");
    }
  }

  async getUsersWithPagination(
    page: number,
    pageSize: number,
    cacheTTL: number = 3600
  ): Promise<{ data: User[]; count: number }> {
    // Validate input
    if (page <= 0 || pageSize <= 0) {
      logger.warn(
        `[UserService] Invalid pagination parameters: page=${page}, size=${pageSize}`
      );
      throw new Error(
        "Invalid pagination parameters: page and pageSize must be greater than 0"
      );
    }

    const skip = (page - 1) * pageSize;
    const cacheKey = `users:page:${page}:size:${pageSize}`;
    logger.info(
      `[UserService] Fetching users with pagination: page=${page}, size=${pageSize}`
    );

    // Step 1: Attempt to retrieve data from cache
    try {
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult) {
        logger.info(
          `[UserService] Users retrieved from cache: page=${page}, size=${pageSize}`
        );
        return JSON.parse(cachedResult);
      }
    } catch (cacheError) {
      logger.warn(
        `[UserService] Failed to retrieve users from cache: page=${page}, size=${pageSize}`,
        { error: cacheError }
      );
      // Continue to query the database
    }

    // Step 2: Fetch data from the database
    try {
      const result = await this.userRepository.getUsersWithPagination(
        skip,
        pageSize
      );
      logger.info(
        `[UserService] Users retrieved from database: page=${page}, size=${pageSize}`
      );

      // Step 3: Update cache with retrieved data
      try {
        await cache.set(cacheKey, JSON.stringify(result), cacheTTL);
        logger.info(
          `[UserService] Cached users with pagination: page=${page}, size=${pageSize}`
        );
      } catch (cacheSetError) {
        logger.warn(
          `[UserService] Failed to cache users: page=${page}, size=${pageSize}`,
          { error: cacheSetError }
        );
      }

      return result;
    } catch (dbError) {
      logger.error(
        `[UserService] Failed to retrieve users from database: page=${page}, size=${pageSize}`,
        { error: dbError }
      );
      throw new Error("Failed to fetch users from database");
    }
  }
}
