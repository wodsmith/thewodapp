import { drizzle, type MySql2Database } from "drizzle-orm/mysql2"
import mysql, { type Connection, type ConnectionOptions, type Pool } from "mysql2"

import * as schema from "./schema"

export type WodsmithSchema = typeof schema
export type WodsmithDb = MySql2Database<WodsmithSchema>
export type WodsmithMysqlClient = Connection | Pool

export function createWodsmithDb(client: WodsmithMysqlClient): WodsmithDb {
  return drizzle({
    client,
    schema,
    casing: "snake_case",
    mode: "planetscale",
  })
}

export function normalizeWodsmithMysqlUrl(connectionString: string): URL {
  const url = new URL(connectionString)
  url.searchParams.delete("ssl-mode")
  url.searchParams.delete("sslmode")
  return url
}

export function createWodsmithMysqlConnection(
  connectionString: string,
  options: Omit<ConnectionOptions, "uri"> = {},
): Connection {
  const url = normalizeWodsmithMysqlUrl(connectionString)

  return mysql.createConnection({
    uri: url.toString(),
    disableEval: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    ...options,
  })
}

export function createWodsmithDbFromConnectionString(
  connectionString: string,
): WodsmithDb {
  return createWodsmithDb(createWodsmithMysqlConnection(connectionString))
}
