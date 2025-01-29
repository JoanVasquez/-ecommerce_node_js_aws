import { PasswordService } from "../../services/PasswordService";

// Mocks for external functions used by PasswordService
import { getCachedParameter } from "../../utils/ssmConfig";
import { encryptPassword } from "../../utils/kmsConfig";
import {
  initiatePasswordReset,
  completePasswordReset,
} from "../../utils/cognitoConfig";

// Mock for logger
import logger from "../../utils/logger";

/**
 * Replace the real implementations with Jest mocks.
 */
jest.mock("../../utils/ssmConfig", () => ({
  getCachedParameter: jest.fn(),
}));

jest.mock("../../utils/kmsConfig", () => ({
  encryptPassword: jest.fn(),
}));

jest.mock("../../utils/cognitoConfig", () => ({
  initiatePasswordReset: jest.fn(),
  completePasswordReset: jest.fn(),
}));

jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("PasswordService", () => {
  let passwordService: PasswordService;

  beforeEach(() => {
    jest.clearAllMocks();
    passwordService = new PasswordService();
  });

  // ------------------------------------------------------------------------
  // getPasswordEncrypted
  // ------------------------------------------------------------------------
  describe("getPasswordEncrypted", () => {
    it("should fetch kmsKeyId and encrypt the password successfully", async () => {
      (getCachedParameter as jest.Mock).mockResolvedValueOnce(
        "mock-kms-key-id"
      );
      (encryptPassword as jest.Mock).mockResolvedValueOnce("encrypted-string");

      const encrypted = await passwordService.getPasswordEncrypted(
        "MyNewPassword"
      );

      expect(getCachedParameter).toHaveBeenCalledWith("/myapp/kms-key-id");
      expect(encryptPassword).toHaveBeenCalledWith(
        "MyNewPassword",
        "mock-kms-key-id"
      );
      expect(encrypted).toBe("encrypted-string");
    });

    it("should bubble up error if getCachedParameter fails", async () => {
      (getCachedParameter as jest.Mock).mockRejectedValueOnce(
        new Error("SSM error")
      );

      await expect(
        passwordService.getPasswordEncrypted("MyNewPassword")
      ).rejects.toThrow("SSM error");
    });

    it("should bubble up error if encryptPassword fails", async () => {
      (getCachedParameter as jest.Mock).mockResolvedValueOnce(
        "mock-kms-key-id"
      );
      (encryptPassword as jest.Mock).mockRejectedValueOnce(
        new Error("KMS encryption error")
      );

      await expect(
        passwordService.getPasswordEncrypted("MyNewPassword")
      ).rejects.toThrow("KMS encryption error");
    });
  });

  // ------------------------------------------------------------------------
  // initiateUserPasswordReset
  // ------------------------------------------------------------------------
  describe("initiateUserPasswordReset", () => {
    it("should initiate password reset successfully", async () => {
      (initiatePasswordReset as jest.Mock).mockResolvedValueOnce({
        message: "Password reset initiated. Check your email for the code.",
      });

      await expect(
        passwordService.initiateUserPasswordReset("testuser")
      ).resolves.not.toThrow();

      // Logs
      expect(logger.info).toHaveBeenCalledWith(
        "[PasswordService] Initiate user password reset in Cognito: testuser"
      );
      expect(initiatePasswordReset).toHaveBeenCalledWith("testuser");
      expect(logger.info).toHaveBeenCalledWith(
        "[PasswordService] Password reset initiated for user: testuser"
      );
    });

    it("should log an error and throw if initiatePasswordReset fails", async () => {
      (initiatePasswordReset as jest.Mock).mockRejectedValueOnce(
        new Error("Cognito error")
      );

      await expect(
        passwordService.initiateUserPasswordReset("testuser")
      ).rejects.toThrow("Failed to initiate password reset");

      // Logging
      expect(logger.error).toHaveBeenCalledWith(
        "[PasswordService] Failed to initiate password reset for user: testuser",
        { error: expect.any(Error) }
      );
    });
  });

  // ------------------------------------------------------------------------
  // completeUserPasswordReset
  // ------------------------------------------------------------------------
  describe("completeUserPasswordReset", () => {
    it("should complete password reset successfully", async () => {
      (completePasswordReset as jest.Mock).mockResolvedValueOnce({
        message: "Password reset successfully",
      });

      await expect(
        passwordService.completeUserPasswordReset(
          "testuser",
          "123456",
          "NewPass123"
        )
      ).resolves.not.toThrow();

      expect(logger.info).toHaveBeenCalledWith(
        "[AuthenticationService] Completing password reset for user: testuser"
      );
      expect(completePasswordReset).toHaveBeenCalledWith(
        "testuser",
        "123456",
        "NewPass123"
      );
      expect(logger.info).toHaveBeenCalledWith(
        "[AuthenticationService] Password reset completed for user: testuser"
      );
    });

    it("should bubble up error if completePasswordReset fails", async () => {
      (completePasswordReset as jest.Mock).mockRejectedValueOnce(
        new Error("Cognito complete error")
      );

      await expect(
        passwordService.completeUserPasswordReset(
          "testuser",
          "000000",
          "NewPass123"
        )
      ).rejects.toThrow("Cognito complete error");

      // The service does not have its own catch, so it doesn't log an error.
      // It only logs the start info, then the error is thrown from cognitoConfig.
      expect(logger.info).toHaveBeenCalledWith(
        "[AuthenticationService] Completing password reset for user: testuser"
      );
      expect(logger.info).not.toHaveBeenCalledWith(
        "[AuthenticationService] Password reset completed for user: testuser"
      );
    });
  });
});
