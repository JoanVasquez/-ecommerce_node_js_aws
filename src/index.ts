import { initDataSource } from "./config/database";

async function bootstrap() {
  await initDataSource();
  // Now AppDataSource is ready
  // Start your server, run migrations, etc.
}

bootstrap().catch((err) => {
  console.error("Failed to initialize DataSource:", err);
  process.exit(1);
});
