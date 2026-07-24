import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ShieldAlert, Lock } from "lucide-react";

// SYNC: KEEP IN SYNC with the minPlan annotations on MENU_STRUCTURE in layouts/AppLayout.jsx.
// That nav lock icon only stops nav-clicks -- this is what actually stops a direct URL (typed,
// bookmarked, or deep-linked) from reaching a plan-locked page regardless of how the request
// got there. Ordered most-specific-to-least-specific; the first matching suffix wins, so a
// more specific rule (e.g. "/integrations/whatsapp") must come before a broader one that would
// also match the same path (e.g. "/integrations").
const PLAN_RANK = { starter: 0, pro: 1, business: 2, trial: 2 };
const PLAN_LABEL = { starter: "Starter", pro: "Pro", business: "Business" };
const PLAN_ROUTES = [
  ["/products/stock-transfer", "business"],
  ["/inventory/movement", "pro"],
  ["/inventory/valuation", "pro"],
  ["/inventory/dead-stock", "pro"],
  ["/purchase", "pro"],
  ["/suppliers", "pro"],
  ["/customers/membership", "business"],
  ["/customers/loyalty", "business"],
  ["/debt", "pro"],
  ["/reports", "pro"],
  ["/staff/roles", "business"],
  ["/staff/permissions", "business"],
  ["/staff/attendance", "business"],
  ["/branches", "business"],
  ["/integrations/whatsapp", "business"],
  ["/integrations/telegram", "business"],
  ["/integrations/email", "business"],
  ["/integrations", "pro"],
];

function planRank(plan) {
  return PLAN_RANK[plan] ?? 0;
}

function minPlanForPath(pathname) {
  const hit = PLAN_ROUTES.find(([suffix]) => pathname.includes(suffix));
  return hit ? hit[1] : null;
}

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

  // Plan gate runs for every role, including Owner -- direct-URL access to a plan-locked page
  // must be blocked the same way a nav click would be.
  const requiredPlan = minPlanForPath(location.pathname);
  if (requiredPlan && planRank(user.plan) < planRank(requiredPlan)) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-4" data-testid="plan-locked-page">
        <div className="w-16 h-16 rounded-full bg-[hsl(38,90%,50%,0.12)] text-[hsl(38,90%,42%)] grid place-items-center">
          <Lock size={32} />
        </div>
        <h1 className="font-display text-2xl font-bold">Fitur Terkunci</h1>
        <p className="text-[hsl(var(--muted))] max-w-md text-sm">
          Halaman ini tersedia mulai paket <strong>{PLAN_LABEL[requiredPlan]}</strong>. Paket Anda saat ini: {PLAN_LABEL[user.plan] || "Trial"}.
        </p>
        <a href="/geraina/pricing" className="btn-primary text-xs px-4 py-2 rounded-lg">Lihat Paket</a>
      </div>
    );
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
    // First path segment after the app prefix is the closest thing to a "module name" here
    // (e.g. /geraina/app/branches -> "branches"). This was previously an undefined variable
    // (`moduleName`) that would throw a ReferenceError and crash this component the moment any
    // non-Owner role hit an access-denied page, instead of showing this message.
    const moduleName = pathParts.find((p) => p !== "geraina" && p !== "app") || pathParts[pathParts.length - 1] || "";
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
