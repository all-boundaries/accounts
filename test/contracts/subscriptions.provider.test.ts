import { Verifier } from "@pact-foundation/pact";
import { describe, it } from "bun:test";
import { close } from "../../src/account/account";
import { toAccountClosedMessage } from "../../src/account/account-events";
import { anAccount } from "../support/builders";

// Verifies the pacts consumers published to the broker; run with `mise run contracts:verify` once the broker is up.
const brokerUrl = process.env.PACT_BROKER_BASE_URL;
// The version is computed in one place, the contracts repository; the pipeline passes the result in PACT_VERSION.
const versionOf = (...flags: string[]) =>
  Bun.spawnSync(["bun", `${process.env.CONTRACTS_DIR ?? "../contracts"}/scripts/version.ts`, ...flags]).stdout.toString().trim();
const pactVersion = process.env.PACT_VERSION ?? versionOf();
const pactBranch = process.env.PACT_BRANCH ?? versionOf("--branch");
// Set when a consumer has just published a changed pact (the broker webhook): verify that one too, and fail loudly.
const triggeredBy = process.env.PACT_TRIGGER_CONSUMER;

describe.skipIf(!brokerUrl)("contracts: pacts consumers wrote about accounts", () => {
  it("sends the AccountClosed message Subscriptions reads", async () => {
    await new Verifier({
      provider: "accounts",
      pactBrokerUrl: brokerUrl,
      ...(process.env.PACT_BROKER_TOKEN ? { pactBrokerToken: process.env.PACT_BROKER_TOKEN } : {}),
      consumerVersionSelectors: [
        { mainBranch: true },
        { matchingBranch: true },
        { deployedOrReleased: true },
        ...(triggeredBy ? [{ consumer: triggeredBy, branch: process.env.PACT_TRIGGER_BRANCH }] : []),
      ],
      // A new expectation of a consumer must not break this service's own build; can-i-deploy holds the consumer back.
      enablePending: !triggeredBy,
      failIfNoPactsFound: false,
      publishVerificationResult: true,
      providerVersion: pactVersion,
      providerVersionBranch: pactBranch,
      stateHandlers: { "a customer closed their account": async () => undefined },
      messageProviders: {
        "an AccountClosed message": async () =>
          toAccountClosedMessage(close(anAccount({ id: "usr-1" }), new Date("2026-11-01T10:00:00.000Z"))),
      },
    }).verifyProvider();
  }, 60_000);
});
