import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  getUser,
  getAccessToken,
  saveTokens,
  saveUser,
  saveApiBase,
  clearAuth,
  getApiBase,
  type AuthUser,
} from "../storage/authStore";
import { clearSyncData } from "../storage/syncDb";
import { ApiClient, normalizeApiBase } from "../api/apiClient";

/** 登录态：启动时先 loading，读本地后变为已登录或未登录 */
export type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: AuthUser; client: ApiClient };

type AuthContextValue = {
  auth: AuthState;
  login: (apiBase: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** 包住应用根节点，向下提供 auth / login / logout */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  // 冷启动：从本地恢复 user、API 地址与 accessToken，决定是否保持登录
  useEffect(() => {
    void (async () => {
      const [user, apiBase, accessToken] = await Promise.all([
        getUser(),
        getApiBase(),
        getAccessToken(),
      ]);
      if (user && apiBase && accessToken) {
        setAuth({
          status: "authenticated",
          user,
          client: new ApiClient(apiBase),
        });
      } else {
        setAuth({ status: "unauthenticated" });
      }
    })();
  }, []);

  const login = async (
    apiBase: string,
    email: string,
    password: string
  ): Promise<void> => {
    // 应该是弃用了，不需要用户填写后端地址了。
    const base = normalizeApiBase(apiBase);
    // ApiClient 实例，统一封装了各种请求，用于后续的请求
    const client = new ApiClient(base);
    const data = await client.login(email, password);
    // 保存 token、用户信息、API 地址
    await Promise.all([
      saveTokens(data.accessToken, data.refreshToken),
      saveUser(data.user),
      saveApiBase(base),
    ]);
    // 设置登录态
    setAuth({ status: "authenticated", user: data.user, client });
  };

  const logout = async (): Promise<void> => {
    await clearSyncData();
    await clearAuth();
    setAuth({ status: "unauthenticated" });
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** 在 AuthProvider 子树内读取登录态与登录/登出方法 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
