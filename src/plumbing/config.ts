import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3003),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
});

export const envConfig = envSchema.parse(process.env);

/** Read on use rather than at start-up so tests can point it at a container they start themselves. */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}
