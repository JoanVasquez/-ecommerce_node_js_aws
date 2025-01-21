import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getCachedParameter } from "./ssmConfig";
import logger from "../utils/logger"; // Import your logger

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "us-east-1",
});

/**
 * Authenticate a user using Cognito
 */
export const authenticate = async (username: string, password: string) => {
  try {
    logger.info(`[CognitoService] Authenticating user: ${username}`);
    const userPoolId = await getCachedParameter("/myapp/cognito/user-pool-id");
    const clientId = await getCachedParameter("/myapp/cognito/client-id");

    const command = new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: "ADMIN_NO_SRP_AUTH",
      AuthParameters: { USERNAME: username, PASSWORD: password },
    });

    const response = await cognitoClient.send(command);
    logger.info(
      `[CognitoService] User authenticated successfully: ${username}`
    );
    return response.AuthenticationResult?.IdToken;
  } catch (error) {
    logger.error(
      `[CognitoService] Authentication failed for user: ${username}`,
      { error }
    );
    throw new Error("Authentication failed");
  }
};

/**
 * Register a new user in Cognito
 */
export const registerUser = async (
  username: string,
  password: string,
  email: string
) => {
  try {
    logger.info(`[CognitoService] Registering user: ${username}`);
    const clientId = await getCachedParameter("/myapp/cognito/client-id");

    const command = new SignUpCommand({
      ClientId: clientId,
      Username: username,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    });

    await cognitoClient.send(command);
    logger.info(`[CognitoService] User registered successfully: ${username}`);
    return { message: "User registered successfully" };
  } catch (error) {
    logger.error(`[CognitoService] Registration failed for user: ${username}`, {
      error,
    });
    throw new Error("Registration failed");
  }
};

/**
 * Confirm a user's registration in Cognito
 */
export const confirmUserRegistration = async (
  username: string,
  confirmationCode: string
) => {
  try {
    logger.info(
      `[CognitoService] Confirming registration for user: ${username}`
    );
    const clientId = await getCachedParameter("/myapp/cognito/client-id");

    const command = new ConfirmSignUpCommand({
      ClientId: clientId,
      Username: username,
      ConfirmationCode: confirmationCode,
    });

    await cognitoClient.send(command);
    logger.info(
      `[CognitoService] User registration confirmed successfully: ${username}`
    );
    return { message: "User confirmed successfully" };
  } catch (error) {
    logger.error(`[CognitoService] Confirmation failed for user: ${username}`, {
      error,
    });
    throw new Error("User confirmation failed");
  }
};

/**
 * Initiate password reset in Cognito
 */
export const initiatePasswordReset = async (username: string) => {
  try {
    logger.info(
      `[CognitoService] Initiating password reset for user: ${username}`
    );
    const clientId = await getCachedParameter("/myapp/cognito/client-id");

    const command = new ForgotPasswordCommand({
      ClientId: clientId,
      Username: username,
    });

    await cognitoClient.send(command);
    logger.info(
      `[CognitoService] Password reset initiated successfully for user: ${username}`
    );
    return {
      message: "Password reset initiated. Check your email for the code.",
    };
  } catch (error) {
    logger.error(
      `[CognitoService] Failed to initiate password reset for user: ${username}`,
      { error }
    );
    throw new Error("Password reset initiation failed");
  }
};

/**
 * Complete password reset in Cognito
 */
export const completePasswordReset = async (
  username: string,
  newPassword: string,
  confirmationCode: string
) => {
  try {
    logger.info(
      `[CognitoService] Completing password reset for user: ${username}`
    );
    const clientId = await getCachedParameter("/myapp/cognito/client-id");

    const command = new ConfirmForgotPasswordCommand({
      ClientId: clientId,
      Username: username,
      Password: newPassword,
      ConfirmationCode: confirmationCode,
    });

    await cognitoClient.send(command);
    logger.info(
      `[CognitoService] Password reset completed successfully for user: ${username}`
    );
    return { message: "Password reset successfully" };
  } catch (error) {
    logger.error(
      `[CognitoService] Failed to complete password reset for user: ${username}`,
      { error }
    );
    throw new Error("Password reset failed");
  }
};
