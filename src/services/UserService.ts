import { UserRepository } from "../repositories/UserRepository";
import { AuthenticationService } from "./AuthenticationService";
import { PasswordService } from "./PasswordService";
import { cache } from "../utils/cacheConfig";
import { User } from "../entities/User";
import logger from "../utils/logger";
import { GenericService } from "./GenericService";
import { AppDataSource } from "../config/database";
import { resetPasswordInputValidator } from "../utils/validateResetPasswordInput";
import { cacheModel } from "../utils/cacheModel";

export class UserService extends GenericService<User> {
  private authService: AuthenticationService;
  private passwordService: PasswordService;
  private static userRepository = new UserRepository(AppDataSource);

  constructor() {
    super(UserService.userRepository);
    this.authService = new AuthenticationService();
    this.passwordService = new PasswordService();
  }

  async save(entity: User, cacheModel?: cacheModel): Promise<User | null> {
    try {
      logger.info(`[UserService] Registering user: ${entity.username}`);
      await this.authService.registerUser(
        entity.username,
        entity.password,
        entity.email
      );

      const encryptedPassword = await this.passwordService.getPasswordEncrypted(
        entity.password
      );
      logger.info(`[UserService] Password encrypted.`);

      const user = await UserService.userRepository.createEntity(
        {
          username: entity.username,
          password: encryptedPassword,
          email: entity.email,
        } as User,
        cacheModel
      );

      logger.info(`[UserService] User created in database: ${entity.username}`);

      return user;
    } catch (error) {
      logger.error(
        `[UserService] Registration failed for user: ${entity.username}`,
        { error }
      );
      throw new Error("Registration failed");
    }
  }

  async confirmRegistration(username: string, confirmationCode: string) {
    try {
      logger.info(
        `[UserService] Confirming registration for user: ${username}`
      );
      const response = await this.authService.confirmUserRegistration(
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

  async authenticate(
    username: string,
    password: string
  ): Promise<{ token: string }> {
    try {
      logger.info(
        `[UserService] Starting authentication for user: ${username}`
      );

      const token: string | undefined = await this.authService.authenticateUser(
        username,
        password
      );

      const cachedUser = await cache.get(`user:${username}`);
      let user: User | null = cachedUser
        ? JSON.parse(cachedUser)
        : await UserService.userRepository.findUserByUsername(username);

      if (!user) {
        logger.warn(
          `[UserService] User not found in cache or database: ${username}`
        );
        throw new Error("User not found");
      }

      if (!cachedUser) {
        await cache.set(`user:${username}`, JSON.stringify(user), 3600);
      }

      logger.info(`[UserService] User authenticated successfully: ${username}`);
      return { token };
    } catch (error) {
      logger.error(
        `[UserService] Authentication process failed for user: ${username}`,
        { error }
      );
      throw new Error("Authentication failed: Invalid username or password");
    }
  }

  async initiatePasswordReset(
    username: string
  ): Promise<{ message: string; response: any }> {
    try {
      logger.info(
        `[UserService] Initiating password reset for user: ${username}`
      );

      const response = await this.passwordService.initiateUserPasswordReset(
        username
      );

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

      resetPasswordInputValidator(username, newPassword, confirmationCode);

      const response: any =
        await this.passwordService.completeUserPasswordReset(
          username,
          newPassword,
          confirmationCode
        );

      logger.info(
        `[UserService] Cognito password reset completed for user: ${username}`
      );

      const encryptedPassword: string =
        await this.passwordService.getPasswordEncrypted(newPassword);
      logger.info(
        `[UserService] Password encrypted successfully for user: ${username}`
      );

      const user: User | null =
        await UserService.userRepository.findUserByUsername(username);

      if (!user) {
        logger.warn(`[UserService] User not found in repository: ${username}`);
        throw new Error("User not found in the repository");
      }
      await UserService.userRepository.updateEntity(user?.id, {
        password: encryptedPassword,
      });

      logger.info(
        `[UserService] Password updated in the database for user: ${username}`
      );

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
}
