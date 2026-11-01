import { Admin, Producer, stringSerializers } from "@platformatic/kafka";
import { ResultAsync } from "neverthrow";

export type BusError = { code: "bus-1"; message: string; details: unknown };

export const toBusError = (details: unknown): BusError => ({ code: "bus-1", message: "message broker error", details });

/** The only code that knows which Kafka client is in use. */
export type MessageProducer = {
  send(topic: string, key: string | undefined, value: string): ResultAsync<void, BusError>;
  close(): Promise<void>;
};

export function messageProducer(brokers: string[]): MessageProducer {
  const producer = new Producer({ clientId: "accounts", bootstrapBrokers: brokers, serializers: stringSerializers });
  return {
    send: (topic, key, value) =>
      ResultAsync.fromPromise(producer.send({ messages: [{ topic, key, value }] }), toBusError).map(() => undefined),
    close: () => producer.close(),
  };
}

/** Creates the topics that do not exist yet; existing ones are left alone. */
export async function ensureTopics(brokers: string[], topics: string[]) {
  const admin = new Admin({ clientId: "accounts", bootstrapBrokers: brokers });
  try {
    const existing = new Set(await admin.listTopics());
    const missing = topics.filter((topic) => !existing.has(topic));
    if (missing.length > 0) await admin.createTopics({ topics: missing, partitions: 1, replicas: 1 });
  } finally {
    await admin.close();
  }
}
