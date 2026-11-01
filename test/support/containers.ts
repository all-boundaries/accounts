// Preloaded by bunfig.toml. Nothing starts until a test file asks for the database,
// so domain tests stay instant and need no Docker.
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, beforeEach } from "bun:test";
import { closeDb, sql } from "../../src/plumbing/db";
import { migrate } from "../../src/plumbing/migrate";

const teardowns: Array<() => Promise<unknown>> = [];

/** Registers something to stop once the whole run has finished. */
export function stopAtEnd(stop: () => Promise<unknown>) {
  teardowns.push(stop);
}

let started: Promise<{ stop(): Promise<unknown> }> | undefined;

/** Starts one PostgreSQL for the whole run, applies the production migrations and sets DATABASE_URL. */
export function startDatabase() {
  started ??= (async () => {
    const postgres = await new PostgreSqlContainer("postgres:17").start();
    process.env.DATABASE_URL = postgres.getConnectionUri();
    await migrate(process.env.DATABASE_URL);
    return postgres;
  })();
  return started;
}

export async function resetDb() {
  await sql`truncate account, outbox cascade`;
}

/** For a test file that needs the database: start it once, and empty the tables before each test. */
export function useDatabase() {
  beforeAll(startDatabase, 120_000);
  beforeEach(resetDb);
}

afterAll(async () => {
  for (const stop of teardowns.reverse()) await stop();
  if (!started) return;
  await closeDb();
  await (await started).stop();
});
