import { expect } from "vitest";

export type ApiErrorShape = {
  errorCode?: string;
  message?: string;
};

export async function expectApiError(
  response: Response,
  status: number,
  expected: ApiErrorShape = {},
) {
  const body = await response.json();

  expect(response.status).toBe(status);
  expect(body).toMatchObject({
    ...(expected.errorCode ? { errorCode: expected.errorCode } : {}),
    ...(expected.message ? { message: expected.message } : { message: expect.any(String) }),
  });

  return body;
}
