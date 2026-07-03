import axios from "axios";
import { mockDb } from "./mockDb";

const getBackendUrl = () => {
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (typeof window !== "undefined" && window.location.origin.includes("dagangos.com")) {
    return window.location.origin;
  }
  if (typeof window !== "undefined" && window.location.origin.includes("localhost")) {
    return envUrl && envUrl !== "undefined" && envUrl !== "" ? envUrl : "http://localhost:8000";
  }
  if (envUrl && envUrl !== "undefined" && envUrl !== "" && !envUrl.includes("localhost")) {
    return envUrl;
  }
  return "https://dagangos.com";
};

const BACKEND_URL = getBackendUrl();
export const API_BASE = `${BACKEND_URL.replace(/\/$/, "")}/api`;

const api = axios.create({ baseURL: API_BASE });

function handleMockRequest(url, method, data) {
  // Normalize url: remove base prefix and query params
  const cleanUrl = url.replace(API_BASE, "").replace(/^\//, "").split("?")[0];
  const parts = cleanUrl.split("/");
  const base = parts[0];

  if (base === "products") {
    const sub = parts[1];
    if (sub === "categories") {
      if (method === "get") return mockDb.list("categories");
      if (method === "post") return mockDb.add("categories", data);
      if (parts[2]) {
        if (method === "put") return mockDb.update("categories", parts[2], data);
        if (method === "delete") return mockDb.delete("categories", parts[2]);
      }
    }
    if (sub === "brands") {
      if (method === "get") return mockDb.list("brands");
      if (method === "post") return mockDb.add("brands", data);
      if (parts[2]) {
        if (method === "put") return mockDb.update("brands", parts[2], data);
        if (method === "delete") return mockDb.delete("brands", parts[2]);
      }
    }
    if (sub === "units") {
      if (method === "get") return mockDb.list("units");
      if (method === "post") return mockDb.add("units", data);
      if (parts[2]) {
        if (method === "put") return mockDb.update("units", parts[2], data);
        if (method === "delete") return mockDb.delete("units", parts[2]);
      }
    }
    if (sub === "stock-adjustments") {
      if (method === "get") return mockDb.list("stock_adjustments");
      if (method === "post") return mockDb.add("stock_adjustments", data);
    }
    if (sub === "stock-transfers") {
      if (method === "get") return mockDb.list("stock_transfers");
      if (method === "post") return mockDb.add("stock_transfers", data);
    }
  }

  if (base === "suppliers") {
    if (method === "get") return mockDb.list("suppliers");
    if (method === "post") return mockDb.add("suppliers", data);
    if (parts[1]) {
      if (method === "put") return mockDb.update("suppliers", parts[1], data);
      if (method === "delete") return mockDb.delete("suppliers", parts[1]);
    }
  }

  if (base === "purchase") {
    const sub = parts[1];
    if (sub === "orders") {
      if (method === "get") return mockDb.list("purchase_orders");
      if (method === "post") return mockDb.add("purchase_orders", data);
    }
    if (sub === "receiving") {
      if (method === "get") return mockDb.list("goods_receiving");
      if (method === "post") return mockDb.add("goods_receiving", data);
    }
    if (sub === "invoices") {
      if (method === "get") return mockDb.list("supplier_invoices");
      if (method === "post") return mockDb.add("supplier_invoices", data);
    }
  }

  if (base === "customers") {
    const sub = parts[1];
    if (sub === "memberships") {
      if (method === "get") return mockDb.list("memberships");
      if (method === "post") return mockDb.add("memberships", data);
    }
    if (sub === "loyalty") {
      if (method === "get") return mockDb.get("loyalty_rules");
      if (method === "post") return mockDb.set("loyalty_rules", data);
    }
    if (!sub || sub === "") {
      if (method === "get") return mockDb.list("customers");
      if (method === "post") return mockDb.add("customers", data);
    } else if (parts[1] && !["memberships", "loyalty"].includes(parts[1])) {
      if (method === "get") return mockDb.list("customers").find(x => x.id === parts[1]);
      if (method === "put") return mockDb.update("customers", parts[1], data);
      if (method === "delete") return mockDb.delete("customers", parts[1]);
    }
  }

  if (base === "debt") {
    const sub = parts[1];
    if (sub === "receivables") {
      if (method === "get") return mockDb.list("debt_receivables");
      if (method === "post") return mockDb.add("debt_receivables", data);
    }
    if (sub === "payables") {
      if (method === "get") return mockDb.list("debt_payables");
      if (method === "post") return mockDb.add("debt_payables", data);
    }
  }

  if (base === "payments") {
    if (parts[1] === "config") {
      if (method === "get") return mockDb.get("payments_config");
      if (method === "post") return mockDb.set("payments_config", data);
    }
  }

  if (base === "staff") {
    if (method === "get") return mockDb.list("staff");
    if (method === "post") return mockDb.add("staff", data);
    if (parts[1]) {
      if (method === "put") return mockDb.update("staff", parts[1], data);
      if (method === "delete") return mockDb.delete("staff", parts[1]);
    }
  }

  if (base === "attendance") {
    if (method === "get") return mockDb.list("attendance");
    if (method === "post") return mockDb.add("attendance", data);
  }

  if (base === "branches") {
    if (method === "get") return mockDb.list("branches");
    if (method === "post") return mockDb.add("branches", data);
    if (parts[1]) {
      if (method === "put") return mockDb.update("branches", parts[1], data);
      if (method === "delete") return mockDb.delete("branches", parts[1]);
    }
  }

  if (base === "integrations") {
    if (method === "get") return mockDb.get("integrations");
    if (method === "post") return mockDb.set("integrations", data);
  }

  if (base === "settings") {
    if (method === "get") return mockDb.get("settings");
    if (method === "post") return mockDb.set("settings", data);
  }

  return null;
}

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("geraina_token") || localStorage.getItem("dagangos_token") || "mock_master_token";
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  cfg.headers["X-DagangOS-Module"] = "geraina";

  // Disabled mock interceptor so request goes directly to the backend
  /*
  const mockRes = handleMockRequest(cfg.url || "", cfg.method?.toLowerCase() || "get", cfg.data);
  if (mockRes !== null) {
    cfg.adapter = () => {
      return new Promise((resolve) => {
        resolve({
          data: mockRes,
          status: 200,
          statusText: "OK",
          headers: {},
          config: cfg,
        });
      });
    };
  }
  */

  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    return Promise.reject(err);
  }
);

export default api;

export function fmtIDR(n) {
  if (n === null || n === undefined || isNaN(n)) return "Rp 0";
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadPdf(path, filename) {
  const res = await api.get(path, { responseType: "blob" });
  downloadBlob(res.data, filename);
}

