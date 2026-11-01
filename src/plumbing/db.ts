import { SQL } from "bun";
import { AsyncLocalStorage } from "node:async_hooks";
import { ResultAsync } from "neverthrow";
import { databaseUrl } from "./config";

let client: SQL | undefined;
const currentTransaction = new AsyncLocalStorage<SQL>();

export type DbError = { code: "db-1"; message: string; details: unknown };

export function toDbError(details: unknown): DbError {
  return { code: "db-1", message: "database error", details };
}

function connection(): SQL {
  client ??= new SQL(databaseUrl());
  return client;
}

/**
 * Tagged-template query helper. Connects on first use and joins the surrounding
 * transactionally() when there is one.
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return (currentTransaction.getStore() ?? connection())(strings, ...values);
}

class Rollback<E> extends Error {
  constructor(readonly error: E) {
    super("rollback");
  }
}

/**
 * Runs the work in one transaction that every sql`` call inside shares.
 * An error result rolls everything back and is returned unchanged; inside an
 * outer transaction the work simply joins it.
 */
export function transactionally<T, E>(work: () => ResultAsync<T, E>): ResultAsync<T, E | DbError> {
  if (currentTransaction.getStore()) return work();
  return ResultAsync.fromPromise(
    connection().begin((tx) =>
      currentTransaction.run(tx, async () => {
        const result = await work();
        if (result.isErr()) throw new Rollback(result.error);
        return result.value;
      }),
    ),
    (e): E | DbError => (e instanceof Rollback ? e.error : toDbError(e)),
  );
}

export async function closeDb() {
  await client?.close();
  client = undefined;
}
