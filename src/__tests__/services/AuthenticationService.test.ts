import { AuthenticationService } from "../../services/AuthenticationService";

// Mocks for the Cognito functions
import {
  authenticate as mockCognitoAuthenticate,
  registerUser as mockCognitoRegisterUser,
  confirmUserRegistration as mockCognitoConfirmUserRegistration,
} from "../../utils/cognitoConfig";

// Mocks for cache and logger
import { cache } from "../../utils/cacheConfig";
import logger from "../../utils/logger";

jest.mock("../../utils/cognitoConfig", () => ({
  authenticate: jest.fn(),
  registerUser: jest.fn(),
  confirmUserRegistration: jest.fn(),
}));

jest.mock("../../utils/cacheConfig", () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("AuthenticationService", () => {
  let authService: AuthenticationService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthenticationService();
  });

  // ------------------------------------------------------------------------------
  // registerUser
  // ------------------------------------------------------------------------------
  describe("registerUser", () => {
    it("should register user successfully (no rollback triggered)", async () => {
      (mockCognitoRegisterUser as jest.Mock).mockResolvedValueOnce({
        message: "User registered successfully",
      });

      await authService.registerUser(
        "testuser",
        "password123",
        "test@example.com"
      );

      expect(logger.info).toHaveBeenCalledWith(
        "[AuthenticationService] Registering user in Cognito: testuser"
      );
      expect(mockCognitoRegisterUser).toHaveBeenCalledWith(
        "testuser",
        "password123",
        "test@example.com"
      );
      expect(logger.info).toHaveBeenCalledWith(
        "[AuthenticationService] User registered in Cognito: testuser"
      );
      // No rollback calls, no cache deletions
      expect(cache.delete).not.toHaveBeenCalledWith("testuser");
      expect(cache.delete).not.toHaveBeenCalledWith("user:testuser");
    });

    it("should handle error and remove user from cache if registration fails before creation", async () => {
      (mockCognitoRegisterUser as jest.Mock).mockRejectedValueOnce(
        new Error("Cognito register error")
      );

      await authService.registerUser(
        "testuser",
        "password123",
        "test@example.com"
      );

      // Because Cognito call failed right away, cognitoUserCreated = false
      // => only "user:testuser" is removed in the catch block
      expect(logger.info).toHaveBeenCalledWith(
        "[UserService] Removing cache for user: testuser"
      );
      expect(cache.delete).toHaveBeenCalledWith("user:testuser");
      expect(logger.info).toHaveBeenCalledWith(
        "[UserService] Cache removed for user: testuser"
      );
    });

    /**
     * NEW TEST: Forcing an error AFTER the user was created in Cognito,
     * so "cognitoUserCreated" is true. We do this by mocking the logger
     * call that logs "User registered in Cognito" to throw an error.
     * This triggers the catch block *with* cognitoUserCreated = true.
     */
    it("should roll back Cognito user if an error occurs after user creation", async () => {
      // 1) Simulate Cognito user creation success
      (mockCognitoRegisterUser as jest.Mock).mockResolvedValueOnce({
        message: "User registered successfully",
      });

      // 2) Mock the logger calls:
      //    - The *first* logger.info call is "Registering user in Cognito"
      //    - The *second* logger.info call is "User registered in Cognito"
      //
      // We'll let the first call succeed, then throw an error on the second call.
      (logger.info as jest.Mock)
        .mockImplementationOnce(() => {
          // Do nothing on the first call
        })
        .mockImplementationOnce(() => {
          // Second call throws => simulating an error
          throw new Error("Some error after user creation");
        });

      await authService.registerUser(
        "testuser",
        "password123",
        "test@example.com"
      );

      // Now, because the error happened AFTER cognitoUserCreated was set to true,
      // the catch block will do the rollback lines:
      expect(logger.info).toHaveBeenCalledWith(
        "[UserService] Rolling back Cognito user: testuser"
      );
      expect(cache.delete).toHaveBeenCalledWith("testuser");
      expect(logger.info).toHaveBeenCalledWith(
        "[UserService] Cognito user rolled back: testuser"
      );

      // The catch block always removes the user from cache:
      expect(logger.info).toHaveBeenCalledWith(
        "[UserService] Removing cache for user: testuser"
      );
      expect(cache.delete).toHaveBeenCalledWith("user:testuser");
      expect(logger.info).toHaveBeenCalledWith(
        "[UserService] Cache removed for user: testuser"
      );
    });
  });

  // ------------------------------------------------------------------------------
  // authenticateUser
  // ------------------------------------------------------------------------------
  describe("authenticateUser", () => {
    it("should return token when authentication succeeds", async () => {
      (mockCognitoAuthenticate as jest.Mock).mockResolvedValueOnce(
        "fake-jwt-token"
      );

      const token = await authService.authenticateUser(
        "testuser",
        "password123"
      );

      expect(logger.info).toHaveBeenCalledWith(
        "[AuthenticationService] Authenticating user: testuser"
      );
      expect(mockCognitoAuthenticate).toHaveBeenCalledWith(
        "testuser",
        "password123"
      );
      expect(token).toBe("fake-jwt-token");
    });

    it("should throw error if token is not returned", async () => {
      (mockCognitoAuthenticate as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        authService.authenticateUser("testuser", "wrongpass")
      ).rejects.toThrow("Authentication failed");

      // The service logs an error if no token is returned
      expect(logger.error).toHaveBeenCalledWith(
        "[AuthenticationService] Failed to retrieve token for user: testuser"
      );
    });

    it("should bubble up error if cognito throws", async () => {
      (mockCognitoAuthenticate as jest.Mock).mockRejectedValueOnce(
        new Error("Authentication failed")
      );

      await expect(
        authService.authenticateUser("testuser", "somepass")
      ).rejects.toThrow("Authentication failed");
    });
  });

  // ------------------------------------------------------------------------------
  // confirmUserRegistration
  // ------------------------------------------------------------------------------
  describe("confirmUserRegistration", () => {
    it("should confirm user registration successfully", async () => {
      (mockCognitoConfirmUserRegistration as jest.Mock).mockResolvedValueOnce({
        message: "User confirmed successfully",
      });

      await expect(
        authService.confirmUserRegistration("testuser", "123456")
      ).resolves.not.toThrow();

      expect(logger.info).toHaveBeenCalledWith(
        "[AuthenticationService] Confirming registration for user: testuser"
      );
      expect(mockCognitoConfirmUserRegistration).toHaveBeenCalledWith(
        "testuser",
        "123456"
      );
      expect(logger.info).toHaveBeenCalledWith(
        "[AuthenticationService] User registration confirmed: testuser"
      );
    });

    it("should throw error if confirmation fails in Cognito", async () => {
      (mockCognitoConfirmUserRegistration as jest.Mock).mockRejectedValueOnce(
        new Error("Confirmation error")
      );

      await expect(
        authService.confirmUserRegistration("testuser", "000000")
      ).rejects.toThrow("Confirmation error");

      expect(logger.info).toHaveBeenCalledWith(
        "[AuthenticationService] Confirming registration for user: testuser"
      );
      expect(logger.info).not.toHaveBeenCalledWith(
        "[AuthenticationService] User registration confirmed: testuser"
      );
    });
  });
});
