import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "@/api/client";
import { offlineAvailable, scopeFor, synchronize } from "@/offline/posStore";

const AuthCtx = createContext(null);

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

  useEffect(() => {
    const t = localStorage.getItem("geraina_token") || localStorage.getItem("dagangos_token") || localStorage.getItem("dapuros_token");
    const savedUserStr = localStorage.getItem("dagangos_user") || localStorage.getItem("geraina_user") || localStorage.getItem("dapuros_user");
    let savedUser = null;
    if (savedUserStr) {
      try { savedUser = JSON.parse(savedUserStr); } catch (e) {}
    }

    if (!t || t === "mock_master_token") {
      // Tanpa token valid: pengguna wajib login
      localStorage.removeItem("geraina_token");
      localStorage.removeItem("dagangos_token");
      localStorage.removeItem("dapuros_token");
      setUser(null);
      setLoading(false);
      return;
    }
    if (!navigator.onLine && savedUser) { setUser(enrichUser(savedUser)); setLoading(false); return; }
    api.get("/auth/me", { timeout: 8000 })
      .then((r) => { localStorage.setItem("geraina_user", JSON.stringify(r.data)); localStorage.setItem("dagangos_user", JSON.stringify(r.data)); setUser(enrichUser(r.data)); })
      .catch((err) => {
        // Token tidak valid / kedaluwarsa → wajib login ulang
        if (err?.response?.status === 401) {
          localStorage.removeItem("geraina_token");
          localStorage.removeItem("dagangos_token");
          localStorage.removeItem("dapuros_token");
          setUser(null);
        } else {
          // Backend tidak terjangkau (offline) → pertahankan sesi tersimpan agar kasir tetap beroperasi
          setUser(savedUser ? enrichUser(savedUser) : null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Refresh account entitlements after returning from payment in this or another tab.
  useEffect(() => {
    const currentToken = () => localStorage.getItem("geraina_token") || localStorage.getItem("dagangos_token") || localStorage.getItem("dapuros_token");
    const sync = () => {
      const token = currentToken();
      if (!token || document.visibilityState === "hidden") return;
      api.get("/auth/me").then(r => {
        if (currentToken() === token) setUser(enrichUser(r.data));
      }).catch(() => {});
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
    localStorage.removeItem("geraina_token");
    localStorage.removeItem("dagangos_token");
    localStorage.removeItem("dagangos_user");
    localStorage.removeItem("geraina_user");
    setUser(null);

    try {
      const r = await api.post("/auth/login", { email, password });
      localStorage.setItem("geraina_token", r.data.access_token);
      localStorage.setItem("dagangos_token", r.data.access_token);
      localStorage.setItem("dagangos_user", JSON.stringify(r.data.user));
      localStorage.setItem("geraina_user", JSON.stringify(r.data.user));
      const rname = getRoleFromEmail(email);
      localStorage.setItem("geraina_selected_role", rname);
      const enriched = enrichUser(r.data.user);
      setUser(enriched);
      return enriched;
    } catch (err) {
      throw new Error(
        err?.response?.data?.detail ||
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
    const enriched = enrichUser(r.data.user);
    setUser(enriched);
    return enriched;
  };

  const logout = () => {
    localStorage.removeItem("geraina_token");
    localStorage.removeItem("dagangos_token");
    localStorage.removeItem("dagangos_user");
    localStorage.removeItem("geraina_user");
    localStorage.removeItem("geraina_selected_role");
    setUser(null);
  };

  const refresh = async () => {
    try {
      const r = await api.get("/auth/me");
      setUser(enrichUser(r.data));
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[Auth] refresh failed", err);
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

