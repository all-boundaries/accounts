import { err, ok, ResultAsync, type Result } from "neverthrow";
import { sql, toDbError, type DbError } from "../plumbing/db";
import { AccountErrors, type Account, type AccountError } from "./account";

type AccountRow = { id: string; name: string; status: Account["status"]; opened_at: Date; closed_at: Date | null };

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  status: row.status,
  openedAt: row.opened_at,
  ...(row.closed_at ? { closedAt: row.closed_at } : {}),
});

function one(rows: unknown): Result<Account, AccountError> {
  const row = (rows as AccountRow[])[0];
  return row ? ok(toAccount(row)) : err(AccountErrors.NotFound);
}

export function findById(id: string): ResultAsync<Account, AccountError | DbError> {
  return ResultAsync.fromPromise(sql`select * from account where id = ${id}`, toDbError).andThen(one);
}

/** Locks the row until the surrounding transaction ends, so two closings of one account queue up. */
export function findByIdForUpdate(id: string): ResultAsync<Account, AccountError | DbError> {
  return ResultAsync.fromPromise(sql`select * from account where id = ${id} for update`, toDbError).andThen(one);
}

export function save(a: Account): ResultAsync<Account, DbError> {
  return ResultAsync.fromPromise(
    sql`insert into account (id, name, status, opened_at, closed_at)
        values (${a.id}, ${a.name}, ${a.status}, ${a.openedAt}, ${a.closedAt ?? null})
        on conflict (id) do update set name = excluded.name, status = excluded.status, closed_at = excluded.closed_at`,
    toDbError,
  ).map(() => a);
}
