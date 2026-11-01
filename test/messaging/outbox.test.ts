import { describe, expect, it } from "bun:test";
import { errAsync, okAsync } from "neverthrow";
import type { MessageProducer } from "../../src/plumbing/kafka";
import { enqueue, findUnsent } from "../../src/messaging/outbox-db";
import { relayOutbox } from "../../src/messaging/relay-outbox";
import { useDatabase } from "../support/containers";

const message = (n: number) => ({ messageId: `msg-${n}`, topic: "t", key: `k${n}`, payload: `{"n":${n}}` });

const recording = (failOn?: string) => {
  const sent: string[] = [];
  const producer: MessageProducer = {
    send: (_topic, key) => (key === failOn ? errAsync({ code: "bus-1", message: "broker error", details: "down" }) : (sent.push(key!), okAsync(undefined))),
    close: async () => undefined,
  };
  return { producer, sent };
};

describe("outbox", () => {
  useDatabase();

  it("queues a message once per id", async () => {
    await enqueue([message(1)]);
    await enqueue([message(1), message(2)]);

    expect((await findUnsent())._unsafeUnwrap().map((m) => m.messageId)).toEqual(["msg-1", "msg-2"]);
  });

  it("publishes what is queued, once, in the order it was queued", async () => {
    await enqueue([message(1), message(2), message(3)]);
    const { producer, sent } = recording();

    expect(await relayOutbox(producer)).toEqual({ sent: 3, remaining: 0 });
    expect(await relayOutbox(producer)).toEqual({ sent: 0, remaining: 0 });

    expect(sent).toEqual(["k1", "k2", "k3"]);
  });

  it("stops at the first failure so order is kept, and sends the rest next time", async () => {
    await enqueue([message(1), message(2), message(3)]);

    const failing = recording("k2");
    expect(await relayOutbox(failing.producer)).toEqual({ sent: 1, remaining: 2 });
    expect(failing.sent).toEqual(["k1"]);

    const recovered = recording();
    expect(await relayOutbox(recovered.producer)).toEqual({ sent: 2, remaining: 0 });
    expect(recovered.sent).toEqual(["k2", "k3"]);
  });

  it("does nothing when nothing is queued", async () => {
    expect(await relayOutbox(recording().producer)).toEqual({ sent: 0, remaining: 0 });
  });
});
