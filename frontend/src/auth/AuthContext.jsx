import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react";
import api from "@/api/client";
import { offlineAvailable, scopeFor, synchronize } from "@/offline/posStore";
import { canonicalRole } from "./permissions";

const AuthCtx = createContext(null);
const sessionToken = () => localStorage.getItem("geraina_token") || localStorage.getItem("dagangos_token") || localStorage.getItem("dapuros_token");
const clearSession = () => { for (const prefix of ["geraina", "dagangos", "dapuros"]) { localStorage.removeItem(`${prefix}_token`); localStorage.removeItem(`${prefix}_user`); } localStorage.removeItem("geraina_selected_role"); };
const serverUser = value => value?.id && canonicalRole(value.role) ? { ...value, role: canonicalRole(value.role) } : null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
    localStorage.setItem("dagangos_token", payload.access_token);
    localStorage.setItem("geraina_user", JSON.stringify(next));
    localStorage.setItem("dagangos_user", JSON.stringify(next));
    validation.current = { token: payload.access_token, promise: null, checkedAt: Date.now() };
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
      localStorage.setItem("geraina_user", JSON.stringify(next)); localStorage.setItem("dagangos_user", JSON.stringify(next));
      setUser(next); current.checkedAt = Date.now();
    }).catch(error => {
      if (sessionToken() === token && error.response?.status === 401) { clearSession(); setUser(null); }
      throw error;
    }).finally(() => { current.promise = null; });
    validation.current = current;
    return current.promise;
  }, []);

  useEffect(() => {
    const t = sessionToken();
    localStorage.removeItem("geraina_selected_role");
    const savedUserStr = localStorage.getItem("geraina_user") || localStorage.getItem("dagangos_user") || localStorage.getItem("dapuros_user");
    let savedUser = null;
    if (savedUserStr) {
      try { savedUser = JSON.parse(savedUserStr); } catch (e) {}
    }
    if (!savedUser?.id || !savedUser?.store_id) savedUser = null;

    if (!t || t === "mock_master_token") {
      // Tanpa token valid: pengguna wajib login
      clearSession();
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
        if (active && sessionToken() === t && err?.response?.status !== 401) setUser(savedUser ? enrichUser(savedUser) : null);
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
      if (!event.key || !/^(geraina|dagangos|dapuros)_(token|user)$/.test(event.key)) return;
      const expected = sessionToken();
      sessionAttempt.current++; setUser(null);
      if (!expected) { setLoading(false); return; }
      setLoading(true);
      validateSession(true).catch(() => {}).finally(() => { if (sessionToken() === expected) setLoading(false); });
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [validateSession]);
  const login = async (email, password) => {
    // Clear any existing stale session tokens first
    clearSession();
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

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

