import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGINS: z.string().default('*'),
  PUBLIC_BASE_URL: z.url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),

  /** Firebase project whose ID tokens are accepted. */
  FIREBASE_PROJECT_ID: z
    .string()
    .min(1)
    .refine(
      (v) => v !== 'your-firebase-project-id',
      'replace the placeholder from .env.example with your real Firebase project ID',
    ),
  /**
   * Service-account credentials. Optional: verifying ID tokens only needs the project id.
   * Needed to delete Firebase users on account deletion and to revoke sessions.
   * Alternatively set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file.
   */
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .optional()
    .transform((v) => v?.replace(/\\n/g, '\n')),
  /** Also reject tokens whose session was revoked. Costs a network call per verification. */
  FIREBASE_CHECK_REVOKED: bool,
  /**
   * Set (e.g. `127.0.0.1:9099`) to accept tokens from the Firebase Auth Emulator.
   * firebase-admin reads it straight from the environment; it is listed here so it is validated.
   */
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),

  FREE_CHAT_CAPACITY: z.coerce.number().int().positive().default(3),
  SIGNUP_BONUS_COINS: z.coerce.number().int().nonnegative().default(139),
  QUICK_MATCH_COST: z.coerce.number().int().nonnegative().default(50),
  QUICK_MATCH_DURATION_SECONDS: z.coerce.number().int().positive().default(300),
  AVATAR_PREMIUM_COST: z.coerce.number().int().nonnegative().default(50),

  ALLOW_TEST_PAYMENTS: bool,
  VERIFICATION_AUTO_APPROVE: bool,

  /** Signs admin portal session tokens (HS256). Use a long random string, e.g. `openssl rand -base64 48`. */
  ADMIN_JWT_SECRET: z.string().min(32).optional(),
  ADMIN_TOKEN_TTL_HOURS: z.coerce.number().positive().default(12),
});

export type Env = z.infer<typeof envSchema>;

/** Validates `process.env` once at boot and fails fast with every problem listed. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('FIREBASE_AUTH_EMULATOR_HOST must not be set in production');
    if (env.ALLOW_TEST_PAYMENTS) throw new Error('ALLOW_TEST_PAYMENTS must be false in production');
    if (env.VERIFICATION_AUTO_APPROVE) throw new Error('VERIFICATION_AUTO_APPROVE must be false in production');
    if (!env.ADMIN_JWT_SECRET) throw new Error('ADMIN_JWT_SECRET is required in production');
  }
  return env;
}
