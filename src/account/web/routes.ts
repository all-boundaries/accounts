import type { BunRequest } from "bun";
import { z } from "zod";
import { json } from "../../plumbing/http";
import { closeAccount } from "../close-account";
import { findById } from "../account-db";
import { openAccount } from "../open-account";
import { statusFor, toResponse } from "./account-response";

const openRequest = z.object({ name: z.string() });

export async function openAccountRoute(req: BunRequest<"/accounts">) {
  const body = openRequest.safeParse(await req.json().catch(() => undefined));
  if (!body.success) return json({ code: "http-1", message: "invalid request" }, 400);

  return openAccount(body.data, new Date()).match(
    (account) => json(toResponse(account), 201),
    (error) => json(error, statusFor(error)),
  );
}

export async function getAccountRoute(req: BunRequest<"/accounts/:id">) {
  return findById(req.params.id).match(
    (account) => json(toResponse(account), 200),
    (error) => json(error, statusFor(error)),
  );
}

export async function closeAccountRoute(req: BunRequest<"/accounts/:id/close">) {
  return closeAccount(req.params.id, new Date()).match(
    (account) => json(toResponse(account), 200),
    (error) => json(error, statusFor(error)),
  );
}
