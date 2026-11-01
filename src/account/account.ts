import { err, ok, type Result } from "neverthrow";

export type Account = Readonly<{
  id: string;
  name: string;
  status: "open" | "closed";
  openedAt: Date;
  closedAt?: Date;
}>;

export type AccountError = { code: string; message: string };

export const AccountErrors = {
  NotFound: { code: "acc-1", message: "account not found" },
  NameRequired: { code: "acc-2", message: "an account needs a name" },
} satisfies Record<string, AccountError>;

export function open(input: { id: string; name: string; now: Date }): Result<Account, AccountError> {
  const name = input.name.trim();
  return name ? ok({ id: input.id, name, status: "open", openedAt: input.now }) : err(AccountErrors.NameRequired);
}

/** Closing a closed account changes nothing, so asking twice is safe. */
export function close(account: Account, at: Date): Account {
  return account.status === "closed" ? account : { ...account, status: "closed", closedAt: at };
}
