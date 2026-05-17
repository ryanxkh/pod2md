import { neon } from "@neondatabase/serverless"
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http"
import { Pool } from "@neondatabase/serverless"
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless"

function createHttpClient() {
  const sql = neon(process.env.DATABASE_URL!)
  return drizzleHttp({ client: sql })
}

function createWsClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  return drizzleWs({ client: pool })
}

function lazyProxy<T extends object>(factory: () => T): T {
  let instance: T | undefined
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      if (!instance) instance = factory()
      return Reflect.get(instance, prop, receiver)
    },
  })
}

/** Read-only Drizzle client using Neon HTTP driver. */
export const db = lazyProxy(createHttpClient)

/** Transactional Drizzle client using Neon WebSocket driver. */
export const dbPool = lazyProxy(createWsClient)
