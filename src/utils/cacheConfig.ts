import { createClient } from "redis";
import { getCachedParameter } from "./ssmConfig";
import logger from "./logger";

type Cache = {
  set: (key: string, value: string, ttl: number) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  delete: (key: string) => Promise<void>;
};

const cache: Cache = {} as Cache;

(async function () {
  const client = createClient({
    url: await getCachedParameter("/myapp/redis/url"),
  });

  client.on("error", (err) =>
    logger.error("Redis error:", JSON.stringify(err))
  );

  cache.set = async (key: string, value: string, ttl: number) => {
    await client.setEx(key, ttl, value);
  };

  cache.get = async (key: string) => {
    return await client.get(key);
  };

  cache.delete = async (key: string) => {
    await client.del(key); // Use Redis `del` command to delete the key
  };
})();

export { cache, Cache as CacheType };
