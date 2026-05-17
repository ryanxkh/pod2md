import { neon } from "@neondatabase/serverless"
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http"
import { Pool } from "@neondatabase/serverless"
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless"

/**
 * Lazy proxy pattern: connections are only established when a property is
 * first accessed at runtime, avoiding build-time failures when DATABASE_URL
 * is not yet available.
 */

function createHttpClient() {
  const sql = neon(process.env.DATABASE_URL!)
  return drizzleHttp({ client: sql })
}

function createWsClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  return drizzleWs({ client: pool })
}

/** Read-only Drizzle client using Neon HTTP driver. */
export const db = new Proxy({} as ReturnType<typeof createHttpClient>, {
  get(_target, prop, receiver) {
    const client = createHttpClient()
    Object.assign(_target, client)
    return Reflect.get(client, prop, receiver)
  },
})

/** Transactional Drizzle client using Neon WebSocket driver. */
export const dbPool = new Proxy({} as ReturnType<typeof createWsClient>, {
  get(_target, prop, receiver) {
    const client = createWsClient()
    Object.assign(_target, client)
    return Reflect.get(client, prop, receiver)
  },
})
