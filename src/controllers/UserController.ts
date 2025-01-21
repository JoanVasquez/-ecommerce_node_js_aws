import { UserService } from "../services/UserService";
import { HttpResponse } from "../utils/HttpResponse";
import logger from "../utils/logger";
import { User } from "../entities/User";

const userService = new UserService();

export const registerUser = async (event: any) => {
  try {
    const { username, password, email } = JSON.parse(event.body || "{}");

    if (!username || !password || !email) {
      logger.warn("[UserController] Missing user registration data");
      return {
        statusCode: 400,
        body: JSON.stringify(
          HttpResponse.error(
            "Missing required fields: username, password, or email",
            400
          )
        ),
      };
    }

    const response = await userService.save({
      username,
      password,
      email,
    } as User);
    return {
      statusCode: 200,
      body: JSON.stringify(
        HttpResponse.success(response, "User registered successfully")
      ),
    };
  } catch (error) {
    logger.error("[UserController] Registration failed", { error });
    return {
      statusCode: 500,
      body: JSON.stringify(
        HttpResponse.error(
          "Failed to register user",
          500,
          (error as Error).message
        )
      ),
    };
  }
};

export const confirmUserRegistration = async (event: any) => {
  try {
    const { username, confirmationCode } = JSON.parse(event.body || "{}");

    if (!username || !confirmationCode) {
      logger.warn("[UserController] Missing confirmation data");
      return {
        statusCode: 400,
        body: JSON.stringify(
          HttpResponse.error(
            "Missing required fields: username or confirmationCode",
            400
          )
        ),
      };
    }

    const response = await userService.confirmRegistration(
      username,
      confirmationCode
    );
    return {
      statusCode: 200,
      body: JSON.stringify(
        HttpResponse.success(response, "User confirmed successfully")
      ),
    };
  } catch (error) {
    logger.error("[UserController] User confirmation failed", { error });
    return {
      statusCode: 500,
      body: JSON.stringify(
        HttpResponse.error(
          "Failed to confirm user",
          500,
          (error as Error).message
        )
      ),
    };
  }
};

export const authenticateUser = async (event: any) => {
  try {
    const { username, password } = JSON.parse(event.body || "{}");

    if (!username || !password) {
      logger.warn("[UserController] Missing authentication data");
      return {
        statusCode: 400,
        body: JSON.stringify(
          HttpResponse.error(
            "Missing required fields: username or password",
            400
          )
        ),
      };
    }

    const response = await userService.authenticate(username, password);
    return {
      statusCode: 200,
      body: JSON.stringify(
        HttpResponse.success(response, "Authentication successful")
      ),
    };
  } catch (error) {
    logger.error("[UserController] Authentication failed", { error });
    return {
      statusCode: 500,
      body: JSON.stringify(
        HttpResponse.error(
          "Authentication failed",
          500,
          (error as Error).message
        )
      ),
    };
  }
};

export const initiatePasswordReset = async (event: any) => {
  try {
    const { username } = JSON.parse(event.body || "{}");

    if (!username) {
      logger.warn("[UserController] Missing username for password reset");
      return {
        statusCode: 400,
        body: JSON.stringify(HttpResponse.error("Username is required", 400)),
      };
    }

    const response = await userService.initiatePasswordReset(username);
    return {
      statusCode: 200,
      body: JSON.stringify(
        HttpResponse.success(response, "Password reset initiated successfully")
      ),
    };
  } catch (error) {
    logger.error("[UserController] Password reset initiation failed", {
      error,
    });
    return {
      statusCode: 500,
      body: JSON.stringify(
        HttpResponse.error(
          "Failed to initiate password reset",
          500,
          (error as Error).message
        )
      ),
    };
  }
};

export const completePasswordReset = async (event: any) => {
  try {
    const { username, newPassword, confirmationCode } = JSON.parse(
      event.body || "{}"
    );

    if (!username || !newPassword || !confirmationCode) {
      logger.warn(
        "[UserController] Missing data for password reset completion"
      );
      return {
        statusCode: 400,
        body: JSON.stringify(
          HttpResponse.error(
            "Missing required fields: username, newPassword, or confirmationCode",
            400
          )
        ),
      };
    }

    const response = await userService.completePasswordReset(
      username,
      newPassword,
      confirmationCode
    );
    return {
      statusCode: 200,
      body: JSON.stringify(
        HttpResponse.success(response, "Password reset completed successfully")
      ),
    };
  } catch (error) {
    logger.error("[UserController] Password reset completion failed", {
      error,
    });
    return {
      statusCode: 500,
      body: JSON.stringify(
        HttpResponse.error(
          "Failed to complete password reset",
          500,
          (error as Error).message
        )
      ),
    };
  }
};

export const getUserById = async (event: any) => {
  try {
    const { id } = event.pathParameters;

    if (!id) {
      logger.warn("[UserController] Missing user ID in path parameters");
      return {
        statusCode: 400,
        body: JSON.stringify(HttpResponse.error("User ID is required", 400)),
      };
    }

    const user = await userService.findById(Number(id));
    if (!user) {
      logger.warn(`[UserController] User not found with ID: ${id}`);
      return {
        statusCode: 404,
        body: JSON.stringify(HttpResponse.error("User not found", 404)),
      };
    }

    logger.info(`[UserController] User retrieved successfully with ID: ${id}`);
    return {
      statusCode: 200,
      body: JSON.stringify(
        HttpResponse.success(user, "User retrieved successfully")
      ),
    };
  } catch (error) {
    logger.error("[UserController] Failed to fetch user by ID", { error });
    return {
      statusCode: 500,
      body: JSON.stringify(
        HttpResponse.error(
          "Failed to fetch user",
          500,
          (error as Error).message
        )
      ),
    };
  }
};

export const updateUser = async (event: any) => {
  try {
    const { id } = event.pathParameters;
    const updatedData = JSON.parse(event.body || "{}");

    if (!id || !updatedData) {
      logger.warn("[UserController] Missing user ID or update data");
      return {
        statusCode: 400,
        body: JSON.stringify(
          HttpResponse.error("User ID and update data are required", 400)
        ),
      };
    }

    const updatedUser = await userService.update(Number(id), updatedData);
    if (!updatedUser) {
      logger.warn(`[UserController] Failed to update user with ID: ${id}`);
      return {
        statusCode: 404,
        body: JSON.stringify(HttpResponse.error("User not found", 404)),
      };
    }

    logger.info(`[UserController] User updated successfully with ID: ${id}`);
    return {
      statusCode: 200,
      body: JSON.stringify(
        HttpResponse.success(updatedUser, "User updated successfully")
      ),
    };
  } catch (error) {
    logger.error("[UserController] Failed to update user", { error });
    return {
      statusCode: 500,
      body: JSON.stringify(
        HttpResponse.error(
          "Failed to update user",
          500,
          (error as Error).message
        )
      ),
    };
  }
};
