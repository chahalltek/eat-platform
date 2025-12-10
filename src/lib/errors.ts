import { Prisma } from '@prisma/client';

export type ErrorCategory = "AI" | "DATA" | "AUTH";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly userMessage?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AIFailureError extends AppError {
  constructor(message: string, userMessage = "The AI service had trouble completing this request.") {
    super(message, "AI", userMessage);
  }
}

export class DataFailureError extends AppError {
  constructor(message: string, userMessage = "We hit a data issue while handling this request.") {
    super(message, "DATA", userMessage);
  }
}

export class AuthFailureError extends AppError {
  constructor(message: string, userMessage = "You do not have permission to perform this action.") {
    super(message, "AUTH", userMessage);
  }
}

type NormalizedError = {
  category: ErrorCategory;
  logMessage: string;
  userMessage: string;
};

export function normalizeError(error: unknown): NormalizedError {
  const logMessage = error instanceof Error ? error.message : "Unknown error";

  if (error instanceof AppError) {
    return {
      category: error.category,
      logMessage,
      userMessage: error.userMessage ?? logMessage,
    };
  }

  // Prisma errors indicate data persistence or schema problems.
  const prismaErrorCtors = [
    Prisma?.PrismaClientKnownRequestError,
    Prisma?.PrismaClientInitializationError,
    Prisma?.PrismaClientRustPanicError,
  ].filter((ctor): ctor is new (...args: unknown[]) => Error => typeof ctor === "function");

  if (prismaErrorCtors.some((ctor) => error instanceof ctor)) {
    return {
      category: "DATA",
      logMessage,
      userMessage: "A data layer error prevented this run from finishing.",
    };
  }

  // Default to AI for unexpected runtime or model behaviour failures.
  return {
    category: "AI",
    logMessage,
    userMessage: logMessage,
  };
}
