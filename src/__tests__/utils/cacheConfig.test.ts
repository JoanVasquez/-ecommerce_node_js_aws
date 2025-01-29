import { createClient } from "redis";
import { getCachedParameter } from "../../utils/ssmConfig";
import logger from "../../utils/logger";

// Mock `redis` module
jest.mock("redis", () => ({
  createClient: jest.fn(),
}));

// Mock `getCachedParameter`
jest.mock("../../utils/ssmConfig", () => ({
  getCachedParameter: jest.fn(),
}));

// Mock `logger`
jest.mock("../../utils/logger", () => ({
  error: jest.fn(),
}));

describe("cache module", () => {
  const setExMock = jest.fn();
  const getMock = jest.fn();
  const delMock = jest.fn();
  const onMock = jest.fn();

  beforeEach(() => {
    // Ensure `createClient` returns a mocked Redis client with all methods
    (createClient as jest.Mock).mockImplementation(() => ({
      setEx: setExMock,
      get: getMock,
      del: delMock,
      on: onMock, // Mocked `on` method
    }));

    // Mock `getCachedParameter` to return a Redis URL
    (getCachedParameter as jest.Mock).mockResolvedValue("redis://mock-url");
  });

  it("should initialize the Redis client with the correct URL", async () => {
    // Defer importing `cacheConfig` until after mocks are in place
    const { cache } = require("../../utils/cacheConfig");

    // Wait for the initialization to complete
    await new Promise(process.nextTick);

    // Assert Redis client initialization
    expect(createClient).toHaveBeenCalledWith({ url: "redis://mock-url" });
    expect(onMock).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("should call setEx on the Redis client for set operation", async () => {
    const { cache } = require("../../utils/cacheConfig");

    const key = "test-key";
    const value = "test-value";
    const ttl = 3600;

    await cache.set(key, value, ttl);

    expect(setExMock).toHaveBeenCalledWith(key, ttl, value);
  });

  it("should call get on the Redis client for get operation", async () => {
    const { cache } = require("../../utils/cacheConfig");

    const key = "test-key";
    const value = "test-value";

    getMock.mockResolvedValue(value);

    const result = await cache.get(key);

    expect(getMock).toHaveBeenCalledWith(key);
    expect(result).toBe(value);
  });

  it("should call del on the Redis client for delete operation", async () => {
    const { cache } = require("../../utils/cacheConfig");

    const key = "test-key";

    await cache.delete(key);

    expect(delMock).toHaveBeenCalledWith(key);
  });

  it("should log an error when Redis emits an error event", async () => {
    // Import `cacheConfig` after mocks are applied
    await import("../../utils/cacheConfig");

    // Debug: Check calls to `onMock`
    console.log("onMock calls: ", onMock.mock.calls);

    // Assert `on` was called with "error"
    expect(onMock).toHaveBeenCalledWith("error", expect.any(Function));

    // Simulate an error event
    const mockError = { message: "Redis connection failed" };

    // Find the registered error callback
    const errorCallback = onMock.mock.calls.find(
      (call) => call[0] === "error"
    )?.[1];

    // Assert callback exists
    if (!errorCallback) {
      throw new Error("Error callback was not registered");
    }

    // Trigger the callback
    errorCallback(mockError);

    // Assert `logger.error` was called
    expect(logger.error).toHaveBeenCalledWith(
      "Redis error:",
      JSON.stringify(mockError)
    );
  });
});
