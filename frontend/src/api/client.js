import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("geraina_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      // Optional: redirect to login on 401
    }
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
