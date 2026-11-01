import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { accountClosedTopic } from "../../src/account/account-events";
import { relayOutbox } from "../../src/messaging/relay-outbox";
import { serverDefinition } from "../../src/routes";
import { brokerWith, collectFrom } from "../support/broker";
import { resetDb, startDatabase } from "../support/containers";

describe("closed box: accounts", () => {
  let server: Bun.Server<undefined>;
  let broker: Awaited<ReturnType<typeof brokerWith>>;
  beforeAll(async () => {
    await startDatabase();
    broker = await brokerWith([accountClosedTopic]);
    server = Bun.serve({ ...serverDefinition, port: 0 });
  }, 180_000);
  afterAll(() => server.stop(true));
  beforeEach(() => resetDb());

  const call = (method: string, path: string, body?: object) =>
    fetch(new URL(path, server.url), { method, body: body && JSON.stringify(body) });

  it("closing an account tells the world once, however often the customer asks", async () => {
    const closed = await collectFrom(broker.brokers, accountClosedTopic);
    const { id } = (await (await call("POST", "/accounts", { name: "Ada" })).json()) as { id: string };

    await call("POST", `/accounts/${id}/close`);
    await call("POST", `/accounts/${id}/close`);
    const first = await relayOutbox(broker.producer);
    const later = await relayOutbox(broker.producer);

    expect(first.sent).toBe(1);
    expect(later.sent).toBe(0);
    const [message] = await closed.next(1, (m) => m.key === id);
    expect(JSON.parse(message!.value)).toMatchObject({ userId: id, messageId: `msg-${id}-closed` });
  });

  it("an account that is only opened tells nobody anything", async () => {
    await call("POST", "/accounts", { name: "Ada" });

    expect((await relayOutbox(broker.producer)).sent).toBe(0);
  });
});
