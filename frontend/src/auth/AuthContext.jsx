import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react";
import api from "@/api/client";
import { offlineAvailable, scopeFor, synchronize } from "@/offline/posStore";
import { canonicalRole } from "./permissions";

import { sessionToken, clearSession } from "./session";

const AuthCtx = createContext(null);
const serverUser = value => value?.id && (!value.current_module || value.current_module === "geraina") && canonicalRole(value.role) ? { ...value, current_module: "geraina", role: canonicalRole(value.role) } : null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const validation = useRef({ token: null, promise: null, checkedAt: 0 });
  const sessionAttempt = useRef(0);

  // Replay is tied to the authenticated app session, including dashboard/restart,
  // rather than requiring the cashier screen to remain mounted.
  useEffect(() => {
    const scope = scopeFor(user);
    if (!scope || user?.must_change_password || !offlineAvailable()) return;
    const sync = () => synchronize(scope, api).catch(() => {});
    sync(); window.addEventListener("online", sync); window.addEventListener("focus", sync);
    const timer = setInterval(sync, 30000);
    return () => { clearInterval(timer); window.removeEventListener("online", sync); window.removeEventListener("focus", sync); };
  }, [user?.id, user?.store_id, user?.must_change_password]);

  const enrichUser = (usr) => {
    return serverUser(usr);
  };

  const acceptSession = payload => {
    const next = serverUser(payload.user);
    if (!next || !payload.access_token) throw new Error("Sesi tidak valid. Silakan masuk kembali.");
    localStorage.removeItem("geraina_selected_role");
    localStorage.setItem("geraina_token", payload.access_token);
    localStorage.removeItem("geraina_signed_out");
    localStorage.setItem("geraina_user", JSON.stringify(next));
    validation.current = { token: payload.access_token, promise: null, checkedAt: Date.now() };
    setSessionError(false);
    setUser(next);
    return next;
  };

  const validateSession = useCallback((force = false) => {
    const token = sessionToken();
    if (!token || token === "mock_master_token") return Promise.resolve();
    const previous = validation.current;
    if (previous.token === token && previous.promise) return previous.promise;
    if (!force && previous.token === token && Date.now() - previous.checkedAt < 30000) return Promise.resolve();
    const current = { token, promise: null, checkedAt: 0 };
    current.promise = api.get("/auth/me", { timeout: 8000 }).then(r => {
      if (sessionToken() !== token) return;
      const next = serverUser(r.data);
      if (!next) { clearSession(); setUser(null); throw new Error("Sesi tidak valid."); }
      localStorage.removeItem("geraina_selected_role");
      localStorage.setItem("geraina_token", token);
      localStorage.setItem("geraina_user", JSON.stringify(next));
      setSessionError(false);
      setUser(next); current.checkedAt = Date.now();
    }).catch(error => {
      if (sessionToken() === token && error.response?.status === 401) { clearSession(); setSessionError(false); setUser(null); }
      throw error;
    }).finally(() => { current.promise = null; });
    validation.current = current;
    return current.promise;
  }, []);

  useEffect(() => {
    const t = sessionToken();
    localStorage.removeItem("geraina_selected_role");
    const savedUserStr = localStorage.getItem("geraina_user");
    let savedUser = null;
    if (savedUserStr) {
      try { savedUser = JSON.parse(savedUserStr); } catch (e) {}
    }
    if (!savedUser?.id || !savedUser?.store_id || savedUser.current_module !== "geraina") savedUser = null;

    if (!t || t === "mock_master_token") {
      // Tanpa token valid: pengguna wajib login
      if (t) clearSession();
      else localStorage.removeItem("geraina_user");
      setUser(null);
      setLoading(false);
      return;
    }
    // The native app can show its saved session immediately, while the server
    // revalidates it. Server requests still require the existing access token.
    if (savedUser && (offlineAvailable() || !navigator.onLine)) { setUser(enrichUser(savedUser)); setLoading(false); }
    if (!navigator.onLine && savedUser) return;
    let active = true;
    validateSession(true)
      .catch((err) => {
        if (active && sessionToken() === t && err?.response?.status !== 401) {
          setUser(savedUser ? enrichUser(savedUser) : null);
          if (!savedUser) setSessionError(true);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Refresh account entitlements after returning from payment in this or another tab.
  useEffect(() => {
    const sync = () => {
      const token = sessionToken();
      if (!token || document.visibilityState === "hidden") return;
      validateSession().catch(() => {});
    };
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  useEffect(() => {
    const changed = event => {
      if (event.key && event.key !== "geraina_token" && event.key !== "geraina_signed_out" && !(event.key === "dagangos_token" && !localStorage.getItem("geraina_token"))) return;
      const expected = sessionToken();
      sessionAttempt.current++; setSessionError(false); setUser(null);
      if (!expected) { setLoading(false); return; }
      setLoading(true);
      validateSession(true).catch(error => { if (sessionToken() === expected && error.response?.status !== 401) setSessionError(true); }).finally(() => { if (sessionToken() === expected) setLoading(false); });
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [validateSession]);
  const login = async (email, password) => {
    // Clear any existing stale session tokens first
    clearSession();
    setSessionError(false);
    setUser(null);
    const attempt = ++sessionAttempt.current;

    try {
      const r = await api.post("/auth/login", { email, password });
      if (attempt !== sessionAttempt.current) throw new Error("Permintaan masuk dibatalkan.");
      return acceptSession(r.data);
    } catch (err) {
      throw new Error(
        err?.response?.data?.detail ||
        (!err.response ? "Tidak dapat terhubung. Periksa koneksi internet lalu coba lagi." : null) ||
        "Email atau kata sandi tidak valid. Silakan periksa kembali kredensial Anda."
      );
    }
  };

  const register = async (email, password, store_name) => {
    const attempt = ++sessionAttempt.current;
    const r = await api.post("/auth/register", { email, password, store_name });
    if (attempt !== sessionAttempt.current) throw new Error("Permintaan masuk dibatalkan.");
    return acceptSession(r.data);
  };

  const logout = () => {
    sessionAttempt.current++;
    clearSession();
    setSessionError(false);
    validation.current = { token: null, promise: null, checkedAt: 0 };
    localStorage.removeItem("geraina_selected_role");
    setUser(null);
  };

  const refresh = async () => {
    try {
      await validateSession(true);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[Auth] refresh failed", err.message);
      }
    }
  };

  const changePassword = async (current_password, new_password) => {
    const expected = sessionToken();
    const response = await api.post("/auth/change-password", { current_password, new_password });
    if (!expected || sessionToken() !== expected) throw new Error("Sesi berubah. Silakan masuk kembali.");
    return acceptSession(response.data);
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, changePassword }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading]
  );

  const retrySession = () => {
    setLoading(true);
    validateSession(true).catch(error => {
      if (sessionToken() && error.response?.status !== 401) setSessionError(true);
    }).finally(() => setLoading(false));
  };

  return <AuthCtx.Provider value={value}>{sessionError && !user ? (
    <main className="min-h-screen grid place-items-center p-6 bg-[hsl(var(--background))]" data-testid="session-recovery">
      <section className="max-w-sm space-y-4 text-center" role="status">
        <h1 className="text-xl font-bold">Sesi belum dapat diperiksa</h1>
        <p className="text-sm text-[hsl(var(--muted))]">Periksa koneksi lalu coba lagi. Data masuk Anda tetap tersimpan. Akses toko dibuka setelah sesi berhasil diperiksa.</p>
        <button type="button" className="btn-primary w-full" onClick={retrySession} disabled={loading} data-testid="session-retry">{loading ? "Memeriksa sesi…" : "Coba lagi"}</button>
        <button type="button" className="btn-outline w-full" onClick={logout} data-testid="session-sign-out">Keluar dari aplikasi ini</button>
      </section>
    </main>
  ) : children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

