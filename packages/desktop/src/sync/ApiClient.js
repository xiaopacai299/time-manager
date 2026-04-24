// packages/desktop/src/sync/ApiClient.js

export class ApiClient {
  /**
   * @param {string} apiBase - 后端基础 URL（如 "http://localhost:3000"）
   * @param {() => string | null} getAccessToken - 返回当前 access token 的函数
   * @param {string} deviceId
   */
  constructor(apiBase, getAccessToken, deviceId) {
    this.apiBase = apiBase;
    this.getAccessToken = getAccessToken;
    this.deviceId = deviceId;
  }

  async _request(path, options = {}) {
    const token = this.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-Id': this.deviceId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(`${this.apiBase}${path}`, {
      ...options,
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message ?? res.statusText;
      throw new Error(`API ${res.status}: ${msg}`);
    }
    return res.json();
  }

  async register(email, password, platform = 'desktop', deviceName = 'desktop') {
    return this._request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, platform, deviceName }),
    });
  }

  async login(email, password, platform = 'desktop', deviceName = 'desktop') {
    return this._request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, platform, deviceName }),
    });
  }

  async refreshToken(refreshToken) {
    return this._request('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(refreshToken) {
    return this._request('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async me() {
    return this._request('/api/v1/auth/me');
  }

  /**
   * 拉取同步资源（分页）
   * @param {string} resource - 如 "time-records"
   * @param {string | null} since - ISO datetime，上次 serverTime
   * @param {string | null} cursor - 分页游标
   */
  async pull(resource, since, cursor) {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return this._request(`/api/v1/sync/${resource}${qs ? `?${qs}` : ''}`);
  }

  /**
   * 推送本地变更
   * @param {string} resource
   * @param {string} deviceId
   * @param {unknown[]} records
   */
  async push(resource, deviceId, records) {
    return this._request(`/api/v1/sync/${resource}`, {
      method: 'POST',
      body: JSON.stringify({ deviceId, records }),
    });
  }
}
