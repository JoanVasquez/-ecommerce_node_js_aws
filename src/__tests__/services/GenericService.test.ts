import { GenericService } from "../../services/GenericService";
import { IRepository } from "../../repositories/IRepository";
import logger from "../../utils/logger";
import { cacheModel } from "../../utils/cacheModel";

jest.mock("../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("GenericService", () => {
  // We'll mock a concrete type T. For demonstration, let's say T is a user shape:
  interface TestEntity {
    id: number;
    name: string;
  }

  let mockRepository: jest.Mocked<IRepository<TestEntity>>;
  let service: GenericService<TestEntity>;

  const fakeEntity: TestEntity = { id: 1, name: "Test Entity" };
  const fakeUpdatedEntity: Partial<TestEntity> = { name: "Updated" };
  const fakeList = [fakeEntity, { id: 2, name: "Another" }];
  const paginationResult = { data: fakeList, count: 2 };
  const mockCacheModel: cacheModel = { key: "testKey", expiration: 300 };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a mock for each method in the IRepository
    mockRepository = {
      createEntity: jest.fn(),
      findEntityById: jest.fn(),
      updateEntity: jest.fn(),
      deleteEntity: jest.fn(),
      getAllEntities: jest.fn(),
      getEntitiesWithPagination: jest.fn(),
    } as jest.Mocked<IRepository<TestEntity>>;

    // Instantiate service with the mocked repository
    service = new (class extends GenericService<TestEntity> {})(mockRepository);
  });

  // -------------------------------------------------------------------------
  // save
  // -------------------------------------------------------------------------
  describe("save", () => {
    it("should log info and call repository.createEntity, returning its result", async () => {
      mockRepository.createEntity.mockResolvedValueOnce(fakeEntity);

      const result = await service.save(fakeEntity, mockCacheModel);

      expect(logger.info).toHaveBeenCalledWith(
        `[GenericService] Saving entity: ${JSON.stringify(fakeEntity)}`
      );
      expect(mockRepository.createEntity).toHaveBeenCalledWith(
        fakeEntity,
        mockCacheModel
      );
      expect(result).toEqual(fakeEntity);
    });

    it("should bubble up errors from repository", async () => {
      mockRepository.createEntity.mockRejectedValueOnce(
        new Error("Create error")
      );

      await expect(service.save(fakeEntity, mockCacheModel)).rejects.toThrow(
        "Create error"
      );
    });
  });

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------
  describe("findById", () => {
    it("should log info and call repository.findEntityById, returning the result", async () => {
      mockRepository.findEntityById.mockResolvedValueOnce(fakeEntity);

      const result = await service.findById(1, mockCacheModel);

      expect(logger.info).toHaveBeenCalledWith(
        `[GenericService] Finding entity by ID: 1`
      );
      expect(mockRepository.findEntityById).toHaveBeenCalledWith(
        1,
        mockCacheModel
      );
      expect(result).toEqual(fakeEntity);
    });

    it("should bubble up errors from repository", async () => {
      mockRepository.findEntityById.mockRejectedValueOnce(
        new Error("Find error")
      );

      await expect(service.findById(1)).rejects.toThrow("Find error");
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe("update", () => {
    it("should log info and call repository.updateEntity, returning the updated entity", async () => {
      const updatedFullEntity = { id: 1, name: "Updated" };
      mockRepository.updateEntity.mockResolvedValueOnce(updatedFullEntity);

      const result = await service.update(1, fakeUpdatedEntity, mockCacheModel);

      expect(logger.info).toHaveBeenCalledWith(
        `[GenericService] Updating entity with ID: 1 with data: ${JSON.stringify(
          fakeUpdatedEntity
        )}`
      );
      expect(mockRepository.updateEntity).toHaveBeenCalledWith(
        1,
        fakeUpdatedEntity,
        mockCacheModel
      );
      expect(result).toEqual(updatedFullEntity);
    });

    it("should bubble up errors from repository", async () => {
      mockRepository.updateEntity.mockRejectedValueOnce(
        new Error("Update error")
      );

      await expect(service.update(1, fakeUpdatedEntity)).rejects.toThrow(
        "Update error"
      );
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------
  describe("delete", () => {
    it("should log info and call repository.deleteEntity, returning boolean result", async () => {
      mockRepository.deleteEntity.mockResolvedValueOnce(true);

      const result = await service.delete(1, mockCacheModel);

      expect(logger.info).toHaveBeenCalledWith(
        "[GenericService] Deleting entity with ID: 1"
      );
      expect(mockRepository.deleteEntity).toHaveBeenCalledWith(
        1,
        mockCacheModel
      );
      expect(result).toBe(true);
    });

    it("should bubble up errors from repository", async () => {
      mockRepository.deleteEntity.mockRejectedValueOnce(
        new Error("Delete error")
      );

      await expect(service.delete(1)).rejects.toThrow("Delete error");
    });
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------
  describe("findAll", () => {
    it("should log info and call repository.getAllEntities, returning list", async () => {
      mockRepository.getAllEntities.mockResolvedValueOnce(fakeList);

      const result = await service.findAll(mockCacheModel);

      expect(logger.info).toHaveBeenCalledWith(
        "[GenericService] Finding all entities"
      );
      expect(mockRepository.getAllEntities).toHaveBeenCalledWith(
        mockCacheModel
      );
      expect(result).toEqual(fakeList);
    });

    it("should bubble up errors from repository", async () => {
      mockRepository.getAllEntities.mockRejectedValueOnce(
        new Error("GetAll error")
      );

      await expect(service.findAll()).rejects.toThrow("GetAll error");
    });
  });

  // -------------------------------------------------------------------------
  // findWithPagination
  // -------------------------------------------------------------------------
  describe("findWithPagination", () => {
    it("should log info and call repository.getEntitiesWithPagination, returning data/count", async () => {
      mockRepository.getEntitiesWithPagination.mockResolvedValueOnce(
        paginationResult
      );

      const result = await service.findWithPagination(0, 10, mockCacheModel);

      expect(logger.info).toHaveBeenCalledWith(
        "[GenericService] Finding entities with pagination: skip=0, take=10"
      );
      expect(mockRepository.getEntitiesWithPagination).toHaveBeenCalledWith(
        0,
        10,
        mockCacheModel
      );
      expect(result).toEqual(paginationResult);
    });

    it("should bubble up errors from repository", async () => {
      mockRepository.getEntitiesWithPagination.mockRejectedValueOnce(
        new Error("Pagination error")
      );

      await expect(service.findWithPagination(0, 10)).rejects.toThrow(
        "Pagination error"
      );
    });
  });
});
