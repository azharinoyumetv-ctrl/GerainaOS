import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";

import DagangOS from "@/pages/DagangOS";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AppLayout from "@/layouts/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import POS from "@/pages/POS";
import Sales from "@/pages/Sales";
import About from "@/pages/About";
import LicenseDevices from "@/pages/LicenseDevices";

// Submodules
import Categories from "@/pages/products/Categories";
import Brands from "@/pages/products/Brands";
import Units from "@/pages/products/Units";
import StockAdjustment from "@/pages/products/StockAdjustment";
import StockTransfer from "@/pages/products/StockTransfer";

import StockOverview from "@/pages/inventory/StockOverview";
import StockMovement from "@/pages/inventory/StockMovement";
import InventoryValuation from "@/pages/inventory/InventoryValuation";
import LowStock from "@/pages/inventory/LowStock";
import DeadStock from "@/pages/inventory/DeadStock";

import PurchaseOrder from "@/pages/purchase/PurchaseOrder";
import GoodsReceiving from "@/pages/purchase/GoodsReceiving";
import SupplierInvoice from "@/pages/purchase/SupplierInvoice";

import SupplierList from "@/pages/supplier/SupplierList";

import CustomerList from "@/pages/customer/CustomerList";
import Membership from "@/pages/customer/Membership";
import LoyaltyPoints from "@/pages/customer/LoyaltyPoints";

import AccountsReceivable from "@/pages/debt/AccountsReceivable";
import AccountsPayable from "@/pages/debt/AccountsPayable";

import PaymentConfig from "@/pages/payments/PaymentConfig";
import Reports from "@/pages/reports/Reports";

import StaffManagement from "@/pages/staff/StaffManagement";
import Roles from "@/pages/staff/Roles";
import Permissions from "@/pages/staff/Permissions";
import Attendance from "@/pages/staff/Attendance";

import BranchManagement from "@/pages/branches/BranchManagement";
import Integrations from "@/pages/integrations/Integrations";
import Settings from "@/pages/settings/Settings";

import RoleGuard from "@/components/RoleGuard";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-sm text-center text-[hsl(var(--muted))]" data-testid="auth-loading">Memuat sesi…</div>;
  if (!user) return <Navigate to="/geraina/login" replace />;
  return children;
}

function GerainaRootComponent() {
  const { user } = useAuth();
  const token = typeof window !== "undefined" ? (localStorage.getItem("dagangos_token") || localStorage.getItem("geraina_token") || localStorage.getItem("dapuros_token")) : null;
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
    <Route key="g-payt" path="settings/payments/:type" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,
    <Route key="g-payw" path="settings/payments/*" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,
    <Route key="g-pay" path="settings/payments" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,
    <Route key="g-pt" path="payments/:type" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,
    <Route key="g-pw" path="payments/*" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,
    <Route key="g-p2" path="payments" element={<RoleGuard><PaymentConfig /></RoleGuard>} />,

    /* Reports */
    <Route key="g-rept" path="reports/:type" element={<RoleGuard><Reports /></RoleGuard>} />,
    <Route key="g-repw" path="reports/*" element={<RoleGuard><Reports /></RoleGuard>} />,
    <Route key="g-rep" path="reports" element={<RoleGuard><Reports /></RoleGuard>} />,

    /* Staff */
    <Route key="g-stfm" path="staff/management" element={<RoleGuard><StaffManagement /></RoleGuard>} />,
    <Route key="g-stfr" path="staff/roles" element={<RoleGuard><Roles /></RoleGuard>} />,
    <Route key="g-stfp" path="staff/permissions" element={<RoleGuard><Permissions /></RoleGuard>} />,
    <Route key="g-stfa" path="staff/attendance" element={<RoleGuard><Attendance /></RoleGuard>} />,
    <Route key="g-stfw" path="staff/*" element={<RoleGuard><StaffManagement /></RoleGuard>} />,
    <Route key="g-stf" path="staff" element={<RoleGuard><StaffManagement /></RoleGuard>} />,

    /* Branches */
    <Route key="g-br" path="branches" element={<RoleGuard><BranchManagement /></RoleGuard>} />,

    /* Integrations */
    <Route key="g-intt" path="integrations/:type" element={<RoleGuard><Integrations /></RoleGuard>} />,
    <Route key="g-intw" path="integrations/*" element={<RoleGuard><Integrations /></RoleGuard>} />,
    <Route key="g-int" path="integrations" element={<RoleGuard><Integrations /></RoleGuard>} />,

    /* Settings */
    <Route key="g-setb" path="settings/billing" element={<RoleGuard><Settings /></RoleGuard>} />,
    <Route key="g-setbi" path="billing" element={<RoleGuard><Settings /></RoleGuard>} />,
    <Route key="g-sett" path="settings/:type" element={<RoleGuard><Settings /></RoleGuard>} />,
    <Route key="g-setw" path="settings/*" element={<RoleGuard><Settings /></RoleGuard>} />,
    <Route key="g-set" path="settings" element={<RoleGuard><Settings /></RoleGuard>} />
  ];
}

export default function App() {
  const appRoutes = getGerainaAppSubRoutes();
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Direct Auth Top-level & Full URL Mappings */}
          <Route path="/login" element={<Login />} />
          <Route path="/geraina/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/geraina/register" element={<Register />} />
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
            
            <Route path="app/*" element={<AppLayout />}>{appRoutes}</Route>

            {/* Direct un-prefixed management routes & deep links */}
            <Route path="dashboard/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="pos/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="products/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="inventory/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="purchase/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="suppliers/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="customers/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="debt/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="payments/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="reports/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="staff/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="branches/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="integrations/*" element={<AppLayout />}>{appRoutes}</Route>
            <Route path="settings/*" element={<AppLayout />}>{appRoutes}</Route>
          </Route>

          {/* Root Fallback */}
          <Route path="/app/*" element={<AppLayout />}>{appRoutes}</Route>

          <Route path="*" element={<GerainaRootComponent />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
