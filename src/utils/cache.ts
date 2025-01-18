import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URL });

client.on("error", (err) => console.error("Redis error:", err));

export const cache = {
  set: async (key: string, value: string, ttl: number) => {
    await client.setEx(key, ttl, value);
  },
  get: async (key: string) => {
    return await client.get(key);
  },
  delete: async (key: string) => {
    await client.del(key); // Use Redis `del` command to delete the key
  },
};
