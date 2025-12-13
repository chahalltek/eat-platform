import { afterEach, vi } from "vitest";

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
