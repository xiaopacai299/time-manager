import type { DiaryPayload, TimeRecordPayload, WorklistItemPayload } from "@time-manger/shared";
import {
  getAccessToken,
  getOrCreateDeviceId,
  getRefreshToken,
  saveAccessToken,
} from "../storage/authStore";

function normalizeApiBase(raw: string): string {
  let b = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(b)) b = `http://${b}`;
  return b;
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = normalizeApiBase(baseUrl);
  }

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
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
      });
    } catch (e) {
      const hint =
        "无法连接服务器。请检查：①「服务器地址」在真机上须填电脑的局域网 IP（如 http://192.168.1.5:3000），不要用 localhost；Android 模拟器可用 http://10.0.2.2:3000；② 手机与电脑同一 Wi-Fi；③ 服务端已监听 0.0.0.0 且防火墙放行端口；④ 使用 HTTP 时 Android 需在 app.json 中开启 usesCleartextTraffic（已配置后请重新运行/构建应用）。";
      const inner = e instanceof Error ? e.message : String(e);
      throw new Error(`${hint}（${inner}）`);
    }
    if (res.status === 401 && path !== "/api/v1/auth/refresh") {
      const refreshed = await this.refreshAccessToken(deviceId);
      if (refreshed) {
        return this.request<T>(path, options);
      }
    }
    if (!res.ok) {
      const errText = await res.text();
      let msg = res.statusText;
      try {
        const body = errText ? (JSON.parse(errText) as { error?: { message?: string } }) : {};
        msg = body.error?.message ?? msg;
      } catch {
        msg = errText.slice(0, 160) || msg;
      }
      throw new Error(`API ${res.status}: ${msg}`);
    }
    if (res.status === 204) {
      return undefined as T;
    }
    const text = await res.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      const preview = text.slice(0, 100).replace(/\s+/g, " ");
      const wrongPort =
        /:8081(\/|$)/.test(this.baseUrl) ||
        /8081/.test(this.baseUrl.split("?")[0] ?? "");
      const hint = wrongPort
        ? "你把地址填成了 8081：这是 Expo Metro（前端打包）端口，返回的是网页而不是 JSON。请改为后端 API 地址，例如 http://192.168.1.16:3000（端口以服务端 .env 的 PORT 为准，默认 3000）。"
        : "服务器返回的不是合法 JSON（可能是 HTML 或纯文本）。请确认「服务器地址」指向本仓库的 Node/Express 接口，不要填 Vite/Metro/其它前端开发端口。";
      throw new Error(`${hint} 响应开头：${preview}`);
    }
  }

  private async refreshAccessToken(deviceId: string): Promise<boolean> {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;
    const res = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": deviceId,
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken?: string };
    if (!data.accessToken) return false;
    await saveAccessToken(data.accessToken);
    return true;
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

  async listDiaries(): Promise<{ diaries: DiaryPayload[] }> {
    return this.request("/api/v1/diaries");
  }

  async createDiary(body: { date: string; content: string }): Promise<{ diary: DiaryPayload }> {
    return this.request("/api/v1/diaries", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateDiary(
    id: string,
    body: { date?: string; content?: string }
  ): Promise<{ diary: DiaryPayload }> {
    return this.request(`/api/v1/diaries/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async deleteDiary(id: string): Promise<void> {
    await this.request<void>(`/api/v1/diaries/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async listWorklistItems(): Promise<{ items: WorklistItemPayload[] }> {
    return this.request("/api/v1/worklist-items");
  }

  async createWorklistItem(body: {
    name: string;
    icon?: string;
    note?: string;
  }): Promise<{ item: WorklistItemPayload }> {
    return this.request("/api/v1/worklist-items", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateWorklistItem(
    id: string,
    body: Partial<{
      name: string;
      icon: string;
      note: string;
      reminderAt: string | null;
      estimateDoneAt: string | null;
      reminderNotified: boolean;
      completionResult: "" | "completed" | "incomplete";
      confirmSnoozeUntil: string | null;
    }>
  ): Promise<{ item: WorklistItemPayload }> {
    return this.request(`/api/v1/worklist-items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async deleteWorklistItem(id: string): Promise<void> {
    await this.request<void>(`/api/v1/worklist-items/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async listTimeRecordsByDate(date: string): Promise<{ records: TimeRecordPayload[] }> {
    const q = new URLSearchParams({ date });
    return this.request(`/api/v1/time-records?${q.toString()}`);
  }
}
