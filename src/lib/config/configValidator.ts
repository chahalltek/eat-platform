import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"], {
    required_error: "NODE_ENV must be set",
  }),
  APP_ENV: z
    .enum(["development", "staging", "production"], {
      required_error: "APP_ENV must be set to development, staging, or production",
    })
    .default("development"),
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .min(1, "DATABASE_URL is required")
    .regex(/^postgres(ql)?:\/\//i, "DATABASE_URL must be a PostgreSQL connection string"),
  SSO_ISSUER_URL: z.string().url().optional(),
  SSO_CLIENT_ID: z.string().min(1).optional(),
  SSO_CLIENT_SECRET: z.string().min(1).optional(),
  BILLING_PROVIDER_SECRET_KEY: z.string().min(1).optional(),
  BILLING_WEBHOOK_SECRET: z.string().min(1).optional(),
  TENANT_MODE: z.enum(["single", "multi"]).optional(),
});

const ConfigSchema = EnvSchema.superRefine((value, ctx) => {
  if (value.APP_ENV === "production") {
    const missingSso = ["SSO_ISSUER_URL", "SSO_CLIENT_ID", "SSO_CLIENT_SECRET"].filter(
      (key) => !value[key as keyof typeof value],
    );

    missingSso.forEach((key) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production to enable SSO`,
      });
    });

    const missingBilling = ["BILLING_PROVIDER_SECRET_KEY", "BILLING_WEBHOOK_SECRET"].filter(
      (key) => !value[key as keyof typeof value],
    );

    missingBilling.forEach((key) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required in production for billing safeguards`,
      });
    });

    if (!value.TENANT_MODE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TENANT_MODE"],
        message: "TENANT_MODE must be explicitly set to 'single' or 'multi' in production",
      });
    }

    if (value.NODE_ENV !== "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NODE_ENV"],
        message: "NODE_ENV must be 'production' when APP_ENV is production",
      });
    }

    if (/localhost|127\.0\.0\.1/.test(value.DATABASE_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DATABASE_URL"],
        message: "Production deployments must not point to localhost databases",
      });
    }
  }
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function formatConfigErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const field = issue.path.join(".") || "environment";
      return `${field}: ${issue.message}`;
    })
    .join("; ");
}

export function validateConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = ConfigSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${formatConfigErrors(parsed.error)}`);
  }

  return parsed.data;
}

let cachedConfig: AppConfig | null = null;

export function getAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env !== process.env) {
    return validateConfig(env);
  }

  if (!cachedConfig) {
    cachedConfig = validateConfig(env);
  }

  return cachedConfig;
}
