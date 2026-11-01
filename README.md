# accounts

Core service for users and account closure. Companion code for the patterns on https://allboundaries.net.
Deliberately thin: it exists to be the provider of the `AccountClosed` message Subscriptions reads.

```sh
mise install && bun install
mise run test             # needs a Docker daemon; Testcontainers starts PostgreSQL and Redpanda
mise run check            # tsc
mise run contracts:verify # verify the pacts consumers published (start the broker: contracts repo, mise run up)
```

- `POST /accounts { name }`, `GET /accounts/:id`, `POST /accounts/:id/close`. Closing an account twice is safe.
- Closing stores the new state and queues `AccountClosed` (topic `accounts.account-closed`, keyed by account id) in one
  transaction; a relay publishes it. The message id depends only on the account, so repeats are recognisable.

| Boundary | Code | Test |
|---|---|---|
| Domain | `src/account/account.ts`, `account-events.ts` | `test/account/account.test.ts` (no Docker) |
| Persistence | `account-db.ts`, `db/migrations` | `account-db.test.ts`, `plumbing/migrate.test.ts` |
| Use cases | `open-account.ts`, `close-account.ts` | `test/account/use-cases.test.ts` |
| Inbound HTTP | `src/account/web/*`, `src/routes.ts` | `test/web/routes.test.ts` |
| Outbox and messaging | `src/messaging/*` | `outbox.test.ts`, `account-closed-publisher.test.ts` (real Redpanda) |
| Contracts | | `test/contracts/subscriptions.provider.test.ts` |
| Closed box | | `test/closed-box/account.test.ts` |

Not built yet: authentication, profile changes, and `can-i-deploy` in CI.
