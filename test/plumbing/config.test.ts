import { afterEach, describe, expect, it } from "bun:test";
import { databaseUrl } from "../../src/plumbing/config";

describe("config: database url", () => {
  const original = process.env.DATABASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it("returns the configured url", () => {
    process.env.DATABASE_URL = "postgres://example/db";
    expect(databaseUrl()).toBe("postgres://example/db");
  });

  it("fails loudly when it is not set", () => {
    delete process.env.DATABASE_URL;
    expect(() => databaseUrl()).toThrow("DATABASE_URL is not set");
  });
});
