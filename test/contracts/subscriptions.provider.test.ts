import { Verifier } from "@pact-foundation/pact";
import { describe, it } from "bun:test";
import { close } from "../../src/account/account";
import { toAccountClosedMessage } from "../../src/account/account-events";
import { anAccount } from "../support/builders";

// Verifies the pacts consumers published to the broker; run with `mise run contracts:verify` once the broker is up.
const brokerUrl = process.env.PACT_BROKER_BASE_URL;
const gitSha = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"]).stdout.toString().trim();
const gitBranch = Bun.spawnSync(["git", "branch", "--show-current"]).stdout.toString().trim();

describe.skipIf(!brokerUrl)("contracts: pacts consumers wrote about accounts", () => {
  it("sends the AccountClosed message Subscriptions reads", async () => {
    await new Verifier({
      provider: "accounts",
      pactBrokerUrl: brokerUrl,
      consumerVersionSelectors: [{ mainBranch: true }, { deployedOrReleased: true }],
      publishVerificationResult: true,
      providerVersion: gitSha,
      providerVersionBranch: gitBranch,
      stateHandlers: { "a customer closed their account": async () => undefined },
      messageProviders: {
        "an AccountClosed message": async () =>
          toAccountClosedMessage(close(anAccount({ id: "usr-1" }), new Date("2026-11-01T10:00:00.000Z"))),
      },
    }).verifyProvider();
  }, 60_000);
});
