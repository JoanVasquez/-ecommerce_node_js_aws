import { DataSource, Repository } from "typeorm";
import { UserRepository } from "../../repositories/UserRepository";
import { User } from "../../entities/User";
import { cache } from "../../utils/cacheConfig";
import logger from "../../utils/logger";
import { cacheModel } from "../../utils/cacheModel";

/**
 * Mock logger and cache so we can track calls without actually
 * writing logs or interacting with Redis.
 */
jest.mock("../../utils/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

jest.mock("../../utils/cacheConfig", () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("UserRepository", () => {
  let mockDataSource: Partial<DataSource>;
  let mockRepository: Partial<Repository<User>>;
  let userRepository: UserRepository;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    // Mock Repository methods used in UserRepository
    mockRepository = {
      findOneBy: jest.fn(),
    };

    // Mock DataSource to return our mock repository
    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    // Instantiate UserRepository with the mocked data source
    userRepository = new UserRepository(mockDataSource as DataSource);
  });

  describe("findUserByUsername", () => {
    it("should return user from cache if it's present", async () => {
      const user = { id: 1, username: "john_doe" } as User;
      const mockCacheModel: cacheModel = {
        key: "user-username-john_doe",
        expiration: 300,
      };

      // Simulate that the user is already in cache
      (cache.get as jest.Mock).mockResolvedValue(JSON.stringify(user));

      const result = await userRepository.findUserByUsername(
        "john_doe",
        mockCacheModel
      );

      expect(cache.get).toHaveBeenCalledWith(mockCacheModel.key);
      expect(mockRepository.findOneBy).not.toHaveBeenCalled();
      expect(result).toEqual(user);
    });

    it("should find user from DB if not in cache, then set cache", async () => {
      const user = { id: 2, username: "jane_doe" } as User;
      const mockCacheModel: cacheModel = {
        key: "user-username-jane_doe",
        expiration: 300,
      };

      (cache.get as jest.Mock).mockResolvedValue(null);
      (mockRepository.findOneBy as jest.Mock).mockResolvedValue(user);

      const result = await userRepository.findUserByUsername(
        "jane_doe",
        mockCacheModel
      );

      expect(cache.get).toHaveBeenCalledWith(mockCacheModel.key);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        username: "jane_doe",
      });
      expect(cache.set).toHaveBeenCalledWith(
        mockCacheModel.key,
        JSON.stringify(user),
        mockCacheModel.expiration
      );
      expect(result).toEqual(user);
    });

    it("should not use cache if cacheModel is not provided, and just return DB result", async () => {
      const user = { id: 3, username: "no_cache_user" } as User;
      (mockRepository.findOneBy as jest.Mock).mockResolvedValue(user);

      const result = await userRepository.findUserByUsername("no_cache_user");

      expect(cache.get).not.toHaveBeenCalled();
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        username: "no_cache_user",
      });
      expect(cache.set).not.toHaveBeenCalled();
      expect(result).toEqual(user);
    });

    it("should log warning, throw error internally, then catch and return null if user is not found", async () => {
      // No user found in DB
      (mockRepository.findOneBy as jest.Mock).mockResolvedValue(null);

      const result = await userRepository.findUserByUsername("unknown_user");

      // The code logs a warning, throws an error, then the try-catch logs error and returns null
      expect(logger.warn).toHaveBeenCalledWith(
        "[UserRepository] No user found with username: unknown_user"
      );
      expect(logger.error).toHaveBeenCalledWith(
        "[UserRepository] Error finding user by username:",
        { error: expect.any(Error) }
      );
      expect(result).toBeNull();
    });

    it("should log error and return null if database call fails", async () => {
      (mockRepository.findOneBy as jest.Mock).mockRejectedValue(
        new Error("DB error")
      );

      const result = await userRepository.findUserByUsername("error_user");

      expect(logger.error).toHaveBeenCalledWith(
        "[UserRepository] Error finding user by username:",
        { error: expect.any(Error) }
      );
      expect(result).toBeNull();
    });
  });
});
