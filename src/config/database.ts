import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { getCachedParameter } from "../utils/ssmConfig";

async function initializeDataSource() {
  const AppDataSource = new DataSource({
    type: (await getCachedParameter("/myapp/db/type")) as
      | "mysql"
      | "postgres"
      | "sqlite",
    host: await getCachedParameter("/myapp/db/host"),
    port: parseInt(await getCachedParameter("/myapp/db/port"), 10),
    username: await getCachedParameter("/myapp/db/username"),
    password: await getCachedParameter("/myapp/db/password"),
    database: await getCachedParameter("/myapp/db/name"),
    entities: [User],
    synchronize: true,
  });

  return AppDataSource;
}

export const AppDataSource = await initializeDataSource();
