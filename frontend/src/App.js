import { sessionToken } from "@/auth/session";
import { safeAppReturn } from "@/auth/appReturn";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from "react-router-dom";
import { useEffect } from "react";
import { deferred } from "@/navigation/DeferredPage";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import PasswordSetup from "@/auth/PasswordSetup";
import { Toaster } from "@/components/ui/sonner";

import Login from "@/pages/Login";
import AppLayout from "@/layouts/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import POS from "@/pages/POS";

import RoleGuard from "@/components/RoleGuard";
import AppPageNotFound from "@/navigation/AppPageNotFound";
import { SECTIONS } from "@/navigation/sections";

const DagangOS = deferred(() => import("@/pages/DagangOS"));
const Landing = deferred(() => import("@/pages/Landing"));
const Pricing = deferred(() => import("@/pages/Pricing"));
const Register = deferred(() => import("@/pages/Register"));
const Activate = deferred(() => import("@/pages/Activate"));
const Sales = deferred(() => import("@/pages/Sales"));
const About = deferred(() => import("@/pages/About"));
const LicenseDevices = deferred(() => import("@/pages/LicenseDevices"));
const Categories = deferred(() => import("@/pages/products/Categories"));
const Brands = deferred(() => import("@/pages/products/Brands"));
const Units = deferred(() => import("@/pages/products/Units"));
const StockAdjustment = deferred(() => import("@/pages/products/StockAdjustment"));
const StockTransfer = deferred(() => import("@/pages/products/StockTransfer"));
const StockOverview = deferred(() => import("@/pages/inventory/StockOverview"));
const StockMovement = deferred(() => import("@/pages/inventory/StockMovement"));
const InventoryValuation = deferred(() => import("@/pages/inventory/InventoryValuation"));
const LowStock = deferred(() => import("@/pages/inventory/LowStock"));
const DeadStock = deferred(() => import("@/pages/inventory/DeadStock"));
const PurchaseOrder = deferred(() => import("@/pages/purchase/PurchaseOrder"));
const GoodsReceiving = deferred(() => import("@/pages/purchase/GoodsReceiving"));
const SupplierInvoice = deferred(() => import("@/pages/purchase/SupplierInvoice"));
const SupplierList = deferred(() => import("@/pages/supplier/SupplierList"));
const CustomerList = deferred(() => import("@/pages/customer/CustomerList"));
const Membership = deferred(() => import("@/pages/customer/Membership"));
const LoyaltyPoints = deferred(() => import("@/pages/customer/LoyaltyPoints"));
const AccountsReceivable = deferred(() => import("@/pages/debt/AccountsReceivable"));
const AccountsPayable = deferred(() => import("@/pages/debt/AccountsPayable"));
const PaymentConfig = deferred(() => import("@/pages/payments/PaymentConfig"));
const BankQrisSettings = deferred(() => import("@/pages/payments/BankQrisSettings"));
const Reports = deferred(() => import("@/pages/reports/Reports"));
const StaffManagement = deferred(() => import("@/pages/staff/StaffManagement"));
const Roles = deferred(() => import("@/pages/staff/Roles"));
const Permissions = deferred(() => import("@/pages/staff/Permissions"));
const Attendance = deferred(() => import("@/pages/staff/Attendance"));
const BranchManagement = deferred(() => import("@/pages/branches/BranchManagement"));
const Integrations = deferred(() => import("@/pages/integrations/Integrations"));
const Settings = deferred(() => import("@/pages/settings/Settings"));

function KnownSection({ section, children }) {
  const { type } = useParams();
  const legacy = section === "integrations" ? ["stripe", "telegram", "email"] : section === "settings" ? ["subscription"] : [];
  return !type || SECTIONS[section].some(tab => tab.id === type.replaceAll("-", "_")) || legacy.includes(type) ? children : <AppPageNotFound />;
}

function CanonicalAppRedirect() {
  const location = useLocation();
  const path = location.pathname.startsWith("/app") ? "/geraina" + location.pathname : "/geraina/app" + location.pathname.slice("/geraina".length);
  return <Navigate to={path + location.search + location.hash} replace />;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const returnTo = safeAppReturn(location.pathname + location.search);
  if (loading) return <div className="p-10 text-sm text-center text-[hsl(var(--muted))]" data-testid="auth-loading">Memuat sesi…</div>;
  if (!user) return <Navigate to={returnTo ? `/geraina/login?returnTo=${encodeURIComponent(returnTo)}` : "/geraina/login"} replace />;
  if (user.must_change_password) return <PasswordSetup />;
  return children;
}

function AndroidRouterBridge() {
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => {
    if (!window.__gerainaAndroid || !user) return;
    const router = { navigate: href => {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/geraina/app/")) return false;
      navigate(url.pathname + url.search + url.hash);
      return true;
    } };
    window.GerainaRouter = router;
    return () => { if (window.GerainaRouter === router) delete window.GerainaRouter; };
  }, [navigate, user?.id, user?.store_id]);
  return null;
}

function GerainaRootComponent() {
  const { user } = useAuth();
  const token = typeof window !== "undefined" ? sessionToken() : null;
  if (user || token) {
    return <Navigate to="/geraina/app/dashboard" replace />;
  }
  return <Landing />;
}

function getGerainaAppSubRoutes() {
  return [
    <Route key="g-idx" index element={<Navigate to="dashboard" replace />} />,
    
    /* General Routes */
    <Route key="g-dash" path="dashboard" element={<RoleGuard><Dashboard /></RoleGuard>} />,
    <Route key="g-pos" path="pos" element={<RoleGuard><POS /></RoleGuard>} />,
    <Route key="g-sales" path="sales" element={<RoleGuard><Sales /></RoleGuard>} />,
    <Route key="g-lic" path="license" element={<RoleGuard><LicenseDevices /></RoleGuard>} />,
    <Route key="g-abt" path="about" element={<RoleGuard><About /></RoleGuard>} />,

    /* Produk */
    <Route key="g-p" path="products" element={<RoleGuard><Products /></RoleGuard>} />,
    <Route key="g-pc" path="products/categories" element={<RoleGuard><Categories /></RoleGuard>} />,
    <Route key="g-pb" path="products/brands" element={<RoleGuard><Brands /></RoleGuard>} />,
    <Route key="g-pu" path="products/units" element={<RoleGuard><Units /></RoleGuard>} />,
    <Route key="g-psa" path="products/stock-adjustment" element={<RoleGuard><StockAdjustment /></RoleGuard>} />,
    <Route key="g-pst" path="products/stock-transfer" element={<RoleGuard><StockTransfer /></RoleGuard>} />,

    /* Inventory */
    <Route key="g-inv" path="inventory" element={<RoleGuard><StockOverview /></RoleGuard>} />,
    <Route key="g-invo" path="inventory/overview" element={<RoleGuard><StockOverview /></RoleGuard>} />,
    <Route key="g-invm" path="inventory/movement" element={<RoleGuard><StockMovement /></RoleGuard>} />,
    <Route key="g-invv" path="inventory/valuation" element={<RoleGuard><InventoryValuation /></RoleGuard>} />,
    <Route key="g-invl" path="inventory/low-stock" element={<RoleGuard><LowStock /></RoleGuard>} />,
    <Route key="g-invd" path="inventory/dead-stock" element={<RoleGuard><DeadStock /></RoleGuard>} />,

    /* Purchase */
    <Route key="g-pur" path="purchase" element={<RoleGuard><PurchaseOrder /></RoleGuard>} />,
    <Route key="g-puro" path="purchase/orders" element={<RoleGuard><PurchaseOrder /></RoleGuard>} />,
    <Route key="g-purr" path="purchase/receiving" element={<RoleGuard><GoodsReceiving /></RoleGuard>} />,
    <Route key="g-puri" path="purchase/invoices" element={<RoleGuard><SupplierInvoice /></RoleGuard>} />,

    /* Supplier */
    <Route key="g-sup" path="suppliers" element={<RoleGuard><SupplierList /></RoleGuard>} />,

    /* Customer */
    <Route key="g-cust" path="customers" element={<RoleGuard><CustomerList /></RoleGuard>} />,
    <Route key="g-custm" path="customers/membership" element={<RoleGuard><Membership /></RoleGuard>} />,
    <Route key="g-custl" path="customers/loyalty" element={<RoleGuard><LoyaltyPoints /></RoleGuard>} />,

    /* Hutang Piutang */
    <Route key="g-debt" path="debt" element={<RoleGuard><AccountsReceivable /></RoleGuard>} />,
    <Route key="g-debtr" path="debt/receivable" element={<RoleGuard><AccountsReceivable /></RoleGuard>} />,
    <Route key="g-debtp" path="debt/payable" element={<RoleGuard><AccountsPayable /></RoleGuard>} />,

    /* Payments */
    <Route key="g-payt" path="settings/payments/:type" element={<RoleGuard><KnownSection section="payments"><PaymentConfig /></KnownSection></RoleGuard>} />,
    <Route key="g-payw" path="settings/payments/*" element={<AppPageNotFound />} />,
    <Route key="g-pay" path="settings/payments" element={<RoleGuard><KnownSection section="payments"><PaymentConfig /></KnownSection></RoleGuard>} />,
    <Route key="g-pt" path="payments/:type" element={<RoleGuard><KnownSection section="payments"><PaymentConfig /></KnownSection></RoleGuard>} />,
    <Route key="g-pw" path="payments/*" element={<AppPageNotFound />} />,
    <Route key="g-p2" path="payments" element={<RoleGuard><KnownSection section="payments"><PaymentConfig /></KnownSection></RoleGuard>} />,

    /* Reports */
    <Route key="g-rept" path="reports/:type" element={<RoleGuard><KnownSection section="reports"><Reports /></KnownSection></RoleGuard>} />,
    <Route key="g-repw" path="reports/*" element={<AppPageNotFound />} />,
    <Route key="g-rep" path="reports" element={<RoleGuard><KnownSection section="reports"><Reports /></KnownSection></RoleGuard>} />,

    /* Staff */
    <Route key="g-stfm" path="staff/management" element={<RoleGuard><StaffManagement /></RoleGuard>} />,
    <Route key="g-stfr" path="staff/roles" element={<RoleGuard><Roles /></RoleGuard>} />,
    <Route key="g-stfp" path="staff/permissions" element={<RoleGuard><Permissions /></RoleGuard>} />,
    <Route key="g-stfa" path="staff/attendance" element={<RoleGuard><Attendance /></RoleGuard>} />,
    <Route key="g-myattendance" path="attendance" element={<RoleGuard><Attendance /></RoleGuard>} />,
    <Route key="g-stfw" path="staff/*" element={<AppPageNotFound />} />,
    <Route key="g-stf" path="staff" element={<RoleGuard><StaffManagement /></RoleGuard>} />,

    /* Branches */
    <Route key="g-br" path="branches" element={<RoleGuard><BranchManagement /></RoleGuard>} />,

    /* Integrations */
    <Route key="g-bankqris-integration" path="integrations/qris" element={<RoleGuard><BankQrisSettings /></RoleGuard>} />,
    <Route key="g-intt" path="integrations/:type" element={<RoleGuard><KnownSection section="integrations"><Integrations /></KnownSection></RoleGuard>} />,
    <Route key="g-intw" path="integrations/*" element={<AppPageNotFound />} />,
    <Route key="g-int" path="integrations" element={<RoleGuard><KnownSection section="integrations"><Integrations /></KnownSection></RoleGuard>} />,

    <Route key="g-not-found" path="*" element={<AppPageNotFound />} />,

    /* Settings */
    <Route key="g-setb" path="settings/billing" element={<RoleGuard><KnownSection section="settings"><Settings /></KnownSection></RoleGuard>} />,
    <Route key="g-setbi" path="billing" element={<RoleGuard><KnownSection section="settings"><Settings /></KnownSection></RoleGuard>} />,
    <Route key="g-sett" path="settings/:type" element={<RoleGuard><KnownSection section="settings"><Settings /></KnownSection></RoleGuard>} />,
    <Route key="g-setw" path="settings/*" element={<AppPageNotFound />} />,
    <Route key="g-set" path="settings" element={<RoleGuard><KnownSection section="settings"><Settings /></KnownSection></RoleGuard>} />
  ];
}

export default function App() {
  const appRoutes = getGerainaAppSubRoutes();
  return (
    <AuthProvider>
      {/* Global toast host (sonner) -- replaces the native window.alert() calls previously
          used across the app for success/error feedback. A native alert() blocks the entire
          browser tab until dismissed; TestSprite's postrun-9 run showed a QRIS payment test
          triggering a "repeated alert" followed by 13 unrelated tests across completely
          different modules (Branches, Dashboard, Purchasing, Settings, etc.) all going
          BLOCKED in the same run -- consistent with the automation getting stuck behind a
          native dialog it couldn't dismiss, not 13 separate app bugs. Neither of this repo's
          two pre-existing, unused toast scaffolds (components/ui/toaster.jsx + use-toast.js,
          or this sonner one) was ever actually mounted anywhere before this. */}
      <Toaster position="top-center" richColors closeButton />
      <BrowserRouter>
        <AndroidRouterBridge />
        <Routes>
          {/* Direct Auth Top-level & Full URL Mappings */}
          <Route path="/login" element={<Login />} />
          <Route path="/geraina/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/geraina/register" element={<Register />} />
          <Route path="/geraina/activate" element={<Protected><Activate /></Protected>} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/geraina/pricing" element={<Pricing />} />

          {/* Parent Company Landing Page */}
          <Route path="/" element={<DagangOS />} />

          {/* Geraina POS Brand Routes */}
          <Route path="/geraina/*">
            <Route index element={<GerainaRootComponent />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="activate" element={<Protected><Activate /></Protected>} />

            <Route path="app/*" element={<Protected><AppLayout /></Protected>}>{appRoutes}</Route>

            {/* Direct un-prefixed management routes & deep links */}
            <Route path="dashboard/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="pos/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="products/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="inventory/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="purchase/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="suppliers/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="customers/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="debt/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="payments/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="reports/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="staff/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="branches/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="integrations/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
            <Route path="settings/*" element={<Protected><CanonicalAppRedirect /></Protected>} />
          </Route>

          {/* Root Fallback */}
          <Route path="/app/*" element={<Protected><CanonicalAppRedirect /></Protected>} />

          <Route path="*" element={<GerainaRootComponent />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
