import type {
  PullResponse,
  PushResponse,
  TimeRecordPayload,
} from "@time-manger/shared";
import { getAccessToken, getOrCreateDeviceId } from "../storage/authStore";

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const [token, deviceId] = await Promise.all([
      getAccessToken(),
      getOrCreateDeviceId(),
    ]);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Device-Id": deviceId,
      ...(options.headers as Record<string, string>),
    };
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: { message?: string } }).error?.message ?? res.statusText;
      throw new Error(`API ${res.status}: ${msg}`);
    }
    return res.json() as Promise<T>;
  }

  async login(
    email: string,
    password: string
  ): Promise<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }> {
    const deviceId = await getOrCreateDeviceId();
    return this.request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: { "X-Device-Id": deviceId },
    });
  }

  async me(): Promise<{ user: { id: string; email: string } }> {
    return this.request("/api/v1/auth/me");
  }

  async logout(refreshToken: string): Promise<void> {
    const deviceId = await getOrCreateDeviceId();
    await this.request("/api/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      headers: { "X-Device-Id": deviceId },
    });
  }

  async pull(
    resource: string,
    since: string | null,
    cursor: string | null
  ): Promise<PullResponse> {
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    if (cursor) params.set("cursor", cursor);
    const qs = params.toString();
    return this.request(`/api/v1/sync/${resource}${qs ? `?${qs}` : ""}`);
  }

  async push(
    resource: string,
    deviceId: string,
    records: unknown[]
  ): Promise<PushResponse> {
    return this.request(`/api/v1/sync/${resource}`, {
      method: "POST",
      body: JSON.stringify({ deviceId, records }),
    });
  }

  async pullTimeRecords(since: string | null): Promise<TimeRecordPayload[]> {
    let cursor: string | null = null;
    const all: TimeRecordPayload[] = [];
    for (;;) {
      const page = await this.pull("time-records", since, cursor);
      all.push(...(page.records as TimeRecordPayload[]));
      if (!page.hasMore) break;
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    return all;
  }
}
