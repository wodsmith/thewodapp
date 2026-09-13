import { spawn, spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import mysql from "mysql2/promise"
import { mysqlTestConfig, mysqlTestDatabaseUrl } from "../test/integration/mysql-test-config.ts"

if (!mysqlTestConfig) {
  console.error("Set WODSMITH_TEST_MYSQL_SOCKET or WODSMITH_TEST_MYSQL_HOST to run database integration tests.")
  process.exit(1)
}
// This task owns a random disposable database; never use application credentials.
const database = `training_test_${randomUUID().replaceAll("-", "")}`
const connection = await mysql.createConnection({...mysqlTestConfig, multipleStatements: true})
let exitCode = 1
try {
  await connection.query(`CREATE DATABASE \`${database}\``)
  await connection.changeUser({database})
  const directory = await mkdtemp(join(tmpdir(), "training-test-schema-"))
  try {
    const output = join(directory,"schema.json")
    const generated = spawnSync("pnpm",["exec","tsx","../../packages/wodsmith-db/scripts/export-test-schema.ts",output],{stdio:"inherit"})
    if (generated.status !== 0) throw new Error("Could not generate the current training test schema")
    for (const statement of JSON.parse(await readFile(output,"utf8"))) await connection.query(statement)
  } finally { await rm(directory,{recursive:true,force:true}) }
  const url = mysqlTestDatabaseUrl(mysqlTestConfig, database)
  const args = ["exec", "vitest", "run", "test/integration", "src/server/training.test.ts", "src/server/training-personal.test.ts", "src/server/training-provider.test.ts", "--no-file-parallelism", ...process.argv.slice(2)]
  exitCode = await new Promise((resolve,reject)=>{
    const child = spawn("pnpm", args, {stdio:"inherit",env:{...process.env,WODSMITH_TEST_MYSQL_REQUIRED:"1",TRAINING_TEST_DATABASE_URL:url}})
    child.on("error",reject)
    child.on("exit",code=>resolve(code ?? 1))
  })
} finally {
  await connection.query(`DROP DATABASE IF EXISTS \`${database}\``)
  await connection.end()
}
process.exit(exitCode)
