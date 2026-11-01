import { describe, expect, it } from "bun:test";
import { AccountErrors, close, open } from "../../src/account/account";
import { accountClosedTopic, eventsFor, toAccountClosedMessage } from "../../src/account/account-events";
import { anAccount } from "../support/builders";

const at = new Date("2026-11-01T10:00:00Z");

describe("account", () => {
  it("opens with a trimmed name", () => {
    expect(open({ id: "usr-1", name: "  Ada ", now: at })._unsafeUnwrap()).toEqual({ id: "usr-1", name: "Ada", status: "open", openedAt: at });
  });

  it("refuses an empty name", () => {
    expect(open({ id: "usr-1", name: "   ", now: at })._unsafeUnwrapErr()).toEqual(AccountErrors.NameRequired);
  });

  it("closes an open account", () => {
    expect(close(anAccount(), at)).toMatchObject({ status: "closed", closedAt: at });
  });

  it("leaves a closed account as it was when closed again", () => {
    const closed = close(anAccount(), at);

    expect(close(closed, new Date("2027-01-01"))).toEqual(closed);
  });
});

describe("account events", () => {
  const open = anAccount({ id: "usr-1" });

  it("announces AccountClosed keyed by the account, with an id that depends only on the account", () => {
    const closed = close(open, at);

    const [event] = eventsFor(open, closed);

    expect(event).toMatchObject({ messageId: "msg-usr-1-closed", topic: accountClosedTopic, key: "usr-1" });
    expect(JSON.parse(event!.payload)).toEqual({ messageId: "msg-usr-1-closed", userId: "usr-1", occurredAt: "2026-11-01T10:00:00.000Z" });
  });

  it("keeps the AccountClosed shape its readers rely on", () => {
    expect(Object.keys(toAccountClosedMessage(close(open, at))).sort()).toEqual(["messageId", "occurredAt", "userId"]);
  });

  it("announces nothing when nothing closed", () => {
    const closed = close(open, at);

    expect(eventsFor(open, open)).toEqual([]);
    expect(eventsFor(closed, closed)).toEqual([]);
  });
});
