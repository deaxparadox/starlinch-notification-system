"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { apiFetch, ForbiddenError, UnauthorizedError } from "./api-client";
import type { User } from "./types";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** For requests that require an authenticated session. Retries once after a silent
   * refresh on a 401. Throws UnauthorizedError if that fails, ForbiddenError on a 403 -
   * callers decide what to do (redirect to /login or /unauthorized respectively). */
  authFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  const refresh = useCallback(async (): Promise<boolean> => {
    const res = await apiFetch("/api/auth/refresh/", { method: "POST" });
    if (!res.ok) {
      accessTokenRef.current = null;
      return false;
    }
    const data = await res.json();
    accessTokenRef.current = data.access_token;
    return true;
  }, []);

  useEffect(() => {
    refresh().then((ok) => setStatus(ok ? "authenticated" : "anonymous"));
    // Recovering a session after a page reload only restores the access token, not `user`
    // (the backend's /refresh/ intentionally returns just a token, see accounts/views.py) -
    // anything that needs to know is_staff after a reload probes an admin endpoint instead
    // (see app/(admin)/layout.tsx).
  }, [refresh]);

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      let res = await apiFetch(path, options, accessTokenRef.current);
      if (res.status === 401) {
        const ok = await refresh();
        if (!ok) {
          setStatus("anonymous");
          setUser(null);
          throw new UnauthorizedError();
        }
        res = await apiFetch(path, options, accessTokenRef.current);
        if (res.status === 401) {
          setStatus("anonymous");
          setUser(null);
          throw new UnauthorizedError();
        }
      }
      if (res.status === 403) {
        throw new ForbiddenError();
      }
      return res;
    },
    [refresh],
  );

  const login = useCallback(async (username: string, password: string): Promise<User> => {
    const res = await apiFetch("/api/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Invalid credentials.");
    }
    const data = await res.json();
    accessTokenRef.current = data.access_token;
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout/", { method: "POST" }, accessTokenRef.current).catch(() => {});
    accessTokenRef.current = null;
    setUser(null);
    setStatus("anonymous");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
