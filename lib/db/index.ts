import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy connection via Proxy so builds work without POSTGRES_URL
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    const instance = createDb();
    return Reflect.get(instance, prop);
  },
});

function createDb() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("POSTGRES_URL environment variable is not set");
  }
  const sql = neon(url);
  return drizzle({ client: sql, schema });
}
