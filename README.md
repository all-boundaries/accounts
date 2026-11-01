# accounts

Core service for users and account closure. Companion code for the patterns on https://allboundaries.net.
Deliberately thin: it exists to be the provider of the `AccountClosed` message Subscriptions reads.

```sh
mise install && bun install
mise run test             # needs a Docker daemon; Testcontainers starts PostgreSQL and Redpanda
mise run check            # tsc
mise run contracts:verify # verify the pacts consumers published (start the broker: contracts repo, mise run up)
mise run ci               # a branch build as GitHub runs it: test, verify (local broker)
mise run ci:main          # a push to main: test, tag, verify, staging; add -- --promote for production
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

Not built yet: authentication, profile changes.

## Releases and the pipeline

Every push to `main` is released as a git tag `vX.Y.Z` (patch by default; a `Bump: minor` or `Bump: major` trailer in
a commit message since the previous tag raises it), and the Pact Broker knows the build as `X.Y.Z+<sha>`. The tag
message is the changelog, including the contract changes. `.github/workflows/ci.yml` calls the shared pipeline in the
`contracts` repository; `mise run ci` (a branch build) and `mise run ci:main` (a push to main, through staging; add
`-- --promote` to continue to production) run the same scripts against the local broker (`mise run up` in `contracts`).
See the `contracts` README for versions, environments and the local simulation.
