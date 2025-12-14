import http from "node:http";
import { AddressInfo } from "node:net";

export async function withListeningServer<T>(server: http.Server, run: (baseUrl: string) => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Test server did not start with an address");
    }

    const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
