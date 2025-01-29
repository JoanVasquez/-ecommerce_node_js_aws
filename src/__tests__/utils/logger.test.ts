import logger from "../../utils/logger";
import { createLogger, format, transports } from "winston";

jest.mock("winston", () => {
  const mockedFormat = {
    combine: jest.fn(() => "mocked-format-combine"),
    timestamp: jest.fn(() => "mocked-format-timestamp"),
    json: jest.fn(() => "mocked-format-json"),
  };
  const mockedTransports = {
    Console: jest.fn(() => ({ name: "mocked-console-transport" })),
    File: jest.fn((options) => ({ name: "mocked-file-transport", ...options })),
  };
  const mockedCreateLogger = jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
  }));

  return {
    createLogger: mockedCreateLogger,
    format: mockedFormat,
    transports: mockedTransports,
  };
});

describe("Logger", () => {
  it("should configure the logger with the correct options", () => {
    expect(createLogger).toHaveBeenCalledWith({
      level: "info",
      format: "mocked-format-combine",
      transports: [
        { name: "mocked-console-transport" },
        { name: "mocked-file-transport", filename: "logs/error.log", level: "error" },
        { name: "mocked-file-transport", filename: "logs/combined.log" },
      ],
    });
  });

  it("should combine timestamp and JSON formats", () => {
    expect(format.combine).toHaveBeenCalledWith(
      format.timestamp(),
      format.json()
    );
  });

  it("should set up Console transport", () => {
    expect(transports.Console).toHaveBeenCalled();
  });

  it("should set up File transport for errors", () => {
    expect(transports.File).toHaveBeenCalledWith({
      filename: "logs/error.log",
      level: "error",
    });
  });

  it("should set up File transport for combined logs", () => {
    expect(transports.File).toHaveBeenCalledWith({
      filename: "logs/combined.log",
    });
  });

  it("should log messages correctly", () => {
    // Mock logger methods
    const mockInfoLog = jest.spyOn(logger, "info").mockImplementation((infoObject: object) => {
      return logger; // Return logger to satisfy TypeScript
    });

    const mockErrorLog = jest.spyOn(logger, "error").mockImplementation((infoObject: object) => {
      return logger; // Return logger to satisfy TypeScript
    });

    // Log messages
    logger.info({ message: "Test info message" });
    logger.error({ message: "Test error message" });

    // Validate calls
    expect(mockInfoLog).toHaveBeenCalledWith({ message: "Test info message" });
    expect(mockErrorLog).toHaveBeenCalledWith({ message: "Test error message" });

    // Restore original implementation
    mockInfoLog.mockRestore();
    mockErrorLog.mockRestore();
  });
});
