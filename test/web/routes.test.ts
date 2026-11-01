import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from "bun:test";
import { errAsync } from "neverthrow";
import * as accountDb from "../../src/account/account-db";
import { serverDefinition } from "../../src/routes";
import { aDbError, anAccount } from "../support/builders";
import { useDatabase } from "../support/containers";

let server: Bun.Server<undefined>;
beforeAll(() => {
  server = Bun.serve({ ...serverDefinition, port: 0 });
});
afterAll(() => server.stop(true));
afterEach(() => mock.restore());

const call = (method: string, path: string, body?: unknown) =>
  fetch(new URL(path, server.url), { method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });

describe("http: accounts", () => {
  useDatabase();

  it("opens an account", async () => {
    const response = await call("POST", "/accounts", { name: "Ada" });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ name: "Ada", status: "open", closedAt: null });
  });

  it.each([
    ["a blank name", { name: " " }],
    ["a missing name", {}],
    ["a body that is not JSON", "not json"],
  ])("answers 400 for %s", async (_, body) => {
    expect((await call("POST", "/accounts", body)).status).toBe(400);
  });

  it("returns an account and 404 for an unknown one", async () => {
    await accountDb.save(anAccount({ id: "usr-1" }));

    expect((await call("GET", "/accounts/usr-1")).status).toBe(200);
    expect((await call("GET", "/accounts/usr-nope")).status).toBe(404);
  });

  it("closes an account, and closing it again is still 200", async () => {
    await accountDb.save(anAccount({ id: "usr-1" }));

    const first = await call("POST", "/accounts/usr-1/close");
    const second = await call("POST", "/accounts/usr-1/close");

    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ status: "closed" });
    expect(second.status).toBe(200);
  });

  it("answers 404 when closing an unknown account", async () => {
    expect((await call("POST", "/accounts/usr-nope/close")).status).toBe(404);
  });

  it("answers 503 when the database is down", async () => {
    spyOn(accountDb, "findById").mockReturnValueOnce(errAsync(aDbError()));

    expect((await call("GET", "/accounts/usr-1")).status).toBe(503);
  });
});
