import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

neonConfig.fetchConnectionCache = true;

function getConnectionString(): string {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL environment variable is not set");
  return url;
}

export const db = new Proxy({} as ReturnType<typeof drizzleHttp<typeof schema>>, {
  get(_target, prop, receiver) {
    const sql = neon(getConnectionString());
    const instance = drizzleHttp(sql, { schema });
    return Reflect.get(instance, prop, receiver);
  },
});

export function getTransactionalDb() {
  const pool = new Pool({ connectionString: getConnectionString() });
  return drizzleWs(pool, { schema });
}
