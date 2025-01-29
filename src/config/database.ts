import { DataSource, DataSourceOptions } from "typeorm";
import { User } from "../entities/User";
import { getCachedParameter } from "../utils/ssmConfig";

/**
 * We'll start with placeholder options. We'll fill them in `initDataSource()`.
 */
const initialOptions: DataSourceOptions = {
  type: "sqlite",
  database: ":memory:",
  entities: [User],
  synchronize: false,
};

/**
 * Export a single `AppDataSource` instance that can be imported elsewhere.
 */
export const AppDataSource = new DataSource(initialOptions);

/**
 * Initialize the `AppDataSource` by reading config from SSM.
 * Call this once at startup (before using the data source).
 */
export async function initDataSource(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    // Use in-memory SQLite for tests
    AppDataSource.setOptions({
      type: "sqlite",
      database: ":memory:",
      entities: [User],
      synchronize: false,
    });
  } else {
    // Retrieve config from SSM or environment
    const type = (await getCachedParameter("/myapp/db/type")) as
      | "mysql"
      | "postgres"
      | "sqlite";
    const host = await getCachedParameter("/myapp/db/host");
    const port = parseInt(await getCachedParameter("/myapp/db/port"), 10);
    const username = await getCachedParameter("/myapp/db/username");
    const password = await getCachedParameter("/myapp/db/password");
    const database = await getCachedParameter("/myapp/db/name");

    // Update the DataSource options
    AppDataSource.setOptions({
      type,
      host,
      port,
      username,
      password,
      database,
      synchronize: true,
    });
  }

  // Finally, initialize the connection
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}
