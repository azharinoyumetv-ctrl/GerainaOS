import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react";
import api from "@/api/client";
import { offlineAvailable, scopeFor, synchronize } from "@/offline/posStore";

const AuthCtx = createContext(null);
const sessionToken = () => localStorage.getItem("geraina_token") || localStorage.getItem("dagangos_token") || localStorage.getItem("dapuros_token");
const clearSession = () => { for (const prefix of ["geraina", "dagangos", "dapuros"]) { localStorage.removeItem(`${prefix}_token`); localStorage.removeItem(`${prefix}_user`); } };

const getRoleFromEmail = (email) => {
  if (!email) return "Owner";
  const em = email.toLowerCase();
  if (em.includes("owner")) return "Owner";
  if (em.includes("manager")) return "Manager";
  if (em.includes("cashier")) return "Cashier";
  if (em.includes("warehouse")) return "Warehouse";
  return localStorage.getItem("geraina_selected_role") || "Owner";
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const validation = useRef({ token: null, promise: null, checkedAt: 0 });

  // Replay is tied to the authenticated app session, including dashboard/restart,
  // rather than requiring the cashier screen to remain mounted.
  useEffect(() => {
    const scope = scopeFor(user);
    if (!scope || !offlineAvailable()) return;
    const sync = () => synchronize(scope, api).catch(() => {});
    sync(); window.addEventListener("online", sync); window.addEventListener("focus", sync);
    const timer = setInterval(sync, 30000);
    return () => { clearInterval(timer); window.removeEventListener("online", sync); window.removeEventListener("focus", sync); };
  }, [user?.id, user?.store_id]);

  const enrichUser = (usr) => {
    if (!usr) return null;
    const role = localStorage.getItem("geraina_selected_role") || getRoleFromEmail(usr.email);
    return { ...usr, role };
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
      localStorage.setItem("geraina_user", JSON.stringify(r.data)); localStorage.setItem("dagangos_user", JSON.stringify(r.data));
      setUser(enrichUser(r.data)); current.checkedAt = Date.now();
    }).catch(error => {
      if (sessionToken() === token && error.response?.status === 401) { clearSession(); setUser(null); }
      throw error;
    }).finally(() => { current.promise = null; });
    validation.current = current;
    return current.promise;
  }, []);

  useEffect(() => {
    const t = sessionToken();
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
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const login = async (email, password) => {
    // Clear any existing stale session tokens first
    clearSession();
    setUser(null);

    try {
      const r = await api.post("/auth/login", { email, password });
      localStorage.setItem("geraina_token", r.data.access_token);
      localStorage.setItem("dagangos_token", r.data.access_token);
      localStorage.setItem("dagangos_user", JSON.stringify(r.data.user));
      localStorage.setItem("geraina_user", JSON.stringify(r.data.user));
      validation.current = { token: r.data.access_token, promise: null, checkedAt: Date.now() };
      const rname = getRoleFromEmail(email);
      localStorage.setItem("geraina_selected_role", rname);
      const enriched = enrichUser(r.data.user);
      setUser(enriched);
      return enriched;
    } catch (err) {
      throw new Error(
        err?.response?.data?.detail ||
        (!err.response ? "Tidak dapat terhubung. Periksa koneksi internet lalu coba lagi." : null) ||
        "Email atau kata sandi tidak valid. Silakan periksa kembali kredensial Anda."
      );
    }
  };

  const register = async (email, password, store_name) => {
    const r = await api.post("/auth/register", { email, password, store_name });
    localStorage.setItem("geraina_token", r.data.access_token);
    localStorage.setItem("dagangos_token", r.data.access_token);
    localStorage.setItem("geraina_selected_role", "Owner");
    localStorage.setItem("geraina_user", JSON.stringify(r.data.user));
    localStorage.setItem("dagangos_user", JSON.stringify(r.data.user));
    validation.current = { token: r.data.access_token, promise: null, checkedAt: Date.now() };
    const enriched = enrichUser(r.data.user);
    setUser(enriched);
    return enriched;
  };

  const logout = () => {
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

  const setPlan = (plan) => {
    setUser((prev) => (prev ? { ...prev, plan } : null));
  };

  const changeRole = (newRole) => {
    localStorage.setItem("geraina_selected_role", newRole);
    setUser((prev) => (prev ? { ...prev, role: newRole } : null));
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, setPlan, changeRole }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

