import { SQL } from "bun";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "../../src/plumbing/migrate";
import { startDatabase } from "../support/containers";

describe("migrate", () => {
  let dir: string;
  let databaseName: string;
  let url: string;
  let db: SQL;
  let admin: SQL;

  beforeAll(startDatabase, 120_000);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "migrations-"));
    databaseName = `migrate_${crypto.randomUUID().replaceAll("-", "")}`;
    admin = new SQL(process.env.DATABASE_URL!);
    await admin.unsafe(`create database ${databaseName}`);
    const target = new URL(process.env.DATABASE_URL!);
    target.pathname = `/${databaseName}`;
    url = target.toString();
    db = new SQL(url);
  });

  afterEach(async () => {
    await db.close();
    await rm(dir, { recursive: true });
    await admin.unsafe(`drop database ${databaseName} with (force)`);
    await admin.close();
  });

  const migration = (file: string, script: string) => writeFile(join(dir, file), script);
  const appliedVersions = async () =>
    (await db`select version from schema_migrations order by version`).map((r: { version: number }) => r.version);

  it("applies migrations in numeric version order", async () => {
    await migration("V10__third.sql", "alter table t add column c int");
    await migration("V2__second.sql", "alter table t add column b int");
    await migration("V1__first.sql", "create table t (a int)");

    await migrate(url, dir);

    expect(await appliedVersions()).toEqual([1, 2, 10]);
  });

  it("applies each migration once", async () => {
    await migration("V1__first.sql", "create table t (a int)");

    await migrate(url, dir);
    await migrate(url, dir);

    expect(await appliedVersions()).toEqual([1]);
  });

  it("applies only the migrations added since the last run", async () => {
    await migration("V1__first.sql", "create table t (a int)");
    await migrate(url, dir);
    await migration("V2__second.sql", "alter table t add column b int");

    await migrate(url, dir);

    expect(await appliedVersions()).toEqual([1, 2]);
  });

  it("rolls back a failing migration and keeps the earlier ones", async () => {
    await migration("V1__first.sql", "create table t (a int)");
    await migration("V2__broken.sql", "create table u (a int); select * from table_that_does_not_exist");

    await expect(migrate(url, dir)).rejects.toThrow();

    expect(await appliedVersions()).toEqual([1]);
    expect(await db`select to_regclass('u') as found`).toEqual([{ found: null }]);
  });

  it("ignores files that are not versioned migrations", async () => {
    await migration("V1__first.sql", "create table t (a int)");
    await migration("README.md", "not sql");

    await migrate(url, dir);

    expect(await appliedVersions()).toEqual([1]);
  });
});
