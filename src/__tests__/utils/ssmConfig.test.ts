import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { getCachedParameter } from "../../utils/ssmConfig";
import logger from "../../utils/logger";

// Mock logger
jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

// Mock AWS SDK
jest.mock("@aws-sdk/client-ssm", () => {
  return {
    SSMClient: jest.fn(),
    GetParameterCommand: jest.fn(),
  };
});

describe("getCachedParameter", () => {
  const sendMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SSMClient to include a mocked `send` method
    (SSMClient as jest.Mock).mockImplementation(() => ({
      send: sendMock,
    }));

    // Mock GetParameterCommand to return the correct structure
    (GetParameterCommand as unknown as jest.Mock).mockImplementation((input) => ({
      input,
    }));
  });

  it("should fetch and cache a parameter", async () => {
    const mockParameterName = "test-param";
    const mockParameterValue = "test-value";

    // Mock SSM response
    sendMock.mockResolvedValueOnce({
      Parameter: { Value: mockParameterValue },
    });

    // First call: Fetch from SSM and cache
    const result1 = await getCachedParameter(mockParameterName);

    // Assert SSM fetch
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Name: mockParameterName,
          WithDecryption: true,
        },
      })
    );
    expect(result1).toBe(mockParameterValue);

    // Verify logger for SSM fetch
    expect(logger.info).toHaveBeenCalledWith(
      `[getCachedParameter] Fetching parameter "${mockParameterName}" from SSM.`
    );
    expect(logger.info).toHaveBeenCalledWith(
      `[getCachedParameter] Parameter "${mockParameterName}" cached successfully.`
    );

    // Second call: Retrieve from cache
    const result2 = await getCachedParameter(mockParameterName);

    // Assert no additional SSM call
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(result2).toBe(mockParameterValue);

    // Verify logger for cache retrieval
    expect(logger.info).toHaveBeenCalledWith(
      `[getCachedParameter] Parameter "${mockParameterName}" retrieved from cache.`
    );
  });

  it("should throw an error if the parameter is not found or has no value", async () => {
    const mockParameterName = "invalid-param";

    // Mock SSM response with no value
    sendMock.mockResolvedValueOnce({ Parameter: undefined });

    await expect(getCachedParameter(mockParameterName)).rejects.toThrowError(
      `Could not fetch parameter: ${mockParameterName}`
    );

    // Verify logger for error
    expect(logger.error).toHaveBeenCalledWith(
      `[getCachedParameter] Parameter "${mockParameterName}" not found or has no value.`
    );
  });

  it("should log and throw an error if SSM client fails", async () => {
    const mockParameterName = "error-param";
    const mockError = new Error("SSM error");

    // Mock SSMClient send rejection
    sendMock.mockRejectedValueOnce(mockError);

    await expect(getCachedParameter(mockParameterName)).rejects.toThrowError(
      `Could not fetch parameter: ${mockParameterName}`
    );

    // Verify logger for error
    expect(logger.error).toHaveBeenCalledWith(
      `[getCachedParameter] Error fetching parameter "${mockParameterName}": ${mockError.message}`,
      { error: mockError }
    );
  });
});
