import type {
  BullhornAuthTokens,
  BullhornCandidate,
  BullhornHttpAdapter,
  BullhornJob,
  BullhornPlacement,
} from './types';

export interface MockBullhornOptions {
  jobs?: BullhornJob[];
  candidates?: BullhornCandidate[];
  placements?: BullhornPlacement[];
  expiresInSeconds?: number;
}

export class MockBullhornApi {
  private readonly jobs: BullhornJob[];
  private readonly candidates: BullhornCandidate[];
  private readonly placements: BullhornPlacement[];
  private readonly expiresInSeconds: number;

  constructor(options: MockBullhornOptions = {}) {
    this.jobs = options.jobs ?? [];
    this.candidates = options.candidates ?? [];
    this.placements = options.placements ?? [];
    this.expiresInSeconds = options.expiresInSeconds ?? 600;
  }

  handler: BullhornHttpAdapter = async (url, init) => {
    const { pathname } = new URL(url);

    if (pathname.endsWith('/token')) {
      return this.buildTokenResponse();
    }

    if (!this.isAuthorized(init?.headers)) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    }

    if (pathname.endsWith('/jobs')) {
      return this.respond(this.jobs);
    }

    if (pathname.endsWith('/candidates')) {
      return this.respond(this.candidates);
    }

    if (pathname.endsWith('/placements')) {
      return this.respond(this.placements);
    }

    return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
  };

  private isAuthorized(headers?: HeadersInit): boolean {
    const token = this.extractAuthorization(headers);
    return token?.startsWith('mock-access') ?? false;
  }

  private extractAuthorization(headers?: HeadersInit): string | null {
    if (!headers) return null;
    const asRecord = headers as Record<string, string>;
    const raw = asRecord['Authorization'] || asRecord['authorization'];
    if (!raw) return null;
    return raw.startsWith('Bearer ') ? raw.slice('Bearer '.length) : raw;
  }

  private respond<T>(payload: T): Response {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private buildTokenResponse(): Response {
    const tokens: BullhornAuthTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + this.expiresInSeconds * 1000,
    };

    return this.respond({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: this.expiresInSeconds,
    });
  }
}
