import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { errAsync } from "neverthrow";
import { AccountErrors } from "../../src/account/account";
import * as accountDb from "../../src/account/account-db";
import { closeAccount } from "../../src/account/close-account";
import { openAccount } from "../../src/account/open-account";
import * as outbox from "../../src/messaging/outbox-db";
import { aDbError, anAccount } from "../support/builders";
import { useDatabase } from "../support/containers";

const at = new Date("2026-11-01T10:00:00Z");
const queued = async () => (await outbox.findUnsent())._unsafeUnwrap().map((m) => m.messageId);

describe("use cases: account", () => {
  useDatabase();
  afterEach(() => mock.restore());

  it("opens an account", async () => {
    const result = await openAccount({ name: "Ada" }, at, () => "usr-1");

    expect(result._unsafeUnwrap()).toMatchObject({ id: "usr-1", status: "open" });
    expect((await accountDb.findById("usr-1"))._unsafeUnwrap().name).toBe("Ada");
  });

  it("refuses to open an account without a name and stores nothing", async () => {
    expect((await openAccount({ name: " " }, at, () => "usr-1"))._unsafeUnwrapErr()).toEqual(AccountErrors.NameRequired);
    expect((await accountDb.findById("usr-1"))._unsafeUnwrapErr()).toEqual(AccountErrors.NotFound);
  });

  it("closes the account and queues AccountClosed together", async () => {
    await accountDb.save(anAccount({ id: "usr-1" }));

    await closeAccount("usr-1", at);

    expect((await accountDb.findById("usr-1"))._unsafeUnwrap()).toMatchObject({ status: "closed", closedAt: at });
    expect(await queued()).toEqual(["msg-usr-1-closed"]);
  });

  it("queues one AccountClosed however often, or however many times together, the account is closed", async () => {
    await accountDb.save(anAccount({ id: "usr-1" }));

    await Promise.all([closeAccount("usr-1", at), closeAccount("usr-1", at), closeAccount("usr-1", new Date("2026-11-02"))]);
    await closeAccount("usr-1", new Date("2026-11-03"));

    expect(await queued()).toEqual(["msg-usr-1-closed"]);
    expect((await accountDb.findById("usr-1"))._unsafeUnwrap().closedAt).toBeDefined();
  });

  it("returns not found for an unknown account", async () => {
    expect((await closeAccount("usr-nope", at))._unsafeUnwrapErr()).toEqual(AccountErrors.NotFound);
  });

  it("queues nothing when the account cannot be stored", async () => {
    await accountDb.save(anAccount({ id: "usr-1" }));
    spyOn(accountDb, "save").mockReturnValueOnce(errAsync(aDbError()));

    expect((await closeAccount("usr-1", at))._unsafeUnwrapErr()).toMatchObject({ code: "db-1" });
    expect(await queued()).toEqual([]);
  });

  it("leaves the account open when the announcement cannot be queued", async () => {
    await accountDb.save(anAccount({ id: "usr-1" }));
    spyOn(outbox, "enqueue").mockReturnValueOnce(errAsync(aDbError()));

    expect((await closeAccount("usr-1", at))._unsafeUnwrapErr()).toMatchObject({ code: "db-1" });
    expect((await accountDb.findById("usr-1"))._unsafeUnwrap().status).toBe("open");
  });
});
