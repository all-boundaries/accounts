import type { OutboxMessage } from "../messaging/outbox-db";
import type { Account } from "./account";

export const accountClosedTopic = "accounts.account-closed";

/** Other teams read this shape, so a change here is a change to a public interface. */
export type AccountClosedMessage = { messageId: string; userId: string; occurredAt: string };

export const toAccountClosedMessage = (account: Account): AccountClosedMessage => ({
  messageId: `msg-${account.id}-closed`,
  userId: account.id,
  occurredAt: (account.closedAt ?? new Date(0)).toISOString(),
});

/** The message a change announces, decided from the before and after states alone. */
export function eventsFor(before: Account, after: Account): OutboxMessage[] {
  if (before.status !== "open" || after.status !== "closed") return [];
  const message = toAccountClosedMessage(after);
  return [{ messageId: message.messageId, topic: accountClosedTopic, key: after.id, payload: JSON.stringify(message) }];
}
