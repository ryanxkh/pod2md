import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzleHttp(sql, { schema });
}

let cached: ReturnType<typeof createDb> | null = null;

function getDb() {
  if (!cached) {
    cached = createDb();
  }
  return cached;
}

// Lazy proxy: avoids build-time connection failures when DATABASE_URL is unset
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
