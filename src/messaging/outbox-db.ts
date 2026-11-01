import { ResultAsync } from "neverthrow";
import { sql, toDbError, type DbError } from "../plumbing/db";
export type OutboxMessage = { messageId: string; topic: string; key: string; payload: string };

/** Queues the messages once per message id; queuing the same message again does nothing. */
export function enqueue(messages: OutboxMessage[]): ResultAsync<void, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      for (const m of messages) {
        await sql`insert into outbox (message_id, topic, key, payload)
                  values (${m.messageId}, ${m.topic}, ${m.key}, ${m.payload}) on conflict (message_id) do nothing`;
      }
    })(),
    toDbError,
  );
}

export function findUnsent(limit = 100): ResultAsync<Array<OutboxMessage>, DbError> {
  return ResultAsync.fromPromise(
    sql`select message_id, topic, key, payload from outbox where sent_at is null order by created_at, message_id limit ${limit}`,
    toDbError,
  ).map((rows) =>
    (rows as Array<{ message_id: string; topic: string; key: string; payload: string }>).map((r) => ({
      messageId: r.message_id,
      topic: r.topic,
      key: r.key,
      payload: r.payload,
    })),
  );
}

export function markSent(messageId: string): ResultAsync<void, DbError> {
  return ResultAsync.fromPromise(sql`update outbox set sent_at = now() where message_id = ${messageId}`, toDbError).map(() => undefined);
}
