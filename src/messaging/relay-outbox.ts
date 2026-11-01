import type { MessageProducer } from "../plumbing/kafka";
import { findUnsent, markSent } from "./outbox-db";

/**
 * Publishes what the use cases queued, oldest first, and stops at the first failure so order is kept.
 * A crash between sending and marking sends the message again, so readers must tolerate repeats;
 * every message carries an id for that.
 */
export async function relayOutbox(producer: MessageProducer) {
  const unsent = (await findUnsent()).unwrapOr([]);
  let sent = 0;
  for (const message of unsent) {
    if ((await producer.send(message.topic, message.key, message.payload)).isErr()) break;
    await markSent(message.messageId);
    sent++;
  }
  return { sent, remaining: unsent.length - sent };
}
