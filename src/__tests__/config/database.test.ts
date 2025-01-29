import { AppDataSource, initDataSource } from "../../config/database";
import { getCachedParameter } from "../../utils/ssmConfig";
import { DataSource } from "typeorm";
import { User } from "../../entities/User";

jest.mock("../../utils/ssmConfig", () => ({
  getCachedParameter: jest.fn(),
}));

describe("database.ts (initDataSource)", () => {
  let mockGetCachedParameter = getCachedParameter as jest.MockedFunction<
    typeof getCachedParameter
  >;

  let setOptionsSpy: jest.SpyInstance;
  let initializeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Spy on setOptions
    setOptionsSpy = jest.spyOn(AppDataSource, "setOptions");

    // Mock .initialize() so it doesn't do real DB sync
    initializeSpy = jest
      .spyOn(AppDataSource, "initialize")
      .mockResolvedValue(AppDataSource);

    // By default, data source not initialized
    Object.defineProperty(AppDataSource, "isInitialized", {
      value: false,
      writable: true,
    });
  });

  afterAll(() => {
    delete process.env.NODE_ENV;
  });

  it("should use in-memory SQLite config if NODE_ENV is test", async () => {
    process.env.NODE_ENV = "test";

    await initDataSource();

    expect(setOptionsSpy).toHaveBeenCalledWith({
      type: "sqlite",
      database: ":memory:",
      entities: [User],
      synchronize: false,
    });
    expect(mockGetCachedParameter).not.toHaveBeenCalled();
    expect(initializeSpy).toHaveBeenCalled();
  });

  it("should fetch config from SSM and use it if NODE_ENV is not test", async () => {
    process.env.NODE_ENV = "production";
    mockGetCachedParameter
      .mockResolvedValueOnce("mysql")
      .mockResolvedValueOnce("localhost")
      .mockResolvedValueOnce("3306")
      .mockResolvedValueOnce("testuser")
      .mockResolvedValueOnce("testpass")
      .mockResolvedValueOnce("testdb");

    await initDataSource();

    expect(mockGetCachedParameter).toHaveBeenNthCalledWith(1, "/myapp/db/type");
    expect(mockGetCachedParameter).toHaveBeenNthCalledWith(2, "/myapp/db/host");
    expect(mockGetCachedParameter).toHaveBeenNthCalledWith(3, "/myapp/db/port");
    expect(mockGetCachedParameter).toHaveBeenNthCalledWith(
      4,
      "/myapp/db/username"
    );
    expect(mockGetCachedParameter).toHaveBeenNthCalledWith(
      5,
      "/myapp/db/password"
    );
    expect(mockGetCachedParameter).toHaveBeenNthCalledWith(6, "/myapp/db/name");

    expect(setOptionsSpy).toHaveBeenCalledWith({
      type: "mysql",
      host: "localhost",
      port: 3306,
      username: "testuser",
      password: "testpass",
      database: "testdb",
      synchronize: true, // as in your code
    });
    expect(initializeSpy).toHaveBeenCalled();
  });

  it("should not call initialize if already initialized", async () => {
    process.env.NODE_ENV = "test";
    Object.defineProperty(AppDataSource, "isInitialized", {
      value: true,
      writable: true,
    });

    await initDataSource();
    expect(initializeSpy).not.toHaveBeenCalled();
  });

  it("should throw an error if one of the SSM calls fails in non-test mode", async () => {
    process.env.NODE_ENV = "production";
    mockGetCachedParameter.mockRejectedValueOnce(new Error("SSM error"));

    await expect(initDataSource()).rejects.toThrow("SSM error");

    expect(setOptionsSpy).not.toHaveBeenCalled();
    expect(initializeSpy).not.toHaveBeenCalled();
  });
});
