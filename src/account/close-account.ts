import type { ResultAsync } from "neverthrow";
import { enqueue } from "../messaging/outbox-db";
import { transactionally, type DbError } from "../plumbing/db";
import { close, type Account, type AccountError } from "./account";
import { eventsFor } from "./account-events";
import { findByIdForUpdate, save } from "./account-db";

/** Closes the account and queues AccountClosed in the same transaction; a second closing queues nothing. */
export function closeAccount(id: string, at: Date): ResultAsync<Account, AccountError | DbError> {
  return transactionally(() =>
    findByIdForUpdate(id).andThen((account) => {
      const closed = close(account, at);
      return save(closed).andThen((saved) => enqueue(eventsFor(account, saved)).map(() => saved));
    }),
  );
}
