import {
  authenticate as cognitoAuthenticate,
  registerUser as cognitoRegisterUser,
  confirmUserRegistration as cognitoConfirmUserRegistration,
  initiatePasswordReset as cognitoInitiatePasswordReset,
  completePasswordReset as cognitoCompletePasswordReset,
} from "../utils/cognito";
import logger from "../utils/logger";

export class AuthenticationService {
  async registerUser(
    username: string,
    password: string,
    email: string
  ): Promise<void> {
    await cognitoRegisterUser(username, password, email);
    logger.info(
      `[AuthenticationService] User registered in Cognito: ${username}`
    );
    logger.info(
      `[AuthenticationService] User registered in Cognito: ${username}`
    );
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
