import {
  initiatePasswordReset,
  completePasswordReset,
} from "../utils/cognitoConfig";
import { encryptPassword } from "../utils/kmsConfig";
import logger from "../utils/logger";
import { getCachedParameter } from "../utils/ssmConfig";

export class PasswordService {
  async getPasswordEncrypted(newPassword: string): Promise<string> {
    const kmsKeyId = await getCachedParameter("/myapp/kms-key-id");
    return encryptPassword(newPassword, kmsKeyId);
  }

  async initiateUserPasswordReset(username: string): Promise<void> {
    try {
      logger.info(
        `[PasswordService] Initiate user password reset in Cognito: ${username}`
      );
      await initiatePasswordReset(username);

      logger.info(
        `[PasswordService] Password reset initiated for user: ${username}`
      );
    } catch (error) {
      logger.error(
        `[PasswordService] Failed to initiate password reset for user: ${username}`,
        { error }
      );
      throw new Error("Failed to initiate password reset");
    }
  }

  async completeUserPasswordReset(
    username: string,
    confirmationCode: string,
    newPassword: string
  ): Promise<void> {
    logger.info(
      `[AuthenticationService] Completing password reset for user: ${username}`
    );
    await completePasswordReset(username, confirmationCode, newPassword);
    logger.info(
      `[AuthenticationService] Password reset completed for user: ${username}`
    );
  }
}
