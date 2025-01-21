import logger from "./logger";

export const resetPasswordInputValidator = (
  username: string,
  password: string,
  confirmationCode: string
) => {
  if (!username || !password || !confirmationCode) {
    logger.warn(`[UserService] Missing required fields for password reset.`);
    throw new Error(
      "Missing required fields: username, newPassword, or confirmationCode"
    );
  }
};
