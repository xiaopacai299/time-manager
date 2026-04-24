import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  getUser,
  saveTokens,
  saveUser,
  saveApiBase,
  clearAuth,
  getApiBase,
  type AuthUser,
} from "../storage/authStore";
import { clearSyncData } from "../storage/syncDb";
import { ApiClient } from "../api/apiClient";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    void (async () => {
      const [user, apiBase] = await Promise.all([getUser(), getApiBase()]);
      if (user && apiBase) {
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
    const client = new ApiClient(apiBase);
    const data = await client.login(email, password);
    await Promise.all([
      saveTokens(data.accessToken, data.refreshToken),
      saveUser(data.user),
      saveApiBase(apiBase),
    ]);
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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
