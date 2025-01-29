import { resetPasswordInputValidator } from "../../utils/validateResetPasswordInput";
import logger from "../../utils/logger";

// Mock the logger
jest.mock("../../utils/logger", () => ({
  warn: jest.fn(),
}));

describe("resetPasswordInputValidator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should not throw an error for valid inputs", () => {
    expect(() => {
      resetPasswordInputValidator("validUsername", "validPassword", "123456");
    }).not.toThrow();
  });

  it("should throw an error if username is missing", () => {
    expect(() => {
      resetPasswordInputValidator("", "validPassword", "123456");
    }).toThrowError(
      "Missing required fields: username, newPassword, or confirmationCode"
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "[UserService] Missing required fields for password reset."
    );
  });

  it("should throw an error if password is missing", () => {
    expect(() => {
      resetPasswordInputValidator("validUsername", "", "123456");
    }).toThrowError(
      "Missing required fields: username, newPassword, or confirmationCode"
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "[UserService] Missing required fields for password reset."
    );
  });

  it("should throw an error if confirmationCode is missing", () => {
    expect(() => {
      resetPasswordInputValidator("validUsername", "validPassword", "");
    }).toThrowError(
      "Missing required fields: username, newPassword, or confirmationCode"
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "[UserService] Missing required fields for password reset."
    );
  });

  it("should throw an error if all fields are missing", () => {
    expect(() => {
      resetPasswordInputValidator("", "", "");
    }).toThrowError(
      "Missing required fields: username, newPassword, or confirmationCode"
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "[UserService] Missing required fields for password reset."
    );
  });
});
