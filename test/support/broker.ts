import { RedpandaContainer } from "@testcontainers/redpanda";
import { Consumer, stringDeserializers } from "@platformatic/kafka";
import { ensureTopics, messageProducer } from "../../src/plumbing/kafka";
import { stopAtEnd } from "./containers";

let started: Promise<string> | undefined;

/** Starts one Redpanda (a single Kafka-compatible binary, no JVM or ZooKeeper) for the whole run. */
export function startBroker(): Promise<string> {
  started ??= (async () => {
    const redpanda = await new RedpandaContainer("docker.redpanda.com/redpandadata/redpanda:v26.2.6").start();
    stopAtEnd(() => redpanda.stop());
    return redpanda.getBootstrapServers();
  })();
  return started;
}

/** A broker with the topics already created, a producer for the test to send with, and a way to read a topic back. */
export async function brokerWith(topics: string[]) {
  const brokers = [await startBroker()];
  await ensureTopics(brokers, topics);
  const producer = messageProducer(brokers);
  stopAtEnd(() => producer.close());
  return { brokers, producer };
}

export type Received = { key: string | undefined; value: string };

/** Reads a topic from its start with a group of its own; next(n) waits for n more messages. */
export async function collectFrom(brokers: string[], topic: string, timeoutMs = 15_000) {
  const consumer = new Consumer({
    clientId: "test",
    groupId: `test-${crypto.randomUUID()}`,
    bootstrapBrokers: brokers,
    deserializers: stringDeserializers,
  });
  const stream = await consumer.consume({ topics: [topic], mode: "earliest", autocommit: true });
  const iterator = stream[Symbol.asyncIterator]();
  stopAtEnd(async () => {
    await stream.close();
    await consumer.close();
  });

  return {
    /** The next `count` messages that satisfy `wanted`; earlier tests' messages on the topic can be skipped this way. */
    async next(count: number, wanted: (m: Received) => boolean = () => true): Promise<Received[]> {
      const received: Received[] = [];
      const deadline = Date.now() + timeoutMs;
      while (received.length < count) {
        const left = deadline - Date.now();
        const result = await Promise.race([
          iterator.next(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out waiting for ${count} message(s) on ${topic}, got ${received.length}`)), Math.max(left, 1))),
        ]);
        if (result.done) break;
        const message = { key: result.value.key, value: result.value.value };
        if (wanted(message)) received.push(message);
      }
      return received;
    },
  };
}

/** Polls until the assertion stops throwing. */
export async function eventually(assertion: () => Promise<void>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await assertion();
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await Bun.sleep(100);
    }
  }
}
