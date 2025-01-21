import {
  authenticate as cognitoAuthenticate,
  registerUser as cognitoRegisterUser,
  confirmUserRegistration as cognitoConfirmUserRegistration,
} from "../utils/cognitoConfig";
import { cache } from "../utils/cacheConfig";
import logger from "../utils/logger";

export class AuthenticationService {
  async registerUser(
    username: string,
    password: string,
    email: string
  ): Promise<void> {
    let cognitoUserCreated: boolean = false;

    try {
      logger.info(
        `[AuthenticationService] Registering user in Cognito: ${username}`
      );
      await cognitoRegisterUser(username, password, email);
      cognitoUserCreated = true;
      logger.info(
        `[AuthenticationService] User registered in Cognito: ${username}`
      );
    } catch (error) {
      if (cognitoUserCreated) {
        logger.info(`[UserService] Rolling back Cognito user: ${username}`);
        await cache.delete(username);
        logger.info(`[UserService] Cognito user rolled back: ${username}`);
      }
      logger.info(`[UserService] Removing cache for user: ${username}`);
      await cache.delete(`user:${username}`);
      logger.info(`[UserService] Cache removed for user: ${username}`);
    }
  }

  async authenticateUser(username: string, password: string): Promise<string> {
    logger.info(`[AuthenticationService] Authenticating user: ${username}`);
    const token = await cognitoAuthenticate(username, password);
    if (!token) {
      logger.error(
        `[AuthenticationService] Failed to retrieve token for user: ${username}`
      );
      throw new Error("Authentication failed");
    }
    return token;
  }

  async confirmUserRegistration(
    username: string,
    confirmationCode: string
  ): Promise<void> {
    logger.info(
      `[AuthenticationService] Confirming registration for user: ${username}`
    );
    await cognitoConfirmUserRegistration(username, confirmationCode);
    logger.info(
      `[AuthenticationService] User registration confirmed: ${username}`
    );
  }
}
