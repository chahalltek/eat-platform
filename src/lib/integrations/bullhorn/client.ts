import { defaultMappingConfig, mapBullhornCandidate, mapBullhornJob, mapBullhornPlacement } from './mappings';
import type {
  BullhornAuthTokens,
  BullhornHttpAdapter,
  BullhornJob,
  BullhornCandidate,
  BullhornPlacement,
  MappedCandidate,
  MappedJob,
  MappedPlacement,
  BullhornMappingConfig,
} from './types';

const DEFAULT_BASE_URL = 'https://rest.bullhornstaffing.com/mock';
const DEFAULT_AUTH_URL = 'https://auth.bullhornstaffing.com/oauth';

export interface BullhornClientOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl?: string;
  authBaseUrl?: string;
  httpClient?: BullhornHttpAdapter;
  tokens?: BullhornAuthTokens;
  testMode?: boolean;
  mapping?: BullhornMappingConfig;
}

export class BullhornClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly baseUrl: string;
  private readonly authBaseUrl: string;
  private tokens?: BullhornAuthTokens;
  private readonly httpClient: BullhornHttpAdapter;
  private readonly mapping: BullhornMappingConfig;
  private readonly testMode: boolean;

  constructor(options: BullhornClientOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.authBaseUrl = options.authBaseUrl ?? DEFAULT_AUTH_URL;
    this.tokens = options.tokens;
    this.httpClient = options.httpClient ?? ((url, init) => fetch(url, init));
    this.mapping = options.mapping ?? defaultMappingConfig;
    this.testMode = options.testMode ?? false;
  }

  buildAuthUrl(scope = 'read'): string {
    const url = new URL(`${this.authBaseUrl}/authorize`);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('scope', scope);
    if (this.testMode) {
      url.searchParams.set('mode', 'test');
    }
    return url.toString();
  }

  async exchangeCodeForToken(code: string): Promise<BullhornAuthTokens> {
    const url = `${this.authBaseUrl}/token`;
    const response = await this.httpClient(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const tokens: BullhornAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    this.tokens = tokens;
    return tokens;
  }

  async refreshAccessToken(): Promise<BullhornAuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const url = `${this.authBaseUrl}/token`;
    const response = await this.httpClient(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const tokens: BullhornAuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    this.tokens = tokens;
    return tokens;
  }

  async getJobs(): Promise<MappedJob[]> {
    const raw = await this.get<BullhornJob[]>('/jobs');
    return raw.map((job) => mapBullhornJob(job, this.mapping.job));
  }

  async getCandidates(): Promise<MappedCandidate[]> {
    const raw = await this.get<BullhornCandidate[]>('/candidates');
    return raw.map((candidate) => mapBullhornCandidate(candidate, this.mapping.candidate));
  }

  async getPlacements(): Promise<MappedPlacement[]> {
    const raw = await this.get<BullhornPlacement[]>('/placements');
    return raw.map((placement) => mapBullhornPlacement(placement, this.mapping.placement));
  }

  private async get<T>(path: string): Promise<T> {
    if (!this.tokens || this.tokens.expiresAt <= Date.now()) {
      await this.refreshAccessToken();
    }

    const response = await this.httpClient(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.tokens?.accessToken ?? 'invalid'}`,
      },
    });

    if (response.status === 401 && this.tokens?.refreshToken) {
      await this.refreshAccessToken();
      return this.get<T>(path);
    }

    if (!response.ok) {
      throw new Error(`Bullhorn request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
