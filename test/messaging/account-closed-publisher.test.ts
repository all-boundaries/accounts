import { beforeAll, describe, expect, it } from "bun:test";
import { accountClosedTopic } from "../../src/account/account-events";
import { closeAccount } from "../../src/account/close-account";
import { save } from "../../src/account/account-db";
import { relayOutbox } from "../../src/messaging/relay-outbox";
import { messageProducer } from "../../src/plumbing/kafka";
import { anAccount } from "../support/builders";
import { brokerWith, collectFrom } from "../support/broker";
import { useDatabase } from "../support/containers";

describe("messaging: account closed (real broker)", () => {
  useDatabase();
  let broker: Awaited<ReturnType<typeof brokerWith>>;
  beforeAll(async () => {
    broker = await brokerWith([accountClosedTopic]);
  }, 120_000);

  it("publishes AccountClosed keyed by the account, once", async () => {
    const received = await collectFrom(broker.brokers, accountClosedTopic);
    await save(anAccount({ id: "usr-1" }));
    await closeAccount("usr-1", new Date("2026-11-01T10:00:00Z"));

    expect((await relayOutbox(broker.producer)).sent).toBe(1);
    expect((await relayOutbox(broker.producer)).sent).toBe(0);

    const [message] = await received.next(1, (m) => m.key === "usr-1");
    expect(JSON.parse(message!.value)).toEqual({ messageId: "msg-usr-1-closed", userId: "usr-1", occurredAt: "2026-11-01T10:00:00.000Z" });
  });

  it("keeps the message queued when the broker is unreachable", async () => {
    await save(anAccount({ id: "usr-2" }));
    await closeAccount("usr-2", new Date("2026-11-01T10:00:00Z"));
    const unreachable = messageProducer(["127.0.0.1:1"]);

    expect(await relayOutbox(unreachable)).toEqual({ sent: 0, remaining: 1 });
    await unreachable.close();

    expect((await relayOutbox(broker.producer)).sent).toBe(1);
  }, 30_000);
});
