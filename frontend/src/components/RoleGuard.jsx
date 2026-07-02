import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ShieldAlert } from "lucide-react";

const ROLE_PERMISSIONS = {
  Owner: ["*"],
  admin: ["*"], // akun lama dengan peran "admin" setara Owner
  Manager: [
    "dashboard",
    "pos",
    "kds",
    "products",
    "ingredients",
    "inventory",
    "purchase",
    "suppliers",
    "customers",
    "debt",
    "payments",
    "reports",
    "staff",
    "settings",
    "billing",
    "license",
    "about"
  ],
  Cashier: [
    "dashboard",
    "pos",
    "kds",
    "products",
    "customers",
    "about"
  ],
  Warehouse: [
    "products",
    "ingredients",
    "inventory",
    "purchase",
    "suppliers",
    "about"
  ]
};

export default function RoleGuard({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-10 text-sm text-center text-[hsl(var(--muted))]" data-testid="auth-loading">Memuat sesi…</div>;
  }

  if (!user) {
    return <Navigate to="/geraina/login" replace />;
  }

  const role = user.role || "Owner";
  const permissions = ROLE_PERMISSIONS[role] || [];

  if (permissions.includes("*")) {
    return children;
  }

  // Check if any part of the path matches allowed permissions
  const pathParts = location.pathname.split("/").filter(Boolean);
  
  // Allow about page for everyone
  if (location.pathname.includes("about")) {
    return children;
  }

  const hasAccess = pathParts.some((part) => permissions.includes(part)) || permissions.includes("products");

  if (!hasAccess) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-4" data-testid="access-denied-page">
        <div className="w-16 h-16 rounded-full bg-[hsl(9,65%,55%,0.1)] text-[hsl(9,65%,55%)] grid place-items-center">
          <ShieldAlert size={32} />
        </div>
        <h1 className="font-display text-2xl font-bold">Akses Ditolak</h1>
        <p className="text-[hsl(var(--muted))] max-w-md text-sm">
          Peran Anda ({role}) tidak memiliki izin untuk mengakses halaman <strong>/{moduleName}</strong>. 
          Silakan hubungi pemilik toko jika Anda memerlukan akses.
        </p>
      </div>
    );
  }

  return children;
}
