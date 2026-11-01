import { describe, expect, it } from "bun:test";
import { AccountErrors } from "../../src/account/account";
import { findById, save } from "../../src/account/account-db";
import { anAccount } from "../support/builders";
import { useDatabase } from "../support/containers";

describe("db: account", () => {
  useDatabase();

  it("keeps every field through a round trip", async () => {
    const closed = anAccount({ id: "usr-1", status: "closed", closedAt: new Date("2026-11-01T10:15:30.123Z") });
    await save(closed);

    expect((await findById("usr-1"))._unsafeUnwrap()).toEqual(closed);
  });

  it("updates an existing account", async () => {
    await save(anAccount({ id: "usr-1" }));
    await save(anAccount({ id: "usr-1", status: "closed", closedAt: new Date("2026-11-01") }));

    expect((await findById("usr-1"))._unsafeUnwrap().status).toBe("closed");
  });

  it("returns not found for an unknown id", async () => {
    expect((await findById("usr-nope"))._unsafeUnwrapErr()).toEqual(AccountErrors.NotFound);
  });
});
