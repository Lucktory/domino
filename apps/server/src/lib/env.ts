import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().int().min(1).max(65535),
  /** Comma-separated origins allowed to open a socket (the web app's URLs). */
  WEB_ORIGINS: z
    .string()
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .pipe(z.array(z.url()).min(1)),
  /** Signs guest session tokens. At least 32 characters. */
  SESSION_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

/** Fails startup with every problem listed, instead of running half-configured. */
export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
