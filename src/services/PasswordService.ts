import { encryptPassword } from "../utils/kmsConfig";
import { getCachedParameter } from "../utils/ssmConfig";
import logger from "../utils/logger";

export class PasswordService {
  async resetPassword(username: string, newPassword: string): Promise<string> {
    const kmsKeyId = await getCachedParameter("/myapp/kms-key-id");
    logger.info(`[PasswordService] Encrypting password for user: ${username}`);
    return encryptPassword(newPassword, kmsKeyId);
  }
}
