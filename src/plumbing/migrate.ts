import { SQL } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dir, "../../db/migrations");

/** Applies every db/migrations/V<n>__*.sql not yet recorded, in version order, one transaction each. */
export async function migrate(databaseUrl: string, dir = MIGRATIONS_DIR) {
  const db = new SQL(databaseUrl);
  try {
    await db`create table if not exists schema_migrations (
      version    integer primary key,
      applied_at timestamptz not null default now()
    )`;
    const applied = new Set((await db`select version from schema_migrations`).map((r: { version: number }) => r.version));
    const files = (await readdir(dir))
      .map((name) => ({ name, version: Number(/^V(\d+)__.+\.sql$/.exec(name)?.[1]) }))
      .filter((f) => Number.isInteger(f.version))
      .sort((a, b) => a.version - b.version);

    for (const { name, version } of files) {
      if (applied.has(version)) continue;
      const script = await Bun.file(join(dir, name)).text();
      await db.begin(async (tx) => {
        await tx.unsafe(script);
        await tx`insert into schema_migrations (version) values (${version})`;
      });
    }
  } finally {
    await db.close();
  }
}
