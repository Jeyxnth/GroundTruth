import { z } from "zod";

/** Parse a base64 service-account key and make sure it has the fields EE needs. */
export function decodeServiceAccountKey(b64: string): ServiceAccountKey {
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    throw new Error(
      "GEE_SERVICE_ACCOUNT_KEY_B64 is not valid base64-encoded JSON.",
    );
  }
  const parsed = serviceAccountKeySchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      "GEE_SERVICE_ACCOUNT_KEY_B64 decoded, but is missing client_email or private_key (is it a service account key file?).",
    );
  }
  return parsed.data;
}

const serviceAccountKeySchema = z.looseObject({
  client_email: z.string().min(1),
  private_key: z.string().min(1),
  project_id: z.string().optional(),
});
export type ServiceAccountKey = z.infer<typeof serviceAccountKeySchema>;

const optionalStr = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const monthSchema = z.coerce.number().int().min(1).max(12);

const envSchema = z.object({
  GEE_SERVICE_ACCOUNT_KEY_B64: optionalStr,
  GEE_PROJECT_ID: optionalStr,
  GEE_CLASSIFIER_ASSET: optionalStr,
  ANTHROPIC_API_KEY: optionalStr,
  ANTHROPIC_MODEL: optionalStr,
  NOMINATIM_CONTACT: optionalStr,
  ZONE_RADIUS_M: z.coerce.number().min(50).max(500).default(150),
  SEASON_START_MONTH: monthSchema.default(1),
  SEASON_END_MONTH: monthSchema.default(3),
});
export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  // Empty strings (as in a copied .env.example) behave like unset.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== ""),
  );
  return envSchema.parse(cleaned);
}

let cached: Env | undefined;
/** Server-side env, validated once per instance. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Names of required EE variables that are missing. Empty array = configured. */
export function missingEeEnv(env: Env = getEnv()): string[] {
  const missing: string[] = [];
  if (!env.GEE_SERVICE_ACCOUNT_KEY_B64) missing.push("GEE_SERVICE_ACCOUNT_KEY_B64");
  if (!env.GEE_PROJECT_ID) missing.push("GEE_PROJECT_ID");
  return missing;
}
