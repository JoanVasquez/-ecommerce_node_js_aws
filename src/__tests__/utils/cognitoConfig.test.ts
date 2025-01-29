import {
  AdminInitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  authenticate,
  registerUser,
  confirmUserRegistration,
  initiatePasswordReset,
  completePasswordReset,
} from "../../utils/cognitoConfig";
import { getCachedParameter } from "../../utils/ssmConfig";
import logger from "../../utils/logger";

// Mock dependencies
jest.mock("@aws-sdk/client-cognito-identity-provider", () => {
  const sendMock = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({
      send: sendMock,
    })),
    AdminInitiateAuthCommand: jest.fn(),
    SignUpCommand: jest.fn(),
    ConfirmSignUpCommand: jest.fn(),
    ForgotPasswordCommand: jest.fn(),
    ConfirmForgotPasswordCommand: jest.fn(),
    __mocks__: { sendMock },
  };
});

jest.mock("../../utils/ssmConfig", () => ({
  getCachedParameter: jest.fn(),
}));

jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe("CognitoService", () => {
  const sendMock = require("@aws-sdk/client-cognito-identity-provider")
    .__mocks__.sendMock;
  const mockClientId = "mock-client-id";
  const mockUserPoolId = "mock-user-pool-id";

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock `getCachedParameter`
    (getCachedParameter as jest.Mock).mockImplementation((name: string) => {
      if (name === "/myapp/cognito/client-id")
        return Promise.resolve(mockClientId);
      if (name === "/myapp/cognito/user-pool-id")
        return Promise.resolve(mockUserPoolId);
      return Promise.reject(new Error("Parameter not found"));
    });
  });

  it("should authenticate a user successfully", async () => {
    const mockToken = "mock-id-token";
    sendMock.mockResolvedValue({
      AuthenticationResult: { IdToken: mockToken },
    });

    const token = await authenticate("test-user", "password123");

    expect(AdminInitiateAuthCommand).toHaveBeenCalledWith({
      UserPoolId: mockUserPoolId,
      ClientId: mockClientId,
      AuthFlow: "ADMIN_NO_SRP_AUTH",
      AuthParameters: { USERNAME: "test-user", PASSWORD: "password123" },
    });
    expect(sendMock).toHaveBeenCalledWith(expect.any(AdminInitiateAuthCommand));
    expect(token).toBe(mockToken);
    expect(logger.info).toHaveBeenCalledWith(
      "[CognitoService] Authenticating user: test-user"
    );
  });

  it("should handle authentication failure", async () => {
    sendMock.mockRejectedValue(new Error("Authentication failed"));

    await expect(
      authenticate("test-user", "wrong-password")
    ).rejects.toThrowError("Authentication failed");

    expect(logger.error).toHaveBeenCalledWith(
      "[CognitoService] Authentication failed for user: test-user",
      expect.any(Object)
    );
  });

  it("should register a user successfully", async () => {
    sendMock.mockResolvedValue({});

    const result = await registerUser(
      "new-user",
      "password123",
      "user@example.com"
    );

    expect(SignUpCommand).toHaveBeenCalledWith({
      ClientId: mockClientId,
      Username: "new-user",
      Password: "password123",
      UserAttributes: [{ Name: "email", Value: "user@example.com" }],
    });
    expect(sendMock).toHaveBeenCalledWith(expect.any(SignUpCommand));
    expect(result).toEqual({ message: "User registered successfully" });
    expect(logger.info).toHaveBeenCalledWith(
      "[CognitoService] Registering user: new-user"
    );
  });

  it("should handle registration failure", async () => {
    sendMock.mockRejectedValue(new Error("Registration failed"));

    await expect(
      registerUser("new-user", "password123", "user@example.com")
    ).rejects.toThrowError("Registration failed");

    expect(logger.error).toHaveBeenCalledWith(
      "[CognitoService] Registration failed for user: new-user",
      expect.any(Object)
    );
  });

  it("should confirm user registration successfully", async () => {
    sendMock.mockResolvedValue({});

    const result = await confirmUserRegistration("user-to-confirm", "123456");

    expect(ConfirmSignUpCommand).toHaveBeenCalledWith({
      ClientId: mockClientId,
      Username: "user-to-confirm",
      ConfirmationCode: "123456",
    });
    expect(sendMock).toHaveBeenCalledWith(expect.any(ConfirmSignUpCommand));
    expect(result).toEqual({ message: "User confirmed successfully" });
    expect(logger.info).toHaveBeenCalledWith(
      "[CognitoService] Confirming registration for user: user-to-confirm"
    );
  });

  it("should handle confirmation failure", async () => {
    sendMock.mockRejectedValue(new Error("Confirmation failed"));

    await expect(
      confirmUserRegistration("user-to-confirm", "123456")
    ).rejects.toThrowError("User confirmation failed");

    expect(logger.error).toHaveBeenCalledWith(
      "[CognitoService] Confirmation failed for user: user-to-confirm",
      expect.any(Object)
    );
  });

  it("should initiate password reset successfully", async () => {
    sendMock.mockResolvedValue({});

    const result = await initiatePasswordReset("user-to-reset");

    expect(ForgotPasswordCommand).toHaveBeenCalledWith({
      ClientId: mockClientId,
      Username: "user-to-reset",
    });
    expect(sendMock).toHaveBeenCalledWith(expect.any(ForgotPasswordCommand));
    expect(result).toEqual({
      message: "Password reset initiated. Check your email for the code.",
    });
    expect(logger.info).toHaveBeenCalledWith(
      "[CognitoService] Initiating password reset for user: user-to-reset"
    );
  });

  it("should handle password reset initiation failure", async () => {
    sendMock.mockRejectedValue(new Error("Password reset initiation failed"));

    await expect(initiatePasswordReset("user-to-reset")).rejects.toThrowError(
      "Password reset initiation failed"
    );

    expect(logger.error).toHaveBeenCalledWith(
      "[CognitoService] Failed to initiate password reset for user: user-to-reset",
      expect.any(Object)
    );
  });

  it("should complete password reset successfully", async () => {
    sendMock.mockResolvedValue({});

    const result = await completePasswordReset(
      "user-to-complete",
      "new-password",
      "123456"
    );

    expect(ConfirmForgotPasswordCommand).toHaveBeenCalledWith({
      ClientId: mockClientId,
      Username: "user-to-complete",
      Password: "new-password",
      ConfirmationCode: "123456",
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.any(ConfirmForgotPasswordCommand)
    );
    expect(result).toEqual({ message: "Password reset successfully" });
    expect(logger.info).toHaveBeenCalledWith(
      "[CognitoService] Completing password reset for user: user-to-complete"
    );
  });

  it("should handle password reset completion failure", async () => {
    sendMock.mockRejectedValue(new Error("Password reset failed"));

    await expect(
      completePasswordReset("user-to-complete", "new-password", "123456")
    ).rejects.toThrowError("Password reset failed");

    expect(logger.error).toHaveBeenCalledWith(
      "[CognitoService] Failed to complete password reset for user: user-to-complete",
      expect.any(Object)
    );
  });
});
