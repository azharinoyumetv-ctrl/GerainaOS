import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "@/api/client";

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

  const enrichUser = (usr) => {
    if (!usr) return null;
    const role = localStorage.getItem("geraina_selected_role") || getRoleFromEmail(usr.email);
    return { ...usr, role };
  };

  useEffect(() => {
    const t = localStorage.getItem("geraina_token");
    if (!t) {
      setLoading(false);
      return;
    }
    api.get("/auth/me")
      .then((r) => setUser(enrichUser(r.data)))
      .catch(() => localStorage.removeItem("geraina_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("geraina_token", r.data.access_token);
    // Explicitly override selected role if logging in with a specific test user
    const rname = getRoleFromEmail(email);
    localStorage.setItem("geraina_selected_role", rname);
    const enriched = enrichUser(r.data.user);
    setUser(enriched);
    return enriched;
  };

  const register = async (email, password, store_name) => {
    const r = await api.post("/auth/register", { email, password, store_name });
    localStorage.setItem("geraina_token", r.data.access_token);
    localStorage.setItem("geraina_selected_role", "Owner");
    const enriched = enrichUser(r.data.user);
    setUser(enriched);
    return enriched;
  };

  const logout = () => {
    localStorage.removeItem("geraina_token");
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

