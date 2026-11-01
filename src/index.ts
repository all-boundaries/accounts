import { accountClosedTopic } from "./account/account-events";
import { relayOutbox } from "./messaging/relay-outbox";
import { databaseUrl, envConfig } from "./plumbing/config";
import { ensureTopics, messageProducer } from "./plumbing/kafka";
import { migrate } from "./plumbing/migrate";
import { serverDefinition } from "./routes";

const brokers = envConfig.KAFKA_BROKERS.split(",");
const producer = messageProducer(brokers);

await migrate(databaseUrl());
await ensureTopics(brokers, [accountClosedTopic]);

const server = Bun.serve(serverDefinition);
setInterval(() => void relayOutbox(producer).catch((error) => console.error("publishing events failed", error)), 1_000);

console.log(`accounts listening on ${server.url}`);
