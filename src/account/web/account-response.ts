import { AccountErrors, type Account, type AccountError } from "../account";

export const toResponse = (a: Account) => ({
  id: a.id,
  name: a.name,
  status: a.status,
  closedAt: a.closedAt?.toISOString() ?? null,
});

export const statusFor = (e: AccountError) =>
  ({
    [AccountErrors.NotFound.code]: 404,
    [AccountErrors.NameRequired.code]: 400,
    // the database is down, so the caller may try again later
    "db-1": 503,
  })[e.code] ?? 500;
