import type { Account } from "../../src/account/account";

let counter = 0;

export function anAccount(overrides: Partial<Account> = {}): Account {
  return { id: `usr-${++counter}`, name: "Ada", status: "open", openedAt: new Date("2026-10-01T00:00:00Z"), ...overrides };
}

export const aDbError = () => ({ code: "db-1" as const, message: "database error", details: "oops" });
