import { UserService } from "../../services/UserService";
import { UserRepository } from "../../repositories/UserRepository";
import { AuthenticationService } from "../../services/AuthenticationService";
import { PasswordService } from "../../services/PasswordService";
import { cache } from "../../utils/cacheConfig";
import logger from "../../utils/logger";
import { User } from "../../entities/User";
import { resetPasswordInputValidator } from "../../utils/validateResetPasswordInput";

// Mocks
jest.mock("../../repositories/UserRepository");
jest.mock("../../services/AuthenticationService");
jest.mock("../../services/PasswordService");
jest.mock("../../utils/cacheConfig", () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock("../../utils/validateResetPasswordInput", () => ({
  resetPasswordInputValidator: jest.fn(),
}));

describe("UserService", () => {
  let userService: UserService;

  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockAuthService: jest.Mocked<AuthenticationService>;
  let mockPasswordService: jest.Mocked<PasswordService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked instances
    mockUserRepository = new UserRepository(
      {} as any
    ) as jest.Mocked<UserRepository>;
    mockAuthService =
      new AuthenticationService() as jest.Mocked<AuthenticationService>;
    mockPasswordService = new PasswordService() as jest.Mocked<PasswordService>;

    // 1) Create actual service (runs constructor with real new AuthenticationService)
    userService = new UserService();

    // 2) Overwrite instance properties with our mocks
    (userService as any).authService = mockAuthService;
    (userService as any).passwordService = mockPasswordService;
    (UserService as any).userRepository = mockUserRepository;
  });

  // ------------------------------------------------------------------------------
  // save
  // ------------------------------------------------------------------------------
  describe("save", () => {
    it("should register user via authService, encrypt password, then create user in DB", async () => {
      const testUser: User = {
        username: "john",
        password: "pwd123",
        email: "john@example.com",
      } as User;

      // Return void from these calls, matching real method signatures
      mockAuthService.registerUser.mockResolvedValueOnce(undefined);
      mockPasswordService.getPasswordEncrypted.mockResolvedValueOnce(
        "encrypted-pwd"
      );
      mockUserRepository.createEntity.mockResolvedValue({
        ...testUser,
        id: 1,
        password: "encrypted-pwd",
      });

      const result = await userService.save(testUser);

      expect(logger.info).toHaveBeenCalledWith(
        `[UserService] Registering user: john`
      );
      expect(mockAuthService.registerUser).toHaveBeenCalledWith(
        "john",
        "pwd123",
        "john@example.com"
      );
      expect(mockPasswordService.getPasswordEncrypted).toHaveBeenCalledWith(
        "pwd123"
      );
      expect(mockUserRepository.createEntity).toHaveBeenCalledWith(
        {
          username: "john",
          password: "encrypted-pwd",
          email: "john@example.com",
        },
        undefined
      );
      expect(logger.info).toHaveBeenCalledWith(
        `[UserService] User created in database: john`
      );
      expect(result).toEqual({
        username: "john",
        password: "encrypted-pwd",
        email: "john@example.com",
        id: 1,
      });
    });

    it("should log and throw 'Registration failed' if any error occurs", async () => {
      const testUser: User = {
        username: "jane",
        password: "pwd123",
        email: "jane@example.com",
      } as User;

      mockAuthService.registerUser.mockRejectedValueOnce(
        new Error("Cognito error")
      );

      await expect(userService.save(testUser)).rejects.toThrow(
        "Registration failed"
      );

      expect(logger.error).toHaveBeenCalledWith(
        `[UserService] Registration failed for user: jane`,
        { error: expect.any(Error) }
      );
    });
  });

  // ------------------------------------------------------------------------------
  // confirmRegistration
  // ------------------------------------------------------------------------------
  describe("confirmRegistration", () => {
    it("should confirm user registration via authService", async () => {
      // The real confirmUserRegistration might return void; we'll mock some response here:
      mockAuthService.confirmUserRegistration.mockResolvedValueOnce(
        "some-response" as any
      );

      const result = await userService.confirmRegistration("john", "123456");

      expect(logger.info).toHaveBeenCalledWith(
        `[UserService] Confirming registration for user: john`
      );
      expect(mockAuthService.confirmUserRegistration).toHaveBeenCalledWith(
        "john",
        "123456"
      );
      expect(logger.info).toHaveBeenCalledWith(
        `[UserService] User confirmed successfully: john`
      );
      expect(result).toBe("some-response");
    });

    it("should log and throw 'User confirmation failed' if an error occurs", async () => {
      mockAuthService.confirmUserRegistration.mockRejectedValueOnce(
        new Error("Cognito error")
      );

      await expect(
        userService.confirmRegistration("jane", "123456")
      ).rejects.toThrow("User confirmation failed");

      expect(logger.error).toHaveBeenCalledWith(
        `[UserService] Confirmation failed for user: jane`,
        { error: expect.any(Error) }
      );
    });
  });

  // ------------------------------------------------------------------------------
  // authenticate
  // ------------------------------------------------------------------------------
  describe("authenticate", () => {
    it("should authenticate user, fetch user from cache or DB, and return token", async () => {
      mockAuthService.authenticateUser.mockResolvedValueOnce("jwt-token");
      (cache.get as jest.Mock).mockResolvedValueOnce(null); // not in cache
      mockUserRepository.findUserByUsername.mockResolvedValueOnce({
        id: 1,
        username: "john",
        password: "pwd123",
        email: "john@example.com",
      } as User);

      const result = await userService.authenticate("john", "pwd123");

      expect(logger.info).toHaveBeenCalledWith(
        `[UserService] Starting authentication for user: john`
      );
      expect(mockAuthService.authenticateUser).toHaveBeenCalledWith(
        "john",
        "pwd123"
      );
      expect(mockUserRepository.findUserByUsername).toHaveBeenCalledWith(
        "john"
      );
      expect(cache.set).toHaveBeenCalledWith(
        "user:john",
        JSON.stringify({
          id: 1,
          username: "john",
          password: "pwd123",
          email: "john@example.com",
        }),
        3600
      );
      expect(result).toEqual({ token: "jwt-token" });
    });

    it("should use cached user if found", async () => {
      mockAuthService.authenticateUser.mockResolvedValueOnce("cached-jwt");
      (cache.get as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ id: 10, username: "john" })
      );

      const result = await userService.authenticate("john", "pwd123");

      expect(mockAuthService.authenticateUser).toHaveBeenCalled();
      expect(mockUserRepository.findUserByUsername).not.toHaveBeenCalled();
      expect(result).toEqual({ token: "cached-jwt" });
    });

    it("should throw error if user not found in cache or DB", async () => {
      mockAuthService.authenticateUser.mockResolvedValueOnce("some-token");
      (cache.get as jest.Mock).mockResolvedValueOnce(null);
      mockUserRepository.findUserByUsername.mockResolvedValueOnce(null);

      await expect(userService.authenticate("unknown", "pwd")).rejects.toThrow(
        "Authentication failed: Invalid username or password"
      );

      expect(logger.warn).toHaveBeenCalledWith(
        `[UserService] User not found in cache or database: unknown`
      );
    });

    it("should log an error and throw if auth fails", async () => {
      mockAuthService.authenticateUser.mockRejectedValueOnce(
        new Error("Auth error")
      );

      await expect(userService.authenticate("john", "pwd")).rejects.toThrow(
        "Authentication failed: Invalid username or password"
      );

      expect(logger.error).toHaveBeenCalledWith(
        `[UserService] Authentication process failed for user: john`,
        { error: expect.any(Error) }
      );
    });
  });

  // ------------------------------------------------------------------------------
  // initiatePasswordReset
  // ------------------------------------------------------------------------------
  describe("initiatePasswordReset", () => {
    it("should call passwordService.initiateUserPasswordReset and return success object", async () => {
      // If real code returns Promise<void>, let's just mock undefined or a minimal response:
      mockPasswordService.initiateUserPasswordReset.mockResolvedValueOnce(
        undefined
      );

      const result = await userService.initiatePasswordReset("john");

      expect(logger.info).toHaveBeenCalledWith(
        `[UserService] Initiating password reset for user: john`
      );
      expect(
        mockPasswordService.initiateUserPasswordReset
      ).toHaveBeenCalledWith("john");
      expect(logger.info).toHaveBeenCalledWith(
        `[UserService] Password reset initiated successfully for user: john`
      );
      // The service method returns an object with message + response (here, `response`=undefined).
      expect(result).toEqual({
        message: "Password reset initiated. Check your email for the code.",
        response: undefined,
      });
    });

    it("should log error and throw on failure", async () => {
      mockPasswordService.initiateUserPasswordReset.mockRejectedValueOnce(
        new Error("Cognito error")
      );

      await expect(userService.initiatePasswordReset("john")).rejects.toThrow(
        "Failed to initiate password reset"
      );

      expect(logger.error).toHaveBeenCalledWith(
        `[UserService] Failed to initiate password reset for user: john`,
        { error: expect.any(Error) }
      );
    });
  });

  // ------------------------------------------------------------------------------
  // completePasswordReset
  // ------------------------------------------------------------------------------
  describe("completePasswordReset", () => {
    it("should validate input, call passwordService, update user password in DB", async () => {
      // If real code returns Promise<void>, let's just mock undefined:
      (resetPasswordInputValidator as jest.Mock).mockImplementation(() => {});
      mockPasswordService.completeUserPasswordReset.mockResolvedValueOnce(
        undefined
      );
      mockPasswordService.getPasswordEncrypted.mockResolvedValueOnce(
        "new-encrypted-pwd"
      );
      mockUserRepository.findUserByUsername.mockResolvedValueOnce({
        id: 1,
        username: "john",
        password: "old-encrypted",
      } as User);

      const result = await userService.completePasswordReset(
        "john",
        "NewPass123",
        "654321"
      );

      expect(logger.info).toHaveBeenCalledWith(
        `[UserService] Starting password reset for user: john`
      );
      expect(resetPasswordInputValidator).toHaveBeenCalledWith(
        "john",
        "NewPass123",
        "654321"
      );
      expect(
        mockPasswordService.completeUserPasswordReset
      ).toHaveBeenCalledWith("john", "NewPass123", "654321");
      expect(mockPasswordService.getPasswordEncrypted).toHaveBeenCalledWith(
        "NewPass123"
      );
      expect(mockUserRepository.findUserByUsername).toHaveBeenCalledWith(
        "john"
      );
      expect(mockUserRepository.updateEntity).toHaveBeenCalledWith(1, {
        password: "new-encrypted-pwd",
      });

      // The service returns an object:
      expect(result).toEqual({
        message: "Password reset successfully completed.",
        response: undefined,
      });
      expect(logger.info).toHaveBeenCalledWith(
        `[UserService] Password reset successfully completed for user: john`
      );
    });

    it("should throw if user not found in repo", async () => {
      (resetPasswordInputValidator as jest.Mock).mockImplementation(() => {});
      mockPasswordService.completeUserPasswordReset.mockResolvedValueOnce(
        undefined
      );
      mockPasswordService.getPasswordEncrypted.mockResolvedValueOnce(
        "new-encrypted-pwd"
      );
      mockUserRepository.findUserByUsername.mockResolvedValueOnce(null);

      await expect(
        userService.completePasswordReset("unknown", "Pass123", "654321")
      ).rejects.toThrow("Failed to complete password reset");

      expect(logger.warn).toHaveBeenCalledWith(
        `[UserService] User not found in repository: unknown`
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it("should log error and throw on general failure", async () => {
      mockPasswordService.completeUserPasswordReset.mockRejectedValueOnce(
        new Error("Cognito error")
      );

      await expect(
        userService.completePasswordReset("john", "NewPass", "000000")
      ).rejects.toThrow("Failed to complete password reset");

      expect(logger.error).toHaveBeenCalledWith(
        `[UserService] Failed to complete password reset for user: john`,
        { error: expect.any(Error) }
      );
    });
  });
});
