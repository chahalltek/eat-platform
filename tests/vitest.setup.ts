import { afterEach, vi } from "vitest";

// Ensure a safe, non-placeholder database URL during tests so Prisma never
// attempts to connect to the intentionally bogus fallback value.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/test";
}

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => {
  const cookiesApi = {
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value ? { name, value } : undefined;
    },
    getAll: () => Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
      return cookiesApi;
    },
    delete: (name: string) => cookieStore.delete(name),
    has: (name: string) => cookieStore.has(name),
  };

  return {
    headers: () => new Headers(),
    cookies: () => cookiesApi,
  };
});

afterEach(() => {
  cookieStore.clear();
});
