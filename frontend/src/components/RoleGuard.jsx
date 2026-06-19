import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ShieldAlert } from "lucide-react";

const ROLE_PERMISSIONS = {
  Owner: ["*"],
  Manager: [
    "dashboard",
    "pos",
    "products",
    "inventory",
    "purchase",
    "suppliers",
    "customers",
    "debt",
    "payments",
    "reports",
    "staff",
    "settings",
    "about"
  ],
  Cashier: [
    "dashboard",
    "pos",
    "products",
    "customers",
    "about"
  ],
  Warehouse: [
    "products",
    "inventory",
    "purchase",
    "suppliers",
    "about"
  ]
};

export default function RoleGuard({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role || "Owner";
  const permissions = ROLE_PERMISSIONS[role] || [];

  if (permissions.includes("*")) {
    return children;
  }

  // Get module name from URL path, e.g. "/app/products/categories" -> "products"
  const pathParts = location.pathname.split("/");
  const moduleName = pathParts[2]; // Index 2 contains the path after /app/

  // Allow about page for everyone
  if (moduleName === "about") {
    return children;
  }

  const hasAccess = permissions.includes(moduleName);

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
