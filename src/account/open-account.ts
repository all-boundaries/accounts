import type { ResultAsync } from "neverthrow";
import type { DbError } from "../plumbing/db";
import { open, type Account, type AccountError } from "./account";
import { save } from "./account-db";

export function openAccount(
  request: { name: string },
  now: Date,
  newId: () => string = () => `usr-${crypto.randomUUID()}`,
): ResultAsync<Account, AccountError | DbError> {
  return open({ id: newId(), name: request.name, now }).asyncAndThen(save);
}
