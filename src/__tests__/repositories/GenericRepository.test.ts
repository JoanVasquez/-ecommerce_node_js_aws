import { DataSource, Repository } from "typeorm";
import { GenericRepository } from "../../repositories/GenericRepository";
import { User } from "../../entities/User"; // or your own entity
import { cache } from "../../utils/cacheConfig";
import logger from "../../utils/logger";

// This is our type for the "cacheModel"
import { cacheModel } from "../../utils/cacheModel";

/**
 * Mock logger so we don't actually log during tests.
 * You can also spy on logger calls if you want to verify them.
 */
jest.mock("../../utils/logger", () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

/**
 * Mock the cache so we can track calls to `get`, `set`, `delete`.
 */
jest.mock("../../utils/cacheConfig", () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("GenericRepository", () => {
  let mockDataSource: Partial<DataSource>;
  let mockRepository: Partial<Repository<User>>;
  let genericRepository: GenericRepository<User>;

  // Common test data
  const user: User = {
    id: 1,
    username: "John Doe",
    email: "test@test.com",
    password: "1234",
  };
  const updatedUser: User = {
    id: 1,
    username: "John Doe",
    email: "test@test.com",
    password: "1234",
  };

  // Example cache model
  const mockCacheModel: cacheModel = {
    key: "user-1",
    expiration: 300,
  };

  beforeEach(() => {
    // Reset all mocks before each test to have a fresh start
    jest.resetAllMocks();

    // Mock repository methods we use in GenericRepository
    mockRepository = {
      save: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
    };

    // Mock DataSource.getRepository so it returns our mocked repository
    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    // Instantiate the GenericRepository with our mocks
    genericRepository = new (class extends GenericRepository<User> {})(
      mockDataSource as DataSource,
      User
    );
  });

  // ---------------------------------------------------------------------
  // createEntity
  // ---------------------------------------------------------------------
  describe("createEntity", () => {
    it("should create and save a new entity, no cache used", async () => {
      (mockRepository.save as jest.Mock).mockResolvedValue(user);

      const result = await genericRepository.createEntity(user);

      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith(user);
      expect(cache.get).not.toHaveBeenCalled(); // no cache usage
      expect(cache.set).not.toHaveBeenCalled();
      expect(result).toEqual(user);
    });

    it("should create and save a new entity, and set cache if not in cache", async () => {
      (mockRepository.save as jest.Mock).mockResolvedValue(user);
      (cache.get as jest.Mock).mockResolvedValue(null);

      const result = await genericRepository.createEntity(user, mockCacheModel);

      expect(mockRepository.save).toHaveBeenCalledWith(user);
      expect(cache.set).toHaveBeenCalledWith(
        mockCacheModel.key,
        JSON.stringify(user),
        mockCacheModel.expiration
      );
      expect(result).toEqual(user);
    });

    it("should return null if there is an error saving", async () => {
      (mockRepository.save as jest.Mock).mockRejectedValue(
        new Error("DB error")
      );

      const result = await genericRepository.createEntity(user);

      expect(logger.error).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // findEntityById
  // ---------------------------------------------------------------------
  describe("findEntityById", () => {
    it("should return entity from cache if available", async () => {
      (cache.get as jest.Mock).mockResolvedValue(JSON.stringify(user));

      const result = await genericRepository.findEntityById(1, mockCacheModel);

      expect(cache.get).toHaveBeenCalledWith(mockCacheModel.key);
      expect(mockRepository.findOneBy).not.toHaveBeenCalled();
      expect(result).toEqual(user);
    });

    it("should find entity from DB if cache is empty, then cache it", async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (mockRepository.findOneBy as jest.Mock).mockResolvedValue(user);

      const result = await genericRepository.findEntityById(1, mockCacheModel);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(cache.set).toHaveBeenCalledWith(
        mockCacheModel.key,
        JSON.stringify(user),
        mockCacheModel.expiration
      );
      expect(result).toEqual(user);
    });

    it("should throw error internally if entity not found, then return null", async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (mockRepository.findOneBy as jest.Mock).mockResolvedValue(null);

      const result = await genericRepository.findEntityById(1, mockCacheModel);

      expect(logger.info).toHaveBeenCalled(); // logs "Entity found: null"
      expect(result).toBeNull();
    });

    it("should return null and log an error if repository findOneBy throws an error", async () => {
      (mockRepository.findOneBy as jest.Mock).mockRejectedValue(
        new Error("DB error")
      );

      const result = await genericRepository.findEntityById(1);

      expect(logger.error).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // updateEntity
  // ---------------------------------------------------------------------
  describe("updateEntity", () => {
    it("should update entity, find it again, set cache, and return updated entity", async () => {
      (mockRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });
      // We must mock findEntityById or the subsequent calls on the repository
      (mockRepository.findOneBy as jest.Mock).mockResolvedValue(updatedUser);

      const result = await genericRepository.updateEntity(
        1,
        { username: "Jane Doe", email: "test@test.com", password: "123456" },
        mockCacheModel
      );

      expect(mockRepository.update).toHaveBeenCalledWith(1, {
        username: "Jane Doe",
        email: "test@test.com",
        password: "123456",
      });
      expect(cache.set).toHaveBeenCalledWith(
        mockCacheModel.key,
        JSON.stringify(updatedUser),
        mockCacheModel.expiration
      );
      expect(result).toEqual(updatedUser);
    });

    it("should throw error if updated entity is not found after update, then return null", async () => {
      (mockRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (mockRepository.findOneBy as jest.Mock).mockResolvedValue(null);

      const result = await genericRepository.updateEntity(1, {
        username: "Jane Doe",
        email: "test@test.com",
        password: "123456",
      });

      expect(logger.error).toHaveBeenCalledWith(
        "[GenericRepository] Entity with ID: 1 not found"
      );
      expect(result).toBeNull();
    });

    it("should catch and handle error. If entity was found, it should roll back and delete it, then return null", async () => {
      (mockRepository.update as jest.Mock).mockRejectedValue(
        new Error("DB update error")
      );
      (mockRepository.findOneBy as jest.Mock).mockResolvedValue(user);
      (mockRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await genericRepository.updateEntity(1, {
        username: "Jane Doe",
        email: "test@test.com",
        password: "123456",
      });

      expect(logger.error).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        `[GenericRepository] Database entity rolled back: ${JSON.stringify(
          user
        )}`
      );
      expect(mockRepository.delete).toHaveBeenCalledWith(user.id);
      expect(result).toBeNull();
    });

    it("should catch and handle error. If entity was not found, just return null", async () => {
      (mockRepository.update as jest.Mock).mockRejectedValue(
        new Error("DB update error")
      );
      (mockRepository.findOneBy as jest.Mock).mockResolvedValue(null);

      const result = await genericRepository.updateEntity(1, {
        username: "Jane Doe",
        email: "test@test.com",
        password: "123456",
      });

      expect(logger.error).toHaveBeenCalled();
      // No rollback since entity not found
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining("rolled back")
      );
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // deleteEntity
  // ---------------------------------------------------------------------
  describe("deleteEntity", () => {
    it("should delete entity and remove from cache if specified", async () => {
      (mockRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await genericRepository.deleteEntity(1, mockCacheModel);

      expect(mockRepository.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
      expect(cache.delete).toHaveBeenCalledWith(mockCacheModel.key);
    });

    it("should throw error if delete affected = 0, return false", async () => {
      (mockRepository.delete as jest.Mock).mockResolvedValue({ affected: 0 });

      const result = await genericRepository.deleteEntity(1, mockCacheModel);

      expect(logger.error).toHaveBeenCalledWith(
        "[GenericRepository] Failed to delete entity with ID: 1"
      );
      expect(result).toBe(false);
    });

    it("should return false if delete throws error", async () => {
      (mockRepository.delete as jest.Mock).mockRejectedValue(
        new Error("DB delete error")
      );

      const result = await genericRepository.deleteEntity(1);

      expect(logger.error).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------
  // getAllEntities
  // ---------------------------------------------------------------------
  describe("getAllEntities", () => {
    it("should return entities from cache if available", async () => {
      (cache.get as jest.Mock).mockResolvedValue(JSON.stringify([user]));

      const result = await genericRepository.getAllEntities(mockCacheModel);

      expect(cache.get).toHaveBeenCalledWith(mockCacheModel.key);
      expect(mockRepository.find).not.toHaveBeenCalled();
      expect(result).toEqual([user]);
    });

    it("should fetch from DB and cache if cache is empty", async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (mockRepository.find as jest.Mock).mockResolvedValue([user]);

      const result = await genericRepository.getAllEntities(mockCacheModel);

      expect(mockRepository.find).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalledWith(
        mockCacheModel.key,
        JSON.stringify([user]),
        mockCacheModel.expiration
      );
      expect(result).toEqual([user]);
    });

    it("should simply return DB results if no cacheModel is provided", async () => {
      (mockRepository.find as jest.Mock).mockResolvedValue([user]);

      const result = await genericRepository.getAllEntities();

      expect(cache.get).not.toHaveBeenCalled();
      expect(result).toEqual([user]);
    });
  });

  // ---------------------------------------------------------------------
  // getEntitiesWithPagination
  // ---------------------------------------------------------------------
  describe("getEntitiesWithPagination", () => {
    it("should return data from cache if available", async () => {
      const paginatedData = { data: [user], count: 1 };
      (cache.get as jest.Mock).mockResolvedValue(JSON.stringify(paginatedData));

      const result = await genericRepository.getEntitiesWithPagination(
        0,
        10,
        mockCacheModel
      );

      expect(cache.get).toHaveBeenCalledWith(mockCacheModel.key);
      expect(mockRepository.findAndCount).not.toHaveBeenCalled();
      expect(result).toEqual(paginatedData);
    });

    it("should fetch from DB if cache is empty", async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (mockRepository.findAndCount as jest.Mock).mockResolvedValue([[user], 1]);

      const result = await genericRepository.getEntitiesWithPagination(
        0,
        10,
        mockCacheModel
      );

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
      });
      // Notice that in your code, you do not re-set the cache for pagination results.
      // If desired, add that logic or test accordingly.
      expect(result).toEqual({ data: [user], count: 1 });
    });

    it("should work without cacheModel", async () => {
      (mockRepository.findAndCount as jest.Mock).mockResolvedValue([[user], 1]);

      const result = await genericRepository.getEntitiesWithPagination(0, 10);

      expect(cache.get).not.toHaveBeenCalled();
      expect(result).toEqual({ data: [user], count: 1 });
    });
  });
});
